import assert from "node:assert/strict";
import test from "node:test";
import { createCorporateClientRepository } from "../src/repositories/corporateClientRepository.js";
import { normalizeCorporateClientFilters } from "../src/services/corporateClientService.js";

test("GetClientes fija MaxRecords 50 y el filtro EstadoCliente del OML", () => {
  assert.deepEqual(normalizeCorporateClientFilters({
    page: "2",
    pageSize: "5",
    search: "no existe en la pantalla",
    activeOnly: false,
  }), {
    page: 2,
    pageSize: 50,
    activeOnly: true,
  });
});

test("el adaptador lista por país, solo activos y Nombre_Cliente ascendente", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("COUNT(*)")) return [[{ total: 68 }]];
      return [[{
        id: 24,
        faCode: "1969388697",
        name: "AC Talentos",
        isActive: 1,
      }]];
    },
  };
  const repository = createCorporateClientRepository(pool);

  const result = await repository.list(4, { page: 2, pageSize: 50, activeOnly: true });

  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 50);
  assert.equal(result.total, 68);
  assert.equal(result.items[0].isActive, true);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /CodPais = \? AND EstadoCliente = 1/);
    assert.deepEqual(call.parameters, [4]);
    assert.doesNotMatch(call.sql, /LIKE/);
  }
  assert.match(calls[0].sql, /ORDER BY Nombre_Cliente/);
  assert.match(calls[0].sql, /LIMIT 50 OFFSET 50/);
});
