import { portalApiRequest } from "./portalApiClient.js";

export function getApiHealth() {
  return portalApiRequest({ path: "health" });
}

