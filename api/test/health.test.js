import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";
import { getDatabaseHealth } from "../src/services/systemHealthService.js";

test("health solo responde bajo BASE_PATH + /api", async (context) => {
  const authDependencies = {
    authService: { authenticate: async () => ({}) },
    sessionService: {
      createToken: async () => "test-token",
      verifyToken: async () => ({}),
      setCookie() {},
      clearCookie() {},
    },
  };
  const server = createServer(createApp({ basePath: "/NOMBRE_PROYECTO", authDependencies }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  const validResponse = await fetch(`http://127.0.0.1:${port}/NOMBRE_PROYECTO/api/health`);
  const invalidResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
  const result = await validResponse.json();

  assert.equal(validResponse.status, 200);
  assert.equal(result.success, true);
  assert.equal(invalidResponse.status, 404);
});

test("el proxy confiable queda limitado al loopback inmediato", () => {
  const app = createApp({
    basePath: "/NOMBRE_PROYECTO",
    authDependencies: {
      authService: { authenticate: async () => ({}) },
      sessionService: {
        createToken: async () => "test-token",
        verifyToken: async () => ({}),
        setCookie() {},
        clearCookie() {},
      },
    },
  });
  const trustProxy = app.get("trust proxy fn");
  assert.equal(trustProxy("127.0.0.1"), true);
  assert.equal(trustProxy("::1"), true);
  assert.equal(trustProxy("203.0.113.5"), false);
});

test("health de base de datos no expone el mensaje interno", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await getDatabaseHealth(async () => {
      const error = new Error("Access denied for private-user@private-host/private-db");
      error.code = "ER_ACCESS_DENIED_ERROR";
      throw error;
    });
    assert.equal(result.success, false);
    assert.equal(result.error.code, "DATABASE_UNAVAILABLE");
    assert.equal(JSON.stringify(result).includes("private-host"), false);
  } finally {
    console.error = originalError;
  }
});
