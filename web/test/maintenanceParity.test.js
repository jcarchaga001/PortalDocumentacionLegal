import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAINTENANCE_ASSETS,
  MAINTENANCE_BROWSER_TITLE,
  MAINTENANCE_HEADING,
  maintenanceTextFromSearch,
} from "../src/pages/maintenanceParity.js";

test("Mantenimiento conserva el parametro serializable exacto, incluidos espacios", () => {
  assert.equal(maintenanceTextFromSearch(""), "");
  assert.equal(maintenanceTextFromSearch("?MantenimientoText=MENSAJE"), "MENSAJE");
  assert.equal(maintenanceTextFromSearch("?MantenimientoText=%20%20MENSAJE%20%20"), "  MENSAJE  ");
  assert.equal(maintenanceTextFromSearch("?otro=valor"), "");
});

test("Mantenimiento conserva textos, titulo y assets del runtime legacy", () => {
  assert.equal(MAINTENANCE_BROWSER_TITLE, "Portal Documentación Legal");
  assert.equal(MAINTENANCE_HEADING, "Seguimiento a Farmacias");
  assert.deepEqual(MAINTENANCE_ASSETS, {
    logo: "/brand/logo-white.png",
    illustration: "/brand/maintenance.png",
  });
});

test("los dos PNG son binariamente identicos a los assets observados en legacy", async () => {
  const [logo, illustration] = await Promise.all([
    readFile(new URL("../public/brand/logo-white.png", import.meta.url)),
    readFile(new URL("../public/brand/maintenance.png", import.meta.url)),
  ]);

  assert.equal(createHash("sha256").update(logo).digest("hex"), "640f3014149fab66e5e40cc648512d1f0e7c969a4e82a724f9dbdf785011e75a");
  assert.equal(createHash("sha256").update(illustration).digest("hex"), "6afa03ec12564e393d3f01efe18d98bb10f1f5fb863ad91133fe44bf9cb942ab");
});

test("Mantenimiento permanece publico y no inventa Site Properties, API ni acciones", async () => {
  const [routes, page] = await Promise.all([
    readFile(new URL("../src/routes/AppRoutes.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/MaintenancePage.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(routes, /<Route path=\{ROUTES\.maintenance\} exact component=\{MaintenancePage\} \/>/);
  assert.doesNotMatch(page, /ProtectedRoute|useAuth|apiFetch|fetch\(|isMantenimiento|SitePropert/);
  assert.match(page, /maintenanceTextFromSearch\(location\.search\)/);
});

test("Mantenimiento conserva la geometria y colorimetria medidas a 1280 por 720", async () => {
  const css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");
  const maintenanceCss = css.slice(css.indexOf(".legacy-maintenance-page"), css.indexOf(".legacy-landing-page"));

  assert.match(maintenanceCss, /background: #f3f6f8/);
  assert.match(maintenanceCss, /background: #a4a4a4/);
  assert.match(maintenanceCss, /width: 15%/);
  assert.match(maintenanceCss, /width: 49%/);
  assert.match(maintenanceCss, /height: 20px/);
  assert.match(maintenanceCss, /height: 48px/);
  assert.match(maintenanceCss, /font-size: 32px/);
  assert.match(maintenanceCss, /line-height: 48px/);
  assert.match(maintenanceCss, /width: 83%/);
  assert.doesNotMatch(maintenanceCss, /#f4f8fb|83\.3333%|margin: 0 0 10px/);
});
