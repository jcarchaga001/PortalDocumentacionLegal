import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCorporateClientImportRows,
  CORPORATE_CLIENT_BULK_COLUMNS,
  CORPORATE_CLIENT_BULK_CONTROLS,
  nextCorporateClientBulkSort,
  removeCorporateClientImportRow,
  removeInvalidCorporateClientImportRows,
  sortCorporateClientImportRows,
} from "../src/pages/corporateClientBulkParity.js";

function row(overrides = {}) {
  return {
    faCode: "FA01",
    name: "Cliente",
    contactName: "Contacto",
    contactPosition: "Gerente",
    contactPhone: "9999-9999",
    contactEmail: "correo-invalido",
    ...overrides,
  };
}

test("inventario enlaza los cinco controles OnClick con su acción OML", () => {
  assert.deepEqual(CORPORATE_CLIENT_BULK_CONTROLS.map(({ control, action }) => [control, action]), [
    ["Volver al listado", "VolverAlListadoOnClick"],
    ["Descargar Plantilla", "DescargarPlantillaOnClick"],
    ["Subir", "SubirOnClick"],
    ["Remover todos los registros no validos", "RemoverTodosNoValidosOnClick"],
    ["Remover registro", "RemoverRegistroOnClick"],
  ]);
});

test("Upload1OnChange acumula y valida cadenas vacías sin Trim ni correo inventado", () => {
  const first = appendCorporateClientImportRows([], [
    row(),
    row({ faCode: "FA02", contactName: "" }),
    row({ faCode: "FA03", contactPhone: "" }),
    row({ faCode: "FA04", contactName: "   ", contactPhone: "   " }),
  ]);
  const accumulated = appendCorporateClientImportRows(first, [row({ name: "Duplicado posterior" })]);

  assert.equal(first[0].isValid, true);
  assert.equal(first[0].contactEmail, "correo-invalido");
  assert.equal(first[1].validationMessage, "Este registro no es valido, el Nombre del contacto es requerido");
  assert.equal(first[2].validationMessage, "Este registro no es valido, el Teléfono del contacto es requerido");
  assert.equal(first[3].isValid, true);
  assert.equal(accumulated.length, 5);
  assert.equal(accumulated[4].isValid, false);
  assert.equal(accumulated[4].validationMessage, "Este registro no es valido");
});

test("remoción y orden solo afectan la lista local como las client actions", () => {
  const rows = appendCorporateClientImportRows([], [
    row({ faCode: "FA02" }),
    row({ faCode: "FA01", contactPhone: "" }),
  ]);
  assert.deepEqual(removeInvalidCorporateClientImportRows(rows).map(({ faCode }) => faCode), ["FA02"]);
  assert.deepEqual(removeCorporateClientImportRow(rows, rows[0].importRowId).map(({ faCode }) => faCode), ["FA01"]);

  const asc = nextCorporateClientBulkSort(null, "faCode");
  assert.deepEqual(sortCorporateClientImportRows(rows, asc).map(({ faCode }) => faCode), ["FA01", "FA02"]);
  assert.equal(CORPORATE_CLIENT_BULK_COLUMNS.filter(({ sortable }) => sortable).length, 4);
});
