import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/pages/ExpiringDocumentsPage.jsx", import.meta.url);

test("scrProximosVencer usa la iconografia y exportacion simple observadas", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /fa-file-excel-o/);
  assert.match(source, /fa-file-image-o/);
  assert.match(source, /fa-envelope-o/);
  assert.match(source, /legacyPlain: true/);
  assert.match(source, /hasExpiringAttachmentAction\(record\)/);
  assert.doesNotMatch(source, /message\.success\(/);
});
