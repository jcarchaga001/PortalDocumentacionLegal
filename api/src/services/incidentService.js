function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function normalizeDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : undefined;
}

function normalizeText(value, maximumLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function validationError(message, field, code = "VALIDATION_ERROR", status = 400) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.field = field;
  return error;
}

function requirePositiveInteger(value, field, message) {
  const normalized = positiveInteger(value);
  if (!normalized) throw validationError(message, field);
  return normalized;
}

function requireText(value, field, message, maximumLength) {
  const normalized = normalizeText(value, maximumLength);
  if (!normalized) throw validationError(message, field);
  return normalized;
}

function optionalText(value, maximumLength) {
  return normalizeText(value, maximumLength) || null;
}

function normalizeIsoDateTime(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace("T", " ");
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(normalized)
    ? normalized.length === 16 ? `${normalized}:00` : normalized
    : undefined;
}

function requireDate(value, field, message) {
  const normalized = normalizeDate(value);
  if (!normalized) throw validationError(message, field);
  return normalized;
}

function requireIncidentId(value, field = "incidentId") {
  return requirePositiveInteger(value, field, "El incidente solicitado no es valido.");
}

function normalizeAttachment(input = {}, required = false) {
  const s3Key = optionalText(input.s3Key, 128);
  const fileName = optionalText(input.fileName, 128);
  if (required && !s3Key) {
    throw validationError("Adjunte la evidencia requerida.", "s3Key");
  }
  return { s3Key, fileName };
}

export function normalizeIncidentInput(input = {}) {
  const visitAt = normalizeIsoDateTime(input.visitAt);
  if (!visitAt) throw validationError("Ingrese una fecha de visita valida.", "visitAt");
  return {
    branchId: requirePositiveInteger(input.branchId, "branchId", "Seleccione una sucursal."),
    agencyId: requirePositiveInteger(input.agencyId, "agencyId", "Seleccione el area o ente gubernamental."),
    visitorId: requirePositiveInteger(input.visitorId, "visitorId", "Seleccione el usuario que recibio la visita."),
    visitAt,
    comment: requireText(input.comment, "comment", "Ingrese el comentario del gerente.", 1024),
    ...normalizeAttachment(input, true),
  };
}

export function normalizeIncidentActionInput(input = {}) {
  const dueDate = requireDate(input.dueDate, "dueDate", "Ingrese una fecha probable de vencimiento valida.");
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (dueDate < localToday) {
    throw validationError("La fecha probable de vencimiento no puede ser anterior a hoy.", "dueDate");
  }
  return {
    name: requireText(input.name, "name", "Ingrese el nombre de la accion.", 512),
    description: optionalText(input.description, 5000),
    responsibleId: requirePositiveInteger(input.responsibleId, "responsibleId", "Seleccione un responsable."),
    dueDate,
  };
}

export function normalizeLaborActionInput(input = {}) {
  return {
    actionId: requirePositiveInteger(input.actionId, "actionId", "Seleccione una accion."),
    responsibleId: requirePositiveInteger(input.responsibleId, "responsibleId", "Seleccione un responsable."),
    dueDate: requireDate(input.dueDate, "dueDate", "Ingrese la fecha de cierre de la accion."),
    priorityId: positiveInteger(input.priorityId),
    description: optionalText(input.description, 5000),
    ...normalizeAttachment(input, false),
  };
}

const ACTION_OPERATIONS = new Set(["start", "close", "cancel", "reassign", "reschedule"]);

export function normalizeActionUpdate(input = {}) {
  const operation = normalizeText(input.operation, 32).toLowerCase();
  if (!ACTION_OPERATIONS.has(operation)) {
    throw validationError("La operacion solicitada no es valida.", "operation");
  }
  const normalized = { operation };
  if (operation === "reassign") {
    normalized.responsibleId = requirePositiveInteger(input.responsibleId, "responsibleId", "Seleccione el nuevo responsable.");
  }
  if (operation === "reschedule") {
    normalized.dueDate = requireDate(input.dueDate, "dueDate", "Ingrese la nueva fecha de cierre.");
  }
  if (["close", "cancel"].includes(operation)) {
    normalized.justification = requireText(input.justification, "justification", "Ingrese la justificacion.", 5000);
  }
  if (operation === "close") {
    normalized.includeEvidence = input.includeEvidence === true;
    Object.assign(normalized, normalizeAttachment(input, false));
    if (normalized.includeEvidence && (!normalized.s3Key || !normalized.fileName)) {
      throw validationError("Adjunte la evidencia requerida.", "s3Key");
    }
  }
  return normalized;
}

export function normalizeLaborActionUpdate(input = {}) {
  const operation = normalizeText(input.operation, 32).toLowerCase();
  if (operation === "cancel") {
    return { operation };
  }
  return normalizeActionUpdate(input);
}

export function normalizeLaborCaseUpdate(input = {}) {
  const operation = normalizeText(input.operation, 32).toLowerCase();
  if (!["responsible", "reassign", "security", "priority", "pending", "close", "cancel"].includes(operation)) {
    throw validationError("La actualizacion del caso no es valida.", "operation");
  }
  const normalized = { operation };
  if (["responsible", "reassign"].includes(operation)) {
    normalized.responsibleId = requirePositiveInteger(input.responsibleId, "responsibleId", "Seleccione el responsable legal.");
  }
  if (operation === "security") {
    normalized.levelId = requirePositiveInteger(input.levelId, "levelId", "Seleccione el nivel de seguridad.");
  }
  if (operation === "priority") {
    normalized.priorityId = requirePositiveInteger(input.priorityId, "priorityId", "Seleccione la prioridad.");
  }
  if (["pending", "close"].includes(operation)) {
    normalized.justification = requireText(input.justification, "justification", "Ingrese la justificacion.", 5000);
  }
  if (operation === "close") {
    Object.assign(normalized, normalizeAttachment(input, false));
  }
  return normalized;
}

function normalizeComment(input = {}) {
  return {
    comment: requireText(input.comment, "comment", "Ingrese un comentario.", 5000),
    ...normalizeAttachment(input, false),
  };
}

function normalizePaging(query = {}) {
  return {
    page: positiveInteger(query.page) || 1,
    pageSize: Math.min(positiveInteger(query.pageSize) || 20, 100),
  };
}

export function normalizeIncidentFilters(query = {}) {
  return {
    ...normalizePaging(query),
    branchId: positiveInteger(query.branchId),
    typeId: positiveInteger(query.typeId),
    agencyId: positiveInteger(query.agencyId),
    motiveId: positiveInteger(query.motiveId),
    statusId: positiveInteger(query.statusId),
    startDate: normalizeDate(query.startDate),
    endDate: normalizeDate(query.endDate),
    search: normalizeText(query.search),
  };
}

export function normalizeIncidentActionFilters(query = {}) {
  return {
    ...normalizePaging(query),
    branchId: positiveInteger(query.branchId),
    responsibleId: positiveInteger(query.responsibleId),
    statusId: positiveInteger(query.statusId),
    startDate: normalizeDate(query.startDate),
    endDate: normalizeDate(query.endDate),
    dueStartDate: normalizeDate(query.dueStartDate),
    dueEndDate: normalizeDate(query.dueEndDate),
    search: normalizeText(query.search),
  };
}

export function normalizeLaborCaseFilters(query = {}) {
  return {
    ...normalizePaging(query),
    branchId: positiveInteger(query.branchId),
    levelId: positiveInteger(query.levelId),
    responsibleId: positiveInteger(query.responsibleId),
    statusId: positiveInteger(query.statusId),
    startDate: normalizeDate(query.startDate),
    endDate: normalizeDate(query.endDate),
    search: normalizeText(query.search),
    activeEmployees: !["false", "0"].includes(String(query.activeEmployees).toLowerCase()),
  };
}

export function normalizeLaborActionFilters(query = {}) {
  return {
    ...normalizePaging(query),
    actionId: positiveInteger(query.actionId),
    statusId: positiveInteger(query.statusId),
    startDate: normalizeDate(query.startDate),
    endDate: normalizeDate(query.endDate),
    search: normalizeText(query.search),
  };
}

function validateScope(scope) {
  if (!["internal", "external"].includes(scope)) {
    const error = new Error("El tipo de incidente solicitado no es valido.");
    error.status = 400;
    error.code = "INVALID_INCIDENT_SCOPE";
    throw error;
  }
}

function localDate(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function notificationResult(result, notification) {
  return { ...result, notification };
}

function successfulNotification(outcome = {}) {
  return {
    success: true,
    attempted: outcome.attempted !== false,
    sent: outcome.sent === true,
    skipped: outcome.skipped === true,
    ...(outcome.template ? { template: outcome.template } : {}),
    ...(outcome.reason ? { reason: outcome.reason } : {}),
  };
}

function skippedNotification(reason) {
  return {
    success: true,
    attempted: false,
    sent: false,
    skipped: true,
    reason,
  };
}

function failedNotification(error) {
  return {
    success: false,
    attempted: true,
    sent: false,
    skipped: false,
    code: error?.code || "NOTIFICATION_FAILED",
    message: "La operacion se guardo correctamente, pero no se pudo enviar la notificacion.",
  };
}

function notificationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function matchingLaborAction(result, { actionId, responsibleId, dueDate, id } = {}) {
  const actions = Array.isArray(result?.actions) ? [...result.actions].reverse() : [];
  return actions.find((action) => (
    (id === undefined || Number(action.id) === Number(id))
    && (actionId === undefined || Number(action.actionId) === Number(actionId))
    && (responsibleId === undefined || Number(action.responsibleId) === Number(responsibleId))
    && (dueDate === undefined
      || String(action.closeDate || action.expectedDueDate || "").slice(0, 10) === dueDate)
  )) || null;
}

export function createIncidentService(
  incidentRepository,
  { notificationService, clock = () => new Date() } = {},
) {
  async function runPostCommitNotification(result, work) {
    if (!notificationService) return result;
    try {
      return notificationResult(result, successfulNotification(await work()));
    } catch (error) {
      return notificationResult(result, failedNotification(error));
    }
  }

  return {
    listIncidents(scope, countryCode, query) {
      validateScope(scope);
      return incidentRepository.listIncidents(scope, countryCode, normalizeIncidentFilters(query));
    },

    listActions(scope, countryCode, query) {
      validateScope(scope);
      return incidentRepository.listActions(scope, countryCode, normalizeIncidentActionFilters(query));
    },

    listLaborCases(countryCode, query) {
      return incidentRepository.listLaborCases(countryCode, normalizeLaborCaseFilters(query));
    },

    listLaborActions(countryCode, userId, query) {
      return incidentRepository.listLaborActions(
        countryCode,
        positiveInteger(userId),
        normalizeLaborActionFilters(query),
      );
    },

    catalogs(scope, countryCode, query = {}) {
      if (!["internal", "external", "internal-actions", "external-actions", "labor-cases", "labor-actions", "labor-actions-legacy"].includes(scope)) {
        const error = new Error("El catalogo solicitado no es valido.");
        error.status = 400;
        error.code = "INVALID_INCIDENT_CATALOG";
        throw error;
      }
      return incidentRepository.getCatalogs(scope, countryCode, {
        branchId: positiveInteger(query.branchId),
        incidentId: positiveInteger(query.incidentId),
      });
    },

    getIncident(scope, countryCode, incidentId) {
      validateScope(scope);
      return incidentRepository.getIncident(scope, countryCode, requireIncidentId(incidentId));
    },

    async createIncident(scope, countryCode, userId, input) {
      validateScope(scope);
      const normalizedUserId = requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido.");
      const incident = normalizeIncidentInput(input);
      const result = await incidentRepository.createIncident(
        scope,
        countryCode,
        normalizedUserId,
        incident,
      );
      const automaticAction = Array.isArray(result?.actions)
        ? result.actions.find((action) => Boolean(action.isAutomatic)) || result.actions[0]
        : null;
      return runPostCommitNotification(result, async () => {
        if (!automaticAction?.responsibleId) {
          throw notificationError(
            "El incidente no contiene el responsable de la accion automatica.",
            "INCIDENT_NOTIFICATION_RECIPIENT_MISSING",
          );
        }
        return notificationService.runWorkflow("incident-reported", {
          dryRun: false,
          recipientId: automaticAction.responsibleId,
          countryCode,
          branchId: result.branchId || incident.branchId,
          startDate: String(result.visitDate || result.openingDate || incident.visitAt).slice(0, 10),
          action: result.agencyName,
          agency: result.agencyName,
          assignedById: normalizedUserId,
          assignedBy: result.registeredByName,
          branchName: result.branchName,
        });
      });
    },

    async createIncidentAction(scope, countryCode, userId, incidentId, input) {
      validateScope(scope);
      const normalizedUserId = requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido.");
      const action = normalizeIncidentActionInput(input);
      const result = await incidentRepository.createIncidentAction(
        scope,
        countryCode,
        normalizedUserId,
        requireIncidentId(incidentId),
        action,
      );
      return runPostCommitNotification(result, () => notificationService.runWorkflow("incident-action", {
        dryRun: false,
        recipientId: action.responsibleId,
        assignedById: normalizedUserId,
        countryCode,
        startDate: action.dueDate,
        action: action.name,
        branchName: result.branchName,
      }));
    },

    updateIncidentAction(scope, countryCode, userId, actionId, input) {
      validateScope(scope);
      return incidentRepository.updateIncidentAction(
        scope,
        countryCode,
        requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido."),
        requirePositiveInteger(actionId, "actionId", "La accion solicitada no es valida."),
        normalizeActionUpdate(input),
      );
    },

    closeIncident(scope, countryCode, userId, incidentId, input) {
      validateScope(scope);
      return incidentRepository.closeIncident(
        scope,
        countryCode,
        requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido."),
        requireIncidentId(incidentId),
        requireText(input?.justification, "justification", "Ingrese la justificacion de cierre.", 1024),
      );
    },

    addIncidentComment(scope, countryCode, userId, incidentId, input) {
      validateScope(scope);
      return incidentRepository.addIncidentComment(
        scope,
        countryCode,
        requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido."),
        requireIncidentId(incidentId),
        normalizeComment(input),
      );
    },

    getLaborCase(countryCode, caseId) {
      return incidentRepository.getLaborCase(countryCode, requireIncidentId(caseId, "caseId"));
    },

    async createLaborAction(countryCode, userId, caseId, input) {
      const normalizedUserId = requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido.");
      const normalizedCaseId = requireIncidentId(caseId, "caseId");
      const action = normalizeLaborActionInput(input);
      const result = await incidentRepository.createLaborAction(
        countryCode,
        normalizedUserId,
        normalizedCaseId,
        action,
      );
      if (!notificationService) return result;
      return runPostCommitNotification(result, async () => {
        const recipient = await incidentRepository.getLaborNotificationRecipient(
          countryCode,
          action.responsibleId,
        );
        if (!recipient) {
          throw notificationError(
            "No se encontro el destinatario de la accion laboral.",
            "LABOR_NOTIFICATION_RECIPIENT_MISSING",
          );
        }
        if (!recipient.isHumanResources) {
          return skippedNotification("OML_NO_NOTIFICATION_FOR_NON_HR_CREATE");
        }
        const createdAction = matchingLaborAction(result, action);
        if (!createdAction?.name) {
          throw notificationError(
            "No se encontro la accion laboral creada.",
            "LABOR_NOTIFICATION_ACTION_MISSING",
          );
        }
        return notificationService.runWorkflow("human-resources-action", {
          dryRun: false,
          recipientId: action.responsibleId,
          countryCode,
          startDate: localDate(clock),
          action: createdAction.name,
        });
      });
    },

    async updateLaborAction(countryCode, userId, actionId, input) {
      const normalizedUserId = requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido.");
      const normalizedActionId = requirePositiveInteger(actionId, "actionId", "La accion solicitada no es valida.");
      const update = normalizeLaborActionUpdate(input);
      const result = await incidentRepository.updateLaborAction(
        countryCode,
        normalizedUserId,
        normalizedActionId,
        update,
      );
      if (update.operation !== "reassign" || !notificationService) return result;
      return runPostCommitNotification(result, async () => {
        const recipient = await incidentRepository.getLaborNotificationRecipient(
          countryCode,
          update.responsibleId,
        );
        if (!recipient?.email) {
          throw notificationError(
            "No se encontro el correo del destinatario de la accion laboral.",
            "LABOR_NOTIFICATION_RECIPIENT_MISSING",
          );
        }
        const reassignedAction = matchingLaborAction(result, { id: normalizedActionId });
        if (!reassignedAction?.name) {
          throw notificationError(
            "No se encontro la accion laboral reasignada.",
            "LABOR_NOTIFICATION_ACTION_MISSING",
          );
        }
        return notificationService.runWorkflow("labor-action", {
          dryRun: false,
          to: recipient.email,
          closeDate: reassignedAction.closeDate || reassignedAction.expectedDueDate,
          assignedUser: recipient.name,
          action: reassignedAction.name,
          countryCode,
          assignedBy: result.applicantName,
          branchName: result.branchName,
        });
      });
    },

    updateLaborCase(countryCode, userId, caseId, input) {
      return incidentRepository.updateLaborCase(
        countryCode,
        requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido."),
        requireIncidentId(caseId, "caseId"),
        normalizeLaborCaseUpdate(input),
      );
    },

    addLaborComment(countryCode, userId, caseId, input) {
      return incidentRepository.addLaborComment(
        countryCode,
        requirePositiveInteger(userId, "userId", "La sesion no contiene un usuario valido."),
        requireIncidentId(caseId, "caseId"),
        normalizeComment(input),
      );
    },
  };
}
