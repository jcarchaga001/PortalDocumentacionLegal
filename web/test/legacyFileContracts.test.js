import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_AGREEMENT_UPLOAD,
  LEGACY_FILE_MESSAGES,
  LEGACY_NATIVE_UPLOADS,
  legacyAgreementStoredExtension,
  validateLegacyAgreementCandidate,
  validateLegacyDocumentFileName,
  validateLegacyIncidentCommentFileName,
  validateLegacyIncidentFileName,
} from "../src/config/legacyFileContracts.js";

test("el inventario conserva las 19 cargas Upload nativas del OML sin Accept inventado", () => {
  assert.equal(LEGACY_NATIVE_UPLOADS.length, 19);
  assert.ok(LEGACY_NATIVE_UPLOADS.every(({ accept }) => accept === ""));
  assert.equal(LEGACY_NATIVE_UPLOADS.filter(({ mandatory }) => mandatory).length, 7);
});

test("documentos aceptan solo las extensiones de ComprimirArchivosMultimedia", () => {
  for (const extension of ["pdf", "jpg", "jpeg", "png", "bmp", "PDF"]) {
    assert.equal(validateLegacyDocumentFileName(`archivo.${extension}`).valid, true);
  }
  assert.deepEqual(validateLegacyDocumentFileName("archivo.docx"), {
    valid: false,
    message: "El formato del documento no es permitido",
  });
});

test("evidencias conservan extensiones y variantes tipograficas exactas del legacy", () => {
  for (const extension of ["png", "jpeg", "jpg", "pdf"]) {
    assert.equal(validateLegacyIncidentFileName(`evidencia.${extension}`).valid, true);
  }
  assert.equal(
    validateLegacyIncidentFileName("evidencia.docx").message,
    LEGACY_FILE_MESSAGES.incidentUnsupported,
  );
  assert.equal(
    validateLegacyIncidentFileName("evidencia.docx", { legal: true }).message,
    LEGACY_FILE_MESSAGES.legalIncidentUnsupported,
  );
});

test("adjuntos de comentarios aceptan solo imagenes y conservan ambas variantes legacy", () => {
  for (const extension of ["png", "jpeg", "jpg", "PNG"]) {
    assert.equal(validateLegacyIncidentCommentFileName(`comentario.${extension}`).valid, true);
  }
  assert.deepEqual(validateLegacyIncidentCommentFileName("comentario.pdf"), {
    valid: false,
    message: "La extención del Archivo no es Valido. (Solo permite .PNG o .JPEG)",
  });
  assert.deepEqual(validateLegacyIncidentCommentFileName("comentario.pdf", { legal: true }), {
    valid: false,
    message: "La extensión del archivo no es válido. (Solo permite .PNG o .JPEG)",
  });
});

test("convenios conservan Accept, cantidad, tamano y extension con punto del bloque legacy", () => {
  assert.equal(
    LEGACY_AGREEMENT_UPLOAD.accept,
    ".pdf,.jpeg,.jpg,.png,.docx,.doc,.xls,.xlsx,.txt",
  );
  assert.equal(LEGACY_AGREEMENT_UPLOAD.maxFiles, 500);
  assert.equal(LEGACY_AGREEMENT_UPLOAD.maxFileBytes, 100_000_000);
  assert.equal(legacyAgreementStoredExtension("contrato.final.PDF"), ".final.PDF");
  assert.equal(validateLegacyAgreementCandidate({ name: "contrato.pdf", size: 100_000_000 }).valid, true);
  assert.equal(validateLegacyAgreementCandidate({ name: "contrato.zip", size: 1 }).code, "UNSUPPORTED_EXTENSION");
  assert.equal(validateLegacyAgreementCandidate({ name: "contrato.pdf", size: 100_000_001 }).code, "MAX_FILE_SIZE");
  assert.equal(validateLegacyAgreementCandidate({ name: "contrato.pdf", size: 1 }, 500).code, "MAX_FILES");
});
