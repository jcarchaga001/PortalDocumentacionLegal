import assert from "node:assert/strict";
import test from "node:test";
import { buildLegacyBranchHistoryFilters } from "../src/pages/documentHistoryFilters.js";

test("el rango visible refresca el histórico de sucursales sin restringir su consulta", () => {
  const filters = buildLegacyBranchHistoryFilters({
    branchId: 12,
    dateRange: ["2026-08-28", "2026-08-28"],
    categoryId: 3,
    subcategoryId: 7,
    statusId: 2,
    search: "CON-2026",
  });

  assert.deepEqual(filters, {
    surface: "branch-history",
    branchId: 12,
    categoryId: 3,
    subcategoryId: 7,
    statusId: 2,
    search: "CON-2026",
  });
  assert.equal(Object.hasOwn(filters, "startDate"), false);
  assert.equal(Object.hasOwn(filters, "endDate"), false);
});
