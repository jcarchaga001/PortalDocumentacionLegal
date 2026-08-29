import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  INCIDENT_REGISTRATION_QUERY_CONTRACT,
  INCIDENT_REGISTRATION_SURFACES,
} from "../src/pages/incidentRegistrationParity.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = (relative) => fs.readFileSync(path.join(directory, relative), "utf8");
const pageSource = source("../src/pages/IncidentRegistrationPage.jsx");
const cssSource = source("../src/styles/incidents.css");
const routeSource = source("../src/routes/AppRoutes.jsx");

test("altas interna y externa conservan contratos OML independientes", () => {
  const internal = INCIDENT_REGISTRATION_SURFACES.internal;
  const external = INCIDENT_REGISTRATION_SURFACES.external;
  assert.equal(internal.sourceName, "scrRegistroIncidentesInternos");
  assert.equal(external.sourceName, "scrRegistroIncicentesExternos");
  assert.equal(internal.role, "Registered");
  assert.equal(external.role, "Registered");
  assert.equal(internal.controls.length, 2);
  assert.equal(external.controls.length, 2);
  assert.equal(internal.clientActions.length, 5);
  assert.equal(external.clientActions.length, 5);
  assert.deepEqual(new Set(internal.dataSources), new Set([
    "GetTipo", "GetSucursales", "GetEnte", "GetPersonas", "GetEnteSeleccionado",
  ]));
  assert.deepEqual(new Set(external.dataSources), new Set(internal.dataSources));
  assert.equal(internal.agencyLabel, "Area");
  assert.equal(external.agencyLabel, "Ente Gubernamental");
});

test("ambas rutas montan el renderer con su contrato y conservan el typo legacy", () => {
  assert.match(routeSource, /internalIncidentCreate.*InternalIncidentRegistrationPage/);
  assert.match(routeSource, /externalIncidentCreate.*ExternalIncidentRegistrationPage/);
  assert.match(pageSource, /INCIDENT_REGISTRATION_SURFACES\.internal/);
  assert.match(pageSource, /INCIDENT_REGISTRATION_SURFACES\.external/);
  assert.match(pageSource, /data-incident-registration-surface/);
});

test("formulario replica columnas, iconos, preview vacío y navegación legacy", () => {
  assert.match(pageSource, /fa fa-arrow-left/);
  assert.match(pageSource, /fa fa-paperclip/);
  assert.match(pageSource, /legacy-incident-registration-columns/);
  assert.match(pageSource, /surface\.emptyPreview/);
  assert.match(pageSource, /showUploadList=\{false\}/);
  assert.match(pageSource, /history\.replace\(ROUTES\.externalIncidents\)/);
  assert.doesNotMatch(pageSource, /Incidente registrado correctamente/);
  assert.match(pageSource, /onFinishFailed=\{\(\) => setError\(surface\.incompleteFeedback\)\}/);
});

test("geometría medida y consultas canónicas quedan fijadas", () => {
  assert.equal(INCIDENT_REGISTRATION_SURFACES.internal.form.width, 584.4);
  assert.equal(INCIDENT_REGISTRATION_SURFACES.external.form.height, 739.3);
  assert.equal(INCIDENT_REGISTRATION_SURFACES.external.incompleteFeedback, "Completar todos los campos");
  assert.match(cssSource, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(cssSource, /padding: 24px/);
  assert.match(cssSource, /border: 1px solid #dee2e6/);
  assert.ok(INCIDENT_REGISTRATION_QUERY_CONTRACT.GetPersonas.includes("MaxRecords=50"));
  assert.ok(INCIDENT_REGISTRATION_QUERY_CONTRACT.GetEnteSeleccionado.some((item) => item.includes("codigoResponsable")));
});
