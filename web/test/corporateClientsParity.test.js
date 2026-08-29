import assert from "node:assert/strict";
import test from "node:test";
import {
  CORPORATE_CLIENT_COLUMNS,
  CORPORATE_CLIENT_PAGE_SIZE,
  CORPORATE_CLIENT_QUERY_ERROR,
  CORPORATE_CLIENT_TABLE_WIDTH,
  corporateClientActiveLabel,
  corporateClientPaginationPages,
  corporateClientPaginationSummary,
} from "../src/pages/corporateClientsParity.js";

test("la lista conserva las ocho columnas, textos y anchos medidos del legacy", () => {
  assert.deepEqual(
    CORPORATE_CLIENT_COLUMNS.map(({ label, width }) => [label, width]),
    [
      ["Codigo FA", 123.475],
      ["Nombre Cliente", 458.275],
      ["Nombre Contacto", 244.2],
      ["Puesto Contacto", 338.025],
      ["Teléfono Contacto", 163.975],
      ["Correo Contacto", 311.1],
      ["Cliente Activo", 135.9375],
      ["", 170.025],
    ],
  );
  const measuredWidth = CORPORATE_CLIENT_COLUMNS.reduce((sum, column) => sum + column.width, 0) + 1.6;
  assert.ok(Math.abs(measuredWidth - CORPORATE_CLIENT_TABLE_WIDTH) < Number.EPSILON * 10_000);
});

test("GetClientes conserva página de 50, estado activo y resumen textual legacy", () => {
  assert.equal(CORPORATE_CLIENT_PAGE_SIZE, 50);
  assert.equal(corporateClientActiveLabel(true), "Sí");
  assert.equal(corporateClientActiveLabel(false), "No");
  assert.deepEqual(corporateClientPaginationPages(68), [1, 2]);
  assert.equal(corporateClientPaginationSummary(1, 68), "1 to 50 of 68 items");
  assert.equal(corporateClientPaginationSummary(2, 68), "51 to 68 of 68 items");
  assert.equal(corporateClientPaginationSummary(1, 0), "0 to 0 of 0 items");
  assert.equal(CORPORATE_CLIENT_QUERY_ERROR, "Error executing query.");
});
