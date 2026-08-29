import assert from "node:assert/strict";
import test from "node:test";
import {
  AGREEMENTS_COLUMNS,
  AGREEMENTS_EXPORT_FILE,
  AGREEMENTS_PAGE_SIZE,
  AGREEMENTS_QUERY_ERROR,
  agreementEndDate,
  agreementPaginationSummary,
  agreementPromissoryStatus,
  agreementRowClassName,
  buildAgreementFilters,
  formatAgreementCurrency,
} from "../src/pages/agreementsParity.js";

test("scrConvenios conserva contratos visuales y textos del runtime", () => {
  assert.equal(AGREEMENTS_PAGE_SIZE, 50);
  assert.equal(AGREEMENTS_QUERY_ERROR, "Error executing query.");
  assert.equal(AGREEMENTS_EXPORT_FILE, "Convenios Clientes Corporativos.xlsx");
  assert.equal(AGREEMENTS_COLUMNS.length, 11);
  assert.deepEqual(
    AGREEMENTS_COLUMNS.map(({ label }) => label),
    [
      "Nombre Cliente", "Sucursal", "Gestor de Cuenta", "Límite de Crédito",
      "Días de Crédito", "Tiene Pagaré", "Estatus Pagaré",
      "Fecha Inicio\nConvenio", "Fecha Final\nConvenio", "Centralizado", "",
    ],
  );
  assert.equal(Number(AGREEMENTS_COLUMNS.reduce((sum, column) => sum + column.width, 0).toFixed(1)), 1452.8);
});

test("formateo, estados, colores y resumen replican la lista legacy", () => {
  assert.equal(formatAgreementCurrency(50000, false), "50,000.00");
  assert.equal(formatAgreementCurrency(50000, true), "US $ 50,000.00");
  assert.equal(agreementPromissoryStatus({ hasPromissoryNote: true, isPromissoryNoteExpired: true }), "Vencido");
  assert.equal(agreementPromissoryStatus({ hasPromissoryNote: true }), "En Vigencia");
  assert.equal(agreementPromissoryStatus({}), "");
  assert.equal(agreementEndDate({ isIndefinite: true, endDate: "2026-01-01" }), "Indefinido");
  assert.equal(agreementRowClassName({ expirationStatus: "Vencido" }), "is-expired");
  assert.equal(agreementRowClassName({ expirationStatus: "Por Vencer" }), "is-expiring");
  assert.equal(agreementPaginationSummary(1, 50, 50, 80), "1 to 50 of 80 items");
  assert.equal(agreementPaginationSummary(2, 50, 29, 0), "");
});

test("filtros solo transmiten Fecha1/Fecha2 aplicadas", () => {
  assert.deepEqual(buildAgreementFilters({
    clientId: 8,
    appliedDateRange: ["2026-08-01", "2026-08-31"],
    indefinite: true,
  }, 2), {
    clientId: 8,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    indefinite: true,
    page: 2,
    pageSize: 50,
  });
});
