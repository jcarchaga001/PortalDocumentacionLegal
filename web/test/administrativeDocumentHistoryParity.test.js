import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS,
  ADMINISTRATIVE_HISTORY_EXPORT_MAX_ROWS,
  ADMINISTRATIVE_HISTORY_MIN_TABLE_WIDTH,
  ADMINISTRATIVE_HISTORY_PAGE_SIZE,
  ADMINISTRATIVE_HISTORY_QUERY_ERROR,
  administrativeHistoryPaginationTotal,
  legacyAdministrativeHistoryDate,
  legacyAdministrativeHistoryHasAttachment,
  legacyAdministrativeHistoryLevelTone,
  legacyAdministrativeHistorySort,
  legacyAdministrativeHistoryStatusTone,
} from "../src/pages/administrativeDocumentHistoryParity.js";

test("scrHistoricoAdministrativoDoc conserva paginacion, exportacion y geometria medidas", () => {
  assert.equal(ADMINISTRATIVE_HISTORY_PAGE_SIZE, 50);
  assert.equal(ADMINISTRATIVE_HISTORY_EXPORT_MAX_ROWS, 10000);
  assert.equal(ADMINISTRATIVE_HISTORY_MIN_TABLE_WIDTH, 1725.83);
  assert.equal(ADMINISTRATIVE_HISTORY_QUERY_ERROR, "Error executing query.");
  assert.equal(ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS.length, 12);
  const totalWidth = ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS
    .map((width) => Number.parseFloat(width))
    .reduce((sum, width) => sum + width, 0);
  assert.ok(Math.abs(totalWidth - 100) < 0.00001);
  assert.equal(administrativeHistoryPaginationTotal(65, [1, 50]), "1 to 50 of 65 items");
});

test("solo expone los siete ordenamientos del aggregate administrativo", () => {
  assert.deepEqual(legacyAdministrativeHistorySort({ columnKey: "branchName", order: "ascend" }), {
    sortBy: "branchName",
    sortDirection: "ascend",
  });
  assert.deepEqual(legacyAdministrativeHistorySort({ columnKey: "providerId", order: "descend" }), {
    sortBy: "providerId",
    sortDirection: "descend",
  });
  assert.deepEqual(legacyAdministrativeHistorySort({ columnKey: "description", order: "ascend" }), {});
  assert.deepEqual(legacyAdministrativeHistorySort({ columnKey: "levelName", order: "ascend" }), {});
  assert.deepEqual(legacyAdministrativeHistorySort({ columnKey: "statusName", order: "ascend" }), {});
});

test("fechas, tonos y archivo preservan los contratos observables del runtime", () => {
  assert.equal(legacyAdministrativeHistoryDate({ isReferential: true, documentDate: "2026-01-01" }, "documentDate"), "N/A");
  assert.equal(legacyAdministrativeHistoryDate({ isReferential: false, documentDate: "2026-01-01" }, "documentDate"), "2026-01-01");
  assert.deepEqual([1, 2, 3, 4].map(legacyAdministrativeHistoryLevelTone), [
    "is-green",
    "is-yellow",
    "is-orange",
    "is-red",
  ]);
  assert.deepEqual([1, 2, 3, 4, 5].map(legacyAdministrativeHistoryStatusTone), [
    "is-yellow",
    "is-green",
    "is-neutral",
    "is-orange",
    "is-red",
  ]);
  assert.equal(legacyAdministrativeHistoryHasAttachment({ attachmentId: 31, hasAttachment: false }), true);
  assert.equal(legacyAdministrativeHistoryHasAttachment({ attachmentId: null, hasAttachment: true }), false);
});
