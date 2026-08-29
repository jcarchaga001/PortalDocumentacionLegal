export const AGREEMENTS_PAGE_SIZE = 50;
export const AGREEMENTS_QUERY_ERROR = "Error executing query.";
export const AGREEMENTS_EXPORT_FILE = "Convenios Clientes Corporativos.xlsx";

export const AGREEMENTS_COLUMNS = Object.freeze([
  { key: "clientName", label: "Nombre Cliente", width: 154.2 },
  { key: "accountManagerArea", label: "Sucursal", width: 125.3 },
  { key: "accountManagerName", label: "Gestor de Cuenta", width: 158.2 },
  { key: "creditLimit", label: "Límite de Crédito", width: 157.2 },
  { key: "creditDays", label: "Días de Crédito", width: 145.2 },
  { key: "hasPromissoryNote", label: "Tiene Pagaré", width: 129.6 },
  { key: "promissoryStatus", label: "Estatus Pagaré", width: 140.1 },
  { key: "startDate", label: "Fecha Inicio\nConvenio", width: 119.6 },
  { key: "endDate", label: "Fecha Final\nConvenio", width: 119.6 },
  { key: "centralized", label: "Centralizado", width: 127.8 },
  { key: "actions", label: "", width: 76 },
]);

export function buildAgreementFilters({ clientId, appliedDateRange, indefinite }, page = 1) {
  return {
    clientId: clientId || undefined,
    startDate: appliedDateRange?.[0] || undefined,
    endDate: appliedDateRange?.[1] || undefined,
    indefinite: Boolean(indefinite),
    page,
    pageSize: AGREEMENTS_PAGE_SIZE,
  };
}

export function agreementRowClassName(record = {}) {
  if (record.expirationStatus === "Vencido") return "is-expired";
  if (record.expirationStatus === "Por Vencer") return "is-expiring";
  return "";
}

export function formatAgreementCurrency(value, isDollar, currencySymbol = "") {
  const amount = Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = isDollar ? "US $ " : currencySymbol ? `${currencySymbol} ` : "";
  return `${prefix}${amount}`;
}

export function agreementPromissoryStatus(record = {}) {
  if (!record.hasPromissoryNote) return "";
  return record.isPromissoryNoteExpired ? "Vencido" : "En Vigencia";
}

export function agreementEndDate(record = {}) {
  return record.isIndefinite ? "Indefinido" : (record.endDate || "");
}

export function agreementPaginationSummary(page, pageSize, rowCount, total) {
  if (!rowCount || !total) return "";
  const first = (page - 1) * pageSize + 1;
  return `${first} to ${first + rowCount - 1} of ${total} items`;
}

