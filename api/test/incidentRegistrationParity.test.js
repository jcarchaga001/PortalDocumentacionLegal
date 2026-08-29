import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentRepository } from "../src/repositories/incidentRepository.js";

function catalogHarness() {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/FROM .*tblTiposIncidentes LIMIT 50/.test(sql)) {
        return [[{ id: 2, name: "Regulatorio", prefix: "REG" }], []];
      }
      return [[], []];
    },
  });
  return { calls, repository };
}

for (const scope of ["internal", "external"]) {
  test(`catálogos de alta ${scope} conservan GetSucursales/GetPersonas/GetEnte/GetTipo`, async () => {
    const { calls, repository } = catalogHarness();
    const result = await repository.getCatalogs(scope, 4, { branchId: 223 });

    const branches = calls.find(({ sql }) => /FROM .*tblSucursales/.test(sql));
    assert.match(branches.sql, /Codigo_Pais = \?/);
    assert.match(branches.sql, /isAdministrativa = 0/);
    assert.match(branches.sql, /isActivo = 1/);
    assert.match(branches.sql, /ORDER BY OrdenSucursal/);

    const agencies = calls.find(({ sql }) => /FROM .*tblEntesGubernamentales/.test(sql));
    assert.match(agencies.sql, /codigoPais = \?/);
    assert.match(agencies.sql, /isActive = 1/);
    assert.match(agencies.sql, /LIMIT 50/);
    if (scope === "internal") assert.match(agencies.sql, /COALESCE\(IsExterno, 0\) = 0/);
    else assert.match(agencies.sql, /AND 1 = 1/);

    const people = calls.find(({ sql }) => /SELECT Codigo_Personas AS id, Nombre_Personas AS name/.test(sql));
    assert.match(people.sql, /CodigoPais = \?/);
    assert.match(people.sql, /Codigo_Sucursal = \?/);
    assert.match(people.sql, /LIMIT 50/);
    assert.deepEqual(people.parameters, [4, 223]);

    const types = calls.find(({ sql }) => /FROM .*tblTiposIncidentes LIMIT 50/.test(sql));
    assert.ok(types);
    assert.deepEqual(result.types, [{ id: 2, name: "Regulatorio", prefix: "REG" }]);
  });
}
