import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

export function createS3AuthorizationRepository(pool) {
  const databases = getDatabaseNames();
  const databasePool = () => pool || getDatabasePool();

  return {
    async isKeyAccessible(countryCode, s3Key) {
      const [rows] = await databasePool().execute(
        `SELECT 1 AS allowed
         WHERE EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblArchivosDocumentos docFile
           INNER JOIN ${databases.documents}.tblDocumentos documentRecord
             ON documentRecord.codigoArchivo = docFile.codigoArchivo
           WHERE BINARY docFile.CodS3 = BINARY ? AND docFile.isActive = 1
             AND documentRecord.codigoPais = ? AND documentRecord.isActive = 1
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblAdjuntosXConvenio agreementAttachment
           INNER JOIN ${databases.documents}.tblConvenios agreementRecord
             ON agreementRecord.CodConvenio = agreementAttachment.CodConvenio
           INNER JOIN ${databases.documents}.tblClientesCorp client
             ON client.CodClientesCorp = agreementRecord.CodClienteCorporativo
           WHERE BINARY agreementAttachment.KeyS3 = BINARY ? AND agreementAttachment.isActivo = 1
             AND client.CodPais = ?
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblLibroxSucursal_Archivo bookEvidence
           INNER JOIN ${databases.documents}.tblLibroxSucursal assignment
             ON assignment.codigoLibroxSuc = bookEvidence.codigoLibroxSuc
           INNER JOIN ${databases.documents}.tblLibrosSucursales book
             ON book.codigoLibro = assignment.codigoLibro
            AND book.codigoPais = assignment.codigoPais
           WHERE BINARY bookEvidence.Keys3 = BINARY ? AND COALESCE(bookEvidence.isHistoric, 0) = 0
             AND assignment.codigoPais = ? AND book.isActive = 1
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.risk}.tblArchivosXPlantilla_Doc riskFile
           INNER JOIN ${databases.risk}.tblAnalisisRiesgoPlantilla analysis
             ON analysis.codPlantilla_Doc = riskFile.CodArchivo
           WHERE BINARY riskFile.codS3 = BINARY ? AND analysis.CodigoPais = ?
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblIncidentesExternos incident
           WHERE BINARY incident.codigoS3 = BINARY ? AND incident.codigoPais = ?
             AND COALESCE(incident.isActivo, 1) = 1
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblAccionesIncidentes incidentAction
           INNER JOIN ${databases.documents}.tblIncidentesExternos incident
             ON incident.Cod_Incidente = incidentAction.codigoIncidente
           WHERE BINARY incidentAction.keyS3 = BINARY ? AND incidentAction.isActive = 1
             AND incident.codigoPais = ? AND COALESCE(incident.isActivo, 1) = 1
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblComentariosIncidentes incidentComment
           INNER JOIN ${databases.documents}.tblIncidentesExternos incident
             ON incident.Cod_Incidente = incidentComment.codigoIncidente
           WHERE BINARY incidentComment.CodAdjuntoS3 = BINARY ? AND incidentComment.codigoPais = ?
             AND incident.codigoPais = ? AND COALESCE(incident.isActivo, 1) = 1
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblIncidentesInternos_Legal laborCase
           WHERE BINARY laborCase.codigoS3 = BINARY ? AND laborCase.codigoPais = ?
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblAccionesIncidentes_Legal laborAction
           INNER JOIN ${databases.documents}.tblIncidentesInternos_Legal laborCase
             ON laborCase.Cod_Incidente = laborAction.codigoIncidente
           WHERE BINARY laborAction.keyS3 = BINARY ? AND laborAction.isActive = 1
             AND laborCase.codigoPais = ?
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblComentariosIncidentes_Legal laborComment
           INNER JOIN ${databases.documents}.tblIncidentesInternos_Legal laborCase
             ON laborCase.Cod_Incidente = laborComment.codigoIncidente
           WHERE BINARY laborComment.CodAdjuntoS3 = BINARY ? AND laborComment.codigoPais = ?
             AND laborCase.codigoPais = ?
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblHistoricoIncidentes_Legal laborHistory
           INNER JOIN ${databases.documents}.tblIncidentesInternos_Legal laborCase
             ON laborCase.Cod_Incidente = laborHistory.codIncidente
           WHERE BINARY laborHistory.codS3 = BINARY ? AND laborHistory.codigoPais = ?
             AND laborCase.codigoPais = ?
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblHistoricoIncidentesAccion_Legal laborActionHistory
           INNER JOIN ${databases.documents}.tblIncidentesInternos_Legal laborCase
             ON laborCase.Cod_Incidente = laborActionHistory.codIncidente
           WHERE BINARY laborActionHistory.codS3 = BINARY ? AND laborActionHistory.codigoPais = ?
             AND laborCase.codigoPais = ?
         ) OR EXISTS (
           SELECT 1
           FROM ${databases.documents}.tblArchivosxIncidente_Legal laborFile
           INNER JOIN ${databases.documents}.tblIncidentesInternos_Legal laborCase
             ON laborCase.Cod_Incidente = laborFile.codIncidente
           WHERE BINARY laborFile.CodS3 = BINARY ? AND laborFile.isActivo = 1
             AND laborCase.codigoPais = ?
         )
         LIMIT 1`,
        [
          s3Key, countryCode,
          s3Key, countryCode,
          s3Key, countryCode,
          s3Key, countryCode,
          s3Key, countryCode,
          s3Key, countryCode,
          s3Key, countryCode, countryCode,
          s3Key, countryCode,
          s3Key, countryCode,
          s3Key, countryCode, countryCode,
          s3Key, countryCode, countryCode,
          s3Key, countryCode, countryCode,
          s3Key, countryCode,
        ],
      );
      return rows.length === 1;
    },
  };
}
