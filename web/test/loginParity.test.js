import assert from "node:assert/strict";
import test from "node:test";
import {
  legacyLoginCountries,
  LOGIN_COUNTRY_CODE,
  LOGIN_FEEDBACK,
} from "../src/pages/loginParity.js";

test("GetPaises del Login conserva solo el codigo 4 definido en el OML", () => {
  assert.equal(LOGIN_COUNTRY_CODE, 4);
  assert.deepEqual(
    legacyLoginCountries([
      { countryCode: 3, name: "Guatemala" },
      { countryCode: 4, name: "Honduras" },
      { countryCode: 8, name: "Panamá" },
    ]),
    [{ countryCode: 4, name: "Honduras" }],
  );
  assert.deepEqual(legacyLoginCountries(null), []);
});

test("mensajes visibles del Login coinciden con los literales del OML", () => {
  assert.equal(LOGIN_FEEDBACK.countryRequired, "Debe Seleccionar País");
  assert.equal(LOGIN_FEEDBACK.invalidCredentials, "Datos de ingreso no válidos");
  assert.equal(LOGIN_FEEDBACK.queryError, "Error executing query.");
  assert.equal(LOGIN_FEEDBACK.requiredField, "Campo Obligatorio");
  assert.equal(
    LOGIN_FEEDBACK.recoverySuccess,
    "Se ha enviado sus datos de ingreso al correo ingresado",
  );
});
