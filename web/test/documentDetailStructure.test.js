import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/pages/DocumentDetailPage.jsx", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../src/styles/app.css", import.meta.url), "utf8");

test("scrDetalleDocumento conserva los límites y el modal de Actualizar del OML", () => {
  assert.match(pageSource, /maxLength=\{512\}/);
  assert.match(pageSource, /maxLength=\{20\}/);
  assert.match(pageSource, /maxLength=\{128\}/);
  assert.match(pageSource, /maxLength=\{516\}/);
  assert.equal((pageSource.match(/<Input type="date"/g) || []).length, 2);
  assert.match(pageSource, /<h3>Favor Espere\.\.\.<\/h3>/);
  assert.match(pageSource, /<span>Generando Solicitud\.\.\.<\/span>/);
  assert.match(pageSource, /open=\{saving\}/);
});

test("scrDetalleDocumento fija los colores exactos de Rechazar, Aprobar y Actualizar", () => {
  assert.match(
    styleSource,
    /\.legacy-document-actions \.legacy-document-reject \{[\s\S]*?border-width: 0;[\s\S]*?background: #aa040f;/,
  );
  assert.match(
    styleSource,
    /\.legacy-document-actions \.legacy-document-approve \{[\s\S]*?border-color: #222;[\s\S]*?background: #222;/,
  );
  assert.match(
    styleSource,
    /\.legacy-document-actions \.ant-btn-primary \{[\s\S]*?border-color: #222;[\s\S]*?background: #222;/,
  );
});

test("la navegación documental normal usa Client.IdRegistro sin query visible", () => {
  const historySource = readFileSync(new URL("../src/pages/DocumentHistoryPage.jsx", import.meta.url), "utf8");
  const administrativeSource = readFileSync(
    new URL("../src/pages/AdministrativeDocumentHistoryPage.jsx", import.meta.url),
    "utf8",
  );

  for (const source of [historySource, administrativeSource]) {
    assert.match(source, /writeLegacySelectedDocumentId\(record\.id\)/);
    assert.match(source, /history\.push\(ROUTES\.documentDetail\)/);
    assert.doesNotMatch(source, /ROUTES\.documentDetail}\?(?:IdRegistro|CodDocumento)=/);
  }
});
