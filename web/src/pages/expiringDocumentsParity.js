export const EXPIRING_DOCUMENT_PAGE_SIZE = 50;

// Columnas que el TableRecords de scrProximosVencer marca como ordenables.
// El Aggregate no enlaza TableSort, por lo que el servidor conserva siempre
// OrdenSucursal; estas claves sirven para reproducir el indicador y el evento.
export const EXPIRING_DOCUMENT_SORT_KEYS = Object.freeze([
  "branchName",
  "reference",
  "providerCode",
  "categoryName",
  "subcategoryName",
  "documentDate",
  "expirationDate",
]);

export const EXPIRING_QUERY_ERROR = "Error executing query.";
export const EXPIRING_ATTACHMENT_DOWNLOAD_NAME = "_.zip";

export function expiringDocumentFilters(values = {}, sorting = {}) {
  const dates = values.dates || [];
  return {
    surface: "expiring",
    branchId: values.branchId,
    startDate: dates[0] || undefined,
    endDate: dates[1] || undefined,
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId,
    search: values.search,
    sortBy: sorting.sortBy,
    sortDirection: sorting.sortDirection,
  };
}

export function expiringTableChange(nextPagination, sorter, action) {
  const sorting = action === "sort"
    ? {
        sortBy: sorter?.columnKey,
        sortDirection: sorter?.order,
      }
    : undefined;
  return {
    sorting,
    page: action === "sort" ? 1 : nextPagination.current,
    pageSize: nextPagination.pageSize || EXPIRING_DOCUMENT_PAGE_SIZE,
  };
}

export function expiringPaginationTotal(total, range = []) {
  return `${range[0] || 0} to ${range[1] || 0} of ${total || 0} items`;
}

export function expiringLevelClass(levelName) {
  if (levelName === "Público") return "is-level-public";
  if (levelName === "Privado") return "is-level-private";
  return "";
}

export function hasExpiringAttachmentAction(record) {
  return Number(record?.attachmentId) > 0;
}
