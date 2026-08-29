import assert from "node:assert/strict";
import test from "node:test";
import {
  attachmentPreviewKind,
  attachmentPreviewMimeType,
  attachmentPreviewMode,
  bookIndicator,
  buildBranchDocumentSummary,
  canDeleteBranchDocument,
  canManageLegacyBookEvidence,
  documentIndicator,
  legacyGoogleViewerUrl,
  legacyBookList,
  mergeLegacyBookCatalog,
  matchesLegacyDocumentSearch,
} from "../src/pages/branchDocumentDetailParity.js";

test("busqueda documental replica prefijo exclusivo de NombreSubcategoria", () => {
  const entry = {
    categoryName: "Permisos",
    subcategoryName: "Licencia Sanitaria",
    document: { reference: "LCN-01-000004" },
  };
  assert.equal(matchesLegacyDocumentSearch(entry, "lic"), true);
  assert.equal(matchesLegacyDocumentSearch(entry, "sanitaria"), false);
  assert.equal(matchesLegacyDocumentSearch(entry, "Permisos"), false);
  assert.equal(matchesLegacyDocumentSearch(entry, "LCN"), false);
});

test("SearchKeywordLibro permanece desconectado de GetLibros", () => {
  const books = [{ assignmentId: 1, name: "Libro de Quejas" }, { assignmentId: 2, name: "Psicotrópicos" }];
  assert.strictEqual(legacyBookList(books), books);
});

test("Refresh GetLibros conserva las filas stale de GetTblRegistroLibros", () => {
  const detail = {
    branch: { id: 223 },
    books: [{ assignmentId: 137, name: "Anterior", evidences: [{ id: 2, isHistoric: true }] }],
  };
  const merged = mergeLegacyBookCatalog(detail, [
    { assignmentId: 137, bookId: 9, name: "Libro de Psicotrópicos", isRequired: true },
  ]);
  assert.equal(merged.books[0].name, "Libro de Psicotrópicos");
  assert.deepEqual(merged.books[0].evidences, [{ id: 2, isHistoric: true }]);
});

test("resumen replica requeridos registrados por vencer y el typo Otos", () => {
  const summary = buildBranchDocumentSummary([
    { isRequired: true, document: { statusId: 2 } },
    { isRequired: true, document: { statusId: 4 } },
    { isRequired: true, document: null },
    { isRequired: false, document: { statusId: 2 } },
    { isRequired: false, document: { statusId: 1 } },
  ]);
  assert.deepEqual(summary, {
    required: 3,
    registered: 2,
    expiring: 1,
    other: 1,
    registeredPercent: 67,
    expiringPercent: 33,
  });
});

test("indicadores y permisos conservan reglas observadas", () => {
  assert.equal(documentIndicator({ document: { statusId: 2 } }), "registered");
  assert.equal(documentIndicator({ document: { statusId: 4 } }), "pending");
  assert.equal(documentIndicator({ document: { statusId: 5 } }), "expired");
  assert.equal(documentIndicator({ document: null }), null);
  assert.equal(bookIndicator({ evidences: [{ isHistoric: false }] }), "registered");
  assert.equal(bookIndicator({ evidences: [{ isHistoric: true }] }), "registered");
  assert.equal(bookIndicator({ evidences: [] }), null);
  assert.equal(canDeleteBranchDocument(7), true);
  assert.equal(canDeleteBranchDocument(32), true);
  assert.equal(canDeleteBranchDocument(3), false);
  assert.equal(canManageLegacyBookEvidence(7), true);
  assert.equal(canManageLegacyBookEvidence(32), false);
});

test("visor solo interpreta formatos expuestos por el legacy", () => {
  assert.equal(attachmentPreviewKind(".PDF"), "pdf");
  assert.equal(attachmentPreviewKind("jpeg"), "image");
  assert.equal(attachmentPreviewKind("docx"), "google");
  assert.equal(attachmentPreviewMode({ extension: "pdf", hasS3: true }), "s3");
  assert.equal(attachmentPreviewMode({ extension: "pdf", hasS3: false }), "pdf");
  assert.equal(attachmentPreviewMimeType(".PDF"), "application/pdf");
  assert.equal(attachmentPreviewMimeType("jpeg"), "image/jpeg");
  assert.equal(attachmentPreviewMimeType("docx"), "application/octet-stream");
});

test("formatos no nativos usan Google Viewer como el runtime legacy", () => {
  const target = "http://localhost:3003/DocumentacionLegal/api/documents/7/attachment?download=0";
  const viewer = new URL(legacyGoogleViewerUrl(target));
  assert.equal(viewer.origin, "https://docs.google.com");
  assert.equal(viewer.pathname, "/gview");
  assert.equal(viewer.searchParams.get("embedded"), "true");
  assert.equal(viewer.searchParams.get("url"), target);
});
