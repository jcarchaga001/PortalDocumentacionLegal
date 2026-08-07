import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

function addOptionalFilter(conditions, parameters, value, sql) {
  if (value !== undefined && value !== null && value !== "") {
    conditions.push(sql);
    parameters.push(value);
  }
}

export function createAgreementRepository(pool) {
  const databases = getDatabaseNames();

  function buildFilters(countryCode, filters) {
    const conditions = ["cc.CodPais = ?"];
    const parameters = [countryCode];
    addOptionalFilter(conditions, parameters, filters.clientId, "a.CodClienteCorporativo = ?");
    addOptionalFilter(conditions, parameters, filters.startDate, "a.FechaFinal >= ?");
    addOptionalFilter(conditions, parameters, filters.endDate, "a.FechaFinal <= ?");
    if (filters.indefinite) {
      conditions.push("(DATEDIFF(a.FechaFinal, CURDATE()) < 30 OR a.isIndefinido = 1)");
    }
    if (filters.search) {
      conditions.push("(cc.Nombre_Cliente LIKE CONCAT('%', ?, '%') OR a.CodEmpleado LIKE CONCAT('%', ?, '%'))");
      parameters.push(filters.search, filters.search);
    }
    return { where: `WHERE ${conditions.join(" AND ")}`, parameters };
  }

  const baseJoins = `
    FROM ${databases.documents}.tblConvenios a
    INNER JOIN ${databases.documents}.tblClientesCorp cc
      ON cc.CodClientesCorp = a.CodClienteCorporativo
  `;
  const joins = `
    ${baseJoins}
    LEFT JOIN ${databases.documents}.tblConveniosXSucursal axb
      ON axb.CodConvenio = a.CodConvenio AND axb.isActivo = 1
    LEFT JOIN ${databases.people}.tblSucursales b
      ON b.Codigo_Sucursal = axb.CodSucursal
  `;

  async function getAccountManagers(databasePool, codes) {
    const uniqueCodes = [...new Set(codes.filter(Boolean))];
    if (!uniqueCodes.length) return new Map();
    const placeholders = uniqueCodes.map(() => "?").join(",");
    const [rows] = await databasePool.execute(
      `SELECT employee.CodigoInterno AS id,
              employee.NombreCompleto AS name,
              employee.Puesto AS position,
              employee.Area AS area,
              employee.CodSucursal AS branchId,
              CASE
                WHEN branch.Codigo_InternoSucursal LIKE '%Call Center%' THEN 1
                ELSE 0
              END AS isCentralized
       FROM ${databases.humanResources}.vstEmpleadosMesEnCurso employee
       LEFT JOIN ${databases.people}.tblSucursales branch
         ON branch.Codigo_Sucursal = employee.CodSucursal
       WHERE employee.CodigoInterno IN (${placeholders})
       ORDER BY employee.CodigoInterno, employee.FechaCreacion ASC`,
      uniqueCodes,
    );
    const managers = new Map();
    for (const row of rows) {
      if (!managers.has(row.id)) managers.set(row.id, row);
    }
    return managers;
  }

  async function validateBranches(connection, countryCode, branchIds) {
    if (!branchIds.length) return;
    const placeholders = branchIds.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT Codigo_Sucursal AS id
       FROM ${databases.people}.tblSucursales
       WHERE Codigo_Pais = ? AND isActivo = 1 AND Codigo_Sucursal IN (${placeholders})`,
      [countryCode, ...branchIds],
    );
    if (rows.length !== branchIds.length) {
      const error = new Error("Una o mas sucursales no pertenecen al pais de la sesion.");
      error.status = 400;
      error.code = "INVALID_BRANCH";
      error.field = "branchIds";
      throw error;
    }
  }

  async function replaceBranches(connection, agreementId, countryCode, branchIds) {
    await validateBranches(connection, countryCode, branchIds);
    await connection.execute(
      `UPDATE ${databases.documents}.tblConveniosXSucursal SET isActivo = 0 WHERE CodConvenio = ?`,
      [agreementId],
    );
    for (const branchId of branchIds) {
      const [existing] = await connection.execute(
        `SELECT CodConvenioSucursal AS id
         FROM ${databases.documents}.tblConveniosXSucursal
         WHERE CodConvenio = ? AND CodSucursal = ? LIMIT 1`,
        [agreementId, branchId],
      );
      if (existing[0]) {
        await connection.execute(
          `UPDATE ${databases.documents}.tblConveniosXSucursal SET isActivo = 1 WHERE CodConvenioSucursal = ?`,
          [existing[0].id],
        );
      } else {
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblConveniosXSucursal (CodConvenio, CodSucursal, isActivo)
           VALUES (?, ?, 1)`,
          [agreementId, branchId],
        );
      }
    }
  }

  async function insertAttachments(connection, agreementId, userId, attachments) {
    for (const attachment of attachments || []) {
      await connection.execute(
        `INSERT INTO ${databases.documents}.tblAdjuntosXConvenio
           (CodConvenio, KeyS3, NombreArchivo, Extencion, FechaCreacion, HoraCreacion,
            CodUsuarioCreador, isActivo)
         VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?, 1)`,
        [agreementId, attachment.s3Key, attachment.fileName, attachment.extension || null, userId],
      );
    }
  }

  function promissoryAttachmentError() {
    const error = new Error("Afirmo que el cliente tiene pagare, porfavor agregar el archivo.");
    error.status = 400;
    error.code = "VALIDATION_ERROR";
    error.field = "attachments";
    return error;
  }

  return {
    async list(countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const { where, parameters } = buildFilters(countryCode, filters);
      const offset = (filters.page - 1) * filters.pageSize;
      const query = `
        SELECT a.CodConvenio AS id,
               a.CodClienteCorporativo AS clientId,
               COALESCE(cc.Nombre_Cliente, a.NombreCliente) AS clientName,
               a.CodEmpleado AS accountManagerCode,
               a.LimiteCredito AS creditLimit,
               a.isDollar AS isDollar,
               a.DiasCredito AS creditDays,
               a.HasPagare AS hasPromissoryNote,
               a.isPagareVencido AS isPromissoryNoteExpired,
               DATE_FORMAT(a.FechaVencimientoPagare, '%Y-%m-%d') AS promissoryNoteExpirationDate,
               DATE_FORMAT(a.FechaInicial, '%Y-%m-%d') AS startDate,
               DATE_FORMAT(a.FechaFinal, '%Y-%m-%d') AS endDate,
               a.isIndefinido AS isIndefinite,
               a.isIndefinidoPagare AS isPromissoryNoteIndefinite,
               a.Observacion AS observation,
               GROUP_CONCAT(DISTINCT CONCAT(b.Codigo_InternoSucursal, ' ', b.Nombre_Sucursal)
                            ORDER BY b.OrdenSucursal SEPARATOR ', ') AS branchNames,
               CASE
                 WHEN a.isIndefinido = 1 THEN 'Indefinido'
                 WHEN DATEDIFF(a.FechaFinal, CURDATE()) < 0 THEN 'Vencido'
                 WHEN DATEDIFF(a.FechaFinal, CURDATE()) < 30 THEN 'Por Vencer'
                 ELSE 'Vigente'
               END AS expirationStatus
        ${joins}
        ${where}
        GROUP BY a.CodConvenio
        ORDER BY CASE
                   WHEN a.isIndefinido = 1 THEN 2
                   WHEN DATEDIFF(a.FechaFinal, CURDATE()) BETWEEN 0 AND 29 THEN 0
                   WHEN DATEDIFF(a.FechaFinal, CURDATE()) < 0 THEN 1
                   ELSE 2
                 END,
                 a.CodConvenio ASC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${baseJoins} ${where}`;
      const [[items], [countRows]] = await Promise.all([
        databasePool.execute(query, parameters),
        databasePool.execute(countQuery, parameters),
      ]);
      const managers = await getAccountManagers(
        databasePool,
        items.map((item) => item.accountManagerCode),
      );
      return {
        items: items.map((item) => {
          const manager = managers.get(item.accountManagerCode);
          return {
            ...item,
            accountManagerName: manager?.name || item.accountManagerCode || "",
            accountManagerPosition: manager?.position || "",
            accountManagerArea: manager?.area || "",
            isCentralized: Boolean(manager?.isCentralized),
            isDollar: Boolean(item.isDollar),
            hasPromissoryNote: Boolean(item.hasPromissoryNote),
            isPromissoryNoteExpired: Boolean(item.isPromissoryNoteExpired),
            isIndefinite: Boolean(item.isIndefinite),
            isPromissoryNoteIndefinite: Boolean(item.isPromissoryNoteIndefinite),
          };
        }),
        total: Number(countRows[0]?.total || 0),
        page: filters.page,
        pageSize: filters.pageSize,
      };
    },

    async getById(countryCode, agreementId) {
      const databasePool = pool || getDatabasePool();
      const [rows] = await databasePool.execute(
        `SELECT a.CodConvenio AS id,
                a.CodClienteCorporativo AS clientId,
                COALESCE(cc.Nombre_Cliente, a.NombreCliente) AS clientName,
                a.CodEmpleado AS accountManagerCode,
                a.LimiteCredito AS creditLimit,
                a.isDollar AS isDollar,
                a.DiasCredito AS creditDays,
                a.HasPagare AS hasPromissoryNote,
                a.isPagareVencido AS isPromissoryNoteExpired,
                DATE_FORMAT(a.FechaVencimientoPagare, '%Y-%m-%d') AS promissoryNoteExpirationDate,
                DATE_FORMAT(a.FechaInicial, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(a.FechaFinal, '%Y-%m-%d') AS endDate,
                a.isIndefinido AS isIndefinite,
                a.isIndefinidoPagare AS isPromissoryNoteIndefinite,
                a.Observacion AS observation,
                DATE_FORMAT(a.FechaCreacion, '%Y-%m-%d') AS createdDate,
                TIME_FORMAT(a.HoraCreacion, '%H:%i:%s') AS createdTime,
                a.CodUsuarioCreador AS createdById,
                creator.Nombre_Personas AS createdByName,
                DATE_FORMAT(a.FechaActualizacion, '%Y-%m-%d') AS updatedDate,
                TIME_FORMAT(a.HoraActializacion, '%H:%i:%s') AS updatedTime,
                a.CodUsuarioActualiza AS updatedById,
                updater.Codigo_Personas AS updatedByPersonId,
                updater.Nombre_Personas AS updatedByName,
                GROUP_CONCAT(DISTINCT axb.CodSucursal ORDER BY b.OrdenSucursal) AS branchIds,
                GROUP_CONCAT(DISTINCT CONCAT(b.Codigo_InternoSucursal, ' - ', b.Nombre_Sucursal)
                             ORDER BY b.OrdenSucursal SEPARATOR '||') AS branchNames
         ${joins}
         LEFT JOIN ${databases.people}.tblPersonas creator
           ON creator.Codigo_Personas = a.CodUsuarioCreador
         LEFT JOIN ${databases.people}.tblPersonas updater
           ON updater.Codigo_Personas = a.CodUsuarioActualiza
         WHERE a.CodConvenio = ? AND cc.CodPais = ?
         GROUP BY a.CodConvenio`,
        [agreementId, countryCode],
      );
      if (!rows[0]) return null;
      const agreement = rows[0];
      const managers = await getAccountManagers(
        databasePool,
        [agreement.accountManagerCode],
      );
      const manager = managers.get(agreement.accountManagerCode);
      const [attachments] = await databasePool.execute(
        `SELECT CodAdjunto AS id, KeyS3 AS s3Key, NombreArchivo AS fileName, Extencion AS extension,
                DATE_FORMAT(FechaCreacion, '%Y-%m-%d') AS createdDate,
                TIME_FORMAT(HoraCreacion, '%H:%i:%s') AS createdTime
         FROM ${databases.documents}.tblAdjuntosXConvenio
         WHERE CodConvenio = ? AND isActivo = 1
         ORDER BY CodAdjunto DESC`,
        [agreementId],
      );
      return {
        ...agreement,
        accountManagerName: manager?.name || agreement.accountManagerCode || "",
        accountManagerPosition: manager?.position || "",
        accountManagerArea: manager?.area || "",
        isDollar: Boolean(agreement.isDollar),
        hasPromissoryNote: Boolean(agreement.hasPromissoryNote),
        isPromissoryNoteExpired: Boolean(agreement.isPromissoryNoteExpired),
        isIndefinite: Boolean(agreement.isIndefinite),
        isPromissoryNoteIndefinite: Boolean(agreement.isPromissoryNoteIndefinite),
        branchIds: agreement.branchIds ? agreement.branchIds.split(",").map(Number) : [],
        branchNames: agreement.branchNames ? agreement.branchNames.split("||") : [],
        attachments,
      };
    },

    async getCatalogs(countryCode) {
      const databasePool = pool || getDatabasePool();
      const results = await Promise.all([
        databasePool.execute(
          `SELECT CodClientesCorp AS id, Nombre_Cliente AS name
           FROM ${databases.documents}.tblClientesCorp
           WHERE CodPais = ? AND EstadoCliente = 1
           ORDER BY Nombre_Cliente`,
          [countryCode],
        ),
        databasePool.execute(
          `SELECT Codigo_Sucursal AS id, CONCAT(Codigo_InternoSucursal, ' ', Nombre_Sucursal) AS name
           FROM ${databases.people}.tblSucursales
           WHERE Codigo_Pais = ? AND isActivo = 1 AND isAdministrativa = 0
           ORDER BY OrdenSucursal`,
          [countryCode],
        ),
        databasePool.execute(
          `SELECT CodigoInterno AS id, NombreCompleto AS name, Puesto AS position, Area AS area
           FROM ${databases.humanResources}.vstEmpleadosMesEnCurso
           WHERE CodPais = ? AND Estado IN ('1', 'Activo', 'ACTIVO')
           ORDER BY NombreCompleto`,
          [countryCode],
        ),
      ]);
      return { clients: results[0][0], branches: results[1][0], accountManagers: results[2][0] };
    },

    async create(countryCode, userId, agreement) {
      const databasePool = pool || getDatabasePool();
      const connection = await databasePool.getConnection();
      try {
        await connection.beginTransaction();
        const [clientRows] = await connection.execute(
          `SELECT Nombre_Cliente AS name FROM ${databases.documents}.tblClientesCorp
           WHERE CodClientesCorp = ? AND CodPais = ? AND EstadoCliente = 1`,
          [agreement.clientId, countryCode],
        );
        if (!clientRows[0]) {
          const error = new Error("El cliente corporativo no existe o no esta activo.");
          error.status = 400;
          error.code = "INVALID_CLIENT";
          error.field = "clientId";
          throw error;
        }
        const [result] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblConvenios
             (CodClienteCorporativo, CodEmpleado, NombreCliente, FechaInicial, FechaFinal, DiasCredito,
              LimiteCredito, HasPagare, isPagareVencido, FechaVencimientoPagare, FechaCreacion,
              HoraCreacion, CodUsuarioCreador, isReportado, isIndefinido, isDollar, Observacion,
              isIndefinidoPagare)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?, 0, ?, ?, ?, ?)`,
          [
            agreement.clientId,
            agreement.accountManagerCode || null,
            clientRows[0].name,
            agreement.startDate,
            agreement.isIndefinite ? null : agreement.endDate,
            agreement.creditDays,
            agreement.creditLimit,
            agreement.hasPromissoryNote,
            agreement.isPromissoryNoteExpired,
            agreement.isPromissoryNoteIndefinite ? null : agreement.promissoryNoteExpirationDate,
            userId,
            agreement.isIndefinite,
            agreement.isDollar,
            agreement.observation || null,
            agreement.isPromissoryNoteIndefinite,
          ],
        );
        await replaceBranches(connection, result.insertId, countryCode, agreement.branchIds);
        await insertAttachments(connection, result.insertId, userId, agreement.attachments);
        await connection.commit();
        return this.getById(countryCode, result.insertId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async update(countryCode, userId, agreementId, agreement) {
      const databasePool = pool || getDatabasePool();
      const connection = await databasePool.getConnection();
      try {
        await connection.beginTransaction();
        const [clientRows] = await connection.execute(
          `SELECT Nombre_Cliente AS name FROM ${databases.documents}.tblClientesCorp
           WHERE CodClientesCorp = ? AND CodPais = ? AND EstadoCliente = 1`,
          [agreement.clientId, countryCode],
        );
        if (!clientRows[0]) {
          const error = new Error("El cliente corporativo no existe o no esta activo.");
          error.status = 400;
          error.code = "INVALID_CLIENT";
          error.field = "clientId";
          throw error;
        }
        if (agreement.hasPromissoryNote) {
          const excludedSql = agreement.removedAttachmentIds.length
            ? ` AND attachment.CodAdjunto NOT IN (${agreement.removedAttachmentIds.map(() => "?").join(",")})`
            : "";
          const [attachmentRows] = await connection.execute(
            `SELECT agreement.CodConvenio AS id,
                    COUNT(CASE WHEN attachment.isActivo = 1${excludedSql} THEN 1 END) AS activeAttachmentCount
             FROM ${databases.documents}.tblConvenios agreement
             INNER JOIN ${databases.documents}.tblClientesCorp currentClient
               ON currentClient.CodClientesCorp = agreement.CodClienteCorporativo
             LEFT JOIN ${databases.documents}.tblAdjuntosXConvenio attachment
               ON attachment.CodConvenio = agreement.CodConvenio
             WHERE agreement.CodConvenio = ? AND currentClient.CodPais = ?
             GROUP BY agreement.CodConvenio
             FOR UPDATE`,
            [...agreement.removedAttachmentIds, agreementId, countryCode],
          );
          if (
            attachmentRows[0]
            && Number(attachmentRows[0].activeAttachmentCount || 0) + agreement.attachments.length < 1
          ) {
            throw promissoryAttachmentError();
          }
        }
        const [result] = await connection.execute(
          `UPDATE ${databases.documents}.tblConvenios a
           INNER JOIN ${databases.documents}.tblClientesCorp currentClient
             ON currentClient.CodClientesCorp = a.CodClienteCorporativo
           SET a.CodClienteCorporativo = ?, a.CodEmpleado = ?, a.NombreCliente = ?,
               a.FechaInicial = ?, a.FechaFinal = ?, a.DiasCredito = ?, a.LimiteCredito = ?,
               a.HasPagare = ?, a.isPagareVencido = ?, a.FechaVencimientoPagare = ?,
               a.FechaActualizacion = CURDATE(), a.HoraActializacion = CURTIME(),
               a.CodUsuarioActualiza = ?, a.isIndefinido = ?, a.isDollar = ?,
               a.Observacion = ?, a.isIndefinidoPagare = ?
           WHERE a.CodConvenio = ? AND currentClient.CodPais = ?`,
          [
            agreement.clientId,
            agreement.accountManagerCode || null,
            clientRows[0].name,
            agreement.startDate,
            agreement.isIndefinite ? null : agreement.endDate,
            agreement.creditDays,
            agreement.creditLimit,
            agreement.hasPromissoryNote,
            agreement.isPromissoryNoteExpired,
            agreement.isPromissoryNoteIndefinite ? null : agreement.promissoryNoteExpirationDate,
            userId,
            agreement.isIndefinite,
            agreement.isDollar,
            agreement.observation || null,
            agreement.isPromissoryNoteIndefinite,
            agreementId,
            countryCode,
          ],
        );
        if (!result.affectedRows) {
          const error = new Error("El convenio solicitado no existe.");
          error.status = 404;
          error.code = "AGREEMENT_NOT_FOUND";
          throw error;
        }
        await replaceBranches(connection, agreementId, countryCode, agreement.branchIds);
        if (agreement.removedAttachmentIds.length) {
          const placeholders = agreement.removedAttachmentIds.map(() => "?").join(",");
          await connection.execute(
            `UPDATE ${databases.documents}.tblAdjuntosXConvenio attachment
             INNER JOIN ${databases.documents}.tblConvenios currentAgreement
               ON currentAgreement.CodConvenio = attachment.CodConvenio
             INNER JOIN ${databases.documents}.tblClientesCorp currentClient
               ON currentClient.CodClientesCorp = currentAgreement.CodClienteCorporativo
             SET attachment.isActivo = 0, attachment.CodUsuarioElimina = ?
             WHERE attachment.CodConvenio = ? AND currentClient.CodPais = ?
               AND attachment.CodAdjunto IN (${placeholders}) AND attachment.isActivo = 1`,
            [userId, agreementId, countryCode, ...agreement.removedAttachmentIds],
          );
        }
        await insertAttachments(connection, agreementId, userId, agreement.attachments);
        await connection.commit();
        return this.getById(countryCode, agreementId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async addAttachment(countryCode, userId, agreementId, attachment) {
      const databasePool = pool || getDatabasePool();
      const [agreementRows] = await databasePool.execute(
        `SELECT a.CodConvenio AS id
         FROM ${databases.documents}.tblConvenios a
         INNER JOIN ${databases.documents}.tblClientesCorp cc
           ON cc.CodClientesCorp = a.CodClienteCorporativo
         WHERE a.CodConvenio = ? AND cc.CodPais = ?`,
        [agreementId, countryCode],
      );
      if (!agreementRows[0]) {
        const error = new Error("El convenio solicitado no existe.");
        error.status = 404;
        error.code = "AGREEMENT_NOT_FOUND";
        throw error;
      }
      const [result] = await databasePool.execute(
        `INSERT INTO ${databases.documents}.tblAdjuntosXConvenio
           (CodConvenio, KeyS3, NombreArchivo, Extencion, FechaCreacion, HoraCreacion,
            CodUsuarioCreador, isActivo)
         VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?, 1)`,
        [agreementId, attachment.s3Key, attachment.fileName, attachment.extension || null, userId],
      );
      return { id: result.insertId, ...attachment };
    },

    async removeAttachment(countryCode, userId, agreementId, attachmentId) {
      const databasePool = pool || getDatabasePool();
      const connection = await databasePool.getConnection();
      try {
        await connection.beginTransaction();
        const [agreementRows] = await connection.execute(
          `SELECT agreement.CodConvenio AS id, agreement.HasPagare AS hasPromissoryNote
           FROM ${databases.documents}.tblConvenios agreement
           INNER JOIN ${databases.documents}.tblClientesCorp client
             ON client.CodClientesCorp = agreement.CodClienteCorporativo
           WHERE agreement.CodConvenio = ? AND client.CodPais = ?
           LIMIT 1 FOR UPDATE`,
          [agreementId, countryCode],
        );
        const [attachmentRows] = await connection.execute(
          `SELECT CodAdjunto AS id
           FROM ${databases.documents}.tblAdjuntosXConvenio
           WHERE CodAdjunto = ? AND CodConvenio = ? AND isActivo = 1
           LIMIT 1 FOR UPDATE`,
          [attachmentId, agreementId],
        );
        if (!agreementRows[0] || !attachmentRows[0]) {
          const error = new Error("El adjunto solicitado no existe.");
          error.status = 404;
          error.code = "AGREEMENT_ATTACHMENT_NOT_FOUND";
          throw error;
        }
        if (Number(agreementRows[0].hasPromissoryNote) === 1) {
          const [countRows] = await connection.execute(
            `SELECT COUNT(*) AS activeAttachmentCount
             FROM ${databases.documents}.tblAdjuntosXConvenio
             WHERE CodConvenio = ? AND isActivo = 1`,
            [agreementId],
          );
          if (Number(countRows[0]?.activeAttachmentCount || 0) <= 1) {
            throw promissoryAttachmentError();
          }
        }
        const [result] = await connection.execute(
          `UPDATE ${databases.documents}.tblAdjuntosXConvenio
           SET isActivo = 0, CodUsuarioElimina = ?
           WHERE CodAdjunto = ? AND CodConvenio = ? AND isActivo = 1`,
          [userId, attachmentId, agreementId],
        );
        if (!result.affectedRows) {
          const error = new Error("El adjunto solicitado no existe.");
          error.status = 404;
          error.code = "AGREEMENT_ATTACHMENT_NOT_FOUND";
          throw error;
        }
        await connection.commit();
        return { id: attachmentId };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
