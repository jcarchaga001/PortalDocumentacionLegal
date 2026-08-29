import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/GovernmentEntitiesPage.jsx", import.meta.url);
const cssPath = new URL("../src/pages/GovernmentEntitiesPage.css", import.meta.url);

test("los cinco controles mantienen texto, visibilidad, iconografía y eventos", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, />\s*\+ Nuevo Ente\s*<\/a>/);
  assert.match(source, /data-client-action="EditarOnClick"/);
  assert.match(source, /legacy-government-entities-edit/);
  assert.match(source, /fa-pencil-square-o/);
  assert.match(source, /data-client-action="BorrarOnClick"/);
  assert.match(source, /fa-trash/);
  assert.match(source, /onSubmit=\{saveEntity\}/);
  assert.match(source, />Cancelar<\/button>/);
  assert.match(source, /Guardar/);
  assert.doesNotMatch(source, /Modal\.confirm/);
  assert.equal((source.match(/sorter: true/g) || []).length, 3);
});

test("filtros y popup conservan typos, placeholders y ausencia de validación", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, /Ente Gubernamental:/);
  assert.match(source, /Responsable:/);
  assert.match(source, /Aréa Encargada:/);
  assert.match(source, /placeholder="Seleccione Ente"/);
  assert.match(source, /placeholder="Seleccione Responsable"/);
  assert.match(source, /placeholder="Seleccione"/);
  assert.match(source, /closable=\{false\}/);
  assert.match(source, /maskClosable=\{false\}/);
  assert.match(source, /keyboard=\{false\}/);
  assert.match(source, /width=\{500\}/);
  assert.match(source, /noValidate/);
  assert.doesNotMatch(source, /\brequired\b/);
});

test("hoja dedicada fija geometría y colorimetría medidas", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /font-size: 32px/);
  assert.match(css, /background: #222 !important/);
  assert.match(css, /height: 48px/);
  assert.match(css, /height: 56px/);
  assert.match(css, /color: #9e0d00/);
  assert.match(css, /height: 540\.4px/);
  assert.match(css, /background: #870707/);
  assert.match(css, /background: #29823b/);
  assert.match(css, /gap: 16px/);
});

