import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../src/pages/CorporateClientsPage.jsx", import.meta.url);
const cssUrl = new URL("../src/pages/CorporateClientsPage.css", import.meta.url);

test("la superficie expone solo los controles de navegación y expansión documentados", async () => {
  const source = await readFile(pageUrl, "utf8");

  assert.match(source, />\s*Carga de Clientes\s*</);
  assert.match(source, /fa fa-plus fa-1x/);
  assert.match(source, />Crear Cliente</);
  assert.match(source, /fa fa-pencil-square-o fa-2x/);
  assert.match(source, /fa-chevron-up/);
  assert.match(source, /fa-chevron-down/);
  assert.match(source, />Contactos</);
  assert.match(source, /ROUTES\.corporateClientBulk/);
  assert.match(source, /ROUTES\.corporateClientCreate/);
  assert.match(source, /\?CodCliente=\$\{client\.id\}/);
  assert.doesNotMatch(source, /Búsqueda/);
  assert.doesNotMatch(source, /Solo activos/);
  assert.doesNotMatch(source, /<Drawer\b/);
  assert.doesNotMatch(source, /<Tag\b/);
});

test("el CSS fija la geometría, colorimetría y paginación observadas", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /height: 72px/);
  assert.match(css, /font-size: 32px/);
  assert.match(css, /line-height: 40px/);
  assert.match(css, /width: 1946\.6125px/);
  assert.match(css, /height: 48px/);
  assert.match(css, /background: #444/);
  assert.match(css, /color: #f3f6f8/);
  assert.match(css, /height: 56px/);
  assert.match(css, /border-bottom: 0\.8px solid #dee2e6/);
  assert.match(css, /width: 122\.025px/);
  assert.match(css, /gap: 10px/);
  assert.match(css, /margin-top: 40px/);
  assert.match(css, /gap: 8px/);
});
