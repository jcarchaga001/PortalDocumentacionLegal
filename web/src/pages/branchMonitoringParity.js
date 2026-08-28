export const BRANCH_MONITORING_COLORS = Object.freeze({
  complete: "#37b24d",
  incomplete: "#c92a2a",
  trail: "#dee2e6",
  registeredText: "#13b018",
  expiringText: "#d76d03",
});

export const BRANCH_MONITORING_TOOLTIPS = Object.freeze({
  required: "Total de Documentos Requeridos",
  registered: "Total Documentos Registrados / Total Requeridos",
  expiring: "Documentación Proximas a vecer",
  other: "Documentos no Requeridos",
});

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratioPercent(value, total) {
  const normalizedTotal = number(total);
  if (normalizedTotal <= 0) return 0;
  return Math.max(0, Math.min(100, (number(value) / normalizedTotal) * 100));
}

function legacyPercentText(rawPercent) {
  return `${Math.round(rawPercent)}%`;
}

export function branchMonitoringMetrics(branch = {}) {
  const required = number(branch.required);
  const registered = number(branch.registered);
  const expiring = number(branch.expiring);
  const registeredRawPercent = ratioPercent(registered, required);
  const expiringRawPercent = ratioPercent(expiring, required);

  return {
    required,
    registered,
    expiring,
    other: number(branch.other),
    registeredRawPercent,
    registeredAriaValue: Math.trunc(registeredRawPercent),
    registeredText: legacyPercentText(registeredRawPercent),
    expiringText: legacyPercentText(expiringRawPercent),
    progressColor: registeredRawPercent === 100
      ? BRANCH_MONITORING_COLORS.complete
      : BRANCH_MONITORING_COLORS.incomplete,
  };
}

export function monitoringCatalogOptions(items = []) {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

export function updateMonitoringFilter(filters = {}, name, value) {
  return { ...filters, [name]: value };
}

export function monitoringQueryErrorMessage() {
  return "Error executing query.";
}
