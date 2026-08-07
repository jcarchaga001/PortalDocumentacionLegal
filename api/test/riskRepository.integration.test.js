import assert from "node:assert/strict";
import test from "node:test";
import { closeDatabasePool } from "../src/config/database.js";
import { createRiskRepository } from "../src/repositories/riskRepository.js";
import { normalizeRiskFilters } from "../src/services/riskService.js";

const integrationTest = process.env.RUN_DB_INTEGRATION === "1" ? test : test.skip;

integrationTest("MySQL devuelve los 183 análisis legacy de Honduras y el detalle por Cod Archivo", async (context) => {
  context.after(closeDatabasePool);
  const repository = createRiskRepository();
  const list = await repository.list(4, normalizeRiskFilters({ pageSize: 50 }));
  assert.equal(list.total, 183);
  assert.equal(list.items.length, 50);
  assert.equal(Number(list.items[0].codArchivo), 115);
  assert.ok(list.items.every((item) => Number(item.countryId) === 4));
  assert.ok(list.items.every((item) => Number(item.codArchivo) > 0));

  const detail = await repository.getByCodArchivo(115, 4);
  assert.ok(detail);
  assert.equal(Number(detail.analysis.codArchivo), 115);
  assert.equal(Number(detail.analysis.analysisId), 251);
  assert.match(detail.analysis.s3Key, /^[A-Za-z0-9]+\.pdf$/);
  assert.ok(detail.details.some((item) => item.clauseKey === "early_exit_favorable"));
  assert.ok(detail.details.some((item) => item.detailKey === "Comment"));
});
