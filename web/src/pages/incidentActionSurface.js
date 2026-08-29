export const INCIDENT_ACTION_TYPE_OPERATION = Object.freeze({
  1: "close",
  2: "reassign",
  3: "cancel",
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
  { type: 5, operation: "start", label: "Iniciar Acción", icon: "check-square", color: "#1bd80d" },
  { type: 1, operation: "close", label: "Cerrar Acción", icon: "check-square", color: "#1bd80d" },
  { type: 2, operation: "reassign", label: "Reasignar Usuario", icon: "users", color: "#0a7abf" },
  { type: 4, operation: "reschedule", label: "Reasignar Fecha Entrega", icon: "calendar", color: "#3a454c" },
  { type: 3, operation: "cancel", label: "Anular Acción", icon: "ban", color: "#ac0c04" },
]);

export const INCIDENT_ACTION_SURFACES = Object.freeze({
  internal: Object.freeze({
    sourceName: "scrMisAccionesInternoVisita",
    external: false,
    incidentPredicate: "not tblIncidentesExternos.isExterno",
    referenceDetail: false,
    detailAction: null,
    title: "Acciones Incidentes Internos",
    controlCount: 18,
  }),
  external: Object.freeze({
    sourceName: "scrMisAccionesExternos",
    external: true,
    incidentPredicate: "tblIncidentesExternos.isExterno",
    referenceDetail: true,
    detailAction: "OnClick",
    title: "Acciones Incidentes Externos",
    controlCount: 19,
  }),
});

export function getIncidentActionSurface(scope) {
  return scope === "external" ? INCIDENT_ACTION_SURFACES.external : INCIDENT_ACTION_SURFACES.internal;
}

export function getIncidentActionMenu({ statusId, canMutate = true } = {}) {
  const normalizedStatus = Number(statusId);
  if ([3, 5].includes(normalizedStatus)) return [];

  return operationDefinitions.map((item) => ({
    key: item.operation,
    label: item.label,
    legacyType: item.type,
    icon: item.icon,
    color: item.color,
    hidden: item.operation === "start" && normalizedStatus !== 1,
    disabled: !canMutate,
  })).filter((item) => !item.hidden);
}

export function incidentActionModalTitle(operation) {
  return {
    cancel: "Anular Acción",
    close: "Cerrar Acción",
    reassign: "Reasignar Usuario",
    reschedule: "Reasignar Fecha Entrega",
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
    // OutSystems conserva los Aggregate/DataAction ya resueltos cuando otra
    // consulta de la pantalla falla. En el runtime externo el toast convive
    // con una fila; el error no es un estado vacío global.
    rows,
    loading: queryFailed ? false : loading,
    pagination,
    showError: queryFailed,
    errorMessage: incidentActionQueryErrorMessage(errorCode),
  };
}

const englishShortMonths = Object.freeze([
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]);

export function formatLegacyActionDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) return value || "—";
  return `${Number(match[3])} ${englishShortMonths[Number(match[2]) - 1]} ${match[1]}`;
}

export function compareIncidentActionRows(field) {
  return (left, right) => String(left?.[field] ?? "").localeCompare(
    String(right?.[field] ?? ""),
    "es",
    { numeric: true, sensitivity: "base" },
  );
}

export function legacyIncidentActionFooterText(rows = [], selectedActionId = 0) {
  const initializedRow = rows.at(-1);
  return `${Number(initializedRow?.incidentTypeId || 0)} __ ${Number(selectedActionId || 0)}___${Number(initializedRow?.branchId || 0)}`;
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
