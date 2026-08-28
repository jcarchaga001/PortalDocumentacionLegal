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
  }),
});

export function getLaborCaseSurface(legacy = false) {
  return legacy ? LABOR_CASE_SURFACES.legacy : LABOR_CASE_SURFACES.current;
}
