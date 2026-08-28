import { runtimeConfig } from "../config/runtime.js";

export function normalizedSuccess(message, data = null) {
  return { success: true, message, data, error: null };
}

export function normalizedFailure(message, error, data = null) {
  return { success: false, message, data, error };
}

function buildApiUrl(path, query) {
  const cleanPath = path.replace(/^\//, "");
  const base = runtimeConfig.apiBaseUrl;
  const isAbsolute = /^https?:\/\//i.test(base);
  const url = isAbsolute
    ? new URL(`${base}/${cleanPath}`)
    : new URL(`${base}/${cleanPath}`, window.location.origin);

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export function portalApiUrl({ path, query }) {
  return buildApiUrl(path, query).toString();
}

export async function portalApiRequest({ path, method = "GET", query, body, responseType = "json" }) {
  try {
    const response = await fetch(buildApiUrl(path, query), {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (responseType === "blob" && response.ok) {
      return normalizedSuccess("Archivo descargado correctamente.", await response.blob());
    }

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      return result || normalizedFailure(`La solicitud fallo con estado ${response.status}.`, {
        code: "API_ERROR",
        status: response.status,
      });
    }

    return result || normalizedSuccess("Solicitud completada correctamente.");
  } catch (error) {
    return normalizedFailure("No fue posible conectar con el API del portal.", {
      code: "API_UNAVAILABLE",
      name: error.name,
      message: error.message,
    });
  }
}
