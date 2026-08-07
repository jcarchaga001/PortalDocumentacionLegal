import assert from "node:assert/strict";
import test from "node:test";
import { createAuthService, InvalidCredentialsError } from "../src/services/authService.js";

function createService(people) {
  const calls = [];
  const service = createAuthService({
    passwordHashService: { async hash(password) { calls.push(["hash", password]); return "a".repeat(32); } },
    personRepository: {
      async findActiveByCredentials(input) {
        calls.push(["repository", input]);
        return people;
      },
    },
  });
  return { service, calls };
}

test("autenticacion conserva usuarios heredados que no son correo", async () => {
  const { service, calls } = createService([{
    Codigo_Personas: 42,
    Primer_Nombre: "Ada",
    Segundo_Nombre: "",
    Primer_Apellido: "Lovelace",
    Segundo_Apellido: null,
    CodigoRol: 7,
    CodigoPais: 4,
    isResetear: 0,
    Codigo_Sucursal: 9,
    Codigo_Puesto: 15,
  }]);

  const profile = await service.authenticate({ username: "usuario.legacy", password: "secreto", countryCode: 4 });

  assert.equal(profile.name, "Ada Lovelace");
  assert.equal(profile.id, 42);
  assert.equal(calls[1][1].email, "usuario.legacy");
  assert.equal(calls[1][1].credential, "a".repeat(32));
});

test("cero o multiples coincidencias producen el mismo error publico", async () => {
  for (const people of [[], [{}, {}]]) {
    const { service } = createService(people);
    await assert.rejects(
      () => service.authenticate({ username: "usuario", password: "clave", countryCode: 4 }),
      (error) => error instanceof InvalidCredentialsError && error.code === "INVALID_CREDENTIALS",
    );
  }
});

test("valida antes de invocar el proveedor de hash", async () => {
  const { service, calls } = createService([]);
  await assert.rejects(() => service.authenticate({ username: "", password: "clave", countryCode: 4 }), /usuario valido/i);
  await assert.rejects(() => service.authenticate({ username: "usuario", password: "clave", countryCode: 2 }), /pais valido/i);
  assert.equal(calls.length, 0);
});
