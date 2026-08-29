import assert from "node:assert/strict";
import test from "node:test";
import { createCorporateClientRepository } from "../src/repositories/corporateClientRepository.js";
import {
  createCorporateClientService,
  normalizeCorporateClientImportPayload,
} from "../src/services/corporateClientService.js";

function validImport(overrides = {}) {
  return {
    faCode: "FA01",
    name: "Cliente",
    contactName: "Contacto",
    contactPosition: "Puesto",
    contactPhone: "9999",
    contactEmail: "correo-invalido",
    ...overrides,
  };
}

test("normalización masiva no comparte reglas inventadas del formulario individual", () => {
  assert.deepEqual(normalizeCorporateClientImportPayload(validImport({
    faCode: "",
    name: "",
    contactName: "   ",
    contactPhone: "   ",
  })), {
    faCode: "",
    name: "",
    contactName: "   ",
    contactPosition: "Puesto",
    contactPhone: "   ",
    contactEmail: "correo-invalido",
    contacts: [],
  });
});

test("servicio conserva validación exacta de contacto y duplicado del cliente legacy", async () => {
  const repository = { bulkUpsert: async (_country, _user, clients) => ({ processed: clients.length }) };
  const service = createCorporateClientService(repository);

  await assert.rejects(
    Promise.resolve().then(() => service.bulkUpsert(4, 8, { items: [validImport({ contactName: "" })] })),
    (error) => error.message === "Este registro no es valido, el Nombre del contacto es requerido",
  );
  await assert.rejects(
    Promise.resolve().then(() => service.bulkUpsert(4, 8, { items: [validImport({ contactPhone: "" })] })),
    (error) => error.message === "Este registro no es valido, el Teléfono del contacto es requerido",
  );
  await assert.rejects(
    Promise.resolve().then(() => service.bulkUpsert(4, 8, { items: [validImport(), validImport()] })),
    (error) => error.field === "items.1.faCode" && error.message === "Este registro no es valido",
  );
});

function fakePool({ failAt = 0 } = {}) {
  const calls = [];
  let insertCount = 0;
  const connection = {
    async beginTransaction() { calls.push({ kind: "begin" }); },
    async execute(sql, parameters) {
      insertCount += 1;
      calls.push({ kind: "execute", sql, parameters });
      if (failAt === insertCount) throw new Error("fixture insert failure");
      return [{ insertId: insertCount }];
    },
    async commit() { calls.push({ kind: "commit" }); },
    async rollback() { calls.push({ kind: "rollback" }); },
    release() { calls.push({ kind: "release" }); },
  };
  return { calls, pool: { async getConnection() { return connection; } } };
}

test("repositorio masivo ejecuta solo Create, sin SELECT ni UPDATE", async () => {
  const { calls, pool } = fakePool();
  const repository = createCorporateClientRepository(pool);
  const result = await repository.bulkUpsert(4, 8, [validImport(), validImport({ faCode: "FA02" })]);
  const executions = calls.filter(({ kind }) => kind === "execute");

  assert.deepEqual(result, { processed: 2, created: 2, updated: 0 });
  assert.equal(executions.length, 2);
  executions.forEach(({ sql }) => {
    assert.match(sql, /INSERT INTO .*tblClientesCorp/);
    assert.match(sql, /CURDATE\(\)/);
    assert.doesNotMatch(sql, /SELECT|UPDATE|tblContactosClientesCorp/);
  });
  assert.deepEqual(calls.filter(({ kind }) => kind !== "execute").map(({ kind }) => kind), ["begin", "commit", "release"]);
});

test("fixture de fallo revierte toda la transacción y siempre libera conexión", async () => {
  const { calls, pool } = fakePool({ failAt: 2 });
  const repository = createCorporateClientRepository(pool);
  await assert.rejects(repository.bulkUpsert(4, 8, [validImport(), validImport({ faCode: "FA02" })]), /fixture insert failure/);
  assert.deepEqual(calls.filter(({ kind }) => kind !== "execute").map(({ kind }) => kind), ["begin", "rollback", "release"]);
});
