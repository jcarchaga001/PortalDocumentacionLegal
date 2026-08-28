import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogRepository } from "../src/repositories/catalogRepository.js";
import {
  normalizeCategoryFilters,
  normalizeEntityFilters,
  normalizeProviderFilters,
  normalizeUserFilters,
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

test("usuarios se restringen por país, activos y parámetros seguros", async () => {
  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);
  await repository.listUsers(4, normalizeUserFilters({
    page: 3,
    pageSize: 50,
    branchId: 11,
    search: "Ana",
    onlyAllowed: true,
  }));

  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /p\.CodigoPais = \?/);
  assert.match(listCall.sql, /p\.isActivo = 1/);
  assert.match(listCall.sql, /p\.isGenteCargo = 1/);
  assert.match(listCall.sql, /LIMIT 50 OFFSET 100/);
  assert.deepEqual(listCall.parameters, [4, 11, "Ana", "Ana"]);
});

test("proveedores consulta nombres físicos con porcentajes escapados", async () => {
  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);
  await repository.listProviders(4, normalizeProviderFilters({
    name: "Farmacia",
    taxNumber: "0801",
    onlyExternal: true,
    onlyActive: true,
  }));

  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /p\.\`isRet1%\`/);
  assert.match(listCall.sql, /p\.\`is12\.5%\`/);
  assert.match(listCall.sql, /COALESCE\(p\.isInterno, 0\) = 0/);
  assert.match(listCall.sql, /COALESCE\(p\.isactive, 0\) = 1/);
  assert.deepEqual(listCall.parameters, [4, "Farmacia", "0801"]);
});

test("destinos de proveedor replica GetDestino con banco, estado 5 y limite 500", async () => {
  const calls = [];
  const repository = createCatalogRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/FROM .*tblDestinos d/.test(sql)) {
        return [[{
          id: 31,
          bankName: "Banco Uno",
          accountNumber: "12345",
          isDollars: 0,
        }], []];
      }
      if (/FROM .*tblPaises/.test(sql)) return [[{ currencySymbol: "L" }], []];
      return [[], []];
    },
  });

  const result = await repository.listProviderDestinations(4, 77);

  const destinationCall = calls.find(({ sql }) => /FROM .*tblDestinos d/.test(sql));
  assert.match(destinationCall.sql, /LEFT JOIN .*tblBancos b/);
  assert.match(destinationCall.sql, /d\.Cod_Banco = b\.Cod_Banco/);
  assert.match(destinationCall.sql, /d\.CodPais = \?/);
  assert.match(destinationCall.sql, /d\.codigoProveedor = \?/);
  assert.match(destinationCall.sql, /d\.Cod_Estado = 5/);
  assert.match(destinationCall.sql, /LIMIT 500/);
  assert.deepEqual(destinationCall.parameters, [4, 77]);
  const currencyCall = calls.find(({ sql }) => /FROM .*tblPaises/.test(sql));
  assert.deepEqual(currencyCall.parameters, [4]);
  assert.deepEqual(result, {
    items: [{ id: 31, bankName: "Banco Uno", accountNumber: "12345", isDollars: 0 }],
    currencySymbol: "L",
  });
});

test("toggle de categoría modifica tblSubcategoriaDocumentos y escribe bitácora en transacción", async () => {
  const calls = [];
  const lifecycle = [];
  const connection = {
    async beginTransaction() { lifecycle.push("begin"); },
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [{ affectedRows: 1 }, []];
    },
    async commit() { lifecycle.push("commit"); },
    async rollback() { lifecycle.push("rollback"); },
    release() { lifecycle.push("release"); },
  };
  const repository = createCatalogRepository({ async getConnection() { return connection; } });
  const result = await repository.setCategoryAccess({
    countryCode: 4,
    categoryId: 8,
    actorId: 99,
    allowed: true,
    description: "Habilitó Subcategoría",
    timestamp: "2026-08-06 10:00:00",
  });

  assert.equal(result, true);
  assert.match(calls[0].sql, /UPDATE .*tblSubcategoriaDocumentos/);
  assert.doesNotMatch(calls[0].sql, /tblPersonas/);
  assert.deepEqual(calls[0].parameters, [1, 8, 4]);
  assert.match(calls[1].sql, /tblBitacoraPermisos/);
  assert.deepEqual(lifecycle, ["begin", "commit", "release"]);
});

test("filtros de categorías mantienen país y límites enteros", async () => {
  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);
  await repository.listCategories(4, normalizeCategoryFilters({
    page: 2,
    pageSize: 100,
    categoryId: 3,
    search: "Licencia",
    onlyRequired: true,
    onlyDocuments: true,
    onlyActive: true,
  }));

  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /c\.codigoPais = \?/);
  assert.match(listCall.sql, /sc\.isObligatorio = 1/);
  assert.match(listCall.sql, /sc\.isDocSucursal = 1/);
  assert.match(listCall.sql, /sc\.isActive = 1/);
  assert.match(listCall.sql, /LIMIT 100 OFFSET 100/);
  assert.deepEqual(listCall.parameters, [4, 3, "Licencia"]);
});

test("entes gubernamentales se aislan por pais en lectura y escritura", async () => {
  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);
  await repository.listEntities(4, normalizeEntityFilters({ responsibleId: 17 }));
  await repository.createEntity(4, 3, {
    name: "SAR",
    description: "Autoridad",
    regulatory: true,
    legal: false,
    responsibleId: 17,
  });
  await repository.updateEntity(4, 9, {
    name: "SAR",
    description: "Autoridad",
    regulatory: true,
    legal: false,
    responsibleId: 17,
  });
  await repository.deactivateEntity(4, 9);

  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /e\.codigoPais = \?/);
  assert.match(listCall.sql, /p\.CodigoPais = e\.codigoPais/);
  assert.deepEqual(listCall.parameters, [4, 17]);
  const createCall = calls.find(({ sql }) => /INSERT INTO .*tblEntesGubernamentales/s.test(sql));
  assert.deepEqual(createCall.parameters, ["SAR", "Autoridad", 4, 1, 0, 3]);
  const updateCall = calls.find(({ sql }) => /UPDATE .*tblEntesGubernamentales/s.test(sql) && /nombreEnte/.test(sql));
  assert.match(updateCall.sql, /codigoPais = \?/);
  assert.equal(updateCall.parameters.at(-1), 4);
  const deleteCall = calls.find(({ sql }) => /SET isActive = 0/.test(sql));
  assert.deepEqual(deleteCall.parameters, [9, 4]);
});

test("acciones legales persisten IsActivo en alta y edicion", async () => {
  const calls = [];
  const repository = createCatalogRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [{ insertId: 12, affectedRows: 1 }, []];
    },
  });

  await repository.createLegalAction(88, "2026-08-06 15:00:00", { name: "Demanda", active: false });
  await repository.updateLegalAction(12, { name: "Demanda laboral", active: true });

  assert.match(calls[0].sql, /\(NombreAccion, IsActivo, UsuarioCreado, FechaCreado\)/);
  assert.deepEqual(calls[0].parameters, ["Demanda", 0, "88", "2026-08-06 15:00:00"]);
  assert.match(calls[1].sql, /SET NombreAccion = \?, IsActivo = \?/);
  assert.deepEqual(calls[1].parameters, ["Demanda laboral", 1, 12]);
});
