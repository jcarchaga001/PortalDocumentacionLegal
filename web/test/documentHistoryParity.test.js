import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_BRANCH_HISTORY_START_DATE,
  LEGACY_BRANCH_HISTORY_TABLE_WIDTH,
  legacyBranchHistoryHasAttachment,
  legacyBranchHistoryInitialRange,
  legacyBranchHistoryLevelTone,
  legacyBranchHistorySort,
  legacyBranchHistoryStatusTone,
} from "../src/pages/documentHistoryParity.js";

test("scrHistoricoDocumentos inicia en 2020-01-01 y conserva el ancho medido", () => {
  assert.equal(LEGACY_BRANCH_HISTORY_START_DATE, "2020-01-01");
  assert.deepEqual(legacyBranchHistoryInitialRange("2026-08-28"), ["2020-01-01", "2026-08-28"]);
  assert.equal(LEGACY_BRANCH_HISTORY_TABLE_WIDTH, 1852);
});

test("solo expone los siete ordenamientos del aggregate legacy", () => {
  assert.deepEqual(legacyBranchHistorySort({ columnKey: "branchName", order: "ascend" }), {
    sortBy: "branchName",
    sortDirection: "ascend",
  });
  assert.deepEqual(legacyBranchHistorySort({ columnKey: "providerId", order: "descend" }), {
    sortBy: "providerId",
    sortDirection: "descend",
  });
  assert.deepEqual(legacyBranchHistorySort({ columnKey: "description", order: "ascend" }), {});
  assert.deepEqual(legacyBranchHistorySort({ columnKey: "reference", order: undefined }), {});
});

test("tonos de nivel y estado siguen los codigos de los bloques OML", () => {
  assert.deepEqual([1, 2, 3, 4].map(legacyBranchHistoryLevelTone), [
    "is-green",
    "is-yellow",
    "is-orange",
    "is-red",
  ]);
  assert.deepEqual([1, 2, 3, 4, 5].map(legacyBranchHistoryStatusTone), [
    "is-yellow",
    "is-green",
    "is-neutral",
    "is-orange",
    "is-red",
  ]);
});

test("el icono de archivo depende del codigoArchivo del documento", () => {
  assert.equal(legacyBranchHistoryHasAttachment({ attachmentId: 31, hasAttachment: false }), true);
  assert.equal(legacyBranchHistoryHasAttachment({ attachmentId: null, hasAttachment: true }), false);
});
