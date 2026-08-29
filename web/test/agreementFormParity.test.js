import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AGREEMENT_FORM_CONTROL_KEYS,
  AGREEMENT_FORM_FEEDBACK,
  agreementToForm,
  legacyBranchLabel,
  recalculatePromissoryState,
  validateAgreementForm,
} from "../src/pages/agreementFormParity.js";

const validForm = Object.freeze({
  clientId: "9",
  accountManagerCode: "1379",
  branchIds: ["223"],
  creditDays: "30",
  creditLimit: "50000",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  promissoryState: "no",
  promissoryNoteExpirationDate: "",
  isIndefinite: false,
  isPromissoryNoteIndefinite: false,
});

test("scrRegistrarConvenio traza sus cuatro controles y feedback exacto del OML", () => {
  assert.equal(Object.keys(AGREEMENT_FORM_CONTROL_KEYS).length, 4);
  assert.deepEqual(AGREEMENT_FORM_FEEDBACK, {
    clientRequired: "Seleccione al Cliente del convenio.",
    managerRequired: "Seleccione al Gestor de la cuenta.",
    branchesRequired: "Seleccione al menos 1 sucursal que facture.",
    promissoryAttachmentRequired: "Afirmo que el cliente tiene pagare, porfavor agregar el archivo.",
    mandatoryFields: "Hay Campos obligatorios vacíos.",
    invalidDates: 'La "Fecha Final" debe ser mayor a la "Fecha Inicial".',
    queryFailure: "Error executing query.",
  });
  assert.equal(validateAgreementForm({ ...validForm, clientId: "" }, 0), AGREEMENT_FORM_FEEDBACK.clientRequired);
  assert.equal(validateAgreementForm({ ...validForm, accountManagerCode: "" }, 0), AGREEMENT_FORM_FEEDBACK.managerRequired);
  assert.equal(validateAgreementForm({ ...validForm, branchIds: [] }, 0), AGREEMENT_FORM_FEEDBACK.branchesRequired);
  assert.equal(validateAgreementForm({ ...validForm, promissoryState: "yes" }, 0), AGREEMENT_FORM_FEEDBACK.promissoryAttachmentRequired);
  assert.equal(validateAgreementForm({ ...validForm, startDate: "" }, 0), AGREEMENT_FORM_FEEDBACK.mandatoryFields);
  assert.equal(validateAgreementForm({ ...validForm, endDate: "2025-12-31" }, 0), AGREEMENT_FORM_FEEDBACK.invalidDates);
  assert.equal(validateAgreementForm(validForm, 0), "");
});

test("mapea edición, sucursal FA900 y cambio de vigencia del pagaré", () => {
  const form = agreementToForm({
    clientId: 10,
    accountManagerCode: "400",
    branchIds: [768],
    creditLimit: 50000,
    hasPromissoryNote: true,
    isPromissoryNoteExpired: true,
  });
  assert.equal(form.promissoryState, "expired");
  assert.deepEqual(form.branchIds, ["768"]);
  assert.equal(legacyBranchLabel({ internalCode: "FA900", branchName: "Administrativa" }), "Centralizadas");
  assert.equal(recalculatePromissoryState("yes", "2025-01-01", "2026-01-01"), "expired");
  assert.equal(recalculatePromissoryState("expired", "2027-01-01", "2026-01-01"), "yes");
});

test("la página usa estructura legacy, archivos diferidos y navegación create/update", async () => {
  const source = await readFile(new URL("../src/pages/AgreementFormPage.jsx", import.meta.url), "utf8");
  for (const text of [
    "Nuevo Convenio",
    "Editar Convenio",
    "Nombre del Cliente",
    "Gestor de Cuenta",
    "Días de Crédito",
    "Límite de Crédito",
    "¿Tiene Pagaré?",
    "Sucursales que Facturan",
    "Observación",
    "Seleccion un Cliente...",
    "Seleccion las Sucursales...",
  ]) assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /LEGACY_AGREEMENT_UPLOAD\.prompt/);
  assert.match(source, /LEGACY_AGREEMENT_UPLOAD\.browseText/);
  assert.match(source, /fa-file-pdf-o/);
  assert.match(source, /fa-check/);
  assert.match(source, /fa-trash/);
  assert.match(source, /removedAttachmentIds/);
  assert.match(source, /uploadFileToS3/);
  assert.match(source, /agreementId \? "Guardar" : "Crear convenio"/);
  assert.match(source, /ROUTES\.agreementDetail/);
  assert.doesNotMatch(source, /No se pudo cargar/);
  assert.doesNotMatch(source, /from "antd"|message\.success|Upload\.Dragger|DatePicker|InputNumber/);
});

test("geometría medida en 1280 por 720 queda fijada", async () => {
  const css = await readFile(new URL("../src/pages/AgreementFormPage.css", import.meta.url), "utf8");
  assert.match(css, /margin:\s*0 0 32px/);
  assert.match(css, /font-size:\s*32px/);
  assert.match(css, /padding:\s*24px/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /column-gap:\s*16px/);
  assert.match(css, /height:\s*40px/);
  assert.match(css, /height:\s*51\.1px/);
  assert.match(css, /height:\s*181\.6px/);
  assert.match(css, /height:\s*108\.6px/);
  assert.match(css, /height:\s*98\.6px/);
  assert.match(css, /margin-top:\s*50px/);
  assert.match(css, /#4d5c66/);
  assert.match(css, /#dee2e6/);
  assert.match(css, /#f1f3f5/);
  assert.match(css, /#6594ec/);
});
