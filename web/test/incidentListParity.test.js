import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatIncidentListDate,
  INCIDENT_LIST_PAGE_SIZE,
  INCIDENT_LIST_SURFACES,
  incidentListMetrics,
  incidentListPaginationSummary,
} from "../src/pages/incidentListParity.js";

test("las dos listas conservan contratos independientes, rutas y cinco controles OML", () => {
  const internal = INCIDENT_LIST_SURFACES.internal;
  const external = INCIDENT_LIST_SURFACES.external;
  assert.equal(INCIDENT_LIST_PAGE_SIZE, 50);
  assert.equal(internal.screen, "srcIncidentesInternoVisita");
  assert.equal(external.screen, "srcIncidentesExternos");
  assert.equal(internal.role, "Registered");
  assert.equal(external.role, "Registered");
  assert.equal(internal.createRoute, "scrRegistroIncidentesInternos");
  assert.equal(external.createRoute, "scrRegistroIncicentesExternos");
  assert.equal(external.agencyColumn, "Ente Gubernamental");
  assert.equal(Object.keys(internal.controlKeys).length, 5);
  assert.equal(Object.keys(external.controlKeys).length, 5);
  assert.equal(internal.queryContract.externalFilter, "not isExterno");
  assert.equal(external.queryContract.externalFilter, null);
  assert.equal(internal.columnWidths.reduce((sum, width) => sum + width, 0), 1198.4);
  assert.equal(external.columnWidths.reduce((sum, width) => sum + width, 0), 1198.4);
});

test("KPI replica GetIncidentesOnAfterFetch sobre la pagina actual", () => {
  assert.deepEqual(incidentListMetrics([
    { statusId: 1 }, { statusId: 1 }, { statusId: 2 }, { statusId: 4 }, { statusId: 5 }, { statusId: 9 },
  ]), { open: 2, inProgress: 1, paused: 1, closed: 1 });
});

test("fecha, empty y resumen del paginador conservan textos legacy", () => {
  assert.equal(formatIncidentListDate("2026-08-28T14:56:56.000Z"), "2026-08-28 14:56:56");
  assert.equal(incidentListPaginationSummary({ current: 1, pageSize: 50, total: 1, rowCount: 1 }), "1 to 1 of 1 items");
  assert.equal(incidentListPaginationSummary({ current: 1, pageSize: 50, total: 0, rowCount: 0 }), "");
  assert.equal(incidentListPaginationSummary({ current: 2, pageSize: 50, total: 63, rowCount: 13 }), "51 to 63 of 63 items");
});

test("estructura JSX conserva labels, iconos FA, empty y error feedback", async () => {
  const source = `${await readFile(new URL("../src/pages/IncidentListPage.jsx", import.meta.url), "utf8")}\n${await readFile(new URL("../src/pages/incidentListParity.js", import.meta.url), "utf8")}`;
  for (const text of [
    "+ Nuevo Incidente",
    "fa-file-excel-o",
    "fa-folder-open",
    "fa-play",
    "fa-pause",
    "fa-star",
    "fa-external-link",
    "No hay registros...",
    "LegacyErrorFeedback",
    "Fecha Visita",
    "Recibio Visita",
    "Ente Gubernamental",
    "Ente Regulatorio:",
    "Motivo Incidente:",
  ]) assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /resetPageOnFilters: false/);
  assert.match(source, /pagination=\{false\}/);
  assert.doesNotMatch(source, /[?&]scope=/);
});
