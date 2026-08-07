import assert from "node:assert/strict";
import test from "node:test";
import { createRequireAuthorization } from "../src/middlewares/requireAuthorization.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("cierre de incidentes conserva puestos y excepcion de usuario del legacy", () => {
  const middleware = createRequireAuthorization({ positionCodes: [7, 32], userIds: [1578] });
  for (const auth of [{ id: 8, positionCode: 7 }, { id: 9, positionCode: 32 }, { id: 1578, positionCode: 2 }]) {
    let advanced = false;
    middleware({ auth }, responseRecorder(), () => { advanced = true; });
    assert.equal(advanced, true);
  }

  const response = responseRecorder();
  let advanced = false;
  middleware({ auth: { id: 25, positionCode: 2 } }, response, () => { advanced = true; });
  assert.equal(advanced, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, "FORBIDDEN");
});

test("gestion de permisos de usuarios queda limitada a puestos 7 y 15", () => {
  const middleware = createRequireAuthorization({ positionCodes: [7, 15] });

  for (const positionCode of [7, 15]) {
    let advanced = false;
    middleware({ auth: { id: 20, positionCode } }, responseRecorder(), () => { advanced = true; });
    assert.equal(advanced, true);
  }

  const response = responseRecorder();
  let advanced = false;
  middleware({ auth: { id: 20, positionCode: 32 } }, response, () => { advanced = true; });
  assert.equal(advanced, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.code, "FORBIDDEN");
});
