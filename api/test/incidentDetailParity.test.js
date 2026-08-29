import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentController } from "../src/controllers/incidentController.js";
import { createIncidentRepository } from "../src/repositories/incidentRepository.js";
import { createIncidentService } from "../src/services/incidentService.js";

test("GetPersonasAcciones y GetEstados usan solo las consultas del detalle externo", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/SELECT i\.CodigoSucursal AS branchId/.test(sql)) {
        return [[{ branchId: 370, typeId: 2 }], []];
      }
      if (/codigoEstado <> 1/.test(sql)) return [[{ id: 2, name: "En Ejecución" }], []];
      if (/UNION/.test(sql)) return [[{ id: 77, name: "Erik  Nuñez", email: "mock@example.test" }], []];
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const repository = createIncidentRepository(pool);
  const result = await repository.getCatalogs("external-actions", 4, { incidentId: 327 });

  assert.equal(calls.length, 3);
  assert.deepEqual(result.statuses, [{ id: 2, name: "En Ejecución" }]);
  assert.deepEqual(result.responsiblePeople, [{ id: 77, name: "Erik  Nuñez", email: "mock@example.test" }]);
  const statusSql = calls.find(({ sql }) => /codigoEstado <> 1/.test(sql)).sql;
  assert.match(statusSql, /LIMIT 50/);
  assert.doesNotMatch(statusSql, /isActive|ORDER BY/);
  const people = calls.find(({ sql }) => /UNION/.test(sql));
  assert.deepEqual(people.parameters, [4, 370, 2, 4]);
  assert.match(people.sql, /p\.CodigoPais = \? AND p\.Codigo_Sucursal = \?/);
  assert.match(people.sql, /ua\.codigoTipoIncidente = \? AND ua\.codigoPais = \?/);
  assert.doesNotMatch(people.sql, /isActivo|isActive|ORDER BY/);
});

test("GetAccionSeleccionada preserva fechas centinela y aplica la guarda del incidente", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/FROM .*tblIncidentesExternos i/.test(sql)) {
        return [[{ id: 327, typeId: 2, branchId: 370, statusId: 1, isExternal: 1 }], []];
      }
      return [[{
        id: 91,
        incidentId: 327,
        dueDate: "1900-01-01",
        closeDate: "1900-01-01",
        responsibleName: "Erik  Nuñez",
        administratorName: "Administrador",
        isAutomatic: 1,
        isActive: 1,
      }], []];
    },
  };
  const repository = createIncidentRepository(pool);
  const result = await repository.getIncidentAction("external", 4, 327, 91);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].parameters, [327, 4]);
  assert.doesNotMatch(calls[0].sql.slice(calls[0].sql.indexOf("WHERE")), /isExterno/);
  assert.deepEqual(calls[1].parameters, [91, 327]);
  assert.match(calls[1].sql, /administrator\.Nombre_Personas AS administratorName/);
  assert.match(calls[1].sql, /DATE_FORMAT\(a\.fechaFin, '%Y-%m-%d'\) AS closeDate/);
  assert.doesNotMatch(calls[1].sql, /YEAR\(a\.fechaFin\)|a\.isActive = 1/);
  assert.equal(result.closeDate, "1900-01-01");
  assert.equal(result.isAutomatic, true);
});

test("GetIncidente conserva orden de referencia, comentarios sin sort y limite 50", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/SELECT i\.Cod_Incidente AS id, i\.codigoReferencia AS reference/.test(sql)) {
        return [[{
          id: 327,
          reference: "IR-202608-00003",
          registrationDate: "2026-08-28 14:56:56",
          visitorName: "Lexandra Nicolle Aguilar Carcamo",
          registeredByName: "Otro nombre",
          isExternal: 1,
        }], []];
      }
      if (/FROM .*tblAccionesIncidentes a/.test(sql)) return [[{ id: 91, isAutomatic: 1 }], []];
      if (/FROM .*tblComentariosIncidentes c/.test(sql)) return [[{ id: 1 }], []];
      if (/FROM .*tblHistoricoIncidentesAccion h/.test(sql)) return [[], []];
      throw new Error("Consulta inesperada");
    },
  };
  const result = await createIncidentRepository(pool).getIncident("external", 4, 327);
  const actionSql = calls.find(({ sql }) => /FROM .*tblAccionesIncidentes a/.test(sql)).sql;
  const commentSql = calls.find(({ sql }) => /FROM .*tblComentariosIncidentes c/.test(sql)).sql;
  const incidentSql = calls[0].sql;

  assert.match(incidentSql, /DATE_FORMAT\(i\.fechaHoraRegistro, '%Y-%m-%d %H:%i:%s'\)/);
  assert.deepEqual(calls[0].parameters, [327, 4]);
  assert.doesNotMatch(incidentSql.slice(incidentSql.indexOf("WHERE")), /isExterno/);
  assert.match(actionSql, /ORDER BY a\.AccionReferencia\s*$/);
  assert.doesNotMatch(actionSql, /CAST\(a\.AccionReferencia|a\.codigoAccion$/);
  assert.match(commentSql, /LIMIT 50\s*$/);
  assert.doesNotMatch(commentSql, /ORDER BY/);
  assert.equal(result.actions[0].isAutomatic, true);
  assert.equal(result.comments.length, 1);
});

test("la ruta externa carga por id y país una fila cuyo isExterno persistido es falso", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/SELECT i\.Cod_Incidente AS id, i\.codigoReferencia AS reference/.test(sql)) {
        return [[{ id: 327, reference: "IR-202608-00003", isExternal: 0 }], []];
      }
      return [[], []];
    },
  };

  const result = await createIncidentRepository(pool).getIncident("external", 4, 327);

  assert.equal(result.id, 327);
  assert.equal(result.isExternal, false);
  assert.deepEqual(calls[0].parameters, [327, 4]);
  assert.doesNotMatch(calls[0].sql.slice(calls[0].sql.indexOf("WHERE")), /isExterno/);
});

test("servicio y controller exponen la lectura de GetAccionSeleccionada", async () => {
  const calls = [];
  const repository = {
    async getIncidentAction(scope, countryCode, incidentId, actionId) {
      calls.push({ scope, countryCode, incidentId, actionId });
      return { id: actionId };
    },
  };
  const service = createIncidentService(repository);
  assert.deepEqual(await service.getIncidentAction("external", 4, "327", "91"), { id: 91 });

  const controller = createIncidentController(service);
  const state = {};
  await controller.incidentAction({
    params: { scope: "external", incidentId: "327", actionId: "91" },
    auth: { countryCode: 4 },
  }, {
    json(body) { state.body = body; },
  }, (error) => { throw error; });

  assert.equal(state.body.success, true);
  assert.equal(state.body.data.id, 91);
  assert.deepEqual(calls, [
    { scope: "external", countryCode: 4, incidentId: 327, actionId: 91 },
    { scope: "external", countryCode: 4, incidentId: 327, actionId: 91 },
  ]);
});
