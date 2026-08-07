import assert from "node:assert/strict";
import test from "node:test";
import { createRequireNotificationExecution } from "../src/middlewares/requireNotificationExecution.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request({ dryRun, positionCode = 15, token = "" } = {}) {
  return {
    body: dryRun === undefined ? {} : { dryRun },
    auth: { positionCode },
    get(name) { return name === "x-notification-run-token" ? token : undefined; },
  };
}

test("el guard deja pasar simulaciones sin token", () => {
  const middleware = createRequireNotificationExecution({ enabled: false });
  let nextCalled = false;
  middleware(request(), responseRecorder(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("el guard exige feature flag, puesto permitido y token de 32 bytes", () => {
  const executionToken = "n".repeat(32);
  const disabled = createRequireNotificationExecution({
    enabled: false,
    token: executionToken,
    positionCodes: [15],
  });
  const disabledResponse = responseRecorder();
  disabled(request({ dryRun: false, token: executionToken }), disabledResponse, () => {});
  assert.equal(disabledResponse.statusCode, 403);
  assert.equal(disabledResponse.body.error.code, "NOTIFICATION_EXECUTION_DISABLED");

  const enabled = createRequireNotificationExecution({
    enabled: true,
    token: executionToken,
    positionCodes: [15],
  });
  const forbiddenResponse = responseRecorder();
  enabled(request({ dryRun: false, positionCode: 3, token: executionToken }), forbiddenResponse, () => {});
  assert.equal(forbiddenResponse.body.error.code, "NOTIFICATION_EXECUTION_FORBIDDEN");

  let nextCalled = false;
  enabled(request({ dryRun: false, token: executionToken }), responseRecorder(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("el adaptador de correo directo siempre se considera una ejecucion real", () => {
  const executionToken = "m".repeat(32);
  const middleware = createRequireNotificationExecution({
    enabled: true,
    token: executionToken,
    positionCodes: [15],
    forceLive: true,
  });

  const withoutToken = responseRecorder();
  middleware(request(), withoutToken, () => {});
  assert.equal(withoutToken.statusCode, 403);
  assert.equal(withoutToken.body.error.code, "NOTIFICATION_EXECUTION_FORBIDDEN");

  let nextCalled = false;
  middleware(request({ token: executionToken }), responseRecorder(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
