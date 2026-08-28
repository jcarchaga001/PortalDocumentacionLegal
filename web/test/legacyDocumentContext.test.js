import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLegacyDocumentContext,
  clearLegacyDocumentType,
  clearLegacySelectedBranchId,
  DOCUMENT_TYPE_STORAGE_KEY,
  LEGACY_CONTEXT_COUNTRY_STORAGE_KEY,
  LEGACY_SELECTED_BRANCH_STORAGE_KEY,
  readLegacyContextCountryCode,
  readLegacyDocumentType,
  readLegacySelectedBranchId,
  resetLegacyDocumentContextForLogin,
  restoreLegacyDocumentContextForCountry,
  writeLegacyDocumentType,
  writeLegacySelectedBranchId,
} from "../src/config/legacyDocumentContext.js";

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("conserva los tipos documentales 1 y 2 como Client.tipoDocumento", () => {
  const storage = createStorage();

  assert.equal(writeLegacyDocumentType(1, storage), 1);
  assert.equal(readLegacyDocumentType(storage), 1);
  assert.equal(writeLegacyDocumentType("2", storage), 2);
  assert.equal(readLegacyDocumentType(storage), 2);
});

test("no inventa un tipo documental cuando no existe o es invalido", () => {
  assert.equal(readLegacyDocumentType(createStorage()), undefined);
  assert.equal(readLegacyDocumentType(createStorage({ [DOCUMENT_TYPE_STORAGE_KEY]: "9" })), undefined);
  assert.equal(writeLegacyDocumentType(0, createStorage()), undefined);
});

test("limpia Client.tipoDocumento al cambiar o cerrar la sesion", () => {
  const storage = createStorage({ [DOCUMENT_TYPE_STORAGE_KEY]: "2" });

  assert.equal(clearLegacyDocumentType(storage), true);
  assert.equal(readLegacyDocumentType(storage), undefined);
});

test("conserva SucursalSelected como variable cliente entre navegaciones", () => {
  const storage = createStorage();

  assert.equal(writeLegacySelectedBranchId(226, storage), 226);
  assert.equal(readLegacySelectedBranchId(storage), 226);
  assert.equal(writeLegacySelectedBranchId("223", storage), 223);
  assert.equal(readLegacySelectedBranchId(storage), 223);
});

test("no inventa SucursalSelected cuando falta o no es un entero positivo", () => {
  assert.equal(readLegacySelectedBranchId(createStorage()), undefined);
  assert.equal(
    readLegacySelectedBranchId(createStorage({ [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "FA63" })),
    undefined,
  );
  assert.equal(writeLegacySelectedBranchId(0, createStorage()), undefined);
  assert.equal(writeLegacySelectedBranchId(7.5, createStorage()), undefined);
});

test("limpia SucursalSelected al cambiar o cerrar la sesion", () => {
  const storage = createStorage({ [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "226" });

  assert.equal(clearLegacySelectedBranchId(storage), true);
  assert.equal(readLegacySelectedBranchId(storage), undefined);
});

test("la restauracion de la misma sesion conserva SucursalSelected", () => {
  const storage = createStorage({
    [LEGACY_CONTEXT_COUNTRY_STORAGE_KEY]: "4",
    [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "226",
    [DOCUMENT_TYPE_STORAGE_KEY]: "2",
  });

  assert.deepEqual(restoreLegacyDocumentContextForCountry(4, storage), {
    countryCode: 4,
    previousCountryCode: 4,
    countryChanged: false,
  });
  assert.equal(readLegacySelectedBranchId(storage), 226);
  assert.equal(readLegacyDocumentType(storage), 2);
});

test("la primera restauracion vincula el pais sin borrar el contexto existente", () => {
  const storage = createStorage({
    [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "223",
    [DOCUMENT_TYPE_STORAGE_KEY]: "1",
  });

  assert.deepEqual(restoreLegacyDocumentContextForCountry("4", storage), {
    countryCode: 4,
    previousCountryCode: undefined,
    countryChanged: false,
  });
  assert.equal(readLegacyContextCountryCode(storage), 4);
  assert.equal(readLegacySelectedBranchId(storage), 223);
  assert.equal(readLegacyDocumentType(storage), 1);
});

test("una sesion restaurada de otro pais limpia el contexto cliente", () => {
  const storage = createStorage({
    [LEGACY_CONTEXT_COUNTRY_STORAGE_KEY]: "4",
    [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "226",
    [DOCUMENT_TYPE_STORAGE_KEY]: "2",
  });

  assert.deepEqual(restoreLegacyDocumentContextForCountry(5, storage), {
    countryCode: 5,
    previousCountryCode: 4,
    countryChanged: true,
  });
  assert.equal(readLegacyContextCountryCode(storage), 5);
  assert.equal(readLegacySelectedBranchId(storage), undefined);
  assert.equal(readLegacyDocumentType(storage), undefined);
});

test("un login explicito limpia el contexto aunque conserve el mismo pais", () => {
  const storage = createStorage({
    [LEGACY_CONTEXT_COUNTRY_STORAGE_KEY]: "4",
    [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "226",
    [DOCUMENT_TYPE_STORAGE_KEY]: "2",
  });

  assert.equal(resetLegacyDocumentContextForLogin(4, storage), 4);
  assert.equal(readLegacyContextCountryCode(storage), 4);
  assert.equal(readLegacySelectedBranchId(storage), undefined);
  assert.equal(readLegacyDocumentType(storage), undefined);
});

test("logout limpia tambien el pais que era propietario del contexto", () => {
  const storage = createStorage({
    [LEGACY_CONTEXT_COUNTRY_STORAGE_KEY]: "4",
    [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "226",
    [DOCUMENT_TYPE_STORAGE_KEY]: "2",
  });

  assert.equal(clearLegacyDocumentContext(storage), true);
  assert.equal(readLegacyContextCountryCode(storage), undefined);
  assert.equal(readLegacySelectedBranchId(storage), undefined);
  assert.equal(readLegacyDocumentType(storage), undefined);
});

test("una restauracion fallida o sin pais valido no altera SucursalSelected", () => {
  const storage = createStorage({
    [LEGACY_CONTEXT_COUNTRY_STORAGE_KEY]: "4",
    [LEGACY_SELECTED_BRANCH_STORAGE_KEY]: "226",
  });

  assert.deepEqual(restoreLegacyDocumentContextForCountry(undefined, storage), {
    countryCode: undefined,
    countryChanged: false,
  });
  assert.equal(readLegacyContextCountryCode(storage), 4);
  assert.equal(readLegacySelectedBranchId(storage), 226);
});
