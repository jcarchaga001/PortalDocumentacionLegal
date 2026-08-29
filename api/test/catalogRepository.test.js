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
  assert.match(listCall.sql, /ORDER BY p\.Nombre_Personas ASC/);
  assert.match(listCall.sql, /LIMIT 50 OFFSET 100/);
  assert.deepEqual(listCall.parameters, [4, 11, "Ana"]);
});

test("lookups de permisos conservan GetSucursales/GetPuestos y sus MaxRecords", async () => {
  const calls = [];
  const repository = createCatalogRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/tblSucursales/.test(sql)) return [[{ id: 11, name: "FA21 - Las Minitas" }], []];
      return [[{ id: 7, name: "Administrador Regional" }], []];
    },
  });

  const result = await repository.getUserPermissionLookups(4);

  const branches = calls.find(({ sql }) => /tblSucursales/.test(sql));
  const positions = calls.find(({ sql }) => /tblPuestos/.test(sql));
  assert.match(branches.sql, /Codigo_Pais = \?/);
  assert.doesNotMatch(branches.sql, /isActivo/);
  assert.match(branches.sql, /LIMIT 500/);
  assert.deepEqual(branches.parameters, [4]);
  assert.match(positions.sql, /LIMIT 1000/);
  assert.equal(positions.parameters, undefined);
  assert.deepEqual(result, {
    branches: [{ id: 11, name: "FA21 - Las Minitas" }],
    positions: [{ id: 7, name: "Administrador Regional" }],
  });
});

test("lookups de scrCategoriasDocumentos conservan sucursales aunque el label diga categoría", async () => {
  const calls = [];
  const repository = createCatalogRepository({
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters });
      return [[], []];
    },
  });

  await repository.getDocumentCategoryLookups(4);

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /FROM .*tblSucursales/);
  assert.match(calls[0].sql, /WHERE Codigo_Pais = \?/);
  assert.match(calls[0].sql, /LIMIT 500/);
  assert.doesNotMatch(calls[0].sql, /ORDER BY/);
  assert.deepEqual(calls[0].parameters, [4]);
  assert.match(calls[1].sql, /FROM .*tblPuestos/);
  assert.match(calls[1].sql, /LIMIT 1000/);
});

test("permiso de usuario actualiza tblPersonas y audita tblBitacoraPermisos en transacción", async () => {
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

  const result = await repository.setUserAccess({
    countryCode: 4,
    userId: 17,
    actorId: 99,
    allowed: false,
    description: "Deshabilitó acceso",
    timestamp: "2026-08-28 10:00:00",
  });

  assert.equal(result, true);
  assert.match(calls[0].sql, /UPDATE .*tblPersonas/s);
  assert.deepEqual(calls[0].parameters, [0, 17, 4]);
  assert.match(calls[1].sql, /INSERT INTO .*tblBitacoraPermisos/s);
  assert.deepEqual(calls[1].parameters, [17, 99, "Deshabilitó acceso", 4, "2026-08-28 10:00:00"]);
  assert.deepEqual(lifecycle, ["begin", "commit", "release"]);
});

test("proveedores replica filtros booleanos, MaxRecords y ausencia de sort inicial del aggregate", async () => {
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
  assert.match(listCall.sql, /p\.isInterno = 0/);
  assert.doesNotMatch(listCall.sql, /p\.isactive = 1/);
  assert.doesNotMatch(listCall.sql, /ORDER BY/);
  assert.match(listCall.sql, /LIMIT 500 OFFSET 0/);
  assert.deepEqual(listCall.parameters, [4, "Farmacia", "0801"]);
});

test("desmarcar Solo Activas conserva la condición legacy que devuelve inactivas", async () => {
  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);
  await repository.listProviders(4, normalizeProviderFilters({ onlyActive: false }));

  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /p\.isactive = 0/);
});

test("GetSucursal de proveedores limita a 50 sucursales activas del país", async () => {
  const calls = [];
  const repository = createCatalogRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{ id: 7, name: "FA07 - La Kennedy" }], []];
    },
  });

  const result = await repository.listProviderBranches(4);
  assert.match(calls[0].sql, /Codigo_Pais = \? AND isActivo = 1/);
  assert.match(calls[0].sql, /LIMIT 50/);
  assert.deepEqual(calls[0].parameters, [4]);
  assert.deepEqual(result, [{ id: 7, name: "FA07 - La Kennedy" }]);
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

test("toggle de categoría conserva el defecto OML: modifica tblPersonas por id de subcategoría", async () => {
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
  assert.match(calls[0].sql, /UPDATE .*tblPersonas/s);
  assert.doesNotMatch(calls[0].sql, /tblSubcategoriaDocumentos/);
  assert.doesNotMatch(calls[0].sql, /CodigoPais/);
  assert.deepEqual(calls[0].parameters, [1, 8]);
  assert.match(calls[1].sql, /tblBitacoraPermisos/);
  assert.deepEqual(calls[1].parameters, [8, 99, "Habilitó Subcategoría", 4, "2026-08-06 10:00:00"]);
  assert.deepEqual(lifecycle, ["begin", "commit", "release"]);
});

test("GetPersonas de categorías ignora filtros visibles, no ordena y usa MaxRecords 500", async () => {
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
  assert.match(listCall.sql, /ON sc\.codigoCategoria = c\.codigoCategoria/);
  assert.doesNotMatch(listCall.sql, /sc\.codigoPais/);
  assert.doesNotMatch(listCall.sql, /sc\.isObligatorio = 1/);
  assert.doesNotMatch(listCall.sql, /sc\.isDocSucursal = 1/);
  assert.doesNotMatch(listCall.sql, /sc\.isActive = 1/);
  assert.doesNotMatch(listCall.sql, /ORDER BY/);
  assert.match(listCall.sql, /LIMIT 500 OFFSET 500/);
  assert.deepEqual(listCall.parameters, [4]);
});

test("entes replican joins, límites y ausencia de ámbito país del Aggregate legacy", async () => {
  const { calls, pool } = pagedPoolRecorder();
  const repository = createCatalogRepository(pool);
  await repository.getGovernmentEntityLookups();
  await repository.listEntities(normalizeEntityFilters({ responsibleId: 17 }));
  await repository.createEntity(4, 3, {
    name: "SAR",
    description: "Autoridad",
    regulatory: true,
    legal: false,
    responsibleId: 17,
  });
  await repository.updateEntity(9, {
    name: "SAR",
    description: "Autoridad",
    regulatory: true,
    legal: false,
    responsibleId: 17,
  });
  await repository.deactivateEntity(9);

  const listCall = calls.find(({ sql }) => /SELECT e\.codigoEnte AS id/.test(sql) && /LIMIT 50 OFFSET 0/.test(sql));
  assert.doesNotMatch(listCall.sql, /codigoPais/);
  assert.match(listCall.sql, /ON e\.codigoResponsable = p\.Codigo_Personas/);
  assert.doesNotMatch(listCall.sql, /ORDER BY/);
  assert.deepEqual(listCall.parameters, [17]);
  const masterCount = calls.find(({ sql }) => /COUNT\(\*\)/.test(sql) && /tblEntesGubernamentales/.test(sql));
  assert.doesNotMatch(masterCount.sql, /WHERE/);
  const responsibleLookup = calls.find(({ sql }) => /SELECT p\.Codigo_Personas AS id/.test(sql));
  assert.match(responsibleLookup.sql, /LEFT JOIN/);
  assert.doesNotMatch(responsibleLookup.sql, /DISTINCT|ORDER BY|isActivo|codigoPais/);
  const createCall = calls.find(({ sql }) => /INSERT INTO .*tblEntesGubernamentales/s.test(sql));
  assert.deepEqual(createCall.parameters, ["SAR", "Autoridad", 4, 1, 0, 3]);
  const updateCall = calls.find(({ sql }) => /UPDATE .*tblEntesGubernamentales/s.test(sql) && /nombreEnte/.test(sql));
  assert.doesNotMatch(updateCall.sql, /codigoPais|isActive/);
  assert.equal(updateCall.parameters.at(-1), 9);
  const deleteCall = calls.find(({ sql }) => /SET isActive = 0/.test(sql));
  assert.deepEqual(deleteCall.parameters, [9]);
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
