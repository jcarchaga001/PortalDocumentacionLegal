import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBasePath } from "../src/config/runtime.js";

test("normalizeBasePath conserva una subruta valida", () => {
  assert.equal(normalizeBasePath("/NOMBRE_PROYECTO/"), "/NOMBRE_PROYECTO");
});

test("normalizeBasePath rechaza la raiz y rutas inseguras", () => {
  assert.throws(() => normalizeBasePath("/"), /subruta/);
  assert.throws(() => normalizeBasePath("portal"), /subruta/);
  assert.throws(() => normalizeBasePath("/portal\\interno"), /caracteres/);
});

