export class CatalogValidationError extends Error {
  constructor(message, field, status = 400, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "CatalogValidationError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function requiredId(value, field) {
  const id = positiveInteger(value);
  if (!id) throw new CatalogValidationError("El identificador no es válido.", field);
  return id;
}

function text(value, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function requiredText(value, field, maxLength) {
  const normalized = text(value, maxLength);
  if (!normalized) throw new CatalogValidationError("Complete el campo obligatorio.", field);
  return normalized;
}

function optionalBoolean(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return undefined;
}

function requiredBoolean(value, field) {
  const normalized = optionalBoolean(value);
  if (normalized === undefined) throw new CatalogValidationError("El valor debe ser verdadero o falso.", field);
  return normalized;
}

function normalizePage(query = {}) {
  return {
    page: positiveInteger(query.page) || 1,
    pageSize: Math.min(positiveInteger(query.pageSize) || 20, 100),
    sortOrder: query.sortOrder === "desc" ? "desc" : "asc",
  };
}

function normalizeSort(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normalizeUserFilters(query = {}) {
  return {
    ...normalizePage(query),
    branchId: positiveInteger(query.branchId),
    positionId: positiveInteger(query.positionId),
    search: text(query.search),
    onlyAllowed: optionalBoolean(query.onlyAllowed) === true,
    sortBy: normalizeSort(query.sortBy, ["id", "name", "position", "email"], "name"),
  };
}

export function normalizeProviderFilters(query = {}) {
  return {
    ...normalizePage(query),
    name: text(query.name, 512),
    taxNumber: text(query.taxNumber, 64),
    onlyExternal: query.onlyExternal === undefined ? true : optionalBoolean(query.onlyExternal) === true,
    onlyActive: query.onlyActive === undefined ? true : optionalBoolean(query.onlyActive) === true,
    sortBy: normalizeSort(query.sortBy, ["commercialName", "legalName", "taxNumber", "type", "active"], "commercialName"),
  };
}

export function normalizeCategoryFilters(query = {}) {
  return {
    ...normalizePage(query),
    categoryId: positiveInteger(query.categoryId),
    search: text(query.search),
    onlyRequired: optionalBoolean(query.onlyRequired) === true,
    onlyDocuments: optionalBoolean(query.onlyDocuments) === true,
    onlyActive: optionalBoolean(query.onlyActive) === true,
    sortBy: normalizeSort(query.sortBy, ["category", "subcategory", "required", "document", "active"], "category"),
  };
}

export function normalizeEntityFilters(query = {}) {
  const area = query.area === "legal" || query.area === "regulatory" ? query.area : undefined;
  return {
    ...normalizePage(query),
    entityId: positiveInteger(query.entityId),
    responsibleId: positiveInteger(query.responsibleId),
    area,
    sortBy: normalizeSort(query.sortBy, ["name", "description", "responsible", "area"], "name"),
  };
}

export function normalizeLegalActionFilters(query = {}) {
  return {
    ...normalizePage(query),
    search: text(query.search, 250),
    onlyActive: optionalBoolean(query.onlyActive) === true,
    sortBy: normalizeSort(query.sortBy, ["name", "createdAt", "createdBy", "active"], "name"),
  };
}

function normalizeProvider(body = {}) {
  const internal = requiredBoolean(body.internal, "internal");
  return {
    commercialName: requiredText(body.commercialName, "commercialName", 512),
    legalName: text(body.legalName, 512) || null,
    taxNumber: requiredText(body.taxNumber, "taxNumber", 64),
    active: requiredBoolean(body.active, "active"),
    withholdingOne: requiredBoolean(body.withholdingOne, "withholdingOne"),
    withholdingTwelve: requiredBoolean(body.withholdingTwelve, "withholdingTwelve"),
    internal,
    destinationId: internal ? positiveInteger(body.destinationId) || null : null,
  };
}

function normalizeEntity(body = {}) {
  const area = body.area;
  if (area !== "legal" && area !== "regulatory") {
    throw new CatalogValidationError("Seleccione el área encargada.", "area");
  }
  return {
    name: requiredText(body.name, "name", 128),
    description: text(body.description, 2_000) || null,
    responsibleId: requiredId(body.responsibleId, "responsibleId"),
    legal: area === "legal",
    regulatory: area === "regulatory",
  };
}

function normalizeLegalAction(body = {}) {
  return {
    name: requiredText(body.name, "name", 250),
    active: requiredBoolean(body.active, "active"),
  };
}

function mysqlTimestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function notFound(message) {
  throw new CatalogValidationError(message, undefined, 404, "NOT_FOUND");
}

export function createCatalogService(repository, { now = () => new Date() } = {}) {
  return {
    lookups(countryCode) {
      return repository.getLookups(countryCode);
    },

    listUsers(countryCode, query) {
      return repository.listUsers(countryCode, normalizeUserFilters(query));
    },

    async setUserAccess(auth, userIdValue, body) {
      const userId = requiredId(userIdValue, "id");
      const allowed = requiredBoolean(body?.allowed, "allowed");
      const updated = await repository.setUserAccess({
        countryCode: auth.countryCode,
        userId,
        actorId: auth.id,
        allowed,
        description: allowed ? "Habilitó acceso" : "Deshabilitó acceso",
        timestamp: mysqlTimestamp(now()),
      });
      if (!updated) notFound("El usuario solicitado no existe o ya no está activo.");
      return { id: userId, accessAllowed: allowed };
    },

    listProviders(countryCode, query) {
      return repository.listProviders(countryCode, normalizeProviderFilters(query));
    },

    async createProvider(auth, body) {
      const provider = normalizeProvider(body);
      const duplicate = await repository.findProviderByTaxNumber(auth.countryCode, provider.taxNumber);
      if (duplicate) {
        throw new CatalogValidationError(
          `El número fiscal ya pertenece a ${duplicate.commercialName || "otro proveedor"}.`,
          "taxNumber",
          409,
          "DUPLICATE_TAX_NUMBER",
        );
      }
      const id = await repository.createProvider(auth.countryCode, auth.id, provider);
      return { id, ...provider };
    },

    async updateProvider(auth, providerIdValue, body) {
      const providerId = requiredId(providerIdValue, "id");
      const provider = normalizeProvider(body);
      const duplicate = await repository.findProviderByTaxNumber(auth.countryCode, provider.taxNumber, providerId);
      if (duplicate) {
        throw new CatalogValidationError(
          `El número fiscal ya pertenece a ${duplicate.commercialName || "otro proveedor"}.`,
          "taxNumber",
          409,
          "DUPLICATE_TAX_NUMBER",
        );
      }
      const updated = await repository.updateProvider(auth.countryCode, providerId, provider);
      if (!updated) notFound("El proveedor solicitado no existe.");
      return { id: providerId, ...provider };
    },

    listCategories(countryCode, query) {
      return repository.listCategories(countryCode, normalizeCategoryFilters(query));
    },

    async setCategoryAccess(auth, categoryIdValue, body) {
      const categoryId = requiredId(categoryIdValue, "id");
      const allowed = requiredBoolean(body?.allowed, "allowed");
      const updated = await repository.setCategoryAccess({
        countryCode: auth.countryCode,
        categoryId,
        actorId: auth.id,
        allowed,
        description: allowed ? "Habilitó Subcategoría" : "Deshabilitó Subcategoría",
        timestamp: mysqlTimestamp(now()),
      });
      if (!updated) notFound("La subcategoría solicitada no existe.");
      return { id: categoryId, accessAllowed: allowed };
    },

    listEntities(countryCode, query) {
      return repository.listEntities(countryCode, normalizeEntityFilters(query));
    },

    async createEntity(auth, body) {
      const entity = normalizeEntity(body);
      if (!await repository.isActivePersonInCountry(auth.countryCode, entity.responsibleId)) {
        notFound("El responsable solicitado no existe.");
      }
      const id = await repository.createEntity(auth.countryCode, auth.id, entity);
      return { id, ...entity, responsibleId: auth.id };
    },

    async updateEntity(auth, entityIdValue, body) {
      const entityId = requiredId(entityIdValue, "id");
      const entity = normalizeEntity(body);
      if (!await repository.isActivePersonInCountry(auth.countryCode, entity.responsibleId)) {
        notFound("El responsable solicitado no existe.");
      }
      const updated = await repository.updateEntity(auth.countryCode, entityId, entity);
      if (!updated) notFound("El ente gubernamental solicitado no existe.");
      return { id: entityId, ...entity };
    },

    async deactivateEntity(auth, entityIdValue) {
      const entityId = requiredId(entityIdValue, "id");
      const updated = await repository.deactivateEntity(auth.countryCode, entityId);
      if (!updated) notFound("El ente gubernamental solicitado no existe.");
      return { id: entityId, active: false };
    },

    listLegalActions(query) {
      return repository.listLegalActions(normalizeLegalActionFilters(query));
    },

    async createLegalAction(auth, body) {
      const action = normalizeLegalAction(body);
      const id = await repository.createLegalAction(auth.id, mysqlTimestamp(now()), action);
      return { id, ...action };
    },

    async updateLegalAction(actionIdValue, body) {
      const actionId = requiredId(actionIdValue, "id");
      const action = normalizeLegalAction(body);
      const updated = await repository.updateLegalAction(actionId, action);
      if (!updated) notFound("La acción legal solicitada no existe.");
      return { id: actionId, ...action };
    },
  };
}
