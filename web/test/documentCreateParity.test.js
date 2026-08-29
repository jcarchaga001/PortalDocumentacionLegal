import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  legacyRegistrationBranchLabel,
  legacyRegistrationPreviewKind,
  legacyRegistrationShowsDates,
} from "../src/pages/documentCreateParity.js";

test("scrRegistroDocumento conserva Sucursal y Area sin modernizar los textos", () => {
  assert.equal(legacyRegistrationBranchLabel(1), "Sucursal");
  assert.equal(legacyRegistrationBranchLabel(2), "Area");
  assert.equal(legacyRegistrationBranchLabel(undefined), "");
});

test("Es Referencial oculta las fechas, pero no exige borrarlas del modelo", () => {
  assert.equal(legacyRegistrationShowsDates(false), true);
  assert.equal(legacyRegistrationShowsDates(true), false);
});

test("ReactiveWebPreviewer distingue PDF, imagen y formato no soportado", () => {
  assert.equal(legacyRegistrationPreviewKind("contrato.PDF"), "pdf");
  assert.equal(legacyRegistrationPreviewKind("evidencia.jpeg"), "image");
  assert.equal(legacyRegistrationPreviewKind("evidencia.bmp"), "image");
  assert.equal(legacyRegistrationPreviewKind("contrato.docx"), "unsupported");
});

test("scrRegistroDocumento conserva upload sin Accept, preview e incluso DeleteOnClick vacio", () => {
  const source = readFileSync(new URL("../src/pages/DocumentCreatePage.jsx", import.meta.url), "utf8");
  assert.match(source, /fa fa-arrow-circle-left/);
  assert.match(source, /fa fa-paperclip/);
  assert.match(source, /legacy-create-file-preview/);
  assert.match(source, /onClick=\{\(\) => \{\}\}/);
  assert.match(source, /getDocumentRegistrationSubcategories\(selectedCategoryId \|\| 0\)/);
  assert.match(source, /open=\{saving\}/);
  assert.match(source, /Generando Solicitud\.\.\./);
  assert.doesNotMatch(source, /<Upload[^>]*\saccept=/);
  assert.doesNotMatch(source, /disabled=\{!selectedCategoryId\}/);
});
