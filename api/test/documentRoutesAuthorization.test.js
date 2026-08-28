import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createDocumentRouter } from "../src/routes/documentRoutes.js";

async function startDocumentServer(context, auth) {
  const calls = [];
  const service = {
    async remove(session, documentId) {
      calls.push({ operation: "remove", session, documentId });
      return { id: Number(documentId) };
    },
    async removeBookEvidence(session, branchId, evidenceId) {
      calls.push({ operation: "removeBookEvidence", session, branchId, evidenceId });
      return { id: Number(evidenceId) };
    },
  };
  const app = express();
  app.use((req, _res, next) => {
    req.auth = auth;
    next();
  });
  app.use(createDocumentRouter(service));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    calls,
    origin: `http://127.0.0.1:${server.address().port}`,
  };
}

test("eliminaciones documentales rechazan puestos distintos de 7 y 32 antes del servicio", async (context) => {
  const { calls, origin } = await startDocumentServer(context, {
    id: 30,
    countryCode: 4,
    positionCode: 15,
  });

  const documentResponse = await fetch(`${origin}/91`, { method: "DELETE" });
  const evidenceResponse = await fetch(`${origin}/branches/12/books/evidence/33`, {
    method: "DELETE",
  });

  assert.equal(documentResponse.status, 403);
  assert.equal(evidenceResponse.status, 403);
  assert.equal((await documentResponse.json()).error.code, "FORBIDDEN");
  assert.equal((await evidenceResponse.json()).error.code, "FORBIDDEN");
  assert.deepEqual(calls, []);
});

test("eliminaciones documentales permiten puestos 7 y 32 y conservan el objeto solicitado", async (context) => {
  for (const positionCode of [7, 32]) {
    const { calls, origin } = await startDocumentServer(context, {
      id: 30,
      countryCode: 4,
      positionCode,
    });

    const documentResponse = await fetch(`${origin}/91`, { method: "DELETE" });
    const evidenceResponse = await fetch(`${origin}/branches/12/books/evidence/33`, {
      method: "DELETE",
    });

    assert.equal(documentResponse.status, 200);
    assert.equal(evidenceResponse.status, 200);
    assert.deepEqual(calls, [
      {
        operation: "remove",
        session: { id: 30, countryCode: 4, positionCode },
        documentId: "91",
      },
      {
        operation: "removeBookEvidence",
        session: { id: 30, countryCode: 4, positionCode },
        branchId: "12",
        evidenceId: "33",
      },
    ]);
  }
});
