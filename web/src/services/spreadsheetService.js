import ExcelJS from "exceljs/dist/exceljs.min.js";
import { downloadBlob } from "./fileHelpers.js";

function safeFileName(fileName) {
  const clean = String(fileName || "reporte.xlsx").replace(/[\\/:*?"<>|]/g, "-");
  return clean.toLowerCase().endsWith(".xlsx") ? clean : `${clean}.xlsx`;
}

export async function exportRowsToXlsx({ fileName, sheetName = "Datos", columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
  worksheet.columns = columns.map((column) => ({
    header: column.title,
    key: column.key,
    width: Math.min(Math.max(column.width || 18, 10), 45),
  }));
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF222222" },
  };
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: worksheet.getRow(1).lastCell.address };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    safeFileName(fileName),
  );
}

const CLIENT_HEADERS = Object.freeze({
  codigofa: "faCode",
  "codigo fa": "faCode",
  "nombre cliente": "name",
  nombrecliente: "name",
  "nombre contacto": "contactName",
  nombrecontacto: "contactName",
  "puesto contacto": "contactPosition",
  puestocontacto: "contactPosition",
  "telefono contacto": "contactPhone",
  "teléfono contacto": "contactPhone",
  telefonocontacto: "contactPhone",
  "correo contacto": "contactEmail",
  correocontacto: "contactEmail",
});

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function parseCorporateClientWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("El archivo no contiene una hoja de datos.");
  const headerRow = worksheet.getRow(1);
  const fields = [];
  headerRow.eachCell((cell, columnNumber) => {
    const field = CLIENT_HEADERS[normalizeHeader(cell.text)];
    if (field) fields[columnNumber] = field;
  });
  if (!fields.includes("faCode") || !fields.includes("name")) {
    throw new Error("La plantilla debe contener CodigoFA y Nombre Cliente.");
  }
  const items = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    fields.forEach((field, columnNumber) => {
      if (field) item[field] = String(row.getCell(columnNumber).text || "").trim();
    });
    if (item.faCode || item.name) items.push(item);
  });
  return items;
}

export function validateCorporateClientImportRows(items = []) {
  const seenFaCodes = new Set();
  return items.map((item, index) => {
    const faCode = String(item.faCode || "");
    const duplicate = seenFaCodes.has(faCode);
    seenFaCodes.add(faCode);
    const missingContactName = !String(item.contactName || "").trim();
    const missingContactPhone = !String(item.contactPhone || "").trim();
    const isValid = !duplicate && !missingContactName && !missingContactPhone;
    const validationMessage = missingContactName
      ? "Este registro no es valido, el Nombre del contacto es requerido"
      : missingContactPhone
        ? "Este registro no es valido, el Teléfono del contacto es requerido"
        : duplicate
          ? "Este registro no es valido"
          : "";
    return { ...item, importRowId: index + 1, isValid, validationMessage };
  });
}

export function downloadCorporateClientTemplate() {
  return exportRowsToXlsx({
    fileName: "PlantillaClientes.xlsx",
    sheetName: "Sheet1",
    columns: [
      { title: "NombreContacto", key: "contactName", width: 28 },
      { title: "TelefonoContacto", key: "contactPhone", width: 20 },
      { title: "CorreoContacto", key: "contactEmail", width: 30 },
      { title: "CodigoFA", key: "faCode", width: 18 },
      { title: "NombreCliente", key: "name", width: 34 },
      { title: "PuestoContacto", key: "contactPosition", width: 28 },
    ],
    rows: [],
  });
}
