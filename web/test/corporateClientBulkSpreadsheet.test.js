import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import {
  CORPORATE_CLIENT_TEMPLATE_COLUMNS,
  parseCorporateClientWorkbook,
} from "../src/services/spreadsheetService.js";

async function fixtureFile(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Fixture local");
  rows.forEach((values) => worksheet.addRow(values));
  const buffer = await workbook.xlsx.writeBuffer();
  return { arrayBuffer: async () => buffer };
}

test("plantilla conserva orden exacto de RecordListToExcel", () => {
  assert.deepEqual(CORPORATE_CLIENT_TEMPLATE_COLUMNS.map(({ title }) => title), [
    "CodigoFA",
    "TelefonoContacto",
    "NombreContacto",
    "CorreoContacto",
    "PuestoContacto",
    "NombreCliente",
  ]);
});

test("ExcelToRecordList usa encabezados exactos, conserva espacios y no descarta filas de contacto", async () => {
  const file = await fixtureFile([
    ["CodigoFA", "TelefonoContacto", "NombreContacto", "CorreoContacto", "PuestoContacto", "NombreCliente"],
    [" FA01 ", " 9999 ", " Contacto ", "no-es-correo", " Puesto ", " Cliente "],
    ["", "2222", "Solo contacto", "", "", ""],
  ]);
  const rows = await parseCorporateClientWorkbook(file);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].faCode, " FA01 ");
  assert.equal(rows[0].contactPhone, " 9999 ");
  assert.equal(rows[0].name, " Cliente ");
  assert.equal(rows[1].contactName, "Solo contacto");
});

test("encabezados alternativos no se aceptan por conveniencia", async () => {
  const file = await fixtureFile([
    ["Codigo FA", "Telefono", "Contacto"],
    ["FA01", "9999", "Nombre"],
  ]);
  assert.deepEqual(await parseCorporateClientWorkbook(file), []);
});
