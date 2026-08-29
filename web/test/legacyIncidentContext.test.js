import assert from "node:assert/strict";
import test from "node:test";
import {
  legacyIncidentDetailHref,
  readLegacyIncidentDetailRequest,
} from "../src/config/legacyIncidentContext.js";

test("la URL pública conserva solo CodIncidente y codigoSucursal", () => {
  assert.equal(
    legacyIncidentDetailHref("/DocumentacionLegal", "scrAccionesIncidentes", 327, 223),
    "/DocumentacionLegal/scrAccionesIncidentes?CodIncidente=327&codigoSucursal=223",
  );
  assert.doesNotMatch(legacyIncidentDetailHref("", "scrAccionesIncidentes", 1, 2), /scope=/);
});

test("el detalle usa la única superficie externa sin estado scope público o de sesión", () => {
  assert.deepEqual(readLegacyIncidentDetailRequest("?CodIncidente=327&codigoSucursal=223"), {
    incidentId: 327,
    branchId: 223,
    scope: "external",
  });
});
