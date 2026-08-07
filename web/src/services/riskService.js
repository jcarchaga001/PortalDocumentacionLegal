import { portalApiRequest } from "./portalApiClient.js";

export function getRiskAnalyses(query = {}) {
  return portalApiRequest({ path: "risk", query });
}

export function getRiskCatalogs() {
  return portalApiRequest({ path: "risk/catalogs" });
}

export function getRiskAnalysisDetail(codArchivo) {
  return portalApiRequest({ path: `risk/${encodeURIComponent(codArchivo)}` });
}
