import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const matrixPath = new URL("../../docs/DOCUMENTACIONLEGAL_PARITY_MATRIX.md", import.meta.url);

function sectionLines(source, startHeading, endHeading) {
  const start = source.indexOf(startHeading);
  const end = source.indexOf(endHeading, start + startHeading.length);
  assert.notEqual(start, -1, `No se encontró ${startHeading}`);
  assert.notEqual(end, -1, `No se encontró ${endHeading}`);
  return source.slice(start, end).split(/\r?\n/);
}

test("la matriz conserva las 90 superficies canónicas", async () => {
  const source = await readFile(matrixPath, "utf8");
  const surfaces = sectionLines(
    source,
    "## Inventario de 90 superficies",
    "## Matriz de 340 controles e interacciones",
  ).filter((line) => /^\| \d+ \| (Screen|Block|Email) \|/.test(line));

  assert.equal(surfaces.length, 90);
  assert.equal(surfaces.filter((line) => line.includes("| Screen |")).length, 37);
  assert.equal(surfaces.filter((line) => line.includes("| Block |")).length, 43);
  assert.equal(surfaces.filter((line) => line.includes("| Email |")).length, 10);
});

test("la matriz conserva 340 controles con 19 columnas", async () => {
  const source = await readFile(matrixPath, "utf8");
  const controls = sectionLines(
    source,
    "## Matriz de 340 controles e interacciones",
    "## Criterio de cierre",
  ).filter((line) => /^\| \d+ \|/.test(line));

  assert.equal(controls.length, 340);
  assert.deepEqual(
    controls.map((line) => Number(line.match(/^\| (\d+) \|/)[1])),
    Array.from({ length: 340 }, (_, index) => index + 1),
  );
  for (const line of controls) {
    assert.equal((line.match(/\|/g) || []).length, 20, line);
  }
});
