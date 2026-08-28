import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_LOGIN_COUNTRIES_QUERY,
  createCountryRepository,
} from "../src/repositories/countryRepository.js";

test("GetPaises replica el filtro, orden y limite legacy sin leer Bandera", async () => {
  const calls = [];
  const expected = [{ countryCode: 4, name: "Honduras" }];
  const repository = createCountryRepository({
    async execute(sql, parameters) {
      calls.push({ sql, parameters });
      return [expected, []];
    },
  });

  assert.deepEqual(await repository.listActiveLoginCountries(), expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, ACTIVE_LOGIN_COUNTRIES_QUERY);
  assert.equal(calls[0].parameters, undefined);
  assert.match(calls[0].sql, /FROM tblPaises/);
  assert.match(calls[0].sql, /WHERE isActivo = 1\s+AND Codigo_Pais = 4/);
  assert.match(calls[0].sql, /ORDER BY Nombre_Pais\s+LIMIT 50/);
  assert.doesNotMatch(calls[0].sql, /Bandera/i);
});
