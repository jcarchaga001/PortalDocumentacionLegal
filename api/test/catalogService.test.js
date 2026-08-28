import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogValidationError,
  createCatalogService,
  normalizeCategoryFilters,
  normalizeEntityFilters,
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
    pageSize: 100,
    branchId: 12,
    positionId: undefined,
    search: "Ana",
    onlyAllowed: true,
    sortBy: "name",
    sortOrder: "desc",
  });

  const providers = normalizeProviderFilters({ onlyExternal: "false", onlyActive: "false" });
  assert.equal(providers.onlyExternal, false);
  assert.equal(providers.onlyActive, false);
  assert.equal(normalizeProviderFilters({}).onlyExternal, true);
  assert.equal(normalizeProviderFilters({}).onlyActive, true);

  assert.equal(normalizeCategoryFilters({ categoryId: "7" }).categoryId, 7);
  assert.equal(normalizeEntityFilters({ area: "inventada" }).area, undefined);
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

test("categorías actualizan la subcategoría seleccionada y registran auditoría", async () => {
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

test("entes exigen área y responsable válidos", async () => {
  const service = createCatalogService({});
  await assert.rejects(
    () => service.createEntity({ countryCode: 4 }, { name: "SAR", area: "otra", responsibleId: 7 }),
    (error) => error.field === "area" && error.status === 400,
  );
  await assert.rejects(
    () => service.createEntity({ countryCode: 4 }, { name: "SAR", area: "legal", responsibleId: "x" }),
    (error) => error.field === "responsibleId" && error.status === 400,
  );
});

test("entes validan responsable y mutaciones dentro del pais autenticado", async () => {
  const calls = [];
  const service = createCatalogService({
    async isActivePersonInCountry(countryCode, personId) {
      calls.push(["responsible", countryCode, personId]);
      return true;
    },
    async createEntity(countryCode, actorId) { calls.push(["create", countryCode, actorId]); return 8; },
    async updateEntity(countryCode, entityId) { calls.push(["update", countryCode, entityId]); return true; },
    async deactivateEntity(countryCode, entityId) { calls.push(["deactivate", countryCode, entityId]); return true; },
  });
  const auth = { id: 3, countryCode: 4 };
  const body = { name: "SAR", area: "legal", responsibleId: 17 };

  const created = await service.createEntity(auth, body);
  await service.updateEntity(auth, 8, body);
  await service.deactivateEntity(auth, 8);

  assert.deepEqual(calls, [
    ["responsible", 4, 17],
    ["create", 4, 3],
    ["responsible", 4, 17],
    ["update", 4, 8],
    ["deactivate", 4, 8],
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
  }, { now: () => new Date("2026-08-06T15:00:00.000Z") });

  const created = await service.createLegalAction({ id: 88 }, { name: "  Demanda  ", active: false });
  const updated = await service.updateLegalAction(12, { name: "Demanda laboral", active: true });

  assert.deepEqual(created, { id: 12, name: "Demanda", active: false });
  assert.deepEqual(updated, { id: 12, name: "Demanda laboral", active: true });
  assert.deepEqual(calls, [
    ["create", 88, "2026-08-06 15:00:00", { name: "Demanda", active: false }],
    ["update", 12, { name: "Demanda laboral", active: true }],
  ]);
  await assert.rejects(
    () => service.createLegalAction({ id: 88 }, { name: "Demanda" }),
    (error) => error.field === "active",
  );
});
