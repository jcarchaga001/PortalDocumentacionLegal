import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INCIDENT_STATUS_COLORS,
  incidentStatusColor,
} from "../src/pages/incidentStatusParity.js";

test("En Ejecución usa el verde legacy exacto sin alterar los demás estados", () => {
  assert.equal(incidentStatusColor(2), "#37b24d");
  assert.deepEqual(INCIDENT_STATUS_COLORS, {
    1: "blue",
    2: "#37b24d",
    4: "gold",
    5: "green",
    6: "red",
    7: "red",
    8: "gold",
    10: "purple",
  });
  assert.equal(incidentStatusColor(999), "default");
});

test("listas y detalle comparten rgb 55 178 77 para estado dos", async () => {
  const css = await readFile(new URL("../src/styles/incidents.css", import.meta.url), "utf8");
  assert.match(css, /legacy-incident-list-status\.is-progress\s*\{\s*background:\s*#37b24d/);
  assert.match(css, /legacy-incident-list-metric > i\.is-progress\s*\{\s*color:\s*#37b24d/);
  assert.match(css, /legacy-incident-metric-icon\.is-progress\s*\{\s*color:\s*#37b24d/);
});
