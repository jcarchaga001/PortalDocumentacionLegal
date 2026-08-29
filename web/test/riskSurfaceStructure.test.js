import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const historyPath = new URL("../src/pages/RiskHistoryPage.jsx", import.meta.url);
const detailPath = new URL("../src/pages/RiskDetailPage.jsx", import.meta.url);
const cssPath = new URL("../src/styles/risk.css", import.meta.url);

test("scrHistoricoRiesgo conserva iconografía, tabla nativa y StartIndex al filtrar", async () => {
  const source = await readFile(historyPath, "utf8");

  assert.match(source, /fa fa-file-excel-o fa-2x/);
  assert.match(source, /title="Descargar Reporte Excel"/);
  assert.match(source, /fa fa-info-circle fa-2x/);
  assert.match(source, /fa fa-sort legacy-risk-sort-icon/);
  assert.match(source, /<table className="legacy-risk-table">/);
  assert.match(source, /onValuesChange=\{\(_, values\) => load\(values, pagination\.current, pagination\.pageSize\)\}/);
  assert.doesNotMatch(source, /import \{[^}]*Table[^}]*\} from "antd"/);
});

test("scrDetalleRiesgo conserva iframe, acordeones y comentarios fuera del grid", async () => {
  const source = await readFile(detailPath, "utf8");
  const gridClose = source.indexOf("</div>\n\n          <div className=\"legacy-risk-comments\">");

  assert.match(source, /Detalle Análisis Contrato/);
  assert.match(source, /fa fa-arrow-circle-left fa-2x/);
  assert.match(source, /<iframe title=\{`Contrato \$\{analysis\.codArchivo\}`\}/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.notEqual(gridClose, -1);
  assert.doesNotMatch(source, /<Collapse/);
  assert.doesNotMatch(source, /legacy-risk-pdf-empty/);
});

test("las medidas principales corresponden al viewport legacy medido", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.legacy-risk-table th \{[\s\S]*?height: 48px;[\s\S]*?padding: 0 24px;[\s\S]*?background: #444;/);
  assert.match(css, /\.legacy-risk-table td \{[\s\S]*?height: 56px;[\s\S]*?padding: 8px 24px;/);
  assert.match(css, /\.legacy-risk-pdf-panel,[\s\S]*?height: 800px;/);
  assert.match(css, /\.legacy-risk-accordion-item > button \{[\s\S]*?height: 64px;[\s\S]*?padding: 0 24px;/);
  assert.match(css, /\.legacy-risk-comments \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
