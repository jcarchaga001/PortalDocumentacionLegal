import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CORPORATE_CLIENT_CONTACT_COLUMNS,
  CORPORATE_CLIENT_CONTACTS_EMPTY_TEXT,
  CORPORATE_CLIENT_CONTACTS_MAX_RECORDS,
} from "../src/pages/corporateClientContactsParity.js";

const blockUrl = new URL("../src/pages/CorporateClientContactsBlock.jsx", import.meta.url);
const pageUrl = new URL("../src/pages/CorporateClientsPage.jsx", import.meta.url);
const cssUrl = new URL("../src/pages/CorporateClientsPage.css", import.meta.url);
const serviceUrl = new URL("../src/services/corporateClientService.js", import.meta.url);

test("blkContactosClienteCorp conserva el Aggregate y los textos exactos del OML/runtime", () => {
  assert.equal(CORPORATE_CLIENT_CONTACTS_MAX_RECORDS, 500);
  assert.equal(CORPORATE_CLIENT_CONTACTS_EMPTY_TEXT, "No hay contactos...");
  assert.deepEqual(
    CORPORATE_CLIENT_CONTACT_COLUMNS.map(({ key, label }) => [key, label]),
    [
      ["name", "Nombre"],
      ["position", "Puesto"],
      ["phone", "Teléfono"],
      ["email", "Correo"],
    ],
  );
});

test("el bloque refresca al cambiar CodClienteCorp, mantiene encabezado en loading/vacío y no agrega sort inventado", async () => {
  const source = await readFile(blockUrl, "utf8");

  assert.match(source, /getCorporateClientContacts\(clientId\)/);
  assert.match(source, /\[clientId, onQueryError\]/);
  assert.match(source, /className="sortable" tabIndex=\{0\}/);
  assert.match(source, /corporate-client-contacts-sortable-icon/);
  assert.match(source, /<table[\s\S]*<thead>[\s\S]*!loading && contacts\.length > 0/);
  assert.match(source, /CORPORATE_CLIENT_CONTACTS_EMPTY_TEXT/);
  assert.match(source, /onQueryError\(\)/);
  assert.doesNotMatch(source, /onClick=.*sort/i);
});

test("cada ExpandableTableRow conserva estado independiente y consulta el endpoint de solo lectura", async () => {
  const [page, service] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(serviceUrl, "utf8"),
  ]);

  assert.match(page, /new Set\(\)/);
  assert.match(page, /const next = new Set\(current\)/);
  assert.match(page, /expandedClientIds\.has\(client\.id\)/);
  assert.match(page, /CorporateClientContactsBlock clientId=\{client\.id\}/);
  assert.doesNotMatch(page, /contactsByClient/);
  assert.match(service, /\/corporate-clients\/\$\{id\}\/contacts/);
});

test("la geometría del bloque replica header, fila, empty y spinner del tema legacy", async () => {
  const css = await readFile(cssUrl, "utf8");

  assert.match(css, /\.corporate-clients-expanded-row > td[\s\S]*padding: 8px 24px/);
  assert.match(css, /\.corporate-client-contacts-table[\s\S]*table-layout: auto/);
  assert.match(css, /\.corporate-client-contacts-header-row th[\s\S]*height: 48px/);
  assert.match(css, /background: #444/);
  assert.match(css, /color: #f3f6f8/);
  assert.match(css, /\.corporate-client-contacts-row td[\s\S]*height: 56px/);
  assert.match(css, /\.corporate-client-contacts-empty[\s\S]*height: 21px/);
  assert.match(css, /\.corporate-client-contacts-loading[\s\S]*height: 40px[\s\S]*margin-top: 16px/);
});
