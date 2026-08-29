import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/LegalActionsCatalogPage.jsx", import.meta.url);
const cssPath = new URL("../src/pages/LegalActionsCatalogPage.css", import.meta.url);

test("los cuatro controles accionables conservan texto, evento e iconografía", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, />\s*\+ Acción Legal\s*<\/a>/);
  assert.match(source, /openModal\(row\)/);
  assert.match(source, /fa-pencil-square-o fa-2x/);
  assert.match(source, /fa-check is-active/);
  assert.match(source, /fa-times-circle is-inactive/);
  assert.match(source, /onSubmit=\{saveAction\}/);
  assert.match(source, />\s*Regresar\s*<\/button>/);
  assert.match(source, /getLegalAction\(action\?\.id \|\| 0\)/);
  assert.doesNotMatch(source, /loading=\{listing\.loading\}/);
});

test("el popup replica el defecto de título y la ausencia de validación obligatoria", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /Editar Incidente/);
  assert.match(source, /maxLength=\{250\}/);
  assert.doesNotMatch(source, /\brequired\b/);
  assert.match(source, /closable=\{false\}/);
  assert.match(source, /maskClosable=\{false\}/);
  assert.match(source, /keyboard=\{false\}/);
  assert.match(source, /width=\{500\}/);
  assert.equal((source.match(/sorter: true/g) || []).length, 3);
});

test("la hoja dedicada fija la geometría y colorimetría medidas", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /font-size: 32px/);
  assert.match(css, /background: #222 !important/);
  assert.match(css, /height: 48px/);
  assert.match(css, /height: 56px/);
  assert.match(css, /color: #3b921e/);
  assert.match(css, /color: #bf2424/);
  assert.match(css, /color: #4d5c66/);
  assert.match(css, /border-radius: 4px/);
  assert.match(css, /background: #29823b/);
  assert.match(css, /background: #870707/);
  assert.match(css, /gap: 7\.8875px/);
});
