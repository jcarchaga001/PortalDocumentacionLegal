import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/pages/InvalidPermissionsPage.jsx", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../src/styles/app.css", import.meta.url), "utf8");

test("InvalidPermissions conserva la composición e iconografía exactas de BlankSlate", () => {
  assert.match(pageSource, /legacy-invalid-permissions-header-content/);
  assert.match(pageSource, /brand\/logo\.png/);
  assert.match(pageSource, />DocumentacionLegal</);
  assert.match(pageSource, /ROUTES\.branchMonitoring/);
  assert.match(pageSource, /blank-slate large/);
  assert.match(pageSource, /fa-exclamation-triangle fa-1x/);
  assert.match(pageSource, /No tiene permisos para ingresar a esta pantalla\./);
  assert.match(pageSource, /Contacte su administrador\./);
  assert.match(pageSource, /fa-angle-left fa-1x/);
  assert.match(pageSource, />Regresar</);
  assert.match(pageSource, /history\.goBack\(\)/);
  assert.doesNotMatch(pageSource, /window\.history\.length/);
});

test("los dos controles conservan sus condiciones y destinos publicados", () => {
  assert.match(pageSource, /!loading && !user/);
  assert.match(pageSource, /btn btn-primary margin-left-m/);
  assert.match(pageSource, />\s*Ingresar\s*</);
  assert.match(pageSource, /history\.push\(ROUTES\.login\)/);
});

test("InvalidPermissions usa los tokens medidos del tema legacy", () => {
  assert.match(styleSource, /\.legacy-invalid-permissions-header \{[\s\S]*?height: 56px;[\s\S]*?background: #444;/);
  assert.match(styleSource, /\.legacy-invalid-permissions-header-content \{[\s\S]*?height: 56px;[\s\S]*?padding: 0 max\(40px,/);
  assert.match(styleSource, /\.legacy-invalid-permissions-page \{[\s\S]*?background: #f3f6f8;/);
  assert.match(styleSource, /\.legacy-invalid-permissions-main \{[\s\S]*?padding: 40px max\(40px,/);
  assert.match(styleSource, /\.legacy-invalid-permissions \.blank-slate-icon \{[\s\S]*?color: #dee2e6;[\s\S]*?font-size: 120px;[\s\S]*?line-height: 1\.5;/);
  assert.match(styleSource, /\.legacy-invalid-permissions \.heading6 \{[\s\S]*?font-size: 18px;[\s\S]*?font-weight: 600;/);
  assert.match(styleSource, /\.legacy-invalid-permissions \.btn \{[\s\S]*?height: 40px;[\s\S]*?border-radius: 4px;[\s\S]*?background: #fff;[\s\S]*?color: #4d5c66;/);
});
