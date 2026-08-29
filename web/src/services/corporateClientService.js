import { portalApiRequest } from "./portalApiClient.js";

export function getCorporateClients(filters = {}) {
  return portalApiRequest({ path: "/corporate-clients", query: filters });
}

export function getCorporateClient(id) {
  return portalApiRequest({ path: `/corporate-clients/${id}` });
}

export function getCorporateClientContacts(id) {
  return portalApiRequest({ path: `/corporate-clients/${id}/contacts` });
}

export function createCorporateClient(payload) {
  return portalApiRequest({ path: "/corporate-clients", method: "POST", body: payload });
}

export function updateCorporateClient(id, payload) {
  return portalApiRequest({ path: `/corporate-clients/${id}`, method: "PUT", body: payload });
}

export function setCorporateClientStatus(id, isActive) {
  return portalApiRequest({
    path: `/corporate-clients/${id}/status`,
    method: "PATCH",
    body: { isActive },
  });
}

export function bulkUpsertCorporateClients(items) {
  return portalApiRequest({ path: "/corporate-clients/bulk", method: "POST", body: { items } });
}
