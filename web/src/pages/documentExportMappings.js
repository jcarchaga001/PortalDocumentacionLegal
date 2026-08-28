// Orden serializado por RecordListToExcel1 dentro de la accion
// ExportarXLSCasos del OML. No coincide con el orden de la estructura de
// entrada: estas son las once columnas que realmente salen en el archivo.
export const LEGACY_DOCUMENT_EXPORT_COLUMN_ORDER = Object.freeze([
  "codInternoSucursal",
  "estado",
  "fechaContrato",
  "Categoria",
  "sucursal",
  "Proveedor",
  "nivelDocumento",
  "numRefencia",
  "fechaVencimiento",
  "usuarioCreacion",
  "numContrato",
]);

function exportColumn(title, value) {
  return Object.freeze({ title, key: title, value });
}

function rowValue(name) {
  return (row) => row?.[name] ?? "";
}

const emptyValue = () => "";

// scrHistoricoAdministrativoDoc deja estos campos sin SourceValue en el OML:
// estado, Proveedor, nivelDocumento y usuarioCreacion. Aunque la consulta de
// la replica pueda devolver alguno de ellos, rellenarlos cambiaria el Excel
// observable del legacy.
export const ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS = Object.freeze([
  exportColumn("codInternoSucursal", rowValue("branchCode")),
  exportColumn("estado", emptyValue),
  exportColumn("fechaContrato", rowValue("documentDate")),
  exportColumn("Categoria", rowValue("categoryName")),
  exportColumn("sucursal", rowValue("branchOnlyName")),
  exportColumn("Proveedor", emptyValue),
  exportColumn("nivelDocumento", emptyValue),
  exportColumn("numRefencia", rowValue("reference")),
  exportColumn("fechaVencimiento", rowValue("expirationDate")),
  exportColumn("usuarioCreacion", emptyValue),
  exportColumn("numContrato", rowValue("description")),
]);

// scrProximosVencer mapea nivel, usuario y estado desde sus joins. Proveedor
// existe en el aggregate, pero su AttributeMapping no tiene SourceValue y por
// eso la columna se conserva vacia.
export const EXPIRING_DOCUMENT_EXPORT_COLUMNS = Object.freeze([
  exportColumn("codInternoSucursal", rowValue("branchCode")),
  exportColumn("estado", rowValue("statusName")),
  exportColumn("fechaContrato", rowValue("documentDate")),
  exportColumn("Categoria", rowValue("categoryName")),
  exportColumn("sucursal", rowValue("branchOnlyName")),
  exportColumn("Proveedor", emptyValue),
  exportColumn("nivelDocumento", rowValue("levelName")),
  exportColumn("numRefencia", rowValue("reference")),
  exportColumn("fechaVencimiento", rowValue("expirationDate")),
  exportColumn("usuarioCreacion", rowValue("createdByName")),
  exportColumn("numContrato", rowValue("description")),
]);

export function mapDocumentExportRow(columns, row) {
  return Object.fromEntries(columns.map((column) => [column.key, column.value(row)]));
}
