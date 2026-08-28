import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";

function createAuthDependencies({ verifyToken } = {}) {
  const clearedCookies = [];

  return {
    clearedCookies,
    dependencies: {
      authService: {
        async listCountries() {
          return [{ countryCode: 4, name: "Honduras" }];
        },
        async authenticate() {
          return {
            id: 1,
            name: "Usuario Seguro",
            countryCode: 4,
            roleCode: 7,
            branchCode: null,
            positionCode: 15,
            mustResetPassword: false,
          };
        },
      },
      sessionService: {
        async createToken() {
          return "test-token";
        },
        async verifyToken(token) {
          if (verifyToken) return verifyToken(token);
          return { id: 1, countryCode: 4 };
        },
        setCookie() {},
        clearCookie(res) {
          clearedCookies.push(true);
          res.setHeader(
            "Set-Cookie",
            "dl_session=; Path=/DocumentacionLegal; Max-Age=0; HttpOnly; SameSite=Lax",
          );
        },
      },
    },
  };
}

async function withServer(authDependencies, callback) {
  const server = createServer(createApp({ basePath: "/DocumentacionLegal", authDependencies }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}/DocumentacionLegal/api`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("logout limpia la cookie y confirma el cierre de la sesion local", async () => {
  const { dependencies, clearedCookies } = createAuthDependencies();

  await withServer(dependencies, async (origin) => {
    const response = await fetch(`${origin}/auth/logout`, { method: "POST" });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal(result.success, true);
    assert.equal(result.message, "Sesion cerrada correctamente.");
  });

  assert.equal(clearedCookies.length, 1);
});

test("una cookie invalida se elimina antes de responder UNAUTHENTICATED", async () => {
  const { dependencies, clearedCookies } = createAuthDependencies({
    async verifyToken() {
      throw new Error("token invalido");
    },
  });

  await withServer(dependencies, async (origin) => {
    const response = await fetch(`${origin}/auth/me`, {
      headers: { Cookie: "dl_session=invalid-token" },
    });
    const result = await response.json();

    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal(result.success, false);
    assert.equal(result.message, "La sesion no es valida o ha vencido.");
    assert.equal(result.error.code, "UNAUTHENTICATED");
  });

  assert.equal(clearedCookies.length, 1);
});
