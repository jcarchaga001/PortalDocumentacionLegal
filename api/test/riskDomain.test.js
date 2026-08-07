import assert from "node:assert/strict";
import test from "node:test";
import { createRiskRepository } from "../src/repositories/riskRepository.js";
import {
  createRiskService,
  groupRiskDetails,
  normalizeRiskFilters,
} from "../src/services/riskService.js";

test("normaliza los filtros y conserva la escala legacy de riesgo", () => {
  assert.deepEqual(normalizeRiskFilters({
    page: "2",
    pageSize: "900",
    societyId: "6",
    riskScore: "9",
    accuracyScore: "10",
    statusId: "1",
    sortBy: "codArchivo",
    sortDirection: "ascend",
  }), {
    page: 2,
    pageSize: 500,
    societyId: 6,
    riskScore: 9,
    accuracyScore: 10,
    statusId: 1,
    sortBy: "codArchivo",
    sortDirection: "ASC",
  });

  const defaults = normalizeRiskFilters({ riskScore: "-1", accuracyScore: "no" });
  assert.equal(defaults.riskScore, undefined);
  assert.equal(defaults.accuracyScore, undefined);
  assert.equal(defaults.pageSize, 50);
  assert.equal(defaults.sortDirection, "DESC");
});

test("la consulta replica los joins y usa codPlantilla_Doc como Cod Archivo", async () => {
  const calls = [];
  const repository = createRiskRepository({
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 183 }], []];
      return [[{
        analysisId: 251,
        codArchivo: 115,
        riskScore: "10.00",
        accuracyScore: "10.00",
      }], []];
    },
  });

  const result = await repository.list(4, normalizeRiskFilters({
    societyId: 6,
    riskScore: 9,
    accuracyScore: 10,
    statusId: 1,
  }));
  const listCall = calls.find(({ sql }) => /LIMIT 50 OFFSET 0/.test(sql));
  assert.ok(listCall);
  assert.match(listCall.sql, /rp\.codPlantilla_Doc = a\.CodArchivo/);
  assert.match(listCall.sql, /a\.CodIntSrsal_Departamento = i\.codInstanciasxPlant/);
  assert.match(listCall.sql, /i\.CodIntSrsal_Departamento = s\.codUnidadxSucursal/);
  assert.match(listCall.sql, /rp\.codPlantilla_Doc AS codArchivo/);
  assert.deepEqual(listCall.parameters, [4, 6, 9, 10, 1]);
  assert.equal(result.total, 183);
});

test("agrupa las nueve cláusulas y oculta Found, ceros y fechas centinela", () => {
  const clauses = groupRiskDetails([
    { clauseKey: "early_exit_favorable", detailKey: "Found", value: "True" },
    { clauseKey: "early_exit_favorable", detailKey: "Page", value: "5" },
    { clauseKey: "early_exit_favorable", detailKey: "Start_date", value: "1900-01-01" },
    { clauseKey: "early_exit_favorable", detailKey: "Comment", value: "Cláusula favorable" },
    { clauseKey: "contract_duration", detailKey: "Status_as_of_2026_02_12", value: "VIGENTE" },
    { clauseKey: "public_registry", detailKey: "Registry_reference", value: "Tomo 1" },
  ]);
  assert.deepEqual(clauses.map(({ key, title }) => ({ key, title })), [
    { key: "early_exit_favorable", title: "Favorable" },
    { key: "contract_duration", title: "Duración" },
    { key: "public_registry", title: "Registro Público" },
  ]);
  assert.deepEqual(clauses[0].fields, [
    { key: "Page", label: "Página", value: "5" },
    { key: "Comment", label: "Comentario", value: "Cláusula favorable" },
  ]);
  assert.equal(clauses[1].fields[0].label, "Estatus");
  assert.equal(clauses[2].fields[0].label, "Referencia de Registro");
});

test("el detalle se busca por codPlantilla_Doc y devuelve la escala del legacy", async () => {
  const service = createRiskService({
    async catalogs() {
      return { societies: [], statuses: [] };
    },
    async getByCodArchivo(codArchivo, countryCode) {
      assert.equal(codArchivo, 115);
      assert.equal(countryCode, 4);
      return {
        analysis: {
          analysisId: 251,
          codArchivo: 115,
          countryId: 4,
          societyId: 10,
          branchId: 1070,
          riskScore: "10.00",
          accuracyScore: "10.00",
          statusId: 1,
          shortComment: "Comentario",
        },
        details: [{ clauseKey: "rent", detailKey: "Amount_usd", value: "60474.92" }],
      };
    },
  });

  const detail = await service.detail("115", 4);
  assert.equal(detail.codArchivo, 115);
  assert.equal(detail.riskScore, 10);
  assert.equal(detail.clauses[0].title, "Renta");

  const catalogs = await service.catalogs(4);
  assert.deepEqual(catalogs.riskScores[0], { value: 1, description: "Muy bajo" });
  assert.deepEqual(catalogs.riskScores.at(-1), { value: 10, description: "Máximo" });
  await assert.rejects(
    service.detail("0", 4),
    (error) => error.status === 404 && error.code === "RISK_ANALYSIS_NOT_FOUND",
  );
});
