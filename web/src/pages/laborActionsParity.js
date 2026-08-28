export const LABOR_ACTION_SCREEN_CONTRACT = Object.freeze({
  sourceName: "srcMisAccionesCasosLaborales",
  pageSize: 50,
  terminalStatusIds: Object.freeze([3, 5]),
  connectedOperations: Object.freeze(["start", "close", "cancel", "reassign", "reschedule"]),
  hiddenOperations: Object.freeze(["reassign", "reschedule"]),
});

export const LABOR_ACTION_MESSAGES = Object.freeze({
  incomplete: "Completar los campos",
  evidenceRequired: "Adjuntar documento",
  invalidEvidence: "La extención del Archivo no es Valido. (Solo permite .PNG o .JPEG y PDF)",
  updated: "Se ha actualizado el estado",
});

const OPERATION_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "start", label: "Iniciar Acción", visible: ({ statusId }) => Number(statusId) === 1 }),
  Object.freeze({ key: "close", label: "Cerrar Acción", visible: () => true }),
  Object.freeze({ key: "cancel", label: "Anular Acción", visible: () => true }),
  // Ambos controles conservan un evento conectado en el OML, pero Visible=False es literal.
  Object.freeze({ key: "reassign", label: "Reasignar Responsable", visible: () => false }),
  Object.freeze({ key: "reschedule", label: "Reasignar Fecha", visible: () => false }),
]);

export function canOpenLaborActionMenu(row, user) {
  const userId = Number(user?.id);
  const responsibleId = Number(row?.responsibleId);
  const statusId = Number(row?.statusId);
  if (!Number.isInteger(userId) || userId <= 0) return false;
  if (LABOR_ACTION_SCREEN_CONTRACT.terminalStatusIds.includes(statusId)) return false;
  return userId === 1 || responsibleId === userId;
}

export function buildLaborActionMenuItems(row, user) {
  if (!canOpenLaborActionMenu(row, user)) return [];
  return [
    { key: "title", label: "Opciones de Acción", disabled: true },
    ...OPERATION_DEFINITIONS
      .filter(({ visible }) => visible(row || {}))
      .map(({ key, label }) => ({ key, label })),
  ];
}

export function formatLaborActionCloseDate(value) {
  if (!value || String(value).startsWith("1900-01-01")) return "Sin Fecha Asignada";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

export function isAcceptedLaborActionEvidence(fileName) {
  const extension = String(fileName || "").trim().split(".").pop()?.toLowerCase();
  return ["png", "jpeg", "jpg", "pdf"].includes(extension);
}

export function actionHistoryFor(detail, actionId) {
  return (detail?.actionHistory || []).filter((entry) => Number(entry.actionId) === Number(actionId));
}
