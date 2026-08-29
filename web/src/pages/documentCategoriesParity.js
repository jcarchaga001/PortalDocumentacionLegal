export const DOCUMENT_CATEGORY_PAGE_SIZE = 500;
export const DOCUMENT_CATEGORY_EMPTY_TEXT = "No hay datos para mostrar...";
export const DOCUMENT_CATEGORY_QUERY_ERROR = "Error executing query.";
export const DOCUMENT_CATEGORY_SUCCESS = "¡Registro Completado!";

export const DOCUMENT_CATEGORY_COLUMNS = Object.freeze([
  Object.freeze({ key: "categoryName", label: "Categoría", align: "center" }),
  Object.freeze({ key: "subcategoryName", label: "Subcategoría", align: "left" }),
  Object.freeze({ key: "required", label: "Obligatorio", align: "center" }),
  Object.freeze({ key: "branchDocument", label: "Es Documento", align: "center" }),
  Object.freeze({ key: "accessAllowed", label: "Acceso Permitido", align: "center" }),
]);

export function isCategoryAccessAllowed(value) {
  return value === true || value === 1 || value === "1";
}

export function categoryAccessActionFor(value) {
  if (isCategoryAccessAllowed(value)) {
    return {
      allowed: true,
      nextAllowed: false,
      description: "Deshabilitó Subcategoría",
      infoMessage: "False",
      icon: "fa-check",
      color: "#228700",
      tooltip: "Inhabilitar",
    };
  }
  return {
    allowed: false,
    nextAllowed: true,
    description: "Habilitó Subcategoría",
    infoMessage: "True",
    icon: "fa-ban",
    color: "#f70000",
    tooltip: "Habilitar",
  };
}

export function paginationSummary(page, pageSize, total) {
  const normalizedTotal = Math.max(0, Number(total) || 0);
  if (normalizedTotal === 0) return "0 to 0 of 0 items";
  const normalizedPageSize = Math.max(1, Number(pageSize) || DOCUMENT_CATEGORY_PAGE_SIZE);
  const maxPage = Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize));
  const normalizedPage = Math.min(maxPage, Math.max(1, Number(page) || 1));
  const first = ((normalizedPage - 1) * normalizedPageSize) + 1;
  const last = Math.min(normalizedPage * normalizedPageSize, normalizedTotal);
  return `${first} to ${last} of ${normalizedTotal} items`;
}

export function paginationPages(total, pageSize = DOCUMENT_CATEGORY_PAGE_SIZE) {
  const count = Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(pageSize) || 1));
  return Array.from({ length: count }, (_, index) => index + 1);
}
