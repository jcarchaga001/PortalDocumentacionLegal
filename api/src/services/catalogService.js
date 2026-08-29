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
    page: positiveInteger(query.page) || 1,
    pageSize: Math.min(positiveInteger(query.pageSize) || 500, 500),
    branchId: positiveInteger(query.branchId),
    positionId: positiveInteger(query.positionId),
    search: text(query.search),
    onlyAllowed: optionalBoolean(query.onlyAllowed) === true,
    // GetPersonas has a fixed AttributeSort by Nombre_Personas.  The legacy
    // table renders sortable affordances, but its OnSort action is orphaned.
    sortBy: "name",
    sortOrder: "asc",
  };
}

export function normalizeProviderFilters(query = {}) {
  const pagination = normalizePage(query);
  return {
    ...pagination,
    pageSize: Math.min(positiveInteger(query.pageSize) || 500, 500),
    name: text(query.name, 512),
    taxNumber: text(query.taxNumber, 64),
    onlyExternal: query.onlyExternal === undefined ? true : optionalBoolean(query.onlyExternal) === true,
    onlyActive: query.onlyActive === undefined ? true : optionalBoolean(query.onlyActive) === true,
    sortBy: normalizeSort(query.sortBy, ["commercialName", "legalName", "taxNumber", "active"], undefined),
  };
}

export function normalizeCategoryFilters(query = {}) {
  return {
    ...normalizePage(query),
    pageSize: 500,
    categoryId: positiveInteger(query.categoryId),
    search: text(query.search),
    onlyRequired: optionalBoolean(query.onlyRequired) === true,
    onlyDocuments: optionalBoolean(query.onlyDocuments) === true,
    onlyActive: optionalBoolean(query.onlyActive) === true,
    sortBy: undefined,
  };
}

export function normalizeEntityFilters(query = {}) {
  const area = query.area === "legal" || query.area === "regulatory" ? query.area : undefined;
  return {
    page: positiveInteger(query.page) || 1,
    // StartIndex belongs to the Pagination widget, but the legacy refresh of
    // GetTblEntesGubernamentaleXFiltro always sends StartIndex=0.  The widget
    // itself is configured with MaxRecords=500 while the Aggregate is capped
    // at 50 rows.
    pageSize: 500,
    entityId: positiveInteger(query.entityId),
    responsibleId: positiveInteger(query.responsibleId),
    area,
    sortBy: undefined,
    sortOrder: "asc",
  };
}

export function normalizeLegalActionFilters(query = {}) {
  const pagination = normalizePage(query);
  return {
    ...pagination,
    pageSize: Math.min(positiveInteger(query.pageSize) || 50, 50),
    sortBy: normalizeSort(query.sortBy, ["name", "createdAt", "createdBy"], undefined),
  };
}

function normalizeProvider(body = {}) {
  const internal = requiredBoolean(body.internal, "internal");
  return {
    commercialName: text(body.commercialName, 512),
    legalName: text(body.legalName, 512),
    taxNumber: requiredText(body.taxNumber, "taxNumber", 64),
    active: requiredBoolean(body.active, "active"),
    withholdingOne: requiredBoolean(body.withholdingOne, "withholdingOne"),
    withholdingTwelve: requiredBoolean(body.withholdingTwelve, "withholdingTwelve"),
    internal,
    destinationId: internal ? positiveInteger(body.destinationId) || null : null,
  };
}

function normalizeEntityCreate(body = {}) {
  return {
    // Both inputs have Mandatory=False.  The two popup DropdownSearch client
    // handlers are no-ops, so a create ignores their visible selections.
    name: typeof body.name === "string" ? body.name.slice(0, 128) : "",
    description: typeof body.description === "string" ? body.description.slice(0, 65_535) : "",
    responsibleId: 0,
    legal: false,
    regulatory: false,
  };
}

function normalizeEntityUpdate(body = {}) {
  const responsibleId = Number(body.responsibleId);
  return {
    name: typeof body.name === "string" ? body.name.slice(0, 128) : "",
    description: typeof body.description === "string" ? body.description.slice(0, 65_535) : "",
    responsibleId: Number.isInteger(responsibleId) && responsibleId >= 0 ? responsibleId : 0,
    legal: optionalBoolean(body.legal) === true,
    regulatory: optionalBoolean(body.regulatory) === true,
  };
}

function normalizeLegalAction(body = {}) {
  return {
    // El Input legacy tiene Mandatory=False: incluso una cadena vacía llega al
    // Create/Update de la entidad. No normalizar ni recortar espacios aquí.
    name: typeof body.name === "string" ? body.name.slice(0, 250) : "",
    active: requiredBoolean(body.active, "active"),
  };
}

function legalActionId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 0) {
    throw new CatalogValidationError("El identificador no es válido.", "id");
  }
  return id;
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

    userPermissionLookups(countryCode) {
      return repository.getUserPermissionLookups(countryCode);
    },

    documentCategoryLookups(countryCode) {
      return repository.getDocumentCategoryLookups(countryCode);
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

    listProviderBranches(countryCode) {
      return repository.listProviderBranches(countryCode);
    },

    listProviderDestinations(countryCode, providerIdValue) {
      return repository.listProviderDestinations(
        countryCode,
        requiredId(providerIdValue, "id"),
      );
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
      if (!updated) notFound("El registro solicitado no existe.");
      return { id: categoryId, accessAllowed: allowed };
    },

    entityLookups() {
      return repository.getGovernmentEntityLookups();
    },

    listEntities(_countryCode, query) {
      return repository.listEntities(normalizeEntityFilters(query));
    },

    async createEntity(auth, body) {
      const entity = normalizeEntityCreate(body);
      const id = await repository.createEntity(auth.countryCode, auth.id, entity);
      return { id, ...entity, responsibleId: auth.id };
    },

    async updateEntity(_auth, entityIdValue, body) {
      const entityId = requiredId(entityIdValue, "id");
      const entity = normalizeEntityUpdate(body);
      const updated = await repository.updateEntity(entityId, entity);
      if (!updated) notFound("El ente gubernamental solicitado no existe.");
      return { id: entityId, ...entity };
    },

    async deactivateEntity(_auth, entityIdValue) {
      const entityId = requiredId(entityIdValue, "id");
      const updated = await repository.deactivateEntity(entityId);
      if (!updated) notFound("El ente gubernamental solicitado no existe.");
      return { id: entityId, active: false };
    },

    listLegalActions(query) {
      return repository.listLegalActions(normalizeLegalActionFilters(query));
    },

    async getLegalAction(actionIdValue) {
      const actionId = legalActionId(actionIdValue);
      const action = await repository.getLegalAction(actionId);
      // GetTblAccionesLegalByCodAccion expone el registro por defecto cuando el
      // Aggregate con CodAccion=0 no encuentra filas (apertura de alta).
      return action || { id: actionId, name: "", active: false };
    },

    async createLegalAction(auth, body) {
      const action = normalizeLegalAction(body);
      const id = await repository.createLegalAction(auth.id, mysqlTimestamp(now()), action);
      return { id, ...action };
    },

    async updateLegalAction(actionIdValue, body) {
      const actionId = requiredId(actionIdValue, "id");
      const action = normalizeLegalAction(body);
      const current = await repository.getLegalAction(actionId);
      if (!current) notFound("La acción legal solicitada no existe.");
      const updated = await repository.updateLegalAction(actionId, action);
      if (!updated) notFound("La acción legal solicitada no existe.");
      return { id: actionId, ...action };
    },
  };
}
