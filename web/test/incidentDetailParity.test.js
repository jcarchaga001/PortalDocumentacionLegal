import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canOpenIncidentDetailActionMenu,
  formatLegacyIncidentDate,
  formatLegacyIncidentTimestamp,
  INCIDENT_DETAIL_CONTROLS,
  INCIDENT_DETAIL_DATA_SOURCES,
  INCIDENT_DETAIL_GEOMETRY,
  INCIDENT_DETAIL_QUERY_ERROR,
  incidentDetailDisplay,
  incidentDetailQueryFeedback,
  incidentDetailVisibleActions,
} from "../src/pages/incidentDetailParity.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const pageSource = fs.readFileSync(path.join(testDirectory, "../src/pages/IncidentDetailPage.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(testDirectory, "../src/styles/incidents.css"), "utf8");

test("traza los 24 controles y las cinco fuentes de scrAccionesIncidentes", () => {
  assert.equal(INCIDENT_DETAIL_CONTROLS.length, 24);
  assert.equal(new Set(INCIDENT_DETAIL_CONTROLS.map(({ key }) => key)).size, 24);
  assert.deepEqual(INCIDENT_DETAIL_DATA_SOURCES, {
    aggregates: [
      "GetTblAccionesIncidentesByCodigoIncidente",
      "GetEstados",
      "GetAccionSeleccionada",
      "GetIncidente",
    ],
    dataActions: ["GetPersonasAcciones"],
  });
  assert.deepEqual(
    INCIDENT_DETAIL_CONTROLS.filter(({ action }) => action === "EjecutarAccionOnClick").map(({ legacyType }) => legacyType),
    [5, 1, 2, 4, 3],
  );
});

test("acepta solo los dos inputs legacy y conserva una única superficie externa", () => {
  assert.match(pageSource, /readLegacyIncidentDetailRequest\(location\.search\)/);
  assert.doesNotMatch(pageSource, /query\.get\(["']scope["']\)/);
  assert.doesNotMatch(pageSource, /sessionStorage/);
});

test("conserva la geometria medida y el typo de la tabla legacy", () => {
  assert.equal(INCIDENT_DETAIL_GEOMETRY.card.width, 1184.8);
  assert.equal(INCIDENT_DETAIL_GEOMETRY.card.height, 459.8);
  assert.equal(INCIDENT_DETAIL_GEOMETRY.actionTable.headerHeight, 48);
  assert.equal(INCIDENT_DETAIL_GEOMETRY.actionTable.rowHeight, 56);
  assert.deepEqual(INCIDENT_DETAIL_GEOMETRY.actionColumns, [
    190.0125, 315.65, 154.5, 149.425, 153.875, 168.7875, 50.95,
  ]);
  assert.match(pageSource, /Fecha Probable Vencimieno/);
  assert.match(pageSource, /\+ Nueva acción/);
  assert.match(cssSource, /\.legacy-incident-detail-card[\s\S]*border:\s*1px solid #dee2e6/);
});

test("el fallo parcial conserva los datos ya resueltos y muestra el toast exacto", () => {
  const detail = { success: true, data: { id: 327, actions: [{ id: 1 }] } };
  const catalogs = {
    success: false,
    message: INCIDENT_DETAIL_QUERY_ERROR,
    error: { code: "INCIDENT_ACTION_QUERY_ERROR" },
  };
  assert.equal(incidentDetailQueryFeedback(detail, catalogs), "Error executing query.");
  assert.equal(incidentDetailQueryFeedback(detail, { success: true }), "");
  assert.match(pageSource, /<LegacyErrorFeedback message=\{error\}/);
  assert.match(pageSource, /if \(detailResult\.success\) setData\(detailResult\.data\)/);
});

test("mantiene blancos y fechas defectuosas sin inventar guiones", () => {
  assert.equal(incidentDetailDisplay(null), "");
  assert.equal(incidentDetailDisplay(""), "");
  assert.equal(formatLegacyIncidentTimestamp("2026-08-28T14:56:56.000Z"), "2026-08-28 14:56:56");
  assert.equal(formatLegacyIncidentDate("1900-01-01T00:00:00.000Z"), "1900-01-01");
  assert.match(pageSource, /label="Usuario Registró">\{data\.visitorName\}/);
  assert.match(pageSource, /label="Categoría Incidente"/);
  assert.match(pageSource, /label="Recibio Finalizado"/);
});

test("la accion de fila abre el sidebar de 30 por ciento y no un modal inventado", () => {
  assert.match(pageSource, /getIncidentActionDetail\(request\.scope, request\.incidentId, action\.id\)/);
  assert.match(pageSource, /className="legacy-incident-action-drawer"/);
  assert.match(pageSource, /width="30%"/);
  assert.doesNotMatch(pageSource, /Histórico ·/);
  assert.match(pageSource, /\(Descargar Archivo\.\.\.\)/);
});

test("la visibilidad principal conserva estado cerrado e inicio solo en codigo uno", () => {
  assert.deepEqual(incidentDetailVisibleActions(1), {
    newAction: true,
    startAction: true,
    closeAction: true,
    reassignUser: true,
    reassignDate: true,
    cancelAction: true,
  });
  assert.equal(incidentDetailVisibleActions(5).newAction, false);
  assert.equal(incidentDetailVisibleActions(5).startAction, false);
});

test("el kebab coincide con la guarda OML de responsable, usuario uno y estados terminales", () => {
  const open = { responsibleId: 77, statusId: 2 };
  assert.equal(canOpenIncidentDetailActionMenu(open, { id: 77 }), true);
  assert.equal(canOpenIncidentDetailActionMenu(open, { id: 1 }), true);
  assert.equal(canOpenIncidentDetailActionMenu(open, { id: 88 }), false);
  assert.equal(canOpenIncidentDetailActionMenu({ ...open, statusId: 3 }, { id: 77 }), false);
  assert.equal(canOpenIncidentDetailActionMenu({ ...open, statusId: 5 }, { id: 1 }), false);
  assert.equal(canOpenIncidentDetailActionMenu(open, null), false);
  assert.match(pageSource, /if \(!canOpenIncidentDetailActionMenu\(row, user\)\) return null/);
});
