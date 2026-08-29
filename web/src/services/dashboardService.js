import { portalApiRequest } from "./portalApiClient.js";

export function getDashboardSummary() {
  return portalApiRequest({ path: "/dashboard/summary" });
}

export function getDashboardDocuments(query = {}) {
  return portalApiRequest({ path: "/dashboard/documents", query });
}

export function getDashboardExportRows() {
  return portalApiRequest({ path: "/dashboard/export-rows" });
}

export function getBranchMonitoring(filters = {}) {
  return portalApiRequest({ path: "/dashboard/monitoring", query: filters });
}

export function getBranchMonitoringCatalogs() {
  return portalApiRequest({ path: "/dashboard/monitoring/catalogs" });
}
