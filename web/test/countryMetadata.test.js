import assert from "node:assert/strict";
import test from "node:test";
import {
  getCountryMetadata,
  getLegacyCountryConfiguration,
  LEGACY_COUNTRY_CONFIGURATION,
} from "../src/config/countryMetadata.js";

test("resuelve el asset de Honduras para el codigo legacy", () => {
  assert.deepEqual(getCountryMetadata(4), {
    name: "Honduras",
    flagAsset: "country-honduras.png",
  });
});

test("no muestra Honduras para un pais ausente o desconocido", () => {
  assert.equal(getCountryMetadata(undefined), null);
  assert.equal(getCountryMetadata(99), null);
});

test("conserva los diez registros activos de ConfiguracionPaises del OML", () => {
  assert.equal(LEGACY_COUNTRY_CONFIGURATION.length, 10);
  assert.deepEqual(getLegacyCountryConfiguration(4), {
    countryCode: 4,
    countryName: "Honduras",
    companyName: "Farmacias del Ahorro",
    terminalId: 8,
    isActive: true,
    legacyFlagName: "honduras",
  });
  assert.deepEqual(getLegacyCountryConfiguration("7"), {
    countryCode: 7,
    countryName: "Costa Rica",
    companyName: "Farmavalue",
    terminalId: 10,
    isActive: true,
    legacyFlagName: "costarica",
  });
  assert.equal(getLegacyCountryConfiguration(1).legacyFlagName, null);
  assert.equal(getLegacyCountryConfiguration(10).legacyFlagName, null);
  assert.equal(getLegacyCountryConfiguration(99), null);
});
