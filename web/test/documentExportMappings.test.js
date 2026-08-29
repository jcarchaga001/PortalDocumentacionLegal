import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS,
  BRANCH_DOCUMENT_EXPORT_COLUMNS,
  EXPIRING_DOCUMENT_EXPORT_COLUMNS,
  LEGACY_DOCUMENT_EXPORT_COLUMN_ORDER,
  mapDocumentExportRow,
} from "../src/pages/documentExportMappings.js";

const sample = Object.freeze({
  branchCode: "FA00",
  branchOnlyName: "Administracion",
  categoryName: "Contratos",
  createdByName: "Persona Legacy",
  description: "Contrato 42",
  documentDate: "2026-01-10",
  expirationDate: "2026-11-20",
  levelName: "Confidencial",
  providerName: "Proveedor Legacy",
  reference: "CTR-42",
  statusName: "Por Vencer",
});

test("ambas exportaciones conservan el orden exacto de RecordListToExcel1", () => {
  assert.deepEqual(
    BRANCH_DOCUMENT_EXPORT_COLUMNS.map(({ title }) => title),
    LEGACY_DOCUMENT_EXPORT_COLUMN_ORDER,
  );
  assert.deepEqual(
    ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS.map(({ title }) => title),
    LEGACY_DOCUMENT_EXPORT_COLUMN_ORDER,
  );
  assert.deepEqual(
    EXPIRING_DOCUMENT_EXPORT_COLUMNS.map(({ title }) => title),
    LEGACY_DOCUMENT_EXPORT_COLUMN_ORDER,
  );
});

test("scrHistoricoDocumentos completa los once SourceValue del OML", () => {
  assert.deepEqual(mapDocumentExportRow(BRANCH_DOCUMENT_EXPORT_COLUMNS, sample), {
    codInternoSucursal: "FA00",
    estado: "Por Vencer",
    fechaContrato: "2026-01-10",
    Categoria: "Contratos",
    sucursal: "Administracion",
    Proveedor: "Proveedor Legacy",
    nivelDocumento: "Confidencial",
    numRefencia: "CTR-42",
    fechaVencimiento: "2026-11-20",
    usuarioCreacion: "Persona Legacy",
    numContrato: "Contrato 42",
  });
});

test("scrHistoricoAdministrativoDoc conserva los SourceValue vacios del OML", () => {
  assert.deepEqual(mapDocumentExportRow(ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS, sample), {
    codInternoSucursal: "FA00",
    estado: "",
    fechaContrato: "2026-01-10",
    Categoria: "Contratos",
    sucursal: "Administracion",
    Proveedor: "",
    nivelDocumento: "",
    numRefencia: "CTR-42",
    fechaVencimiento: "2026-11-20",
    usuarioCreacion: "",
    numContrato: "Contrato 42",
  });
});

test("scrProximosVencer recupera nivel usuario y estado pero no inventa Proveedor", () => {
  assert.deepEqual(mapDocumentExportRow(EXPIRING_DOCUMENT_EXPORT_COLUMNS, sample), {
    codInternoSucursal: "FA00",
    estado: "Por Vencer",
    fechaContrato: "2026-01-10",
    Categoria: "Contratos",
    sucursal: "Administracion",
    Proveedor: "",
    nivelDocumento: "Confidencial",
    numRefencia: "CTR-42",
    fechaVencimiento: "2026-11-20",
    usuarioCreacion: "Persona Legacy",
    numContrato: "Contrato 42",
  });
});
