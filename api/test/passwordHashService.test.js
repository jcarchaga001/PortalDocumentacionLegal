import assert from "node:assert/strict";
import test from "node:test";
import { AuthProviderError, createPasswordHashService, findCredentialHash } from "../src/services/passwordHashService.js";

test("extrae la credencial de respuestas JSON anidadas", () => {
  assert.equal(findCredentialHash({ result: { hash: "ABCDEF0123456789ABCDEF0123456789" } }), "abcdef0123456789abcdef0123456789");
  assert.equal(findCredentialHash({ result: "no-es-hash" }), null);
});

test("codifica caracteres especiales sin registrar ni alterar la clave", async () => {
  let requestedUrl;
  const service = createPasswordHashService({
    hashUrl: "https://example.test/GenerateMD5",
    timeoutMs: 1000,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ value: "1".repeat(32) }), { status: 200 });
    },
  });

  const hash = await service.hash("clave #&+% segura");
  assert.equal(hash, "1".repeat(32));
  assert.equal(requestedUrl.searchParams.get("Text"), "clave #&+% segura");
});

test("rechaza respuestas invalidas del proveedor", async () => {
  const service = createPasswordHashService({
    hashUrl: "https://example.test/GenerateMD5",
    timeoutMs: 1000,
    fetchImpl: async () => new Response("respuesta inesperada", { status: 200 }),
  });
  await assert.rejects(() => service.hash("clave"), AuthProviderError);
});

test("el proveedor de credenciales debe usar HTTPS sin credenciales embebidas", () => {
  assert.throws(
    () => createPasswordHashService({ hashUrl: "http://example.test/GenerateMD5" }),
    AuthProviderError,
  );
  assert.throws(
    () => createPasswordHashService({ hashUrl: "https://usuario:clave@example.test/GenerateMD5" }),
    AuthProviderError,
  );
});
