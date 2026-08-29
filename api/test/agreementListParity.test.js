import assert from "node:assert/strict";
import test from "node:test";
import { createAgreementRepository } from "../src/repositories/agreementRepository.js";

test("GetConvenios replica SQL1/SQL2, el rango divergente y la paginacion defectuosa", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("COUNT(*) AS total")) return [[]];
      if (sql.includes("legacy_rows")) return [[]];
      if (sql.includes("vstEmpleadosMesEnCurso")) return [[]];
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const repository = createAgreementRepository(pool);
  const result = await repository.list(4, {
    page: 2,
    pageSize: 50,
    clientId: 7,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    indefinite: true,
  });

  const dataCall = calls.find(({ sql }) => sql.includes("legacy_rows"));
  const countCall = calls.find(({ sql }) => sql.includes("legacy_count"));
  assert.equal((dataCall.sql.match(/UNION ALL/g) || []).length, 2);
  assert.match(dataCall.sql, /a\.FechaFinal >= \?/);
  assert.doesNotMatch(dataCall.sql, /a\.FechaInicial >= \?/);
  assert.match(countCall.sql, /\(a\.FechaInicial >= \? OR a\.FechaFinal >= \?\)/);
  assert.match(countCall.sql, /LIMIT 50 OFFSET 50/);
  assert.equal(countCall.parameters.length, 12);
  assert.equal(result.total, 0);
  assert.equal(result.page, 2);
});

test("GetClientes conserva pais, activo, limite 50 y ausencia de orden inventado", async () => {
  const calls = [];
  const repository = createAgreementRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{ id: 3, name: "Cliente" }]];
    },
  });

  const rows = await repository.getClients(4);
  assert.deepEqual(rows, [{ id: 3, name: "Cliente" }]);
  assert.match(calls[0].sql, /CodPais = \? AND EstadoCliente = 1/);
  assert.match(calls[0].sql, /LIMIT 50/);
  assert.doesNotMatch(calls[0].sql, /ORDER BY/);
  assert.deepEqual(calls[0].parameters, [4]);
});
