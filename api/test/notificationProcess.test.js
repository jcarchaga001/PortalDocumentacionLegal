import assert from "node:assert/strict";
import test from "node:test";
import {
  createNotificationRepository,
  DOCUMENT_EXPIRATION_PROCESS_LOCK,
} from "../src/repositories/notificationRepository.js";
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
    expiredMailSent: false,
    lastUpdatedAt: "2026-07-01 08:00:00",
    ...overrides,
  };
}

test("el repositorio conserva las dos fases y las reclamaciones condicionales del proceso", async () => {
  const calls = [];
  const repository = createNotificationRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/^\s*SELECT d\.codigoDocumento/.test(sql)) return [[], []];
      return [{ affectedRows: 1 }, []];
    },
  });

  await repository.listDocumentWarningCandidates({ warningCutoff: "2026-11-06" });
  await repository.listDocumentExpiredCandidates({ asOf: "2026-08-06" });
  await repository.claimDocumentWarning(candidate(), {
    asOf: "2026-08-06",
    warningCutoff: "2026-11-06",
  });
  await repository.claimDocumentExpired(
    candidate({ kind: "expired", statusId: 4 }),
    "2026-08-06",
  );

  assert.match(calls[0].sql, /fechaVencimiento < \? AND d\.estadoDocumento = 2/);
  assert.doesNotMatch(calls[0].sql, /fechaVencimiento >= \?/);
  assert.match(calls[0].sql, /LEFT JOIN/);
  assert.match(calls[0].sql, /ORDER BY d\.referenciaDocumento/);
  assert.deepEqual(calls[0].parameters, ["2026-11-06"]);
  assert.match(calls[1].sql, /estadoDocumento IN \(2, 4\)/);
  assert.doesNotMatch(calls[1].sql, /AND COALESCE\(d\.mailVencido/);
  assert.deepEqual(calls[1].parameters, ["2026-08-06"]);
  assert.match(calls[2].sql, /SET estadoDocumento = 4/);
  assert.match(calls[2].sql, /fechaVencimiento < \?/);
  assert.deepEqual(calls[2].parameters, ["2026-08-06", 10, "2026-11-06"]);
  assert.match(calls[3].sql, /SET estadoDocumento = 5/);
  assert.match(calls[3].sql, /mailVencido = 1/);
  assert.deepEqual(calls[3].parameters, ["2026-08-06", 10, 4, "2026-08-06"]);
});

test("el repositorio mantiene un bloqueo MySQL durante toda la ejecución live", async () => {
  const calls = [];
  let released = 0;
  const connection = {
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      if (/GET_LOCK/.test(sql)) return [[{ acquired: 1 }], []];
      return [[{ released: 1 }], []];
    },
    release() { released += 1; },
  };
  const repository = createNotificationRepository({
    async getConnection() { return connection; },
  });

  const release = await repository.acquireDocumentExpirationProcessLock();
  assert.equal(typeof release, "function");
  assert.deepEqual(calls[0].parameters, [DOCUMENT_EXPIRATION_PROCESS_LOCK]);
  await release();
  await release();

  assert.match(calls[0].sql, /GET_LOCK\(\?, 0\)/);
  assert.match(calls[1].sql, /RELEASE_LOCK\(\?\)/);
  assert.equal(released, 1);
});

test("la liberación restaura estado, mail y fecha sólo sobre la reclamación propia", async () => {
  const calls = [];
  const repository = createNotificationRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [{ affectedRows: 1 }, []];
    },
  });

  await repository.releaseDocumentExpiration(candidate(), "2026-08-06");
  await repository.releaseDocumentExpiration(candidate({
    kind: "expired",
    statusId: 4,
    expiredMailSent: true,
  }), "2026-08-06");

  assert.match(calls[0].sql, /estadoDocumento = 4/);
  assert.match(calls[0].sql, /fechaUltimaActualizacion = \?/);
  assert.deepEqual(calls[0].parameters, ["2026-07-01 08:00:00", 10, "2026-08-06"]);
  assert.match(calls[1].sql, /estadoDocumento = 5/);
  assert.match(calls[1].sql, /mailVencido = \?/);
  assert.deepEqual(
    calls[1].parameters,
    [4, 1, "2026-07-01 08:00:00", 10, "2026-08-06"],
  );
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
  assert.match(calls[0].sql, /s\.correoSucursal AS branchEmail/);
  assert.match(calls[0].sql, /d\.codigoDocumento = \? AND d\.codigoPais = \?/);
  assert.deepEqual(calls[0].parameters, [42, 4]);
});

test("SendemPorVencer manual usa el correo persistido de la sucursal y el CC legal del OML", async () => {
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
          branchEmail: "sucursal@example.com",
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
  assert.deepEqual(mailPayload.to, ["sucursal@example.com"]);
  assert.deepEqual(mailPayload.cc, [
    "legal.hn@farmavalue.com",
    "angie.rodriguez@farmavalue.com",
  ]);
  assert.match(mailPayload.text, /Permiso sanitario - DOC-70/);
  assert.match(mailPayload.text, /CON-70/);
  assert.match(mailPayload.text, /Sucursal Centro/);
  assert.match(mailPayload.text, /20\/09\/2026/);
  assert.equal(result.sent, true);
});

test("SendemPorVencer manual no usa un destinatario suministrado por el cliente", async () => {
  let mailPayload;
  const service = createNotificationService({
    repository: {
      async findDocumentExpiration(documentId, countryCode) {
        return {
          id: documentId,
          countryCode,
          branchName: "Sucursal Centro",
          branchEmail: "sucursal@example.com",
          documentName: "Permiso sanitario",
          dueDate: "2026-09-20",
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

  await service.sendDocumentExpiration({
    countryCode: 4,
    documentId: 70,
    to: "destino-alterado@example.com",
    dryRun: false,
  });

  assert.deepEqual(mailPayload.to, ["sucursal@example.com"]);
});

test("SendemPorVencer manual rechaza una sucursal sin correo válido antes del SMTP", async () => {
  let mails = 0;
  const service = createNotificationService({
    repository: {
      async findDocumentExpiration(documentId, countryCode) {
        return {
          id: documentId,
          countryCode,
          branchName: "Sucursal sin correo",
          branchEmail: "",
          documentName: "Permiso sanitario",
          dueDate: "2026-09-20",
          documentType: 1,
        };
      },
    },
    async mailSender() {
      mails += 1;
      return { success: true };
    },
    allowLiveExecution: true,
  });

  await assert.rejects(
    () => service.sendDocumentExpiration({
      countryCode: 4,
      documentId: 70,
      dryRun: false,
    }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "to",
  );
  assert.equal(mails, 0);
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
      async listDocumentWarningCandidates() { return [candidate()]; },
      async listDocumentExpiredCandidates() {
        return [candidate({ id: 11, kind: "expired", dueDate: "2026-08-01", statusId: 4 })];
      },
      async claimDocumentWarning() { claims += 1; return true; },
      async claimDocumentExpired() { claims += 1; return true; },
    },
    async mailSender() { mails += 1; return { success: true }; },
    clock: () => new Date(2026, 7, 6, 8),
  });

  const result = await service.runDocumentExpirationProcess();
  assert.deepEqual(
    {
      dryRun: result.dryRun,
      candidates: result.candidates,
      warning: result.warning,
      expired: result.expired,
      summaryEligible: result.summaryEligible,
    },
    { dryRun: true, candidates: 2, warning: 1, expired: 1, summaryEligible: true },
  );
  assert.equal(claims, 0);
  assert.equal(mails, 0);
});

test("AddMonths replica el cierre de mes sin desbordar al mes siguiente", async () => {
  let received;
  const service = createNotificationService({
    repository: {
      async listDocumentWarningCandidates(options) { received = options; return []; },
      async listDocumentExpiredCandidates() { return []; },
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

test("un documento vencido en estado 2 recorre 2 -> 4 -> 5 una sola vez", async () => {
  let statusId = 2;
  const mailPayloads = [];
  const repository = {
    async listDocumentWarningCandidates() {
      return statusId === 2
        ? [candidate({ dueDate: "2026-08-01", statusId, kind: "warning" })]
        : [];
    },
    async claimDocumentWarning() {
      if (statusId !== 2) return false;
      statusId = 4;
      return true;
    },
    async listDocumentExpiredCandidates() {
      return [2, 4].includes(statusId)
        ? [candidate({ dueDate: "2026-08-01", statusId, kind: "expired" })]
        : [];
    },
    async claimDocumentExpired(item) {
      if (statusId !== item.statusId) return false;
      statusId = 5;
      return true;
    },
    async releaseDocumentExpiration(item) { statusId = item.statusId; return true; },
  };
  const service = createNotificationService({
    repository,
    async mailSender(payload) { mailPayloads.push(payload); return { success: true, data: { accepted: true } }; },
    allowLiveExecution: true,
  });

  const first = await service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });
  const second = await service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });

  assert.equal(first.sent, 2);
  assert.equal(first.warning, 1);
  assert.equal(first.expired, 1);
  assert.equal(first.summaryEligible, true);
  assert.equal(first.summarySent, 1);
  assert.equal(statusId, 5);
  assert.equal(second.candidates, 0);
  assert.equal(second.sent, 0);
  assert.equal(mailPayloads.length, 3);
  assert.ok(mailPayloads.every((payload) => payload.text && payload.html));
});

test("una segunda ejecución concurrente se rechaza antes de leer o resumir candidatos", async () => {
  let statusId = 2;
  let releaseWarningRead;
  let notifyWarningRead;
  const warningReadStarted = new Promise((resolve) => { notifyWarningRead = resolve; });
  const warningBarrier = new Promise((resolve) => { releaseWarningRead = resolve; });
  const mailPayloads = [];
  const repository = {
    async listDocumentWarningCandidates() {
      notifyWarningRead();
      await warningBarrier;
      return statusId === 2
        ? [candidate({ dueDate: "2026-08-01", statusId: 2, kind: "warning" })]
        : [];
    },
    async claimDocumentWarning() {
      if (statusId !== 2) return false;
      statusId = 4;
      return true;
    },
    async listDocumentExpiredCandidates() {
      return [2, 4].includes(statusId)
        ? [candidate({ dueDate: "2026-08-01", statusId, kind: "expired" })]
        : [];
    },
    async claimDocumentExpired(item) {
      if (statusId !== item.statusId) return false;
      statusId = 5;
      return true;
    },
    async releaseDocumentExpiration(item) { statusId = item.statusId; return true; },
  };
  const service = createNotificationService({
    repository,
    async mailSender(payload) { mailPayloads.push(payload); return { success: true }; },
    allowLiveExecution: true,
  });

  const firstRun = service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });
  await warningReadStarted;
  await assert.rejects(
    () => service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false }),
    (error) => error.code === "NOTIFICATION_PROCESS_ALREADY_RUNNING" && error.status === 409,
  );
  releaseWarningRead();
  const first = await firstRun;

  assert.equal(first.sent, 2);
  assert.equal(first.summarySent, 1);
  assert.equal(mailPayloads.length, 3);
  assert.equal(statusId, 5);
});

test("la ejecución real exige fecha explícita para no depender de la zona del host", async () => {
  let repositoryCalls = 0;
  const service = createNotificationService({
    repository: {
      async listDocumentWarningCandidates() { repositoryCalls += 1; return []; },
    },
    allowLiveExecution: true,
  });

  await assert.rejects(
    () => service.runDocumentExpirationProcess({ dryRun: false }),
    (error) => error.code === "NOTIFICATION_AS_OF_REQUIRED" && error.field === "asOf",
  );
  assert.equal(repositoryCalls, 0);
});

test("un lock MySQL ocupado rechaza el runner antes de consultar candidatos", async () => {
  let repositoryCalls = 0;
  const service = createNotificationService({
    repository: {
      async acquireDocumentExpirationProcessLock() { return null; },
      async listDocumentWarningCandidates() { repositoryCalls += 1; return []; },
    },
    allowLiveExecution: true,
  });

  await assert.rejects(
    () => service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false }),
    (error) => error.code === "NOTIFICATION_PROCESS_ALREADY_RUNNING" && error.status === 409,
  );
  assert.equal(repositoryCalls, 0);
});

test("el resumen legal exige listas de por vencer y vencidos no vacías", async () => {
  let mails = 0;
  const service = createNotificationService({
    repository: {
      async listDocumentWarningCandidates() { return [candidate()]; },
      async claimDocumentWarning() { return true; },
      async listDocumentExpiredCandidates() { return []; },
      async releaseDocumentExpiration() { return true; },
    },
    async mailSender() { mails += 1; return { success: true }; },
    allowLiveExecution: true,
  });

  const result = await service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });

  assert.equal(result.sent, 1);
  assert.equal(result.summaryEligible, false);
  assert.equal(result.summarySent, 0);
  assert.equal(mails, 1);
});

test("un fallo de correo libera la reclamación para permitir reintento", async () => {
  const released = [];
  const service = createNotificationService({
    repository: {
      async listDocumentWarningCandidates() { return [candidate()]; },
      async claimDocumentWarning() { return true; },
      async listDocumentExpiredCandidates() { return []; },
      async releaseDocumentExpiration(item, asOf) { released.push({ id: item.id, asOf }); return true; },
    },
    async mailSender() {
      return { success: false, message: "SMTP no disponible", error: { code: "TD_API_UNAVAILABLE" } };
    },
    allowLiveExecution: true,
  });

  const result = await service.runDocumentExpirationProcess({ asOf: "2026-08-06", dryRun: false });
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.failures[0].released, true);
  assert.deepEqual(released, [{ id: 10, asOf: "2026-08-06" }]);
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
      async listDocumentWarningCandidates() { repositoryCalls += 1; return []; },
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
