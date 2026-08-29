import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../src/pages/CorporateClientBulkPage.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/pages/CorporateClientBulkPage.css", import.meta.url), "utf8");

test("pantalla elimina componentes y feedback agregados que no existen en el legacy", () => {
  assert.doesNotMatch(page, /from "antd"|@ant-design\/icons|<Table|<Upload|message\.(success|warning)/);
  assert.doesNotMatch(page, /clientes procesados|Seleccione un archivo con clientes|archivo no contiene clientes/);
  assert.match(page, /data-screen="scrCargaMasivaClientesCorp"/);
  assert.match(page, /type="file" accept=""/);
  assert.match(page, /Volver al listado/);
  assert.match(page, /Descargar Plantilla/);
});

test("geometría estática conserva medidas y colores observados a 1280 por 720", () => {
  assert.match(css, /height:54\.6px/);
  assert.match(css, /margin-top:30px/);
  assert.match(css, /height:48px/);
  assert.match(css, /background:#444/);
  assert.match(css, /background-color:#ecdada/);
  assert.match(css, /border-radius:4px/);
});
