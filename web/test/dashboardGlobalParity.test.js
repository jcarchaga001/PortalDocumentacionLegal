import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_EXPORT_FIELDS,
  DASHBOARD_SORT_DIRECTIONS,
  DASHBOARD_STATUS_FILTERS,
  DASHBOARD_TABLE_WIDTHS,
  dashboardExportFileName,
  dashboardPaginationWindow,
  dashboardProgress,
} from "../src/pages/dashboardGlobalParity.js";

test("dashboard global conserva estados de filtro del OML", () => {
  assert.deepEqual(DASHBOARD_STATUS_FILTERS, { current: 2, expiring: 4, missing: 5 });
});

test("dashboard global trunca el progreso como Numbers.ProgressBar", () => {
  assert.deepEqual(dashboardProgress({ current: 664, expiring: 62, required: 798 }), {
    percentage: 90,
    color: "#c92a2a",
  });
  assert.deepEqual(dashboardProgress({ current: 7, expiring: 0, required: 7 }), {
    percentage: 100,
    color: "#37b24d",
  });
});

test("dashboard global conserva el nombre legacy de exportacion", () => {
  const date = new Date(2026, 7, 28, 14, 5, 9);
  assert.equal(dashboardExportFileName(date), "DocumentacionObligarotioLegalHN_20260828-020509.xlsx");
});

test("dashboard global conserva orden de columnas del RecordListToExcel", () => {
  assert.deepEqual(DASHBOARD_EXPORT_FIELDS, [
    "vigente",
    "porVencer",
    "nombreSubcategoria",
    "nombreSucursal",
    "nombreEstado",
    "codigoSucursal",
    "codigoSubcategoria",
    "estado",
    "noExiste",
  ]);
});

test("dashboard global conserva anchos medidos por estado y sort binario legacy", () => {
  assert.deepEqual(DASHBOARD_SORT_DIRECTIONS, ["ascend", "descend", "ascend"]);
  assert.deepEqual(DASHBOARD_TABLE_WIDTHS.empty, [118.828125, 132.265625, 122.15625, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 90.453125]);
  assert.deepEqual(DASHBOARD_TABLE_WIDTHS[2], [137.5625, 132.265625, 164.203125, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 106.09375]);
  assert.deepEqual(DASHBOARD_TABLE_WIDTHS[4], [137.5625, 132.265625, 122.15625, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 100.765625]);
  assert.deepEqual(DASHBOARD_TABLE_WIDTHS[5], [137.5625, 132.265625, 164.203125, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 107.484375]);
});

test("paginacion conserva el StartIndex al cambiar de KPI", () => {
  assert.deepEqual(dashboardPaginationWindow(1064, 50), { pages: 22, current: 2, first: 51, last: 100 });
  assert.deepEqual(dashboardPaginationWindow(82, 50), { pages: 2, current: 2, first: 51, last: 82 });
  assert.deepEqual(dashboardPaginationWindow(0, 0), { pages: 0, current: 1, first: 0, last: 0 });
});
