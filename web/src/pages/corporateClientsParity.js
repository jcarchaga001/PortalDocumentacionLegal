export const CORPORATE_CLIENT_PAGE_SIZE = 50;
export const CORPORATE_CLIENT_TABLE_WIDTH = 1946.6125;
export const CORPORATE_CLIENT_EMPTY_TEXT = "No hay datos para mostrar...";
export const CORPORATE_CLIENT_QUERY_ERROR = "Error executing query.";

export const CORPORATE_CLIENT_COLUMNS = Object.freeze([
  Object.freeze({ key: "faCode", label: "Codigo FA", width: 123.475 }),
  Object.freeze({ key: "name", label: "Nombre Cliente", width: 458.275 }),
  Object.freeze({ key: "contactName", label: "Nombre Contacto", width: 244.2 }),
  Object.freeze({ key: "contactPosition", label: "Puesto Contacto", width: 338.025 }),
  Object.freeze({ key: "contactPhone", label: "Teléfono Contacto", width: 163.975 }),
  Object.freeze({ key: "contactEmail", label: "Correo Contacto", width: 311.1 }),
  Object.freeze({ key: "isActive", label: "Cliente Activo", width: 135.9375 }),
  Object.freeze({ key: "actions", label: "", width: 170.025 }),
]);

export function corporateClientActiveLabel(value) {
  return value ? "Sí" : "No";
}

export function corporateClientPaginationPages(total, pageSize = CORPORATE_CLIENT_PAGE_SIZE) {
  const pageCount = Math.ceil(Math.max(0, Number(total) || 0) / pageSize);
  return Array.from({ length: pageCount }, (_, index) => index + 1);
}

export function corporateClientPaginationSummary(page, total, pageSize = CORPORATE_CLIENT_PAGE_SIZE) {
  const normalizedTotal = Math.max(0, Number(total) || 0);
  if (normalizedTotal === 0) return "0 to 0 of 0 items";
  const normalizedPage = Math.max(1, Number(page) || 1);
  const first = ((normalizedPage - 1) * pageSize) + 1;
  const last = Math.min(normalizedPage * pageSize, normalizedTotal);
  return `${first} to ${last} of ${normalizedTotal} items`;
}
