import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardRepository } from "../src/repositories/dashboardRepository.js";

test("catálogos de monitoreo conservan filtros, etiquetas y orden observable legacy", async () => {
  const calls = [];
  const repository = createDashboardRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[], []];
    },
  });

  await repository.getMonitoringCatalogs(4);

  assert.equal(calls.length, 2);
  const managerCall = calls.find(({ sql }) => /Codigo_Puesto = 2/.test(sql));
  const branchCall = calls.find(({ sql }) => /Codigo_Sucursal AS id/.test(sql));

  assert.deepEqual(managerCall.parameters, [4]);
  assert.match(managerCall.sql, /ORDER BY Codigo_Personas/);
  assert.match(managerCall.sql, /LIMIT 250/);
  assert.doesNotMatch(managerCall.sql, /isActivo/);

  assert.deepEqual(branchCall.parameters, [4]);
  assert.match(branchCall.sql, /CONCAT\(Codigo_InternoSucursal, '-', Nombre_Sucursal\)/);
  assert.match(branchCall.sql, /isAdministrativa = 0 OR Codigo_Sucursal = 135/);
  assert.match(branchCall.sql, /ORDER BY Codigo_Sucursal/);
  assert.doesNotMatch(branchCall.sql, /isActivo/);
});

test("monitoreo replica los cuatro aggregates del bloque sin filtros de país añadidos", async () => {
  const calls = [];
  const repository = createDashboardRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[], []];
    },
  });

  await repository.getBranchMonitoring(4, { managerId: 19, branchId: 135 });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].parameters, [4, 19, 19, 135, 135]);
  assert.match(calls[0].sql, /WHERE isObligatorio = 1/);
  assert.match(calls[0].sql, /d\.estadoDocumento IN \(2, 4\)/);
  assert.match(calls[0].sql, /d\.estadoDocumento = 4/);
  assert.match(calls[0].sql, /COUNT\(DISTINCT CASE/);
  assert.doesNotMatch(calls[0].sql, /d\.codigoPais/);
  assert.doesNotMatch(calls[0].sql, /sc\.codigoPais/);
  assert.match(calls[0].sql, /ORDER BY s\.Codigo_Sucursal/);
});
