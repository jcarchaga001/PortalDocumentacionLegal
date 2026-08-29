import assert from "node:assert/strict";
import test from "node:test";
import {
  GOVERNMENT_ENTITIES_AGGREGATE_LIMIT,
  GOVERNMENT_ENTITIES_FEEDBACK,
  GOVERNMENT_ENTITIES_PAGE_SIZE,
  GOVERNMENT_ENTITIES_QUERY_ERROR,
  governmentEntityArea,
  governmentEntityCreatePayload,
  governmentEntityPaginationTotal,
} from "../src/pages/governmentEntitiesParity.js";

test("scrCatalogoEntes conserva límites, textos y defectos del flujo legacy", () => {
  assert.equal(GOVERNMENT_ENTITIES_PAGE_SIZE, 500);
  assert.equal(GOVERNMENT_ENTITIES_AGGREGATE_LIMIT, 50);
  assert.equal(GOVERNMENT_ENTITIES_QUERY_ERROR, "Error executing query.");
  assert.deepEqual(GOVERNMENT_ENTITIES_FEEDBACK, {
    saved: "Se ha guardado correctamente",
    updated: "Se ha actualizado correctamente",
    deactivated: "Ente inactiva",
  });
});

test("alta conserva Mandatory=False e ignora dropdowns sin Client Action", () => {
  assert.deepEqual(
    governmentEntityCreatePayload({ name: "", description: "", area: "legal", responsibleId: 9 }),
    { name: "", description: "" },
  );
  assert.equal(governmentEntityCreatePayload({ name: "x".repeat(200), description: "y" }).name.length, 128);
});

test("área y paginación conservan el formato observable", () => {
  assert.equal(governmentEntityArea({ legal: 1, regulatory: 1 }), "Legal");
  assert.equal(governmentEntityArea({ legal: 0, regulatory: "1" }), "Regulatorio");
  assert.equal(governmentEntityArea({}), "");
  assert.equal(governmentEntityPaginationTotal(17, [1, 17]), "1 to 17 of 17 items");
});

