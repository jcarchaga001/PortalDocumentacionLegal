import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogRepository } from "../src/repositories/catalogRepository.js";
import {
  createCatalogService,
  normalizeLegalActionFilters,
} from "../src/services/catalogService.js";

function pagedPoolRecorder() {
  const calls = [];
  return {
    calls,
    pool: {
      async execute(sql, parameters) {
        calls.push({ sql, parameters });
        if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }], []];
        return [[], []];
      },
    },
  };
}

test("GetTblAccionesLegals conserva MaxRecords 50 y el orden inicial vacío", async () => {
  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);

  await repository.listLegalActions(normalizeLegalActionFilters({}));

  const listCall = calls.find(({ sql }) => /SELECT a\.codAccion AS id/.test(sql));
  assert.match(listCall.sql, /LEFT JOIN .*tblPersonas p/s);
  assert.match(listCall.sql, /p\.Codigo_Personas = CAST\(a\.UsuarioCreado AS UNSIGNED\)/);
  assert.match(listCall.sql, /DATE_FORMAT\(a\.FechaCreado, '%Y-%m-%d %H:%i:%s'\) AS createdAt/);
  assert.match(listCall.sql, /LIMIT 50 OFFSET 0/);
  assert.doesNotMatch(listCall.sql, /ORDER BY/);
  assert.doesNotMatch(listCall.sql, /COALESCE\(NULLIF\(TRIM\(p\.Nombre_Personas\)/);
  assert.deepEqual(listCall.parameters, []);
});

test("OnSort solo acepta los tres AttributeSort del Aggregate", async () => {
  assert.deepEqual(normalizeLegalActionFilters({
    page: "2",
    pageSize: "500",
    sortBy: "createdBy",
    sortOrder: "desc",
  }), {
    page: 2,
    pageSize: 50,
    sortOrder: "desc",
    sortBy: "createdBy",
  });
  assert.equal(normalizeLegalActionFilters({ sortBy: "active" }).sortBy, undefined);

  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);
  await repository.listLegalActions(normalizeLegalActionFilters({ sortBy: "createdBy", sortOrder: "desc" }));
  const listCall = calls.find(({ sql }) => /SELECT a\.codAccion AS id/.test(sql));
  assert.match(listCall.sql, /ORDER BY a\.UsuarioCreado DESC/);
});

test("GetTblAccionesLegalByCodAccion filtra por id y conserva MaxRecords 50", async () => {
  const calls = [];
  const repository = createCatalogRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{ id: 7, name: "Audiencia", active: 1 }], []];
    },
  });

  assert.deepEqual(await repository.getLegalAction(7), { id: 7, name: "Audiencia", active: 1 });
  assert.match(calls[0].sql, /WHERE codAccion = \?/);
  assert.match(calls[0].sql, /LIMIT 50/);
  assert.deepEqual(calls[0].parameters, [7]);
});

test("GuardarOnClick permite nombre vacío y Update consulta antes de persistir", async () => {
  const calls = [];
  const repository = {
    async getLegalAction(id) {
      calls.push(["get", id]);
      return { id, name: "Anterior", active: false };
    },
    async createLegalAction(actorId, timestamp, action) {
      calls.push(["create", actorId, timestamp, action]);
      return 10;
    },
    async updateLegalAction(id, action) {
      calls.push(["update", id, action]);
      return true;
    },
  };
  const service = createCatalogService(repository, {
    now: () => new Date("2026-08-28T20:47:53.000Z"),
  });

  assert.deepEqual(
    await service.createLegalAction({ id: 88 }, { name: "", active: false }),
    { id: 10, name: "", active: false },
  );
  assert.deepEqual(
    await service.updateLegalAction(7, { name: "  Acción  ", active: true }),
    { id: 7, name: "  Acción  ", active: true },
  );
  assert.deepEqual(calls, [
    ["create", 88, "2026-08-28 20:47:53", { name: "", active: false }],
    ["get", 7],
    ["update", 7, { name: "  Acción  ", active: true }],
  ]);
});
