function normalizeBasePath(value, variableName) {
  const normalized = value?.trim().replace(/\/$/, "");
  if (!normalized || !normalized.startsWith("/") || normalized === "/") {
    throw new Error(`${variableName} debe definir una subruta como /NOMBRE_PROYECTO.`);
  }
  return normalized;
}

function normalizeApiBaseUrl(value) {
  const normalized = value?.trim().replace(/\/$/, "");
  if (!normalized) {
    throw new Error("Falta VITE_API_BASE_URL. Configure la URL del API para la subruta real.");
  }
  return normalized;
}

export const runtimeConfig = Object.freeze({
  basePath: normalizeBasePath(import.meta.env.VITE_BASE_PATH, "VITE_BASE_PATH"),
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  postLogoutUrl:
    import.meta.env.VITE_POST_LOGOUT_URL?.trim()
    || "https://fep-dev.outsystemsenterprise.com/IndicedeAplicaciones/scrInicio",
});
