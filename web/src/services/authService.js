import { portalApiRequest } from "./portalApiClient.js";

export function getCountries() {
  return portalApiRequest({ path: "/auth/countries" });
}

export function login(credentials) {
  return portalApiRequest({ path: "/auth/login", method: "POST", body: credentials });
}

export function getCurrentUser() {
  return portalApiRequest({ path: "/auth/me" });
}

export function logout() {
  return portalApiRequest({ path: "/auth/logout", method: "POST" });
}

export function requestPasswordRecovery(payload) {
  return portalApiRequest({ path: "/auth/password-recovery", method: "POST", body: payload });
}

export function resetPassword(password) {
  return portalApiRequest({ path: "/auth/reset-password", method: "POST", body: { password } });
}
