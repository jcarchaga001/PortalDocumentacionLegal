import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLegacyLegalActionDate,
  LEGAL_ACTIONS_FEEDBACK,
  LEGAL_ACTIONS_PAGE_SIZE,
  LEGAL_ACTIONS_QUERY_ERROR,
  LEGAL_ACTION_SORT_FIELDS,
  legalActionPaginationTotal,
  legalActionPayload,
} from "../src/pages/legalActionsCatalogParity.js";

test("srcCatalagoAccionesLegal conserva textos, MaxRecords y sorters legacy", () => {
  assert.equal(LEGAL_ACTIONS_PAGE_SIZE, 50);
  assert.equal(LEGAL_ACTIONS_QUERY_ERROR, "Error executing query.");
  assert.deepEqual([...LEGAL_ACTION_SORT_FIELDS], ["name", "createdAt", "createdBy"]);
  assert.deepEqual(LEGAL_ACTIONS_FEEDBACK, {
    created: "¡Se ha guardado correctamente!",
    updated: "¡Se ha actualizado correctamente!",
  });
});

test("las fechas y el resumen de paginación conservan el formato observable", () => {
  assert.equal(formatLegacyLegalActionDate("2026-08-28 20:47:53"), "2026-08-28 20:47:53");
  assert.equal(formatLegacyLegalActionDate(null), "");
  assert.equal(legalActionPaginationTotal(9, [1, 9]), "1 to 9 of 9 items");
  assert.equal(legalActionPaginationTotal(0, [0, 0]), "0 to 0 of 0 items");
});

test("el alta replica Mandatory=False y el activo oculto inicia falso", () => {
  assert.deepEqual(
    legalActionPayload({ name: "", active: true, editing: false }),
    { name: "", active: false },
  );
  assert.deepEqual(
    legalActionPayload({ name: "  Acción  ", active: true, editing: true }),
    { name: "  Acción  ", active: true },
  );
  assert.equal(legalActionPayload({ name: "x".repeat(300), active: false, editing: true }).name.length, 250);
});
