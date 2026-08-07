import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentController } from "../src/controllers/incidentController.js";
import { createIncidentRepository } from "../src/repositories/incidentRepository.js";
import {
  createIncidentService,
  normalizeLaborCaseUpdate,
} from "../src/services/incidentService.js";

function mutationHarness({
  statusId = 2,
  responsibleId = 460,
  reference = "CL-2608-0424",
} = {}) {
  const events = [];
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async execute(sql, parameters) {
      events.push({ sql, parameters });
      if (/SELECT Cod_Incidente AS id, CodigoSucursal AS branchId/.test(sql)) {
        return [[{
          id: 318,
          branchId: 312,
          statusId,
          responsibleId,
          reference,
          requiresEvidence: 0,
        }], []];
      }
      if (/SELECT p\.Codigo_Personas AS id, p\.Nombre_Personas AS name/.test(sql)) {
        return [[{ id: Number(parameters[0]), name: "Responsable nuevo" }], []];
      }
      return [{ affectedRows: 1, insertId: 1 }, []];
    },
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql, parameters) {
      events.push({ sql, parameters, read: true });
      if (/SELECT i\.Cod_Incidente AS id, i\.CorrelativoIncidente AS incidentNumber/.test(sql)) {
        return [[{
          id: 318,
          incidentNumber: reference,
          statusId,
          responsibleId,
          requiresEvidence: 0,
        }], []];
      }
      return [[], []];
    },
  };
  return { repository: createIncidentRepository(pool), events };
}

function writes(events) {
  return events.filter((event) => event?.sql && /^\s*(?:INSERT|UPDATE|DELETE)\s/i.test(event.sql));
}

test("normaliza las dos acciones del menu contextual laboral sin inventar campos", () => {
  assert.deepEqual(normalizeLaborCaseUpdate({ operation: "cancel" }), { operation: "cancel" });
  assert.deepEqual(
    normalizeLaborCaseUpdate({ operation: "reassign", responsibleId: "461" }),
    { operation: "reassign", responsibleId: 461 },
  );
  assert.throws(
    () => normalizeLaborCaseUpdate({ operation: "reassign" }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "responsibleId",
  );
});

test("reasignar desde el listado solo cambia codResponsable y registra el texto OML exacto", async () => {
  const { repository, events } = mutationHarness();
  await repository.updateLaborCase(4, 460, 318, {
    operation: "reassign",
    responsibleId: 461,
  });

  const caseUpdate = writes(events).find((event) => /UPDATE .*tblIncidentesInternos_Legal/.test(event.sql));
  assert.ok(caseUpdate);
  assert.match(caseUpdate.sql, /SET codResponsable = \?/);
  assert.doesNotMatch(caseUpdate.sql, /usuarioActualizo|FechaActualizo|Cod_EstadoIncidente/);
  assert.deepEqual(caseUpdate.parameters, [461, 318]);

  const history = writes(events).find((event) => /INSERT INTO .*tblHistoricoIncidentes_Legal/.test(event.sql));
  assert.deepEqual(history.parameters, [460, 4, "Reasignación de Usuario", 2, 318, null]);
  assert.equal(writes(events).some((event) => /tblComentariosIncidentes_Legal/.test(event.sql)), false);
});

test("anular como usuario registrado cambia solo el estado y registra correlativo y estado 3", async () => {
  const { repository, events } = mutationHarness({ responsibleId: 999 });
  await repository.updateLaborCase(4, 460, 318, { operation: "cancel" });

  const caseUpdate = writes(events).find((event) => /UPDATE .*tblIncidentesInternos_Legal/.test(event.sql));
  assert.ok(caseUpdate);
  assert.match(caseUpdate.sql, /SET Cod_EstadoIncidente = 3/);
  assert.doesNotMatch(caseUpdate.sql, /usuarioActualizo|FechaActualizo|codResponsable/);
  assert.deepEqual(caseUpdate.parameters, [318]);

  const history = writes(events).find((event) => /INSERT INTO .*tblHistoricoIncidentes_Legal/.test(event.sql));
  assert.deepEqual(history.parameters, [460, 4, "Anular Caso CL-2608-0424", 3, 318, null]);
  assert.equal(writes(events).some((event) => /tblComentariosIncidentes_Legal/.test(event.sql)), false);
});

test("cualquier usuario registrado puede gestionar un caso de otro responsable", async () => {
  for (const update of [
    { operation: "cancel" },
    { operation: "reassign", responsibleId: 461 },
  ]) {
    const { repository, events } = mutationHarness({ responsibleId: 460 });
    await repository.updateLaborCase(4, 99, 318, update);
    assert.equal(writes(events).some((event) => /UPDATE .*tblIncidentesInternos_Legal/.test(event.sql)), true);
    const caseRead = events.find((event) => event?.sql && /WHERE Cod_Incidente = \? AND codigoPais = \?/.test(event.sql));
    assert.deepEqual(caseRead.parameters, [318, 4]);
  }
});

test("las acciones del listado permanecen disponibles incluso en estados terminales", async () => {
  for (const statusId of [3, 5]) {
    for (const update of [
      { operation: "cancel" },
      { operation: "reassign", responsibleId: 461 },
    ]) {
      const { repository, events } = mutationHarness({ statusId });
      await repository.updateLaborCase(4, 460, 318, update);
      assert.equal(writes(events).some((event) => /UPDATE .*tblIncidentesInternos_Legal/.test(event.sql)), true);
    }
  }
});

test("una segunda anulacion vuelve a insertar el historico observado en vivo", async () => {
  const { repository, events } = mutationHarness({ statusId: 3 });
  await repository.updateLaborCase(4, 460, 318, { operation: "cancel" });
  await repository.updateLaborCase(4, 460, 318, { operation: "cancel" });

  const historyRows = writes(events).filter((event) => /INSERT INTO .*tblHistoricoIncidentes_Legal/.test(event.sql));
  assert.equal(historyRows.length, 2);
  assert.equal(historyRows.every((event) => event.parameters[2] === "Anular Caso CL-2608-0424"), true);
});

test("el controlador y servicio entregan pais y usuario registrados al repositorio", async () => {
  let received;
  const service = createIncidentService({
    updateLaborCase(...parameters) {
      received = parameters;
      return { id: 318 };
    },
  });
  const controller = createIncidentController(service);
  let responseBody;
  await controller.updateLaborCase(
    {
      auth: { countryCode: 4, id: 460, positionCode: 7 },
      params: { caseId: "318" },
      body: { operation: "cancel" },
    },
    { json(body) { responseBody = body; } },
    (error) => { throw error; },
  );

  assert.deepEqual(received, [4, 460, 318, { operation: "cancel" }]);
  assert.equal(responseBody.success, true);
});
