import assert from "node:assert/strict";
import test from "node:test";
import {
  createCorporateClientService,
  normalizeCorporateClientPayload,
} from "../src/services/corporateClientService.js";

function validClient(overrides = {}) {
  return {
    faCode: "FA-001",
    name: "Cliente",
    contactName: "Contacto",
    contactPhone: "9999-9999",
    ...overrides,
  };
}

test("carga masiva conserva las validaciones de contacto y CodigoFA del legacy", async () => {
  let received;
  const service = createCorporateClientService({
    async bulkUpsert(countryCode, userId, clients) {
      received = { countryCode, userId, clients };
      return { processed: clients.length };
    },
  });

  await service.bulkUpsert(4, 12, { items: [validClient()] });
  assert.equal(received.countryCode, 4);
  assert.equal(received.userId, 12);
  assert.equal(received.clients.length, 1);

  assert.throws(
    () => service.bulkUpsert(4, 12, { items: [validClient({ contactName: "" })] }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "items.0.contactName",
  );
  assert.throws(
    () => service.bulkUpsert(4, 12, { items: [validClient({ contactPhone: "" })] }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "items.0.contactPhone",
  );
  assert.throws(
    () => service.bulkUpsert(4, 12, {
      items: [validClient(), validClient({ name: "Duplicado" })],
    }),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "items.1.faCode",
  );
});

test("un contacto adicional exige nombre y teléfono como el formulario legacy", () => {
  assert.throws(
    () => normalizeCorporateClientPayload(validClient({
      contacts: [{ name: "Contacto adicional", phone: "" }],
    })),
    (error) => error.code === "VALIDATION_ERROR"
      && error.field === "contacts.phone"
      && error.message === "Ingrese el número de teléfono del contacto.",
  );

  assert.deepEqual(
    normalizeCorporateClientPayload(validClient({
      contacts: [{ name: "Contacto adicional", phone: "9999-8888" }],
    })).contacts,
    [{
      id: undefined,
      name: "Contacto adicional",
      position: "",
      phone: "9999-8888",
      email: "",
    }],
  );
});
