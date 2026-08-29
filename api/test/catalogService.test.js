import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogValidationError,
  createCatalogService,
  normalizeCategoryFilters,
  normalizeEntityFilters,
  normalizeLegalActionFilters,
  normalizeProviderFilters,
  normalizeUserFilters,
} from "../src/services/catalogService.js";

test("normaliza filtros, limita paginación y descarta columnas no permitidas", () => {
  const users = normalizeUserFilters({
    page: "2",
    pageSize: "999",
    branchId: "12",
    positionId: "no-valido",
    search: "  Ana  ",
    onlyAllowed: "true",
    sortBy: "name; DROP TABLE tblPersonas",
    sortOrder: "desc",
  });
  assert.deepEqual(users, {
    page: 2,
    pageSize: 500,
    branchId: 12,
    positionId: undefined,
    search: "Ana",
    onlyAllowed: true,
    sortBy: "name",
    sortOrder: "asc",
  });

  const providers = normalizeProviderFilters({ onlyExternal: "false", onlyActive: "false" });
  assert.equal(providers.onlyExternal, false);
  assert.equal(providers.onlyActive, false);
  assert.equal(normalizeProviderFilters({}).onlyExternal, true);
  assert.equal(normalizeProviderFilters({}).onlyActive, true);
  assert.equal(normalizeProviderFilters({}).pageSize, 500);
  assert.equal(normalizeProviderFilters({}).sortBy, undefined);
  assert.equal(normalizeProviderFilters({ sortBy: "type" }).sortBy, undefined);
  assert.equal(normalizeProviderFilters({ pageSize: "999" }).pageSize, 500);

  assert.equal(normalizeCategoryFilters({ categoryId: "7" }).categoryId, 7);
  assert.equal(normalizeCategoryFilters({ pageSize: "20", sortBy: "category" }).pageSize, 500);
  assert.equal(normalizeCategoryFilters({ sortBy: "category" }).sortBy, undefined);
  assert.equal(normalizeEntityFilters({ area: "inventada" }).area, undefined);
  assert.deepEqual(normalizeLegalActionFilters({}), {
    page: 1,
    pageSize: 50,
    sortOrder: "asc",
    sortBy: undefined,
  });
  assert.equal(normalizeLegalActionFilters({ sortBy: "active" }).sortBy, undefined);
  assert.equal(normalizeLegalActionFilters({ sortBy: "createdBy", sortOrder: "desc" }).sortBy, "createdBy");
});

test("cambio de permiso conserva el usuario autenticado y la descripción legacy", async () => {
  const calls = [];
  const service = createCatalogService({
    async setUserAccess(input) { calls.push(input); return true; },
  }, { now: () => new Date("2026-08-06T14:05:06.000Z") });

  const result = await service.setUserAccess({ id: 99, countryCode: 4 }, "17", { allowed: true });
  assert.deepEqual(result, { id: 17, accessAllowed: true });
  assert.deepEqual(calls[0], {
    countryCode: 4,
    userId: 17,
    actorId: 99,
    allowed: true,
    description: "Habilitó acceso",
    timestamp: "2026-08-06 14:05:06",
  });
});

test("categorías pasan el id de subcategoría al defecto server action y registran auditoría", async () => {
  let call;
  const service = createCatalogService({
    async setCategoryAccess(input) { call = input; return true; },
  }, { now: () => new Date("2026-08-06T15:00:00.000Z") });

  await service.setCategoryAccess({ id: 5, countryCode: 4 }, 23, { allowed: false });
  assert.equal(call.categoryId, 23);
  assert.equal(call.actorId, 5);
  assert.equal(call.description, "Deshabilitó Subcategoría");
});

test("proveedores requieren el número fiscal y bloquean duplicados", async () => {
  const service = createCatalogService({
    async findProviderByTaxNumber() { return { id: 9, commercialName: "Proveedor existente" }; },
  });

  await assert.rejects(
    () => service.createProvider({ id: 1, countryCode: 4 }, {
      commercialName: "Nuevo",
      legalName: "",
      taxNumber: "0801",
      active: false,
      withholdingOne: false,
      withholdingTwelve: false,
      internal: false,
    }),
    (error) => error instanceof CatalogValidationError
      && error.status === 409
      && error.field === "taxNumber",
  );
});

test("proveedores conservan Nombre de Proveedor opcional como el Form legacy", async () => {
  let created;
  const service = createCatalogService({
    async findProviderByTaxNumber() { return null; },
    async createProvider(_countryCode, _actorId, provider) { created = provider; return 12; },
  });

  const result = await service.createProvider({ id: 1, countryCode: 4 }, {
    commercialName: "",
    legalName: "",
    taxNumber: "0801",
    active: false,
    withholdingOne: false,
    withholdingTwelve: false,
    internal: false,
  });

  assert.equal(created.commercialName, "");
  assert.equal(created.legalName, "");
  assert.equal(result.id, 12);
});

test("destinos de proveedor validan el identificador y conservan el país autenticado", async () => {
  const calls = [];
  const service = createCatalogService({
    async listProviderDestinations(countryCode, providerId) {
      calls.push({ countryCode, providerId });
      return { items: [], currencySymbol: "L" };
    },
  });

  const result = await service.listProviderDestinations(4, "77");

  assert.deepEqual(calls, [{ countryCode: 4, providerId: 77 }]);
  assert.deepEqual(result, { items: [], currencySymbol: "L" });
  assert.throws(
    () => service.listProviderDestinations(4, "no-valido"),
    (error) => error instanceof CatalogValidationError && error.field === "id",
  );
});

test("entes aceptan campos vacíos e ignoran área y responsable visibles al crear", async () => {
  let created;
  const service = createCatalogService({
    async createEntity(countryCode, actorId, entity) {
      created = { countryCode, actorId, entity };
      return 8;
    },
  });

  const result = await service.createEntity({ id: 3, countryCode: 4 }, {
    name: "",
    description: "",
    area: "legal",
    responsibleId: 17,
  });

  assert.deepEqual(created, {
    countryCode: 4,
    actorId: 3,
    entity: { name: "", description: "", responsibleId: 0, legal: false, regulatory: false },
  });
  assert.equal(result.responsibleId, 3);
});

test("entes replican actor en alta y mutaciones legacy por identificador", async () => {
  const calls = [];
  const service = createCatalogService({
    async createEntity(countryCode, actorId) { calls.push(["create", countryCode, actorId]); return 8; },
    async updateEntity(entityId, entity) { calls.push(["update", entityId, entity]); return true; },
    async deactivateEntity(entityId) { calls.push(["deactivate", entityId]); return true; },
  });
  const auth = { id: 3, countryCode: 4 };
  const body = { name: "SAR", area: "legal", responsibleId: 17, legal: true };

  const created = await service.createEntity(auth, body);
  await service.updateEntity(auth, 8, body);
  await service.deactivateEntity(auth, 8);

  assert.deepEqual(calls, [
    ["create", 4, 3],
    ["update", 8, {
      name: "SAR",
      description: "",
      responsibleId: 17,
      legal: true,
      regulatory: false,
    }],
    ["deactivate", 8],
  ]);
  assert.equal(created.responsibleId, 3);
});

test("acciones legales conservan IsActivo en alta y edicion", async () => {
  const calls = [];
  const service = createCatalogService({
    async createLegalAction(actorId, timestamp, action) {
      calls.push(["create", actorId, timestamp, action]);
      return 12;
    },
    async updateLegalAction(actionId, action) {
      calls.push(["update", actionId, action]);
      return true;
    },
    async getLegalAction(actionId) {
      calls.push(["get", actionId]);
      return { id: actionId, name: "Anterior", active: false };
    },
  }, { now: () => new Date("2026-08-06T15:00:00.000Z") });

  const created = await service.createLegalAction({ id: 88 }, { name: "  Demanda  ", active: false });
  const updated = await service.updateLegalAction(12, { name: "Demanda laboral", active: true });

  assert.deepEqual(created, { id: 12, name: "  Demanda  ", active: false });
  assert.deepEqual(updated, { id: 12, name: "Demanda laboral", active: true });
  assert.deepEqual(calls, [
    ["create", 88, "2026-08-06 15:00:00", { name: "  Demanda  ", active: false }],
    ["get", 12],
    ["update", 12, { name: "Demanda laboral", active: true }],
  ]);
  await assert.rejects(
    () => service.createLegalAction({ id: 88 }, { name: "Demanda" }),
    (error) => error.field === "active",
  );
});

test("acciones legales replican alta vacía y Aggregate por id con registro por defecto", async () => {
  const calls = [];
  const service = createCatalogService({
    async getLegalAction(id) { calls.push(["get", id]); return null; },
    async createLegalAction(actorId, timestamp, action) {
      calls.push(["create", actorId, timestamp, action]);
      return 91;
    },
  }, { now: () => new Date("2026-08-28T20:47:53.000Z") });

  assert.deepEqual(await service.getLegalAction(0), { id: 0, name: "", active: false });
  assert.deepEqual(
    await service.createLegalAction({ id: 88 }, { name: "", active: false }),
    { id: 91, name: "", active: false },
  );
  assert.deepEqual(calls, [
    ["get", 0],
    ["create", 88, "2026-08-28 20:47:53", { name: "", active: false }],
  ]);
});
