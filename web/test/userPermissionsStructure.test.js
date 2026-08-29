import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/pages/UserPermissionsPage.jsx", import.meta.url);
const feedbackPath = new URL("../src/components/LegacyErrorFeedback.jsx", import.meta.url);
const feedbackCssPath = new URL("../src/components/LegacyErrorFeedback.css", import.meta.url);

test("scrUsuariosPermisos usa lookup dedicado, tabla fija y no conecta el sorter huérfano", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, /getPermissionUserLookups/);
  assert.match(source, /data-screen="scrUsuariosPermisos"/);
  assert.match(source, /className="legacy-user-permissions-sorter"/);
  assert.doesNotMatch(source, /changeTable/);
  assert.doesNotMatch(source, /sortBy/);
  assert.match(source, /resetPage: false/);
  assert.match(source, /type: "info", message: action\.infoMessage/);
  assert.match(source, /USER_PERMISSION_SUCCESS/);
});

test("feedback compartido admite la secuencia Info y Success con colorimetría legacy", async () => {
  const [source, css] = await Promise.all([
    readFile(feedbackPath, "utf8"),
    readFile(feedbackCssPath, "utf8"),
  ]);
  assert.match(source, /info: \{ icon: "fa-info-circle"/);
  assert.match(source, /success: \{ icon: "fa-check-circle"/);
  assert.match(css, /feedback-message-info[\s\S]*#017aad/);
  assert.match(css, /feedback-message-success[\s\S]*#29823b/);
});
