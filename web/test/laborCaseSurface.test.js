import assert from "node:assert/strict";
import test from "node:test";
import { getLaborCaseSurface, LABOR_CASE_SURFACES } from "../src/pages/laborCaseSurface.js";

test("mantiene separadas las fuentes y funciones exclusivas del detalle laboral vigente", () => {
  const current = getLaborCaseSurface(false);

  assert.equal(current.sourceName, "srcAccionesIncidentesLegal");
  assert.equal(current.catalogScope, "labor-actions");
  assert.deepEqual(current.dataSources, ["GetChatByCaso", "GetPersonasAcciones", "GetPersonasLegal"]);
  assert.deepEqual(current.currentOnlyClientActions, [
    "AceptarCambioEstadoOnClick",
    "GetPersonasAccionesOnAfterFetch",
    "CerrarPopupJustificacionOnClick",
    "CancelarCasoOnClick",
  ]);
  assert.equal(current.showCaseThread, true);
  assert.equal(current.allowPendingInformation, true);
});

test("la ruta OLD no hereda fuentes ni funciones exclusivas de la pantalla vigente", () => {
  const legacy = getLaborCaseSurface(true);

  assert.equal(legacy, LABOR_CASE_SURFACES.legacy);
  assert.equal(legacy.sourceName, "srcAccionesIncidentesLegal_OLD");
  assert.equal(legacy.catalogScope, "labor-actions-legacy");
  assert.deepEqual(legacy.dataSources, ["GetResponsables", "GetPersonasReasignar"]);
  assert.deepEqual(legacy.currentOnlyClientActions, []);
  assert.equal(legacy.showRegistrationDate, false);
  assert.equal(legacy.showResponsibleEditor, false);
  assert.equal(legacy.showCaseThread, false);
  assert.equal(legacy.allowPendingInformation, false);
});
