import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardService } from "../src/services/dashboardService.js";
import { normalizeFilters } from "../src/services/documentService.js";
import { createDocumentRepository } from "../src/repositories/documentRepository.js";

test("dashboard transforma la fila global y las tarjetas", async () => {
  const service = createDashboardService({
    async getSummary() {
      return [
        { scope: "global", required_count: 798, current_count: 660, expiring_count: 78, missing_count: 60, registered_count: 738 },
        { scope: "subcategory", subcategory_id: 1, name: "Licencia", required_count: 114, current_count: 110, expiring_count: 3, missing_count: 1, registered_count: 113 },
      ];
    },
  });
  const result = await service.getSummary(4);
  assert.equal(result.required, 798);
  assert.equal(result.totalRegistered, 738);
  assert.deepEqual(result.subcategories[0], { id: 1, name: "Licencia", current: 110, expiring: 3, missing: 1, registered: 113, total: 114 });
});

test("monitoreo de sucursales conserva los porcentajes del bloque legacy", async () => {
  let receivedFilters;
  const service = createDashboardService({
    async getBranchMonitoring(_countryCode, filters) {
      receivedFilters = filters;
      return [{
        branch_id: 135,
        branch_code: "FA00",
        branch_name: "Adminitrativa",
        manager_id: 0,
        manager_name: "",
        required_count: 7,
        registered_count: 7,
        expiring_count: 1,
        other_count: 37,
      }];
    },
  });

  const result = await service.getBranchMonitoring(4, { managerId: "909", branchId: "135" });
  assert.deepEqual(receivedFilters, { managerId: 909, branchId: 135 });
  assert.deepEqual(result[0], {
    id: 135,
    code: "FA00",
    name: "Adminitrativa",
    managerId: 0,
    managerName: "",
    required: 7,
    registered: 7,
    expiring: 1,
    other: 37,
    registeredPercent: 100,
    expiringPercent: 14,
  });
});

test("filtros documentales limitan pagina, texto e identificadores", () => {
  const filters = normalizeFilters({
    page: "2",
    pageSize: "500",
    documentType: "administrative",
    includeInactive: "true",
    branchId: "9",
    categoryId: "x",
    search: " contrato ",
    startDate: "2026-01-03",
    expirationEndDate: "2026-12-31",
    sortBy: "expirationDate",
    sortDirection: "descend",
  });
  assert.equal(filters.page, 2);
  assert.equal(filters.pageSize, 100);
  assert.equal(filters.documentType, "administrative");
  assert.equal(filters.includeInactive, true);
  assert.equal(filters.branchId, 9);
  assert.equal(filters.categoryId, undefined);
  assert.equal(filters.search, "contrato");
  assert.equal(filters.startDate, "2026-01-03");
  assert.equal(filters.expirationEndDate, "2026-12-31");
  assert.equal(filters.sortBy, "expirationDate");
  assert.equal(filters.sortDirection, "desc");
});

test("historico usa la tabla fisica de estados y limites enteros literales", async () => {
  const calls = [];
  const repository = createDocumentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }], []];
      return [[], []];
    },
  });

  await repository.list(4, normalizeFilters({ page: 2, pageSize: 100 }));
  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /tblEstadoDocumentacion/);
  assert.match(listCall.sql, /LIMIT 100 OFFSET 100/);
  assert.doesNotMatch(listCall.sql, /LIMIT \?/);
  assert.deepEqual(listCall.parameters, [4]);
});
