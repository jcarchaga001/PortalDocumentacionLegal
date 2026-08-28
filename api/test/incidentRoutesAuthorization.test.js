import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createIncidentRouter } from "../src/routes/incidentRoutes.js";

async function startIncidentServer(context, auth) {
  const calls = [];
  const service = {
    async closeIncident(scope, countryCode, userId, incidentId, body) {
      calls.push({ scope, countryCode, userId, incidentId, body });
      return { id: Number(incidentId) };
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = auth;
    next();
  });
  app.use(createIncidentRouter(service));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    calls,
    origin: `http://127.0.0.1:${server.address().port}`,
  };
}

test("cierre de incidente rechaza un usuario sin puesto ni excepcion antes del servicio", async (context) => {
  const { calls, origin } = await startIncidentServer(context, {
    id: 25,
    countryCode: 4,
    positionCode: 2,
  });

  const response = await fetch(`${origin}/internal/318/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ justification: "No debe ejecutarse" }),
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "FORBIDDEN");
  assert.deepEqual(calls, []);
});

test("cierre de incidente permite puestos 7/32 y la excepcion de usuario 1578", async (context) => {
  const authorized = [
    { id: 25, countryCode: 4, positionCode: 7 },
    { id: 25, countryCode: 4, positionCode: 32 },
    { id: 1578, countryCode: 4, positionCode: 2 },
  ];

  for (const auth of authorized) {
    const { calls, origin } = await startIncidentServer(context, auth);
    const response = await fetch(`${origin}/external/318/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ justification: "Cierre autorizado" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{
      scope: "external",
      countryCode: 4,
      userId: auth.id,
      incidentId: "318",
      body: { justification: "Cierre autorizado" },
    }]);
  }
});
