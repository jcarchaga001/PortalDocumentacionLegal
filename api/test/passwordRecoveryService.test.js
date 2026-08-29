import assert from "node:assert/strict";
import test from "node:test";
import {
  createPasswordRecoveryService,
  normalizeRecoveryRequest,
} from "../src/services/passwordRecoveryService.js";

test("recuperacion conserva el dominio fijo del flujo legacy", () => {
  const previous = process.env.RECOVERY_EMAIL_DOMAIN;
  process.env.RECOVERY_EMAIL_DOMAIN = "farmavalue.com";
  try {
    assert.deepEqual(
      normalizeRecoveryRequest({
        type: "usuario",
        countryCode: 4,
        identifier: "usuario.legacy",
        deliveryAlias: "usuario.legacy",
      }),
      {
        countryCode: 4,
        username: "usuario.legacy",
        destination: "usuario.legacy@farmavalue.com",
      },
    );
    assert.deepEqual(
      normalizeRecoveryRequest({ type: "correo", countryCode: 4, identifier: "legal.hn" }),
      {
        countryCode: 4,
        username: "legal.hn@farmavalue.com",
        destination: "legal.hn@farmavalue.com",
      },
    );
  } finally {
    if (previous === undefined) delete process.env.RECOVERY_EMAIL_DOMAIN;
    else process.env.RECOVERY_EMAIL_DOMAIN = previous;
  }
});

test("recuperacion envia al alias de la cuenta y despues marca la clave para cambio", async () => {
  const calls = { updates: [], messages: [], passwords: [], order: [] };
  const service = createPasswordRecoveryService({
    personRepository: {
      async findActiveForRecovery() {
        return [{
          Codigo_Personas: 42,
          Correo_electronico: "usuario.legacy",
          Primer_Nombre: "Admin",
          Primer_Apellido: "Legal",
        }];
      },
      async updateCredential(payload) {
        calls.order.push("update");
        calls.updates.push(payload);
        return true;
      },
    },
    passwordHashService: {
      async hash(password) {
        calls.passwords.push(password);
        return "0123456789abcdef0123456789abcdef";
      },
    },
    async sendMailImpl(payload) {
      calls.order.push("mail");
      calls.messages.push(payload);
      return { success: true };
    },
  });

  await service.request({
    type: "usuario",
    countryCode: 4,
    identifier: "usuario.legacy",
    deliveryAlias: "usuario.legacy",
  });

  assert.equal(calls.passwords[0].length, 10);
  assert.deepEqual(calls.updates[0], {
    personId: 42,
    credential: "0123456789abcdef0123456789abcdef",
    mustResetPassword: true,
  });
  assert.equal(calls.messages[0].to, "usuario.legacy@farmavalue.com");
  assert.match(calls.messages[0].text, /clave temporal/i);
  assert.deepEqual(calls.order, ["mail", "update"]);
});

test("recuperacion por usuario rechaza un alias que no pertenece a la cuenta", async () => {
  let updated = false;
  let mailed = false;
  const service = createPasswordRecoveryService({
    personRepository: {
      async findActiveForRecovery() {
        return [{ Codigo_Personas: 42, Correo_electronico: "usuario.legacy" }];
      },
      async updateCredential() { updated = true; return true; },
    },
    passwordHashService: { async hash() { return "hashed"; } },
    async sendMailImpl() { mailed = true; return { success: true }; },
  });

  await assert.rejects(
    service.request({ type: "usuario", countryCode: 4, identifier: "usuario.legacy", deliveryAlias: "otra.persona" }),
    { code: "RECOVERY_IDENTITY_NOT_FOUND", message: "Credenciales Incorrectas" },
  );
  assert.equal(mailed, false);
  assert.equal(updated, false);
});

test("fallo de correo no cambia la credencial existente", async () => {
  let updated = false;
  const service = createPasswordRecoveryService({
    personRepository: {
      async findActiveForRecovery() {
        return [{ Codigo_Personas: 42, Correo_electronico: "usuario.legacy" }];
      },
      async updateCredential() { updated = true; return true; },
    },
    passwordHashService: { async hash() { return "hashed"; } },
    async sendMailImpl() { return { success: false }; },
  });

  await assert.rejects(
    service.request({ type: "usuario", countryCode: 4, identifier: "usuario.legacy", deliveryAlias: "usuario.legacy" }),
    { code: "RECOVERY_EMAIL_FAILED" },
  );
  assert.equal(updated, false);
});

test("cambio personalizado elimina la marca de restablecimiento", async () => {
  let updated;
  const service = createPasswordRecoveryService({
    personRepository: {
      async updateCredential(payload) {
        updated = payload;
        return true;
      },
    },
    passwordHashService: { async hash() { return "hashed"; } },
  });

  await service.reset(42, "NuevaClave2026#");
  assert.deepEqual(updated, {
    personId: 42,
    credential: "hashed",
    mustResetPassword: false,
  });
});
