import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("las dos superficies conservan filtros, columnas, menú y footer del MVC", () => {
  const page = source("../src/pages/IncidentActionsPage.jsx");

  for (const text of [
    "Regresar pantalla anterior...",
    "Sucursal",
    "Fecha Inicio",
    "Responsable",
    "Estado",
    "Buscar Referencia",
    "Fecha Vencimiento",
    "Nombre Acción",
    "Descripción",
    "Incidente",
    "Fecha Probable",
    "Opciones de Acción",
  ]) {
    assert.match(page, new RegExp(text));
  }
  assert.match(page, /pagination=\{false\}/);
  assert.match(page, /tableLayout="fixed"/);
  assert.match(page, /legacyIncidentActionFooterText/);
  assert.match(page, /fa fa-long-arrow-left/);
  assert.match(page, /fa fa-ellipsis-v/);
  assert.match(page, /legacyIncidentDetailHref/);
  assert.doesNotMatch(page, /[?&]scope=/);
});

test("la geometría de acciones queda aislada de las demás pantallas de incidentes", () => {
  const css = source("../src/pages/IncidentActionsPage.css");

  assert.match(css, /\.legacy-action-page \{/);
  assert.match(css, /width: min\(1500px, 100%\)/);
  assert.match(css, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /width: 600px/);
  assert.match(css, /height: 48px/);
  assert.match(css, /height: 100px/);
  assert.match(css, /\.legacy-action-overflow-menu/);
});
