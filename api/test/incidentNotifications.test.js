import assert from "node:assert/strict";
import test from "node:test";
import { createIncidentService } from "../src/services/incidentService.js";

const FIXED_CLOCK = () => new Date(2026, 7, 6, 9, 30, 0);

function incidentResult(overrides = {}) {
  return {
    id: 318,
    reference: "GUB-209908-00001",
    branchId: 312,
    branchName: "HN01 - Sucursal Centro",
    agencyId: 4,
    agencyName: "ARSA",
    typeId: 2,
    visitDate: "2099-08-06 11:23:00",
    openingDate: "2099-08-06 11:23:00",
    registeredById: 460,
    registeredByName: "Administrador Regional",
    actions: [{
      id: 901,
      name: "Revision de Incidente",
      responsibleId: 404,
      responsibleName: "Responsable Legal",
      startDate: "2099-08-06",
      dueDate: "2099-08-06",
      isAutomatic: true,
    }],
    comments: [],
    actionHistory: [],
    ...overrides,
  };
}

test("crear incidente no regulatorio conserva la rama OML sin correo", async () => {
  const events = [];
  const service = createIncidentService({
    async createIncident() {
      events.push({ source: "repository" });
      return incidentResult({ typeId: 1, agencyName: "Area Interna" });
    },
  }, {
    notificationService: notificationService(events),
    clock: FIXED_CLOCK,
  });

  const result = await service.createIncident("internal", 4, 460, {
    branchId: 312,
    agencyId: 4,
    visitorId: 99,
    visitAt: "2099-08-06T11:23",
    comment: "Visita interna",
    s3Key: "incidents/evidencia.pdf",
    fileName: "evidencia.pdf",
  });

  assert.deepEqual(events, [{ source: "repository" }]);
  assert.deepEqual(result.notification, {
    success: true,
    attempted: false,
    sent: false,
    skipped: true,
    reason: "OML_NOTIFICATION_ONLY_FOR_REGULATORY_INCIDENT",
  });
});

function laborResult(overrides = {}) {
  return {
    id: 77,
    incidentNumber: "CL-2099-00077",
    branchId: 312,
    branchName: "HN01 - Sucursal Centro",
    applicantId: 460,
    applicantName: "Solicitante Laboral",
    applicantEmail: "solicitante@example.test",
    actions: [{
      id: 880,
      actionId: 12,
      name: "Preparar descargos",
      responsibleId: 701,
      responsibleName: "Responsable RRHH",
      startDate: null,
      expectedDueDate: null,
      closeDate: "2099-09-15",
    }],
    comments: [],
    history: [],
    actionHistory: [],
    files: [],
    ...overrides,
  };
}

function notificationService(events, result = { sent: true, dryRun: false }) {
  return {
    async runWorkflow(workflow, input) {
      events.push({ source: "notification", workflow, input });
      return result;
    },
  };
}

for (const scope of ["internal", "external"]) {
  test(`crear incidente ${scope} notifica incident-reported despues de confirmar el registro`, async () => {
    const events = [];
    const repository = {
      async createIncident(receivedScope, countryCode, userId, input) {
        events.push({ source: "repository", receivedScope, countryCode, userId, input });
        return incidentResult(scope === "external" ? { visitDate: null } : {});
      },
    };
    const service = createIncidentService(repository, {
      notificationService: notificationService(events),
      clock: FIXED_CLOCK,
    });

    const result = await service.createIncident(scope, 4, 460, {
      branchId: 312,
      agencyId: 4,
      visitorId: 99,
      visitAt: "2099-08-06T11:23",
      comment: "Visita de ente regulador",
      s3Key: "incidents/evidencia.pdf",
      fileName: "evidencia.pdf",
    });

    assert.deepEqual(events.map(({ source }) => source), ["repository", "notification"]);
    assert.equal(events[0].receivedScope, scope);
    assert.deepEqual(events[1], {
      source: "notification",
      workflow: "incident-reported",
      input: {
        dryRun: false,
        recipientId: 404,
        countryCode: 4,
        branchId: 312,
        startDate: "2099-08-06",
        action: "ARSA",
        agency: "ARSA",
        assignedById: 460,
        assignedBy: "Administrador Regional",
        branchName: "HN01 - Sucursal Centro",
      },
    });
    assert.equal(result.notification.success, true);
  });
}

test("crear accion de incidente notifica incident-action con los argumentos del OML", async () => {
  const events = [];
  const repository = {
    async createIncidentAction(scope, countryCode, userId, incidentId, action) {
      events.push({ source: "repository", scope, countryCode, userId, incidentId, action });
      return incidentResult({
        actions: [{
          id: 902,
          name: action.name,
          responsibleId: action.responsibleId,
          dueDate: action.dueDate,
          isAutomatic: false,
        }],
      });
    },
  };
  const service = createIncidentService(repository, {
    notificationService: notificationService(events),
    clock: FIXED_CLOCK,
  });

  const result = await service.createIncidentAction("external", 4, 460, 318, {
    name: "Remitir respuesta oficial",
    description: "Enviar el oficio firmado",
    responsibleId: 405,
    dueDate: "2099-08-20",
  });

  assert.deepEqual(events.map(({ source }) => source), ["repository", "notification"]);
  assert.deepEqual(events[1], {
    source: "notification",
    workflow: "incident-action",
    input: {
      dryRun: false,
      recipientId: 405,
      assignedById: 460,
      countryCode: 4,
      startDate: "2099-08-20",
      action: "Remitir respuesta oficial",
      branchName: "HN01 - Sucursal Centro",
    },
  });
  assert.equal(result.notification.success, true);
});

test("crear accion laboral para RRHH ejecuta human-resources-action", async () => {
  const events = [];
  const repository = {
    async createLaborAction(countryCode, userId, caseId, action) {
      events.push({ source: "repository", countryCode, userId, caseId, action });
      return laborResult();
    },
    async getLaborNotificationRecipient(countryCode, responsibleId) {
      events.push({ source: "recipient", countryCode, responsibleId });
      return {
        id: 701,
        name: "Responsable RRHH",
        email: "rrhh@example.test",
        isHumanResources: true,
      };
    },
  };
  const service = createIncidentService(repository, {
    notificationService: notificationService(events),
    clock: FIXED_CLOCK,
  });

  const result = await service.createLaborAction(4, 460, 77, {
    actionId: 12,
    responsibleId: 701,
    dueDate: "2099-09-15",
    description: "Preparar expediente",
  });

  assert.deepEqual(events.map(({ source }) => source), ["repository", "recipient", "notification"]);
  assert.deepEqual(events[2], {
    source: "notification",
    workflow: "human-resources-action",
    input: {
      dryRun: false,
      recipientId: 701,
      countryCode: 4,
      startDate: "2026-08-06",
      action: "Preparar descargos",
    },
  });
  assert.equal(result.notification.success, true);
});

test("crear accion laboral para un responsable no RRHH no inventa un correo", async () => {
  const events = [];
  const repository = {
    async createLaborAction() {
      events.push({ source: "repository" });
      return laborResult({
        actions: [{
          id: 880,
          actionId: 12,
          name: "Preparar descargos",
          responsibleId: 702,
          responsibleName: "Solicitante Laboral",
          closeDate: "2099-09-15",
        }],
      });
    },
    async getLaborNotificationRecipient(countryCode, responsibleId) {
      events.push({ source: "recipient", countryCode, responsibleId });
      return {
        id: 702,
        name: "Solicitante Laboral",
        email: "solicitante@example.test",
        isHumanResources: false,
      };
    },
  };
  const service = createIncidentService(repository, {
    notificationService: notificationService(events),
    clock: FIXED_CLOCK,
  });

  const result = await service.createLaborAction(4, 460, 77, {
    actionId: 12,
    responsibleId: 702,
    dueDate: "2099-09-15",
  });

  assert.deepEqual(events.map(({ source }) => source), ["repository", "recipient"]);
  assert.equal(result.notification.success, true);
  assert.equal(result.notification.sent, false);
  assert.equal(result.notification.skipped, true);
});

test("reasignar accion laboral ejecuta CorreoAccion mediante labor-action", async () => {
  const events = [];
  const repository = {
    async updateLaborAction(countryCode, userId, actionId, update) {
      events.push({ source: "repository", countryCode, userId, actionId, update });
      return laborResult();
    },
    async getLaborNotificationRecipient(countryCode, responsibleId) {
      events.push({ source: "recipient", countryCode, responsibleId });
      return {
        id: 701,
        name: "Responsable RRHH",
        email: "rrhh@example.test",
        isHumanResources: true,
      };
    },
  };
  const service = createIncidentService(repository, {
    notificationService: notificationService(events),
    clock: FIXED_CLOCK,
  });

  const result = await service.updateLaborAction(4, 460, 880, {
    operation: "reassign",
    responsibleId: 701,
  });

  assert.deepEqual(events.map(({ source }) => source), ["repository", "recipient", "notification"]);
  assert.deepEqual(events[2], {
    source: "notification",
    workflow: "labor-action",
    input: {
      dryRun: false,
      to: "rrhh@example.test",
      closeDate: "2099-09-15",
      assignedUser: "Responsable RRHH",
      action: "Preparar descargos",
      countryCode: 4,
      assignedBy: "Solicitante Laboral",
      branchName: "HN01 - Sucursal Centro",
    },
  });
  assert.equal(result.notification.success, true);
});

test("otras actualizaciones laborales no disparan CorreoAccion", async () => {
  const events = [];
  const repository = {
    async updateLaborAction(countryCode, userId, actionId, update) {
      events.push({ source: "repository", countryCode, userId, actionId, update });
      return laborResult();
    },
    async getLaborNotificationRecipient() {
      events.push({ source: "recipient" });
      throw new Error("No debe consultar destinatarios para una reprogramacion");
    },
  };
  const service = createIncidentService(repository, {
    notificationService: notificationService(events),
    clock: FIXED_CLOCK,
  });

  const result = await service.updateLaborAction(4, 460, 880, {
    operation: "reschedule",
    dueDate: "2099-10-01",
  });

  assert.deepEqual(events.map(({ source }) => source), ["repository"]);
  assert.equal(result.id, 77);
});

test("un fallo de notificacion posterior al commit no revierte ni rechaza la operacion principal", async () => {
  const events = [];
  const repositoryResult = incidentResult();
  const repository = {
    async createIncidentAction() {
      events.push("repository-committed");
      return repositoryResult;
    },
  };
  const failingNotifier = {
    async runWorkflow() {
      events.push("notification-failed");
      const error = new Error("SMTP no disponible");
      error.code = "MAIL_SEND_FAILED";
      throw error;
    },
  };
  const service = createIncidentService(repository, {
    notificationService: failingNotifier,
    clock: FIXED_CLOCK,
  });

  const result = await service.createIncidentAction("internal", 4, 460, 318, {
    name: "Validar hallazgos",
    responsibleId: 405,
    dueDate: "2099-08-20",
  });

  assert.deepEqual(events, ["repository-committed", "notification-failed"]);
  assert.equal(result.id, repositoryResult.id);
  assert.equal(result.notification.success, false);
  assert.equal(result.notification.sent, false);
});
