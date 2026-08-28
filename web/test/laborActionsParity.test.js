import assert from "node:assert/strict";
import test from "node:test";
import {
  actionHistoryFor,
  buildLaborActionMenuItems,
  canOpenLaborActionMenu,
  formatLaborActionCloseDate,
  isAcceptedLaborActionEvidence,
  LABOR_ACTION_MESSAGES,
  LABOR_ACTION_SCREEN_CONTRACT,
} from "../src/pages/laborActionsParity.js";

test("contrato conserva las cinco acciones conectadas y las dos ocultas por Visible=False", () => {
  assert.deepEqual(LABOR_ACTION_SCREEN_CONTRACT.connectedOperations, [
    "start",
    "close",
    "cancel",
    "reassign",
    "reschedule",
  ]);
  assert.deepEqual(LABOR_ACTION_SCREEN_CONTRACT.hiddenOperations, ["reassign", "reschedule"]);
  assert.equal(LABOR_ACTION_SCREEN_CONTRACT.pageSize, 50);
});

test("menu respeta propietario, administrador y estados terminales del OML", () => {
  const owner = { id: 460 };
  const open = { responsibleId: 460, statusId: 1 };
  const running = { responsibleId: 460, statusId: 2 };

  assert.equal(canOpenLaborActionMenu(open, owner), true);
  assert.equal(canOpenLaborActionMenu(open, { id: 99 }), false);
  assert.equal(canOpenLaborActionMenu({ ...open, responsibleId: 99 }, { id: 1 }), true);
  assert.equal(canOpenLaborActionMenu({ ...open, statusId: 3 }, owner), false);
  assert.equal(canOpenLaborActionMenu({ ...open, statusId: 5 }, owner), false);

  assert.deepEqual(buildLaborActionMenuItems(open, owner), [
    { key: "title", label: "Opciones de Acción", disabled: true },
    { key: "start", label: "Iniciar Acción" },
    { key: "close", label: "Cerrar Acción" },
    { key: "cancel", label: "Anular Acción" },
  ]);
  assert.deepEqual(buildLaborActionMenuItems(running, owner).map(({ key }) => key), ["title", "close", "cancel"]);
});

test("fecha, evidencia y mensajes conservan el contrato observable", () => {
  assert.equal(formatLaborActionCloseDate(null), "Sin Fecha Asignada");
  assert.equal(formatLaborActionCloseDate("1900-01-01"), "Sin Fecha Asignada");
  assert.equal(formatLaborActionCloseDate("2026-08-28"), "28 ago 2026");
  for (const name of ["archivo.PNG", "archivo.jpeg", "archivo.JPG", "archivo.pdf"]) {
    assert.equal(isAcceptedLaborActionEvidence(name), true);
  }
  assert.equal(isAcceptedLaborActionEvidence("archivo.docx"), false);
  assert.equal(
    LABOR_ACTION_MESSAGES.invalidEvidence,
    "La extención del Archivo no es Valido. (Solo permite .PNG o .JPEG y PDF)",
  );
  assert.equal(LABOR_ACTION_MESSAGES.incomplete, "Completar los campos");
  assert.equal(LABOR_ACTION_MESSAGES.updated, "Se ha actualizado el estado");
});

test("historico inline filtra exclusivamente por codAccion", () => {
  const detail = {
    actionHistory: [
      { id: 1, actionId: 77, statusId: 2 },
      { id: 2, actionId: 88, statusId: 5 },
      { id: 3, actionId: "77", statusId: 5, s3Key: "safe-key" },
    ],
  };
  assert.deepEqual(actionHistoryFor(detail, 77).map(({ id }) => id), [1, 3]);
});
