import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const pageSource = fs.readFileSync(path.join(testDirectory, "../src/pages/AgreementsPage.jsx"), "utf8");
const styleSource = fs.readFileSync(path.join(testDirectory, "../src/pages/AgreementsPage.css"), "utf8");

test("scrConvenios usa iconografia, navegacion, feedback y exportacion de la pagina actual", () => {
  assert.match(pageSource, /fa-file-excel-o/);
  assert.match(pageSource, /Descargar archivo Excel/);
  assert.match(pageSource, /fa-external-link/);
  assert.match(pageSource, /title="Ver Detalle"/);
  assert.match(pageSource, /Nuevo Convenio/);
  assert.match(pageSource, /LegacyErrorFeedback/);
  assert.match(pageSource, /rows: exportRows\(rows\)/);
  assert.doesNotMatch(pageSource, /getAgreementCatalogs/);
  assert.doesNotMatch(pageSource, /<Table/);
});

test("NullDates conserva el defecto OML: limpia control sin refrescar ni borrar filtros aplicados", () => {
  const clearBody = pageSource.match(/function clearVisibleDateRange\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(clearBody, /pickerRef\.current\?\.clear\(\)/);
  assert.match(clearBody, /setVisibleDateRange\(EMPTY_RANGE\)/);
  assert.doesNotMatch(clearBody, /setAppliedDateRange/);
  assert.doesNotMatch(clearBody, /load\(/);
});

test("geometria y colorimetria medidas quedan fijadas", () => {
  assert.match(styleSource, /width: 1454\.325px/);
  assert.match(styleSource, /height: 63\.8px/);
  assert.match(styleSource, /background: #444/);
  assert.match(styleSource, /background: #f7cdcd/);
  assert.match(styleSource, /background: #fbd999/);
  assert.match(styleSource, /color: #08a93e/);
  assert.match(styleSource, /grid-template-columns: 362\.5px 362\.6px 177\.7px/);
});
