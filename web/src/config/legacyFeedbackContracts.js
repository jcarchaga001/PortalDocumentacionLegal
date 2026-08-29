export const LEGACY_FEEDBACK_CONTRACTS = Object.freeze({
  emptyExport: Object.freeze({ type: "warning", message: "No hay registros a exportar." }),
  missingDocumentAttachment: Object.freeze({ type: "error", message: "No hay archivo para descargar" }),
  unsupportedDocumentFormat: Object.freeze({ type: "info", message: "El formato del documento no es permitido" }),
  missingFileToDelete: Object.freeze({ type: "info", message: "No existe archivo para eliminar" }),
});

export function showLegacyFeedback(messageApi, contract, overrideMessage) {
  if (!messageApi || !contract || typeof messageApi[contract.type] !== "function") return;
  messageApi[contract.type](overrideMessage || contract.message);
}

export function isMissingDocumentAttachmentResult(result) {
  return result?.error?.code === "DOCUMENT_ATTACHMENT_NOT_FOUND";
}
