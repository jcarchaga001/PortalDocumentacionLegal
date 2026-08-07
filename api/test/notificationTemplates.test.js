import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_EMAIL_TEMPLATE_NAMES,
  formatLegacyEmailDate,
  listLegacyEmailTemplates,
  renderLegacyEmail,
} from "../src/services/legacyEmailTemplates.js";

const EXPECTED_TEMPLATES = [
  "emNotiAccionLegal",
  "emNotiAccionCasosLaborales",
  "emNotiAccionComentario",
  "emNotificacionAreaLegal",
  "emNotiAccionConveniosAVencer",
  "emNotificacionLegal",
  "emNotiincidente",
  "emNotificacionRRHH",
  "emNotiAccion",
  "emNotificacionLegalVencido",
];

test("registra exactamente las diez pantallas de correo del OML", () => {
  assert.deepEqual(LEGACY_EMAIL_TEMPLATE_NAMES, EXPECTED_TEMPLATES);
  assert.equal(listLegacyEmailTemplates().length, 10);
});

test("las diez plantillas generan asunto, texto y HTML", () => {
  for (const name of EXPECTED_TEMPLATES) {
    const rendered = renderLegacyEmail(name, {
      companyName: "Farmacias del Ahorro",
      assignedBy: "Usuario uno",
      assignedUser: "Usuario dos",
      action: "Revisar expediente",
      branchName: "Sucursal Centro",
      startDate: "2026-08-06",
      closeDate: "2026-08-07",
      caseReference: "CL-102",
      documentName: "Contrato",
      documentReference: "DOC-10",
      contractNumber: "CT-20",
      belongsTo: "Sucursal Centro",
      dueDate: "2026-09-01",
      documentType: 1,
      documents: [],
      agreements: [],
    });
    assert.equal(rendered.template, name);
    assert.ok(rendered.subject.length > 5, name);
    assert.ok(rendered.text.length > 10, name);
    assert.match(rendered.html, /<!doctype html>/i, name);
  }
});

test("conserva el formato de fecha dd/MMM/yyyy observado en los correos legacy", () => {
  assert.equal(formatLegacyEmailDate("2026-08-06"), "06/ago/2026");
});

test("escapa datos dinámicos y conserva las columnas de los resúmenes", () => {
  const rendered = renderLegacyEmail("emNotificacionAreaLegal", {
    companyName: "Farmacias del Ahorro",
    documents: [{
      branch: "FA01 - Centro <script>alert(1)</script>",
      category: "Licencias",
      subcategory: "Permiso",
      documentCode: "DOC-1",
      documentReference: "CT-1",
      dueDate: "2026-08-09",
      status: "Por Vencer",
    }],
  });

  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(rendered.html, /Fecha Vencimiento/);
  assert.match(rendered.text, /Sucursal \| Categoría \| Subcategoría \| Documento \| Referencia/);
});

test("rechaza nombres de plantilla inventados", () => {
  assert.throws(
    () => renderLegacyEmail("emInventado", {}),
    (error) => error.code === "VALIDATION_ERROR" && error.field === "template",
  );
});
