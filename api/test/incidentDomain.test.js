import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentRepository } from "../src/repositories/incidentRepository.js";
import {
  createIncidentService,
  normalizeActionUpdate,
  normalizeIncidentInput,
  normalizeIncidentActionFilters,
  normalizeIncidentFilters,
  normalizeLaborActionUpdate,
  normalizeLaborCaseUpdate,
  normalizeLaborCaseFilters,
} from "../src/services/incidentService.js";

test("normaliza filtros, limita paginacion y descarta fechas no validas", () => {
  const incident = normalizeIncidentFilters({
    page: "2",
    pageSize: "900",
    branchId: "312",
    typeId: "8",
    agencyId: "x",
    startDate: "2026-08-06",
    endDate: "06/08/2026",
    search: "  referencia  ",
  });
  assert.deepEqual(incident, {
    page: 2,
    pageSize: 100,
    branchId: 312,
    typeId: 8,
    agencyId: undefined,
    motiveId: undefined,
    statusId: undefined,
    startDate: "2026-08-06",
    endDate: undefined,
    search: "referencia",
  });

  const actions = normalizeIncidentActionFilters({ responsibleId: "15", dueStartDate: "2026-01-01" });
  assert.equal(actions.responsibleId, 15);
  assert.equal(actions.dueStartDate, "2026-01-01");
  assert.equal(actions.page, 1);

  assert.equal(normalizeLaborCaseFilters({ activeEmployees: "false" }).activeEmployees, false);
  assert.equal(normalizeLaborCaseFilters({}).activeEmployees, true);
});

test("rechaza tipos de incidente que no existen en el legacy", () => {
  const service = createIncidentService({ listIncidents() {} });
  assert.throws(
    () => service.listIncidents("inventado", 4, {}),
    (error) => error.code === "INVALID_INCIDENT_SCOPE" && error.status === 400,
  );
});

test("catalogo de acciones conserva el incidente para resolver responsables legacy", async () => {
  let received;
  const service = createIncidentService({
    getCatalogs(scope, countryCode, filters) {
      received = { scope, countryCode, filters };
      return {};
    },
  });

  await service.catalogs("internal-actions", 4, { incidentId: "318" });

  assert.deepEqual(received, {
    scope: "internal-actions",
    countryCode: 4,
    filters: { branchId: undefined, incidentId: 318 },
  });
});

test("acepta el catalogo independiente de la superficie laboral OLD", async () => {
  let received;
  const service = createIncidentService({
    getCatalogs(scope, countryCode, filters) {
      received = { scope, countryCode, filters };
      return {};
    },
  });

  await service.catalogs("labor-actions-legacy", 4, { incidentId: "318" });

  assert.deepEqual(received, {
    scope: "labor-actions-legacy",
    countryCode: 4,
    filters: { branchId: undefined, incidentId: 318 },
  });
});

test("catalogo laboral vigente une al solicitante con responsables RRHH activos", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/SELECT i\.codigoSolicitante AS applicantId/.test(sql)) {
        return [[{ applicantId: 901 }], []];
      }
      if (/WHERE p\.CodigoPais = \? AND p\.Codigo_Personas = \?\s+UNION/.test(sql)) {
        return [[{ id: 901, name: "Solicitante" }, { id: 902, name: "Legal" }], []];
      }
      if (/ua\.codigoPais = \? AND ua\.isRRHH = 1 AND ua\.isActive = 1/.test(sql)) {
        return [[{ id: 902, name: "Legal" }], []];
      }
      return [[], []];
    },
  });

  const catalogs = await repository.getCatalogs("labor-actions", 4, { incidentId: 318 });

  const actionResponsibleCall = calls.find(({ sql }) => /p\.Codigo_Personas = \?\s+UNION/.test(sql));
  assert.ok(actionResponsibleCall);
  assert.deepEqual(actionResponsibleCall.parameters, [4, 901, 4]);
  assert.deepEqual(catalogs.responsiblePeople.map(({ id }) => id), [901, 902]);
  assert.deepEqual(catalogs.legalResponsiblePeople.map(({ id }) => id), [902]);
});

test("catalogo laboral OLD conserva GetResponsables sin mezclar el contrato vigente", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/LEFT JOIN .*tblPersonas p ON p\.Codigo_Personas = ua\.codigoUsuario/.test(sql)
          && /WHERE ua\.isRRHH = 1/.test(sql)) {
        return [[{ id: 903, name: "Responsable OLD" }], []];
      }
      return [[], []];
    },
  });

  const catalogs = await repository.getCatalogs("labor-actions-legacy", 4, { incidentId: 318 });

  const oldResponsibleCall = calls.find(({ sql }) => /LEFT JOIN .*tblPersonas p/.test(sql)
    && /WHERE ua\.isRRHH = 1/.test(sql));
  assert.ok(oldResponsibleCall);
  assert.match(oldResponsibleCall.sql, /LIMIT 50/);
  assert.doesNotMatch(oldResponsibleCall.sql, /ua\.isActive|p\.isActivo/);
  assert.deepEqual(oldResponsibleCall.parameters, [4]);
  assert.deepEqual(catalogs.responsiblePeople.map(({ id }) => id), [903]);
});

test("responsables de incidente unen personas de sucursal y autorizados por tipo", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/SELECT i\.CodigoSucursal AS branchId, i\.codigoTipoIncidente AS typeId/.test(sql)) {
        return [[{ branchId: 312, typeId: 8 }], []];
      }
      return [[], []];
    },
  });

  await repository.getCatalogs("external-actions", 4, { incidentId: 318 });

  const responsibleCall = calls.find(({ sql }) => /UNION/.test(sql) && /ua\.codigoTipoIncidente = \?/.test(sql));
  assert.ok(responsibleCall);
  assert.match(responsibleCall.sql, /p\.Codigo_Sucursal = \?/);
  assert.deepEqual(responsibleCall.parameters, [4, 312, 8, 4]);
});

test("no persiste una accion con responsable fuera de sucursal y tipo", async () => {
  const events = [];
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async execute(sql) {
      events.push(sql);
      if (/SELECT i\.Cod_Incidente AS id/.test(sql)) {
        return [[{ id: 318, typeId: 8, branchId: 312, statusId: 1, isExternal: 1 }], []];
      }
      if (/OR EXISTS/.test(sql) && /tblUsuariosAcciones/.test(sql)) return [[], []];
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const repository = createIncidentRepository({
    async getConnection() { return connection; },
  });

  await assert.rejects(
    () => repository.createIncidentAction("external", 4, 460, 318, {
      name: "Seguimiento",
      description: "Validar hallazgo",
      responsibleId: 999,
      dueDate: "2026-08-20",
    }),
    (error) => error.code === "INVALID_INCIDENT_RESPONSIBLE" && error.field === "responsibleId",
  );
  assert.deepEqual(events.filter((event) => ["begin", "commit", "rollback", "release"].includes(event)), [
    "begin",
    "rollback",
    "release",
  ]);
  assert.equal(events.some((event) => typeof event === "string" && /INSERT INTO .*tblAccionesIncidentes/.test(event)), false);
});

test("listas de incidentes replican filtros, orden y KPI de la pagina del OML", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 7 }], []];
      return [[{ id: 318, statusId: 1 }, { id: 319, statusId: 5 }], []];
    },
  });

  const result = await repository.listIncidents("external", 4, normalizeIncidentFilters({
    page: 2,
    pageSize: 100,
    branchId: 312,
    motiveId: 9,
  }));

  const listCall = calls.find(({ sql }) => /LIMIT 100 OFFSET 100/.test(sql));
  assert.ok(listCall);
  assert.match(listCall.sql, /tblIncidentesExternos/);
  assert.match(listCall.sql, /tblEntesGubernamentales/);
  assert.match(listCall.sql, /tblCategoriaIncidente/);
  assert.match(listCall.sql, /branchRegistrationDate/);
  assert.match(listCall.sql, /incidentCategory/);
  assert.match(listCall.sql, /createdById/);
  assert.deepEqual(listCall.parameters, [4, 312]);
  assert.doesNotMatch(listCall.sql, /i\.isExterno/);
  assert.doesNotMatch(listCall.sql, /i\.Cod_MotivoIncidente = \?/);
  assert.match(listCall.sql, /ORDER BY i\.FechaApertura ASC/);
  assert.equal(calls.some(({ sql }) => /SUM\(i\.Cod_EstadoIncidente/.test(sql)), false);
  assert.equal(result.total, 7);
  assert.deepEqual(result.metrics, { open: 1, inProgress: 0, paused: 0, closed: 1 });
});

test("mis acciones laborales respeta el usuario autenticado y el administrador legacy", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }], []];
      return [[], []];
    },
  });

  await repository.listLaborActions(4, 99, { page: 1, pageSize: 20 });
  assert.ok(calls.some(({ sql, parameters }) => /a\.responsable = \?/.test(sql) && parameters.includes(99)));
  const userListQuery = calls.find(({ sql }) => /LIMIT 20 OFFSET 0/.test(sql));
  assert.match(userListQuery.sql, /a\.responsable AS responsibleId/);
  assert.match(userListQuery.sql, /actionType\.NombreAccion AS actionName/);

  calls.length = 0;
  await repository.listLaborActions(4, 1, { page: 1, pageSize: 20 });
  assert.ok(calls.some(({ sql, parameters }) => /a\.isActive = 1/.test(sql) && !parameters.includes(1)));
});

test("catalogos del listado de acciones laborales conservan las fuentes OML sin filtros activos agregados", async () => {
  const calls = [];
  const repository = createIncidentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[], []];
    },
  });

  await repository.getCatalogs("labor-actions", 4, {});

  const statuses = calls.find(({ sql }) => /SELECT codigoEstado AS id, nombreEstado AS name/.test(sql));
  const actions = calls.find(({ sql }) => /SELECT codAccion AS id, NombreAccion AS name/.test(sql));
  assert.match(statuses.sql, /tblEstadosIncidentes\b/);
  assert.doesNotMatch(statuses.sql, /tblEstadosIncidentes_Legal|WHERE isActive/);
  assert.doesNotMatch(actions.sql, /WHERE IsActivo/);
});

test("anular una accion laboral no exige una justificacion que el flujo OML no solicita", () => {
  assert.deepEqual(normalizeLaborActionUpdate({ operation: "cancel" }), { operation: "cancel" });
  assert.throws(
    () => normalizeActionUpdate({ operation: "cancel" }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "justification",
  );
});

function actionMutationHarness({
  labor = false,
  responsibleId = 460,
  statusId = 1,
  parentStatusId = 2,
  requiresEvidence = 0,
} = {}) {
  const events = [];
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async execute(sql, parameters) {
      events.push({ sql, parameters });
      if (labor && /SELECT a\.codigoAccionIncidente AS id/.test(sql)) {
        return [[{
          id: 77,
          caseId: 318,
          responsibleId,
          dueDate: "2026-08-20",
          statusId,
          isActive: 1,
        }], []];
      }
      if (!labor && /SELECT a\.codigoAccion AS id/.test(sql)) {
        return [[{
          id: 77,
          incidentId: 318,
          responsibleId,
          dueDate: "2026-08-20",
          statusId,
          branchId: 312,
          typeId: 8,
          isActive: 1,
        }], []];
      }
      if (labor && /SELECT Cod_Incidente AS id, CodigoSucursal AS branchId/.test(sql)) {
        return [[{ id: 318, statusId: parentStatusId, responsibleId, requiresEvidence }], []];
      }
      if (labor && /FROM .*tblPersonas p/.test(sql)) {
        return [[{ id: Number(parameters?.[0] || responsibleId), name: "Responsable" }], []];
      }
      return [{ affectedRows: 1, insertId: 1 }, []];
    },
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql, parameters) {
      events.push({ sql, parameters, read: true });
      if (labor && /SELECT i\.Cod_Incidente AS id, i\.CorrelativoIncidente/.test(sql)) {
        return [[{ id: 318, requiresEvidence }], []];
      }
      if (!labor && /SELECT i\.Cod_Incidente AS id, i\.codigoReferencia/.test(sql)) {
        return [[{ id: 318, isExternal: 0 }], []];
      }
      return [[], []];
    },
  };
  return { repository: createIncidentRepository(pool), events };
}

function closedParentHarness({ labor = false } = {}) {
  const events = [];
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async execute(sql, parameters) {
      events.push({ sql, parameters });
      if (labor && /SELECT Cod_Incidente AS id, CodigoSucursal AS branchId/.test(sql)) {
        return [[{ id: 318, statusId: 5, responsibleId: 460, requiresEvidence: 0 }], []];
      }
      if (!labor && /SELECT i\.Cod_Incidente AS id/.test(sql)) {
        return [[{ id: 318, typeId: 8, branchId: 312, statusId: 5, isExternal: 1 }], []];
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const pool = { async getConnection() { return connection; } };
  return { repository: createIncidentRepository(pool), events };
}

function laborCaseMutationHarness({ statusId = 2, requiresEvidence = 0, openActions = 0 } = {}) {
  const events = [];
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async execute(sql, parameters) {
      events.push({ sql, parameters });
      if (/SELECT Cod_Incidente AS id, CodigoSucursal AS branchId/.test(sql)) {
        return [[{ id: 318, statusId, responsibleId: 460, requiresEvidence }], []];
      }
      if (/SELECT COUNT\(\*\) AS total/.test(sql)) {
        return [[{ total: openActions }], []];
      }
      return [{ affectedRows: 1, insertId: 1 }, []];
    },
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql, parameters) {
      events.push({ sql, parameters, read: true });
      if (/SELECT i\.Cod_Incidente AS id, i\.CorrelativoIncidente/.test(sql)) {
        return [[{ id: 318, requiresEvidence }], []];
      }
      return [[], []];
    },
  };
  return { repository: createIncidentRepository(pool), events };
}

function hasWrite(events) {
  return events.some((event) => event?.sql && /^\s*(?:INSERT|UPDATE|DELETE)\s/i.test(event.sql));
}

test("anular una accion laboral actualiza solo el estado sin enlazar una justificacion inexistente", async () => {
  const { repository, events } = actionMutationHarness({ labor: true, responsibleId: 460 });

  await repository.updateLaborAction(4, 460, 77, normalizeLaborActionUpdate({ operation: "cancel" }));

  const cancellation = events.find((event) => /SET codigoEstado = 3/.test(event?.sql || ""));
  assert.ok(cancellation);
  assert.doesNotMatch(cancellation.sql, /Justificación/);
  assert.deepEqual(cancellation.parameters, [77]);
  assert.deepEqual(
    events.filter((event) => typeof event === "string"),
    ["begin", "commit", "release"],
  );
});

test("incidentes y casos cerrados no aceptan nuevas acciones ni un segundo cierre", async () => {
  const attempts = [
    {
      labor: false,
      code: "INCIDENT_STATE_NOT_ALLOWED",
      invoke: (repository) => repository.createIncidentAction("external", 4, 460, 318, {
        name: "Seguimiento",
        responsibleId: 460,
        dueDate: "2026-08-20",
      }),
    },
    {
      labor: false,
      code: "INCIDENT_STATE_NOT_ALLOWED",
      invoke: (repository) => repository.closeIncident("external", 4, 460, 318, "Cierre repetido"),
    },
    {
      labor: true,
      code: "LABOR_CASE_STATE_NOT_ALLOWED",
      invoke: (repository) => repository.createLaborAction(4, 460, 318, {
        actionId: 1,
        responsibleId: 460,
        dueDate: "2026-08-20",
      }),
    },
  ];

  for (const attempt of attempts) {
    const { repository, events } = closedParentHarness({ labor: attempt.labor });
    await assert.rejects(
      () => attempt.invoke(repository),
      (error) => error.code === attempt.code && error.status === 409,
    );
    assert.equal(hasWrite(events), false);
    assert.deepEqual(events.filter((event) => typeof event === "string"), ["begin", "rollback", "release"]);
  }
});

test("un caso laboral cerrado rechaza pending y close antes de cualquier escritura", async () => {
  for (const operation of ["pending", "close"]) {
    const { repository, events } = laborCaseMutationHarness({ statusId: 5 });
    await assert.rejects(
      () => repository.updateLaborCase(4, 460, 318, {
        operation,
        justification: "No debe persistirse",
        s3Key: operation === "close" ? "evidencia.pdf" : undefined,
        fileName: operation === "close" ? "evidencia.pdf" : undefined,
      }),
      (error) => error.code === "LABOR_CASE_STATE_NOT_ALLOWED" && error.status === 409,
    );
    assert.equal(hasWrite(events), false);
    assert.deepEqual(events.filter((event) => typeof event === "string"), ["begin", "rollback", "release"]);
  }
});

test("el cierre de acción laboral exige evidencia solamente cuando se marca el checkbox legacy", async () => {
  const normalizedAction = normalizeActionUpdate({
    operation: "close",
    justification: "Cierre sin evidencia",
    includeEvidence: false,
  });
  assert.deepEqual(normalizedAction, {
    operation: "close",
    justification: "Cierre sin evidencia",
    includeEvidence: false,
    s3Key: null,
    fileName: null,
  });

  assert.throws(
    () => normalizeActionUpdate({
      operation: "close",
      justification: "Cierre con evidencia",
      includeEvidence: true,
    }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "s3Key",
  );

  const actionHarness = actionMutationHarness({ labor: true });
  await assert.rejects(
    () => actionHarness.repository.updateLaborAction(4, 460, 77, {
      operation: "close",
      justification: "Cierre con evidencia",
      includeEvidence: true,
      s3Key: null,
      fileName: null,
    }),
    (error) => error.code === "LABOR_EVIDENCE_REQUIRED" && error.status === 400,
  );
  assert.equal(hasWrite(actionHarness.events), false);
  assert.deepEqual(
    actionHarness.events.filter((event) => typeof event === "string"),
    ["begin", "rollback", "release"],
  );

  const uncheckedHarness = actionMutationHarness({ labor: true, requiresEvidence: 1 });
  await uncheckedHarness.repository.updateLaborAction(4, 460, 77, normalizedAction);
  assert.equal(hasWrite(uncheckedHarness.events), true);
  assert.deepEqual(
    uncheckedHarness.events.filter((event) => typeof event === "string"),
    ["begin", "commit", "release"],
  );
});

test("el cierre de caso conserva IsEvidencia como regla bloqueada del servidor", async () => {
  const normalizedCase = normalizeLaborCaseUpdate({
    operation: "close",
    justification: "Cierre sin evidencia",
  });
  const caseHarness = laborCaseMutationHarness({ requiresEvidence: 1 });
  await assert.rejects(
    () => caseHarness.repository.updateLaborCase(4, 460, 318, normalizedCase),
    (error) => error.code === "LABOR_EVIDENCE_REQUIRED" && error.status === 400,
  );
  assert.equal(hasWrite(caseHarness.events), false);
  assert.deepEqual(
    caseHarness.events.filter((event) => typeof event === "string"),
    ["begin", "rollback", "release"],
  );
});

test("el cierre sin adjunto sigue permitido cuando IsEvidencia no lo exige", async () => {
  const actionHarness = actionMutationHarness({ labor: true, requiresEvidence: 0 });
  await actionHarness.repository.updateLaborAction(4, 460, 77, {
    operation: "close",
    justification: "Cierre permitido",
    s3Key: null,
    fileName: null,
  });
  assert.equal(hasWrite(actionHarness.events), true);
  assert.deepEqual(
    actionHarness.events.filter((event) => typeof event === "string"),
    ["begin", "commit", "release"],
  );

  const caseHarness = laborCaseMutationHarness({ requiresEvidence: 0 });
  await caseHarness.repository.updateLaborCase(4, 460, 318, {
    operation: "close",
    justification: "Cierre permitido",
    s3Key: null,
    fileName: null,
  });
  assert.equal(hasWrite(caseHarness.events), true);
  assert.deepEqual(
    caseHarness.events.filter((event) => typeof event === "string"),
    ["begin", "commit", "release"],
  );
});

test("acciones ajenas de incidentes y casos laborales devuelven 403 sin UPDATE", async () => {
  for (const labor of [false, true]) {
    const { repository, events } = actionMutationHarness({ labor, responsibleId: 460 });
    const mutation = labor
      ? () => repository.updateLaborAction(4, 99, 77, { operation: "start" })
      : () => repository.updateIncidentAction("internal", 4, 99, 77, { operation: "start" });

    await assert.rejects(mutation, (error) => error.code === "FORBIDDEN" && error.status === 403);
    assert.equal(events.some((event) => event?.sql && /^\s*UPDATE\s/i.test(event.sql)), false);
    assert.deepEqual(
      events.filter((event) => typeof event === "string"),
      ["begin", "rollback", "release"],
    );
  }
});

test("un usuario ajeno no puede iniciar, cerrar ni anular una accion laboral", async () => {
  for (const update of [
    { operation: "start" },
    { operation: "close", justification: "No autorizado", includeEvidence: false },
    { operation: "cancel", justification: "No autorizado" },
  ]) {
    const { repository, events } = actionMutationHarness({
      labor: true,
      responsibleId: 460,
      statusId: 1,
    });

    await assert.rejects(
      () => repository.updateLaborAction(4, 99, 77, update),
      (error) => error.code === "FORBIDDEN" && error.status === 403,
    );
    assert.equal(hasWrite(events), false);
    assert.deepEqual(
      events.filter((event) => typeof event === "string"),
      ["begin", "rollback", "release"],
    );
  }
});

test("propietario y administrador legacy pueden actualizar ambos tipos de accion", async () => {
  for (const labor of [false, true]) {
    for (const actorId of [460, 1]) {
      const { repository, events } = actionMutationHarness({ labor, responsibleId: 460 });
      if (labor) {
        await repository.updateLaborAction(4, actorId, 77, { operation: "start" });
      } else {
        await repository.updateIncidentAction("internal", 4, actorId, 77, { operation: "start" });
      }
      assert.equal(events.some((event) => event?.sql && /^\s*UPDATE\s/i.test(event.sql)), true);
      assert.deepEqual(
        events.filter((event) => typeof event === "string"),
        ["begin", "commit", "release"],
      );
    }
  }
});

test("cualquier usuario autenticado puede reasignar responsable o fecha de una accion laboral abierta", async () => {
  for (const update of [
    { operation: "reassign", responsibleId: 461 },
    { operation: "reschedule", dueDate: "2026-09-01" },
  ]) {
    const { repository, events } = actionMutationHarness({ labor: true, responsibleId: 460 });
    await repository.updateLaborAction(4, 99, 77, update);
    assert.equal(hasWrite(events), true);
    assert.deepEqual(
      events.filter((event) => typeof event === "string"),
      ["begin", "commit", "release"],
    );
  }
});

test("un usuario ajeno no puede reasignar responsable ni fecha de una accion de incidente", async () => {
  for (const update of [
    { operation: "reassign", responsibleId: 461 },
    { operation: "reschedule", dueDate: "2026-09-01" },
  ]) {
    const { repository, events } = actionMutationHarness({ responsibleId: 460 });
    await assert.rejects(
      () => repository.updateIncidentAction("internal", 4, 99, 77, update),
      (error) => error.code === "FORBIDDEN" && error.status === 403,
    );
    assert.equal(hasWrite(events), false);
    assert.deepEqual(
      events.filter((event) => typeof event === "string"),
      ["begin", "rollback", "release"],
    );
  }
});

test("una accion laboral cerrada o anulada no admite reasignaciones", async () => {
  for (const statusId of [3, 5]) {
    for (const update of [
      { operation: "reassign", responsibleId: 461 },
      { operation: "reschedule", dueDate: "2026-09-01" },
    ]) {
      const { repository, events } = actionMutationHarness({
        labor: true,
        responsibleId: 460,
        statusId,
      });
      await assert.rejects(
        () => repository.updateLaborAction(4, 99, 77, update),
        (error) => error.code === "LABOR_ACTION_STATE_NOT_ALLOWED" && error.status === 409,
      );
      assert.equal(hasWrite(events), false);
      assert.deepEqual(
        events.filter((event) => typeof event === "string"),
        ["begin", "rollback", "release"],
      );
    }
  }
});

test("acciones cerradas o anuladas y un inicio fuera de estado abierto no se mutan", async () => {
  for (const statusId of [2, 3, 5]) {
    const { repository, events } = actionMutationHarness({ responsibleId: 460, statusId });
    const operation = statusId === 2 ? "start" : "reassign";
    await assert.rejects(
      () => repository.updateIncidentAction("internal", 4, 460, 77, {
        operation,
        responsibleId: operation === "reassign" ? 461 : undefined,
      }),
      (error) => error.code === "INCIDENT_ACTION_STATE_NOT_ALLOWED" && error.status === 409,
    );
    assert.equal(events.some((event) => event?.sql && /^\s*UPDATE\s/i.test(event.sql)), false);
  }
});

test("registro de incidente exige los mismos campos y evidencia del formulario legacy", () => {
  assert.throws(
    () => normalizeIncidentInput({
      branchId: 312,
      agencyId: 4,
      visitorId: 99,
      visitAt: "2026-08-06T11:23",
      comment: "Todo en orden",
    }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "s3Key",
  );

  assert.deepEqual(
    normalizeIncidentInput({
      branchId: "312",
      agencyId: "4",
      visitorId: "99",
      visitAt: "2026-08-06T11:23",
      comment: "  Todo en orden  ",
      s3Key: "incident-key",
      fileName: "evidencia.pdf",
    }),
    {
      branchId: 312,
      agencyId: 4,
      visitorId: 99,
      visitAt: "2026-08-06 11:23:00",
      comment: "Todo en orden",
      s3Key: "incident-key",
      fileName: "evidencia.pdf",
    },
  );
});

test("acciones y casos laborales solo aceptan las transiciones observadas en OML", () => {
  assert.deepEqual(normalizeActionUpdate({ operation: "reassign", responsibleId: "460" }), {
    operation: "reassign",
    responsibleId: 460,
  });
  assert.deepEqual(normalizeLaborCaseUpdate({ operation: "pending", justification: "Falta constancia" }), {
    operation: "pending",
    justification: "Falta constancia",
  });
  assert.throws(
    () => normalizeActionUpdate({ operation: "invented" }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "operation",
  );
});

test("reasignar responsable o fecha mueve la acción laboral a estado 2 como el OML", async () => {
  const attempts = [
    { operation: "reassign", responsibleId: 461 },
    { operation: "reschedule", dueDate: "2026-08-30" },
  ];

  for (const update of attempts) {
    const { repository, events } = actionMutationHarness({ labor: true, statusId: 1 });
    await repository.updateLaborAction(4, 460, 77, update);

    const actionUpdate = events.find((event) => event?.sql
      && /^\s*UPDATE\s/i.test(event.sql)
      && /tblAccionesIncidentes_Legal/.test(event.sql));
    assert.ok(actionUpdate);
    assert.match(actionUpdate.sql, /codigoEstado\s*=\s*2/);

    const historyInsert = events.find((event) => event?.sql
      && /INSERT INTO .*tblHistoricoIncidentesAccion_Legal/.test(event.sql));
    assert.equal(historyInsert.parameters[4], 2);
  }
});

test("comentarios de incidentes validan pertenencia y confirman la transaccion", async () => {
  const events = [];
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async execute(sql, parameters) {
      events.push({ sql, parameters });
      if (/FROM .*tblIncidentesExternos i/.test(sql)) {
        return [[{ id: 318, typeId: 1, branchId: 312, statusId: 1, isExternal: 1 }], []];
      }
      return [{ insertId: 1, affectedRows: 1 }, []];
    },
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql) {
      if (/SELECT i\.Cod_Incidente AS id/.test(sql)) {
        return [[{ id: 318, isExternal: 1 }], []];
      }
      return [[], []];
    },
  };
  const repository = createIncidentRepository(pool);
  await repository.addIncidentComment("external", 4, 460, 318, {
    comment: "Seguimiento",
    s3Key: null,
  });

  assert.deepEqual(events.filter((event) => typeof event === "string"), ["begin", "commit", "release"]);
  assert.ok(events.some((event) => typeof event === "object" && /INSERT INTO .*tblComentariosIncidentes/.test(event.sql)));
});
