import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { createDashboardRepository } from "../src/repositories/dashboardRepository.js";
import { createDashboardRouter } from "../src/routes/dashboardRoutes.js";
import {
  createDashboardService,
  normalizeDashboardDocumentFilters,
} from "../src/services/dashboardService.js";

function dashboardDocumentRepositoryRecorder(rows = [], total = 0) {
  const calls = [];
  const repository = createDashboardRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\) AS total/.test(sql)) return [[{ total }], []];
      return [rows, []];
    },
  });
  return { calls, repository };
}

test("consulta documental del dashboard conserva filtros, joins, calculo y orden inicial del OML", async () => {
  const expectedRows = [{
    id: 9123,
    branchName: "FA21 TGU - Las Minitas",
    reference: "CNT-01-000003",
    description: "Propietario",
    categoryName: "Contrato",
    subcategoryName: "Contratos por Arrendamientos de Farmacia",
    documentDate: "2026-01-01",
    expirationDate: "2026-09-10",
    expirationTime: "Menos de 1 Mes",
    statusId: 2,
    statusName: "Vigente",
  }];
  const { calls, repository } = dashboardDocumentRepositoryRecorder(expectedRows, 73);

  const result = await repository.getDocuments(4, {
    statusId: 2,
    startIndex: 0,
    maxRecords: 50,
  });

  assert.deepEqual(result, { rows: expectedRows, count: 73 });
  assert.equal(calls.length, 2);
  const listCall = calls.find(({ sql }) => /LIMIT 50 OFFSET 0/.test(sql));
  const countCall = calls.find(({ sql }) => /COUNT\(\*\) AS total/.test(sql));
  assert.deepEqual(listCall.parameters, [4, 2]);
  assert.deepEqual(countCall.parameters, [4, 2]);
  assert.match(listCall.sql, /LEFT JOIN .*tblSucursales s/);
  assert.match(listCall.sql, /LEFT JOIN .*tblCategoriaDocumentos c/);
  assert.match(listCall.sql, /LEFT JOIN .*tblSubcategoriaDocumentos sc/);
  assert.match(
    listCall.sql,
    /ON sc\.codigoSubcategoria = d\.subCategoriaDocumento\s+AND d\.categoriaDocumento = d\.categoriaDocumento/,
  );
  assert.match(listCall.sql, /LEFT JOIN .*tblEstadoDocumentacion st/);
  assert.match(listCall.sql, /d\.codigoDocumento AS id/);
  assert.match(listCall.sql, /d\.codigoPais = \?/);
  assert.match(listCall.sql, /d\.estadoDocumento = \?/);
  assert.match(listCall.sql, /d\.estadoDocumento AS statusId/);
  assert.match(listCall.sql, /d\.isActive = 1/);
  assert.match(listCall.sql, /s\.isAdministrativa = FALSE/);
  assert.match(listCall.sql, /ORDER BY s\.OrdenSucursal ASC/);
  assert.match(listCall.sql, /DATEDIFF\(d\.fechaVencimiento, CURRENT_DATE\(\)\) >= 0/);
  assert.match(listCall.sql, /DATEDIFF\(d\.fechaVencimiento, CURRENT_DATE\(\)\) > 30/);
  assert.match(listCall.sql, /DATEDIFF\(d\.fechaVencimiento, CURRENT_DATE\(\)\) > 61/);
  assert.match(listCall.sql, /ELSE ''/);
  assert.doesNotMatch(listCall.sql, /s\.Codigo_Pais = \?/);
});

test("filtros del dashboard limitan estados, pagina y campos de orden sin interpolar entrada", () => {
  assert.deepEqual(normalizeDashboardDocumentFilters({
    statusId: "4",
    startIndex: "50",
    maxRecords: "500",
    sortBy: "expirationDate",
    sortDirection: "descend",
  }), {
    statusId: 4,
    startIndex: 50,
    maxRecords: 50,
    sortBy: "expirationDate",
    sortDirection: "desc",
  });

  assert.deepEqual(normalizeDashboardDocumentFilters({
    statusId: "5",
    startIndex: "invalido",
    sortBy: "d.codigoDocumento; DROP TABLE tblDocumentos",
    sortDirection: "desc",
  }), {
    statusId: 5,
    startIndex: 0,
    maxRecords: 50,
    sortBy: undefined,
    sortDirection: undefined,
  });

  for (const statusId of [undefined, "", "1", "3", "6"]) {
    assert.throws(
      () => normalizeDashboardDocumentFilters({ statusId }),
      (error) => error.status === 400
        && error.code === "VALIDATION_ERROR"
        && error.field === "statusId",
    );
  }
});

test("repositorio conserva el orden fijo del aggregate aunque la accion cambie TableSort", async () => {
  const { calls, repository } = dashboardDocumentRepositoryRecorder();
  await repository.getDocuments(4, normalizeDashboardDocumentFilters({
    statusId: 4,
    startIndex: 100,
    maxRecords: 25,
    sortBy: "subcategoryName",
    sortDirection: "desc",
  }));

  const listCall = calls.find(({ sql }) => /LIMIT 25 OFFSET 100/.test(sql));
  assert.match(listCall.sql, /ORDER BY s\.OrdenSucursal ASC/);
  assert.doesNotMatch(listCall.sql, /ORDER BY sc\.NombreSubcategoria DESC/);
});

test("GET dashboard documents pasa pais autenticado y devuelve rows mas count", async (context) => {
  const calls = [];
  const service = {
    async getDocuments(countryCode, query) {
      calls.push({ countryCode, query: { ...query } });
      return {
        rows: [{ id: 9123, reference: "CNT-01-000003", statusId: 2 }],
        count: 1,
        startIndex: 0,
        maxRecords: 50,
      };
    },
  };
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { id: 30, countryCode: 4 };
    next();
  });
  app.use(createDashboardRouter(service));
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/documents?statusId=2&startIndex=0&maxRecords=50`,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    countryCode: 4,
    query: { statusId: "2", startIndex: "0", maxRecords: "50" },
  }]);
  assert.equal(body.success, true);
  assert.equal(body.message, "Documentos del dashboard consultados correctamente.");
  assert.deepEqual(body.data.rows, [{ id: 9123, reference: "CNT-01-000003", statusId: 2 }]);
  assert.equal(body.data.count, 1);
});

test("servicio rechaza estado ajeno al contrato antes de consultar datos", async () => {
  let repositoryCalled = false;
  const service = createDashboardService({
    async getDocuments() {
      repositoryCalled = true;
      return { rows: [], count: 0 };
    },
  });

  await assert.rejects(
    () => service.getDocuments(4, { statusId: "1" }),
    (error) => error.status === 400 && error.field === "statusId",
  );
  assert.equal(repositoryCalled, false);
});

test("GET dashboard documents normaliza un estado fuera de whitelist sin consultar repositorio", async (context) => {
  let repositoryCalled = false;
  const service = createDashboardService({
    async getDocuments() {
      repositoryCalled = true;
      return { rows: [], count: 0 };
    },
  });
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { id: 30, countryCode: 4 };
    next();
  });
  app.use(createDashboardRouter(service));
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/documents?statusId=1`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.equal(body.error.field, "statusId");
  assert.equal(repositoryCalled, false);
});
