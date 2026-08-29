import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/pages/AdministrativeDocumentHistoryPage.jsx", import.meta.url);

test("scrHistoricoAdministrativoDoc usa iconos, superficie y acciones legacy", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /surface: "administrative-history"/);
  assert.match(source, /fa fa-external-link fa-1x/);
  assert.match(source, /fa fa-file-image-o fa-2x/);
  assert.match(source, /fa fa-file-excel-o fa-1x/);
  assert.match(source, /legacyAdministrativeHistoryHasAttachment\(record\)/);
  assert.match(source, /legacyPlain: true/);
  assert.match(source, /maxRows: ADMINISTRATIVE_HISTORY_EXPORT_MAX_ROWS/);
  assert.match(source, /showTotal: administrativeHistoryPaginationTotal/);
  assert.doesNotMatch(source, /scroll=\{\{ x: 1900 \}\}/);
  assert.doesNotMatch(source, /FileExcelOutlined|FileImageOutlined|ExportOutlined/);
  assert.doesNotMatch(source, />Descargar Excel<\/Button>/);
});
