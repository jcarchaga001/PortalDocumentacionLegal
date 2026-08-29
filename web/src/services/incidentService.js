import { portalApiRequest } from "./portalApiClient.js";

export function getIncidentCatalogs(scope, query = {}) {
  return portalApiRequest({ path: `/incidents/catalogs/${scope}`, query });
}

export function getIncidents(scope, query = {}) {
  return portalApiRequest({ path: `/incidents/${scope}`, query });
}

export function getIncidentActions(scope, query = {}) {
  return portalApiRequest({ path: `/incidents/${scope}/actions`, query });
}

export function getLaborCases(query = {}) {
  return portalApiRequest({ path: "/incidents/labor/cases", query });
}

export function getLaborActions(query = {}) {
  return portalApiRequest({ path: "/incidents/labor/actions", query });
}

export function getIncident(scope, incidentId) {
  return portalApiRequest({ path: `/incidents/${scope}/${incidentId}` });
}

export function getIncidentActionDetail(scope, incidentId, actionId) {
  return portalApiRequest({ path: `/incidents/${scope}/${incidentId}/actions/${actionId}` });
}

export function createIncident(scope, body) {
  return portalApiRequest({ path: `/incidents/${scope}`, method: "POST", body });
}

export function createIncidentAction(scope, incidentId, body) {
  return portalApiRequest({ path: `/incidents/${scope}/${incidentId}/actions`, method: "POST", body });
}

export function updateIncidentAction(scope, actionId, body) {
  return portalApiRequest({ path: `/incidents/${scope}/actions/${actionId}`, method: "PATCH", body });
}

export function closeIncident(scope, incidentId, body) {
  return portalApiRequest({ path: `/incidents/${scope}/${incidentId}/close`, method: "POST", body });
}

export function addIncidentComment(scope, incidentId, body) {
  return portalApiRequest({ path: `/incidents/${scope}/${incidentId}/comments`, method: "POST", body });
}

export function getLaborCase(caseId) {
  return portalApiRequest({ path: `/incidents/labor/cases/${caseId}` });
}

export function createLaborAction(caseId, body) {
  return portalApiRequest({ path: `/incidents/labor/cases/${caseId}/actions`, method: "POST", body });
}

export function updateLaborAction(actionId, body) {
  return portalApiRequest({ path: `/incidents/labor/actions/${actionId}`, method: "PATCH", body });
}

export function updateLaborCase(caseId, body) {
  return portalApiRequest({ path: `/incidents/labor/cases/${caseId}`, method: "PATCH", body });
}

export function addLaborComment(caseId, body) {
  return portalApiRequest({ path: `/incidents/labor/cases/${caseId}/comments`, method: "POST", body });
}
