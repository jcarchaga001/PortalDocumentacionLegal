function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  error.field = field;
  return error;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function legacyFormText(value, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

export const CORPORATE_CLIENT_CONTACTS_MAX_RECORDS = 500;

function normalizeContact(contact = {}) {
  const name = legacyFormText(contact.name, 120);
  if (!name) throw validationError("Ingrese el nombre del contacto adicional.", "contacts.name");
  const phone = legacyFormText(contact.phone, 25);
  if (!phone) {
    throw validationError("Ingrese el número de teléfono del contacto.", "contacts.phone");
  }
  return {
    id: positiveInteger(contact.id),
    name,
    position: legacyFormText(contact.position, 160),
    phone,
    email: legacyFormText(contact.email, 120),
  };
}

export function normalizeCorporateClientPayload(payload = {}) {
  const name = legacyFormText(payload.name, 250);
  if (!name) throw validationError("Ingrese el nombre del cliente.", "name");
  const faCode = legacyFormText(payload.faCode, 30);
  if (!faCode) throw validationError("Ingrese el CodigoFA.", "faCode");
  const contacts = Array.isArray(payload.contacts)
    ? payload.contacts.map(normalizeContact)
    : [];
  return {
    name,
    faCode,
    contactName: legacyFormText(payload.contactName, 120),
    contactPosition: legacyFormText(payload.contactPosition, 160),
    contactPhone: legacyFormText(payload.contactPhone, 25),
    contactEmail: legacyFormText(payload.contactEmail, 120),
    contacts,
    removedContactIds: Array.isArray(payload.removedContactIds)
      ? [...new Set(payload.removedContactIds.map(positiveInteger).filter(Boolean))]
      : [],
  };
}

function legacyImportText(value, maxLength) {
  return value === undefined || value === null ? "" : String(value).slice(0, maxLength);
}

/**
 * scrCargaMasivaClientesCorp convierte Excel directamente a strClientesCorp.
 * A diferencia del formulario individual, la carga no aplica Trim, no valida
 * correo y solo exige NombreContacto y TelefonoContacto en el flujo cliente.
 */
export function normalizeCorporateClientImportPayload(payload = {}, index = 0) {
  const client = {
    faCode: legacyImportText(payload.faCode, 30),
    name: legacyImportText(payload.name, 250),
    contactName: legacyImportText(payload.contactName, 120),
    contactPosition: legacyImportText(payload.contactPosition, 160),
    contactPhone: legacyImportText(payload.contactPhone, 25),
    contactEmail: legacyImportText(payload.contactEmail, 120),
    contacts: [],
  };
  if (client.contactName === "") {
    throw validationError(
      "Este registro no es valido, el Nombre del contacto es requerido",
      `items.${index}.contactName`,
    );
  }
  if (client.contactPhone === "") {
    throw validationError(
      "Este registro no es valido, el Teléfono del contacto es requerido",
      `items.${index}.contactPhone`,
    );
  }
  return client;
}

export function normalizeCorporateClientFilters(query = {}) {
  return {
    page: positiveInteger(query.page) || 1,
    pageSize: 50,
    activeOnly: true,
  };
}

export function createCorporateClientService(repository) {
  return {
    list(countryCode, query) {
      return repository.list(countryCode, normalizeCorporateClientFilters(query));
    },
    async get(countryCode, rawId) {
      const clientId = positiveInteger(rawId);
      if (!clientId) throw validationError("El cliente solicitado no es valido.", "id");
      const client = await repository.getById(countryCode, clientId);
      if (!client) {
        const error = new Error("El cliente corporativo solicitado no existe.");
        error.status = 404;
        error.code = "CORPORATE_CLIENT_NOT_FOUND";
        throw error;
      }
      return client;
    },
    async contacts(countryCode, rawId) {
      const clientId = positiveInteger(rawId);
      if (!clientId) throw validationError("El cliente solicitado no es valido.", "id");
      const items = await repository.listContacts(countryCode, clientId);
      return {
        items,
        maxRecords: CORPORATE_CLIENT_CONTACTS_MAX_RECORDS,
      };
    },
    create(countryCode, userId, payload) {
      return repository.create(countryCode, userId, normalizeCorporateClientPayload(payload));
    },
    update(countryCode, userId, rawId, payload) {
      const clientId = positiveInteger(rawId);
      if (!clientId) throw validationError("El cliente solicitado no es valido.", "id");
      return repository.update(countryCode, userId, clientId, normalizeCorporateClientPayload(payload));
    },
    setStatus(countryCode, userId, rawId, payload = {}) {
      const clientId = positiveInteger(rawId);
      if (!clientId) throw validationError("El cliente solicitado no es valido.", "id");
      if (typeof payload.isActive !== "boolean") {
        throw validationError("El estado del cliente es obligatorio.", "isActive");
      }
      return repository.setStatus(countryCode, userId, clientId, payload.isActive);
    },
    bulkUpsert(countryCode, userId, payload = {}) {
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw validationError("La carga debe contener al menos un cliente.", "items");
      }
      const seenFaCodes = new Set();
      const clients = payload.items.map((item, index) => {
        const client = normalizeCorporateClientImportPayload(item, index);
        if (seenFaCodes.has(client.faCode)) {
          throw validationError("Este registro no es valido", `items.${index}.faCode`);
        }
        seenFaCodes.add(client.faCode);
        return client;
      });
      return repository.bulkUpsert(countryCode, userId, clients);
    },
  };
}
