import assert from "node:assert/strict";
import test from "node:test";
import { createCorporateClientRepository } from "../src/repositories/corporateClientRepository.js";

test("detalle de cliente conserva contactos inactivos para el panel legacy sin reactivarlos en edición", async () => {
  const calls = [];
  const pool = {
    async execute(sql) {
      calls.push(sql);
      if (sql.includes("FROM `dbaiupyjxopa5m`.tblClientesCorp")) {
        return [[{
          id: 24,
          faCode: "1969388697",
          name: "AC Talentos",
          contactName: "Patricia Sanchez",
          isActive: 1,
          isSuspended: 0,
          hasDiscount: 0,
        }]];
      }
      return [[
        { id: 1, name: "Contacto histórico", isActive: 0 },
        { id: 2, name: "Contacto activo", isActive: 1 },
      ]];
    },
  };
  const repository = createCorporateClientRepository(pool);

  const result = await repository.getById(4, 24);

  const contactsSql = calls.find((sql) => sql.includes("tblContactosClientesCorp")) || "";
  assert.doesNotMatch(contactsSql, /isActivo = 1/);
  assert.deepEqual(result.contacts.map(({ id }) => id), [2]);
  assert.deepEqual(result.allContacts.map(({ id }) => id), [1, 2]);
});
