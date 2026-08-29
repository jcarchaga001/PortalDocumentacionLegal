import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPIRING_ATTACHMENT_DOWNLOAD_NAME,
  EXPIRING_DOCUMENT_PAGE_SIZE,
  EXPIRING_DOCUMENT_SORT_KEYS,
  EXPIRING_QUERY_ERROR,
  expiringDocumentFilters,
  expiringLevelClass,
  expiringPaginationTotal,
  expiringTableChange,
  hasExpiringAttachmentAction,
} from "../src/pages/expiringDocumentsParity.js";

test("scrProximosVencer conserva filtros, fechas y superficie del Aggregate", () => {
  assert.equal(EXPIRING_DOCUMENT_PAGE_SIZE, 50);
  assert.deepEqual(expiringDocumentFilters({
    branchId: 77,
    dates: ["2020-01-01", "2026-08-28"],
    categoryId: 2,
    subcategoryId: 8,
    search: "REF-42",
  }, { sortBy: "providerCode", sortDirection: "descend" }), {
    surface: "expiring",
    branchId: 77,
    startDate: "2020-01-01",
    endDate: "2026-08-28",
    categoryId: 2,
    subcategoryId: 8,
    search: "REF-42",
    sortBy: "providerCode",
    sortDirection: "descend",
  });
});

test("solo siete encabezados disparan OnSort y el evento vuelve a la primera pagina", () => {
  assert.deepEqual(EXPIRING_DOCUMENT_SORT_KEYS, [
    "branchName",
    "reference",
    "providerCode",
    "categoryName",
    "subcategoryName",
    "documentDate",
    "expirationDate",
  ]);
  assert.deepEqual(
    expiringTableChange({ current: 2, pageSize: 50 }, { columnKey: "reference", order: "descend" }, "sort"),
    { sorting: { sortBy: "reference", sortDirection: "descend" }, page: 1, pageSize: 50 },
  );
  assert.deepEqual(
    expiringTableChange({ current: 2, pageSize: 50 }, {}, "paginate"),
    { sorting: undefined, page: 2, pageSize: 50 },
  );
});

test("paginacion, tags, archivo y error mantienen los contratos visibles", () => {
  assert.equal(expiringPaginationTotal(93, [1, 50]), "1 to 50 of 93 items");
  assert.equal(expiringPaginationTotal(0, [0, 0]), "0 to 0 of 0 items");
  assert.equal(expiringLevelClass("Público"), "is-level-public");
  assert.equal(expiringLevelClass("Privado"), "is-level-private");
  assert.equal(expiringLevelClass(""), "");
  assert.equal(hasExpiringAttachmentAction({ attachmentId: 9 }), true);
  assert.equal(hasExpiringAttachmentAction({ attachmentId: null }), false);
  assert.equal(EXPIRING_ATTACHMENT_DOWNLOAD_NAME, "_.zip");
  assert.equal(EXPIRING_QUERY_ERROR, "Error executing query.");
});
