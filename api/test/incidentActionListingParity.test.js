import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentRepository } from "../src/repositories/incidentRepository.js";

test("el listado expone el footer y conserva fechaFin con NullDate en el segundo rango", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 370 }], []];
      return [[{
        id: 91,
        incidentTypeId: 2,
        branchId: 370,
        incidentReference: "IR-202608-00003",
      }], []];
    },
  });

  const result = await repository.listActions("external", 4, {
    page: 1,
    pageSize: 50,
    branchId: undefined,
    responsibleId: undefined,
    statusId: undefined,
    startDate: "2026-08-28",
    endDate: "2026-08-29",
    dueStartDate: "2026-08-28",
    dueEndDate: "2026-08-29",
    search: "",
  });

  const listing = calls.find(({ sql }) => /LIMIT 50 OFFSET 0/.test(sql));
  assert.ok(listing);
  assert.match(listing.sql, /i\.codigoTipoIncidente AS incidentTypeId/);
  assert.match(listing.sql, /s\.Codigo_Sucursal AS branchId/);
  assert.match(listing.sql, /a\.fechaInicio >= \?/);
  assert.match(listing.sql, /a\.fechaInicio <= \?/);
  assert.match(listing.sql, /\(a\.fechaFin IS NULL OR YEAR\(a\.fechaFin\) <= 1900 OR a\.fechaFin >= \?\)/);
  assert.match(listing.sql, /\(a\.fechaFin IS NULL OR YEAR\(a\.fechaFin\) <= 1900 OR a\.fechaFin <= \?\)/);
  assert.doesNotMatch(listing.sql, /a\.fechaEntrega >=|a\.fechaEntrega <=/);
  assert.deepEqual(result.items, [{
    id: 91,
    incidentTypeId: 2,
    branchId: 370,
    incidentReference: "IR-202608-00003",
  }]);
  assert.equal(result.total, 370);
});

test("Buscar Referencia solo filtra codigoReferencia del incidente", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }], []];
      return [[], []];
    },
  });

  await repository.listActions("internal", 4, {
    page: 1,
    pageSize: 50,
    search: "INC-001",
  });

  const listing = calls.find(({ sql }) => /LIMIT 50 OFFSET 0/.test(sql));
  assert.match(listing.sql, /i\.codigoReferencia LIKE CONCAT\('%', \?, '%'\)/);
  assert.doesNotMatch(listing.sql, /a\.AccionReferencia LIKE|a\.nombreAccion LIKE/);
  assert.deepEqual(listing.parameters, [4, 0, "INC-001"]);
});

for (const scope of ["internal-actions", "external-actions"]) {
  test(`${scope} ejecuta solo GetSucursales, GetEstados y GetPersonasAccionesFiltro`, async () => {
    const calls = [];
    const repository = createIncidentRepository({
      async execute(sql, parameters = []) {
        calls.push({ sql, parameters });
        if (/tblSucursales/.test(sql)) return [[{ id: 223, name: "FA21 - TGU - Las Minitas" }], []];
        if (/tblEstadosIncidentes/.test(sql)) return [[{ id: 2, name: "En Ejecución" }], []];
        if (/tblUsuariosAcciones/.test(sql)) return [[{ id: 77, name: "Responsable", email: "mock@example.test" }], []];
        throw new Error(`Consulta inesperada: ${sql}`);
      },
    });

    const result = await repository.getCatalogs(scope, 4);

    assert.equal(calls.length, 3);
    const branches = calls.find(({ sql }) => /tblSucursales/.test(sql));
    assert.match(branches.sql, /Codigo_Pais = \? AND isAdministrativa = 0 AND isActivo = 1/);
    assert.match(branches.sql, /ORDER BY OrdenSucursal\s+LIMIT 500/);
    assert.deepEqual(branches.parameters, [4]);

    const statuses = calls.find(({ sql }) => /tblEstadosIncidentes/.test(sql));
    assert.match(statuses.sql, /WHERE codigoEstado <> 1\s+LIMIT 50/);
    assert.doesNotMatch(statuses.sql, /isActive|ORDER BY/);

    const people = calls.find(({ sql }) => /tblUsuariosAcciones/.test(sql));
    assert.match(people.sql, /INNER JOIN .*tblPersonas p ON ua\.codigoUsuario = p\.Codigo_Personas/);
    assert.match(people.sql, /WHERE ua\.codigoPais = \?/);
    assert.doesNotMatch(people.sql, /DISTINCT|isActive|isActivo|isRRHH|ORDER BY/);
    assert.deepEqual(people.parameters, [4]);
    assert.deepEqual(Object.keys(result).sort(), ["branches", "responsiblePeople", "statuses"]);
  });
}
