import assert from "node:assert/strict";
import test from "node:test";
import { createAgreementRepository } from "../src/repositories/agreementRepository.js";
import { createAgreementService } from "../src/services/agreementService.js";

test("GetContactos replica convenio-cliente LEFT JOIN sin filtrar activo, ordenar ni limitar", async () => {
  const calls = [];
  const repository = createAgreementRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[
        { id: 8, faCode: "123", name: "Cliente", contactName: "Principal", additionalContactId: 4, additionalContactName: "Inactivo", additionalContactIsActive: 0 },
        { id: 8, faCode: "123", name: "Cliente", contactName: "Principal", additionalContactId: 5, additionalContactName: "Activo", additionalContactIsActive: 1 },
      ]];
    },
  });

  const result = await repository.getClientContacts(4, 14);
  assert.match(calls[0].sql, /FROM .*tblConvenios agreement/);
  assert.match(calls[0].sql, /LEFT JOIN .*tblContactosClientesCorp contact/);
  assert.match(calls[0].sql, /client\.CodPais = \?/);
  assert.doesNotMatch(calls[0].sql, /contact\.isActivo\s*=/);
  assert.doesNotMatch(calls[0].sql, /ORDER BY|LIMIT/);
  assert.deepEqual(calls[0].parameters, [4, 14]);
  assert.equal(result.contacts.length, 2);
  assert.equal(result.contacts[0].isActive, false);
  assert.equal(result.contacts[1].isActive, true);
});

test("GetContactos conserva la fila vacía producida por el LEFT JOIN", async () => {
  const repository = createAgreementRepository({
    async execute() {
      return [[{ id: 8, name: "Cliente", additionalContactId: null }]];
    },
  });
  const result = await repository.getClientContacts(4, 14);
  assert.deepEqual(result.contacts, [{ id: null, name: "", position: "", phone: "", email: "", isActive: false }]);
});

test("servicio valida el identificador y conserva 404 sin inventar productores", async () => {
  const service = createAgreementService({ getClientContacts: async () => null });
  await assert.rejects(() => service.contacts(4, "x"), (error) => error.status === 400 && error.field === "id");
  await assert.rejects(() => service.contacts(4, "14"), (error) => error.status === 404 && error.code === "AGREEMENT_NOT_FOUND");
});
