import assert from "node:assert/strict";
import test from "node:test";
import { createAgreementRepository } from "../src/repositories/agreementRepository.js";
import {
  createAgreementService,
  normalizeAgreementFilters,
  normalizeAgreementPayload,
} from "../src/services/agreementService.js";

test("convenios conserva el orden y el filtro de indefinidos observado en el OML", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
      if (sql.includes("vstEmpleadosMesEnCurso")) {
        return [[
          {
            id: "1379",
            name: "Gestor legacy",
            position: "Gestor",
            area: "FM101 BODEGA",
            branchId: 773,
            isCentralized: 0,
          },
          {
            id: "1379",
            name: "Duplicado de otro pais",
            position: "Gestor",
            area: "FA01",
            branchId: 292,
            isCentralized: 0,
          },
        ]];
      }
      return [[{
        id: 26,
        clientId: 2,
        clientName: "ASECOR",
        accountManagerCode: "1379",
        creditLimit: 25_000,
        isDollar: 0,
        creditDays: 30,
        hasPromissoryNote: 0,
        isPromissoryNoteExpired: 0,
        isIndefinite: 0,
        isPromissoryNoteIndefinite: 0,
        expirationStatus: "Vencido",
      }]];
    },
  };
  const repository = createAgreementRepository(pool);

  const result = await repository.list(4, {
    page: 1,
    pageSize: 20,
    indefinite: true,
  });

  const listSql = calls.find(({ sql }) => sql.includes("GROUP BY a.CodConvenio"))?.sql || "";
  const managerSql = calls.find(({ sql }) => sql.includes("vstEmpleadosMesEnCurso"))?.sql || "";
  assert.match(listSql, /DATEDIFF\(a\.FechaFinal, CURDATE\(\)\) < 30 OR a\.isIndefinido = 1/);
  assert.match(listSql, /a\.CodConvenio ASC/);
  assert.match(managerSql, /Codigo_InternoSucursal LIKE '%Call Center%'/);
  assert.equal(result.items[0].accountManagerArea, "FM101 BODEGA");
  assert.equal(result.items[0].accountManagerName, "Gestor legacy");
  assert.equal(result.items[0].isCentralized, false);
});

test("normalizacion de convenios limita filtros y valida fechas y pagare", () => {
  assert.equal(normalizeAgreementFilters({}).pageSize, 50);
  assert.deepEqual(
    normalizeAgreementFilters({ page: "2", pageSize: "999", indefinite: "true" }),
    {
      page: 2,
      pageSize: 100,
      clientId: undefined,
      startDate: undefined,
      endDate: undefined,
      indefinite: true,
      search: "",
    },
  );

  assert.throws(
    () => normalizeAgreementPayload({
      clientId: 1,
      startDate: "2026-08-06",
      endDate: "2026-08-05",
      creditDays: 30,
      creditLimit: 100,
      hasPromissoryNote: false,
      branchIds: [1],
      accountManagerCode: "1379",
    }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "endDate",
  );

  const normalized = normalizeAgreementPayload({
    clientId: 1,
    startDate: "2026-08-06",
    endDate: "2026-08-07",
    creditDays: 30,
    creditLimit: 100,
    hasPromissoryNote: false,
    branchIds: [1],
    accountManagerCode: "1379",
    removedAttachmentIds: ["9", 9, 0, "invalido", 12],
  });
  assert.deepEqual(normalized.removedAttachmentIds, [9, 12]);
  assert.deepEqual(normalized.attachments, []);
});

test("convenio con pagare exige adjunto antes de llamar al repositorio", async () => {
  let writes = 0;
  const service = createAgreementService({
    async create() {
      writes += 1;
    },
  });

  await assert.rejects(
    async () => service.create(4, 88, {
      clientId: 7,
      accountManagerCode: "1001",
      branchIds: [77],
      startDate: "2026-08-01",
      endDate: "2027-08-01",
      creditDays: 30,
      creditLimit: 50_000,
      hasPromissoryNote: true,
      isPromissoryNoteExpired: true,
      promissoryNoteExpirationDate: "2027-08-01",
    }),
    (error) => error.field === "attachments"
      && error.message === "Afirmo que el cliente tiene pagare, porfavor agregar el archivo.",
  );
  assert.equal(writes, 0);
});

test("creacion de convenio inserta adjuntos antes del commit en la misma transaccion", async () => {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push({ operation: "begin" }); },
    async commit() { calls.push({ operation: "commit" }); },
    async rollback() { calls.push({ operation: "rollback" }); },
    release() { calls.push({ operation: "release" }); },
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("SELECT Nombre_Cliente AS name")) return [[{ name: "Cliente" }]];
      if (sql.includes("INSERT INTO") && sql.includes("tblConvenios\n")) return [{ insertId: 14 }];
      if (sql.includes("FROM") && sql.includes("tblSucursales") && sql.includes("Codigo_Sucursal IN")) {
        return [[{ id: 77 }]];
      }
      if (sql.includes("UPDATE") && sql.includes("tblConveniosXSucursal SET isActivo = 0")) {
        return [{ affectedRows: 0 }];
      }
      if (sql.includes("SELECT CodConvenioSucursal AS id")) return [[]];
      if (sql.includes("INSERT INTO") && sql.includes("tblConveniosXSucursal")) return [{ insertId: 901 }];
      if (sql.includes("INSERT INTO") && sql.includes("tblAdjuntosXConvenio")) return [{ insertId: 22 }];
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const repository = createAgreementRepository({ async getConnection() { return connection; } });
  repository.getById = async () => ({ id: 14 });

  await repository.create(4, 88, {
    clientId: 7,
    accountManagerCode: "1001",
    branchIds: [77],
    startDate: "2026-08-01",
    endDate: "2027-08-01",
    creditDays: 30,
    creditLimit: 50_000,
    hasPromissoryNote: true,
    isPromissoryNoteExpired: true,
    promissoryNoteExpirationDate: "2027-08-01",
    isIndefinite: false,
    isPromissoryNoteIndefinite: false,
    isDollar: false,
    observation: "",
    attachments: [{ s3Key: "pagare.pdf", fileName: "Pagare.pdf", extension: "pdf" }],
  });

  const attachmentIndex = calls.findIndex(({ sql }) => sql?.includes("tblAdjuntosXConvenio"));
  const commitIndex = calls.findIndex(({ operation }) => operation === "commit");
  assert.ok(attachmentIndex > -1 && attachmentIndex < commitIndex);
  assert.equal(calls.filter(({ operation }) => operation === "rollback").length, 0);
});

test("actualizacion con pagare revierte antes de escribir si elimina el ultimo adjunto", async () => {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push({ operation: "begin" }); },
    async commit() { calls.push({ operation: "commit" }); },
    async rollback() { calls.push({ operation: "rollback" }); },
    release() { calls.push({ operation: "release" }); },
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("SELECT Nombre_Cliente AS name")) return [[{ name: "Cliente" }]];
      if (sql.includes("activeAttachmentCount")) return [[{ id: 14, activeAttachmentCount: 0 }]];
      throw new Error(`No debe escribir: ${sql}`);
    },
  };
  const repository = createAgreementRepository({ async getConnection() { return connection; } });

  await assert.rejects(
    repository.update(4, 88, 14, {
      clientId: 7,
      accountManagerCode: "1001",
      branchIds: [77],
      startDate: "2026-08-01",
      endDate: "2027-08-01",
      creditDays: 30,
      creditLimit: 50_000,
      hasPromissoryNote: true,
      isPromissoryNoteExpired: false,
      promissoryNoteExpirationDate: "2027-08-01",
      isIndefinite: false,
      isPromissoryNoteIndefinite: false,
      isDollar: false,
      observation: "",
      removedAttachmentIds: [11],
      attachments: [],
    }),
    (error) => error.field === "attachments",
  );
  assert.equal(calls.filter(({ operation }) => operation === "rollback").length, 1);
  assert.equal(calls.filter(({ operation }) => operation === "commit").length, 0);
  assert.equal(calls.some(({ sql }) => /^\s*UPDATE[\s\S]*tblConvenios a/.test(sql || "")), false);
});

test("endpoint de borrado no permite eliminar el ultimo adjunto de un pagare", async () => {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push({ operation: "begin" }); },
    async commit() { calls.push({ operation: "commit" }); },
    async rollback() { calls.push({ operation: "rollback" }); },
    release() { calls.push({ operation: "release" }); },
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("agreement.HasPagare")) return [[{ id: 14, hasPromissoryNote: 1 }]];
      if (sql.includes("SELECT CodAdjunto AS id")) return [[{ id: 22 }]];
      if (sql.includes("COUNT(*) AS activeAttachmentCount")) {
        return [[{ activeAttachmentCount: 1 }]];
      }
      throw new Error(`No debe eliminar: ${sql}`);
    },
  };
  const repository = createAgreementRepository({ async getConnection() { return connection; } });

  await assert.rejects(
    repository.removeAttachment(4, 88, 14, 22),
    (error) => error.field === "attachments"
      && error.message === "Afirmo que el cliente tiene pagare, porfavor agregar el archivo.",
  );
  assert.equal(calls.filter(({ operation }) => operation === "rollback").length, 1);
  assert.equal(calls.filter(({ operation }) => operation === "commit").length, 0);
  assert.equal(calls.some(({ sql }) => /^\s*UPDATE/.test(sql || "")), false);
});

test("detalle de convenio incluye horas, autores y metadatos completos de adjuntos", async () => {
  const calls = [];
  const pool = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("WHERE a.CodConvenio = ?")) {
        return [[{
          id: 14,
          clientId: 7,
          clientName: "AC Talentos",
          accountManagerCode: "1001",
          creditLimit: 50_000,
          isDollar: 0,
          creditDays: 30,
          hasPromissoryNote: 0,
          isPromissoryNoteExpired: 0,
          isIndefinite: 0,
          isPromissoryNoteIndefinite: 0,
          createdDate: "2025-05-20",
          createdTime: "14:48:22",
          createdById: 88,
          createdByName: "Gabriela Xiomara Matamoros Osorio",
          updatedDate: null,
          updatedTime: null,
          updatedById: null,
          updatedByName: null,
          branchIds: "56",
          branchNames: "FA56 - SPS-Col Tara",
        }]];
      }
      if (sql.includes("vstEmpleadosMesEnCurso")) {
        return [[{
          id: "1001",
          name: "Ana Elsy Hernandez Fuentes",
          position: "Gerente de Farmacia",
          area: "FA56",
          branchId: 56,
          isCentralized: 0,
        }]];
      }
      if (sql.includes("tblAdjuntosXConvenio")) {
        return [[{
          id: 5,
          s3Key: "archivo.pdf",
          fileName: "AC Talentos.pdf",
          extension: ".pdf",
          createdDate: "2025-05-20",
          createdTime: "14:48:22",
        }]];
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const repository = createAgreementRepository(pool);

  const result = await repository.getById(4, 14);

  const detailSql = calls.find(({ sql }) => sql.includes("WHERE a.CodConvenio = ?"))?.sql || "";
  const attachmentSql = calls.find(({ sql }) => sql.includes("tblAdjuntosXConvenio"))?.sql || "";
  assert.match(detailSql, /tblPersonas creator/);
  assert.match(detailSql, /tblPersonas updater/);
  assert.match(detailSql, /TIME_FORMAT\(a\.HoraCreacion/);
  assert.match(detailSql, /CONCAT\(b\.Codigo_InternoSucursal, ' - ', b\.Nombre_Sucursal\)/);
  assert.match(attachmentSql, /TIME_FORMAT\(HoraCreacion/);
  assert.equal(result.createdByName, "Gabriela Xiomara Matamoros Osorio");
  assert.equal(result.createdTime, "14:48:22");
  assert.deepEqual(result.branchNames, ["FA56 - SPS-Col Tara"]);
  assert.equal(result.attachments[0].createdTime, "14:48:22");
});

test("edicion de convenio elimina los adjuntos seleccionados dentro de la misma transaccion", async () => {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push({ operation: "begin" }); },
    async commit() { calls.push({ operation: "commit" }); },
    async rollback() { calls.push({ operation: "rollback" }); },
    release() { calls.push({ operation: "release" }); },
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes("SELECT Nombre_Cliente AS name")) return [[{ name: "Cliente" }]];
      if (sql.includes("UPDATE") && sql.includes("tblConvenios a")) return [{ affectedRows: 1 }];
      if (sql.includes("FROM") && sql.includes("tblSucursales") && sql.includes("Codigo_Sucursal IN")) {
        return [[{ id: 77 }]];
      }
      if (sql.includes("UPDATE") && sql.includes("tblConveniosXSucursal SET isActivo = 0")) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("SELECT CodConvenioSucursal AS id")) return [[{ id: 901 }]];
      if (sql.includes("UPDATE") && sql.includes("tblConveniosXSucursal SET isActivo = 1")) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("tblAdjuntosXConvenio attachment")) return [{ affectedRows: 2 }];
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const repository = createAgreementRepository({
    async getConnection() { return connection; },
  });
  repository.getById = async () => ({ id: 14 });

  const result = await repository.update(4, 88, 14, {
    clientId: 7,
    accountManagerCode: "1001",
    branchIds: [77],
    startDate: "2026-08-01",
    endDate: "2027-08-01",
    creditDays: 30,
    creditLimit: 50_000,
    hasPromissoryNote: false,
    isPromissoryNoteExpired: false,
    promissoryNoteExpirationDate: undefined,
    isIndefinite: false,
    isPromissoryNoteIndefinite: false,
    isDollar: false,
    observation: "",
    removedAttachmentIds: [11, 12],
  });

  const attachmentCall = calls.find(({ sql }) => sql?.includes("tblAdjuntosXConvenio attachment"));
  assert.deepEqual(attachmentCall.parameters, [88, 14, 4, 11, 12]);
  assert.match(attachmentCall.sql, /attachment\.CodAdjunto IN \(\?,\?\)/);
  assert.equal(calls.filter(({ operation }) => operation === "commit").length, 1);
  assert.equal(calls.filter(({ operation }) => operation === "rollback").length, 0);
  assert.deepEqual(result, { id: 14 });
});
