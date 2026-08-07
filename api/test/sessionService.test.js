import assert from "node:assert/strict";
import test from "node:test";
import { createSessionService, SESSION_COOKIE_NAME } from "../src/services/sessionService.js";

const secret = "0123456789abcdef0123456789abcdef";

test("firma y verifica solo el perfil seguro", async () => {
  const service = createSessionService({ secret, basePath: "/DocumentacionLegal", secure: false, ttlSeconds: 60 });
  const token = await service.createToken({
    id: 12,
    name: "Usuario Prueba",
    countryCode: 4,
    roleCode: 7,
    branchCode: 8,
    positionCode: 15,
    mustResetPassword: false,
  });
  const profile = await service.verifyToken(token);
  assert.deepEqual(profile, {
    id: 12,
    name: "Usuario Prueba",
    countryCode: 4,
    roleCode: 7,
    branchCode: 8,
    positionCode: 15,
    mustResetPassword: false,
  });
});

test("cookie de sesion es HttpOnly y queda limitada a la subruta", () => {
  const service = createSessionService({ secret, basePath: "/DocumentacionLegal", secure: true });
  let cookieCall;
  service.setCookie({ cookie(...args) { cookieCall = args; } }, "token");
  assert.equal(cookieCall[0], SESSION_COOKIE_NAME);
  assert.equal(cookieCall[2].httpOnly, true);
  assert.equal(cookieCall[2].secure, true);
  assert.equal(cookieCall[2].sameSite, "lax");
  assert.equal(cookieCall[2].path, "/DocumentacionLegal");
  assert.equal(cookieCall[2].maxAge, undefined);
});
