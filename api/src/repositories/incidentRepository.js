import { getDatabasePool } from "../config/database.js";
import { getDatabaseNames } from "../config/databaseNames.js";

function databaseIdentifier(environmentName, fallback) {
  const value = process.env[environmentName]?.trim() || fallback;
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${environmentName} contiene un nombre de base de datos no valido.`);
  }
  return `\`${value}\``;
}

function addOptionalFilter(conditions, parameters, value, sql, mapValue = (item) => item) {
  if (value !== undefined && value !== null && value !== "") {
    conditions.push(sql);
    parameters.push(mapValue(value));
  }
}

function pageResult(items, total, filters, metrics = undefined) {
  return {
    items,
    total: Number(total || 0),
    page: filters.page,
    pageSize: filters.pageSize,
    ...(metrics ? { metrics } : {}),
  };
}

function normalizeMetrics(row = {}) {
  return {
    open: Number(row.open || 0),
    inProgress: Number(row.inProgress || 0),
    paused: Number(row.paused || 0),
    closed: Number(row.closed || 0),
  };
}

export function createIncidentRepository(pool) {
  const databases = getDatabaseNames();
  const inactiveHumanResources = databaseIdentifier("HR_INACTIVE_DB_NAME", "db8elpwggnwatn");

  function repositoryError(message, code, status = 400, field) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    if (field) error.field = field;
    return error;
  }

  function requireActionMutationAuthorization(action, userId, operation, { labor = false } = {}) {
    const isOwnerOrLegacyAdmin = Number(userId) === 1
      || Number(action.responsibleId) === Number(userId);
    const isUnrestrictedLaborReassignment = labor
      && ["reassign", "reschedule"].includes(operation);
    if (!isOwnerOrLegacyAdmin && !isUnrestrictedLaborReassignment) {
      throw repositoryError(
        "No tiene permisos para actualizar esta accion.",
        "FORBIDDEN",
        403,
      );
    }

    const statusId = Number(action.statusId);
    if ([3, 5].includes(statusId) || (operation === "start" && statusId !== 1)) {
      throw repositoryError(
        "El estado actual de la accion no permite esta operacion.",
        labor ? "LABOR_ACTION_STATE_NOT_ALLOWED" : "INCIDENT_ACTION_STATE_NOT_ALLOWED",
        409,
      );
    }
  }

  function requireOpenParent(record, { labor = false } = {}) {
    if (Number(record.statusId) === 5) {
      throw repositoryError(
        labor
          ? "El caso laboral ya se encuentra cerrado."
          : "El incidente ya se encuentra cerrado.",
        labor ? "LABOR_CASE_STATE_NOT_ALLOWED" : "INCIDENT_STATE_NOT_ALLOWED",
        409,
      );
    }
  }

  function requireLaborEvidence(laborCase, update) {
    const required = laborCase.requiresEvidence === true || Number(laborCase.requiresEvidence) === 1;
    if (required && (!update.s3Key || !update.fileName)) {
      throw repositoryError(
        "Adjunte la evidencia requerida.",
        "LABOR_EVIDENCE_REQUIRED",
        400,
        "s3Key",
      );
    }
  }

  function requireRequestedLaborEvidence(update) {
    if (update.includeEvidence === true && (!update.s3Key || !update.fileName)) {
      throw repositoryError(
        "Adjunte la evidencia requerida.",
        "LABOR_EVIDENCE_REQUIRED",
        400,
        "s3Key",
      );
    }
  }

  function databasePool() {
    return pool || getDatabasePool();
  }

  async function transaction(work) {
    const connection = await databasePool().getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function requireIncident(connection, scope, countryCode, incidentId, lock = false) {
    const [rows] = await connection.execute(
      `SELECT i.Cod_Incidente AS id, i.codigoTipoIncidente AS typeId,
              i.CodigoSucursal AS branchId, i.Cod_EstadoIncidente AS statusId,
              i.codigoReferencia AS reference, i.isExterno AS isExternal
       FROM ${databases.documents}.tblIncidentesExternos i
       WHERE i.Cod_Incidente = ? AND i.codigoPais = ? AND COALESCE(i.isExterno, 0) = ?
       ${lock ? "FOR UPDATE" : ""}`,
      [incidentId, countryCode, scope === "external" ? 1 : 0],
    );
    if (!rows[0]) {
      throw repositoryError("El incidente solicitado no existe.", "INCIDENT_NOT_FOUND", 404);
    }
    return rows[0];
  }

  async function requireLaborCase(connection, countryCode, caseId, lock = false) {
    const [rows] = await connection.execute(
      `SELECT Cod_Incidente AS id, CodigoSucursal AS branchId, Cod_EstadoIncidente AS statusId,
              codResponsable AS responsibleId, CorrelativoIncidente AS reference, IsEvidencia AS requiresEvidence
       FROM ${databases.documents}.tblIncidentesInternos_Legal
       WHERE Cod_Incidente = ? AND codigoPais = ?
       ${lock ? "FOR UPDATE" : ""}`,
      [caseId, countryCode],
    );
    if (!rows[0]) {
      throw repositoryError("El caso laboral solicitado no existe.", "LABOR_CASE_NOT_FOUND", 404);
    }
    return rows[0];
  }

  async function requireCountryPerson(connection, countryCode, personId, { branchId, labor = false } = {}) {
    const parameters = [personId, countryCode];
    let extraJoin = "";
    let extraWhere = "";
    if (labor) {
      extraJoin = `INNER JOIN ${databases.documents}.tblUsuariosAcciones ua ON ua.codigoUsuario = p.Codigo_Personas`;
      extraWhere = "AND ua.codigoPais = ? AND ua.isRRHH = 1 AND ua.isActive = 1";
      parameters.push(countryCode);
    }
    if (branchId) {
      extraWhere += " AND p.Codigo_Sucursal = ?";
      parameters.push(branchId);
    }
    const [rows] = await connection.execute(
      `SELECT p.Codigo_Personas AS id, p.Nombre_Personas AS name
       FROM ${databases.people}.tblPersonas p
       ${extraJoin}
       WHERE p.Codigo_Personas = ? AND p.CodigoPais = ? AND p.isActivo = 1 ${extraWhere}
       LIMIT 1`,
      parameters,
    );
    if (!rows[0]) {
      throw repositoryError("El usuario seleccionado no pertenece al pais o no esta activo.", "INVALID_PERSON", 400, "responsibleId");
    }
    return rows[0];
  }

  async function requireIncidentActionResponsible(connection, countryCode, incident, personId) {
    const [rows] = await connection.execute(
      `SELECT p.Codigo_Personas AS id, p.Nombre_Personas AS name
       FROM ${databases.people}.tblPersonas p
       WHERE p.Codigo_Personas = ?
         AND p.CodigoPais = ?
         AND p.isActivo = 1
         AND (
           p.Codigo_Sucursal = ?
           OR EXISTS (
             SELECT 1
             FROM ${databases.documents}.tblUsuariosAcciones ua
             WHERE ua.codigoUsuario = p.Codigo_Personas
               AND ua.codigoTipoIncidente = ?
               AND ua.codigoPais = ?
               AND ua.isActive = 1
           )
         )
       LIMIT 1`,
      [personId, countryCode, incident.branchId, incident.typeId, countryCode],
    );
    if (!rows[0]) {
      throw repositoryError(
        "El responsable no pertenece a la sucursal ni esta autorizado para el tipo de incidente.",
        "INVALID_INCIDENT_RESPONSIBLE",
        400,
        "responsibleId",
      );
    }
    return rows[0];
  }

  async function requireLaborActionResponsible(connection, countryCode, caseId, personId) {
    const [rows] = await connection.execute(
      `SELECT p.Codigo_Personas AS id, p.Nombre_Personas AS name
       FROM ${databases.people}.tblPersonas p
       WHERE p.Codigo_Personas = ?
         AND p.CodigoPais = ?
         AND p.isActivo = 1
         AND (
           EXISTS (
             SELECT 1
             FROM ${databases.documents}.tblUsuariosAcciones ua
             WHERE ua.codigoUsuario = p.Codigo_Personas
               AND ua.codigoPais = ?
               AND ua.isRRHH = 1
               AND ua.isActive = 1
           )
           OR EXISTS (
             SELECT 1
             FROM ${databases.documents}.tblIncidentesInternos_Legal laborCase
             WHERE laborCase.Cod_Incidente = ?
               AND laborCase.codigoPais = ?
               AND laborCase.codigoSolicitante = p.Codigo_Personas
           )
         )
       LIMIT 1`,
      [personId, countryCode, countryCode, caseId, countryCode],
    );
    if (!rows[0]) {
      throw repositoryError(
        "El responsable no esta autorizado para el caso laboral.",
        "INVALID_LABOR_RESPONSIBLE",
        400,
        "responsibleId",
      );
    }
    return rows[0];
  }

  function operationDescription(operation, values = {}) {
    if (operation === "start") return "La accion ha iniciado";
    if (operation === "close") return values.justification || "Se ha cerrado la accion";
    if (operation === "cancel") return values.justification || "Se ha anulado la accion";
    if (operation === "reassign") return `Se reasigno usuario ${values.newName}, usuario anterior: ${values.oldName || "Sin asignar"}`;
    if (operation === "reschedule") return `Se reasigno fecha de entrega a ${values.dueDate}, fecha anterior: ${values.oldDueDate || "Sin fecha"}`;
    return "Se actualizo la accion";
  }

  function incidentFilters(scope, countryCode, filters) {
    const conditions = ["i.codigoPais = ?", "COALESCE(i.isExterno, 0) = ?"];
    const parameters = [countryCode, scope === "external" ? 1 : 0];
    addOptionalFilter(conditions, parameters, filters.branchId, "i.CodigoSucursal = ?");
    addOptionalFilter(conditions, parameters, filters.typeId, "i.codigoTipoIncidente = ?");
    addOptionalFilter(conditions, parameters, filters.agencyId, "i.codigoEnte = ?");
    addOptionalFilter(conditions, parameters, filters.motiveId, "i.Cod_MotivoIncidente = ?");
    addOptionalFilter(conditions, parameters, filters.statusId, "i.Cod_EstadoIncidente = ?");
    addOptionalFilter(conditions, parameters, filters.startDate, "STR_TO_DATE(LEFT(i.FechaApertura, 10), '%Y-%m-%d') >= ?");
    addOptionalFilter(conditions, parameters, filters.endDate, "STR_TO_DATE(LEFT(i.FechaApertura, 10), '%Y-%m-%d') <= ?");
    if (filters.search) {
      conditions.push(`(
        i.codigoReferencia LIKE CONCAT('%', ?, '%')
        OR i.observacion LIKE CONCAT('%', ?, '%')
        OR s.Nombre_Sucursal LIKE CONCAT('%', ?, '%')
        OR e.nombreEnte LIKE CONCAT('%', ?, '%')
      )`);
      parameters.push(filters.search, filters.search, filters.search, filters.search);
    }
    return { where: `WHERE ${conditions.join(" AND ")}`, parameters };
  }

  function actionFilters(scope, countryCode, filters) {
    const conditions = ["i.codigoPais = ?", "COALESCE(i.isExterno, 0) = ?", "a.isActive = 1"];
    const parameters = [countryCode, scope === "external" ? 1 : 0];
    addOptionalFilter(conditions, parameters, filters.branchId, "a.codigosucursal = ?");
    addOptionalFilter(conditions, parameters, filters.responsibleId, "a.responsable = ?");
    addOptionalFilter(conditions, parameters, filters.statusId, "a.codigoEstado = ?");
    addOptionalFilter(conditions, parameters, filters.startDate, "a.fechaInicio >= ?");
    addOptionalFilter(conditions, parameters, filters.endDate, "a.fechaInicio <= ?");
    if (filters.dueStartDate) {
      conditions.push("(a.fechaFin IS NULL OR YEAR(a.fechaFin) <= 1900 OR a.fechaFin >= ?)");
      parameters.push(filters.dueStartDate);
    }
    if (filters.dueEndDate) {
      conditions.push("(a.fechaFin IS NULL OR YEAR(a.fechaFin) <= 1900 OR a.fechaFin <= ?)");
      parameters.push(filters.dueEndDate);
    }
    if (filters.search) {
      conditions.push("(i.codigoReferencia LIKE CONCAT('%', ?, '%') OR a.AccionReferencia LIKE CONCAT('%', ?, '%') OR a.nombreAccion LIKE CONCAT('%', ?, '%'))");
      parameters.push(filters.search, filters.search, filters.search);
    }
    return { where: `WHERE ${conditions.join(" AND ")}`, parameters };
  }

  function laborCaseFilters(countryCode, filters) {
    const conditions = ["i.codigoPais = ?", "COALESCE(i.isExterno, 0) = 0", "emp.CodPais = ?"];
    const parameters = [countryCode, countryCode];
    addOptionalFilter(conditions, parameters, filters.branchId, "i.CodigoSucursal = ?");
    addOptionalFilter(conditions, parameters, filters.levelId, "i.codNivelPermiso = ?");
    addOptionalFilter(conditions, parameters, filters.responsibleId, "i.codResponsable = ?");
    addOptionalFilter(conditions, parameters, filters.statusId, "i.Cod_EstadoIncidente = ?");
    addOptionalFilter(conditions, parameters, filters.startDate, "STR_TO_DATE(LEFT(i.FechaApertura, 10), '%Y-%m-%d') >= ?");
    addOptionalFilter(conditions, parameters, filters.endDate, "STR_TO_DATE(LEFT(i.FechaApertura, 10), '%Y-%m-%d') <= ?");
    if (filters.search) {
      conditions.push(`(
        i.DNI LIKE CONCAT('%', ?, '%')
        OR emp.NombreCompleto LIKE CONCAT('%', ?, '%')
        OR applicant.Correo_electronico LIKE CONCAT('%', ?, '%')
        OR applicant.Nombre_Personas LIKE CONCAT('%', ?, '%')
        OR i.CorrelativoIncidente LIKE CONCAT('%', ?, '%')
      )`);
      parameters.push(filters.search, filters.search, filters.search, filters.search, filters.search);
    }
    return { where: `WHERE ${conditions.join(" AND ")}`, parameters };
  }

  function laborActionFilters(countryCode, userId, filters) {
    const conditions = ["i.codigoPais = ?"];
    const parameters = [countryCode];
    if (userId === 1) {
      conditions.push("a.isActive = 1");
    } else if (userId) {
      conditions.push("a.responsable = ?");
      parameters.push(userId);
    } else {
      conditions.push("1 = 0");
    }
    addOptionalFilter(conditions, parameters, filters.actionId, "a.codAccion = ?");
    addOptionalFilter(conditions, parameters, filters.statusId, "a.codigoEstado = ?");
    addOptionalFilter(conditions, parameters, filters.startDate, "STR_TO_DATE(LEFT(i.FechaApertura, 10), '%Y-%m-%d') >= ?");
    addOptionalFilter(conditions, parameters, filters.endDate, "STR_TO_DATE(LEFT(i.FechaApertura, 10), '%Y-%m-%d') <= ?");
    if (filters.search) {
      conditions.push("(a.nombreAccion LIKE CONCAT('%', ?, '%') OR i.CorrelativoIncidente LIKE CONCAT('%', ?, '%'))");
      parameters.push(filters.search, filters.search);
    }
    return { where: `WHERE ${conditions.join(" AND ")}`, parameters };
  }

  async function readIncident(scope, countryCode, incidentId) {
    const source = databasePool();
    const [incidentRows] = await source.execute(
      `SELECT i.Cod_Incidente AS id, i.codigoReferencia AS reference,
              i.CodigoSucursal AS branchId,
              CONCAT_WS(' - ', s.Codigo_InternoSucursal, s.Nombre_Sucursal) AS branchName,
              i.codigoTipoIncidente AS typeId, t.tipoincidente AS typeName,
              i.Cod_MotivoIncidente AS motiveId, m.nombreMotivo AS motiveName,
              i.categoriaIncidente AS categoryId,
              i.codigoEnte AS agencyId, e.nombreEnte AS agencyName,
              i.fechaVisita AS visitDate, i.FechaApertura AS openingDate,
              i.fechaHoraRegistro AS registrationDate,
              i.usuarioVisita AS visitorId, visitor.Nombre_Personas AS visitorName,
              i.usuarioRegistro AS registeredById, registrar.Nombre_Personas AS registeredByName,
              i.observacion AS comment, i.justificacion AS justification,
              i.codigoS3 AS s3Key, i.Cod_EstadoIncidente AS statusId,
              st.nombreEstado AS statusName, COALESCE(i.isExterno, 0) AS isExternal
       FROM ${databases.documents}.tblIncidentesExternos i
       LEFT JOIN ${databases.people}.tblSucursales s ON s.Codigo_Sucursal = i.CodigoSucursal
       LEFT JOIN ${databases.documents}.tblTiposIncidentes t ON t.codigoTipoIncidente = i.codigoTipoIncidente
       LEFT JOIN ${databases.documents}.tblMotivosIncidentes m ON m.codigoMotivo = i.Cod_MotivoIncidente
       LEFT JOIN ${databases.documents}.tblEntesGubernamentales e ON e.codigoEnte = i.codigoEnte
       LEFT JOIN ${databases.documents}.tblEstadosIncidentes st ON st.codigoEstado = i.Cod_EstadoIncidente
       LEFT JOIN ${databases.people}.tblPersonas visitor ON visitor.Codigo_Personas = i.usuarioVisita
       LEFT JOIN ${databases.people}.tblPersonas registrar ON registrar.Codigo_Personas = i.usuarioRegistro
       WHERE i.Cod_Incidente = ? AND i.codigoPais = ? AND COALESCE(i.isExterno, 0) = ?`,
      [incidentId, countryCode, scope === "external" ? 1 : 0],
    );
    if (!incidentRows[0]) {
      throw repositoryError("El incidente solicitado no existe.", "INCIDENT_NOT_FOUND", 404);
    }
    const [actionRows, commentRows, historyRows] = await Promise.all([
      source.execute(
        `SELECT a.codigoAccion AS id, a.AccionReferencia AS actionReference,
                a.nombreAccion AS name, a.descripcionAccion AS description,
                a.responsable AS responsibleId, responsible.Nombre_Personas AS responsibleName,
                DATE_FORMAT(a.fechaInicio, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(a.fechaEntrega, '%Y-%m-%d') AS dueDate,
                CASE WHEN a.fechaFin IS NULL OR YEAR(a.fechaFin) <= 1900 THEN NULL ELSE DATE_FORMAT(a.fechaFin, '%Y-%m-%d') END AS closeDate,
                a.codigoEstado AS statusId, st.nombreEstado AS statusName,
                a.isAutomatic, a.\`Justificación\` AS justification, a.keyS3 AS s3Key, a.fileName
         FROM ${databases.documents}.tblAccionesIncidentes a
         LEFT JOIN ${databases.people}.tblPersonas responsible ON responsible.Codigo_Personas = a.responsable
         LEFT JOIN ${databases.documents}.tblEstadosIncidentes st ON st.codigoEstado = a.codigoEstado
         WHERE a.codigoIncidente = ? AND a.isActive = 1
         ORDER BY CAST(a.AccionReferencia AS UNSIGNED), a.codigoAccion`,
        [incidentId],
      ),
      source.execute(
        `SELECT c.codigoComentario AS id, c.comentario AS comment, c.codigoUsuario AS userId,
                p.Nombre_Personas AS userName, c.fechaHoraRegistro AS registeredAt,
                c.CodAdjuntoS3 AS s3Key
         FROM ${databases.documents}.tblComentariosIncidentes c
         LEFT JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = c.codigoUsuario
         WHERE c.codigoIncidente = ? AND c.codigoPais = ?
         ORDER BY c.codigoComentario DESC`,
        [incidentId, countryCode],
      ),
      source.execute(
        `SELECT h.codigoHistorico AS id, CAST(h.accion AS UNSIGNED) AS actionId,
                h.Descripcion AS description, h.codigousuario AS userId,
                p.Nombre_Personas AS userName, h.fechaHoraRegistro AS registeredAt
         FROM ${databases.documents}.tblHistoricoIncidentesAccion h
         LEFT JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = h.codigousuario
         WHERE h.codigoreferencia = ? AND h.codigoPais = ?
         ORDER BY h.codigoHistorico DESC`,
        [incidentId, countryCode],
      ),
    ]);
    return {
      ...incidentRows[0],
      isExternal: Boolean(incidentRows[0].isExternal),
      actions: actionRows[0].map((row) => ({ ...row, isAutomatic: Boolean(row.isAutomatic) })),
      comments: commentRows[0],
      actionHistory: historyRows[0],
    };
  }

  async function readLaborCase(countryCode, caseId) {
    const source = databasePool();
    const [caseRows] = await source.execute(
      `SELECT i.Cod_Incidente AS id, i.CorrelativoIncidente AS incidentNumber,
              i.CodigoSucursal AS branchId,
              CONCAT_WS(' - ', s.Codigo_InternoSucursal, s.Nombre_Sucursal) AS branchName,
              i.fechaHoraRegistro AS registrationDate, i.fechaConocimiento AS awarenessDate,
              i.FechaApertura AS eventDate, i.codEmpleado AS employeeCode,
              COALESCE(emp.NombreCompleto, i.codEmpleado) AS employeeName,
              emp.Puesto AS employeePosition, i.DNI AS identityNumber,
              i.codigoSolicitante AS applicantId, applicant.Nombre_Personas AS applicantName,
              applicant.Correo_electronico AS applicantEmail, i.observacion AS applicantComment,
              i.codResponsable AS responsibleId, responsible.Nombre_Personas AS responsibleName,
              i.codNivelPermiso AS securityLevelId, level.NivelPermiso AS securityLevelName,
              i.codPrioridad AS priorityId, priority.NombreEstado AS priorityName,
              i.Cod_EstadoIncidente AS statusId, st.nombreEstado AS statusName,
              i.IsEvidencia AS requiresEvidence, i.justificacion AS justification,
              i.codigoS3 AS closingEvidenceKey
       FROM ${databases.documents}.tblIncidentesInternos_Legal i
       LEFT JOIN ${databases.people}.tblSucursales s ON s.Codigo_Sucursal = i.CodigoSucursal
       LEFT JOIN ${databases.humanResources}.vstEmpleadosMesEnCurso emp
         ON CAST(emp.CodigoInterno AS CHAR) = CAST(i.codEmpleado AS CHAR) AND emp.CodPais = i.codigoPais
       LEFT JOIN ${databases.people}.tblPersonas applicant ON applicant.Codigo_Personas = i.codigoSolicitante
       LEFT JOIN ${databases.people}.tblPersonas responsible ON responsible.Codigo_Personas = i.codResponsable
       LEFT JOIN ${databases.documents}.tblNivelPermisos level ON level.coditoNivel = i.codNivelPermiso
       LEFT JOIN ${databases.documents}.tblPrioridadAccion_Legal priority ON priority.CodPrioridad = i.codPrioridad
       LEFT JOIN ${databases.documents}.tblEstadosIncidentes_Legal st ON st.codigoEstado = i.Cod_EstadoIncidente
       WHERE i.Cod_Incidente = ? AND i.codigoPais = ?`,
      [caseId, countryCode],
    );
    if (!caseRows[0]) {
      throw repositoryError("El caso laboral solicitado no existe.", "LABOR_CASE_NOT_FOUND", 404);
    }
    const [actionRows, commentRows, caseHistoryRows, actionHistoryRows, fileRows] = await Promise.all([
      source.execute(
        `SELECT a.codigoAccionIncidente AS id, a.codAccion AS actionId,
                COALESCE(a.nombreAccion, actionType.NombreAccion) AS name,
                a.descripcionAccion AS description, a.responsable AS responsibleId,
                responsible.Nombre_Personas AS responsibleName,
                DATE_FORMAT(a.fechaInicio, '%Y-%m-%d') AS startDate,
                DATE_FORMAT(a.fechaEntrega, '%Y-%m-%d') AS expectedDueDate,
                CASE WHEN a.fechaFin IS NULL OR YEAR(a.fechaFin) <= 1900 THEN NULL ELSE DATE_FORMAT(a.fechaFin, '%Y-%m-%d') END AS closeDate,
                a.codPrioridad AS priorityId, priority.NombreEstado AS priorityName,
                a.codigoEstado AS statusId, st.nombreEstado AS statusName,
                a.isAutomatic, a.\`Justificación\` AS justification, a.keyS3 AS s3Key, a.fileName
         FROM ${databases.documents}.tblAccionesIncidentes_Legal a
         LEFT JOIN ${databases.documents}.tblAcciones_Legal actionType ON actionType.codAccion = a.codAccion
         LEFT JOIN ${databases.people}.tblPersonas responsible ON responsible.Codigo_Personas = a.responsable
         LEFT JOIN ${databases.documents}.tblPrioridadAccion_Legal priority ON priority.CodPrioridad = a.codPrioridad
         LEFT JOIN ${databases.documents}.tblEstadosIncidentes_Legal st ON st.codigoEstado = a.codigoEstado
         WHERE a.codigoIncidente = ? AND a.isActive = 1
         ORDER BY a.codigoAccionIncidente`,
        [caseId],
      ),
      source.execute(
        `SELECT c.codigoComentario AS id, c.comentario AS comment, c.codigoUsuario AS userId,
                p.Nombre_Personas AS userName, c.fechaHoraRegistro AS registeredAt, c.CodAdjuntoS3 AS s3Key
         FROM ${databases.documents}.tblComentariosIncidentes_Legal c
         LEFT JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = c.codigoUsuario
         WHERE c.codigoIncidente = ? AND c.codigoPais = ?
         ORDER BY c.codigoComentario DESC`,
        [caseId, countryCode],
      ),
      source.execute(
        `SELECT h.codigoHistorico AS id, h.Descripcion AS description, h.codEstado AS statusId,
                st.nombreEstado AS statusName, h.codigousuario AS userId,
                p.Nombre_Personas AS userName, h.fechaHoraRegistro AS registeredAt, h.codS3 AS s3Key
         FROM ${databases.documents}.tblHistoricoIncidentes_Legal h
         LEFT JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = h.codigousuario
         LEFT JOIN ${databases.documents}.tblEstadosIncidentes_Legal st ON st.codigoEstado = h.codEstado
         WHERE h.codIncidente = ? AND h.codigoPais = ?
         ORDER BY h.codigoHistorico DESC`,
        [caseId, countryCode],
      ),
      source.execute(
        `SELECT h.codigoHistorico AS id, h.codAccion AS actionId, h.Descripcion AS description,
                h.codEstado AS statusId, st.nombreEstado AS statusName,
                h.codigousuario AS userId, p.Nombre_Personas AS userName,
                h.fechaHoraRegistro AS registeredAt, h.codS3 AS s3Key
         FROM ${databases.documents}.tblHistoricoIncidentesAccion_Legal h
         LEFT JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = h.codigousuario
         LEFT JOIN ${databases.documents}.tblEstadosIncidentes_Legal st ON st.codigoEstado = h.codEstado
         WHERE h.codIncidente = ? AND h.codigoPais = ?
         ORDER BY h.codigoHistorico DESC`,
        [caseId, countryCode],
      ),
      source.execute(
        `SELECT codArchivosxIncidente AS id, NombreArchivo AS fileName, CodS3 AS s3Key,
                UsuarioCreado AS createdBy, FechaCreado AS createdAt
         FROM ${databases.documents}.tblArchivosxIncidente_Legal
         WHERE codIncidente = ? AND isActivo = 1
         ORDER BY codArchivosxIncidente DESC`,
        [caseId],
      ),
    ]);
    return {
      ...caseRows[0],
      requiresEvidence: Boolean(caseRows[0].requiresEvidence),
      actions: actionRows[0].map((row) => ({ ...row, isAutomatic: Boolean(row.isAutomatic) })),
      comments: commentRows[0],
      history: caseHistoryRows[0],
      actionHistory: actionHistoryRows[0],
      files: fileRows[0],
    };
  }

  return {
    async getLaborNotificationRecipient(countryCode, personId) {
      const [rows] = await databasePool().execute(
        `SELECT p.Codigo_Personas AS id,
                p.Nombre_Personas AS name,
                p.Correo_electronico AS email,
                EXISTS (
                  SELECT 1
                  FROM ${databases.documents}.tblUsuariosAcciones ua
                  WHERE ua.codigoUsuario = p.Codigo_Personas
                    AND ua.codigoPais = ?
                    AND ua.isRRHH = 1
                    AND ua.isActive = 1
                ) AS isHumanResources
         FROM ${databases.people}.tblPersonas p
         WHERE p.Codigo_Personas = ?
           AND p.CodigoPais = ?
           AND p.isActivo = 1
         LIMIT 1`,
        [countryCode, personId, countryCode],
      );
      if (!rows[0]) return null;
      return { ...rows[0], isHumanResources: Boolean(Number(rows[0].isHumanResources)) };
    },

    async listIncidents(scope, countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const fromClause = `
        FROM ${databases.documents}.tblIncidentesExternos i
        LEFT JOIN ${databases.people}.tblSucursales s ON s.Codigo_Sucursal = i.CodigoSucursal
        LEFT JOIN ${databases.documents}.tblTiposIncidentes t ON t.codigoTipoIncidente = i.codigoTipoIncidente
        LEFT JOIN ${databases.documents}.tblMotivosIncidentes m ON m.codigoMotivo = i.Cod_MotivoIncidente
        LEFT JOIN ${databases.documents}.tblCategoriaIncidente incidentCategory ON incidentCategory.codigoCategoria = i.categoriaIncidente
        LEFT JOIN ${databases.documents}.tblEntesGubernamentales e ON e.codigoEnte = i.codigoEnte
        LEFT JOIN ${databases.documents}.tblEstadosIncidentes st ON st.codigoEstado = i.Cod_EstadoIncidente
        LEFT JOIN ${databases.people}.tblPersonas visitor ON visitor.Codigo_Personas = i.usuarioVisita
      `;
      const { where, parameters } = incidentFilters(scope, countryCode, filters);
      const offset = (filters.page - 1) * filters.pageSize;
      const listQuery = `
        SELECT i.Cod_Incidente AS id,
               i.codigoReferencia AS reference,
               i.CodigoSucursal AS branchId,
               CONCAT_WS(' - ', s.Codigo_InternoSucursal, s.Nombre_Sucursal) AS branchName,
               s.Codigo_InternoSucursal AS branchCode,
               s.Nombre_Sucursal AS branchOnlyName,
               s.FechaRegistro AS branchRegistrationDate,
               e.nombreEnte AS agencyName,
               t.tipoincidente AS incidentTypeName,
               m.nombreMotivo AS motiveName,
               incidentCategory.Categoria AS incidentCategory,
               i.FechaApertura AS visitDate,
               i.codigoPais AS countryCode,
               i.usuarioVisita AS createdById,
               i.usuarioActualizo AS updatedById,
               i.justificacion AS justification,
               visitor.Nombre_Personas AS recipientName,
               i.observacion AS comment,
               st.codigoEstado AS statusId,
               st.nombreEstado AS statusName
        ${fromClause}
        ${where}
        ORDER BY i.FechaApertura DESC, i.Cod_Incidente DESC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${where}`;
      const metricsQuery = `
        SELECT SUM(i.Cod_EstadoIncidente = 1) AS open,
               SUM(i.Cod_EstadoIncidente = 2) AS inProgress,
               SUM(i.Cod_EstadoIncidente = 4) AS paused,
               SUM(i.Cod_EstadoIncidente = 5) AS closed
        ${fromClause}
        ${where}
      `;
      const [[items], [countRows], [metricRows]] = await Promise.all([
        databasePool.execute(listQuery, parameters),
        databasePool.execute(countQuery, parameters),
        databasePool.execute(metricsQuery, parameters),
      ]);
      return pageResult(items, countRows[0]?.total, filters, normalizeMetrics(metricRows[0]));
    },

    async listActions(scope, countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const fromClause = `
        FROM ${databases.documents}.tblAccionesIncidentes a
        INNER JOIN ${databases.documents}.tblIncidentesExternos i ON i.Cod_Incidente = a.codigoIncidente
        LEFT JOIN ${databases.people}.tblSucursales s ON s.Codigo_Sucursal = a.codigosucursal
        LEFT JOIN ${databases.people}.tblPersonas responsible ON responsible.Codigo_Personas = a.responsable
        LEFT JOIN ${databases.documents}.tblEstadosIncidentes st ON st.codigoEstado = a.codigoEstado
      `;
      const { where, parameters } = actionFilters(scope, countryCode, filters);
      const offset = (filters.page - 1) * filters.pageSize;
      const listQuery = `
        SELECT a.codigoAccion AS id,
               a.AccionReferencia AS actionReference,
               i.Cod_Incidente AS incidentId,
               i.codigoReferencia AS incidentReference,
               CONCAT_WS(' - ', s.Codigo_InternoSucursal, s.Nombre_Sucursal) AS branchName,
               a.nombreAccion AS actionName,
               a.descripcionAccion AS description,
               responsible.Codigo_Personas AS responsibleId,
               responsible.Nombre_Personas AS responsibleName,
               DATE_FORMAT(a.fechaInicio, '%Y-%m-%d') AS startDate,
               DATE_FORMAT(a.fechaEntrega, '%Y-%m-%d') AS expectedDueDate,
               CASE WHEN a.fechaFin IS NULL OR YEAR(a.fechaFin) <= 1900 THEN NULL ELSE DATE_FORMAT(a.fechaFin, '%Y-%m-%d') END AS closeDate,
               st.codigoEstado AS statusId,
               st.nombreEstado AS statusName,
               a.keyS3,
               a.fileName
        ${fromClause}
        ${where}
        ORDER BY a.AccionReferencia ASC, a.codigoAccion DESC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${where}`;
      const [[items], [countRows]] = await Promise.all([
        databasePool.execute(listQuery, parameters),
        databasePool.execute(countQuery, parameters),
      ]);
      return pageResult(items, countRows[0]?.total, filters);
    },

    async listLaborCases(countryCode, filters) {
      const databasePool = pool || getDatabasePool();
      const employeeDatabase = filters.activeEmployees ? databases.humanResources : inactiveHumanResources;
      const employeeView = filters.activeEmployees ? "vstEmpleadosMesEnCurso" : "vstEmpleadosInactivos";
      const fromClause = `
        FROM ${databases.documents}.tblIncidentesInternos_Legal i
        LEFT JOIN ${databases.people}.tblSucursales s ON s.Codigo_Sucursal = i.CodigoSucursal
        LEFT JOIN ${employeeDatabase}.${employeeView} emp ON CAST(emp.CodigoInterno AS CHAR) = CAST(i.codEmpleado AS CHAR)
        LEFT JOIN ${databases.documents}.tblEstadosIncidentes_Legal st ON st.codigoEstado = i.Cod_EstadoIncidente
        LEFT JOIN ${databases.people}.tblPersonas applicant ON applicant.Codigo_Personas = i.codigoSolicitante
        LEFT JOIN ${databases.people}.tblPersonas responsible ON responsible.Codigo_Personas = i.codResponsable
        LEFT JOIN ${databases.documents}.tblNivelPermisos level ON level.coditoNivel = i.codNivelPermiso
        LEFT JOIN ${databases.documents}.tblPrioridadAccion_Legal priority ON priority.CodPrioridad = i.codPrioridad
      `;
      const { where, parameters } = laborCaseFilters(countryCode, filters);
      const offset = (filters.page - 1) * filters.pageSize;
      const listQuery = `
        SELECT i.Cod_Incidente AS id,
               i.CorrelativoIncidente AS incidentNumber,
               CONCAT_WS(' - ', s.Codigo_InternoSucursal, s.Nombre_Sucursal) AS branchName,
               s.Nombre_Sucursal AS branchOnlyName,
               s.FechaRegistro AS branchRegistrationDate,
               i.fechaHoraRegistro AS registrationDate,
               i.codigoPais AS countryCode,
               i.usuarioRegistro AS createdById,
               i.usuarioActualizo AS updatedById,
               i.justificacion AS justification,
               responsible.Nombre_Personas AS responsibleName,
               emp.NombreCompleto AS employeeName,
               emp.Puesto AS employeePosition,
               i.DNI AS identityNumber,
               i.fechaConocimiento AS awarenessDate,
               i.FechaApertura AS eventDate,
               level.NivelPermiso AS securityLevel,
               priority.NombreEstado AS priorityName,
               st.codigoEstado AS statusId,
               st.nombreEstado AS statusName
        ${fromClause}
        ${where}
        ORDER BY i.Cod_Incidente DESC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${where}`;
      const metricsQuery = `
        SELECT SUM(i.Cod_EstadoIncidente = 1) AS open,
               SUM(i.Cod_EstadoIncidente = 2) AS inProgress,
               0 AS paused,
               SUM(i.Cod_EstadoIncidente = 5) AS closed
        ${fromClause}
        ${where}
      `;
      const [[items], [countRows], [metricRows]] = await Promise.all([
        databasePool.execute(listQuery, parameters),
        databasePool.execute(countQuery, parameters),
        databasePool.execute(metricsQuery, parameters),
      ]);
      return pageResult(items, countRows[0]?.total, filters, normalizeMetrics(metricRows[0]));
    },

    async listLaborActions(countryCode, userId, filters) {
      const databasePool = pool || getDatabasePool();
      const fromClause = `
        FROM ${databases.documents}.tblAccionesIncidentes_Legal a
        INNER JOIN ${databases.documents}.tblIncidentesInternos_Legal i ON i.Cod_Incidente = a.codigoIncidente
        LEFT JOIN ${databases.documents}.tblAcciones_Legal actionType ON actionType.codAccion = a.codAccion
        LEFT JOIN ${databases.people}.tblPersonas responsible ON responsible.Codigo_Personas = a.responsable
        LEFT JOIN ${databases.documents}.tblEstadosIncidentes_Legal st ON st.codigoEstado = a.codigoEstado
      `;
      const { where, parameters } = laborActionFilters(countryCode, userId, filters);
      const offset = (filters.page - 1) * filters.pageSize;
      const listQuery = `
        SELECT a.codigoAccionIncidente AS id,
               i.Cod_Incidente AS incidentId,
               i.CorrelativoIncidente AS incidentNumber,
               CASE WHEN a.fechaFin IS NULL OR YEAR(a.fechaFin) <= 1900 THEN NULL ELSE DATE_FORMAT(a.fechaFin, '%Y-%m-%d') END AS closeDate,
               actionType.NombreAccion AS actionName,
               a.descripcionAccion AS description,
               a.responsable AS responsibleId,
               responsible.Nombre_Personas AS responsibleName,
               st.codigoEstado AS statusId,
               st.nombreEstado AS statusName,
               (a.keyS3 IS NOT NULL AND a.keyS3 <> '') AS hasEvidence,
               a.keyS3,
               a.fileName
        ${fromClause}
        ${where}
        ORDER BY a.codigoAccionIncidente DESC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${where}`;
      const [[items], [countRows]] = await Promise.all([
        databasePool.execute(listQuery, parameters),
        databasePool.execute(countQuery, parameters),
      ]);
      return pageResult(items, countRows[0]?.total, filters);
    },

    async getIncident(scope, countryCode, incidentId) {
      return readIncident(scope, countryCode, incidentId);
    },

    async createIncident(scope, countryCode, userId, incident) {
      const connection = await databasePool().getConnection();
      let lockName;
      try {
        await connection.beginTransaction();
        const [branchRows] = await connection.execute(
          `SELECT Codigo_Sucursal AS id
           FROM ${databases.people}.tblSucursales
           WHERE Codigo_Sucursal = ? AND Codigo_Pais = ? AND isActivo = 1 AND isAdministrativa = 0`,
          [incident.branchId, countryCode],
        );
        if (!branchRows[0]) {
          throw repositoryError("La sucursal seleccionada no pertenece al pais.", "INVALID_BRANCH", 400, "branchId");
        }
        const [agencyRows] = await connection.execute(
          `SELECT codigoEnte AS id, isRegulatorio AS isRegulatory,
                  codigoResponsable AS responsibleId, COALESCE(IsExterno, 0) AS isExternal
           FROM ${databases.documents}.tblEntesGubernamentales
           WHERE codigoEnte = ? AND codigoPais = ? AND isActive = 1
             AND ${scope === "internal" ? "COALESCE(IsExterno, 0) = 0" : "1 = 1"}`,
          [incident.agencyId, countryCode],
        );
        if (!agencyRows[0]) {
          throw repositoryError("El area o ente seleccionado no pertenece al pais.", "INVALID_AGENCY", 400, "agencyId");
        }
        const agency = agencyRows[0];
        if (!agency.responsibleId) {
          throw repositoryError("El area o ente no tiene un responsable configurado.", "AGENCY_WITHOUT_RESPONSIBLE", 409, "agencyId");
        }
        await requireCountryPerson(connection, countryCode, incident.visitorId, { branchId: incident.branchId });
        await requireCountryPerson(connection, countryCode, agency.responsibleId);

        const typeId = agency.isRegulatory ? 2 : 1;
        const [typeRows] = await connection.execute(
          `SELECT nomenclatura AS prefix FROM ${databases.documents}.tblTiposIncidentes
           WHERE codigoTipoIncidente = ? AND isActive = 1`,
          [typeId],
        );
        if (!typeRows[0]?.prefix) {
          throw repositoryError("El tipo de incidente no tiene nomenclatura configurada.", "INVALID_INCIDENT_TYPE", 409);
        }
        const [periodRows] = await connection.execute("SELECT DATE_FORMAT(NOW(), '%Y%m') AS period");
        const referencePrefix = `${typeRows[0].prefix}-${periodRows[0].period}-`;
        lockName = `dl:incident:${countryCode}:${referencePrefix}`;
        const [lockRows] = await connection.execute("SELECT GET_LOCK(?, 5) AS acquired", [lockName]);
        if (Number(lockRows[0]?.acquired) !== 1) {
          throw repositoryError("No fue posible reservar el numero de incidente. Intente nuevamente.", "INCIDENT_REFERENCE_BUSY", 409);
        }
        const [referenceRows] = await connection.execute(
          `SELECT COALESCE(MAX(CAST(RIGHT(codigoReferencia, 5) AS UNSIGNED)), 0) + 1 AS nextNumber
           FROM ${databases.documents}.tblIncidentesExternos
           WHERE codigoPais = ? AND codigoReferencia LIKE CONCAT(?, '%')`,
          [countryCode, referencePrefix],
        );
        const reference = `${referencePrefix}${String(referenceRows[0].nextNumber).padStart(5, "0")}`;
        const openingExpression = scope === "internal" ? "DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')" : "?";
        const openingParameters = scope === "internal" ? [] : [incident.visitAt];
        const visitDate = scope === "internal" ? incident.visitAt : null;
        const [insertResult] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblIncidentesExternos
             (CodigoSucursal, codigoTipoIncidente, Cod_MotivoIncidente, categoriaIncidente,
              observacion, codigoEnte, fechaVisita, FechaApertura, Cod_EstadoIncidente,
              codigoPais, fechaHoraRegistro, usuarioVisita, isActivo, codigoS3,
              usuarioRegistro, codigoReferencia, isExterno)
           VALUES (?, ?, 3, 5, ?, ?, ?, ${openingExpression}, 1, ?,
                   DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?, 1, ?, ?, ?, ?)`,
          [
            incident.branchId,
            typeId,
            incident.comment,
            incident.agencyId,
            visitDate,
            ...openingParameters,
            countryCode,
            incident.visitorId,
            incident.s3Key,
            userId,
            reference,
            scope === "external" ? 1 : Number(Boolean(agency.isExternal)),
          ],
        );
        const incidentId = insertResult.insertId;
        const [actionResult] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblAccionesIncidentes
             (nombreAccion, descripcionAccion, responsable, fechaInicio, fechaEntrega,
              AccionReferencia, codigoEstado, isActive, codigoIncidente, codigosucursal,
              usuarioAdministrador, fechaRegistro, isAutomatic)
           VALUES ('Revision de Incidente', 'Accion automatica revision de incidente ', ?,
                   CURDATE(), CURDATE(), '1', 2, 1, ?, ?, ?,
                   DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), 1)`,
          [agency.responsibleId, incidentId, incident.branchId, agency.responsibleId],
        );
        const responsible = await requireCountryPerson(connection, countryCode, agency.responsibleId);
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblComentariosIncidentes
             (comentario, codigoIncidente, tipoIncidente, codigoUsuario, codigoPais, fechaHoraRegistro)
           VALUES (?, ?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))`,
          [`Creacion accion Automatica revision de Incidente a ${responsible.name}`, incidentId, typeId, userId, countryCode],
        );
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblHistoricoIncidentesAccion
             (accion, codigoreferencia, codigousuario, codigoPais, fechaHoraRegistro, Descripcion)
           VALUES (?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), 'Creacion accion automatica')`,
          [String(actionResult.insertId), incidentId, userId, countryCode],
        );
        await connection.commit();
        return await readIncident(scope, countryCode, incidentId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        if (lockName) {
          try { await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]); } catch { /* connection close releases it */ }
        }
        connection.release();
      }
    },

    async createIncidentAction(scope, countryCode, userId, incidentId, action) {
      await transaction(async (connection) => {
        const incident = await requireIncident(connection, scope, countryCode, incidentId, true);
        requireOpenParent(incident);
        await requireIncidentActionResponsible(connection, countryCode, incident, action.responsibleId);
        const [referenceRows] = await connection.execute(
          `SELECT COALESCE(MAX(CAST(AccionReferencia AS UNSIGNED)), 0) + 1 AS nextNumber
           FROM ${databases.documents}.tblAccionesIncidentes
           WHERE codigoIncidente = ? FOR UPDATE`,
          [incidentId],
        );
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblAccionesIncidentes
             (nombreAccion, descripcionAccion, responsable, fechaInicio, fechaEntrega,
              AccionReferencia, codigoEstado, isActive, codigoIncidente, codigosucursal,
              usuarioAdministrador, fechaRegistro, isAutomatic)
           VALUES (?, ?, ?, CURDATE(), ?, ?, 1, 1, ?, ?, ?,
                   DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), 0)`,
          [
            action.name,
            action.description,
            action.responsibleId,
            action.dueDate,
            String(referenceRows[0].nextNumber),
            incidentId,
            incident.branchId,
            userId,
          ],
        );
      });
      return readIncident(scope, countryCode, incidentId);
    },

    async updateIncidentAction(scope, countryCode, userId, actionId, update) {
      let incidentId;
      await transaction(async (connection) => {
        const [rows] = await connection.execute(
          `SELECT a.codigoAccion AS id, a.codigoIncidente AS incidentId, a.responsable AS responsibleId,
                  a.fechaEntrega AS dueDate, a.codigoEstado AS statusId, a.isActive,
                  i.CodigoSucursal AS branchId, i.codigoTipoIncidente AS typeId
           FROM ${databases.documents}.tblAccionesIncidentes a
           INNER JOIN ${databases.documents}.tblIncidentesExternos i ON i.Cod_Incidente = a.codigoIncidente
           WHERE a.codigoAccion = ? AND i.codigoPais = ? AND COALESCE(i.isExterno, 0) = ?
           FOR UPDATE`,
          [actionId, countryCode, scope === "external" ? 1 : 0],
        );
        const current = rows[0];
        if (!current || !current.isActive) {
          throw repositoryError("La accion solicitada no existe.", "INCIDENT_ACTION_NOT_FOUND", 404);
        }
        requireActionMutationAuthorization(current, userId, update.operation);
        incidentId = current.incidentId;
        let statusId = current.statusId;
        let description;
        if (update.operation === "start") {
          statusId = 2;
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes SET codigoEstado = 2 WHERE codigoAccion = ?`,
            [actionId],
          );
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesExternos
             SET Cod_EstadoIncidente = 2 WHERE Cod_Incidente = ? AND Cod_EstadoIncidente = 1`,
            [incidentId],
          );
          description = operationDescription("start");
        } else if (update.operation === "cancel") {
          statusId = 3;
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes
             SET codigoEstado = 3, \`Justificación\` = ? WHERE codigoAccion = ?`,
            [update.justification, actionId],
          );
          description = operationDescription("cancel", update);
        } else if (update.operation === "close") {
          statusId = 5;
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes
             SET codigoEstado = 5, fechaFin = CURDATE(), \`Justificación\` = ?, keyS3 = ?, fileName = ?
             WHERE codigoAccion = ?`,
            [update.justification, update.s3Key, update.fileName, actionId],
          );
          description = operationDescription("close", update);
        } else if (update.operation === "reassign") {
          const oldPerson = current.responsibleId
            ? await requireCountryPerson(connection, countryCode, current.responsibleId)
            : { name: "Sin asignar" };
          const newPerson = await requireIncidentActionResponsible(
            connection,
            countryCode,
            current,
            update.responsibleId,
          );
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes SET responsable = ? WHERE codigoAccion = ?`,
            [update.responsibleId, actionId],
          );
          description = operationDescription("reassign", { oldName: oldPerson.name, newName: newPerson.name });
        } else {
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes SET fechaEntrega = ? WHERE codigoAccion = ?`,
            [update.dueDate, actionId],
          );
          description = operationDescription("reschedule", {
            dueDate: update.dueDate,
            oldDueDate: current.dueDate ? String(current.dueDate).slice(0, 10) : null,
          });
        }
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblHistoricoIncidentesAccion
             (accion, codigoreferencia, codigousuario, codigoPais, fechaHoraRegistro, Descripcion)
           VALUES (?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?)`,
          [String(actionId), incidentId, userId, countryCode, description],
        );
        if (["reassign", "reschedule"].includes(update.operation)) {
          const incident = await requireIncident(connection, scope, countryCode, incidentId);
          await connection.execute(
            `INSERT INTO ${databases.documents}.tblComentariosIncidentes
               (comentario, codigoIncidente, tipoIncidente, codigoUsuario, codigoPais, fechaHoraRegistro)
             VALUES (?, ?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))`,
            [description, incidentId, incident.typeId, userId, countryCode],
          );
        }
      });
      return readIncident(scope, countryCode, incidentId);
    },

    async closeIncident(scope, countryCode, userId, incidentId, justification) {
      await transaction(async (connection) => {
        const incident = await requireIncident(connection, scope, countryCode, incidentId, true);
        requireOpenParent(incident);
        const [openRows] = await connection.execute(
          `SELECT COUNT(*) AS total FROM ${databases.documents}.tblAccionesIncidentes
           WHERE codigoIncidente = ? AND isActive = 1 AND codigoEstado IN (1, 2, 4)`,
          [incidentId],
        );
        if (Number(openRows[0].total) > 0) {
          throw repositoryError("Existen acciones abiertas, en ejecucion o en pausa.", "INCIDENT_HAS_OPEN_ACTIONS", 409);
        }
        await connection.execute(
          `UPDATE ${databases.documents}.tblIncidentesExternos
           SET justificacion = ?, usuarioActualizo = ?,
               FechaActualizo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), Cod_EstadoIncidente = 5
           WHERE Cod_Incidente = ?`,
          [justification, userId, incidentId],
        );
      });
      return readIncident(scope, countryCode, incidentId);
    },

    async addIncidentComment(scope, countryCode, userId, incidentId, comment) {
      await transaction(async (connection) => {
        const incident = await requireIncident(connection, scope, countryCode, incidentId, true);
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblComentariosIncidentes
             (comentario, codigoIncidente, tipoIncidente, codigoUsuario, codigoPais,
              fechaHoraRegistro, CodAdjuntoS3)
           VALUES (?, ?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?)`,
          [comment.comment, incidentId, incident.typeId, userId, countryCode, comment.s3Key],
        );
      });
      return readIncident(scope, countryCode, incidentId);
    },

    async getLaborCase(countryCode, caseId) {
      return readLaborCase(countryCode, caseId);
    },

    async createLaborAction(countryCode, userId, caseId, action) {
      await transaction(async (connection) => {
        const laborCase = await requireLaborCase(connection, countryCode, caseId, true);
        requireOpenParent(laborCase, { labor: true });
        const responsible = await requireLaborActionResponsible(
          connection,
          countryCode,
          caseId,
          action.responsibleId,
        );
        const [actionTypeRows] = await connection.execute(
          `SELECT codAccion AS id FROM ${databases.documents}.tblAcciones_Legal
           WHERE codAccion = ? AND IsActivo = 1`,
          [action.actionId],
        );
        if (!actionTypeRows[0]) {
          throw repositoryError("La accion laboral seleccionada no esta activa.", "INVALID_LABOR_ACTION", 400, "actionId");
        }
        const [insertResult] = await connection.execute(
          `INSERT INTO ${databases.documents}.tblAccionesIncidentes_Legal
             (codAccion, descripcionAccion, responsable, fechaFin, codigoEstado, isActive,
              codigoIncidente, codPrioridad, usuarioAdministrador, fechaRegistro,
              isAutomatic, keyS3, fileName)
           VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), 0, ?, ?)`,
          [
            action.actionId,
            action.description,
            action.responsibleId,
            action.dueDate,
            caseId,
            action.priorityId || null,
            userId,
            action.s3Key,
            action.fileName,
          ],
        );
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblHistoricoIncidentesAccion_Legal
             (codAccion, codigousuario, codigoPais, fechaHoraRegistro, Descripcion,
              codEstado, codIncidente, codS3)
           VALUES (?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?, 1, ?, ?)`,
          [insertResult.insertId, userId, countryCode, `Se ha creado la accion para ${responsible.name}`, caseId, action.s3Key],
        );
      });
      return readLaborCase(countryCode, caseId);
    },

    async updateLaborAction(countryCode, userId, actionId, update) {
      let caseId;
      await transaction(async (connection) => {
        const [rows] = await connection.execute(
          `SELECT a.codigoAccionIncidente AS id, a.codigoIncidente AS caseId,
                  a.responsable AS responsibleId, a.fechaFin AS dueDate,
                  a.codigoEstado AS statusId, a.isActive
           FROM ${databases.documents}.tblAccionesIncidentes_Legal a
           INNER JOIN ${databases.documents}.tblIncidentesInternos_Legal i ON i.Cod_Incidente = a.codigoIncidente
           WHERE a.codigoAccionIncidente = ? AND i.codigoPais = ? FOR UPDATE`,
          [actionId, countryCode],
        );
        const current = rows[0];
        if (!current || !current.isActive) {
          throw repositoryError("La accion laboral solicitada no existe.", "LABOR_ACTION_NOT_FOUND", 404);
        }
        requireActionMutationAuthorization(current, userId, update.operation, { labor: true });
        caseId = current.caseId;
        const laborCase = await requireLaborCase(connection, countryCode, caseId, true);
        if (update.operation === "close") requireRequestedLaborEvidence(update);
        let statusId = current.statusId;
        let description;
        let historyS3 = null;
        if (update.operation === "start") {
          statusId = 2;
          description = "La accion ha iniciado";
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes_Legal
             SET codigoEstado = 2, fechaInicio = COALESCE(fechaInicio, CURDATE())
             WHERE codigoAccionIncidente = ?`,
            [actionId],
          );
          if (Number(laborCase.statusId) === 1 || Number(laborCase.statusId) === 10) {
            await connection.execute(
              `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
               SET Cod_EstadoIncidente = 2, codResponsable = COALESCE(codResponsable, ?),
                   usuarioActualizo = ?, FechaActualizo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
               WHERE Cod_Incidente = ?`,
              [current.responsibleId, userId, caseId],
            );
          }
        } else if (update.operation === "cancel") {
          statusId = 3;
          description = "Se ha anulado la accion";
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes_Legal
             SET codigoEstado = 3 WHERE codigoAccionIncidente = ?`,
            [actionId],
          );
        } else if (update.operation === "close") {
          statusId = 5;
          description = "Se ha cerrado la accion";
          historyS3 = update.s3Key;
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes_Legal
             SET codigoEstado = 5, fechaFin = CURDATE(), \`Justificación\` = ?,
                 keyS3 = COALESCE(?, keyS3), fileName = COALESCE(?, fileName)
             WHERE codigoAccionIncidente = ?`,
            [update.justification, update.s3Key, update.fileName, actionId],
          );
        } else if (update.operation === "reassign") {
          const oldPerson = current.responsibleId
            ? await requireCountryPerson(connection, countryCode, current.responsibleId)
            : { name: "Sin asignar" };
          const newPerson = await requireLaborActionResponsible(
            connection,
            countryCode,
            caseId,
            update.responsibleId,
          );
          statusId = 2;
          description = operationDescription("reassign", { oldName: oldPerson.name, newName: newPerson.name });
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes_Legal
             SET responsable = ?, codigoEstado = 2
             WHERE codigoAccionIncidente = ?`,
            [update.responsibleId, actionId],
          );
        } else {
          statusId = 2;
          description = operationDescription("reschedule", {
            dueDate: update.dueDate,
            oldDueDate: current.dueDate ? String(current.dueDate).slice(0, 10) : null,
          });
          await connection.execute(
            `UPDATE ${databases.documents}.tblAccionesIncidentes_Legal
             SET fechaFin = ?, codigoEstado = 2
             WHERE codigoAccionIncidente = ?`,
            [update.dueDate, actionId],
          );
        }
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblHistoricoIncidentesAccion_Legal
             (codAccion, codigousuario, codigoPais, fechaHoraRegistro, Descripcion,
              codEstado, codIncidente, codS3)
           VALUES (?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?, ?, ?, ?)`,
          [actionId, userId, countryCode, description, statusId, caseId, historyS3],
        );
      });
      return readLaborCase(countryCode, caseId);
    },

    async updateLaborCase(countryCode, userId, caseId, update) {
      await transaction(async (connection) => {
        const laborCase = await requireLaborCase(connection, countryCode, caseId, true);
        if (["pending", "close"].includes(update.operation)) {
          requireOpenParent(laborCase, { labor: true });
        }
        if (update.operation === "close") requireLaborEvidence(laborCase, update);
        let description;
        let statusId = laborCase.statusId;
        let historyS3 = null;
        if (update.operation === "responsible") {
          const person = await requireCountryPerson(connection, countryCode, update.responsibleId, { labor: true });
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
             SET codResponsable = ?, usuarioActualizo = ?, FechaActualizo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
             WHERE Cod_Incidente = ?`,
            [update.responsibleId, userId, caseId],
          );
          description = `Se ha actualizado el responsable legal a ${person.name}`;
        } else if (update.operation === "reassign") {
          await requireCountryPerson(connection, countryCode, update.responsibleId, { labor: true });
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
             SET codResponsable = ?
             WHERE Cod_Incidente = ?`,
            [update.responsibleId, caseId],
          );
          description = "Reasignación de Usuario";
        } else if (update.operation === "security") {
          const [rows] = await connection.execute(
            `SELECT coditoNivel AS id FROM ${databases.documents}.tblNivelPermisos
             WHERE coditoNivel = ? AND isActive = 1`,
            [update.levelId],
          );
          if (!rows[0]) throw repositoryError("El nivel de seguridad no es valido.", "INVALID_SECURITY_LEVEL", 400, "levelId");
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
             SET codNivelPermiso = ?, usuarioActualizo = ?, FechaActualizo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
             WHERE Cod_Incidente = ?`,
            [update.levelId, userId, caseId],
          );
          description = "Se ha actualizado el nivel de seguridad";
        } else if (update.operation === "priority") {
          const [rows] = await connection.execute(
            `SELECT CodPrioridad AS id FROM ${databases.documents}.tblPrioridadAccion_Legal
             WHERE CodPrioridad = ? AND isActive = 1`,
            [update.priorityId],
          );
          if (!rows[0]) throw repositoryError("La prioridad no es valida.", "INVALID_PRIORITY", 400, "priorityId");
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
             SET codPrioridad = ?, usuarioActualizo = ?, FechaActualizo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
             WHERE Cod_Incidente = ?`,
            [update.priorityId, userId, caseId],
          );
          description = "Se ha actualizado la prioridad";
        } else if (update.operation === "cancel") {
          statusId = 3;
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
             SET Cod_EstadoIncidente = 3
             WHERE Cod_Incidente = ?`,
            [caseId],
          );
          description = `Anular Caso ${laborCase.reference || caseId}`;
        } else if (update.operation === "pending") {
          statusId = 10;
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
             SET Cod_EstadoIncidente = 10, usuarioActualizo = ?,
                 FechaActualizo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
             WHERE Cod_Incidente = ?`,
            [userId, caseId],
          );
          description = `Caso pendiente de informacion: ${update.justification}`;
        } else {
          const [openRows] = await connection.execute(
            `SELECT COUNT(*) AS total FROM ${databases.documents}.tblAccionesIncidentes_Legal
             WHERE codigoIncidente = ? AND isActive = 1 AND codigoEstado IN (1, 2, 4)`,
            [caseId],
          );
          if (Number(openRows[0].total) > 0) {
            throw repositoryError("Existen acciones abiertas, en ejecucion o en pausa.", "LABOR_CASE_HAS_OPEN_ACTIONS", 409);
          }
          statusId = 5;
          historyS3 = update.s3Key;
          await connection.execute(
            `UPDATE ${databases.documents}.tblIncidentesInternos_Legal
             SET justificacion = ?, usuarioActualizo = ?,
                 FechaActualizo = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'),
                 Cod_EstadoIncidente = 5, codigoS3 = ?
             WHERE Cod_Incidente = ?`,
            [update.justification, userId, update.s3Key, caseId],
          );
          description = "Se ha cerrado el caso";
        }
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblHistoricoIncidentes_Legal
             (codigousuario, codigoPais, fechaHoraRegistro, Descripcion, codEstado, codIncidente, codS3)
           VALUES (?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?, ?, ?, ?)`,
          [userId, countryCode, description, statusId, caseId, historyS3],
        );
        if (["pending", "close"].includes(update.operation)) {
          await connection.execute(
            `INSERT INTO ${databases.documents}.tblComentariosIncidentes_Legal
               (comentario, codigoIncidente, codigoUsuario, codigoPais, fechaHoraRegistro, CodAdjuntoS3)
             VALUES (?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?)`,
            [description, caseId, userId, countryCode, historyS3],
          );
        }
      });
      return readLaborCase(countryCode, caseId);
    },

    async addLaborComment(countryCode, userId, caseId, comment) {
      await transaction(async (connection) => {
        await requireLaborCase(connection, countryCode, caseId, true);
        await connection.execute(
          `INSERT INTO ${databases.documents}.tblComentariosIncidentes_Legal
             (comentario, codigoIncidente, codigoUsuario, codigoPais, fechaHoraRegistro, CodAdjuntoS3)
           VALUES (?, ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'), ?)`,
          [comment.comment, caseId, userId, countryCode, comment.s3Key],
        );
      });
      return readLaborCase(countryCode, caseId);
    },

    async getCatalogs(scope, countryCode, filters = {}) {
      const databasePool = pool || getDatabasePool();
      const external = scope.startsWith("external");
      const labor = scope.startsWith("labor");
      const legacyLaborActions = scope === "labor-actions-legacy";
      const incidentActions = scope === "internal-actions" || scope === "external-actions";
      const laborActionListing = scope === "labor-actions" && !filters.incidentId;
      const statusesTable = laborActionListing
        ? "tblEstadosIncidentes"
        : labor ? "tblEstadosIncidentes_Legal" : "tblEstadosIncidentes";
      const statusFilter = scope === "labor-cases" ? "AND codigoEstado IN (1, 2, 5)" : "";
      const activeStatusFilter = laborActionListing ? "" : "WHERE isActive = 1";
      const activeActionFilter = laborActionListing ? "" : "WHERE IsActivo = 1";
      const recipientBranchFilter = filters.branchId ? "AND Codigo_Sucursal = ?" : "AND 1 = 0";
      const recipientParameters = filters.branchId ? [countryCode, filters.branchId] : [countryCode];
      let responsiblePeopleQuery = [
        `SELECT DISTINCT p.Codigo_Personas AS id, p.Nombre_Personas AS name
         FROM ${databases.documents}.tblUsuariosAcciones ua
         INNER JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = ua.codigoUsuario
         WHERE ua.codigoPais = ? AND ua.isActive = 1
           AND COALESCE(ua.isRRHH, 0) = 0 AND p.isActivo = 1
         ORDER BY p.Nombre_Personas`,
        [countryCode],
      ];
      if (incidentActions && filters.incidentId) {
        const [incidentRows] = await databasePool.execute(
          `SELECT i.CodigoSucursal AS branchId, i.codigoTipoIncidente AS typeId
           FROM ${databases.documents}.tblIncidentesExternos i
           WHERE i.Cod_Incidente = ? AND i.codigoPais = ? AND COALESCE(i.isExterno, 0) = ?
           LIMIT 1`,
          [filters.incidentId, countryCode, external ? 1 : 0],
        );
        const incident = incidentRows[0];
        if (!incident) {
          throw repositoryError("El incidente solicitado no existe.", "INCIDENT_NOT_FOUND", 404);
        }
        responsiblePeopleQuery = [
          `SELECT p.Codigo_Personas AS id, p.Nombre_Personas AS name
           FROM ${databases.people}.tblPersonas p
           WHERE p.CodigoPais = ? AND p.Codigo_Sucursal = ? AND p.isActivo = 1
           UNION
           SELECT p.Codigo_Personas AS id, p.Nombre_Personas AS name
           FROM ${databases.documents}.tblUsuariosAcciones ua
           INNER JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = ua.codigoUsuario
           WHERE ua.codigoTipoIncidente = ? AND ua.codigoPais = ? AND ua.isActive = 1
             AND p.CodigoPais = ? AND p.isActivo = 1
           ORDER BY name`,
          [countryCode, incident.branchId, incident.typeId, countryCode, countryCode],
        ];
      }
      const legalResponsiblePeopleQuery = [
        `SELECT p.Codigo_Personas AS id, p.Nombre_Personas AS name
         FROM ${databases.documents}.tblUsuariosAcciones ua
         INNER JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = ua.codigoUsuario
         WHERE ua.codigoPais = ? AND ua.isRRHH = 1 AND ua.isActive = 1 AND p.isActivo = 1
         ORDER BY p.Nombre_Personas`,
        [countryCode],
      ];
      let laborResponsiblePeopleQuery = legalResponsiblePeopleQuery;
      if (legacyLaborActions) {
        laborResponsiblePeopleQuery = [
          `SELECT DISTINCT p.Codigo_Personas AS id, p.Nombre_Personas AS name
           FROM ${databases.documents}.tblUsuariosAcciones ua
           LEFT JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = ua.codigoUsuario
           WHERE ua.isRRHH = 1 AND ua.codigoPais = ?
           ORDER BY p.Nombre_Personas
           LIMIT 50`,
          [countryCode],
        ];
      } else if (scope === "labor-actions" && filters.incidentId) {
        const [laborCaseRows] = await databasePool.execute(
          `SELECT i.codigoSolicitante AS applicantId
           FROM ${databases.documents}.tblIncidentesInternos_Legal i
           WHERE i.Cod_Incidente = ? AND i.codigoPais = ?
           LIMIT 1`,
          [filters.incidentId, countryCode],
        );
        const laborCase = laborCaseRows[0];
        if (!laborCase) {
          throw repositoryError("El caso laboral solicitado no existe.", "LABOR_CASE_NOT_FOUND", 404);
        }
        laborResponsiblePeopleQuery = [
          `SELECT p.Codigo_Personas AS id, p.Nombre_Personas AS name
           FROM ${databases.people}.tblPersonas p
           WHERE p.CodigoPais = ? AND p.Codigo_Personas = ?
           UNION
           SELECT ua.codigoUsuario AS id, p.Nombre_Personas AS name
           FROM ${databases.documents}.tblUsuariosAcciones ua
           INNER JOIN ${databases.people}.tblPersonas p ON p.Codigo_Personas = ua.codigoUsuario
           WHERE ua.isRRHH = 1 AND ua.codigoPais = ? AND ua.isActive = 1 AND p.isActivo = 1
           ORDER BY name`,
          [countryCode, laborCase.applicantId, countryCode],
        ];
      }
      const queries = [
        [`SELECT Codigo_Sucursal AS id, CONCAT_WS(' - ', Codigo_InternoSucursal, Nombre_Sucursal) AS name FROM ${databases.people}.tblSucursales WHERE Codigo_Pais = ? AND isAdministrativa = 0 AND isActivo = 1 ORDER BY OrdenSucursal`, [countryCode]],
        [`SELECT codigoEstado AS id, nombreEstado AS name FROM ${databases.documents}.${statusesTable} ${activeStatusFilter} ${statusFilter} ORDER BY codigoEstado`, []],
        [`SELECT codigoMotivo AS id, nombreMotivo AS name FROM ${databases.documents}.tblMotivosIncidentes WHERE codigoPais = ? AND isActive = 1 AND ${external ? "COALESCE(isInterno, 0) = 0" : "isInterno = 1 AND codigoMotivo = 4"} ORDER BY nombreMotivo`, [countryCode]],
        [`SELECT codigoEnte AS id, nombreEnte AS name, isRegulatorio AS isRegulatory, codigoResponsable AS responsibleId, COALESCE(IsExterno, 0) AS isExternal FROM ${databases.documents}.tblEntesGubernamentales WHERE codigoPais = ? AND isActive = 1 AND ${external ? "1 = 1" : "COALESCE(IsExterno, 0) = 0"} ORDER BY nombreEnte`, [countryCode]],
        responsiblePeopleQuery,
        legalResponsiblePeopleQuery,
        [`SELECT coditoNivel AS id, NivelPermiso AS name FROM ${databases.documents}.tblNivelPermisos WHERE isActive = 1 ORDER BY coditoNivel`, []],
        [`SELECT codAccion AS id, NombreAccion AS name FROM ${databases.documents}.tblAcciones_Legal ${activeActionFilter} ORDER BY NombreAccion`, []],
        [`SELECT CodPrioridad AS id, NombreEstado AS name FROM ${databases.documents}.tblPrioridadAccion_Legal WHERE isActive = 1 ORDER BY CodPrioridad`, []],
        [`SELECT Codigo_Personas AS id, Nombre_Personas AS name FROM ${databases.people}.tblPersonas WHERE CodigoPais = ? AND isActivo = 1 ${recipientBranchFilter} ORDER BY Nombre_Personas`, recipientParameters],
        laborResponsiblePeopleQuery,
      ];
      const results = await Promise.all(queries.map(([sql, parameters]) => databasePool.execute(sql, parameters)));
      return {
        branches: results[0][0],
        statuses: results[1][0],
        motives: results[2][0],
        agencies: results[3][0],
        responsiblePeople: labor ? results[10][0] : results[4][0],
        legalResponsiblePeople: results[5][0],
        levels: results[6][0],
        actions: results[7][0],
        priorities: results[8][0],
        recipients: results[9][0],
      };
    },
  };
}
