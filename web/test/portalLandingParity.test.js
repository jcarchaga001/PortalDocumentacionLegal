import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/pages/PortalLandingPage.jsx", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../src/styles/app.css", import.meta.url), "utf8");

test("scrPantallaPrincipal usa la iconografía Font Awesome observada", () => {
  for (const icon of [
    "fa-home",
    "fa-area-chart",
    "fa-newspaper-o",
    "fa-folder-open",
    "fa-pie-chart",
    "fa-cog",
    "fa-exclamation-triangle",
    "fa-user-secret",
  ]) {
    assert.match(pageSource, new RegExp(`\\b${icon}\\b`));
  }
  assert.doesNotMatch(pageSource, /@ant-design\/icons/);
  assert.match(pageSource, /btn btn-primary OSFillParent legacy-shortcut/);
});

test("scrPantallaPrincipal conserva la grilla legacy 2/3 + 1/3 y tarjetas de 200px", () => {
  assert.match(styleSource, /\.legacy-landing-welcome \{[\s\S]*?display: flex;[\s\S]*?align-items: center;[\s\S]*?margin-bottom: 32px;/);
  assert.match(styleSource, /\.legacy-landing-avatar \{[\s\S]*?width: 40px;[\s\S]*?height: 40px;[\s\S]*?background: #4d5c66;/);
  assert.match(styleSource, /\.legacy-shortcut-layout \{[\s\S]*?grid-template-columns: 2fr 1fr;[\s\S]*?column-gap: 16px;/);
  assert.match(styleSource, /\.legacy-shortcut-grid \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?row-gap: 20px;/);
  assert.match(styleSource, /\.legacy-shortcut \{[\s\S]*?height: 200px;[\s\S]*?background: #4d5c66;/);
  assert.match(styleSource, /\.legacy-shortcut-secondary \.legacy-shortcut \{[\s\S]*?width: calc\(\(100% - 16px\) \/ 2\);[\s\S]*?background: #114978;/);
});

test("scrPantallaPrincipal conserva el feedback En desarrollo para las cuatro acciones NotImplemented", () => {
  assert.match(pageSource, /message\.info\("En desarrollo"\)/);
});
