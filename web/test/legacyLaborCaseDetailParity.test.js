import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LABOR_CASE_SURFACES } from "../src/pages/laborCaseSurface.js";
import { OLD_LABOR_CASE_CONTRACT } from "../src/pages/oldLaborCaseParity.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => fs.readFileSync(path.join(testDirectory, relativePath), "utf8");
const routeSource = read("../src/routes/AppRoutes.jsx");
const currentSource = read("../src/pages/LaborCaseDetailPage.jsx");
const oldSource = read("../src/pages/LegacyLaborCaseDetailPage.jsx");
const cssSource = read("../src/styles/incidents.css");

test("OLD conserva inventario canónico y no hereda contratos exclusivos del current", () => {
  assert.equal(OLD_LABOR_CASE_CONTRACT.sourceName, "srcAccionesIncidentesLegal_OLD");
  assert.equal(OLD_LABOR_CASE_CONTRACT.role, "Registered");
  assert.equal(OLD_LABOR_CASE_CONTRACT.controlKeys.length, 26);
  assert.equal(new Set(OLD_LABOR_CASE_CONTRACT.controlKeys).size, 26);
  assert.equal(OLD_LABOR_CASE_CONTRACT.clientActions.length, 28);
  assert.equal(OLD_LABOR_CASE_CONTRACT.dataSources.length, 12);
  assert.deepEqual(OLD_LABOR_CASE_CONTRACT.unusedDataSources, ["GetPersonasReasignar"]);
  for (const currentOnly of OLD_LABOR_CASE_CONTRACT.absentCurrentFeatures) {
    assert.equal(OLD_LABOR_CASE_CONTRACT.dataSources.includes(currentOnly), false);
    assert.equal(OLD_LABOR_CASE_CONTRACT.clientActions.includes(currentOnly), false);
  }
});

test("ruta OLD monta una superficie pública propia y un contrato separado", () => {
  assert.match(routeSource, /component=\{LegacyLaborCaseDetailPage\}/);
  assert.doesNotMatch(routeSource, /<LaborCaseDetailPage legacy/);
  assert.match(oldSource, /LABOR_CASE_SURFACES\.legacy/);
  assert.match(currentSource, /LABOR_CASE_SURFACES\.current/);
  assert.equal(LABOR_CASE_SURFACES.legacy.rootClassName, "labor-case-surface-old");
  assert.equal(LABOR_CASE_SURFACES.current.rootClassName, "labor-case-surface-current");
});

test("tabla OLD conserva geometría, iconos y expansión inline observados", () => {
  assert.deepEqual(OLD_LABOR_CASE_CONTRACT.table.headers, [
    "Nombre Acción", "Descripción", "Responsable", "Fecha Cierre",
    "Estado", "Evidencia", "Histórico", "",
  ]);
  assert.equal(
    Number(OLD_LABOR_CASE_CONTRACT.table.columnWidths.reduce((sum, width) => sum + width, 0).toFixed(1)),
    1192.8,
  );
  assert.deepEqual(LABOR_CASE_SURFACES.legacy.actionColumnWidths, OLD_LABOR_CASE_CONTRACT.table.columnWidths);
  assert.equal(LABOR_CASE_SURFACES.legacy.actionHistoryMode, "inline");
  assert.equal(LABOR_CASE_SURFACES.legacy.emptyAttachmentsText, "No hay Evidencias Adjuntadas");
  assert.match(currentSource, /fa-file-image-o/);
  assert.match(currentSource, /fa-chevron-up/);
  assert.match(currentSource, /fa-chevron-down/);
  assert.match(currentSource, /fa-ellipsis-v/);
  assert.match(currentSource, /expandedRowRender/);
  assert.match(cssSource, /width: 1194\.4px/);
  assert.match(cssSource, /background: #222/);
});

test("menú de fila OLD conserva el switch de tipos 1 a 5", () => {
  assert.deepEqual(
    OLD_LABOR_CASE_CONTRACT.actionMenu.map(({ type, operation }) => [type, operation]),
    [[1, "start"], [2, "close"], [3, "cancel"], [4, "reassign"], [5, "reschedule"]],
  );
});
