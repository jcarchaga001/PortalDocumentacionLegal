import assert from "node:assert/strict";
import test from "node:test";
import { createCorporateClientRepository } from "../src/repositories/corporateClientRepository.js";
import { normalizeCorporateClientPayload } from "../src/services/corporateClientService.js";

test("el payload individual conserva texto, correo libre y removidos como el OML", () => {
  const result = normalizeCorporateClientPayload({
    name: "  Cliente  ",
    faCode: " FA01 ",
    contactEmail: "correo legacy no validado",
    contacts: [{ id: 8, name: " Contacto ", position: "", phone: "+50412345678", email: "sin-validar" }],
    removedContactIds: [4, "4", 0, 7],
  });
  assert.equal(result.name, "  Cliente  ");
  assert.equal(result.faCode, " FA01 ");
  assert.equal(result.contactEmail, "correo legacy no validado");
  assert.deepEqual(result.removedContactIds, [4, 7]);
  assert.equal(result.contacts[0].name, " Contacto ");
});

test("ActualizarClientesCorp crea solo contactos nuevos y desactiva solo removidos", async () => {
  const connectionCalls = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, parameters) {
      connectionCalls.push({ sql, parameters });
      if (/FOR UPDATE/.test(sql)) return [[{ id: 24 }]];
      return [{ affectedRows: 1, insertId: 99 }];
    },
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql) {
      if (/FROM .*tblClientesCorp/.test(sql)) return [[{ id: 24, isActive: 1, isSuspended: 0, hasDiscount: 0 }]];
      return [[]];
    },
  };
  const repository = createCorporateClientRepository(pool);
  await repository.update(4, 12, 24, {
    name: "Cliente",
    faCode: "FA01",
    contactName: "",
    contactPosition: "",
    contactPhone: "",
    contactEmail: "",
    contacts: [
      { id: 3, name: "Existente", position: "", phone: "+5041", email: "" },
      { id: undefined, name: "Nuevo", position: "", phone: "+5042", email: "" },
    ],
    removedContactIds: [5],
  });

  const sql = connectionCalls.map((call) => call.sql).join("\n");
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /INSERT INTO .*tblContactosClientesCorp/);
  assert.match(sql, /WHERE CodContacto = \? AND CodClienteCorp = \?/);
  assert.doesNotMatch(sql, /SET isActivo = 0 WHERE CodClienteCorp = \?/);
  assert.equal(connectionCalls.filter((call) => /INSERT INTO .*tblContactosClientesCorp/.test(call.sql)).length, 1);
});
