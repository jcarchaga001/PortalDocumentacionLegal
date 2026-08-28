import { sendMail } from "./tdMailService.js";
import {
  listLegacyEmailTemplates,
  renderLegacyEmail,
} from "./legacyEmailTemplates.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serviceError(message, { code = "VALIDATION_ERROR", field, status = 400 } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (field) error.field = field;
  return error;
}

function normalizeDate(value) {
  const normalized = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return normalized;
}

function currentLocalDate(clock) {
  const date = clock();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateText, { months = 0, days = 0 } = {}) {
  const [year, month, day] = dateText.split("-").map(Number);
  let date = new Date(Date.UTC(year, month - 1, day));
  if (months) {
    const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
    const targetMonthEnd = new Date(Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0,
    ));
    date = new Date(Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(day, targetMonthEnd.getUTCDate()),
    ));
  }
  if (days) date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function recipients(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[;,]/);
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
}

function configuredRecipients(name, fallback = "") {
  return recipients(process.env[name] || fallback);
}

function validEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

function validRecipients(value, field = "to") {
  const normalized = recipients(value);
  if (!normalized.length || normalized.some((email) => !validEmail(email))) {
    throw serviceError("Los destinatarios del correo no son válidos.", { field });
  }
  return normalized;
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw serviceError("El identificador solicitado no es válido.", { field });
  }
  return number;
}

function countryCode(value) {
  return positiveInteger(value, "countryCode");
}

function normalizeRunInput(input, clock, defaults) {
  const requestedDate = String(input?.asOf || "").trim();
  const asOf = requestedDate ? normalizeDate(requestedDate) : currentLocalDate(clock);
  if (!asOf) {
    throw serviceError("La fecha de corte debe usar el formato YYYY-MM-DD.", { field: "asOf" });
  }
  const dryRun = input?.dryRun !== false;
  return { asOf, dryRun, ...defaults(asOf) };
}

function mailFailure(result) {
  return serviceError(result?.message || "No fue posible enviar el correo.", {
    code: result?.error?.code || "MAIL_SEND_FAILED",
    status: 502,
  });
}

function documentTemplateData(candidate) {
  return {
    companyName: "Farmacias del Ahorro",
    countryCode: candidate.countryCode,
    documentName: candidate.subcategory,
    documentReference: candidate.documentCode,
    contractNumber: candidate.documentReference,
    belongsTo: candidate.branchName,
    dueDate: candidate.dueDate,
    documentType: candidate.documentType,
  };
}

function summaryDocument(candidate) {
  return {
    branch: candidate.branchLabel,
    category: candidate.category,
    subcategory: candidate.subcategory,
    documentCode: candidate.documentCode,
    documentReference: candidate.documentReference,
    dueDate: candidate.dueDate,
    status: candidate.kind === "expired" ? "Vencido" : "Por Vencer",
  };
}

export function createNotificationService({
  repository,
  mailSender = sendMail,
  clock = () => new Date(),
  allowLiveExecution = String(process.env.NOTIFICATION_LIVE_ENABLED || "").trim().toLowerCase() === "true",
} = {}) {
  if (!repository) throw new Error("notificationRepository es obligatorio.");
  let documentExpirationProcessRunning = false;

  function requireLiveExecution() {
    if (!allowLiveExecution) {
      throw serviceError("La ejecución real de notificaciones está deshabilitada.", {
        code: "NOTIFICATION_EXECUTION_DISABLED",
        status: 403,
      });
    }
  }

  async function dispatch({ template, to, cc, bcc, data, dryRun = false }) {
    if (!dryRun) requireLiveExecution();
    const rendered = renderLegacyEmail(template, data);
    const normalizedTo = validRecipients(to);
    const normalizedCc = recipients(cc);
    const normalizedBcc = recipients(bcc);
    if (normalizedCc.some((email) => !validEmail(email))) {
      throw serviceError("Los destinatarios CC no son válidos.", { field: "cc" });
    }
    if (normalizedBcc.some((email) => !validEmail(email))) {
      throw serviceError("Los destinatarios BCC no son válidos.", { field: "bcc" });
    }

    const payload = {
      to: normalizedTo,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      ...(normalizedCc.length ? { cc: normalizedCc } : {}),
      ...(normalizedBcc.length ? { bcc: normalizedBcc } : {}),
    };
    if (dryRun) {
      return {
        sent: false,
        dryRun: true,
        template,
        subject: rendered.subject,
        recipientCount: normalizedTo.length,
        ccCount: normalizedCc.length,
        bccCount: normalizedBcc.length,
      };
    }

    let result;
    try {
      result = await mailSender(payload);
    } catch (error) {
      throw serviceError(error.message || "No fue posible enviar el correo.", {
        code: "MAIL_SEND_FAILED",
        status: 502,
      });
    }
    if (!result?.success) throw mailFailure(result);
    return {
      sent: true,
      dryRun: false,
      template,
      subject: rendered.subject,
      recipientCount: normalizedTo.length,
      ccCount: normalizedCc.length,
      bccCount: normalizedBcc.length,
    };
  }

  async function eligiblePerson(personId, requestedCountryCode) {
    const person = await repository.findPerson(
      positiveInteger(personId, "recipientId"),
      countryCode(requestedCountryCode),
    );
    if (!person || Boolean(person.isSystemUser) || !validEmail(person.email)) {
      return null;
    }
    return person;
  }

  async function workflowPersonAction(input, template) {
    const requestedCountryCode = countryCode(input.countryCode);
    const recipient = await eligiblePerson(input.recipientId, requestedCountryCode);
    if (!recipient) return { sent: false, skipped: true, reason: "RECIPIENT_NOT_ELIGIBLE", template };
    const sender = await repository.findPerson(
      positiveInteger(input.assignedById, "assignedById"),
      requestedCountryCode,
    );
    const senderEmail = sender?.isSystemUser
      ? configuredRecipients("DIGITAL_TRANSFORMATION_EMAIL", "tranformaciondigital@farmavalue.com")
      : recipients(sender?.email);
    return dispatch({
      template,
      to: recipient.email,
      cc: senderEmail,
      data: {
        ...input,
        assignedUser: recipient.name,
        assignedBy: sender?.name || input.assignedBy,
      },
      dryRun: input.dryRun !== false,
    });
  }

  const workflows = Object.freeze({
    "legal-action": (input) => workflowPersonAction(input, "emNotiAccionLegal"),
    "incident-action": (input) => workflowPersonAction(input, "emNotiAccion"),
    async "urgent-comment"(input) {
      return workflowPersonAction({ ...input, action: undefined }, "emNotiAccionComentario");
    },
    async "human-resources-action"(input) {
      const requestedCountryCode = countryCode(input.countryCode);
      const recipient = await eligiblePerson(input.recipientId, requestedCountryCode);
      if (!recipient) {
        return { sent: false, skipped: true, reason: "RECIPIENT_NOT_ELIGIBLE", template: "emNotificacionRRHH" };
      }
      return dispatch({
        template: "emNotificacionRRHH",
        to: recipient.email,
        cc: configuredRecipients("HR_NOTIFICATION_CC", "alexandra.aleman@farmavalue.com"),
        data: { ...input, assignedUser: recipient.name },
        dryRun: input.dryRun !== false,
      });
    },
    async "incident-reported"(input) {
      const requestedCountryCode = countryCode(input.countryCode);
      const recipient = await eligiblePerson(input.recipientId, requestedCountryCode);
      if (!recipient) {
        return { sent: false, skipped: true, reason: "RECIPIENT_NOT_ELIGIBLE", template: "emNotiincidente" };
      }
      const branch = await repository.findBranch(
        positiveInteger(input.branchId, "branchId"),
        requestedCountryCode,
      );
      const regulatory = ["ARSA", "CQFH"].includes(String(input.action || input.agency || "").trim().toUpperCase());
      const baseCc = configuredRecipients(
        "INCIDENT_NOTIFICATION_CC",
        "dvelasquez@farmavalue.com,rurbina@farmavalue.com,angie.rodriguez@farmavalue.com,iromano@farmavalue.com",
      );
      const regulatoryCc = regulatory
        ? configuredRecipients("INCIDENT_REGULATORY_CC", "fredy.gonzales@farmavalue.com")
        : [];
      return dispatch({
        template: "emNotiincidente",
        to: recipient.email,
        cc: [branch?.email, ...baseCc, ...regulatoryCc],
        data: { ...input, assignedUser: recipient.name, branchName: branch?.name || input.branchName },
        dryRun: input.dryRun !== false,
      });
    },
    async "incident-legal"(input) {
      const requestedCountryCode = countryCode(input.countryCode);
      const recipient = await eligiblePerson(input.recipientId, requestedCountryCode);
      if (!recipient) {
        return { sent: false, skipped: true, reason: "RECIPIENT_NOT_ELIGIBLE", template: "emNotiincidente" };
      }
      return dispatch({
        template: "emNotiincidente",
        to: configuredRecipients("INCIDENT_LEGAL_NOTIFICATION_TO", "astrid.duron@farmavalue.com"),
        data: { ...input, assignedUser: recipient.name },
        dryRun: input.dryRun !== false,
      });
    },
    async "labor-action"(input) {
      return dispatch({
        template: "emNotiAccionCasosLaborales",
        to: input.to,
        cc: configuredRecipients("LABOR_ACTION_NOTIFICATION_CC", "astrid.duron@farmavalue.com"),
        data: input,
        dryRun: input.dryRun !== false,
      });
    },
  });

  return {
    listTemplates: listLegacyEmailTemplates,

    preview(template, data) {
      return renderLegacyEmail(template, data);
    },

    async sendTemplate(template, input = {}) {
      return dispatch({
        template,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        data: input.data || {},
        dryRun: input.dryRun !== false,
      });
    },

    async runWorkflow(workflowName, input = {}) {
      const workflow = workflows[workflowName];
      if (!workflow) {
        throw serviceError("El flujo de notificación solicitado no existe.", { field: "workflow" });
      }
      return workflow(input);
    },

    async sendDocumentExpiration(input = {}) {
      const requestedCountryCode = countryCode(input.countryCode);
      const documentId = positiveInteger(input.documentId, "documentId");
      const document = await repository.findDocumentExpiration(documentId, requestedCountryCode);
      if (!document) {
        throw serviceError("El documento solicitado no existe.", {
          code: "DOCUMENT_NOT_FOUND",
          field: "documentId",
          status: 404,
        });
      }

      return dispatch({
        template: "emNotificacionLegal",
        to: document.branchEmail,
        cc: configuredRecipients(
          "DOCUMENT_EXPIRATION_CC",
          "legal.hn@farmavalue.com,angie.rodriguez@farmavalue.com",
        ),
        data: {
          countryCode: requestedCountryCode,
          belongsTo: document.branchName,
          documentName: document.documentName,
          contractNumber: document.contractNumber,
          dueDate: document.dueDate,
          transactionType: document.transactionType,
          documentReference: document.documentReference,
          documentType: document.documentType,
        },
        dryRun: input.dryRun !== false,
      });
    },

    async runDocumentExpirationProcess(input = {}) {
      const options = normalizeRunInput(input, clock, (asOf) => ({
        warningCutoff: shiftDate(asOf, { months: 3 }),
      }));
      if (!options.dryRun) {
        requireLiveExecution();
        if (!String(input?.asOf || "").trim()) {
          throw serviceError("La ejecución real exige una fecha de corte explícita.", {
            code: "NOTIFICATION_AS_OF_REQUIRED",
            field: "asOf",
          });
        }
      }

      const execute = async () => {
        const warningCandidates = await repository.listDocumentWarningCandidates(options);

      if (options.dryRun) {
        const expiredCandidates = await repository.listDocumentExpiredCandidates(options);
        return {
          process: "prcVerificarProximoVencer",
          dryRun: true,
          asOf: options.asOf,
          warningCutoff: options.warningCutoff,
          candidates: warningCandidates.length + expiredCandidates.length,
          warning: warningCandidates.length,
          expired: expiredCandidates.length,
          summaryEligible: warningCandidates.length > 0 && expiredCandidates.length > 0,
          sent: 0,
          failed: 0,
          skipped: 0,
        };
      }

      const successful = [];
      const failures = [];
      let skipped = 0;

      async function processCandidates(candidates, claim) {
        for (const candidate of candidates) {
          const claimed = await claim(candidate);
          if (!claimed) {
            skipped += 1;
            continue;
          }
          try {
            await dispatch({
              template: candidate.kind === "expired" ? "emNotificacionLegalVencido" : "emNotificacionLegal",
              to: candidate.branchEmail,
              cc: configuredRecipients(
                "DOCUMENT_EXPIRATION_CC",
                "legal.hn@farmavalue.com,angie.rodriguez@farmavalue.com",
              ),
              data: documentTemplateData(candidate),
            });
            successful.push(candidate);
          } catch (error) {
            const released = await repository.releaseDocumentExpiration(candidate, options.asOf);
            failures.push({
              id: candidate.id,
              kind: candidate.kind,
              code: error.code || "MAIL_SEND_FAILED",
              released,
            });
          }
        }
      }

      await processCandidates(
        warningCandidates,
        (candidate) => repository.claimDocumentWarning(candidate, options),
      );

      // El aggregate de vencidos se ejecuta después de la transición 2 -> 4.
      // Esto conserva el doble paso legacy para documentos ya vencidos en estado 2.
      const expiredCandidates = await repository.listDocumentExpiredCandidates(options);
      await processCandidates(
        expiredCandidates,
        (candidate) => repository.claimDocumentExpired(candidate, options.asOf),
      );

      const summaryFailures = [];
      const byCountry = new Map();
      const summaryEligible = warningCandidates.length > 0 && expiredCandidates.length > 0;
      if (summaryEligible) {
        for (const candidate of successful) {
          const group = byCountry.get(candidate.countryCode) || [];
          group.push(candidate);
          byCountry.set(candidate.countryCode, group);
        }
      }
      for (const [candidateCountry, countryDocuments] of byCountry) {
        try {
          await dispatch({
            template: "emNotificacionAreaLegal",
            to: configuredRecipients("LEGAL_NOTIFICATION_EMAIL", "legal.hn@farmavalue.com"),
            cc: configuredRecipients("LEGAL_NOTIFICATION_CC", "ammy.interiano@farmavalue.com"),
            data: {
              companyName: "Farmacias del Ahorro",
              countryCode: candidateCountry,
              documents: countryDocuments.map(summaryDocument),
            },
          });
        } catch (error) {
          summaryFailures.push({ countryCode: candidateCountry, code: error.code || "MAIL_SEND_FAILED" });
        }
      }

        return {
          process: "prcVerificarProximoVencer",
          dryRun: false,
          asOf: options.asOf,
          warningCutoff: options.warningCutoff,
          candidates: warningCandidates.length + expiredCandidates.length,
          warning: warningCandidates.length,
          expired: expiredCandidates.length,
          sent: successful.length,
          failed: failures.length,
          skipped,
          summaryEligible,
          summarySent: byCountry.size - summaryFailures.length,
          summaryFailed: summaryFailures.length,
          failures,
          summaryFailures,
        };
      };

      if (options.dryRun) return execute();
      if (documentExpirationProcessRunning) {
        throw serviceError("El proceso de vencimientos ya está en ejecución.", {
          code: "NOTIFICATION_PROCESS_ALREADY_RUNNING",
          status: 409,
        });
      }

      documentExpirationProcessRunning = true;
      let releaseProcessLock;
      try {
        if (typeof repository.acquireDocumentExpirationProcessLock === "function") {
          releaseProcessLock = await repository.acquireDocumentExpirationProcessLock();
          if (!releaseProcessLock) {
            throw serviceError("El proceso de vencimientos ya está en ejecución.", {
              code: "NOTIFICATION_PROCESS_ALREADY_RUNNING",
              status: 409,
            });
          }
        }
        return await execute();
      } finally {
        try {
          if (releaseProcessLock) await releaseProcessLock();
        } finally {
          documentExpirationProcessRunning = false;
        }
      }
    },

    async runAgreementExpirationProcess(input = {}) {
      const options = normalizeRunInput(input, clock, (asOf) => ({
        warningCutoff: shiftDate(asOf, { days: 30 }),
      }));
      if (!options.dryRun) requireLiveExecution();
      const candidates = await repository.listAgreementExpirationCandidates(options);
      if (options.dryRun) {
        return {
          action: "ConveniosAVencer",
          dryRun: true,
          asOf: options.asOf,
          warningCutoff: options.warningCutoff,
          candidates: candidates.length,
          sent: 0,
          skipped: 0,
        };
      }

      const claimed = [];
      for (const candidate of candidates) {
        if (await repository.claimAgreementExpiration(candidate.id)) claimed.push(candidate);
      }
      if (!claimed.length) {
        return {
          action: "ConveniosAVencer",
          dryRun: false,
          asOf: options.asOf,
          warningCutoff: options.warningCutoff,
          candidates: candidates.length,
          sent: 0,
          skipped: candidates.length,
        };
      }

      try {
        await dispatch({
          template: "emNotiAccionConveniosAVencer",
          to: configuredRecipients("AGREEMENT_NOTIFICATION_TO", "fazula@farmavalue.com"),
          cc: claimed.map((agreement) => agreement.managerEmail),
          bcc: configuredRecipients(
            "AGREEMENT_NOTIFICATION_BCC",
            "alejandro.zelaya@farmavalue.com,mirna.matute@farmavalue.com",
          ),
          data: { agreements: claimed },
        });
      } catch (error) {
        await repository.releaseAgreementExpirations(claimed.map((agreement) => agreement.id));
        throw error;
      }

      return {
        action: "ConveniosAVencer",
        dryRun: false,
        asOf: options.asOf,
        warningCutoff: options.warningCutoff,
        candidates: candidates.length,
        sent: claimed.length,
        skipped: candidates.length - claimed.length,
      };
    },
  };
}
