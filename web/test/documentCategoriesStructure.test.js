import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/DocumentCategoriesPage.jsx", import.meta.url);
const cssPath = new URL("../src/pages/DocumentCategoriesPage.css", import.meta.url);

test("scrCategoriasDocumentos replica los defectos de filtros y checkbox del Aggregate", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, /data-screen="scrCategoriasDocumentos"/);
  assert.match(source, /<h1>Permisos Casos Laborales<\/h1>/);
  assert.match(source, /getDocumentCategoryLookups/);
  assert.match(source, /lookups\.branches/);
  assert.match(source, /\["Solo Obligatorios", "Solo Documentos", "Solo Activos"\]/);
  assert.match(source, /checked=\{sharedChecked\}/);
  assert.match(source, /setLocalFlag\(row, "required"/);
  assert.match(source, /setLocalFlag\(row, "branchDocument"/);
  assert.doesNotMatch(source, /changeTable/);
  assert.doesNotMatch(source, /sortBy/);
  assert.match(source, /resetPage: false/);
});

test("tabla conserva geometría principal, enlaces y feedback legacy", async () => {
  const [source, css] = await Promise.all([readFile(pagePath, "utf8"), readFile(cssPath, "utf8")]);
  assert.match(source, /className="legacy-document-categories-access"/);
  assert.match(source, /type: "info", message: action\.infoMessage/);
  assert.match(source, /DOCUMENT_CATEGORY_SUCCESS/);
  assert.match(css, /grid-template-columns: repeat\(5/);
  assert.match(css, /height: 48px/);
  assert.match(css, /height: 56px/);
  assert.match(css, /background: #222/);
  assert.match(css, /font-size: 12px/);
});
