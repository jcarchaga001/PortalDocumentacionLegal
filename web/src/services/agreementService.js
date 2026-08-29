import { portalApiRequest } from "./portalApiClient.js";

export function getAgreements(filters = {}) {
  return portalApiRequest({ path: "/agreements", query: filters });
}

export function getAgreementCatalogs() {
  return portalApiRequest({ path: "/agreements/catalogs" });
}

export function getAgreementClients() {
  return portalApiRequest({ path: "/agreements/clients" });
}

export function getAgreement(id) {
  return portalApiRequest({ path: `/agreements/${id}` });
}

export function getAgreementContacts(id) {
  return portalApiRequest({ path: `/agreements/${id}/contacts` });
}

export function createAgreement(payload) {
  return portalApiRequest({ path: "/agreements", method: "POST", body: payload });
}

export function updateAgreement(id, payload) {
  return portalApiRequest({ path: `/agreements/${id}`, method: "PUT", body: payload });
}

export function addAgreementAttachment(id, attachment) {
  return portalApiRequest({ path: `/agreements/${id}/attachments`, method: "POST", body: attachment });
}

export function removeAgreementAttachment(id, attachmentId) {
  return portalApiRequest({
    path: `/agreements/${id}/attachments/${attachmentId}`,
    method: "DELETE",
  });
}
