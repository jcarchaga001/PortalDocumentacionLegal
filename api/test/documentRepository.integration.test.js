import assert from "node:assert/strict";
import test from "node:test";
import { closeDatabasePool } from "../src/config/database.js";
import { createDocumentRepository } from "../src/repositories/documentRepository.js";
import { normalizeFilters } from "../src/services/documentService.js";

const integrationTest = process.env.RUN_DB_INTEGRATION === "1" ? test : test.skip;

integrationTest("MySQL devuelve documentos administrativos y por vencer reales", async (context) => {
  context.after(closeDatabasePool);
  const repository = createDocumentRepository();

  const administrative = await repository.list(4, normalizeFilters({ documentType: "administrative", pageSize: 5 }));
  assert.ok(administrative.total > 0);
  assert.ok(administrative.items.every((item) => Number.isInteger(item.id)));

  const expiring = await repository.list(4, normalizeFilters({
    documentType: "all",
    includeInactive: true,
    statusId: 4,
    pageSize: 5,
  }));
  assert.ok(expiring.total > 0);
  assert.ok(expiring.items.every((item) => item.statusId === 4));
  assert.ok(expiring.items.every((item) => typeof item.expirationTime === "string"));

  const firstDocument = administrative.items[0] || expiring.items[0];
  const detail = await repository.getById(4, firstDocument.id);
  assert.equal(detail.id, firstDocument.id);
  assert.ok(detail.branchId > 0);
  const branch = await repository.getBranchDetail(4, detail.branchId);
  assert.equal(branch.branch.id, detail.branchId);
  assert.ok(Array.isArray(branch.documents));
  assert.ok(Array.isArray(branch.books));
  if (detail.hasAttachment) {
    const attachment = await repository.getAttachment(4, detail.id);
    assert.ok(attachment.fileName);
    assert.ok(attachment.s3Key || attachment.buffer?.length);
  }
});
