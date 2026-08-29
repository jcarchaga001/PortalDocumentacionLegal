export const CORPORATE_CLIENT_BULK_CONTROLS = Object.freeze([
  Object.freeze({ key: "rQAQ5o1+SUq2CbZH_50_Og", control: "Volver al listado", action: "VolverAlListadoOnClick" }),
  Object.freeze({ key: "lWKv1nz8pEeqG6y0irCMPg", control: "Descargar Plantilla", action: "DescargarPlantillaOnClick" }),
  Object.freeze({ key: "n7o1RFpNU0Wc40Lv5u+Cxg", control: "Subir", action: "SubirOnClick" }),
  Object.freeze({ key: "Usgf3OJJn02ycCfg1V9lmw", control: "Remover todos los registros no validos", action: "RemoverTodosNoValidosOnClick" }),
  Object.freeze({ key: "8kZOy1arf0Sj2Lu_TeAmUQ", control: "Remover registro", action: "RemoverRegistroOnClick" }),
]);

export const CORPORATE_CLIENT_BULK_COLUMNS = Object.freeze([
  Object.freeze({ key: "faCode", label: "CodigoFA", sortable: true }),
  Object.freeze({ key: "name", label: "Nombre Cliente", sortable: true }),
  Object.freeze({ key: "contactName", label: "Nombre Contacto", sortable: true }),
  Object.freeze({ key: "contactPosition", label: "Puesto Contacto", sortable: true }),
  Object.freeze({ key: "contactPhone", label: "Teléfono Contacto", sortable: false }),
  Object.freeze({ key: "contactEmail", label: "Correo Contacto", sortable: false }),
]);

export const CORPORATE_CLIENT_BULK_QUERY_ERROR = "Error executing query.";
export const CORPORATE_CLIENT_BULK_EMPTY_FILE_LABEL = "Seleccione un archivo..";

function asLegacyText(value) {
  return value === undefined || value === null ? "" : String(value);
}

function nextImportRowId(rows) {
  return rows.reduce((maximum, row) => Math.max(maximum, Number(row.importRowId) || 0), 0) + 1;
}

/**
 * Upload1OnChange no limpia Clientes: cada archivo nuevo se agrega a la lista
 * actual. La validación del OML compara cadenas vacías sin Trim y considera
 * duplicado cualquier CodigoFA que ya exista en la lista acumulada.
 */
export function appendCorporateClientImportRows(currentRows = [], importedRows = []) {
  const result = currentRows.map((row) => ({ ...row }));
  let importRowId = nextImportRowId(result);

  for (const source of importedRows) {
    const row = {
      faCode: asLegacyText(source?.faCode),
      name: asLegacyText(source?.name),
      contactName: asLegacyText(source?.contactName),
      contactPosition: asLegacyText(source?.contactPosition),
      contactPhone: asLegacyText(source?.contactPhone),
      contactEmail: asLegacyText(source?.contactEmail),
    };
    const duplicate = result.some((existing) => existing.faCode === row.faCode);
    const missingContactName = row.contactName === "";
    const missingContactPhone = row.contactPhone === "";
    const isValid = !missingContactName && !missingContactPhone && !duplicate;
    const validationMessage = missingContactName
      ? "Este registro no es valido, el Nombre del contacto es requerido"
      : missingContactPhone
        ? "Este registro no es valido, el Teléfono del contacto es requerido"
        : duplicate
          ? "Este registro no es valido"
          : "";

    result.push({ ...row, importRowId, isValid, validationMessage });
    importRowId += 1;
  }
  return result;
}

export function removeCorporateClientImportRow(rows = [], importRowId) {
  return rows.filter((row) => row.importRowId !== importRowId);
}

export function removeInvalidCorporateClientImportRows(rows = []) {
  return rows.filter((row) => row.isValid);
}

export function nextCorporateClientBulkSort(current, key) {
  if (current?.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function sortCorporateClientImportRows(rows = [], sort) {
  if (!sort?.key || !CORPORATE_CLIENT_BULK_COLUMNS.some((column) => column.key === sort.key && column.sortable)) {
    return rows;
  }
  const multiplier = sort.direction === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const comparison = asLegacyText(left.row[sort.key]).localeCompare(
        asLegacyText(right.row[sort.key]),
        "es",
        { sensitivity: "base" },
      );
      return comparison === 0 ? left.index - right.index : comparison * multiplier;
    })
    .map(({ row }) => row);
}

