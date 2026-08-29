const RISK_SCALE = Object.freeze([
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

const CLAUSES = Object.freeze([
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

const DETAIL_LABELS = Object.freeze({
  Found: "Encontró",
  Page: "Página",
  Section: "Sección",
  Comment: "Comentario",
  Start_date: "Fecha Inicio",
  End_date: "Fecha Final",
  Term_months: "Términos Mensuales",
  Amount_local: "Monto Local",
  Currency_local: "Currency_local",
  Amount_usd: "Monto USD",
  Fx_rate: "Tasa de Cambio",
  Fx_date: "Fecha Tasa de Cambio",
  Percent: "Porcentaje",
  Formula_text: "Formula Texto",
  Jurisdiction_text: "Jurisdicción",
  Status_as_of_2026_02_12: "Estatus",
  Registry_reference: "Referencia de Registro",
});

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function score(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10 ? number : undefined;
}

function sortDirection(value) {
  return ["ASC", "asc", "ascend"].includes(value) ? "ASC" : "DESC";
}

export function normalizeRiskFilters(query = {}) {
  return {
    page: positiveInteger(query.page) || 1,
    pageSize: Math.min(positiveInteger(query.pageSize) || 50, 500),
    societyId: positiveInteger(query.societyId),
    riskScore: score(query.riskScore),
    accuracyScore: score(query.accuracyScore),
    statusId: positiveInteger(query.statusId),
    sortBy: typeof query.sortBy === "string" ? query.sortBy : "riskScore",
    sortDirection: sortDirection(query.sortDirection),
  };
}

function normalizeAnalysis(row) {
  return {
    ...row,
    analysisId: Number(row.analysisId),
    codArchivo: Number(row.codArchivo),
    countryId: Number(row.countryId),
    societyId: Number(row.societyId),
    branchId: row.branchId === null ? null : Number(row.branchId),
    riskScore: Number(row.riskScore),
    accuracyScore: row.accuracyScore === null ? null : Number(row.accuracyScore),
    statusId: row.statusId === null ? null : Number(row.statusId),
  };
}

function detailLabel(detailKey) {
  return DETAIL_LABELS[detailKey] || detailKey;
}

export function groupRiskDetails(details = []) {
  const grouped = new Map();
  for (const detail of details) {
    if (!grouped.has(detail.clauseKey)) grouped.set(detail.clauseKey, []);
    grouped.get(detail.clauseKey).push({
      key: detail.detailKey,
      label: detailLabel(detail.detailKey),
      value: String(detail.value ?? "").trim(),
    });
  }
  return CLAUSES
    .map((clause) => ({ ...clause, fields: grouped.get(clause.key) || [] }));
}

function notFoundError() {
  const error = new Error("El análisis de riesgo solicitado no existe.");
  error.status = 404;
  error.code = "RISK_ANALYSIS_NOT_FOUND";
  return error;
}

export function createRiskService(riskRepository) {
  return {
    async list(countryCode, query) {
      const result = await riskRepository.list(countryCode, normalizeRiskFilters(query));
      return { ...result, items: result.items.map(normalizeAnalysis) };
    },

    async catalogs(countryCode) {
      const result = await riskRepository.catalogs(countryCode);
      return {
        ...result,
        riskScores: RISK_SCALE,
        accuracyScores: RISK_SCALE.map(({ value }) => ({ value })),
      };
    },

    async detail(codArchivoValue, countryCode) {
      const codArchivo = positiveInteger(codArchivoValue);
      if (!codArchivo) throw notFoundError();
      const result = await riskRepository.getByCodArchivo(codArchivo, countryCode);
      if (!result) throw notFoundError();
      return {
        ...normalizeAnalysis(result.analysis),
        clauses: groupRiskDetails(result.details),
      };
    },
  };
}

export { CLAUSES, RISK_SCALE };
