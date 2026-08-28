import assert from "node:assert/strict";
import test from "node:test";
import { getCountryMetadata } from "../src/config/countryMetadata.js";

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
