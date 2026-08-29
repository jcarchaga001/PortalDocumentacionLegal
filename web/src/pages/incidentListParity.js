const COMMON_DATASETS = Object.freeze([
  "GetIncidentes",
  "GetIncidentesDescargaExcel",
  "GetEstados",
  "GetMotivoIncidente",
  "GetSucursales",
  "GetEntesRegulatorios",
]);

const COMMON_CLIENT_ACTIONS = Object.freeze([
  "GetIncidentesOnAfterFetch",
  "OnPaginationNavigate",
  "SucursalOnChanged",
  "EstadosOnChanged",
  "Filter_RangoFechasOnSelected",
  "MotivoIncidenteOnChanged",
  "DropdownSearchOnChanged",
  "DescargarArchivoExcelOnClick",
]);

const COMMON_FILTERS = Object.freeze([
  Object.freeze({ label: "Sucursal:", name: "branchId", placeholder: "Seleccione Sucursal" }),
  Object.freeze({ label: "Fecha Apertura:", name: "dateRange" }),
  Object.freeze({ label: "Ente Regulatorio:", name: "agencyId", placeholder: "Seleccione..." }),
  Object.freeze({ label: "Motivo Incidente:", name: "motiveId", placeholder: "Seleccione Motivo de Incidente" }),
  Object.freeze({ label: "Estado:", name: "statusId", placeholder: "Seleccione Estado" }),
]);

export const INCIDENT_LIST_PAGE_SIZE = 50;

export const INCIDENT_LIST_SURFACES = Object.freeze({
  internal: Object.freeze({
    screen: "srcIncidentesInternoVisita",
    screenKey: "c28tWPvVekCsc2N6yxvCtA",
    role: "Registered",
    title: "Control de Incidentes Internos",
    catalogScope: "internal-list",
    createRoute: "scrRegistroIncidentesInternos",
    detailRoute: "scrAccionesIncidentes",
    agencyColumn: "Area",
    datasets: COMMON_DATASETS,
    clientActions: COMMON_CLIENT_ACTIONS,
    filters: COMMON_FILTERS,
    columnWidths: Object.freeze([165.4625, 132.575, 196.425, 130.025, 185.25, 195.8375, 125.95, 66.875]),
    controlKeys: Object.freeze({
      create: "cT2OsKJNt02q12qRROLpDw",
      export: "zVsccHXQk0O6ZuIQZuL0Hg",
      detail: "uPUC2bKy7UC5GtL7GlDNTA",
      cancelPopup: "aUok0ibcH0a_+LJGFPklgg",
      savePopup: "Hm3BdCliHESM+6Xr_se35A",
    }),
    queryContract: Object.freeze({ externalFilter: "not isExterno", sort: "FechaApertura ASC" }),
  }),
  external: Object.freeze({
    screen: "srcIncidentesExternos",
    screenKey: "DWv6ojtkeUqHfIhlYW252w",
    role: "Registered",
    title: "Control de Incidentes Externos",
    catalogScope: "external-list",
    createRoute: "scrRegistroIncicentesExternos",
    detailRoute: "scrAccionesIncidentes",
    agencyColumn: "Ente Gubernamental",
    datasets: COMMON_DATASETS,
    clientActions: COMMON_CLIENT_ACTIONS,
    filters: COMMON_FILTERS,
    columnWidths: Object.freeze([132.75, 198.3625, 147.875, 108.325, 157.9375, 286.0875, 105.025, 62.0375]),
    controlKeys: Object.freeze({
      create: "xWjCU+vu5kOlvnONRFp5bg",
      export: "R1cEE0Sm4EqrduZjwIRyvw",
      detail: "rwvWw28jyk+ZNS_smPsd_w",
      cancelPopup: "2uHLmTFivkukuiMQdN1n_Q",
      savePopup: "UPwNfnhcHkyiBvm6Z5bVzg",
    }),
    // El Aggregate legacy no contiene condición isExterno en esta superficie.
    queryContract: Object.freeze({ externalFilter: null, sort: "FechaApertura ASC" }),
  }),
});

export const INCIDENT_LIST_METRICS = Object.freeze([
  Object.freeze({ key: "open", label: "Abiertos", icon: "fa-folder-open", className: "is-open" }),
  Object.freeze({ key: "inProgress", label: "En Ejecución", icon: "fa-play", className: "is-progress" }),
  Object.freeze({ key: "paused", label: "En Pausa", icon: "fa-pause", className: "is-paused" }),
  Object.freeze({ key: "closed", label: "Cerrados", icon: "fa-star", className: "is-closed" }),
]);

export function incidentListMetrics(rows = []) {
  return rows.reduce((metrics, row) => {
    const key = { 1: "open", 2: "inProgress", 4: "paused", 5: "closed" }[Number(row.statusId)];
    if (key) metrics[key] += 1;
    return metrics;
  }, { open: 0, inProgress: 0, paused: 0, closed: 0 });
}

export function formatIncidentListDate(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    if (match) return `${match[1]} ${match[2]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const part = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
}

export function incidentListStatusClass(statusId) {
  return {
    1: "is-open",
    2: "is-progress",
    4: "is-paused",
    5: "is-closed",
  }[Number(statusId)] || "is-default";
}

export function incidentListPaginationSummary({ current = 1, pageSize = INCIDENT_LIST_PAGE_SIZE, total = 0, rowCount = 0 } = {}) {
  const safeTotal = Number(total || 0);
  if (!safeTotal || !rowCount) return "";
  const first = ((Number(current) - 1) * Number(pageSize)) + 1;
  const last = Math.min(first + Number(rowCount) - 1, safeTotal);
  return `${first} to ${last} of ${safeTotal} items`;
}
