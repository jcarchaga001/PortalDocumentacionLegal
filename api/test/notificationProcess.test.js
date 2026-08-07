import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationRepository } from "../src/repositories/notificationRepository.js";
import { createNotificationService } from "../src/services/notificationService.js";

function candidate(overrides = {}) {
  return {
    id: 10,
    kind: "warning",
    documentCode: "DOC-10",
    documentReference: "CT-10",
    dueDate: "2026-08-20",
    documentType: 1,
    countryCode: 4,
    branchId: 312,
    statusId: 2,
    category: "Licencias",
    subcategory: "Permiso sanitario",
    branchName: "Sucursal Centro",
    branchLabel: "FA01 - Sucursal Centro",
    branchEmail: "sucursal@example.com",
    ...overrides,
  };
}

test("el repositorio consulta los dos estados de vencimiento y reclama con actualización condicional", async () => {
  const calls = [];
  const repository = createNotificationRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/^\s*SELECT d\.codigoDocumento/.test(sql)) return [[], []];
      return [{ affectedRows: 1 }, []];
    },
  });

  await repository.listDocumentExpirationCandidates({
    asOf: "2026-08-06",
    warningCutoff: "2026-11-06",
  });
  await repository.claimDocumentExpiration(candidate(), "2026-08-06");

  assert.match(calls[0].sql, /fechaVencimiento < \?/);
  assert.match(calls[0].sql, /fechaVencimiento >= \?/);
  assert.match(calls[0].sql, /estadoDocumento IN \(2, 4\)/);
  assert.deepEqual(calls[0].parameters, ["2026-08-06", "2026-08-06", "2026-11-06"]);
  assert.match(calls[1].sql, /SET estadoDocumento = 4/);
  assert.match(calls[1].sql, /estadoDocumento = 2/);
});

test("el reenvío manual obtiene el documento dentro del país autenticado", async () => {
  const calls = [];
  const repository = createNotificationRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [[{
        id: 42,
        branchId: 9,
        countryCode: 4,
        documentType: 1,
        documentName: "Permiso sanitario",
      }], []];
    },
  });

  const result = await repository.findDocumentExpiration(42, 4);

  assert.equal(result.id, 42);
  assert.equal(result.countryCode, 4);
  assert.match(calls[0].sql, /d\.codigoDocumento = \? AND d\.codigoPais = \?/);
  assert.deepEqual(calls[0].parameters, [42, 4]);
});

test("SendemPorVencer manual usa datos persistidos y el destinatario legal fijo", async () => {
  let lookup;
  let mailPayload;
  const service = createNotificationService({
    repository: {
      async findDocumentExpiration(documentId, countryCode) {
        lookup = { documentId, countryCode };
        return {
          id: documentId,
          countryCode,
          branchName: "Sucursal Centro",
          documentName: "Permiso sanitario",
          contractNumber: "CON-70",
          dueDate: "2026-09-20",
          transactionType: "Por Vencer",
          documentReference: "DOC-70",
          documentType: 1,
        };
      },
    },
    async mailSender(payload) {
      mailPayload = payload;
      return { success: true };
    },
    allowLiveExecution: true,
  });

  const result = await service.sendDocumentExpiration({
    countryCode: 4,
    documentId: 70,
    to: "destino-alterado@example.com",
    dryRun: false,
  });

  assert.deepEqual(lookup, { documentId: 70, countryCode: 4 });
  assert.deepEqual(mailPayload.to, ["legal.hn@farmavalue.com"]);
  assert.match(mailPayload.text, /Permiso sanitario - DOC-70/);
  assert.match(mailPayload.text, /CON-70/);
  assert.match(mailPayload.text, /Sucursal Centro/);
  assert.match(mailPayload.text, /20\/09\/2026/);
  assert.equal(result.sent, true);
});

test("SendemPorVencer manual no envía si el documento no pertenece al país", async () => {
  let mails = 0;
  const service = createNotificationService({
    repository: {
      async findDocumentExpiration() { return null; },
    },
    async mailSender() { mails += 1; return { success: true }; },
    allowLiveExecution: true,
  });

  await assert.rejects(
    () => service.sendDocumentExpiration({ countryCode: 4, documentId: 70, dryRun: false }),
    (error) => error.code === "DOCUMENT_NOT_FOUND" && error.status === 404,
  );
  assert.equal(mails, 0);
});

test("dry-run informa candidatos sin reclamar registros ni enviar correos", async () => {
  let claims = 0;
  let mails = 0;
  const service = createNotificationService({
    repository: {
      async listDocumentExpirationCandidates() {
        return [candidate(), candidate({ id: 11, kind: "expired", dueDate: "2026-08-01", statusId: 4 })];
      },
      async claimDocumentExpiration() { claims += 1; return true; },
    },
    async mailSender() { mails += 1; return { success: true }; },
    clock: () => new Date(2026, 7, 6, 8),
  });

  const result = await service.runDocumentExpirationProcess();
  assert.deepEqual(
    { dryRun: result.dryRun, candidates: result.candidates, warning: result.warning, expired: result.expired },
    { dryRun: true, candidates: 2, warning: 1, expired: 1 },
  );
  assert.equal(claims, 0);
  assert.equal(mails, 0);
});

test("AddMonths replica el cierre de mes sin desbordar al mes siguiente", async () => {
  let received;
  const service = createNotificationService({
    repository: {
      async listDocumentExpirationCandidates(options) { received = options; return []; },
    },
  });

  await service.runDocumentExpirationProcess({ asOf: "2026-08-31" });
  assert.equal(received.warningCutoff, "2026-11-30");
});

test("rechaza fechas de corte inexistentes", async () => {
  const service = createNotificationService({ repository: {} });
  await assert.rejects(
    () => service.runDocumentExpirationProcess({ asOf: "2026-02-30" }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "asOf",
  );
});

test("el proceso real es idempotente al conservar los estados reclamados", async () => {
  const pending = new Map([
    [10, candidate()],
    [11, candidate({ id: 11, kind: "expired", dueDate: "2026-08-01", statusId: 4 })],
  ]);
  const mailPayloads = [];
  const repository = {
    async listDocumentExpirationCandidates() { return [...pending.values()]; },
    async claimDocumentExpiration(item) {
      if (!pending.has(item.id)) return false;
      pending.delete(item.id);
      return true;
    },
    async releaseDocumentExpiration(item) { pending.set(item.id, item); return true; },
  };
  const service = createNotificationService({
    repository,
    async mailSender(payload) { mailPayloads.push(payload); return { success: true, data: { accepted: true } }; },
    allowLiveExecution: true,
  });

  const first = await service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });
  const second = await service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });

  assert.equal(first.sent, 2);
  assert.equal(first.summarySent, 1);
  assert.equal(second.candidates, 0);
  assert.equal(second.sent, 0);
  assert.equal(mailPayloads.length, 3);
  assert.ok(mailPayloads.every((payload) => payload.text && payload.html));
});

test("un fallo de correo libera la reclamación para permitir reintento", async () => {
  const released = [];
  const service = createNotificationService({
    repository: {
      async listDocumentExpirationCandidates() { return [candidate()]; },
      async claimDocumentExpiration() { return true; },
      async releaseDocumentExpiration(item) { released.push(item.id); return true; },
    },
    async mailSender() {
      return { success: false, message: "SMTP no disponible", error: { code: "TD_API_UNAVAILABLE" } };
    },
    allowLiveExecution: true,
  });

  const result = await service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  assert.deepEqual(released, [10]);
});

test("convenios se agrupan en un correo y sólo se marcan una vez", async () => {
  const claimed = new Set();
  const candidates = [{
    id: 70,
    clientName: "Cliente Uno",
    managerName: "Gerente Uno",
    managerEmail: "gerente@example.com",
    startDate: "2026-01-01",
    endDate: "2026-08-20",
  }];
  let mails = 0;
  const service = createNotificationService({
    repository: {
      async listAgreementExpirationCandidates() {
        return candidates.filter((item) => !claimed.has(item.id));
      },
      async claimAgreementExpiration(id) { claimed.add(id); return true; },
      async releaseAgreementExpirations(ids) { ids.forEach((id) => claimed.delete(id)); return ids.length; },
    },
    async mailSender() { mails += 1; return { success: true }; },
    allowLiveExecution: true,
  });

  const first = await service.runAgreementExpirationProcess({ asOf: "2026-08-06", dryRun: false });
  const second = await service.runAgreementExpirationProcess({ asOf: "2026-08-06", dryRun: false });
  assert.equal(first.sent, 1);
  assert.equal(second.candidates, 0);
  assert.equal(mails, 1);
});

test("los flujos de persona respetan isUsuario=False y correo válido del OML", async () => {
  let mails = 0;
  const service = createNotificationService({
    repository: {
      async findPerson() {
        return { id: 1, name: "Usuario técnico", email: "tecnico@example.com", isSystemUser: 1 };
      },
    },
    async mailSender() { mails += 1; return { success: true }; },
  });

  const result = await service.runWorkflow("human-resources-action", {
    recipientId: 1,
    countryCode: 4,
    action: "Revisar",
    startDate: "2026-08-06",
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "RECIPIENT_NOT_ELIGIBLE");
  assert.equal(mails, 0);
});

test("la ejecución real queda bloqueada en el servicio antes de consultar o mutar", async () => {
  let repositoryCalls = 0;
  const service = createNotificationService({
    repository: {
      async listDocumentExpirationCandidates() { repositoryCalls += 1; return []; },
    },
    allowLiveExecution: false,
  });

  await assert.rejects(
    () => service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false }),
    (error) => error.code === "NOTIFICATION_EXECUTION_DISABLED" && error.status === 403,
  );
  assert.equal(repositoryCalls, 0);
});

test("send y workflows son simulación por omisión", async () => {
  let mails = 0;
  const service = createNotificationService({
    repository: {},
    async mailSender() { mails += 1; return { success: true }; },
    allowLiveExecution: true,
  });

  const result = await service.sendTemplate("emNotificacionLegal", {
    to: "sucursal@example.com",
    data: { documentName: "Contrato" },
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.sent, false);
  assert.equal(mails, 0);
});
