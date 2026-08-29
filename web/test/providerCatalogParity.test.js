import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProviderPaginationTotal,
  isDuplicateProviderTaxNumber,
  isLegacyProviderBooleanVisible,
  isProviderQueryFailure,
  providerMutationRelationship,
  PROVIDER_CATALOG_DUPLICATE_RTN_MESSAGE,
  PROVIDER_CATALOG_EMPTY_TEXT,
  PROVIDER_CATALOG_PAGE_SIZE,
  PROVIDER_CATALOG_QUERY_ERROR,
  PROVIDER_CATALOG_SUCCESS_MESSAGE,
} from "../src/pages/providerCatalogParity.js";

test("scrCatalogoProveedores conserva textos y MaxRecords del MVC legacy", () => {
  assert.equal(PROVIDER_CATALOG_PAGE_SIZE, 500);
  assert.equal(PROVIDER_CATALOG_EMPTY_TEXT, "No hay datos para mostrar...");
  assert.equal(PROVIDER_CATALOG_SUCCESS_MESSAGE, "Registro exitoso");
  assert.equal(PROVIDER_CATALOG_DUPLICATE_RTN_MESSAGE, "El numero registrado de RTN ya existe");
  assert.equal(PROVIDER_CATALOG_QUERY_ERROR, "Error executing query.");
});

test("las columnas booleanas legacy solo dibujan check cuando el valor es verdadero", () => {
  assert.equal(isLegacyProviderBooleanVisible(true), true);
  assert.equal(isLegacyProviderBooleanVisible(1), true);
  assert.equal(isLegacyProviderBooleanVisible("1"), true);
  assert.equal(isLegacyProviderBooleanVisible(false), false);
  assert.equal(isLegacyProviderBooleanVisible(0), false);
  assert.equal(isLegacyProviderBooleanVisible(null), false);
});

test("el duplicado de RTN conserva el feedback Warning del flujo legacy", () => {
  assert.equal(isDuplicateProviderTaxNumber({ error: { code: "DUPLICATE_TAX_NUMBER" } }), true);
  assert.equal(isDuplicateProviderTaxNumber({ error: { code: "VALIDATION_ERROR" } }), false);
});

test("los fallos de consulta conservan el feedback global del runtime legacy", () => {
  assert.equal(isProviderQueryFailure({ error: { code: "ER_BAD_FIELD_ERROR" } }), true);
  assert.equal(isProviderQueryFailure({ error: { code: "INTERNAL_ERROR" } }), true);
  assert.equal(isProviderQueryFailure({ error: { code: "API_UNAVAILABLE" } }), true);
  assert.equal(isProviderQueryFailure({ error: { code: "VALIDATION_ERROR" } }), false);
});

test("la paginación conserva el resumen en inglés observado en el runtime", () => {
  assert.equal(formatProviderPaginationTotal(1114, [1, 500]), "1 to 500 of 1114 items");
  assert.equal(formatProviderPaginationTotal(0, [0, 0]), "0 to 0 of 0 items");
});

test("alta y edición conservan el desacople legacy del checkbox Proveedor Interno", () => {
  assert.deepEqual(
    providerMutationRelationship({ internal: true, destinationId: 223 }, false),
    { internal: false, destinationId: null },
  );
  assert.deepEqual(
    providerMutationRelationship(
      { editInternalToggle: true, destinationId: 999 },
      true,
      { internal: 1, destinationId: 223 },
    ),
    { internal: true, destinationId: 223 },
  );
  assert.deepEqual(
    providerMutationRelationship(
      { editInternalToggle: true, destinationId: 223 },
      true,
      { internal: false, destinationId: null },
    ),
    { internal: false, destinationId: null },
  );
});
