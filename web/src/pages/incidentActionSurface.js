export const INCIDENT_ACTION_TYPE_OPERATION = Object.freeze({
  1: "cancel",
  2: "close",
  3: "reassign",
  4: "reschedule",
  5: "start",
});

// El runtime legacy observado el 2026-08-28 expone este feedback cuando falla
// el Aggregate de acciones. Es un contrato del error, no el estado permanente
// de la pantalla: una consulta local exitosa debe conservar sus filas.
export const LEGACY_INCIDENT_ACTION_QUERY_FAILURE = Object.freeze({
  code: "INCIDENT_ACTION_QUERY_ERROR",
  message: "Error executing query.",
  persistent: true,
});

const operationDefinitions = Object.freeze([
  { type: 5, operation: "start", label: "Iniciar Acción" },
  { type: 1, operation: "cancel", label: "Anular Acción" },
  { type: 2, operation: "close", label: "Cerrar Acción" },
  { type: 3, operation: "reassign", label: "Reasignar Responsable" },
  { type: 4, operation: "reschedule", label: "Reasignar Fecha" },
]);

export const INCIDENT_ACTION_SURFACES = Object.freeze({
  internal: Object.freeze({
    sourceName: "scrMisAccionesInternoVisita",
    external: false,
    incidentPredicate: "not tblIncidentesExternos.isExterno",
    referenceDetail: false,
    detailAction: null,
  }),
  external: Object.freeze({
    sourceName: "scrMisAccionesExternos",
    external: true,
    incidentPredicate: "tblIncidentesExternos.isExterno",
    referenceDetail: true,
    detailAction: "OnClick",
  }),
});

export function getIncidentActionSurface(scope) {
  return scope === "external" ? INCIDENT_ACTION_SURFACES.external : INCIDENT_ACTION_SURFACES.internal;
}

export function getIncidentActionMenu({ statusId, canMutate = true } = {}) {
  const normalizedStatus = Number(statusId);
  const terminal = [3, 5].includes(normalizedStatus);

  return operationDefinitions.map((item) => ({
    key: item.operation,
    label: item.label,
    legacyType: item.type,
    hidden: item.operation === "start" && normalizedStatus !== 1,
    disabled: !canMutate || terminal,
  })).filter((item) => !item.hidden);
}

export function incidentActionModalTitle(operation) {
  return {
    cancel: "Anular Acción",
    close: "Cerrar Acción",
    reassign: "Reasignar Responsable",
    reschedule: "Reasignar Fecha",
  }[operation] || "Actualizar Acción";
}

export function isIncidentActionQueryFailure(errorCode) {
  return errorCode === LEGACY_INCIDENT_ACTION_QUERY_FAILURE.code;
}

export function incidentActionQueryErrorMessage(errorCode) {
  return isIncidentActionQueryFailure(errorCode)
    ? LEGACY_INCIDENT_ACTION_QUERY_FAILURE.message
    : "";
}

export function getIncidentActionQueryPresentation({
  rows = [],
  loading = false,
  pagination,
  errorCode = "",
} = {}) {
  const queryFailed = isIncidentActionQueryFailure(errorCode);
  return {
    rows: queryFailed ? [] : rows,
    loading: queryFailed ? false : loading,
    pagination: queryFailed ? false : pagination,
    showError: queryFailed,
    errorMessage: incidentActionQueryErrorMessage(errorCode),
  };
}

export async function runIncidentActionOperation({
  scope,
  row,
  operation,
  values = {},
  evidenceFile,
  uploadEvidence,
  updateAction,
}) {
  if (!row?.id || typeof updateAction !== "function") {
    throw new Error("La acción seleccionada no es válida.");
  }

  let attachment = {};
  if (operation === "close") {
    if (!evidenceFile) {
      return { success: false, field: "evidence", message: "Adjunte la evidencia de cierre." };
    }
    const upload = await uploadEvidence(evidenceFile, {
      scope,
      incidentId: String(row.incidentId),
      actionId: String(row.id),
    });
    if (!upload.success) return upload;
    attachment = { ...upload.data, includeEvidence: true };
  }

  return updateAction(scope, row.id, {
    operation,
    ...values,
    ...attachment,
  });
}
