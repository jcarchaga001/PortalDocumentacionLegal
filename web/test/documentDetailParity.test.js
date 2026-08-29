import assert from "node:assert/strict";
import test from "node:test";
import {
  documentDetailActions,
  documentIdFromSearch,
  documentLevelTone,
  documentStatusTone,
  legacyDocumentDateInputValue,
  isLegacyDocumentApprovalValid,
} from "../src/pages/documentDetailParity.js";

test("scrDetalleDocumento accepts both documented query-string identifiers", () => {
  assert.equal(documentIdFromSearch("?IdRegistro=913"), 913);
  assert.equal(documentIdFromSearch("?CodDocumento=51"), 51);
  assert.equal(documentIdFromSearch("?IdRegistro=0"), null);
});

test("scrDetalleDocumento conserva el valor ISO de los inputs HTML date del legacy", () => {
  assert.equal(legacyDocumentDateInputValue("2023-06-10"), "2023-06-10");
  assert.equal(legacyDocumentDateInputValue("2023-06-10T14:30:00"), "2023-06-10");
  assert.equal(legacyDocumentDateInputValue(""), "");
});

test("scrDetalleDocumento maps status and level colors to the observed tags", () => {
  assert.equal(documentStatusTone(2), "is-success");
  assert.equal(documentStatusTone(5), "is-danger");
  assert.equal(documentLevelTone("Público"), "is-public");
  assert.equal(documentLevelTone("Privado"), "is-private");
});

test("scrDetalleDocumento only exposes review decisions for En Revisión", () => {
  assert.deepEqual(documentDetailActions(1), ["reject", "approve", "update"]);
  assert.deepEqual(documentDetailActions(2), ["update"]);
  assert.deepEqual(documentDetailActions(5), ["update"]);
});

test("Aprobar replica Form1.Valid y la obligatoriedad de Ref2", () => {
  assert.equal(isLegacyDocumentApprovalValid(""), false);
  assert.equal(isLegacyDocumentApprovalValid(" "), true);
  assert.equal(isLegacyDocumentApprovalValid("REF-2"), true);
});
