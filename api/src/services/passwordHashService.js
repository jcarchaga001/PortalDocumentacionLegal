import { getPositiveInteger, requireEnvironment } from "../config/runtime.js";

const MD5_PATTERN = /^[a-f\d]{32}$/i;

export class AuthProviderError extends Error {
  constructor(message = "El proveedor de autenticacion no esta disponible.") {
    super(message);
    this.name = "AuthProviderError";
    this.status = 503;
    this.code = "AUTH_PROVIDER_UNAVAILABLE";
  }
}

export function findCredentialHash(value) {
  if (typeof value === "string") {
    const candidate = value.trim().replace(/^"|"$/g, "");
    return MD5_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findCredentialHash(entry);
      if (found) return found;
    }
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      const found = findCredentialHash(entry);
      if (found) return found;
    }
  }

  return null;
}

export function createPasswordHashService({
  fetchImpl = globalThis.fetch,
  hashUrl = requireEnvironment("AUTH_HASH_URL"),
  timeoutMs = getPositiveInteger("AUTH_HASH_TIMEOUT_MS", 5_000),
} = {}) {
  let providerUrl;
  try {
    providerUrl = new URL(hashUrl);
  } catch {
    throw new AuthProviderError();
  }
  if (providerUrl.protocol !== "https:" || providerUrl.username || providerUrl.password) {
    throw new AuthProviderError();
  }

  return {
    async hash(password) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const url = new URL(providerUrl);
        url.searchParams.set("Text", password);

        const response = await fetchImpl(url, {
          method: "GET",
          headers: { Accept: "application/json, text/plain" },
          signal: controller.signal,
        });

        if (!response.ok) throw new AuthProviderError();

        const rawBody = await response.text();
        let parsedBody = rawBody;

        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          // El proveedor tambien puede responder texto plano.
        }

        const credential = findCredentialHash(parsedBody);
        if (!credential) throw new AuthProviderError();
        return credential;
      } catch (error) {
        if (error instanceof AuthProviderError) throw error;
        throw new AuthProviderError();
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
