import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { createS3AuthorizationRepository } from "../src/repositories/s3AuthorizationRepository.js";
import { createTdRouter } from "../src/routes/tdRoutes.js";
import { normalizedSuccess } from "../src/services/serviceResult.js";

async function startServer(context, dependencies) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = {
      id: 99,
      countryCode: Number(req.get("x-test-country") || 4),
      positionCode: 7,
    };
    next();
  });
  app.use(createTdRouter({}, dependencies));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("upload web rechaza claves del cliente y genera la clave en el servidor", async (context) => {
  const uploads = [];
  const origin = await startServer(context, {
    authorizationRepository: { async isKeyAccessible() { return false; } },
    generateKey: () => "srv12345.pdf",
    async uploadFileToS3Impl(payload) {
      uploads.push(payload);
      return normalizedSuccess("Carga simulada.", { upstreamId: 1 });
    },
  });

  const rejected = await fetch(`${origin}/s3/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileText: "contenido", fileName: "archivo.pdf", s3Key: "elegida-cliente" }),
  });
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error.field, "s3Key");
  assert.equal(uploads.length, 0);

  const accepted = await fetch(`${origin}/s3/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileText: "contenido",
      fileName: "archivo.pdf",
      metadata: { countryCode: "otro", uploadedBy: "otro", purpose: "test" },
    }),
  });
  assert.equal(accepted.status, 200);
  const body = await accepted.json();
  assert.equal(body.data.s3Key, "srv12345.pdf");
  assert.equal(uploads[0].s3Key, "srv12345.pdf");
  assert.deepEqual(uploads[0].metadata, { countryCode: "4", uploadedBy: "99", purpose: "test" });
});

test("url y descarga S3 exigen una vinculacion activa del mismo pais", async (context) => {
  const authorizationCalls = [];
  const upstreamCalls = [];
  const origin = await startServer(context, {
    authorizationRepository: {
      async isKeyAccessible(countryCode, s3Key) {
        authorizationCalls.push({ countryCode, s3Key });
        return countryCode === 4 && s3Key === "vinculada.pdf";
      },
    },
    async getS3TemporaryUrlImpl(input) {
      upstreamCalls.push({ operation: "url", input });
      return normalizedSuccess("URL simulada.", { url: "https://example.test/signed" });
    },
    async downloadS3FileImpl(input) {
      upstreamCalls.push({ operation: "download", input });
      return normalizedSuccess("Descarga simulada.", {
        buffer: Buffer.from("archivo-simulado"),
        contentType: "application/pdf",
      });
    },
  });

  const arbitrary = await fetch(`${origin}/s3/url?s3Key=arbitraria.pdf`);
  assert.equal(arbitrary.status, 404);
  assert.equal((await arbitrary.json()).error.code, "FILE_NOT_AVAILABLE");

  const otherCountry = await fetch(`${origin}/s3/url?s3Key=vinculada.pdf`, {
    headers: { "x-test-country": "5" },
  });
  assert.equal(otherCountry.status, 404);
  assert.equal(upstreamCalls.length, 0);

  const validUrl = await fetch(`${origin}/s3/url?s3Key=vinculada.pdf&expiresInSeconds=60`);
  assert.equal(validUrl.status, 200);
  assert.equal((await validUrl.json()).data.url, "https://example.test/signed");

  const validDownload = await fetch(`${origin}/s3/download?s3Key=vinculada.pdf`);
  assert.equal(validDownload.status, 200);
  assert.equal(await validDownload.text(), "archivo-simulado");
  assert.deepEqual(authorizationCalls, [
    { countryCode: 4, s3Key: "arbitraria.pdf" },
    { countryCode: 5, s3Key: "vinculada.pdf" },
    { countryCode: 4, s3Key: "vinculada.pdf" },
    { countryCode: 4, s3Key: "vinculada.pdf" },
  ]);
  assert.deepEqual(upstreamCalls.map(({ operation }) => operation), ["url", "download"]);
});

test("la autorizacion S3 compara claves con sensibilidad a mayusculas en todas las fuentes", async () => {
  const calls = [];
  const repository = createS3AuthorizationRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{ allowed: 1 }], []];
    },
  });

  assert.equal(await repository.isKeyAccessible(4, "ClaveCaseSensitive.PDF"), true);
  assert.equal(calls.length, 1);
  const [{ sql, parameters }] = calls;
  assert.equal((sql.match(/BINARY\s+[A-Za-z]+\.[A-Za-z0-9_]+\s*=\s*BINARY\s+\?/g) || []).length, 13);
  assert.equal((sql.match(/\?/g) || []).length, parameters.length);
  assert.equal(parameters.filter((value) => value === "ClaveCaseSensitive.PDF").length, 13);
  assert.ok(parameters.every((value) => value === "ClaveCaseSensitive.PDF" || value === 4));
});
