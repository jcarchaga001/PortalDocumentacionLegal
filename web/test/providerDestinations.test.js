import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProviderDestinationCurrency,
  PROVIDER_DESTINATION_COLUMN_TITLES,
  PROVIDER_DESTINATION_EMPTY_TEXT,
} from "../src/pages/providerDestinations.js";

test("blkDestinos conserva encabezados y texto vacío del legacy", () => {
  assert.deepEqual(PROVIDER_DESTINATION_COLUMN_TITLES, ["Banco", "Tipo de Cuenta", "Moneda"]);
  assert.equal(PROVIDER_DESTINATION_EMPTY_TEXT, "No tiene destinos vinculados...");
});

test("moneda reproduce la expresión de GetDestino", () => {
  assert.equal(formatProviderDestinationCurrency(true, "L"), "Dolares $");
  assert.equal(formatProviderDestinationCurrency(1, "L"), "Dolares $");
  assert.equal(formatProviderDestinationCurrency(false, "L"), "Local L");
  assert.equal(formatProviderDestinationCurrency(0, ""), "Local");
});
