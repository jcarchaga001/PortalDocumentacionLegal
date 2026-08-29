import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryAccessActionFor,
  DOCUMENT_CATEGORY_COLUMNS,
  DOCUMENT_CATEGORY_EMPTY_TEXT,
  DOCUMENT_CATEGORY_PAGE_SIZE,
  DOCUMENT_CATEGORY_QUERY_ERROR,
  DOCUMENT_CATEGORY_SUCCESS,
  paginationPages,
  paginationSummary,
} from "../src/pages/documentCategoriesParity.js";

test("scrCategoriasDocumentos conserva título implícito, columnas, MaxRecords y feedback", () => {
  assert.equal(DOCUMENT_CATEGORY_PAGE_SIZE, 500);
  assert.equal(DOCUMENT_CATEGORY_EMPTY_TEXT, "No hay datos para mostrar...");
  assert.equal(DOCUMENT_CATEGORY_QUERY_ERROR, "Error executing query.");
  assert.equal(DOCUMENT_CATEGORY_SUCCESS, "¡Registro Completado!");
  assert.deepEqual(DOCUMENT_CATEGORY_COLUMNS.map(({ label }) => label), [
    "Categoría",
    "Subcategoría",
    "Obligatorio",
    "Es Documento",
    "Acceso Permitido",
  ]);
});

test("enlaces conservan iconografía, tooltip, booleano Info y descripción legacy", () => {
  assert.deepEqual(categoryAccessActionFor(false), {
    allowed: false,
    nextAllowed: true,
    description: "Habilitó Subcategoría",
    infoMessage: "True",
    icon: "fa-ban",
    color: "#f70000",
    tooltip: "Habilitar",
  });
  assert.deepEqual(categoryAccessActionFor(1), {
    allowed: true,
    nextAllowed: false,
    description: "Deshabilitó Subcategoría",
    infoMessage: "False",
    icon: "fa-check",
    color: "#228700",
    tooltip: "Inhabilitar",
  });
});

test("paginación replica el resumen y MaxRecords del Aggregate", () => {
  assert.equal(paginationSummary(1, 500, 27), "1 to 27 of 27 items");
  assert.equal(paginationSummary(2, 500, 876), "501 to 876 of 876 items");
  assert.equal(paginationSummary(1, 500, 0), "0 to 0 of 0 items");
  assert.deepEqual(paginationPages(876), [1, 2]);
});
