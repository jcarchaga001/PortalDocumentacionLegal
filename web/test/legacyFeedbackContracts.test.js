import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_FEEDBACK_CONTRACTS,
  isMissingDocumentAttachmentResult,
  showLegacyFeedback,
} from "../src/config/legacyFeedbackContracts.js";

test("contratos de feedback conservan tipo y texto observable del OML", () => {
  assert.deepEqual(LEGACY_FEEDBACK_CONTRACTS.emptyExport, {
    type: "warning",
    message: "No hay registros a exportar.",
  });
  assert.deepEqual(LEGACY_FEEDBACK_CONTRACTS.missingDocumentAttachment, {
    type: "error",
    message: "No hay archivo para descargar",
  });
  assert.deepEqual(LEGACY_FEEDBACK_CONTRACTS.unsupportedDocumentFormat, {
    type: "info",
    message: "El formato del documento no es permitido",
  });
  assert.deepEqual(LEGACY_FEEDBACK_CONTRACTS.missingFileToDelete, {
    type: "info",
    message: "No existe archivo para eliminar",
  });
});

test("dispatcher usa la severidad legacy sin reescribir el mensaje", () => {
  const calls = [];
  const api = {
    warning(value) { calls.push(["warning", value]); },
    error(value) { calls.push(["error", value]); },
    info(value) { calls.push(["info", value]); },
  };
  showLegacyFeedback(api, LEGACY_FEEDBACK_CONTRACTS.emptyExport);
  showLegacyFeedback(api, LEGACY_FEEDBACK_CONTRACTS.unsupportedDocumentFormat, "Texto exacto");
  assert.deepEqual(calls, [["warning", "No hay registros a exportar."], ["info", "Texto exacto"]]);
});

test("solo el codigo de adjunto ausente cambia al texto legacy", () => {
  assert.equal(isMissingDocumentAttachmentResult({ error: { code: "DOCUMENT_ATTACHMENT_NOT_FOUND" } }), true);
  assert.equal(isMissingDocumentAttachmentResult({ error: { code: "S3_FAILURE" } }), false);
});
