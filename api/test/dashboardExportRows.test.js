import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createDashboardRepository } from "../src/repositories/dashboardRepository.js";
import { createDashboardRouter } from "../src/routes/dashboardRoutes.js";
import { createDashboardService } from "../src/services/dashboardService.js";

const EXPECTED_COLUMN_ORDER = [
  "vigente",
  "porVencer",
  "nombreSubcategoria",
  "nombreSucursal",
  "nombreEstado",
  "codigoSucursal",
  "codigoSubcategoria",
  "estado",
  "noExiste",
];

test("exportacion del dashboard reconstruye la matriz sucursal por subcategoria del OML", async () => {
  const calls = [];
  const repository = createDashboardRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{
        vigente: 0,
        porVencer: 0,
        nombreSubcategoria: "Licencia por Regencia",
        nombreSucursal: "FA21",
        nombreEstado: "",
        codigoSucursal: 223,
        codigoSubcategoria: 3,
        estado: 0,
        noExiste: 1,
      }], []];
    },
  });

  const rows = await repository.getExportRows(4);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].parameters, [4, 4, 4]);
  assert.deepEqual(Object.keys(rows[0]), EXPECTED_COLUMN_ORDER);
  assert.match(calls[0].sql, /FROM .*tblSucursales s\s+CROSS JOIN .*tblSubcategoriaDocumentos sc/);
  assert.match(calls[0].sql, /s\.Codigo_Pais = \?/);
  assert.match(calls[0].sql, /s\.isAdministrativa = 0 OR s\.Codigo_InternoSucursal = 'FA00'/);
  assert.match(calls[0].sql, /sc\.codigoPais = \?/);
  assert.match(calls[0].sql, /sc\.isObligatorio = 1/);
  assert.match(calls[0].sql, /d\.codigoPais = \?/);
  assert.match(calls[0].sql, /d\.isActive = 1/);
  assert.match(calls[0].sql, /d\.estadoDocumento IN \(2, 4\)/);
  assert.match(calls[0].sql, /PARTITION BY d\.codigoSucursal, d\.subCategoriaDocumento/);
  assert.match(calls[0].sql, /ORDER BY d\.codigoDocumento ASC/);
  assert.match(calls[0].sql, /COALESCE\(r\.estadoDocumento, 0\) AS estado/);
  assert.match(calls[0].sql, /COALESCE\(r\.status_name, ''\) AS status_name/);
  assert.match(calls[0].sql, /CASE WHEN r\.branch_id IS NULL THEN 1 ELSE 0 END AS no_existe/);
  assert.match(calls[0].sql, /ORDER BY branch_order ASC, branch_id ASC, subcategory_id ASC/);
  assert.doesNotMatch(calls[0].sql, /COALESCE\(r\.estadoDocumento, 5\)/);
});

test("servicio conserva nombres, tipos y orden exacto de RecordListToExcel", async () => {
  const service = createDashboardService({
    async getExportRows(countryCode) {
      assert.equal(countryCode, 4);
      return [{
        vigente: "1",
        porVencer: "0",
        nombreSubcategoria: "Licencia por Regencia",
        nombreSucursal: "FA21",
        nombreEstado: "Vigente",
        codigoSucursal: "223",
        codigoSubcategoria: "3",
        estado: "2",
        noExiste: "0",
      }];
    },
  });

  const result = await service.getExportRows(4);

  assert.equal(result.count, 1);
  assert.deepEqual(Object.keys(result.rows[0]), EXPECTED_COLUMN_ORDER);
  assert.deepEqual(result.rows[0], {
    vigente: 1,
    porVencer: 0,
    nombreSubcategoria: "Licencia por Regencia",
    nombreSucursal: "FA21",
    nombreEstado: "Vigente",
    codigoSucursal: 223,
    codigoSubcategoria: 3,
    estado: 2,
    noExiste: 0,
  });
});

test("GET dashboard export-rows pasa el pais autenticado y responde filas mas total", async (context) => {
  const calls = [];
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { id: 30, countryCode: 4 };
    next();
  });
  app.use(createDashboardRouter({
    async getExportRows(countryCode) {
      calls.push(countryCode);
      return {
        rows: [{ vigente: 1, porVencer: 0 }],
        count: 1,
      };
    },
  }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/export-rows`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [4]);
  assert.equal(body.success, true);
  assert.equal(body.message, "Datos de exportacion del dashboard consultados correctamente.");
  assert.deepEqual(body.data, {
    rows: [{ vigente: 1, porVencer: 0 }],
    count: 1,
  });
});
