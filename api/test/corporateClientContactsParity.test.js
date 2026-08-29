import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCorporateClientRepository } from "../src/repositories/corporateClientRepository.js";
import {
  CORPORATE_CLIENT_CONTACTS_MAX_RECORDS,
  createCorporateClientService,
} from "../src/services/corporateClientService.js";

test("GetContactos filtra cliente e isActivo, limita 500 y no inventa orden", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{
        id: 8,
        clientId: 42,
        name: "Contacto",
        position: "Puesto",
        phone: "0000-0000",
        email: "contacto@example.test",
        isActive: 1,
      }]];
    },
  };
  const repository = createCorporateClientRepository(pool);

  const result = await repository.listContacts(4, 42);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].parameters, [4, 42]);
  assert.match(calls[0].sql, /tblContactosClientesCorp/);
  assert.match(calls[0].sql, /client\.CodPais = \?/);
  assert.match(calls[0].sql, /contact\.CodClienteCorp = \?/);
  assert.match(calls[0].sql, /contact\.isActivo = 1/);
  assert.match(calls[0].sql, /LIMIT 500/);
  assert.doesNotMatch(calls[0].sql, /ORDER BY/i);
  assert.equal(result[0].isActive, true);
});

test("el servicio expone exclusivamente items y MaxRecords 500 para el bloque", async () => {
  const repository = {
    async listContacts(countryCode, clientId) {
      assert.equal(countryCode, 4);
      assert.equal(clientId, 42);
      return [{ id: 8, name: "Contacto" }];
    },
  };
  const service = createCorporateClientService(repository);

  assert.equal(CORPORATE_CLIENT_CONTACTS_MAX_RECORDS, 500);
  assert.deepEqual(await service.contacts(4, "42"), {
    items: [{ id: 8, name: "Contacto" }],
    maxRecords: 500,
  });
  await assert.rejects(() => service.contacts(4, "0"), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.field, "id");
    return true;
  });
});

test("la ruta de contactos es GET y queda separada de mutaciones del formulario", async () => {
  const source = await readFile(new URL("../src/routes/corporateClientRoutes.js", import.meta.url), "utf8");

  assert.match(source, /router\.get\("\/:id\/contacts", controller\.contacts\)/);
  assert.doesNotMatch(source, /router\.(?:post|put|patch|delete)\("\/:id\/contacts"/);
});

