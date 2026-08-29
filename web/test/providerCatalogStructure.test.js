import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const providerPagePath = new URL("../src/pages/ProviderCatalogPage.jsx", import.meta.url);

test("scrCatalogoProveedores conserva el evento legacy del lapiz de sucursal interna", async () => {
  const source = await readFile(providerPagePath, "utf8");

  assert.match(source, /aria-label="Editar sucursal interna"/);
  assert.match(source, /onClick=\{\(\) => setLegacyInternalBranchEditRequested\(true\)\}/);
  assert.doesNotMatch(source, /setLegacyInternalBranchEditRequested\(false\)/);
});
