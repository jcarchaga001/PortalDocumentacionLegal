import { portalApiRequest, portalApiUrl } from "./portalApiClient.js";

export function getDocuments(filters = {}) {
  return portalApiRequest({ path: "/documents", query: filters });
}

export function getAdministrativeDocuments(filters = {}) {
  return getDocuments({ ...filters, documentType: "administrative" });
}

export function getExpiringDocuments(filters = {}) {
  return getDocuments({
    ...filters,
    documentType: "all",
    includeInactive: true,
    statusId: 4,
  });
}

export function sendDocumentExpirationEmail(documentId) {
  return portalApiRequest({
    path: `/notifications/documents/${documentId}/expiration/send`,
    method: "POST",
    body: { dryRun: false },
  });
}

export function getDocumentCatalogs(documentType = "branch") {
  return portalApiRequest({ path: "/documents/catalogs", query: { documentType } });
}

export function createDocument(document) {
  return portalApiRequest({ path: "/documents", method: "POST", body: document });
}

export function getDocument(documentId) {
  return portalApiRequest({ path: `/documents/${documentId}` });
}

export function updateDocumentReference2(documentId, secondaryReference) {
  return portalApiRequest({
    path: `/documents/${documentId}/reference-2`,
    method: "PATCH",
    body: { secondaryReference },
  });
}

export function approveDocument(documentId) {
  return portalApiRequest({ path: `/documents/${documentId}/approve`, method: "POST" });
}

export function rejectDocument(documentId) {
  return portalApiRequest({ path: `/documents/${documentId}/reject`, method: "POST" });
}

export function deleteDocument(documentId) {
  return portalApiRequest({ path: `/documents/${documentId}`, method: "DELETE" });
}

export function getDocumentAttachment(documentId, download = false) {
  return portalApiRequest({
    path: `/documents/${documentId}/attachment`,
    query: { download: download ? 1 : 0 },
    responseType: "blob",
  });
}

export function getDocumentAttachmentPreviewUrl(documentId) {
  return portalApiUrl({ path: `/documents/${documentId}/attachment`, query: { download: 0 } });
}

export function getBranchDocumentDetail(branchId) {
  return portalApiRequest({ path: `/documents/branches/${branchId}` });
}

export function createBranchDocument(branchId, document) {
  return portalApiRequest({
    path: `/documents/branches/${branchId}/documents`,
    method: "POST",
    body: document,
  });
}

export function addBookEvidence(branchId, assignmentId, attachment) {
  return portalApiRequest({
    path: `/documents/branches/${branchId}/books/${assignmentId}/evidence`,
    method: "POST",
    body: { attachment },
  });
}

export function updateBookRequired(branchId, assignmentId, isRequired) {
  return portalApiRequest({
    path: `/documents/branches/${branchId}/books/${assignmentId}`,
    method: "PATCH",
    body: { isRequired },
  });
}

export function getBookEvidence(branchId, evidenceId, download = false) {
  return portalApiRequest({
    path: `/documents/branches/${branchId}/books/evidence/${evidenceId}/attachment`,
    query: { download: download ? 1 : 0 },
    responseType: "blob",
  });
}

export function getBookEvidencePreviewUrl(branchId, evidenceId) {
  return portalApiUrl({
    path: `/documents/branches/${branchId}/books/evidence/${evidenceId}/attachment`,
    query: { download: 0 },
  });
}

export function deleteBookEvidence(branchId, evidenceId) {
  return portalApiRequest({
    path: `/documents/branches/${branchId}/books/evidence/${evidenceId}`,
    method: "DELETE",
  });
}
