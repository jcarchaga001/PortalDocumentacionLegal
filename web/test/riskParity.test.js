import assert from "node:assert/strict";
import test from "node:test";
import {
  compactRiskScore,
  legacyRiskCounter,
  legacyRiskStatusTone,
  nextLegacyRiskSort,
  RISK_CLAUSE_TITLES,
  RISK_DETAIL_LABELS,
  RISK_PAGE_SIZE,
  RISK_QUERY_ERROR,
  RISK_SCORE_OPTIONS,
} from "../src/pages/riskParity.js";

test("scrHistoricoRiesgo conserva escala, paginación y texto de error legacy", () => {
  assert.equal(RISK_PAGE_SIZE, 50);
  assert.equal(RISK_QUERY_ERROR, "Error executing query.");
  assert.deepEqual(RISK_SCORE_OPTIONS.map(({ value, description }) => `${value} - ${description}`), [
    "1 - Muy bajo",
    "2 - Bajo",
    "3 - Bajo-Moderado",
    "4 - Moderado-Bajo",
    "5 - Moderado",
    "6 - Moderado-Alto",
    "7 - Alto",
    "8 - Muy Alto",
    "9 - Crítico",
    "10 - Máximo",
  ]);
  assert.equal(legacyRiskCounter(1, 50, 182), "1 to 50 of 182 items");
  assert.equal(legacyRiskCounter(4, 50, 182), "151 to 182 of 182 items");
  assert.equal(legacyRiskCounter(1, 50, 0), "0 to 0 of 0 items");
});

test("scrHistoricoRiesgo conserva sort binario y estados visuales legacy", () => {
  assert.deepEqual(nextLegacyRiskSort({ sortBy: "riskScore", sortDirection: "DESC" }, "riskScore"), {
    sortBy: "riskScore",
    sortDirection: "ASC",
  });
  assert.deepEqual(nextLegacyRiskSort({ sortBy: "riskScore", sortDirection: "ASC" }, "riskScore"), {
    sortBy: "riskScore",
    sortDirection: "DESC",
  });
  assert.equal(legacyRiskStatusTone("Vigente"), "green");
  assert.equal(legacyRiskStatusTone("Vencido"), "red");
  assert.equal(legacyRiskStatusTone("Por Vencer"), "neutral");
  assert.equal(legacyRiskStatusTone("Inactivo"), "neutral");
  assert.equal(compactRiskScore("10.00"), "10");
});

test("scrDetalleRiesgo conserva las nueve cláusulas y etiquetas exactas", () => {
  assert.deepEqual(RISK_CLAUSE_TITLES.map(({ title }) => title), [
    "Favorable",
    "Penalidad",
    "Duración",
    "Renovación",
    "Renta",
    "Incremento Anual",
    "Seguros",
    "Jurisdicción",
    "Registro Público",
  ]);
  assert.equal(RISK_DETAIL_LABELS.Found, "Encontró");
  assert.equal(RISK_DETAIL_LABELS.Status_as_of_2026_02_12, "Estatus");
  assert.equal(RISK_DETAIL_LABELS.Registry_reference, "Referencia de Registro");
});
