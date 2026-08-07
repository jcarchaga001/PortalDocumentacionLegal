import { downloadBlob } from "./fileHelpers.js";
import { getDocuments } from "./documentService.js";
import { exportRowsToXlsx } from "./spreadsheetService.js";

function csvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function loadDocumentExportRows(filters) {
  const rows = [];
  let page = 1;
  let total = 0;

  do {
    const result = await getDocuments({ ...filters, page, pageSize: 100 });
    if (!result.success) return result;
    const pageRows = result.data?.items || result.data || [];
    rows.push(...pageRows);
    total = Number(result.data?.total ?? rows.length);
    if (pageRows.length === 0) break;
    page += 1;
  } while (rows.length < total);

  return { success: true, message: "Documentos consultados correctamente.", data: rows, error: null };
}

export async function downloadDocumentCsv({ filters, columns, fileName }) {
  const result = await loadDocumentExportRows(filters);
  if (!result.success) return result;
  const rows = result.data;

  const lines = [
    columns.map(({ title }) => csvValue(title)).join(","),
    ...rows.map((row) => columns.map(({ dataIndex, value }) => csvValue(value ? value(row) : row[dataIndex])).join(",")),
  ];
  downloadBlob(new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }), fileName);
  return { success: true, message: "Archivo descargado correctamente.", data: { total: rows.length }, error: null };
}

export async function downloadDocumentXlsx({ filters, columns, fileName, sheetName = "Documentos" }) {
  const result = await loadDocumentExportRows(filters);
  if (!result.success) return result;
  if (result.data.length === 0) {
    return {
      success: false,
      message: "No hay registros a exportar.",
      data: null,
      error: { code: "EMPTY_EXPORT" },
    };
  }
  await exportRowsToXlsx({
    fileName,
    sheetName,
    columns: columns.map((column) => ({
      title: column.title,
      key: column.key || column.dataIndex,
      width: column.width,
    })),
    rows: result.data.map((row) => Object.fromEntries(columns.map((column) => [
      column.key || column.dataIndex,
      column.value ? column.value(row) : row[column.dataIndex],
    ]))),
  });
  return {
    success: true,
    message: "Archivo descargado correctamente.",
    data: { total: result.data.length },
    error: null,
  };
}

export function documentExportTimestamp(date = new Date()) {
  const part = (value) => String(value).padStart(2, "0");
  const twelveHour = date.getHours() % 12 || 12;
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(twelveHour)}${part(date.getMinutes())}${part(date.getSeconds())}`;
}
