import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

const SORT_COLUMNS = Object.freeze({
  codArchivo: "rp.codPlantilla_Doc",
  countryName: "p.Nombre_Pais",
  societyName: "so.NombreSociedad",
  branchName: "s.NomSucursal",
  riskScore: "rp.RiesgoPuntaje",
  accuracyScore: "rp.AccuracyPuntaje",
  statusName: "st.NombreEstado",
});

function addFilter(conditions, parameters, value, sql) {
  if (value !== undefined && value !== null && value !== "") {
    conditions.push(sql);
    parameters.push(value);
  }
}

export function createRiskRepository(pool) {
  const databases = getDatabaseNames();

  const joinedAnalysisTables = `
    FROM ${databases.risk}.tblAnalisisRiesgoPlantilla rp
    INNER JOIN ${databases.risk}.tblArchivosXPlantilla_Doc a
      ON rp.codPlantilla_Doc = a.CodArchivo
    INNER JOIN ${databases.risk}.tblInstanciasxPlantilla_Doc i
      ON a.CodIntSrsal_Departamento = i.codInstanciasxPlant
    INNER JOIN ${databases.risk}.tblPlantillas_Doc t
      ON i.codPlantilla_Doc = t.codPlantilla_Doc
    INNER JOIN ${databases.risk}.tblSociedades_ so
      ON t.codSociedad = so.CodSociedad
    INNER JOIN ${databases.people}.tblPaises p
      ON so.CodPais = p.Codigo_Pais
    LEFT JOIN ${databases.risk}.tblSucursalxUnidad s
      ON i.CodIntSrsal_Departamento = s.codUnidadxSucursal
    LEFT JOIN ${databases.risk}.tblEstadosArchivos_Doc st
      ON a.CodEstado = st.CodEstadosArchivos
  `;

  function analysisFilter(countryCode, filters) {
    const conditions = ["rp.CodigoPais = ?"];
    const parameters = [countryCode];
    addFilter(conditions, parameters, filters.societyId, "so.CodSociedad = ?");
    addFilter(conditions, parameters, filters.riskScore, "rp.RiesgoPuntaje = ?");
    addFilter(conditions, parameters, filters.accuracyScore, "rp.AccuracyPuntaje = ?");
    addFilter(conditions, parameters, filters.statusId, "a.CodEstado = ?");
    return { where: `WHERE ${conditions.join(" AND ")}`, parameters };
  }

  return {
    async list(countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const { where, parameters } = analysisFilter(countryCode, filters);
      const offset = (filters.page - 1) * filters.pageSize;
      const sortColumn = SORT_COLUMNS[filters.sortBy] || SORT_COLUMNS.riskScore;
      const sortDirection = filters.sortDirection === "ASC" ? "ASC" : "DESC";
      const listQuery = `
        SELECT rp.CodigoAnalisisRiesgo AS analysisId,
               rp.codPlantilla_Doc AS codArchivo,
               p.Codigo_Pais AS countryId,
               p.Nombre_Pais AS countryName,
               so.CodSociedad AS societyId,
               so.NombreSociedad AS societyName,
               s.codUnidadxSucursal AS branchId,
               s.NomSucursal AS branchName,
               rp.RiesgoPuntaje AS riskScore,
               rp.AccuracyPuntaje AS accuracyScore,
               a.CodEstado AS statusId,
               st.NombreEstado AS statusName,
               a.codS3 AS s3Key
        ${joinedAnalysisTables}
        ${where}
        ORDER BY ${sortColumn} ${sortDirection}, rp.codPlantilla_Doc ASC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${joinedAnalysisTables} ${where}`;
      const [[items], [countRows]] = await Promise.all([
        databasePool.execute(listQuery, parameters),
        databasePool.execute(countQuery, parameters),
      ]);
      return {
        items,
        total: Number(countRows[0]?.total || 0),
        page: filters.page,
        pageSize: filters.pageSize,
      };
    },

    async catalogs(countryCode) {
      const databasePool = pool || getDatabasePool();
      const [societyResult, statusResult] = await Promise.all([
        databasePool.execute(`
          SELECT CodSociedad AS id, NombreSociedad AS name
          FROM ${databases.risk}.tblSociedades_
          WHERE CodPais = ?
          ORDER BY NombreSociedad, CodSociedad
        `, [countryCode]),
        databasePool.execute(`
          SELECT CodEstadosArchivos AS id, NombreEstado AS name
          FROM ${databases.risk}.tblEstadosArchivos_Doc
          ORDER BY CodEstadosArchivos
        `),
      ]);
      return {
        societies: societyResult[0],
        statuses: statusResult[0],
      };
    },

    async getByCodArchivo(codArchivo, countryCode) {
      const databasePool = pool || getDatabasePool();
      const [analysisRows] = await databasePool.execute(`
        SELECT rp.CodigoAnalisisRiesgo AS analysisId,
               rp.codPlantilla_Doc AS codArchivo,
               DATE_FORMAT(rp.Fecha, '%Y-%m-%d') AS analysisDate,
               TIME_FORMAT(rp.Hora, '%H:%i:%s') AS analysisTime,
               rp.Lenguage AS language,
               rp.CodigoPais AS countryId,
               p.Nombre_Pais AS countryName,
               so.CodSociedad AS societyId,
               so.NombreSociedad AS societyName,
               s.codUnidadxSucursal AS branchId,
               s.NomSucursal AS branchName,
               rp.RiesgoPuntaje AS riskScore,
               rp.RiesgoComentario AS riskComment,
               rp.ComentarioCorto AS shortComment,
               rp.InterpretacionBrebe AS briefInterpretation,
               rp.AccuracyPuntaje AS accuracyScore,
               rp.AccuracyComentario AS accuracyComment,
               a.CodEstado AS statusId,
               st.NombreEstado AS statusName,
               a.NombreArchivo AS fileName,
               a.codS3 AS s3Key
        ${joinedAnalysisTables}
        WHERE rp.codPlantilla_Doc = ?
          AND rp.CodigoPais = ?
        LIMIT 1
      `, [codArchivo, countryCode]);
      const analysis = analysisRows[0];
      if (!analysis) return null;

      const [details] = await databasePool.execute(`
        SELECT CodigoDetalleAnalisis AS id,
               Clausula AS clauseKey,
               Detalle AS detailKey,
               Valor AS value
        FROM ${databases.risk}.tblAnalisisRiesgoPlantillaDetalle
        WHERE CodigoAnalisisRiesgo = ?
        ORDER BY CodigoDetalleAnalisis
      `, [analysis.analysisId]);
      return { analysis, details };
    },
  };
}
