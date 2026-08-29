import ExcelJS from "exceljs/dist/exceljs.min.js";
import { downloadBlob } from "./fileHelpers.js";

function safeFileName(fileName) {
  const clean = String(fileName || "reporte.xlsx").replace(/[\\/:*?"<>|]/g, "-");
  return clean.toLowerCase().endsWith(".xlsx") ? clean : `${clean}.xlsx`;
}

export async function exportRowsToXlsx({ fileName, sheetName = "Datos", columns, rows, legacyPlain = false }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
  worksheet.columns = columns.map((column) => ({
    header: column.title,
    key: column.key,
    ...(legacyPlain ? {} : { width: Math.min(Math.max(column.width || 18, 10), 45) }),
  }));
  if (!legacyPlain) {
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF222222" },
    };
  }
  rows.forEach((row) => worksheet.addRow(row));
  if (!legacyPlain) {
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: "A1", to: worksheet.getRow(1).lastCell.address };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    safeFileName(fileName),
  );
}

export const CORPORATE_CLIENT_TEMPLATE_COLUMNS = Object.freeze([
  Object.freeze({ title: "CodigoFA", key: "faCode" }),
  Object.freeze({ title: "TelefonoContacto", key: "contactPhone" }),
  Object.freeze({ title: "NombreContacto", key: "contactName" }),
  Object.freeze({ title: "CorreoContacto", key: "contactEmail" }),
  Object.freeze({ title: "PuestoContacto", key: "contactPosition" }),
  Object.freeze({ title: "NombreCliente", key: "name" }),
]);

const CLIENT_HEADERS = Object.freeze(Object.fromEntries(
  CORPORATE_CLIENT_TEMPLATE_COLUMNS.map((column) => [column.title, column.key]),
));

export async function parseCorporateClientWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("El archivo no contiene una hoja de datos.");
  const headerRow = worksheet.getRow(1);
  const fields = [];
  headerRow.eachCell((cell, columnNumber) => {
    const field = CLIENT_HEADERS[String(cell.text || "").trim()];
    if (field) fields[columnNumber] = field;
  });
  const items = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    fields.forEach((field, columnNumber) => {
      if (field) item[field] = String(row.getCell(columnNumber).text || "");
    });
    if (Object.values(item).some((value) => value !== "")) items.push(item);
  });
  return items;
}

export function downloadCorporateClientTemplate() {
  return exportRowsToXlsx({
    fileName: "PlantillaClientes.xlsx",
    sheetName: "Sheet1",
    columns: CORPORATE_CLIENT_TEMPLATE_COLUMNS,
    rows: [],
    legacyPlain: true,
  });
}
