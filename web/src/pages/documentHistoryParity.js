export const LEGACY_BRANCH_HISTORY_START_DATE = "2020-01-01";
export const LEGACY_BRANCH_HISTORY_TABLE_WIDTH = 1852;

export const LEGACY_BRANCH_HISTORY_SORT_FIELDS = Object.freeze({
  branchName: "branchName",
  reference: "reference",
  providerId: "providerId",
  categoryName: "categoryName",
  subcategoryName: "subcategoryName",
  documentDate: "documentDate",
  expirationDate: "expirationDate",
});

export function legacyBranchHistoryInitialRange(todayIso) {
  return [LEGACY_BRANCH_HISTORY_START_DATE, todayIso];
}

export function legacyBranchHistorySort(sorter) {
  const selected = Array.isArray(sorter)
    ? sorter.find((candidate) => candidate?.order)
    : sorter;
  const field = selected?.columnKey || selected?.field;
  const sortBy = LEGACY_BRANCH_HISTORY_SORT_FIELDS[field];
  if (!sortBy || !selected?.order) return {};
  return { sortBy, sortDirection: selected.order };
}

export function legacyBranchHistoryLevelTone(levelId) {
  return {
    1: "is-green",
    2: "is-yellow",
    3: "is-orange",
    4: "is-red",
  }[Number(levelId)] || "";
}

export function legacyBranchHistoryStatusTone(statusId) {
  return {
    1: "is-yellow",
    2: "is-green",
    3: "is-neutral",
    4: "is-orange",
    5: "is-red",
  }[Number(statusId)] || "";
}

export function legacyBranchHistoryHasAttachment(record) {
  return Number(record?.attachmentId) > 0;
}
