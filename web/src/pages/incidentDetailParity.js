export const INCIDENT_DETAIL_QUERY_ERROR = "Error executing query.";

export const INCIDENT_DETAIL_DATA_SOURCES = Object.freeze({
  aggregates: Object.freeze([
    "GetTblAccionesIncidentesByCodigoIncidente",
    "GetEstados",
    "GetAccionSeleccionada",
    "GetIncidente",
  ]),
  dataActions: Object.freeze(["GetPersonasAcciones"]),
});

export const INCIDENT_DETAIL_CONTROLS = Object.freeze([
  { key: "Rlrl51R+6E+dFdSVUyiXPw", name: "Regresar", action: "PreviousScreen" },
  { key: "I3jPH9RQ4UqtiJaVlYeAAg", name: "Estado incidente", action: "PopCerrarIncidentesOnClick" },
  { key: "sdaq2yCTZkWt_BkHsCAT1A", name: "Descargar Archivo...", action: "DescargarOnClick" },
  { key: "WAXzepHzq0Srae5C35Ii8g", name: "+ Nueva acción", action: "NuevaAccionOnClick" },
  { key: "bB5R0uuq00yj1R7c_eEerg", name: "Nombre Acción", action: "DetalleAccionOnClick" },
  { key: "4n8cn_05jkKQNVXOUzvutA", name: "IniciaAccion", action: "EjecutarAccionOnClick", legacyType: 5 },
  { key: "KigIWRDkiU6mQuc2NFK5Og", name: "CerrarAccion", action: "EjecutarAccionOnClick", legacyType: 1 },
  { key: "QqiaKYJsuUCclABQLq3Dsg", name: "ReasignarUsuario", action: "EjecutarAccionOnClick", legacyType: 2 },
  { key: "lP16r1q+HkSwyFZKIDd8nw", name: "ReasignarFecha", action: "EjecutarAccionOnClick", legacyType: 4 },
  { key: "PD5aiCMxjUK7F_zUZ4BAHA", name: "AnularAccion", action: "EjecutarAccionOnClick", legacyType: 3 },
  { key: "c5F0V9CM90i+vWunfHG_6A", name: "Cerrar NuevaAccion", action: "CerrarPopOnClick" },
  { key: "JXGmFX_cNkKE_6eDUVcEtA", name: "Guardar nueva acción", action: "GuardarOnClick" },
  { key: "VLPchNpz7kG+c6pCjBzUPA", name: "Cerrar Popup", action: "CerrarPopOnClick" },
  { key: "kezdZIe+dUiLP+5SkYU9nw", name: "Actualizar cierre", action: "ActualizarOnClick", legacyType: 1 },
  { key: "7mMnP29_6kiel9fw+0C11w", name: "Cerrar ppCerrar", action: "CerrarPopOnClick" },
  { key: "1a0BggygL0q5TAn47yEB9w", name: "Actualizar responsable", action: "ActualizarOnClick", legacyType: 2 },
  { key: "QZ+RRS1wMUyiFYoBIEgpXw", name: "Cerrar ppReasignar", action: "CerrarPopOnClick" },
  { key: "PjB20m0edkm5iGaozRHoMQ", name: "Actualizar anulación", action: "ActualizarOnClick", legacyType: 3 },
  { key: "yEdJs3TwTUConlNGPR6Sbw", name: "Cerrar ppReasignarFecha", action: "CerrarPopOnClick" },
  { key: "3eHqRnfTpU+4oSfTa68Y_A", name: "Actualizar fecha", action: "ActualizarOnClick", legacyType: 4 },
  { key: "pmbLXKuCYUu44A_qKfS_rw", name: "Cerrar ppCerrarIncidente", action: "CerrarPopOnClick" },
  { key: "1ku5Lr9BBkmewiW66lM0lQ", name: "Cerrar incidente", action: "CerrarIncidenteOnClick" },
  { key: "2v25EId8Fkuq1EKZ9TPcTg", name: "Cerrar detalle acción", action: "CloseOnClick" },
  { key: "Dhs4UKDYiUSX84cgzx+W7w", name: "Descargar evidencia acción", action: "DescargarOnClick" },
]);

export const INCIDENT_DETAIL_GEOMETRY = Object.freeze({
  viewport: Object.freeze({ width: 1280, height: 720, dpr: 1.25 }),
  card: Object.freeze({ x: 40, y: 218.4, width: 1184.8, height: 459.8 }),
  actionTable: Object.freeze({ x: 40, y: 762, width: 1184.8, headerHeight: 48, rowHeight: 56 }),
  actionColumns: Object.freeze([190.0125, 315.65, 154.5, 149.425, 153.875, 168.7875, 50.95]),
  actionSidebarWidth: "30%",
});

export function incidentDetailDisplay(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function formatLegacyIncidentTimestamp(value) {
  if (!value) return "";
  const text = String(value);
  const match = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:\d{2})/.exec(text);
  return match ? `${match[1]} ${match[2]}` : text;
}

export function formatLegacyIncidentDate(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ""));
  return match ? match[1] : incidentDetailDisplay(value);
}

export function incidentDetailQueryFeedback(detailResult, catalogResult) {
  if (catalogResult?.error?.code === "INCIDENT_ACTION_QUERY_ERROR") {
    return INCIDENT_DETAIL_QUERY_ERROR;
  }
  if (!detailResult?.success) {
    return detailResult?.message || "No fue posible consultar el incidente.";
  }
  return "";
}

export function incidentDetailVisibleActions(statusId) {
  return {
    newAction: Number(statusId) !== 5,
    startAction: Number(statusId) === 1,
    closeAction: true,
    reassignUser: true,
    reassignDate: true,
    cancelAction: true,
  };
}

export function canOpenIncidentDetailActionMenu(row, user) {
  const userId = Number(user?.id);
  const responsibleId = Number(row?.responsibleId);
  const statusId = Number(row?.statusId);
  if (!Number.isInteger(userId) || userId <= 0) return false;
  if ([3, 5].includes(statusId)) return false;
  return userId === 1 || responsibleId === userId;
}
