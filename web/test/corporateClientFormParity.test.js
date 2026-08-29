import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CORPORATE_CLIENT_FORM_FEEDBACK,
  normalizeLegacyPhone,
} from "../src/pages/corporateClientFormParity.js";

test("scrRegistroClientesCorp conserva feedback y teléfono observados en el runtime", () => {
  assert.deepEqual(CORPORATE_CLIENT_FORM_FEEDBACK, {
    initialTelephoneFailure: "Cannot read properties of undefined (reading 'getInstance')",
    mandatoryFields: "Tiene campos obligatorios vacíos.",
    contactNameRequired: "Ingrese el nombre del contacto.",
    contactPhoneRequired: "Ingrese el número de teléfono del contacto.",
    queryFailure: "Error executing query.",
  });
  assert.equal(normalizeLegacyPhone(""), "");
  assert.equal(normalizeLegacyPhone("12345678"), "+50412345678");
  assert.equal(normalizeLegacyPhone("+50412345678"), "+50412345678");
});

test("el formulario implementa los cinco controles y no conserva UI inventada", async () => {
  const source = await readFile(new URL("../src/pages/CorporateClientFormPage.jsx", import.meta.url), "utf8");
  assert.match(source, /fa-minus-circle/);
  assert.match(source, /fa-plus-circle/);
  assert.match(source, />Cancelar</);
  assert.match(source, /clientId \? "Guardar" : "Crear Cliente"/);
  assert.match(source, /removedContactIds/);
  assert.match(source, /maxLength=\{250\}/);
  assert.match(source, /maxLength=\{30\}/);
  assert.doesNotMatch(source, /Switch|message\.success|setCorporateClientStatus|Actualizar Cliente/);
});

test("la geometría principal queda fijada al viewport legacy de 1280 por 720", async () => {
  const css = await readFile(new URL("../src/pages/CorporateClientFormPage.css", import.meta.url), "utf8");
  assert.match(css, /margin:\s*0 0 32px/);
  assert.match(css, /font-size:\s*32px/);
  assert.match(css, /padding:\s*24px/);
  assert.match(css, /column-gap:\s*16px/);
  assert.match(css, /width:\s*223px/);
  assert.match(css, /font-size:\s*26px/);
  assert.match(css, /#42c919/);
  assert.match(css, /#4d5c66/);
});
