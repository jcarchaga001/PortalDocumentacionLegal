export const RISK_PAGE_SIZE = 50;

export const RISK_QUERY_ERROR = "Error executing query.";

export const RISK_SCORE_OPTIONS = Object.freeze([
  { value: 1, description: "Muy bajo" },
  { value: 2, description: "Bajo" },
  { value: 3, description: "Bajo-Moderado" },
  { value: 4, description: "Moderado-Bajo" },
  { value: 5, description: "Moderado" },
  { value: 6, description: "Moderado-Alto" },
  { value: 7, description: "Alto" },
  { value: 8, description: "Muy Alto" },
  { value: 9, description: "Crítico" },
  { value: 10, description: "Máximo" },
]);

export const RISK_CLAUSE_TITLES = Object.freeze([
  { key: "early_exit_favorable", title: "Favorable" },
  { key: "early_exit_penalty", title: "Penalidad" },
  { key: "contract_duration", title: "Duración" },
  { key: "auto_renewal", title: "Renovación" },
  { key: "rent", title: "Renta" },
  { key: "annual_increase", title: "Incremento Anual" },
  { key: "insurance_obligation", title: "Seguros" },
  { key: "jurisdiction", title: "Jurisdicción" },
  { key: "public_registry", title: "Registro Público" },
]);

export const RISK_DETAIL_LABELS = Object.freeze({
  Found: "Encontró",
  Page: "Página",
  Section: "Sección",
  Comment: "Comentario",
  Start_date: "Fecha Inicio",
  End_date: "Fecha Final",
  Term_months: "Términos Mensuales",
  Status_as_of_2026_02_12: "Estatus",
  Amount_local: "Monto Local",
  Currency_local: "Currency_local",
  Amount_usd: "Monto USD",
  Fx_rate: "Tasa de Cambio",
  Fx_date: "Fecha Tasa de Cambio",
  Percent: "Porcentaje",
  Formula_text: "Formula Texto",
  Jurisdiction_text: "Jurisdicción",
  Registry_reference: "Referencia de Registro",
});

export function compactRiskScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "";
}

export function legacyRiskStatusTone(statusName) {
  if (statusName === "Vigente") return "green";
  if (statusName === "Vencido") return "red";
  return "neutral";
}

export function nextLegacyRiskSort(current, sortBy) {
  if (current?.sortBy === sortBy && current?.sortDirection === "ASC") {
    return { sortBy, sortDirection: "DESC" };
  }
  return { sortBy, sortDirection: "ASC" };
}

export function legacyRiskCounter(page, pageSize, total) {
  if (!total) return "0 to 0 of 0 items";
  const start = ((page - 1) * pageSize) + 1;
  const end = Math.min(page * pageSize, total);
  return `${start} to ${end} of ${total} items`;
}
