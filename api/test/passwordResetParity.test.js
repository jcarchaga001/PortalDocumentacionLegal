import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAuthController } from "../src/controllers/authController.js";
import { createPersonRepository, UPDATE_CREDENTIAL_QUERY } from "../src/repositories/personRepository.js";
import {
  createPasswordRecoveryService,
  normalizeNewPassword,
} from "../src/services/passwordRecoveryService.js";

test("scrResetarClave conserva Mandatory False y MaxLength 128", () => {
  assert.equal(normalizeNewPassword(undefined), "");
  assert.equal(normalizeNewPassword(""), "");
  assert.equal(normalizeNewPassword("x".repeat(128)), "x".repeat(128));
  assert.throws(
    () => normalizeNewPassword("x".repeat(129)),
    { code: "VALIDATION_ERROR", field: "password", message: "La clave no puede superar 128 caracteres." },
  );
});

test("GuardarOnClick hashea incluso la cadena vacia y baja isResetear", async () => {
  const calls = [];
  const service = createPasswordRecoveryService({
    personRepository: {
      async updateCredential(payload) {
        calls.push(["update", payload]);
        return true;
      },
    },
    passwordHashService: {
      async hash(password) {
        calls.push(["hash", password]);
        return "0123456789abcdef0123456789abcdef";
      },
    },
  });

  assert.deepEqual(await service.reset(42, ""), { updated: true });
  assert.deepEqual(calls, [
    ["hash", ""],
    ["update", {
      personId: 42,
      credential: "0123456789abcdef0123456789abcdef",
      mustResetPassword: false,
    }],
  ]);
});

test("UpdatetblPersonasIA actualiza por Codigo_Personas sin filtro activo inventado", async () => {
  const calls = [];
  const repository = createPersonRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [{ affectedRows: 1 }, []];
    },
  });

  assert.match(UPDATE_CREDENTIAL_QUERY, /SET Credencial = \?, isResetear = \?/);
  assert.match(UPDATE_CREDENTIAL_QUERY, /WHERE Codigo_Personas = \?/);
  assert.doesNotMatch(UPDATE_CREDENTIAL_QUERY, /isActivo/);
  assert.equal(await repository.updateCredential({
    personId: 42,
    credential: "hash",
    mustResetPassword: false,
  }), true);
  assert.deepEqual(calls[0].parameters, ["hash", 0, 42]);
});

test("el endpoint conserva usuario de sesion, limpia cookie y devuelve el resultado del update", async () => {
  const calls = [];
  const controller = createAuthController({
    authService: {},
    passwordRecoveryService: {
      async reset(personId, password) {
        calls.push(["reset", personId, password]);
        return { updated: true };
      },
    },
    sessionService: {
      clearCookie() {
        calls.push(["clearCookie"]);
      },
    },
  });
  let payload;
  const next = (error) => {
    throw error;
  };

  await controller.resetPassword(
    { auth: { id: 42 }, body: { password: "" } },
    { json(value) { payload = value; } },
    next,
  );

  assert.deepEqual(calls, [
    ["reset", 42, ""],
    ["clearCookie"],
  ]);
  assert.deepEqual(payload, {
    success: true,
    message: "Clave actualizada correctamente.",
    data: { updated: true },
    error: null,
  });
});

test("el update de credencial permanece detras de autenticacion explicita", async () => {
  const routes = await readFile(new URL("../src/routes/authRoutes.js", import.meta.url), "utf8");

  assert.match(
    routes,
    /router\.post\("\/reset-password", requireAuthentication, controller\.resetPassword\);/,
  );
  assert.doesNotMatch(
    routes,
    /router\.post\("\/reset-password", controller\.resetPassword\);/,
  );
});
