import { portalApiRequest } from "./portalApiClient.js";

export function getCatalogLookups() {
  return portalApiRequest({ path: "/catalogs/lookups" });
}

export function getPermissionUsers(query) {
  return portalApiRequest({ path: "/catalogs/users", query });
}

export function updatePermissionUser(id, allowed) {
  return portalApiRequest({
    path: `/catalogs/users/${id}/access`,
    method: "PATCH",
    body: { allowed },
  });
}

export function getProviders(query) {
  return portalApiRequest({ path: "/catalogs/providers", query });
}

export function createProvider(payload) {
  return portalApiRequest({ path: "/catalogs/providers", method: "POST", body: payload });
}

export function updateProvider(id, payload) {
  return portalApiRequest({ path: `/catalogs/providers/${id}`, method: "PUT", body: payload });
}

export function getDocumentCategories(query) {
  return portalApiRequest({ path: "/catalogs/document-categories", query });
}

export function updateDocumentCategoryAccess(id, allowed) {
  return portalApiRequest({
    path: `/catalogs/document-categories/${id}/access`,
    method: "PATCH",
    body: { allowed },
  });
}

export function getGovernmentEntities(query) {
  return portalApiRequest({ path: "/catalogs/government-entities", query });
}

export function createGovernmentEntity(payload) {
  return portalApiRequest({ path: "/catalogs/government-entities", method: "POST", body: payload });
}

export function updateGovernmentEntity(id, payload) {
  return portalApiRequest({ path: `/catalogs/government-entities/${id}`, method: "PUT", body: payload });
}

export function deactivateGovernmentEntity(id) {
  return portalApiRequest({ path: `/catalogs/government-entities/${id}`, method: "DELETE" });
}

export function getLegalActions(query) {
  return portalApiRequest({ path: "/catalogs/legal-actions", query });
}

export function createLegalAction(payload) {
  return portalApiRequest({ path: "/catalogs/legal-actions", method: "POST", body: payload });
}

export function updateLegalAction(id, payload) {
  return portalApiRequest({ path: `/catalogs/legal-actions/${id}`, method: "PUT", body: payload });
}
