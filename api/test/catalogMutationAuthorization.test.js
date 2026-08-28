import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createCatalogRouter } from "../src/routes/catalogRoutes.js";

async function startCatalogServer(context, auth) {
  const calls = [];
  const record = (operation, result) => async (...args) => {
    calls.push({ operation, args });
    return result;
  };
  const service = {
    listProviders: record("listProviders", { items: [], total: 0, page: 1, pageSize: 10 }),
    listCategories: record("listCategories", { items: [], total: 0, page: 1, pageSize: 10 }),
    listEntities: record("listEntities", { items: [], total: 0, page: 1, pageSize: 10 }),
    createProvider: record("createProvider", { id: 101 }),
    updateProvider: record("updateProvider", { id: 101 }),
    setCategoryAccess: record("setCategoryAccess", { id: 202, accessAllowed: true }),
    createEntity: record("createEntity", { id: 303 }),
    updateEntity: record("updateEntity", { id: 303 }),
    deactivateEntity: record("deactivateEntity", { id: 303, active: false }),
    createLegalAction: record("createLegalAction", { id: 404 }),
    updateLegalAction: record("updateLegalAction", { id: 404 }),
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

const jsonRequest = (method, body = {}) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("las mutaciones de catalogos no heredan el guard 7/15 de permisos de usuario", async (context) => {
  const auth = { id: 30, countryCode: 4, roleCode: 2, positionCode: 32 };
  const { calls, origin } = await startCatalogServer(context, auth);
  const requests = [
    ["/providers", jsonRequest("POST", { commercialName: "Proveedor" }), 201],
    ["/providers/101", jsonRequest("PUT", { commercialName: "Proveedor" }), 200],
    ["/document-categories/202/access", jsonRequest("PATCH", { allowed: true }), 200],
    ["/government-entities", jsonRequest("POST", { name: "Ente" }), 201],
    ["/government-entities/303", jsonRequest("PUT", { name: "Ente" }), 200],
    ["/government-entities/303", { method: "DELETE" }, 200],
    ["/legal-actions", jsonRequest("POST", { name: "Accion" }), 201],
    ["/legal-actions/404", jsonRequest("PUT", { name: "Accion" }), 200],
  ];

  for (const [path, options, expectedStatus] of requests) {
    const response = await fetch(`${origin}${path}`, options);
    assert.equal(response.status, expectedStatus, `${options.method} ${path}`);
  }

  assert.deepEqual(calls.map((call) => call.operation), [
    "createProvider",
    "updateProvider",
    "setCategoryAccess",
    "createEntity",
    "updateEntity",
    "deactivateEntity",
    "createLegalAction",
    "updateLegalAction",
  ]);
  assert.equal(calls[0].args[0], auth);
  assert.equal(calls[2].args[0], auth);
  assert.equal(calls[3].args[0], auth);
  assert.equal(calls[6].args[0], auth);
});

test("las lecturas de proveedores, categorias y entes conservan el pais de la sesion", async (context) => {
  const auth = { id: 30, countryCode: 17, roleCode: 2, positionCode: 32 };
  const { calls, origin } = await startCatalogServer(context, auth);

  const responses = await Promise.all([
    fetch(`${origin}/providers`),
    fetch(`${origin}/document-categories`),
    fetch(`${origin}/government-entities`),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
  assert.deepEqual(
    calls.map((call) => call.operation).sort(),
    ["listCategories", "listEntities", "listProviders"],
  );
  assert.ok(calls.every((call) => call.args[0] === 17));
});
