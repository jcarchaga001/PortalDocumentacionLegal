import assert from "node:assert/strict";
import test from "node:test";
import {
  getIncidentActionMenu,
  getIncidentActionQueryPresentation,
  getIncidentActionSurface,
  INCIDENT_ACTION_TYPE_OPERATION,
  incidentActionQueryErrorMessage,
  isIncidentActionQueryFailure,
  LEGACY_INCIDENT_ACTION_QUERY_FAILURE,
  runIncidentActionOperation,
} from "../src/pages/incidentActionSurface.js";

test("conserva el switch OML de las cinco operaciones de acciones", () => {
  assert.deepEqual(INCIDENT_ACTION_TYPE_OPERATION, {
    1: "cancel",
    2: "close",
    3: "reassign",
    4: "reschedule",
    5: "start",
  });

  assert.deepEqual(
    getIncidentActionMenu({ statusId: 1 }).map(({ key, label, legacyType }) => ({ key, label, legacyType })),
    [
      { key: "start", label: "Iniciar Acción", legacyType: 5 },
      { key: "cancel", label: "Anular Acción", legacyType: 1 },
      { key: "close", label: "Cerrar Acción", legacyType: 2 },
      { key: "reassign", label: "Reasignar Responsable", legacyType: 3 },
      { key: "reschedule", label: "Reasignar Fecha", legacyType: 4 },
    ],
  );
});

test("distingue el detalle lateral conectado únicamente en la pantalla externa", () => {
  const internal = getIncidentActionSurface("internal");
  const external = getIncidentActionSurface("external");

  assert.equal(internal.sourceName, "scrMisAccionesInternoVisita");
  assert.equal(internal.incidentPredicate, "not tblIncidentesExternos.isExterno");
  assert.equal(internal.referenceDetail, false);
  assert.equal(external.sourceName, "scrMisAccionesExternos");
  assert.equal(external.incidentPredicate, "tblIncidentesExternos.isExterno");
  assert.equal(external.referenceDetail, true);
  assert.equal(external.detailAction, "OnClick");
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
    rows: [],
    loading: false,
    pagination: false,
    showError: true,
    errorMessage: "Error executing query.",
  });
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
