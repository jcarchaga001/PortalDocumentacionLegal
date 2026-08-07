import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";

function dependencies() {
  return {
    authService: {
      async authenticate() {
        return { id: 1, name: "Usuario Seguro", countryCode: 4, roleCode: 7, branchCode: null, positionCode: 15, mustResetPassword: false };
      },
    },
    sessionService: {
      async createToken() { return "test-token"; },
      async verifyToken() { return { id: 1, countryCode: 4 }; },
      setCookie(res) { res.setHeader("Set-Cookie", "dl_session=test-token; Path=/DocumentacionLegal; HttpOnly; SameSite=Lax"); },
      clearCookie() {},
    },
  };
}

test("login es publico y los dominios funcionales requieren sesion", async (context) => {
  const server = createServer(createApp({ basePath: "/DocumentacionLegal", authDependencies: dependencies() }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}/DocumentacionLegal/api`;

  const countries = await fetch(`${origin}/auth/countries`);
  const login = await fetch(`${origin}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "usuario", password: "clave", countryCode: 4 }),
  });
  const dashboard = await fetch(`${origin}/dashboard/summary`);
  const notifications = await fetch(`${origin}/notifications/templates`);
  const td = await fetch(`${origin}/td/mail/health`);

  assert.equal(countries.status, 200);
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  assert.equal(dashboard.status, 401);
  assert.equal(notifications.status, 401);
  assert.equal(td.status, 401);
});

test("una sesion con clave temporal solo accede al flujo de cambio obligatorio", async (context) => {
  const authDependencies = dependencies();
  authDependencies.sessionService.verifyToken = async () => ({
    id: 1,
    name: "Usuario Seguro",
    countryCode: 4,
    roleCode: 7,
    branchCode: null,
    positionCode: 15,
    mustResetPassword: true,
  });
  const server = createServer(createApp({ basePath: "/DocumentacionLegal", authDependencies }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}/DocumentacionLegal/api`;
  const headers = { Cookie: "dl_session=test-token" };

  const me = await fetch(`${origin}/auth/me`, { headers });
  const dashboard = await fetch(`${origin}/dashboard/summary`, { headers });

  assert.equal(me.status, 200);
  assert.equal(dashboard.status, 403);
  assert.equal((await dashboard.json()).error.code, "PASSWORD_RESET_REQUIRED");
});
