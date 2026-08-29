import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentRepository } from "../src/repositories/incidentRepository.js";
import { createIncidentService, normalizeIncidentFilters } from "../src/services/incidentService.js";

function catalogHarness() {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[], []];
    },
  });
  return { calls, repository };
}

test("GetSucursales/GetEstados/GetEntes separan catalogos de lista del alta", async () => {
  const { calls, repository } = catalogHarness();
  await repository.getCatalogs("external-list", 4);
  const branches = calls.find(({ sql }) => /FROM .*tblSucursales/.test(sql));
  const statuses = calls.find(({ sql }) => /SELECT codigoEstado AS id/.test(sql));
  const agencies = calls.find(({ sql }) => /FROM .*tblEntesGubernamentales/.test(sql));
  assert.match(branches.sql, /ORDER BY OrdenSucursal\s+LIMIT 500/);
  assert.doesNotMatch(statuses.sql, /isActive|ORDER BY codigoEstado/);
  assert.match(agencies.sql, /AND isRegulatorio = 1/);

  const registration = catalogHarness();
  await registration.repository.getCatalogs("external", 4);
  const registrationAgencies = registration.calls.find(({ sql }) => /FROM .*tblEntesGubernamentales/.test(sql));
  assert.match(registrationAgencies.sql, /AND 1 = 1/);
});

test("servicio admite scopes de catalogo de lista y usa MaxRecords 50 por defecto", async () => {
  let received;
  const service = createIncidentService({
    getCatalogs(scope, countryCode, filters) {
      received = { scope, countryCode, filters };
      return {};
    },
  });
  await service.catalogs("internal-list", 4, {});
  assert.deepEqual(received, { scope: "internal-list", countryCode: 4, filters: { branchId: undefined, incidentId: undefined } });
  assert.equal(normalizeIncidentFilters({}).pageSize, 50);
});
