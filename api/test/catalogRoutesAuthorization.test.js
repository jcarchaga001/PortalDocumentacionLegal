import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createCatalogRouter } from "../src/routes/catalogRoutes.js";

async function startCatalogServer(context, auth) {
  const calls = [];
  const service = {
    async listUsers(session, query) {
      calls.push({ operation: "listUsers", session, query });
      return { items: [], total: 0, page: 1, pageSize: 10 };
    },
    async setUserAccess(session, userId, body) {
      calls.push({ operation: "setUserAccess", session, userId, body });
      return { id: Number(userId), accessAllowed: Boolean(body.allowed) };
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = auth;
    next();
  });
  app.use(createCatalogRouter(service));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    calls,
    origin: `http://127.0.0.1:${server.address().port}`,
  };
}

test("rutas de permisos rechazan lectura y mutacion para puestos no autorizados", async (context) => {
  const { calls, origin } = await startCatalogServer(context, { id: 30, positionCode: 32 });

  const listResponse = await fetch(`${origin}/users`);
  const updateResponse = await fetch(`${origin}/users/22/access`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed: true }),
  });

  assert.equal(listResponse.status, 403);
  assert.equal(updateResponse.status, 403);
  assert.equal((await updateResponse.json()).error.code, "FORBIDDEN");
  assert.deepEqual(calls, []);
});

test("rutas de permisos permiten la mutacion a puestos 7 y 15", async (context) => {
  for (const positionCode of [7, 15]) {
    const { calls, origin } = await startCatalogServer(context, { id: 30, positionCode });
    const response = await fetch(`${origin}/users/22/access`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed: true }),
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].operation, "setUserAccess");
  }
});
