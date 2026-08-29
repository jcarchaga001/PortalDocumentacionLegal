import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const pageSource = fs.readFileSync(path.join(testDirectory, "../src/pages/AgreementDetailPage.jsx"), "utf8");
const styleSource = fs.readFileSync(path.join(testDirectory, "../src/pages/AgreementDetailPage.css"), "utf8");

test("scrConvenioDetalle usa los iconos, tooltips, textos y DataAction localizados", () => {
  for (const icon of ["fa-chevron-left", "fa-pencil-square-o", "fa-eye", "fa-download", "fa-file-pdf-o"]) {
    assert.match(pageSource, new RegExp(icon));
  }
  for (const text of ["Detalle Convenio", "Observacíon", "Sucursales que Facturan", "Adjuntos del Convenio", "Corre del Contacto", "Contactos adicionales", "Visor de Archivos"]) {
    assert.match(pageSource, new RegExp(text));
  }
  assert.match(pageSource, /getAgreementContacts\(agreementId\)/);
  assert.match(pageSource, /title="Ver"/);
  assert.match(pageSource, /title="Descargar"/);
  assert.match(pageSource, /LegacyErrorFeedback/);
  assert.doesNotMatch(pageSource, /<Descriptions/);
  assert.doesNotMatch(pageSource, /<Table/);
  assert.doesNotMatch(pageSource, /<Empty/);
});

test("geometría y colorimetría medidas en el runtime legacy quedan fijadas", () => {
  assert.match(styleSource, /margin-bottom: 30px/);
  assert.match(styleSource, /padding: 24px/);
  assert.match(styleSource, /border: 1px solid #dee2e6/);
  assert.match(styleSource, /border-radius: 4px/);
  assert.match(styleSource, /font-size: 28px/);
  assert.match(styleSource, /min-height: 244px/);
  assert.match(styleSource, /width: calc\(33\.333333% - 15px\)/);
  assert.match(styleSource, /grid-template-columns: 15% 32% 32% 15%/);
  assert.match(styleSource, /background: #444/);
});
