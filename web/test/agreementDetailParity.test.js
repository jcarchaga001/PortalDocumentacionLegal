import assert from "node:assert/strict";
import test from "node:test";
import {
  AGREEMENT_DETAIL_CONTROL_CHAIN,
  AGREEMENT_DETAIL_QUERY_ERROR,
  agreementIdFromSearch,
  isLegacyAgreementPreviewable,
  legacyAgreementAuditText,
  legacyAgreementBranchLabel,
  legacyAgreementCreditLimit,
  legacyAgreementEndDate,
  legacyAgreementPromissoryText,
} from "../src/pages/agreementDetailParity.js";

test("scrConvenioDetalle conserva sus cinco controles y el feedback legacy", () => {
  assert.equal(Object.keys(AGREEMENT_DETAIL_CONTROL_CHAIN).length, 5);
  assert.deepEqual(Object.values(AGREEMENT_DETAIL_CONTROL_CHAIN), [
    "VolverOnClick", "EditarOnClick", "VerClienteOnClick", "VerOnClick", "DescargarArchivoOnClick",
  ]);
  assert.equal(AGREEMENT_DETAIL_QUERY_ERROR, "Error executing query.");
  assert.equal(agreementIdFromSearch("?CodConvenio=14"), 14);
  assert.equal(agreementIdFromSearch("?CodConvenio=0"), null);
});

test("visibilidad del visor conserva la comparación exacta y sensible a mayúsculas del OML", () => {
  assert.equal(isLegacyAgreementPreviewable(".pdf"), true);
  assert.equal(isLegacyAgreementPreviewable(".jpeg"), true);
  assert.equal(isLegacyAgreementPreviewable(".jpg"), true);
  assert.equal(isLegacyAgreementPreviewable(".png"), true);
  assert.equal(isLegacyAgreementPreviewable(".PDF"), false);
  assert.equal(isLegacyAgreementPreviewable("pdf"), false);
});

test("textos y defectos de formato observados quedan fijados", () => {
  assert.equal(legacyAgreementBranchLabel("FA900 - Central"), "Centralizadas");
  assert.equal(legacyAgreementEndDate({ isIndefinite: true, endDate: "2026-01-01" }), "Indefinido");
  assert.equal(legacyAgreementCreditLimit({ creditLimit: 50000, isDollar: false }), "50,000.00");
  assert.equal(legacyAgreementCreditLimit({ creditLimit: 50000, isDollar: true }), "US $ 50,000.00");
  assert.equal(legacyAgreementPromissoryText({ hasPromissoryNote: true, promissoryNoteExpirationDate: "2026-09-01" }), "Sí tiene, vence el 2026-09-01");
  assert.equal(legacyAgreementPromissoryText({ isPromissoryNoteExpired: true, promissoryNoteExpirationDate: "2026-08-01" }), "Esta Vencido desde 2026-08-01");
  assert.equal(legacyAgreementPromissoryText({}), "No tiene");
  assert.equal(legacyAgreementAuditText({ createdDate: "2025-05-20", createdTime: "14:48:22", createdByName: "Gabriela" }), "Creado el: 2025-05-20 14:48:22 por: Gabriela");
});
