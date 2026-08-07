import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

function normalizeAffectedRows(result) {
  return Number(result?.affectedRows || 0);
}

function listPlaceholders(values) {
  return values.map(() => "?").join(", ");
}

export function createNotificationRepository(pool) {
  const databases = getDatabaseNames();
  const databasePool = () => pool || getDatabasePool();

  return {
    async findPerson(personId, countryCode) {
      const [rows] = await databasePool().execute(
        `SELECT Codigo_Personas AS id,
                Nombre_Personas AS name,
                Correo_electronico AS email,
                COALESCE(isUsuario, 0) AS isSystemUser,
                COALESCE(isActivo, 0) AS isActive
         FROM ${databases.people}.tblPersonas
         WHERE Codigo_Personas = ? AND CodigoPais = ?
         LIMIT 1`,
        [personId, countryCode],
      );
      return rows[0] || null;
    },

    async findBranch(branchId, countryCode) {
      const [rows] = await databasePool().execute(
        `SELECT Codigo_Sucursal AS id,
                Nombre_Sucursal AS name,
                Codigo_InternoSucursal AS internalCode,
                correoSucursal AS email,
                Codigo_Pais AS countryCode
         FROM ${databases.people}.tblSucursales
         WHERE Codigo_Sucursal = ? AND Codigo_Pais = ?
         LIMIT 1`,
        [branchId, countryCode],
      );
      return rows[0] || null;
    },

    async findDocumentExpiration(documentId, countryCode) {
      const [rows] = await databasePool().execute(
        `SELECT d.codigoDocumento AS id,
                d.codigoSucursal AS branchId,
                d.codigoPais AS countryCode,
                d.numeroContrato AS contractNumber,
                d.referenciaDocumento AS documentReference,
                DATE_FORMAT(d.fechaVencimiento, '%Y-%m-%d') AS dueDate,
                d.tipoDocumentacion AS documentType,
                s.Nombre_Sucursal AS branchName,
                sc.NombreSubcategoria AS documentName,
                st.nombreEstado AS transactionType
         FROM ${databases.documents}.tblDocumentos d
         INNER JOIN ${databases.people}.tblSucursales s
           ON s.Codigo_Sucursal = d.codigoSucursal
          AND s.Codigo_Pais = d.codigoPais
         LEFT JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
           ON sc.codigoSubcategoria = d.subCategoriaDocumento
          AND sc.codigoCategoria = d.categoriaDocumento
          AND sc.codigoPais = d.codigoPais
         LEFT JOIN ${databases.documents}.tblEstadoDocumentacion st
           ON st.codigoEstado = d.estadoDocumento
          AND st.codigoPais = d.codigoPais
         WHERE d.codigoDocumento = ? AND d.codigoPais = ?
         LIMIT 1`,
        [documentId, countryCode],
      );
      if (!rows[0]) return null;
      return {
        ...rows[0],
        id: Number(rows[0].id),
        branchId: Number(rows[0].branchId),
        countryCode: Number(rows[0].countryCode),
        documentType: Number(rows[0].documentType),
      };
    },

    async listDocumentExpirationCandidates({ asOf, warningCutoff }) {
      const [rows] = await databasePool().execute(
        `SELECT d.codigoDocumento AS id,
                d.referenciaDocumento AS documentCode,
                d.numeroContrato AS documentReference,
                DATE_FORMAT(d.fechaVencimiento, '%Y-%m-%d') AS dueDate,
                d.tipoDocumentacion AS documentType,
                d.codigoPais AS countryCode,
                d.codigoSucursal AS branchId,
                d.estadoDocumento AS statusId,
                COALESCE(d.mailVencido, 0) AS expiredMailSent,
                c.nombreCategoria AS category,
                sc.NombreSubcategoria AS subcategory,
                s.Nombre_Sucursal AS branchName,
                CONCAT_WS(' - ', s.Codigo_InternoSucursal, s.Nombre_Sucursal) AS branchLabel,
                s.correoSucursal AS branchEmail
         FROM ${databases.documents}.tblDocumentos d
         INNER JOIN ${databases.documents}.tblCategoriaDocumentos c
           ON c.codigoCategoria = d.categoriaDocumento
         INNER JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
           ON sc.codigoSubcategoria = d.subCategoriaDocumento
          AND sc.codigoCategoria = d.categoriaDocumento
         INNER JOIN ${databases.people}.tblSucursales s
           ON s.Codigo_Sucursal = d.codigoSucursal
         WHERE COALESCE(d.isReferencial, 0) = 0
           AND (
             (d.fechaVencimiento < ?
               AND d.estadoDocumento IN (2, 4)
               AND COALESCE(d.mailVencido, 0) = 0)
             OR
             (d.fechaVencimiento >= ?
               AND d.fechaVencimiento < ?
               AND d.estadoDocumento = 2)
           )
         ORDER BY d.fechaVencimiento, d.codigoDocumento`,
        [asOf, asOf, warningCutoff],
      );
      return rows.map((row) => ({
        ...row,
        kind: row.dueDate < asOf ? "expired" : "warning",
        id: Number(row.id),
        countryCode: Number(row.countryCode),
        branchId: Number(row.branchId),
        statusId: Number(row.statusId),
        documentType: Number(row.documentType),
        expiredMailSent: Boolean(row.expiredMailSent),
      }));
    },

    async claimDocumentExpiration(candidate, asOf) {
      const parameters = [];
      let statement;
      if (candidate.kind === "expired") {
        statement = `UPDATE ${databases.documents}.tblDocumentos
                     SET estadoDocumento = 5,
                         mailVencido = 1,
                         fechaUltimaActualizacion = ?
                     WHERE codigoDocumento = ?
                       AND estadoDocumento = ?
                       AND COALESCE(mailVencido, 0) = 0
                       AND fechaVencimiento < ?
                       AND COALESCE(isReferencial, 0) = 0`;
        parameters.push(asOf, candidate.id, candidate.statusId, asOf);
      } else {
        statement = `UPDATE ${databases.documents}.tblDocumentos
                     SET estadoDocumento = 4,
                         fechaUltimaActualizacion = ?
                     WHERE codigoDocumento = ?
                       AND estadoDocumento = 2
                       AND COALESCE(isReferencial, 0) = 0`;
        parameters.push(asOf, candidate.id);
      }

      const [result] = await databasePool().execute(statement, parameters);
      return normalizeAffectedRows(result) === 1;
    },

    async releaseDocumentExpiration(candidate) {
      let statement;
      let parameters;
      if (candidate.kind === "expired") {
        statement = `UPDATE ${databases.documents}.tblDocumentos
                     SET estadoDocumento = ?, mailVencido = 0
                     WHERE codigoDocumento = ?
                       AND estadoDocumento = 5
                       AND COALESCE(mailVencido, 0) = 1`;
        parameters = [candidate.statusId, candidate.id];
      } else {
        statement = `UPDATE ${databases.documents}.tblDocumentos
                     SET estadoDocumento = 2
                     WHERE codigoDocumento = ? AND estadoDocumento = 4`;
        parameters = [candidate.id];
      }
      const [result] = await databasePool().execute(statement, parameters);
      return normalizeAffectedRows(result) === 1;
    },

    async listAgreementExpirationCandidates({ asOf, warningCutoff }) {
      const [rows] = await databasePool().execute(
        `SELECT a.CodConvenio AS id,
                DATE_FORMAT(a.FechaInicial, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(a.FechaFinal, '%Y-%m-%d') AS endDate,
                a.CodEmpleado AS managerCode,
                c.Nombre_Cliente AS clientName,
                hr.NombreCompleto AS managerName,
                hr.Correo AS managerEmail
         FROM ${databases.documents}.tblConvenios a
         INNER JOIN ${databases.documents}.tblClientesCorp c
           ON c.CodClientesCorp = a.CodClienteCorporativo
         LEFT JOIN ${databases.humanResources}.vstEmpleadosMesEnCurso hr
           ON hr.CodigoInterno = a.CodEmpleado
          AND hr.Estado IN ('1', 'Activo', 'ACTIVO')
         WHERE COALESCE(a.isIndefinido, 0) = 0
           AND COALESCE(a.isReportado, 0) = 0
           AND a.FechaFinal >= ?
           AND a.FechaFinal < ?
         ORDER BY a.FechaFinal, a.CodConvenio`,
        [asOf, warningCutoff],
      );
      return rows.map((row) => ({ ...row, id: Number(row.id) }));
    },

    async claimAgreementExpiration(agreementId) {
      const [result] = await databasePool().execute(
        `UPDATE ${databases.documents}.tblConvenios
         SET isReportado = 1
         WHERE CodConvenio = ? AND COALESCE(isReportado, 0) = 0`,
        [agreementId],
      );
      return normalizeAffectedRows(result) === 1;
    },

    async releaseAgreementExpirations(agreementIds) {
      if (!agreementIds.length) return 0;
      const [result] = await databasePool().execute(
        `UPDATE ${databases.documents}.tblConvenios
         SET isReportado = 0
         WHERE CodConvenio IN (${listPlaceholders(agreementIds)}) AND isReportado = 1`,
        agreementIds,
      );
      return normalizeAffectedRows(result);
    },
  };
}
