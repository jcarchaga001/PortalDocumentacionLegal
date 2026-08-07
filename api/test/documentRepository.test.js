import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentRepository } from "../src/repositories/documentRepository.js";
import { normalizeFilters } from "../src/services/documentService.js";

function repositoryRecorder() {
  const calls = [];
  const repository = createDocumentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }], []];
      return [[], []];
    },
  });
  return { calls, repository };
}

test("historico administrativo restringe sucursales administrativas activas", async () => {
  const { calls, repository } = repositoryRecorder();
  await repository.list(4, normalizeFilters({ documentType: "administrative", pageSize: 50 }));
  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /d\.isActive = 1/);
  assert.match(listCall.sql, /s\.isAdministrativa = 1/);
  assert.match(listCall.sql, /d\.isReferencial AS isReferential/);
  assert.match(listCall.sql, /a\.codigoArchivo AS attachmentId/);
  assert.match(listCall.sql, /LIMIT 50 OFFSET 0/);
  assert.deepEqual(listCall.parameters, [4]);
});

test("proximos a vencer incluye estado, rango y documentos inactivos como el legacy", async () => {
  const { calls, repository } = repositoryRecorder();
  await repository.list(4, normalizeFilters({
    documentType: "all",
    includeInactive: "true",
    statusId: "4",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    expirationStartDate: "2026-02-01",
    expirationEndDate: "2026-03-31",
  }));
  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.doesNotMatch(listCall.sql, /d\.isActive = 1/);
  assert.doesNotMatch(listCall.sql, /s\.isAdministrativa = [01]/);
  assert.match(listCall.sql, /d\.estadoDocumento = \?/);
  assert.match(listCall.sql, /d\.fechaContrato >= \?/);
  assert.match(listCall.sql, /d\.fechaVencimiento <= \?/);
  assert.match(listCall.sql, /Menos de 1 Mes/);
  assert.deepEqual(listCall.parameters, [4, 4, "2026-01-01", "2026-12-31", "2026-02-01", "2026-03-31"]);
});

test("orden documental solo usa campos normalizados", async () => {
  const { calls, repository } = repositoryRecorder();
  await repository.list(4, normalizeFilters({ sortBy: "expirationDate", sortDirection: "ascend" }));
  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.match(listCall.sql, /ORDER BY d\.fechaVencimiento ASC/);
  assert.doesNotMatch(listCall.sql, /d\.codigoDocumento DESC/);

  const unsafe = normalizeFilters({ sortBy: "d.codigoDocumento; DROP TABLE x", sortDirection: "desc" });
  assert.equal(unsafe.sortBy, undefined);
});

test("historicos conservan pagina y orden natural del aggregate legacy", async () => {
  const { calls, repository } = repositoryRecorder();
  const filters = normalizeFilters({});
  await repository.list(4, filters);
  const listCall = calls.find(({ sql }) => /LIMIT/.test(sql));
  assert.equal(filters.pageSize, 50);
  assert.match(listCall.sql, /ORDER BY s\.OrdenSucursal ASC\s+LIMIT 50 OFFSET 0/);
  assert.doesNotMatch(listCall.sql, /d\.codigoDocumento DESC/);
});

test("catalogos cambian la lista principal segun documentType", async () => {
  const calls = [];
  const repository = createDocumentRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[], []];
    },
  });
  await repository.getCatalogs(4, "administrative");
  assert.match(calls[0].sql, /isAdministrativa = 1/);
  assert.deepEqual(calls[0].parameters, [4]);
  const statusCall = calls.find(({ sql }) => /tblEstadoDocumentacion/.test(sql));
  assert.match(statusCall.sql, /codigoPais = \?/);
  assert.deepEqual(statusCall.parameters, [4]);
});

test("registro documental usa transaccion, referencia correlativa y vincula el archivo", async () => {
  const calls = [];
  const state = { began: false, committed: false, rolledBack: false, released: false };
  const connection = {
    async beginTransaction() { state.began = true; },
    async commit() { state.committed = true; },
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/FROM .*tblSucursales/.test(sql)) return [[{ id: 10 }], []];
      if (/SELECT c\.abreviaturaRef/.test(sql)) return [[{ categoryCode: "CNT", segment: "01" }], []];
      if (/MAX\(CAST\(RIGHT/.test(sql)) return [[{ lastNumber: 9 }], []];
      if (/UPDATE .*tblDocumentos/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/INSERT INTO .*tblArchivosDocumentos/.test(sql)) return [{ insertId: 55 }, []];
      if (/INSERT INTO .*tblDocumentos/.test(sql)) return [{ insertId: 66 }, []];
      throw new Error(`SQL no esperada: ${sql}`);
    },
  };
  const repository = createDocumentRepository({
    async getConnection() { return connection; },
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{
        id: 66,
        reference: "CNT-01-000010",
        isReferential: 0,
        isActive: 1,
        isActivePrincipal: 1,
        hasAttachment: 1,
        attachmentId: 55,
        attachmentFileName: "doc.pdf",
        attachmentExtension: "pdf",
        attachmentS3Key: "abcdefgh.pdf",
      }], []];
    },
  });

  const result = await repository.create(4, 99, {
    branchId: 10,
    documentType: 1,
    description: "Contrato",
    categoryId: 2,
    subcategoryId: 5,
    level: 1,
    isReferential: false,
    documentDate: "2026-08-01",
    expirationDate: "2027-08-01",
    secondaryReference: "",
    isActivePrincipal: true,
  }, {
    fileName: "doc.pdf",
    extension: "pdf",
    buffer: Buffer.from("pdf"),
    s3Key: "abcdefgh.pdf",
  });

  assert.equal(result.id, 66);
  assert.deepEqual(state, { began: true, committed: true, rolledBack: false, released: true });
  const insert = calls.find(({ sql }) => /INSERT INTO .*tblDocumentos/.test(sql));
  assert.equal(insert.parameters[0], "CNT-01-000010");
  assert.equal(insert.parameters[11], 55);
});
