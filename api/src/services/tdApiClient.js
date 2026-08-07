import { getPositiveInteger, requireEnvironment } from "../config/runtime.js";
import { normalizedFailure, normalizedSuccess } from "./serviceResult.js";

function buildUrl(pathname, query) {
  const configuredBaseUrl = requireEnvironment("TD_API_BASE_URL").replace(/\/$/, "");
  const url = new URL(`${configuredBaseUrl}/${pathname.replace(/^\//, "")}`);

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function readResponse(response, responseType) {
  if (responseType === "buffer") {
    return Buffer.from(await response.arrayBuffer());
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function tdApiRequest({
  path,
  method = "GET",
  query,
  body,
  responseType = "json",
}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getPositiveInteger("TD_API_TIMEOUT_MS", 30_000),
  );

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      signal: controller.signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await readResponse(response, responseType);
    const message =
      typeof data === "object" && data && !Buffer.isBuffer(data) && data.message
        ? data.message
        : response.ok
          ? "Solicitud completada correctamente."
          : `La API TD respondio con estado ${response.status}.`;

    if (!response.ok) {
      return {
        ...normalizedFailure(message, {
          code: "TD_API_ERROR",
          status: response.status,
          details: data,
        }),
        meta: { status: response.status },
      };
    }

    return {
      ...normalizedSuccess(message, data),
      meta: {
        status: response.status,
        contentType: response.headers.get("content-type"),
        contentDisposition: response.headers.get("content-disposition"),
      },
    };
  } catch (error) {
    const timedOut = error.name === "AbortError";
    return normalizedFailure(
      timedOut ? "La API TD no respondio dentro del tiempo esperado." : "No fue posible conectar con la API TD.",
      {
        code: timedOut ? "TD_API_TIMEOUT" : "TD_API_UNAVAILABLE",
        name: error.name,
        message: error.message,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

