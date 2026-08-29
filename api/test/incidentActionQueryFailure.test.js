import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentController } from "../src/controllers/incidentController.js";

function responseRecorder() {
  const state = { body: undefined, status: 200 };
  const response = {
    status(status) {
      state.status = status;
      return response;
    },
    json(body) {
      state.body = body;
      return response;
    },
  };
  return { response, state };
}

test("normaliza un fallo MySQL del listado con el mensaje observable del legacy", async () => {
  const databaseError = Object.assign(
    new Error("SELECT secreto FROM tabla_interna"),
    {
      code: "ER_CANT_AGGREGATE_NCOLLATIONS",
      errno: 1267,
      sqlState: "HY000",
      sqlMessage: "Illegal mix of collations",
    },
  );
  const logs = [];
  const controller = createIncidentController({
    async listActions() {
      throw databaseError;
    },
  }, {
    logError(...parameters) {
      logs.push(parameters);
    },
  });
  const { response, state } = responseRecorder();
  let forwarded;

  await controller.actions(
    { auth: { countryCode: 4 }, params: { scope: "internal" }, query: {} },
    response,
    (error) => { forwarded = error; },
  );

  assert.equal(forwarded, undefined);
  assert.equal(state.status, 500);
  assert.deepEqual(state.body, {
    success: false,
    message: "Error executing query.",
    data: null,
    error: { code: "INCIDENT_ACTION_QUERY_ERROR" },
  });
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0], [
    "Incident action query failed.",
    { code: "ER_CANT_AGGREGATE_NCOLLATIONS", errno: 1267, sqlState: "HY000" },
  ]);
  assert.doesNotMatch(JSON.stringify(logs), /SELECT secreto|Illegal mix of collations/);
});

test("un error de dominio ajeno a la consulta conserva el middleware normal", async () => {
  const validationError = Object.assign(new Error("Scope invalido."), {
    code: "VALIDATION_ERROR",
    status: 400,
  });
  const controller = createIncidentController({
    async listActions() {
      throw validationError;
    },
  }, {
    logError() {
      throw new Error("No debe registrar un error de dominio como fallo SQL.");
    },
  });
  const { response, state } = responseRecorder();
  let forwarded;

  await controller.actions(
    { auth: { countryCode: 4 }, params: { scope: "internal" }, query: {} },
    response,
    (error) => { forwarded = error; },
  );

  assert.equal(forwarded, validationError);
  assert.equal(state.status, 200);
  assert.equal(state.body, undefined);
});

test("normaliza también el fallo de GetPersonasAccionesFiltro sin borrar el Aggregate", async () => {
  const databaseError = Object.assign(new Error("query failed"), {
    code: "ER_CANT_AGGREGATE_NCOLLATIONS",
    sqlState: "HY000",
  });
  const logs = [];
  const controller = createIncidentController({
    async catalogs() {
      throw databaseError;
    },
  }, {
    logError(...parameters) {
      logs.push(parameters);
    },
  });
  const { response, state } = responseRecorder();
  let forwarded;

  await controller.catalogs(
    { auth: { countryCode: 4 }, params: { scope: "external-actions" }, query: {} },
    response,
    (error) => { forwarded = error; },
  );

  assert.equal(forwarded, undefined);
  assert.equal(state.status, 500);
  assert.equal(state.body.message, "Error executing query.");
  assert.equal(state.body.error.code, "INCIDENT_ACTION_QUERY_ERROR");
  assert.deepEqual(logs[0], [
    "Incident action catalog query failed.",
    { code: "ER_CANT_AGGREGATE_NCOLLATIONS", errno: null, sqlState: "HY000" },
  ]);
});
