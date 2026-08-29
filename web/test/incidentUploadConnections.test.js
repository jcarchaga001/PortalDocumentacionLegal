import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("los Upload de incidentes validan la extensión antes de aceptar el archivo", () => {
  const actionList = source("../src/pages/IncidentActionsPage.jsx");
  const detail = source("../src/pages/IncidentDetailPage.jsx");
  const registration = source("../src/pages/IncidentRegistrationPage.jsx");
  const laborDetail = source("../src/pages/LaborCaseDetailPage.jsx");

  for (const page of [actionList, detail, laborDetail]) {
    assert.match(page, /validateLegacyIncidentFileName/);
    assert.doesNotMatch(page, /beforeUpload=\{\(\) => false\}/);
    assert.match(page, /message\.error\(validation\.message\)/);
  }

  assert.match(registration, /validateLegacyIncidentFileName/);
  assert.doesNotMatch(registration, /beforeUpload=\{\(\) => false\}/);
  assert.match(registration, /setError\(validation\.message\)/);
  assert.match(registration, /LegacyErrorFeedback/);

  assert.match(actionList, /beforeUpload=\{acceptEvidenceFile\}/);
  assert.match(detail, /beforeUpload=\{acceptActionEvidence\}/);
  assert.match(registration, /beforeUpload=\{acceptEvidenceFile\}/);
  assert.match(laborDetail, /legal: true/);
});

test("Mis Acciones Laborales conserva Accept vacío y valida por el contrato compartido", () => {
  const page = source("../src/pages/LaborActionsPage.jsx");
  const parity = source("../src/pages/laborActionsParity.js");

  assert.doesNotMatch(page, /accept="\.png,\.jpeg,\.jpg,\.pdf"/);
  assert.match(page, /beforeUpload=\{acceptEvidence\}/);
  assert.match(parity, /validateLegacyIncidentFileName\(fileName\)\.valid/);
});

test("los comentarios de incidentes conectan Upload opcional, S3 y CodAdjuntoS3 del API", () => {
  const page = source("../src/pages/IncidentDetailPage.jsx");

  assert.match(page, /validateLegacyIncidentCommentFileName\(file\?\.name\)/);
  assert.match(page, /beforeUpload=\{acceptCommentAttachment\}/);
  assert.match(page, /commentFile\?\.name \|\| "Adjuntar Archivo"/);
  assert.match(page, /purpose: "incident-comment"/);
  assert.match(page, /addIncidentComment\(request\.scope, request\.incidentId, \{/);
  assert.match(page, /\.\.\.attachment/);
  assert.match(page, /item\.s3Key \? \[/);
  assert.match(page, /downloadEvidence\(item\.s3Key, item\.fileName\)/);
  assert.doesNotMatch(page, /accept="/);
});

test("los comentarios legales current y OLD comparten el Upload legal sin fusionar superficies", () => {
  const page = source("../src/pages/LaborCaseDetailPage.jsx");
  const surface = source("../src/pages/laborCaseSurface.js");

  assert.match(page, /validateLegacyIncidentCommentFileName\(file\?\.name, \{ legal: true \}\)/);
  assert.match(page, /beforeUpload=\{acceptCommentAttachment\}/);
  assert.match(page, /commentFile\?\.name \|\| "Adjunte Archivo"/);
  assert.match(page, /purpose: "labor-comment"/);
  assert.match(page, /surface: surface\.sourceName/);
  assert.match(page, /addLaborComment\(request\.caseId, \{/);
  assert.match(page, /downloadEvidence\(item\.s3Key, item\.fileName\)/);
  assert.match(surface, /sourceName: "srcAccionesIncidentesLegal"/);
  assert.match(surface, /sourceName: "srcAccionesIncidentesLegal_OLD"/);
  assert.doesNotMatch(page, /accept="/);
});
