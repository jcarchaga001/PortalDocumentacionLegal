import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

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
  };
}
