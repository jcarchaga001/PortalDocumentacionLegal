export const ADMINISTRATIVE_HISTORY_PAGE_SIZE = 50;
export const ADMINISTRATIVE_HISTORY_EXPORT_MAX_ROWS = 10000;
export const ADMINISTRATIVE_HISTORY_MIN_TABLE_WIDTH = 1725.83;
export const ADMINISTRATIVE_HISTORY_QUERY_ERROR = "Error executing query.";

// Proporciones medidas sobre los 1,863.2 px utiles de la tabla legacy a
// 1920x1080. Se conservan como porcentajes para que el ancho adicional se
// distribuya igual cuando cambia el viewport.
export const ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS = Object.freeze([
  "7.380448%",
  "7.246270%",
  "8.318350%",
  "10.969703%",
  "6.835686%",
  "10.956285%",
  "9.778875%",
  "9.945255%",
  "8.524984%",
  "8.524984%",
  "5.927302%",
  "5.591858%",
]);

export const ADMINISTRATIVE_HISTORY_SORT_FIELDS = Object.freeze({
  branchName: "branchName",
  reference: "reference",
  providerId: "providerId",
  categoryName: "categoryName",
  subcategoryName: "subcategoryName",
  documentDate: "documentDate",
  expirationDate: "expirationDate",
});

export function legacyAdministrativeHistorySort(sorter) {
  const selected = Array.isArray(sorter)
    ? sorter.find((candidate) => candidate?.order)
    : sorter;
  const field = selected?.columnKey || selected?.field;
  const sortBy = ADMINISTRATIVE_HISTORY_SORT_FIELDS[field];
  if (!sortBy || !selected?.order) return {};
  return { sortBy, sortDirection: selected.order };
}

export function legacyAdministrativeHistoryLevelTone(levelId) {
  return {
    1: "is-green",
    2: "is-yellow",
    3: "is-orange",
    4: "is-red",
  }[Number(levelId)] || "";
}

export function legacyAdministrativeHistoryStatusTone(statusId) {
  return {
    1: "is-yellow",
    2: "is-green",
    3: "is-neutral",
    4: "is-orange",
    5: "is-red",
  }[Number(statusId)] || "";
}

export function legacyAdministrativeHistoryDate(record, field) {
  return record?.isReferential ? "N/A" : (record?.[field] || "");
}

export function legacyAdministrativeHistoryHasAttachment(record) {
  return Number(record?.attachmentId) > 0;
}

export function administrativeHistoryPaginationTotal(total, range) {
  return `${range[0]} to ${range[1]} of ${total} items`;
}
