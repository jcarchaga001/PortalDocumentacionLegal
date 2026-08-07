import { getIncidents, getLaborCases } from "./incidentService.js";
import { documentExportTimestamp } from "./documentExportService.js";
import { exportRowsToXlsx } from "./spreadsheetService.js";

const INCIDENT_EXPORT_COLUMNS = [
  "CategoriaIncidente",
  "Activo",
  "FechaRegistro",
  "Justificacion",
  "Sucursal",
  "EstadoIncidente",
  "Automatico",
  "FechaApertura",
  "CodIncidente",
  "CodigoRegistro",
  "UsuarioCreado",
  "TipoIncidente",
  "CodigoInterno",
  "Observacion",
  "Pais",
  "UsuarioActualiza",
  "MotivoIncidente",
];

const LABOR_EXPORT_COLUMNS = [
  "Pais",
  "UsuarioActualiza",
  "CodigoRegistro",
  "EstadoIncidente",
  "Justificacion",
  "FechaRegistro",
  "FechaApertura",
  "NombreSolicitante",
  "Sucursal",
  "CategoriaIncidente",
  "Automatico",
  "UsuarioCreado",
  "CodIncidente",
  "Activo",
  "Observacion",
  "MotivoIncidente",
  "DNI",
];

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

function excelColumns(keys) {
  return keys.map((key) => ({ title: key, key }));
}

async function loadAllPages(loadPage, filters) {
  const pageSize = 100;
  const rows = [];
  let page = 1;
  let total = 0;

  do {
    const result = await loadPage({ ...filters, page, pageSize });
    if (!result.success) return result;
    const pageRows = result.data?.items || [];
    rows.push(...pageRows);
    total = Number(result.data?.total ?? rows.length);
    if (pageRows.length === 0) break;
    page += 1;
  } while (rows.length < total);

  return {
    success: true,
    message: "Registros consultados correctamente.",
    data: rows,
    error: null,
  };
}

function incidentExportFilters(filters = {}) {
  return {
    branchId: filters.branchId,
    typeId: filters.typeId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    agencyId: filters.agencyId,
  };
}

function laborExportFilters(filters = {}) {
  return {
    branchId: filters.branchId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    levelId: filters.levelId,
    responsibleId: filters.responsibleId,
    statusId: filters.statusId,
    search: filters.search,
    activeEmployees: true,
  };
}

function incidentExportRow(row) {
  return {
    CategoriaIncidente: text(row.incidentCategory),
    Activo: "",
    FechaRegistro: text(row.branchRegistrationDate),
    Justificacion: text(row.justification),
    Sucursal: text(row.branchOnlyName),
    EstadoIncidente: text(row.statusId),
    Automatico: "",
    FechaApertura: text(row.visitDate),
    CodIncidente: Number(row.id),
    CodigoRegistro: text(row.id),
    UsuarioCreado: text(row.createdById),
    TipoIncidente: text(row.incidentTypeName),
    CodigoInterno: text(row.branchCode),
    Observacion: text(row.comment),
    Pais: text(row.countryCode),
    UsuarioActualiza: text(row.updatedById),
    MotivoIncidente: text(row.motiveName),
  };
}

function laborExportRow(row) {
  return {
    Pais: text(row.countryCode),
    UsuarioActualiza: text(row.updatedById),
    CodigoRegistro: "",
    EstadoIncidente: text(row.statusName),
    Justificacion: text(row.justification),
    FechaRegistro: text(row.branchRegistrationDate),
    FechaApertura: text(row.eventDate),
    NombreSolicitante: text(row.employeeName),
    Sucursal: text(row.branchOnlyName),
    CategoriaIncidente: "",
    Automatico: "",
    UsuarioCreado: text(row.createdById),
    CodIncidente: Number(row.id),
    Activo: "",
    Observacion: "",
    MotivoIncidente: "",
    DNI: text(row.identityNumber),
  };
}

export async function exportIncidentHistoryXlsx(scope, filters) {
  const result = await loadAllPages(
    (query) => getIncidents(scope, query),
    incidentExportFilters(filters),
  );
  if (!result.success) return result;

  await exportRowsToXlsx({
    fileName: `RP_IncidentesJustificados_${documentExportTimestamp()}.xlsx`,
    sheetName: "Sheet1",
    columns: excelColumns(INCIDENT_EXPORT_COLUMNS),
    rows: result.data.map(incidentExportRow),
  });
  return {
    success: true,
    message: "Archivo descargado correctamente.",
    data: { total: result.data.length },
    error: null,
  };
}

export async function exportLaborCaseHistoryXlsx(filters) {
  const result = await loadAllPages(getLaborCases, laborExportFilters(filters));
  if (!result.success) return result;

  await exportRowsToXlsx({
    fileName: `RP_IncidentesJustificados_${documentExportTimestamp()}.xlsx`,
    sheetName: "Sheet1",
    columns: excelColumns(LABOR_EXPORT_COLUMNS),
    rows: result.data.map(laborExportRow),
  });
  return {
    success: true,
    message: "Archivo descargado correctamente.",
    data: { total: result.data.length },
    error: null,
  };
}

export {
  INCIDENT_EXPORT_COLUMNS,
  LABOR_EXPORT_COLUMNS,
  incidentExportFilters,
  laborExportFilters,
};
