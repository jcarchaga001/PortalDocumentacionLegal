import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentRepository } from "../src/repositories/documentRepository.js";
import { createDocumentService, normalizeFilters } from "../src/services/documentService.js";

test("normalizacion fija el contrato de scrProximosVencer sin aceptar superficies inventadas", () => {
  assert.deepEqual(normalizeFilters({
    surface: "expiring",
    documentType: "branch",
    includeInactive: false,
    statusId: 99,
    page: 2,
    pageSize: 50,
    sortBy: "providerCode",
    sortDirection: "descend",
    startDate: "2020-01-01",
    endDate: "2026-08-28",
  }), {
    page: 2,
    pageSize: 50,
    surface: "expiring",
    documentType: "all",
    includeInactive: true,
    branchId: undefined,
    categoryId: undefined,
    subcategoryId: undefined,
    statusId: 4,
    startDate: "2020-01-01",
    endDate: "2026-08-28",
    expirationStartDate: undefined,
    expirationEndDate: undefined,
    search: "",
    sortBy: "providerCode",
    sortDirection: "desc",
  });
  assert.equal(normalizeFilters({ surface: "otro" }).surface, undefined);
});

test("Aggregate expiring conserva LEFT JOIN, fecha neutralizada, estado y orden fijo del OML", async () => {
  const calls = [];
  const repository = createDocumentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return /SELECT COUNT\(\*\)/.test(sql) ? [[{ total: 0 }], []] : [[], []];
    },
  });

  await repository.list(4, normalizeFilters({
    surface: "expiring",
    page: 2,
    pageSize: 50,
    branchId: 77,
    categoryId: 2,
    subcategoryId: 8,
    startDate: "2020-01-01",
    endDate: "2026-08-28",
    search: "REF-42",
    sortBy: "providerCode",
    sortDirection: "descend",
  }));

  const select = calls.find(({ sql }) => !/SELECT COUNT\(\*\)/.test(sql));
  const count = calls.find(({ sql }) => /SELECT COUNT\(\*\)/.test(sql));
  assert.match(select.sql, /LEFT JOIN [^\s]+\.tblSucursales s ON s\.Codigo_Sucursal = d\.codigoSucursal/);
  assert.match(select.sql, /sc\.codigoSubcategoria = d\.subCategoriaDocumento\s+AND d\.categoriaDocumento = d\.categoriaDocumento/);
  assert.match(select.sql, /\(\(DATE\(d\.fechaContrato\) >= \? AND DATE\(d\.fechaContrato\) <= \?\) OR d\.codigoSucursal <> 0\)/);
  assert.match(select.sql, /d\.estadoDocumento = 4/);
  assert.doesNotMatch(select.sql, /d\.isActive = 1/);
  assert.match(select.sql, /d\.codigoArchivo AS attachmentId/);
  assert.match(select.sql, /ORDER BY s\.OrdenSucursal ASC/);
  assert.doesNotMatch(select.sql, /ORDER BY d\.codigoProveedor DESC/);
  assert.match(select.sql, /LIMIT 50 OFFSET 50/);
  assert.match(select.sql, /DATEDIFF\(d\.fechaVencimiento, CURRENT_DATE\(\)\) > 61/);
  assert.deepEqual(select.parameters, [4, 77, "2020-01-01", "2026-08-28", 2, 8, "REF-42", "REF-42"]);
  assert.deepEqual(count.parameters, select.parameters);
});

test("catalogos expiring usan solo las tres consultas, limites y orden del runtime", async () => {
  const calls = [];
  const repository = createDocumentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[], []];
    },
  });
  const service = createDocumentService(repository);

  assert.deepEqual(await service.catalogs(4, { surface: "expiring" }), {
    branches: [],
    categories: [],
    subcategories: [],
  });
  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /CONCAT\(Codigo_InternoSucursal, ' -', Nombre_Sucursal\)/);
  assert.match(calls[0].sql, /isActivo = 1\s+ORDER BY OrdenSucursal\s+LIMIT 500/);
  assert.match(calls[1].sql, /tblCategoriaDocumentos/);
  assert.match(calls[1].sql, /LIMIT 50/);
  assert.doesNotMatch(calls[1].sql, /ORDER BY/);
  assert.match(calls[2].sql, /tblSubcategoriaDocumentos/);
  assert.match(calls[2].sql, /LIMIT 50/);
  assert.doesNotMatch(calls[2].sql, /ORDER BY/);
  assert.ok(calls.every(({ parameters }) => parameters.length === 1 && parameters[0] === 4));
});
