import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

function safeDashboardDocumentPagination(filters = {}) {
  const rawStartIndex = Number(filters.startIndex);
  const rawMaxRecords = Number(filters.maxRecords);
  return {
    startIndex: Number.isInteger(rawStartIndex) && rawStartIndex >= 0 ? rawStartIndex : 0,
    maxRecords: Number.isInteger(rawMaxRecords) && rawMaxRecords > 0
      ? Math.min(rawMaxRecords, 50)
      : 50,
  };
}

export function createDashboardRepository(pool) {
  const databases = getDatabaseNames();
  const query = `
    WITH eligible AS (
      SELECT s.Codigo_Sucursal AS branch_id,
             sc.codigoSubcategoria AS subcategory_id,
             sc.NombreSubcategoria AS subcategory_name
      FROM ${databases.people}.tblSucursales s
      CROSS JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
      WHERE s.Codigo_Pais = ?
        AND (s.isAdministrativa = 0 OR s.Codigo_InternoSucursal = 'FA00')
        AND sc.codigoPais = ?
        AND sc.isObligatorio = 1
    ), ranked AS (
      SELECT d.codigoSucursal AS branch_id,
             d.subCategoriaDocumento AS subcategory_id,
             d.estadoDocumento,
             ROW_NUMBER() OVER (
               PARTITION BY d.codigoSucursal, d.subCategoriaDocumento
               ORDER BY d.codigoDocumento ASC
             ) AS rn
      FROM ${databases.documents}.tblDocumentos d
      WHERE d.codigoPais = ?
        AND d.isActive = 1
        AND d.estadoDocumento IN (2, 4)
    ), classified AS (
      SELECT e.subcategory_id, e.subcategory_name,
             COALESCE(r.estadoDocumento, 0) AS estado
      FROM eligible e
      LEFT JOIN ranked r
        ON r.branch_id = e.branch_id
       AND r.subcategory_id = e.subcategory_id
       AND r.rn = 1
    )
    SELECT 0 AS sort_order, 'global' AS scope,
           NULL AS subcategory_id, 'Dashboard general' AS name,
           SUM(estado = 2) AS current_count,
           SUM(estado = 4) AS expiring_count,
           SUM(estado = 0) AS missing_count,
           SUM(estado IN (2,4)) AS registered_count,
           COUNT(*) AS required_count
    FROM classified
    UNION ALL
    SELECT 1, 'subcategory', subcategory_id, subcategory_name,
           SUM(estado = 2), SUM(estado = 4), SUM(estado = 0),
           SUM(estado IN (2,4)), COUNT(*)
    FROM classified
    GROUP BY subcategory_id, subcategory_name
    ORDER BY sort_order, subcategory_id
  `;

  const monitoringQuery = `
    WITH required AS (
      SELECT COUNT(*) AS required_count
      FROM ${databases.documents}.tblSubcategoriaDocumentos
      WHERE isObligatorio = 1
    )
    SELECT
      s.Codigo_Sucursal AS branch_id,
      s.Codigo_InternoSucursal AS branch_code,
      s.Nombre_Sucursal AS branch_name,
      s.CodGA AS manager_id,
      ga.Nombre_Personas AS manager_name,
      required.required_count,
      COUNT(DISTINCT CASE
        WHEN sc.isObligatorio = 1
         AND d.isActive = 1
         AND d.estadoDocumento IN (2, 4)
        THEN sc.codigoSubcategoria
      END) AS registered_count,
      SUM(CASE
        WHEN sc.isObligatorio = 1
         AND d.isActive = 1
         AND d.estadoDocumento = 4
        THEN 1 ELSE 0
      END) AS expiring_count,
      GREATEST(
        SUM(CASE
          WHEN sc.codigoSubcategoria IS NOT NULL
           AND d.isActive = 1
           AND d.estadoDocumento IN (2, 4)
          THEN 1 ELSE 0
        END)
        - COUNT(DISTINCT CASE
            WHEN sc.isObligatorio = 1
             AND d.isActive = 1
             AND d.estadoDocumento IN (2, 4)
            THEN sc.codigoSubcategoria
          END),
        0
      ) AS other_count
    FROM ${databases.people}.tblSucursales s
    CROSS JOIN required
    LEFT JOIN ${databases.people}.tblPersonas ga ON ga.Codigo_Personas = s.CodGA
    LEFT JOIN ${databases.documents}.tblDocumentos d
      ON d.codigoSucursal = s.Codigo_Sucursal
    LEFT JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
      ON sc.codigoSubcategoria = d.subCategoriaDocumento
     AND sc.codigoCategoria = d.categoriaDocumento
    WHERE s.Codigo_Pais = ?
      AND (s.isAdministrativa = 0 OR s.Codigo_InternoSucursal = 'FA00')
      AND s.isActivo = 1
      AND (? IS NULL OR s.CodGA = ?)
      AND (? IS NULL OR s.Codigo_Sucursal = ?)
    GROUP BY
      s.Codigo_Sucursal,
      s.Codigo_InternoSucursal,
      s.Nombre_Sucursal,
      s.CodGA,
      ga.Nombre_Personas,
      required.required_count
    ORDER BY s.Codigo_Sucursal
    LIMIT 120
  `;

  return {
    async getSummary(countryCode) {
      const databasePool = pool || getDatabasePool();
      const [rows] = await databasePool.execute(query, [countryCode, countryCode, countryCode]);
      return rows;
    },

    async getBranchMonitoring(countryCode, filters = {}) {
      const databasePool = pool || getDatabasePool();
      const managerId = filters.managerId || null;
      const branchId = filters.branchId || null;
      const [rows] = await databasePool.execute(monitoringQuery, [
        countryCode,
        managerId,
        managerId,
        branchId,
        branchId,
      ]);
      return rows;
    },

    async getMonitoringCatalogs(countryCode) {
      const databasePool = pool || getDatabasePool();
      const [[managers], [branches]] = await Promise.all([
        databasePool.execute(
          `SELECT Codigo_Personas AS id, Nombre_Personas AS name
           FROM ${databases.people}.tblPersonas
           WHERE CodigoPais = ? AND Codigo_Puesto = 2
           ORDER BY Codigo_Personas
           LIMIT 250`,
          [countryCode],
        ),
        databasePool.execute(
          `SELECT Codigo_Sucursal AS id,
                  CONCAT(Codigo_InternoSucursal, '-', Nombre_Sucursal) AS name,
                  CodGA AS managerId
           FROM ${databases.people}.tblSucursales
           WHERE Codigo_Pais = ?
             AND (isAdministrativa = 0 OR Codigo_Sucursal = 135)
           ORDER BY Codigo_Sucursal
           LIMIT 250`,
          [countryCode],
        ),
      ]);
      return { managers, branches };
    },

    async getDocuments(countryCode, filters = {}) {
      const databasePool = pool || getDatabasePool();
      const { startIndex, maxRecords } = safeDashboardDocumentPagination(filters);
      const fromAndFilters = `
        FROM ${databases.documents}.tblDocumentos d
        LEFT JOIN ${databases.people}.tblSucursales s
          ON s.Codigo_Sucursal = d.codigoSucursal
        LEFT JOIN ${databases.documents}.tblCategoriaDocumentos c
          ON c.codigoCategoria = d.categoriaDocumento
        LEFT JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
          ON sc.codigoSubcategoria = d.subCategoriaDocumento
         AND d.categoriaDocumento = d.categoriaDocumento
        LEFT JOIN ${databases.documents}.tblEstadoDocumentacion st
          ON st.codigoEstado = d.estadoDocumento
        WHERE d.codigoPais = ?
          AND d.estadoDocumento = ?
          AND d.isActive = 1
          AND s.isAdministrativa = FALSE
      `;
      const selectQuery = `
        SELECT d.codigoDocumento AS id,
               CONCAT(s.Codigo_InternoSucursal, ' ', s.Nombre_Sucursal) AS branchName,
               d.referenciaDocumento AS reference,
               d.numeroContrato AS description,
               c.nombreCategoria AS categoryName,
               sc.NombreSubcategoria AS subcategoryName,
               DATE_FORMAT(d.fechaContrato, '%Y-%m-%d') AS documentDate,
               DATE_FORMAT(d.fechaVencimiento, '%Y-%m-%d') AS expirationDate,
               CASE
                 WHEN DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) >= 0
                  AND DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) < 30 THEN 'Menos de 1 Mes'
                 WHEN DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) > 30
                  AND DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) < 60 THEN 'Menos de 2 Meses'
                 WHEN DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) > 61
                  AND DATEDIFF(d.fechaVencimiento, CURRENT_DATE()) < 90 THEN 'Menos de 3 Meses'
                 ELSE ''
               END AS expirationTime,
               d.estadoDocumento AS statusId,
               st.nombreEstado AS statusName
        ${fromAndFilters}
        ORDER BY s.OrdenSucursal ASC
        LIMIT ${maxRecords} OFFSET ${startIndex}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${fromAndFilters}`;
      const parameters = [countryCode, filters.statusId];
      const [[rows], [countRows]] = await Promise.all([
        databasePool.execute(selectQuery, parameters),
        databasePool.execute(countQuery, parameters),
      ]);
      return {
        rows,
        count: Number(countRows[0]?.total || 0),
      };
    },

    async getExportRows(countryCode) {
      const databasePool = pool || getDatabasePool();
      const exportRowsQuery = `
        WITH eligible AS (
          SELECT s.Codigo_Sucursal AS branch_id,
                 s.Codigo_InternoSucursal AS branch_name,
                 s.OrdenSucursal AS branch_order,
                 sc.codigoSubcategoria AS subcategory_id,
                 sc.NombreSubcategoria AS subcategory_name
          FROM ${databases.people}.tblSucursales s
          CROSS JOIN ${databases.documents}.tblSubcategoriaDocumentos sc
          WHERE s.Codigo_Pais = ?
            AND (s.isAdministrativa = 0 OR s.Codigo_InternoSucursal = 'FA00')
            AND sc.codigoPais = ?
            AND sc.isObligatorio = 1
        ), ranked AS (
          SELECT d.codigoSucursal AS branch_id,
                 d.subCategoriaDocumento AS subcategory_id,
                 d.estadoDocumento,
                 st.nombreEstado AS status_name,
                 ROW_NUMBER() OVER (
                   PARTITION BY d.codigoSucursal, d.subCategoriaDocumento
                   ORDER BY d.codigoDocumento ASC
                 ) AS rn
          FROM ${databases.documents}.tblDocumentos d
          LEFT JOIN ${databases.documents}.tblEstadoDocumentacion st
            ON st.codigoEstado = d.estadoDocumento
           AND st.codigoPais = d.codigoPais
          WHERE d.codigoPais = ?
            AND d.isActive = 1
            AND d.estadoDocumento IN (2, 4)
        ), classified AS (
          SELECT e.*,
                 COALESCE(r.estadoDocumento, 0) AS estado,
                 COALESCE(r.status_name, '') AS status_name,
                 CASE WHEN r.branch_id IS NULL THEN 1 ELSE 0 END AS no_existe
          FROM eligible e
          LEFT JOIN ranked r
            ON r.branch_id = e.branch_id
           AND r.subcategory_id = e.subcategory_id
           AND r.rn = 1
        )
        SELECT CASE WHEN estado = 2 THEN 1 ELSE 0 END AS vigente,
               CASE WHEN estado = 4 THEN 1 ELSE 0 END AS porVencer,
               subcategory_name AS nombreSubcategoria,
               branch_name AS nombreSucursal,
               status_name AS nombreEstado,
               branch_id AS codigoSucursal,
               subcategory_id AS codigoSubcategoria,
               estado,
               no_existe AS noExiste
        FROM classified
        ORDER BY branch_order ASC, branch_id ASC, subcategory_id ASC
      `;
      const [rows] = await databasePool.execute(exportRowsQuery, [
        countryCode,
        countryCode,
        countryCode,
      ]);
      return rows;
    },
  };
}
