import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

function addOptionalFilter(conditions, parameters, value, sql) {
  if (value !== undefined && value !== null && value !== "") {
    conditions.push(sql);
    parameters.push(value);
  }
}

const SORT_COLUMNS = Object.freeze({
  branchName: "s.Nombre_Sucursal",
  reference: "d.referenciaDocumento",
  description: "d.numeroContrato",
  providerName: "p.Nombre_comercial",
  categoryName: "c.nombreCategoria",
  subcategoryName: "sc.NombreSubcategoria",
  documentDate: "d.fechaContrato",
  expirationDate: "d.fechaVencimiento",
  createdByName: "u.Nombre_Personas",
  levelName: "n.NivelPermiso",
  statusName: "st.nombreEstado",
});

function documentTypeCondition(documentType) {
  if (documentType === "administrative") return "s.isAdministrativa = 1";
  if (documentType === "all") return null;
  return "s.isAdministrativa = 0";
}

function catalogBranchCondition(documentType) {
  if (documentType === "administrative") return "isAdministrativa = 1";
  if (documentType === "all") return "isActivo = 1";
  return "isAdministrativa = 0 AND isActivo = 1";
}

async function inTransaction(databasePool, action) {
  if (typeof databasePool.getConnection !== "function") return action(databasePool);
  const connection = await databasePool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function documentNotFound() {
  const error = new Error("El documento solicitado no existe.");
  error.status = 404;
  error.code = "DOCUMENT_NOT_FOUND";
  return error;
}

function branchNotFound() {
  const error = new Error("La sucursal seleccionada no existe.");
  error.status = 404;
  error.code = "BRANCH_NOT_FOUND";
  return error;
}

function invalidCatalog(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  error.field = field;
  return error;
}

function normalizeDocumentRow(row) {
  if (!row) return null;
  return {
    ...row,
    isReferential: Boolean(row.isReferential),
    isActive: Boolean(row.isActive),
    isActivePrincipal: Boolean(row.isActivePrincipal),
    hasAttachment: Boolean(row.hasAttachment),
    attachment: row.attachmentId
      ? {
          id: Number(row.attachmentId),
          fileName: row.attachmentFileName || "",
          extension: row.attachmentExtension || "",
          contentType: row.attachmentContentType || "application/octet-stream",
          hasS3: Boolean(row.attachmentS3Key),
        }
      : null,
  };
}

export function createDocumentRepository(pool) {
  const databases = getDatabaseNames();
  const fromClause = `
    FROM ${databases.documents}.tblDocumentos d
    INNER JOIN ${databases.people}.tblSucursales s ON s.Codigo_Sucursal = d.codigoSucursal
    LEFT JOIN ${databases.documents}.tblCategoriaDocumentos c ON c.codigoCategoria = d.categoriaDocumento
    LEFT JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
      ON sc.codigoSubcategoria = d.subCategoriaDocumento
     AND sc.codigoCategoria = d.categoriaDocumento
    LEFT JOIN ${databases.documents}.tblEstadoDocumentacion st ON st.codigoEstado = d.estadoDocumento
    LEFT JOIN ${databases.documents}.tblNivelPermisos n ON n.coditoNivel = d.nivelPermiso
    LEFT JOIN ${databases.providers}.tblProveedores p ON p.cod_Proveedor = d.codigoProveedor
    LEFT JOIN ${databases.people}.tblPersonas u ON u.Codigo_Personas = d.usuarioCreacion
    LEFT JOIN ${databases.documents}.tblArchivosDocumentos a ON a.codigoArchivo = d.codigoArchivo
  `;

  const detailSelect = `
    SELECT d.codigoDocumento AS id,
           d.referenciaDocumento AS reference,
           d.codigoSucursal AS branchId,
           CONCAT(s.Codigo_InternoSucursal, ' ', s.Nombre_Sucursal) AS branchName,
           s.Codigo_InternoSucursal AS branchCode,
           d.codigoProveedor AS providerId,
           p.Nombre_comercial AS providerName,
           d.numeroContrato AS description,
           DATE_FORMAT(d.fechaContrato, '%Y-%m-%d') AS documentDate,
           DATE_FORMAT(d.fechaVencimiento, '%Y-%m-%d') AS expirationDate,
           d.estadoDocumento AS statusId,
           st.nombreEstado AS statusName,
           d.Observaciones AS observations,
           d.categoriaDocumento AS categoryId,
           c.nombreCategoria AS categoryName,
           d.subCategoriaDocumento AS subcategoryId,
           sc.NombreSubcategoria AS subcategoryName,
           d.nivelPermiso AS levelId,
           n.NivelPermiso AS levelName,
           d.isActive AS isActive,
           d.usuarioCreacion AS createdById,
           creator.Nombre_Personas AS createdByName,
           d.fechaHoraCreacion AS createdAt,
           d.usuarioAprobo AS approvedById,
           approver.Nombre_Personas AS approvedByName,
           d.fechaHoraAprobo AS approvedAt,
           d.tipoDocumentacion AS documentType,
           d.isReferencial AS isReferential,
           d.referencia2 AS secondaryReference,
           d.IsActivoPrincipal AS isActivePrincipal,
           a.codigoArchivo AS attachmentId,
           a.nameFile AS attachmentFileName,
           a.ext AS attachmentExtension,
           CASE LOWER(a.ext)
             WHEN 'pdf' THEN 'application/pdf'
             WHEN 'png' THEN 'image/png'
             WHEN 'jpg' THEN 'image/jpeg'
             WHEN 'jpeg' THEN 'image/jpeg'
             WHEN 'bmp' THEN 'image/bmp'
             ELSE 'application/octet-stream'
           END AS attachmentContentType,
           a.CodS3 AS attachmentS3Key,
           (a.codigoArchivo IS NOT NULL AND a.isActive = 1
             AND (a.CodS3 IS NOT NULL OR OCTET_LENGTH(a.fileData) > 0)) AS hasAttachment
    FROM ${databases.documents}.tblDocumentos d
    INNER JOIN ${databases.people}.tblSucursales s ON s.Codigo_Sucursal = d.codigoSucursal
    LEFT JOIN ${databases.documents}.tblCategoriaDocumentos c ON c.codigoCategoria = d.categoriaDocumento
    LEFT JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
      ON sc.codigoSubcategoria = d.subCategoriaDocumento
     AND sc.codigoCategoria = d.categoriaDocumento
    LEFT JOIN ${databases.documents}.tblEstadoDocumentacion st ON st.codigoEstado = d.estadoDocumento
    LEFT JOIN ${databases.documents}.tblNivelPermisos n ON n.coditoNivel = d.nivelPermiso
    LEFT JOIN ${databases.providers}.tblProveedores p ON p.cod_Proveedor = d.codigoProveedor
    LEFT JOIN ${databases.people}.tblPersonas creator ON creator.Codigo_Personas = d.usuarioCreacion
    LEFT JOIN ${databases.people}.tblPersonas approver ON approver.Codigo_Personas = d.usuarioAprobo
    LEFT JOIN ${databases.documents}.tblArchivosDocumentos a ON a.codigoArchivo = d.codigoArchivo
  `;

  function buildFilters(countryCode, filters) {
    const conditions = ["d.codigoPais = ?"];
    const parameters = [countryCode];
    if (!filters.includeInactive) conditions.push("d.isActive = 1");
    const typeCondition = documentTypeCondition(filters.documentType);
    if (typeCondition) conditions.push(typeCondition);
    addOptionalFilter(conditions, parameters, filters.branchId, "d.codigoSucursal = ?");
    addOptionalFilter(conditions, parameters, filters.categoryId, "d.categoriaDocumento = ?");
    addOptionalFilter(conditions, parameters, filters.subcategoryId, "d.subCategoriaDocumento = ?");
    addOptionalFilter(conditions, parameters, filters.statusId, "d.estadoDocumento = ?");
    addOptionalFilter(conditions, parameters, filters.startDate, "d.fechaContrato >= ?");
    addOptionalFilter(conditions, parameters, filters.endDate, "d.fechaContrato <= ?");
    addOptionalFilter(conditions, parameters, filters.expirationStartDate, "d.fechaVencimiento >= ?");
    addOptionalFilter(conditions, parameters, filters.expirationEndDate, "d.fechaVencimiento <= ?");
    if (filters.search) {
      conditions.push("(d.numeroContrato LIKE CONCAT('%', ?, '%') OR d.referenciaDocumento LIKE CONCAT('%', ?, '%'))");
      parameters.push(filters.search, filters.search);
    }
    return { where: `WHERE ${conditions.join(" AND ")}`, parameters };
  }

  async function getByIdWith(databasePool, countryCode, documentId) {
    const [rows] = await databasePool.execute(
      `${detailSelect} WHERE d.codigoPais = ? AND d.codigoDocumento = ? LIMIT 1`,
      [countryCode, documentId],
    );
    return normalizeDocumentRow(rows[0]);
  }

  return {
    async list(countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const { where, parameters } = buildFilters(countryCode, filters);
      const offset = (filters.page - 1) * filters.pageSize;
      const sortColumn = SORT_COLUMNS[filters.sortBy];
      const orderBy = sortColumn && filters.sortDirection
        ? `${sortColumn} ${filters.sortDirection.toUpperCase()}`
        : "s.OrdenSucursal ASC";
      const selectQuery = `
        SELECT d.codigoDocumento AS id,
               CONCAT(s.Codigo_InternoSucursal, ' ', s.Nombre_Sucursal) AS branchName,
               s.Codigo_InternoSucursal AS branchCode,
               s.Nombre_Sucursal AS branchOnlyName,
               d.referenciaDocumento AS reference,
               d.numeroContrato AS description,
               p.Nombre_comercial AS providerName,
               c.nombreCategoria AS categoryName,
               sc.NombreSubcategoria AS subcategoryName,
               d.referencia2 AS secondaryReference,
               DATE_FORMAT(d.fechaContrato, '%Y-%m-%d') AS documentDate,
               DATE_FORMAT(d.fechaVencimiento, '%Y-%m-%d') AS expirationDate,
               u.Nombre_Personas AS createdByName,
               n.NivelPermiso AS levelName,
               st.nombreEstado AS statusName,
               d.estadoDocumento AS statusId,
               d.isReferencial AS isReferential,
               sc.isObligatorio AS isRequired,
               CASE
                 WHEN DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) >= 0
                  AND DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) < 30 THEN 'Menos de 1 Mes'
                 WHEN DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) > 30
                  AND DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) < 60 THEN 'Menos de 2 Meses'
                 WHEN DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) > 61
                  AND DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) < 90 THEN 'Menos de 3 Meses'
                 ELSE ''
               END AS expirationTime,
               a.codigoArchivo AS attachmentId,
               a.nameFile AS attachmentFileName,
               (a.codigoArchivo IS NOT NULL AND a.isActive = 1
                 AND (a.CodS3 IS NOT NULL OR OCTET_LENGTH(a.fileData) > 0)) AS hasAttachment
        ${fromClause}
        ${where}
        ORDER BY ${orderBy}
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${where}`;
      const [[itemsResult], [countRows]] = await Promise.all([
        databasePool.execute(selectQuery, parameters),
        databasePool.execute(countQuery, parameters),
      ]);
      return {
        items: itemsResult.map((item) => ({
          ...item,
          isReferential: Boolean(item.isReferential),
          isRequired: Boolean(item.isRequired),
          attachmentId: item.attachmentId ? Number(item.attachmentId) : null,
          hasAttachment: Boolean(item.hasAttachment),
        })),
        total: Number(countRows[0]?.total || 0),
        page: filters.page,
        pageSize: filters.pageSize,
      };
    },

    async getCatalogs(countryCode, documentType = "branch") {
      const databasePool = pool || getDatabasePool();
      const branchCondition = catalogBranchCondition(documentType);
      const queries = [
        [`SELECT Codigo_Sucursal AS id, CONCAT(Codigo_InternoSucursal, ' ', Nombre_Sucursal) AS name FROM ${databases.people}.tblSucursales WHERE Codigo_Pais = ? AND ${branchCondition} ORDER BY OrdenSucursal`, [countryCode]],
        [`SELECT Codigo_Sucursal AS id, CONCAT(Codigo_InternoSucursal, ' ', Nombre_Sucursal) AS name FROM ${databases.people}.tblSucursales WHERE Codigo_Pais = ? AND isAdministrativa = 1 AND isActivo = 1 AND Codigo_InternoSucursal = 'FA00' ORDER BY OrdenSucursal`, [countryCode]],
        [`SELECT cod_Proveedor AS id, Nombre_comercial AS name FROM ${databases.providers}.tblProveedores WHERE codPais = ? ORDER BY Nombre_comercial`, [countryCode]],
        [`SELECT codigoCategoria AS id, nombreCategoria AS name FROM ${databases.documents}.tblCategoriaDocumentos WHERE codigoPais = ? ORDER BY nombreCategoria`, [countryCode]],
        [`SELECT codigoSubcategoria AS id, NombreSubcategoria AS name, codigoCategoria AS categoryId FROM ${databases.documents}.tblSubcategoriaDocumentos WHERE codigoPais = ? ORDER BY NombreSubcategoria`, [countryCode]],
        [`SELECT codigoEstado AS id, nombreEstado AS name FROM ${databases.documents}.tblEstadoDocumentacion WHERE codigoPais = ? AND isActive = 1 ORDER BY codigoEstado`, [countryCode]],
        [`SELECT coditoNivel AS id, NivelPermiso AS name FROM ${databases.documents}.tblNivelPermisos ORDER BY coditoNivel`, []],
      ];
      const results = await Promise.all(queries.map(([sql, params]) => databasePool.execute(sql, params)));
      return {
        branches: results[0][0],
        administrativeBranches: results[1][0],
        providers: results[2][0],
        categories: results[3][0],
        subcategories: results[4][0],
        statuses: results[5][0],
        levels: results[6][0],
      };
    },

    getById(countryCode, documentId) {
      return getByIdWith(pool || getDatabasePool(), countryCode, documentId);
    },

    async create(countryCode, userId, document, attachment) {
      const databasePool = pool || getDatabasePool();
      const created = await inTransaction(databasePool, async (connection) => {
        const branchCondition = document.documentType === 2
          ? "isAdministrativa = 1 AND Codigo_InternoSucursal = 'FA00'"
          : "isAdministrativa = 0";
        const [branchRows] = await connection.execute(
          `SELECT Codigo_Sucursal AS id FROM ${databases.people}.tblSucursales
           WHERE Codigo_Sucursal = ? AND Codigo_Pais = ? AND isActivo = 1 AND ${branchCondition}
           LIMIT 1`,
          [document.branchId, countryCode],
        );
        if (!branchRows[0]) throw invalidCatalog("La sucursal seleccionada no es valida.", "branchId");

        const [catalogRows] = await connection.execute(
          `SELECT c.abreviaturaRef AS categoryCode, sc.Segmento AS segment
           FROM ${databases.documents}.tblCategoriaDocumentos c
           INNER JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
             ON sc.codigoCategoria = c.codigoCategoria
            AND sc.codigoSubcategoria = ?
            AND sc.codigoPais = c.codigoPais
           WHERE c.codigoCategoria = ? AND c.codigoPais = ?
           LIMIT 1 FOR UPDATE`,
          [document.subcategoryId, document.categoryId, countryCode],
        );
        if (!catalogRows[0]) {
          throw invalidCatalog("La categoria o subcategoria seleccionada no es valida.", "subcategoryId");
        }

        if (document.providerId) {
          const [providerRows] = await connection.execute(
            `SELECT cod_Proveedor AS id FROM ${databases.providers}.tblProveedores
             WHERE cod_Proveedor = ? AND codPais = ? LIMIT 1`,
            [document.providerId, countryCode],
          );
          if (!providerRows[0]) throw invalidCatalog("El proveedor seleccionado no es valido.", "providerId");
        }

        const [referenceRows] = await connection.execute(
          `SELECT COALESCE(MAX(CAST(RIGHT(referenciaDocumento, 6) AS UNSIGNED)), 0) AS lastNumber
           FROM ${databases.documents}.tblDocumentos
           WHERE codigoPais = ? AND categoriaDocumento = ?`,
          [countryCode, document.categoryId],
        );
        const categoryCode = String(catalogRows[0].categoryCode || "").trim();
        const segment = String(catalogRows[0].segment || "").trim();
        const reference = `${categoryCode}-${segment}-${String(Number(referenceRows[0]?.lastNumber || 0) + 1).padStart(6, "0")}`;
        if (!categoryCode || !segment || reference.length > 16) {
          throw invalidCatalog("No fue posible generar la referencia del documento.", "subcategoryId");
        }

        if (document.isActivePrincipal) {
          await connection.execute(
            `UPDATE ${databases.documents}.tblDocumentos
             SET IsActivoPrincipal = 0
             WHERE codigoPais = ? AND codigoSucursal = ?
               AND categoriaDocumento = ? AND subCategoriaDocumento = ?
               AND isActive = 1 AND IsActivoPrincipal = 1`,
            [countryCode, document.branchId, document.categoryId, document.subcategoryId],
          );
        }

        const [attachmentResult] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblArchivosDocumentos
             (nameFile, fileData, ext, tipoArchivo, isActive, fechaHoraRegistro, CodS3)
           VALUES (?, ?, ?, 1, 1, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?)`,
          [attachment.fileName, attachment.buffer, attachment.extension, attachment.s3Key],
        );
        const [documentResult] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblDocumentos
             (referenciaDocumento, codigoPais, codigoSucursal, codigoProveedor, numeroContrato,
              fechaContrato, fechaVencimiento, estadoDocumento, categoriaDocumento,
              subCategoriaDocumento, nivelPermiso, isActive, usuarioCreacion, fechaHoraCreacion,
              codigoArchivo, tipoDocumentacion, isReferencial, referencia2, IsActivoPrincipal)
           VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?, ?, 1, ?,
                   DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?, ?, ?, ?, ?)`,
          [
            reference,
            countryCode,
            document.branchId,
            document.providerId || null,
            document.description,
            document.documentDate,
            document.expirationDate,
            document.categoryId,
            document.subcategoryId,
            document.level,
            userId,
            attachmentResult.insertId,
            document.documentType,
            document.isReferential,
            document.secondaryReference || null,
            document.isActivePrincipal,
          ],
        );
        return { id: Number(documentResult.insertId), reference };
      });
      return getByIdWith(databasePool, countryCode, created.id);
    },

    async updateReference2(countryCode, userId, documentId, secondaryReference) {
      const databasePool = pool || getDatabasePool();
      const [result] = await databasePool.execute(
        `UPDATE ${databases.documents}.tblDocumentos
         SET referencia2 = ?, usuarioUltimaActualizacion = ?,
             fechaUltimaActualizacion = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
         WHERE codigoDocumento = ? AND codigoPais = ? AND isActive = 1`,
        [secondaryReference || null, userId, documentId, countryCode],
      );
      if (!result.affectedRows) throw documentNotFound();
      return getByIdWith(databasePool, countryCode, documentId);
    },

    async setStatus(countryCode, userId, documentId, statusId) {
      const databasePool = pool || getDatabasePool();
      const [result] = await databasePool.execute(
        `UPDATE ${databases.documents}.tblDocumentos
         SET estadoDocumento = ?, usuarioAprobo = ?,
             fechaHoraAprobo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
         WHERE codigoDocumento = ? AND codigoPais = ? AND isActive = 1 AND estadoDocumento = 1`,
        [statusId, userId, documentId, countryCode],
      );
      if (!result.affectedRows) {
        const current = await getByIdWith(databasePool, countryCode, documentId);
        if (!current) throw documentNotFound();
        throw invalidCatalog("El documento ya no se encuentra En Revision.", "statusId");
      }
      return getByIdWith(databasePool, countryCode, documentId);
    },

    async softDelete(countryCode, userId, documentId) {
      const databasePool = pool || getDatabasePool();
      const [result] = await databasePool.execute(
        `UPDATE ${databases.documents}.tblDocumentos
         SET isActive = 0, usuarioUltimaActualizacion = ?,
             fechaUltimaActualizacion = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
         WHERE codigoDocumento = ? AND codigoPais = ? AND isActive = 1`,
        [userId, documentId, countryCode],
      );
      if (!result.affectedRows) throw documentNotFound();
      return { id: documentId };
    },

    async getAttachment(countryCode, documentId) {
      const databasePool = pool || getDatabasePool();
      const [rows] = await databasePool.execute(
        `SELECT a.codigoArchivo AS id, a.nameFile AS fileName, a.fileData AS buffer,
                a.ext AS extension, a.CodS3 AS s3Key
         FROM ${databases.documents}.tblDocumentos d
         INNER JOIN ${databases.documents}.tblArchivosDocumentos a
           ON a.codigoArchivo = d.codigoArchivo AND a.isActive = 1
         WHERE d.codigoDocumento = ? AND d.codigoPais = ? AND d.isActive = 1
         LIMIT 1`,
        [documentId, countryCode],
      );
      return rows[0] || null;
    },

    async getBranchDetail(countryCode, branchId) {
      const databasePool = pool || getDatabasePool();
      const [branchRows] = await databasePool.execute(
        `SELECT s.Codigo_Sucursal AS id, s.Codigo_InternoSucursal AS code,
                s.Nombre_Sucursal AS name, s.DireccionSucursal AS address,
                ga.Nombre_Personas AS areaManagerName,
                 (SELECT gf.Nombre_Personas
                  FROM ${databases.people}.tblPuestosSucursal ps
                  INNER JOIN ${databases.people}.tblPersonas gf
                    ON gf.Codigo_Personas = ps.Codigo_Persona
                 WHERE ps.Codigo_Sucursal = s.Codigo_Sucursal
                    AND ps.Codigo_Puesto = 3 AND gf.isActivo = 1
                  LIMIT 1) AS pharmacyManagerName,
                (SELECT gf.Correo_electronico
                 FROM ${databases.people}.tblPuestosSucursal ps
                 INNER JOIN ${databases.people}.tblPersonas gf
                   ON gf.Codigo_Personas = ps.Codigo_Persona
                 WHERE ps.Codigo_Sucursal = s.Codigo_Sucursal
                   AND ps.Codigo_Puesto = 3 AND gf.isActivo = 1
                 LIMIT 1) AS pharmacyManagerEmail
         FROM ${databases.people}.tblSucursales s
         LEFT JOIN ${databases.people}.tblPersonas ga ON ga.Codigo_Personas = s.CodGA
         WHERE s.Codigo_Sucursal = ? AND s.Codigo_Pais = ? AND s.isActivo = 1
         LIMIT 1`,
        [branchId, countryCode],
      );
      if (!branchRows[0]) throw branchNotFound();

      const [branchImageRows] = await databasePool.execute(
        `SELECT filedata AS buffer, ext AS extension, nameData AS fileName
         FROM ${databases.branchMedia}.tblSucursalesMultimedia
         WHERE codigoSucursal = ? AND codigoPais = ? AND isActive = 1
         LIMIT 1`,
        [branchId, countryCode],
      );

      const [documentRows] = await databasePool.execute(
        `SELECT c.codigoCategoria AS categoryId, c.nombreCategoria AS categoryName,
                sc.codigoSubcategoria AS subcategoryId,
                sc.NombreSubcategoria AS subcategoryName,
                sc.isObligatorio AS isRequired,
                d.codigoDocumento AS documentId, d.referenciaDocumento AS reference,
                d.numeroContrato AS description,
                DATE_FORMAT(d.fechaContrato, '%Y-%m-%d') AS documentDate,
                DATE_FORMAT(d.fechaVencimiento, '%Y-%m-%d') AS expirationDate,
                d.isReferencial AS isReferential, d.referencia2 AS secondaryReference,
                st.nombreEstado AS statusName, d.estadoDocumento AS statusId,
                a.codigoArchivo AS attachmentId, a.nameFile AS attachmentFileName,
                a.ext AS attachmentExtension,
                a.CodS3 AS attachmentS3Key,
                (a.codigoArchivo IS NOT NULL AND a.isActive = 1
                  AND (a.CodS3 IS NOT NULL OR OCTET_LENGTH(a.fileData) > 0)) AS hasAttachment
         FROM ${databases.documents}.tblSubcategoriaDocumentos sc
         INNER JOIN ${databases.documents}.tblCategoriaDocumentos c
           ON c.codigoCategoria = sc.codigoCategoria AND c.codigoPais = sc.codigoPais
         LEFT JOIN ${databases.documents}.tblDocumentos d
           ON d.codigoDocumento = (
             SELECT MAX(principal.codigoDocumento)
             FROM ${databases.documents}.tblDocumentos principal
             WHERE principal.codigoPais = ? AND principal.codigoSucursal = ?
               AND principal.categoriaDocumento = sc.codigoCategoria
               AND principal.subCategoriaDocumento = sc.codigoSubcategoria
               AND principal.isActive = 1 AND principal.IsActivoPrincipal = 1
           )
         LEFT JOIN ${databases.documents}.tblEstadoDocumentacion st
           ON st.codigoEstado = d.estadoDocumento AND st.codigoPais = d.codigoPais
         LEFT JOIN ${databases.documents}.tblArchivosDocumentos a ON a.codigoArchivo = d.codigoArchivo
         ORDER BY sc.isObligatorio DESC
         LIMIT 50`,
        [countryCode, branchId],
      );

      const [bookRows] = await databasePool.execute(
        `SELECT assignment.codigoLibroxSuc AS assignmentId,
                book.codigoLibro AS bookId, book.nombreLibro AS name,
                assignment.isObligatorio AS isRequired,
                evidence.codigoRegistro AS evidenceId, evidence.Keys3 AS s3Key,
                evidence.nombreArchivo AS fileName, evidence.ext AS extension,
                evidence.fechaRegistro AS registeredAt,
                evidence.usuarioCarga AS uploadedById,
                uploader.Nombre_Personas AS uploadedByName,
                evidence.isHistoric AS isHistoric
         FROM ${databases.documents}.tblLibroxSucursal assignment
         INNER JOIN ${databases.documents}.tblLibrosSucursales book
           ON book.codigoLibro = assignment.codigoLibro AND book.codigoPais = assignment.codigoPais
         LEFT JOIN ${databases.documents}.tblLibroxSucursal_Archivo evidence
           ON evidence.codigoLibroxSuc = assignment.codigoLibroxSuc
         LEFT JOIN ${databases.people}.tblPersonas uploader
           ON uploader.Codigo_Personas = evidence.usuarioCarga
         WHERE assignment.codigoPais = ? AND assignment.codigoSucursal = ? AND book.isActive = 1
         ORDER BY assignment.codigoLibroxSuc, evidence.fechaRegistro DESC`,
        [countryCode, branchId],
      );

      const booksById = new Map();
      for (const row of bookRows) {
        if (!booksById.has(row.assignmentId)) {
          booksById.set(row.assignmentId, {
            assignmentId: Number(row.assignmentId),
            bookId: Number(row.bookId),
            name: row.name,
            isRequired: Boolean(row.isRequired),
            evidences: [],
          });
        }
        if (row.evidenceId) {
          booksById.get(row.assignmentId).evidences.push({
            id: Number(row.evidenceId),
            s3Key: row.s3Key || "",
            fileName: row.fileName || "",
            extension: row.extension || "",
            registeredAt: row.registeredAt || "",
            uploadedById: row.uploadedById == null ? null : Number(row.uploadedById),
            uploadedByName: row.uploadedByName || "",
            isHistoric: Boolean(row.isHistoric),
          });
        }
      }

      return {
        branch: {
          ...branchRows[0],
          image: branchImageRows[0]?.buffer
            ? {
                fileBase64: Buffer.from(branchImageRows[0].buffer).toString("base64"),
                extension: branchImageRows[0].extension || "",
                fileName: branchImageRows[0].fileName || "",
              }
            : null,
        },
        documents: documentRows.map((row) => ({
          categoryId: Number(row.categoryId),
          categoryName: row.categoryName,
          subcategoryId: Number(row.subcategoryId),
          subcategoryName: row.subcategoryName,
          isRequired: Boolean(row.isRequired),
          document: row.documentId
            ? {
                id: Number(row.documentId),
                reference: row.reference,
                description: row.description,
                documentDate: row.documentDate,
                expirationDate: row.expirationDate,
                isReferential: Boolean(row.isReferential),
                secondaryReference: row.secondaryReference,
                statusName: row.statusName,
                statusId: Number(row.statusId),
                hasAttachment: Boolean(row.hasAttachment),
                attachment: row.attachmentId
                  ? {
                      id: Number(row.attachmentId),
                      fileName: row.attachmentFileName || "",
                      extension: row.attachmentExtension || "",
                      hasS3: Boolean(row.attachmentS3Key),
                    }
                  : null,
              }
            : null,
        })),
        books: [...booksById.values()],
      };
    },

    async addBookEvidence(countryCode, branchId, userId, assignmentId, attachment) {
      const databasePool = pool || getDatabasePool();
      const [assignmentRows] = await databasePool.execute(
        `SELECT codigoLibroxSuc AS assignmentId, codigoLibro AS bookId
         FROM ${databases.documents}.tblLibroxSucursal
         WHERE codigoLibroxSuc = ? AND codigoSucursal = ? AND codigoPais = ?
         LIMIT 1`,
        [assignmentId, branchId, countryCode],
      );
      if (!assignmentRows[0]) throw invalidCatalog("El libro seleccionado no existe.", "assignmentId");
      const [result] = await databasePool.execute(
        `INSERT INTO ${databases.documents}.tblLibroxSucursal_Archivo
           (codigoLibroxSuc, codigoLibro, codigoSucursal, Keys3, nombreArchivo, ext,
            fechaRegistro, usuarioCarga, isHistoric)
         VALUES (?, ?, ?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?, 0)`,
        [
          assignmentId,
          assignmentRows[0].bookId,
          branchId,
          attachment.s3Key,
          attachment.fileName,
          attachment.extension,
          userId,
        ],
      );
      return {
        id: Number(result.insertId),
        assignmentId,
        fileName: attachment.fileName,
        extension: attachment.extension,
      };
    },

    async updateBookRequired(countryCode, branchId, assignmentId, isRequired) {
      const databasePool = pool || getDatabasePool();
      const [result] = await databasePool.execute(
        `UPDATE ${databases.documents}.tblLibroxSucursal
         SET isObligatorio = ?
         WHERE codigoLibroxSuc = ? AND codigoSucursal = ? AND codigoPais = ?`,
        [isRequired, assignmentId, branchId, countryCode],
      );
      if (!result.affectedRows) throw invalidCatalog("El libro seleccionado no existe.", "assignmentId");
      return { assignmentId, isRequired: Boolean(isRequired) };
    },

    async getBookEvidence(countryCode, branchId, evidenceId) {
      const databasePool = pool || getDatabasePool();
      const [rows] = await databasePool.execute(
        `SELECT evidence.codigoRegistro AS id, evidence.Keys3 AS s3Key,
                evidence.nombreArchivo AS fileName, evidence.ext AS extension
         FROM ${databases.documents}.tblLibroxSucursal_Archivo evidence
         INNER JOIN ${databases.documents}.tblLibroxSucursal assignment
           ON assignment.codigoLibroxSuc = evidence.codigoLibroxSuc
         WHERE evidence.codigoRegistro = ? AND assignment.codigoSucursal = ?
           AND assignment.codigoPais = ? LIMIT 1`,
        [evidenceId, branchId, countryCode],
      );
      return rows[0] || null;
    },

    async removeBookEvidence(countryCode, branchId, evidenceId) {
      const databasePool = pool || getDatabasePool();
      const [result] = await databasePool.execute(
        `UPDATE ${databases.documents}.tblLibroxSucursal_Archivo evidence
         INNER JOIN ${databases.documents}.tblLibroxSucursal assignment
           ON assignment.codigoLibroxSuc = evidence.codigoLibroxSuc
         SET evidence.isHistoric = 1
         WHERE evidence.codigoRegistro = ? AND assignment.codigoSucursal = ?
           AND assignment.codigoPais = ? AND evidence.isHistoric = 0`,
        [evidenceId, branchId, countryCode],
      );
      if (!result.affectedRows) {
        const error = new Error("La evidencia seleccionada no existe.");
        error.status = 404;
        error.code = "BOOK_EVIDENCE_NOT_FOUND";
        throw error;
      }
      return { id: evidenceId };
    },
  };
}
