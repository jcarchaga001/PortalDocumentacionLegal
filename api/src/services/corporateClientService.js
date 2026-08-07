function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true";
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

function normalizeContact(contact = {}) {
  const name = cleanText(contact.name, 120);
  if (!name) throw validationError("Ingrese el nombre del contacto adicional.", "contacts.name");
  const phone = cleanText(contact.phone, 25);
  if (!phone) {
    throw validationError("Ingrese el número de teléfono del contacto.", "contacts.phone");
  }
  const email = cleanText(contact.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError("El correo del contacto adicional no es valido.", "contacts.email");
  }
  return {
    id: positiveInteger(contact.id),
    name,
    position: cleanText(contact.position, 160),
    phone,
    email,
  };
}

export function normalizeCorporateClientPayload(payload = {}) {
  const name = cleanText(payload.name, 250);
  if (!name) throw validationError("Ingrese el nombre del cliente.", "name");
  const faCode = cleanText(payload.faCode, 30);
  if (!faCode) throw validationError("Ingrese el CodigoFA.", "faCode");
  const contactEmail = cleanText(payload.contactEmail, 120);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw validationError("El correo del contacto principal no es valido.", "contactEmail");
  }
  const contacts = Array.isArray(payload.contacts)
    ? payload.contacts.filter((contact) => cleanText(contact?.name, 120)).map(normalizeContact)
    : [];
  return {
    name,
    faCode,
    contactName: cleanText(payload.contactName, 120),
    contactPosition: cleanText(payload.contactPosition, 160),
    contactPhone: cleanText(payload.contactPhone, 25),
    contactEmail,
    contacts,
  };
}

export function normalizeCorporateClientFilters(query = {}) {
  return {
    page: positiveInteger(query.page) || 1,
    pageSize: Math.min(positiveInteger(query.pageSize) || 20, 100),
    search: cleanText(query.search, 200),
    activeOnly: parseBoolean(query.activeOnly, false),
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
      if (payload.items.length > 2_000) {
        throw validationError("La carga no puede superar 2000 clientes.", "items");
      }
      const seenFaCodes = new Set();
      const clients = payload.items.map((item, index) => {
        const client = normalizeCorporateClientPayload(item);
        if (!client.contactName) {
          throw validationError(
            "Este registro no es valido, el Nombre del contacto es requerido",
            `items.${index}.contactName`,
          );
        }
        if (!client.contactPhone) {
          throw validationError(
            "Este registro no es valido, el Telefono del contacto es requerido",
            `items.${index}.contactPhone`,
          );
        }
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
