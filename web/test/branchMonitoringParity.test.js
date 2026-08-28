import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  branchMonitoringMetrics,
  BRANCH_MONITORING_COLORS,
  BRANCH_MONITORING_TOOLTIPS,
  monitoringCatalogOptions,
  monitoringQueryErrorMessage,
  updateMonitoringFilter,
} from "../src/pages/branchMonitoringParity.js";

test("el donut usa el porcentaje crudo y el texto redondeado del OML", () => {
  const metrics = branchMonitoringMetrics({
    required: 7,
    registered: 6,
    expiring: 2,
    other: 5,
  });

  assert.equal(metrics.registeredRawPercent, (6 / 7) * 100);
  assert.equal(metrics.registeredAriaValue, 85);
  assert.equal(metrics.registeredText, "86%");
  assert.equal(metrics.expiringText, "29%");
  assert.equal(metrics.progressColor, BRANCH_MONITORING_COLORS.incomplete);
  assert.equal(metrics.other, 5);
});

test("solo el cumplimiento exacto al cien por ciento pinta el donut verde", () => {
  assert.equal(
    branchMonitoringMetrics({ required: 7, registered: 7 }).progressColor,
    BRANCH_MONITORING_COLORS.complete,
  );
  assert.equal(
    branchMonitoringMetrics({ required: 7, registered: 5 }).progressColor,
    BRANCH_MONITORING_COLORS.incomplete,
  );
});

test("los catálogos mantienen el orden recibido y los textos legacy", () => {
  assert.deepEqual(monitoringCatalogOptions([
    { id: 135, name: "FA00-Adminitrativa" },
    { id: 204, name: "FA21-TGU - Las Minitas" },
  ]), [
    { value: 135, label: "FA00-Adminitrativa" },
    { value: 204, label: "FA21-TGU - Las Minitas" },
  ]);
  assert.deepEqual(BRANCH_MONITORING_TOOLTIPS, {
    required: "Total de Documentos Requeridos",
    registered: "Total Documentos Registrados / Total Requeridos",
    expiring: "Documentación Proximas a vecer",
    other: "Documentos no Requeridos",
  });
});

test("los filtros GA y sucursal permanecen independientes como sus dos acciones OML", () => {
  const withBranch = updateMonitoringFilter({}, "branchId", 135);
  const withManager = updateMonitoringFilter(withBranch, "managerId", 19);

  assert.deepEqual(withManager, { branchId: 135, managerId: 19 });
  assert.deepEqual(updateMonitoringFilter(withManager, "managerId", undefined), {
    branchId: 135,
    managerId: undefined,
  });
});

test("el error de consulta emerge como feedback global y conserva el mensaje normalizado", async () => {
  assert.equal(monitoringQueryErrorMessage("Ocurrio un error inesperado en el servidor."), "Error executing query.");
  assert.equal(monitoringQueryErrorMessage(), "Error executing query.");

  const source = await readFile(new URL("../src/pages/BranchMonitoringPage.jsx", import.meta.url), "utf8");
  assert.match(source, /<LegacyErrorFeedback/);
  assert.doesNotMatch(source, /<Alert\b/);
});

test("el CSS fija la geometría y colorimetría medidas en el runtime legacy", async () => {
  const css = await readFile(new URL("../src/pages/BranchMonitoringPage.css", import.meta.url), "utf8");

  assert.match(css, /margin: -41px -40px -40px/);
  assert.match(css, /overflow-x: hidden/);
  assert.match(css, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /gap: 16px/);
  assert.doesNotMatch(css, /\.legacy-monitoring-card \{[\s\S]*?height: 499px/);
  assert.match(css, /width: 165px/);
  assert.match(css, /stroke-width: 30px/);
  assert.match(css, /#dee2e6/);
  assert.match(css, /\.legacy-monitoring-summary-line \{[\s\S]*?min-height: 21px/);
  assert.match(css, /\.legacy-monitoring-summary-expiring \{[\s\S]*?min-height: 42px/);
  assert.match(css, /\.legacy-monitoring-filters \.ant-select \{[\s\S]*?height: 40px !important/);
  assert.match(css, /border: 1px solid #ced4da !important/);
  assert.match(css, /\.legacy-monitoring-summary-title > span \{[\s\S]*?font-size: 14px/);
});
