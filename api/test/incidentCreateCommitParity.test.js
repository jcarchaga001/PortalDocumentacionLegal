import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentRepository } from "../src/repositories/incidentRepository.js";

test("una lectura fallida después del commit no hace rollback ni oculta la creación confirmada", async () => {
  const lifecycle = [];
  const connection = {
    async beginTransaction() { lifecycle.push("begin"); },
    async commit() { lifecycle.push("commit"); },
    async rollback() { lifecycle.push("rollback"); },
    release() { lifecycle.push("release"); },
    async execute(sql, parameters = []) {
      if (/SELECT Codigo_Sucursal AS id/.test(sql)) {
        return [[{ id: 223, branchName: "FA21 - TGU - Las Minitas" }], []];
      }
      if (/SELECT codigoEnte AS id/.test(sql)) {
        return [[{
          id: 9,
          agencyName: "Area Legal",
          isRegulatory: 1,
          responsibleId: 77,
          isExternal: 0,
        }], []];
      }
      if (/FROM .*tblPersonas p/.test(sql)) {
        return [[{ id: Number(parameters[0]), name: "Responsable" }], []];
      }
      if (/SELECT nomenclatura AS prefix/.test(sql)) return [[{ prefix: "REG" }], []];
      if (/SELECT DATE_FORMAT\(NOW\(\), '%Y%m'\) AS period/.test(sql)) {
        return [[{ period: "202608", registeredAt: "2026-08-28 15:00:00" }], []];
      }
      if (/SELECT GET_LOCK/.test(sql)) return [[{ acquired: 1 }], []];
      if (/SELECT COALESCE\(MAX/.test(sql)) return [[{ nextNumber: 4 }], []];
      if (/INSERT INTO .*tblIncidentesExternos/.test(sql)) return [{ insertId: 327, affectedRows: 1 }, []];
      if (/INSERT INTO .*tblAccionesIncidentes/.test(sql)) return [{ insertId: 91, affectedRows: 1 }, []];
      if (/SELECT RELEASE_LOCK/.test(sql)) return [[{ released: 1 }], []];
      return [{ insertId: 1, affectedRows: 1 }, []];
    },
  };
  const repository = createIncidentRepository({
    async getConnection() { return connection; },
    async execute() { throw new Error("lectura post-commit no disponible"); },
  });

  const result = await repository.createIncident("internal", 4, 460, {
    branchId: 223,
    agencyId: 9,
    visitorId: 88,
    visitAt: "2026-08-28T14:30:00",
    comment: "Visita",
    s3Key: null,
  });

  assert.equal(result.id, 327);
  assert.equal(result.reference, "REG-202608-00004");
  assert.equal(result.typeId, 2);
  assert.equal(result.actions[0].id, 91);
  assert.equal(result.actions[0].responsibleId, 77);
  assert.deepEqual(result.actionHistory, []);
  assert.deepEqual(lifecycle, ["begin", "commit", "release"]);
});

test("las mutaciones de acción derivan el incidente real por id y país, no por el scope de URL", async () => {
  const calls = [];
  const lifecycle = [];
  const connection = {
    async beginTransaction() { lifecycle.push("begin"); },
    async commit() { lifecycle.push("commit"); },
    async rollback() { lifecycle.push("rollback"); },
    release() { lifecycle.push("release"); },
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/SELECT a\.codigoAccion AS id/.test(sql)) {
        return [[{
          id: 91,
          incidentId: 327,
          responsibleId: 460,
          dueDate: "2026-08-28",
          statusId: 1,
          isActive: 1,
          branchId: 223,
          typeId: 2,
        }], []];
      }
      return [{ affectedRows: 1, insertId: 1 }, []];
    },
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql, parameters = []) {
      if (/SELECT i\.Cod_Incidente AS id, i\.codigoReferencia AS reference/.test(sql)) {
        return [[{ id: 327, isExternal: 0 }], []];
      }
      return [[], []];
    },
  };

  const result = await createIncidentRepository(pool).updateIncidentAction(
    "external",
    4,
    460,
    91,
    { operation: "start" },
  );

  const parentRead = calls.find(({ sql }) => /SELECT a\.codigoAccion AS id/.test(sql));
  assert.deepEqual(parentRead.parameters, [91, 4]);
  assert.doesNotMatch(parentRead.sql.slice(parentRead.sql.indexOf("WHERE")), /isExterno/);
  assert.equal(result.isExternal, false);
  assert.deepEqual(lifecycle, ["begin", "commit", "release"]);
});
