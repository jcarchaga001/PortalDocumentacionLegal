import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentRepository } from "../src/repositories/documentRepository.js";
import { normalizeFilters } from "../src/services/documentService.js";

test("la proyeccion para scrProximosVencer expone los joins visibles del OML", async () => {
  const calls = [];
  const repository = createDocumentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }], []];
      return [[], []];
    },
  });

  await repository.list(4, normalizeFilters({
    documentType: "all",
    includeInactive: true,
    statusId: 4,
  }));

  const select = calls.find(({ sql }) => /LIMIT 50 OFFSET 0/.test(sql));
  assert.ok(select);
  assert.match(select.sql, /u\.Nombre_Personas AS createdByName/);
  assert.match(select.sql, /n\.NivelPermiso AS levelName/);
  assert.match(select.sql, /st\.nombreEstado AS statusName/);
  assert.match(select.sql, /p\.Nombre_comercial AS providerName/);
  assert.match(select.sql, /s\.Codigo_InternoSucursal AS branchCode/);
  assert.match(select.sql, /s\.Nombre_Sucursal AS branchOnlyName/);
  assert.deepEqual(select.parameters, [4, 4]);
});
