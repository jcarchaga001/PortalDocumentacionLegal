function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function parseBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : undefined;
}

function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  error.field = field;
  return error;
}

export function normalizeAgreementFilters(query = {}) {
  return {
    page: positiveInteger(query.page) || 1,
    pageSize: Math.min(positiveInteger(query.pageSize) || 50, 100),
    clientId: positiveInteger(query.clientId),
    startDate: parseDate(query.startDate),
    endDate: parseDate(query.endDate),
    indefinite: parseBoolean(query.indefinite),
    search: typeof query.search === "string" ? query.search.trim().slice(0, 160) : "",
  };
}

function normalizeAgreementAttachment(attachment = {}) {
  const s3Key = typeof attachment.s3Key === "string" ? attachment.s3Key.trim() : "";
  if (!/^[^\\/]{1,15}$/.test(s3Key)) {
    throw validationError("La clave S3 del adjunto no es valida.", "attachments.s3Key");
  }
  const fileName = typeof attachment.fileName === "string"
    ? attachment.fileName.trim().slice(0, 95)
    : "";
  if (!fileName) {
    throw validationError("El nombre del archivo es obligatorio.", "attachments.fileName");
  }
  const extension = typeof attachment.extension === "string"
    ? attachment.extension.trim().slice(0, 10)
    : "";
  return { s3Key, fileName, extension };
}

export function normalizeAgreementPayload(payload = {}, { allowExistingAttachments = false } = {}) {
  const clientId = positiveInteger(payload.clientId);
  if (!clientId) throw validationError("Seleccione al Cliente del convenio.", "clientId");

  const branchIds = Array.isArray(payload.branchIds)
    ? [...new Set(payload.branchIds.map(positiveInteger).filter(Boolean))]
    : [];
  const removedAttachmentIds = Array.isArray(payload.removedAttachmentIds)
    ? [...new Set(payload.removedAttachmentIds.map(positiveInteger).filter(Boolean))]
    : [];
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments.map(normalizeAgreementAttachment)
    : [];
  const accountManagerCode = typeof payload.accountManagerCode === "string"
    ? payload.accountManagerCode.trim().slice(0, 25)
    : "";
  if (!accountManagerCode) {
    throw validationError("Seleccione al Gestor de la cuenta.", "accountManagerCode");
  }
  if (!branchIds.length) {
    throw validationError("Seleccione al menos 1 sucursal que facture.", "branchIds");
  }

  const hasPromissoryNote = parseBoolean(payload.hasPromissoryNote);
  const isPromissoryNoteExpired = hasPromissoryNote && parseBoolean(payload.isPromissoryNoteExpired);
  const isPromissoryNoteIndefinite = hasPromissoryNote && parseBoolean(payload.isPromissoryNoteIndefinite);
  if (hasPromissoryNote && !allowExistingAttachments && !attachments.length) {
    throw validationError(
      "Afirmo que el cliente tiene pagare, porfavor agregar el archivo.",
      "attachments",
    );
  }

  const startDate = parseDate(payload.startDate);
  const isIndefinite = parseBoolean(payload.isIndefinite);
  const endDate = parseDate(payload.endDate);
  const creditDays = Number(payload.creditDays);
  const creditLimit = Number(payload.creditLimit);
  const promissoryNoteExpirationDate = parseDate(payload.promissoryNoteExpirationDate);
  const invalidMandatory = !startDate
    || (!isIndefinite && !endDate)
    || !Number.isInteger(creditDays)
    || creditDays < 0
    || creditDays > 3650
    || !Number.isFinite(creditLimit)
    || creditLimit < 0
    || creditLimit > 99_999_999_999.99
    || (hasPromissoryNote && !isPromissoryNoteIndefinite && !promissoryNoteExpirationDate);
  if (invalidMandatory) {
    throw validationError("Hay Campos obligatorios vacíos.", "form");
  }
  if (!isIndefinite && endDate <= startDate) {
    throw validationError('La "Fecha Final" debe ser mayor a la "Fecha Inicial".', "endDate");
  }

  const observation = typeof payload.observation === "string"
    ? payload.observation.trim().slice(0, 10_000)
    : "";

  return {
    clientId,
    accountManagerCode,
    branchIds,
    removedAttachmentIds,
    attachments,
    startDate,
    endDate,
    creditDays,
    creditLimit,
    hasPromissoryNote,
    isPromissoryNoteExpired,
    promissoryNoteExpirationDate,
    isIndefinite,
    isPromissoryNoteIndefinite,
    isDollar: parseBoolean(payload.isDollar),
    observation,
  };
}

export function createAgreementService(agreementRepository) {
  return {
    list(countryCode, query) {
      return agreementRepository.list(countryCode, normalizeAgreementFilters(query));
    },
    clients(countryCode) {
      return agreementRepository.getClients(countryCode);
    },
    catalogs(countryCode) {
      return agreementRepository.getCatalogs(countryCode);
    },
    async get(countryCode, rawId) {
      const agreementId = positiveInteger(rawId);
      if (!agreementId) throw validationError("El convenio solicitado no es valido.", "id");
      const agreement = await agreementRepository.getById(countryCode, agreementId);
      if (!agreement) {
        const error = new Error("El convenio solicitado no existe.");
        error.status = 404;
        error.code = "AGREEMENT_NOT_FOUND";
        throw error;
      }
      return agreement;
    },
    async contacts(countryCode, rawId) {
      const agreementId = positiveInteger(rawId);
      if (!agreementId) throw validationError("El convenio solicitado no es valido.", "id");
      const contacts = await agreementRepository.getClientContacts(countryCode, agreementId);
      if (!contacts) {
        const error = new Error("El convenio solicitado no existe.");
        error.status = 404;
        error.code = "AGREEMENT_NOT_FOUND";
        throw error;
      }
      return contacts;
    },
    create(countryCode, userId, payload) {
      return agreementRepository.create(countryCode, userId, normalizeAgreementPayload(payload));
    },
    update(countryCode, userId, rawId, payload) {
      const agreementId = positiveInteger(rawId);
      if (!agreementId) throw validationError("El convenio solicitado no es valido.", "id");
      return agreementRepository.update(
        countryCode,
        userId,
        agreementId,
        normalizeAgreementPayload(payload, { allowExistingAttachments: true }),
      );
    },
    addAttachment(countryCode, userId, rawId, payload = {}) {
      const agreementId = positiveInteger(rawId);
      if (!agreementId) throw validationError("El convenio solicitado no es valido.", "id");
      const attachment = normalizeAgreementAttachment(payload);
      return agreementRepository.addAttachment(
        countryCode,
        userId,
        agreementId,
        attachment,
      );
    },
    removeAttachment(countryCode, userId, rawId, rawAttachmentId) {
      const agreementId = positiveInteger(rawId);
      const attachmentId = positiveInteger(rawAttachmentId);
      if (!agreementId) throw validationError("El convenio solicitado no es valido.", "id");
      if (!attachmentId) throw validationError("El adjunto solicitado no es valido.", "attachmentId");
      return agreementRepository.removeAttachment(countryCode, userId, agreementId, attachmentId);
    },
  };
}
