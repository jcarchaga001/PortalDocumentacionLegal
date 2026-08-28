const DOCUMENT_EXTENSIONS = Object.freeze(["pdf", "jpg", "jpeg", "png", "bmp"]);
const INCIDENT_EXTENSIONS = Object.freeze(["png", "jpeg", "jpg", "pdf"]);
const AGREEMENT_EXTENSIONS = Object.freeze([
  ".pdf",
  ".jpeg",
  ".jpg",
  ".png",
  ".docx",
  ".doc",
  ".xls",
  ".xlsx",
  ".txt",
]);

export const LEGACY_FILE_MESSAGES = Object.freeze({
  documentUnsupported: "El formato del documento no es permitido",
  incidentUnsupported: "La extención del Archivo no es Valido. (Solo permite .PNG o .JPEG y PDF)",
  legalIncidentUnsupported: "La extensión del Archivo no es Valido. (Solo permite .PNG o .JPEG y PDF)",
  commentUnsupported: "La extención del Archivo no es Valido. (Solo permite .PNG o .JPEG)",
  legalCommentUnsupported: "La extensión del archivo no es válido. (Solo permite .PNG o .JPEG)",
  evidenceRequired: "Adjuntar documento",
});

export const LEGACY_AGREEMENT_UPLOAD = Object.freeze({
  accept: AGREEMENT_EXTENSIONS.join(","),
  maxFiles: 500,
  maxFileBytes: 100_000_000,
  browseText: "Buscar para subir.",
  prompt: "Arrastre los archivos aquí.",
});

export const LEGACY_NATIVE_UPLOADS = Object.freeze([
  { surface: "scrDetalleSucursalDocumentacion", control: "Upload1", mandatory: true, accept: "" },
  { surface: "scrDetalleSucursalDocumentacion", control: "Upload2", mandatory: false, accept: "" },
  { surface: "scrRegistroDocumento", control: "Upload1", mandatory: true, accept: "" },
  { surface: "scrAccionesIncidentes", control: "Upload1", mandatory: true, accept: "" },
  { surface: "srcMisAccionesCasosLaborales", control: "UploadCerrarA", mandatory: false, accept: "" },
  { surface: "srcAccionesIncidentesLegal", control: "UploadAccion", mandatory: false, accept: "" },
  { surface: "srcAccionesIncidentesLegal", control: "UploadCierreInci", mandatory: false, accept: "" },
  { surface: "srcAccionesIncidentesLegal", control: "UploadCerrarA", mandatory: false, accept: "" },
  { surface: "scrMisAccionesInternoVisita", control: "Upload1", mandatory: true, accept: "" },
  { surface: "scrRegistroIncicentesExternos", control: "Upload1", mandatory: true, accept: "" },
  { surface: "srcAccionesIncidentesLegal_OLD", control: "UploadAccion", mandatory: false, accept: "" },
  { surface: "srcAccionesIncidentesLegal_OLD", control: "UploadCierreInci", mandatory: false, accept: "" },
  { surface: "srcAccionesIncidentesLegal_OLD", control: "UploadCerrarA", mandatory: false, accept: "" },
  { surface: "scrMisAccionesExternos", control: "Upload1", mandatory: true, accept: "" },
  { surface: "scrRegistroIncidentesInternos", control: "Upload1", mandatory: true, accept: "" },
  { surface: "blkHiloIncidentes", control: "Upload1", mandatory: false, accept: "" },
  { surface: "blkComentariosIncidenteLegal", control: "Upload1", mandatory: false, accept: "" },
  { surface: "blkComentariosIncidente", control: "Upload1", mandatory: false, accept: "" },
  { surface: "scrCargaMasivaClientesCorp", control: "Upload1", mandatory: false, accept: "" },
]);

export function fileExtension(fileName) {
  const normalized = String(fileName || "").trim();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot + 1).toLowerCase() : "";
}

export function validateLegacyDocumentFileName(fileName) {
  const valid = DOCUMENT_EXTENSIONS.includes(fileExtension(fileName));
  return {
    valid,
    message: valid ? "" : LEGACY_FILE_MESSAGES.documentUnsupported,
  };
}

export function validateLegacyIncidentFileName(fileName, { legal = false } = {}) {
  const valid = INCIDENT_EXTENSIONS.includes(fileExtension(fileName));
  return {
    valid,
    message: valid
      ? ""
      : legal
        ? LEGACY_FILE_MESSAGES.legalIncidentUnsupported
        : LEGACY_FILE_MESSAGES.incidentUnsupported,
  };
}

export function legacyAgreementStoredExtension(fileName) {
  const normalized = String(fileName || "");
  const dot = normalized.indexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

export function validateLegacyAgreementCandidate(file, currentFileCount = 0) {
  if (currentFileCount >= LEGACY_AGREEMENT_UPLOAD.maxFiles) {
    return { valid: false, code: "MAX_FILES", message: null };
  }
  if (Number(file?.size || 0) > LEGACY_AGREEMENT_UPLOAD.maxFileBytes) {
    return { valid: false, code: "MAX_FILE_SIZE", message: null };
  }
  const extension = `.${fileExtension(file?.name)}`;
  if (!AGREEMENT_EXTENSIONS.includes(extension)) {
    return { valid: false, code: "UNSUPPORTED_EXTENSION", message: null };
  }
  return { valid: true, code: "", message: "" };
}

export const LEGACY_DOCUMENT_EXTENSIONS = DOCUMENT_EXTENSIONS;
export const LEGACY_INCIDENT_EXTENSIONS = INCIDENT_EXTENSIONS;

