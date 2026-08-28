const ACTIVE_DOCUMENT_STATUS_IDS = new Set([2, 4]);

function normalizedText(value) {
  return String(value || "").trim().toLocaleLowerCase("es");
}

export function matchesLegacyDocumentSearch(entry, search) {
  const keyword = normalizedText(search);
  if (!keyword) return true;
  return normalizedText(entry?.subcategoryName).startsWith(keyword);
}

// SearchKeywordLibro is wired in the OML, but GetLibros never consumes it.
// Keeping the returned list untouched preserves that observable legacy defect.
export function legacyBookList(books) {
  return Array.isArray(books) ? books : [];
}

export function currentBookEvidences(book) {
  return (book?.evidences || []).filter((evidence) => !evidence.isHistoric);
}

export function documentIndicator(entry) {
  const statusId = Number(entry?.document?.statusId);
  if (statusId === 2) return "registered";
  if (statusId === 4) return "pending";
  return null;
}

export function bookIndicator(book) {
  return currentBookEvidences(book).length > 0 ? "registered" : "pending";
}

export function canDeleteBranchDocument(positionCode) {
  return [7, 32].includes(Number(positionCode));
}

export function canManageLegacyBookEvidence(positionCode) {
  return Number(positionCode) === 7;
}

export function getDocumentStatusTone(document) {
  const name = normalizedText(document?.statusName);
  if (Number(document?.statusId) === 2 || name === "vigente") return "success";
  if (Number(document?.statusId) === 4 || name.includes("por vencer")) return "warning";
  return document ? "danger" : "neutral";
}

export function buildBranchDocumentSummary(documents) {
  const rows = Array.isArray(documents) ? documents : [];
  const required = rows.filter((entry) => entry.isRequired);
  const registeredRequired = required.filter((entry) => (
    ACTIVE_DOCUMENT_STATUS_IDS.has(Number(entry.document?.statusId))
  ));
  const expiringRequired = required.filter((entry) => Number(entry.document?.statusId) === 4);
  const activeDocuments = rows.filter((entry) => (
    ACTIVE_DOCUMENT_STATUS_IDS.has(Number(entry.document?.statusId))
  ));
  const requiredCount = required.length;

  return {
    required: requiredCount,
    registered: registeredRequired.length,
    expiring: expiringRequired.length,
    other: Math.max(0, activeDocuments.length - registeredRequired.length),
    registeredPercent: requiredCount
      ? Math.round((registeredRequired.length / requiredCount) * 100)
      : 0,
    expiringPercent: requiredCount
      ? Math.round((expiringRequired.length / requiredCount) * 100)
      : 0,
  };
}

export function attachmentPreviewKind(extension) {
  const normalized = normalizedText(extension).replace(/^\./, "");
  if (["jpg", "jpeg", "png", "bmp"].includes(normalized)) return "image";
  if (normalized === "pdf") return "pdf";
  return "google";
}

export function attachmentPreviewMode(attachment) {
  if (attachment?.hasS3) return "s3";
  return attachmentPreviewKind(attachment?.extension);
}

export function legacyGoogleViewerUrl(attachmentUrl) {
  const viewer = new URL("https://docs.google.com/gview");
  viewer.searchParams.set("embedded", "true");
  viewer.searchParams.set("url", attachmentUrl);
  return viewer.toString();
}

export function attachmentPreviewMimeType(extension) {
  const normalized = normalizedText(extension).replace(/^\./, "");
  return {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    bmp: "image/bmp",
  }[normalized] || "application/octet-stream";
}
