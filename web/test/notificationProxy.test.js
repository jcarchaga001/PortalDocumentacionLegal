import assert from "node:assert/strict";
import test from "node:test";
import { attachNotificationExecutionToken } from "../notificationProxy.js";

function proxyRecorder() {
  const headers = {};
  return {
    headers,
    proxyRequest: {
      setHeader(name, value) { headers[name] = value; },
    },
  };
}

test("el proxy agrega el token solo al envío manual de documento", () => {
  const token = "t".repeat(32);
  const { headers, proxyRequest } = proxyRecorder();
  const attached = attachNotificationExecutionToken(proxyRequest, {
    method: "POST",
    url: "/DocumentacionLegal/api/notifications/documents/70/expiration/send",
  }, token);

  assert.equal(attached, true);
  assert.equal(headers["x-notification-run-token"], token);
});

test("el proxy no expone tokens cortos ni los agrega a otros endpoints", () => {
  const short = proxyRecorder();
  const other = proxyRecorder();

  assert.equal(attachNotificationExecutionToken(short.proxyRequest, {
    method: "POST",
    url: "/notifications/documents/70/expiration/send",
  }, "corto"), false);
  assert.equal(attachNotificationExecutionToken(other.proxyRequest, {
    method: "POST",
    url: "/notifications/templates/emNotificacionLegal/send",
  }, "t".repeat(32)), false);
  assert.deepEqual(short.headers, {});
  assert.deepEqual(other.headers, {});
});
