import assert from "node:assert/strict";
import test from "node:test";
import { createAuthController } from "../src/controllers/authController.js";

test("recuperacion responde con el mensaje de exito literal del Login legacy", async () => {
  let payload;
  const controller = createAuthController({
    authService: {},
    sessionService: {},
    passwordRecoveryService: {
      async request() {
        return { destination: "us***@farmavalue.com" };
      },
    },
  });

  await controller.requestPasswordRecovery(
    { body: {} },
    { json(value) { payload = value; } },
    (error) => { throw error; },
  );

  assert.equal(payload.success, true);
  assert.equal(payload.message, "Se ha enviado sus datos de ingreso al correo ingresado");
});
