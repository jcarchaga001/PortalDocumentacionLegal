import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createCatalogRouter } from "../src/routes/catalogRoutes.js";

test("GET de sucursales de proveedor conserva el pais autenticado", async (context) => {
  const calls = [];
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { id: 30, countryCode: 17 };
    next();
  });
  app.use(createCatalogRouter({
    async listProviderBranches(countryCode) {
      calls.push({ countryCode });
      return [{ id: 7, name: "FA07 - La Kennedy" }];
    },
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/providers/branches`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ countryCode: 17 }]);
  assert.equal(body.success, true);
  assert.deepEqual(body.data, [{ id: 7, name: "FA07 - La Kennedy" }]);
});

test("GET de destinos pasa país e identificador al contrato de catálogo", async (context) => {
  const calls = [];
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { id: 30, countryCode: 4 };
    next();
  });
  app.use(createCatalogRouter({
    async listProviderDestinations(countryCode, providerId) {
      calls.push({ countryCode, providerId });
      return { items: [], currencySymbol: "L" };
    },
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/providers/77/destinations`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ countryCode: 4, providerId: "77" }]);
  assert.equal(body.success, true);
  assert.deepEqual(body.data, { items: [], currencySymbol: "L" });
});
