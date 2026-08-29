import assert from "node:assert/strict";
import test from "node:test";
import {
  getIncidentActionMenu,
  getIncidentActionQueryPresentation,
  getIncidentActionSurface,
  compareIncidentActionRows,
  formatLegacyActionDate,
  legacyIncidentActionFooterText,
  INCIDENT_ACTION_TYPE_OPERATION,
  incidentActionQueryErrorMessage,
  isIncidentActionQueryFailure,
  LEGACY_INCIDENT_ACTION_QUERY_FAILURE,
  runIncidentActionOperation,
} from "../src/pages/incidentActionSurface.js";

test("conserva el switch OML de las cinco operaciones de acciones", () => {
  assert.deepEqual(INCIDENT_ACTION_TYPE_OPERATION, {
    1: "close",
    2: "reassign",
    3: "cancel",
    4: "reschedule",
    5: "start",
  });

  assert.deepEqual(
    getIncidentActionMenu({ statusId: 1 }).map(({ key, label, legacyType }) => ({ key, label, legacyType })),
    [
      { key: "start", label: "Iniciar Acción", legacyType: 5 },
      { key: "close", label: "Cerrar Acción", legacyType: 1 },
      { key: "reassign", label: "Reasignar Usuario", legacyType: 2 },
      { key: "reschedule", label: "Reasignar Fecha Entrega", legacyType: 4 },
      { key: "cancel", label: "Anular Acción", legacyType: 3 },
    ],
  );
  assert.deepEqual(getIncidentActionMenu({ statusId: 3 }), []);
  assert.deepEqual(getIncidentActionMenu({ statusId: 5 }), []);
});

test("distingue el detalle lateral conectado únicamente en la pantalla externa", () => {
  const internal = getIncidentActionSurface("internal");
  const external = getIncidentActionSurface("external");

  assert.equal(internal.sourceName, "scrMisAccionesInternoVisita");
  assert.equal(internal.incidentPredicate, "not tblIncidentesExternos.isExterno");
  assert.equal(internal.referenceDetail, false);
  assert.equal(internal.controlCount, 18);
  assert.equal(internal.title, "Acciones Incidentes Internos");
  assert.equal(external.sourceName, "scrMisAccionesExternos");
  assert.equal(external.incidentPredicate, "tblIncidentesExternos.isExterno");
  assert.equal(external.referenceDetail, true);
  assert.equal(external.detailAction, "OnClick");
  assert.equal(external.controlCount, 19);
  assert.equal(external.title, "Acciones Incidentes Externos");
});

test("muestra el fallo observable solo cuando la API identifica el error de consulta", () => {
  assert.deepEqual(LEGACY_INCIDENT_ACTION_QUERY_FAILURE, {
    code: "INCIDENT_ACTION_QUERY_ERROR",
    message: "Error executing query.",
    persistent: true,
  });
  assert.equal(isIncidentActionQueryFailure("INCIDENT_ACTION_QUERY_ERROR"), true);
  assert.equal(isIncidentActionQueryFailure("API_UNAVAILABLE"), false);
  assert.equal(
    incidentActionQueryErrorMessage("INCIDENT_ACTION_QUERY_ERROR"),
    "Error executing query.",
  );
  assert.deepEqual(getIncidentActionQueryPresentation({
    rows: [{ id: 1 }],
    loading: true,
    pagination: { current: 2, total: 20 },
    errorCode: "INCIDENT_ACTION_QUERY_ERROR",
  }), {
    rows: [{ id: 1 }],
    loading: false,
    pagination: { current: 2, total: 20 },
    showError: true,
    errorMessage: "Error executing query.",
  });
});

test("el fallo de una DataAction conserva la fila externa y su conteo defectuoso", () => {
  const pagination = { current: 1, pageSize: 50, total: 370 };
  const presentation = getIncidentActionQueryPresentation({
    rows: [{ id: 91, incidentTypeId: 2, branchId: 370 }],
    pagination,
    errorCode: "INCIDENT_ACTION_QUERY_ERROR",
  });

  assert.deepEqual(presentation.rows, [{ id: 91, incidentTypeId: 2, branchId: 370 }]);
  assert.equal(presentation.pagination, pagination);
  assert.equal(presentation.showError, true);
});

test("formatea fechas y ordena como los HeaderCell del TableRecords", () => {
  assert.equal(formatLegacyActionDate("2026-08-28"), "28 Aug 2026");
  assert.equal(formatLegacyActionDate(""), "—");
  const rows = [{ actionName: "Acción 10" }, { actionName: "Acción 2" }];
  assert.deepEqual(rows.sort(compareIncidentActionRows("actionName")), [
    { actionName: "Acción 2" },
    { actionName: "Acción 10" },
  ]);
});

test("conserva como un solo texto la Expression rota al pie", () => {
  assert.equal(legacyIncidentActionFooterText([], 0), "0 __ 0___0");
  assert.equal(legacyIncidentActionFooterText([
    { incidentTypeId: 2, branchId: 312 },
    { incidentTypeId: 2, branchId: 370 },
  ], 0), "2 __ 0___370");
});

test("una consulta exitosa vacía o un fallo ajeno no inventan el toast legacy", () => {
  const pagination = { current: 1, pageSize: 50, total: 0 };
  assert.deepEqual(getIncidentActionQueryPresentation({ pagination }), {
    rows: [],
    loading: false,
    pagination,
    showError: false,
    errorMessage: "",
  });
  assert.deepEqual(getIncidentActionQueryPresentation({
    rows: [{ id: 7 }],
    pagination,
    errorCode: "API_UNAVAILABLE",
  }), {
    rows: [{ id: 7 }],
    loading: false,
    pagination,
    showError: false,
    errorMessage: "",
  });
});

test("el cierre usa mocks para subir evidencia y enviar el contrato existente", async () => {
  const calls = [];
  const result = await runIncidentActionOperation({
    scope: "external",
    row: { id: 91, incidentId: 318 },
    operation: "close",
    values: { justification: "Cierre verificado" },
    evidenceFile: { name: "evidencia.pdf" },
    async uploadEvidence(file, metadata) {
      calls.push({ operation: "upload", file, metadata });
      return { success: true, data: { s3Key: "mock-key", fileName: file.name } };
    },
    async updateAction(scope, actionId, body) {
      calls.push({ operation: "update", scope, actionId, body });
      return { success: true };
    },
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls, [
    {
      operation: "upload",
      file: { name: "evidencia.pdf" },
      metadata: { scope: "external", incidentId: "318", actionId: "91" },
    },
    {
      operation: "update",
      scope: "external",
      actionId: 91,
      body: {
        operation: "close",
        justification: "Cierre verificado",
        s3Key: "mock-key",
        fileName: "evidencia.pdf",
        includeEvidence: true,
      },
    },
  ]);
});

test("el cierre sin evidencia no invoca ninguna mutación", async () => {
  let updates = 0;
  const result = await runIncidentActionOperation({
    scope: "internal",
    row: { id: 45, incidentId: 200 },
    operation: "close",
    values: { justification: "Pendiente" },
    async uploadEvidence() {
      throw new Error("no debe ejecutarse");
    },
    async updateAction() {
      updates += 1;
      return { success: true };
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.field, "evidence");
  assert.equal(updates, 0);
});
