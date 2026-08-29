const CURRENT_ONLY_CLIENT_ACTIONS = Object.freeze([
  "AceptarCambioEstadoOnClick",
  "GetPersonasAccionesOnAfterFetch",
  "CerrarPopupJustificacionOnClick",
  "CancelarCasoOnClick",
]);

export const LABOR_CASE_SURFACES = Object.freeze({
  current: Object.freeze({
    sourceName: "srcAccionesIncidentesLegal",
    catalogScope: "labor-actions",
    dataSources: Object.freeze(["GetChatByCaso", "GetPersonasAcciones", "GetPersonasLegal"]),
    currentOnlyClientActions: CURRENT_ONLY_CLIENT_ACTIONS,
    showRegistrationDate: true,
    showCurrentCaseFields: true,
    showResponsibleEditor: true,
    showCaseThread: true,
    allowPendingInformation: true,
    rootClassName: "labor-case-surface-current",
    actionHistoryMode: "modal",
    evidenceMode: "text",
    emptyAttachmentsText: "No hay documentos adjuntos.",
    actionColumnWidths: Object.freeze([169, 146, 153, 198, 168, 124, 144, 80]),
  }),
  legacy: Object.freeze({
    sourceName: "srcAccionesIncidentesLegal_OLD",
    catalogScope: "labor-actions-legacy",
    dataSources: Object.freeze(["GetResponsables", "GetPersonasReasignar"]),
    currentOnlyClientActions: Object.freeze([]),
    showRegistrationDate: false,
    showCurrentCaseFields: false,
    showResponsibleEditor: false,
    showCaseThread: false,
    allowPendingInformation: false,
    rootClassName: "labor-case-surface-old",
    actionHistoryMode: "inline",
    evidenceMode: "icon",
    emptyAttachmentsText: "No hay Evidencias Adjuntadas",
    actionColumnWidths: Object.freeze([165.15, 144.075, 146.575, 143.8375, 168, 200, 145.15, 80.0125]),
  }),
});

export function getLaborCaseSurface(legacy = false) {
  return legacy ? LABOR_CASE_SURFACES.legacy : LABOR_CASE_SURFACES.current;
}
