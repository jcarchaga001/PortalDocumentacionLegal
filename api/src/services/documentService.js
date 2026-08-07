import { randomBytes } from "node:crypto";
import { downloadS3File, uploadFileToS3 } from "./tdS3Service.js";

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "bmp"]);
const MAX_ATTACHMENT_BYTES = 35 * 1024 * 1024;
const DELETE_POSITION_CODES = new Set([7, 32]);

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function parseBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  error.field = field;
  return error;
}

function notFound(message, code) {
  const error = new Error(message);
  error.status = 404;
  error.code = code;
  return error;
}

function forbidden() {
  const error = new Error("No tiene permisos para eliminar este registro.");
  error.status = 403;
  error.code = "FORBIDDEN";
  return error;
}

const SORT_FIELDS = new Set([
  "branchName",
  "reference",
  "description",
  "providerName",
  "categoryName",
  "subcategoryName",
  "documentDate",
  "expirationDate",
  "createdByName",
  "levelName",
  "statusName",
]);

function normalizeDocumentType(value) {
  const normalized = String(value ?? "branch").trim().toLowerCase();
  if (normalized === "2" || normalized === "administrative") return "administrative";
  if (normalized === "all") return "all";
  return "branch";
}

function normalizedDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : undefined;
}

function normalizeFilters(query = {}) {
  const page = positiveInteger(query.page) || 1;
  const pageSize = Math.min(positiveInteger(query.pageSize) || 50, 100);
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 200) : "";
  const sortBy = SORT_FIELDS.has(query.sortBy) ? query.sortBy : undefined;
  const sortDirection = query.sortDirection === "asc" || query.sortDirection === "ascend"
    ? "asc"
    : query.sortDirection === "desc" || query.sortDirection === "descend"
      ? "desc"
      : undefined;
  return {
    page,
    pageSize,
    documentType: normalizeDocumentType(query.documentType),
    includeInactive: query.includeInactive === true || query.includeInactive === "true",
    branchId: positiveInteger(query.branchId),
    categoryId: positiveInteger(query.categoryId),
    subcategoryId: positiveInteger(query.subcategoryId),
    statusId: positiveInteger(query.statusId),
    startDate: normalizedDate(query.startDate),
    endDate: normalizedDate(query.endDate),
    expirationStartDate: normalizedDate(query.expirationStartDate),
    expirationEndDate: normalizedDate(query.expirationEndDate),
    search,
    sortBy,
    sortDirection,
  };
}

function fileExtension(fileName) {
  const normalized = String(fileName || "").trim();
  const dot = normalized.lastIndexOf(".");
  return dot > -1 ? normalized.slice(dot + 1).toLowerCase() : "";
}

function contentTypeFor(extension) {
  return {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    bmp: "image/bmp",
  }[extension] || "application/octet-stream";
}

function normalizeAttachment(payload, { fileNameLimit = 128 } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("Adjunte el archivo.", "attachment");
  }
  const fileName = String(payload.fileName || "").trim().replace(/^.*[\\/]/, "");
  if (!fileName || fileName.length > fileNameLimit) {
    throw validationError("El nombre del archivo no es valido.", "attachment");
  }
  const extension = fileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw validationError("El formato del documento no es permitido.", "attachment");
  }
  const fileBase64 = typeof payload.fileBase64 === "string"
    ? payload.fileBase64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "")
    : "";
  if (!fileBase64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(fileBase64)) {
    throw validationError("No se puede leer archivo (Archivo con errores).", "attachment");
  }
  const buffer = Buffer.from(fileBase64, "base64");
  if (!buffer.length) throw validationError("Adjunte el archivo.", "attachment");
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw validationError("El archivo excede el tamano permitido.", "attachment");
  }
  return {
    fileName,
    extension,
    contentType: contentTypeFor(extension),
    buffer,
    fileBase64,
  };
}

function normalizeDocumentPayload(payload = {}, overrides = {}) {
  const branchId = positiveInteger(overrides.branchId ?? payload.branchId);
  if (!branchId) throw validationError("Debe seleccionar sucursal.", "branchId");

  const rawType = overrides.documentType ?? payload.documentType;
  const documentType = Number(rawType);
  if (documentType !== 1 && documentType !== 2) {
    throw validationError("Seleccione el tipo de documento.", "documentType");
  }

  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  if (!description || description.length > 20) {
    throw validationError("Ingrese la Descripcion Contrato (maximo 20 caracteres).", "description");
  }

  const categoryId = positiveInteger(overrides.categoryId ?? payload.categoryId);
  if (!categoryId) throw validationError("Seleccione la categoria.", "categoryId");
  const subcategoryId = positiveInteger(overrides.subcategoryId ?? payload.subcategoryId);
  if (!subcategoryId) throw validationError("Seleccione la subcategoria.", "subcategoryId");

  const level = Number(payload.level);
  if (![1, 2, 3, 4].includes(level)) {
    throw validationError("Seleccione el Nivel Documento.", "level");
  }

  const isReferential = parseBoolean(payload.isReferential);
  const documentDate = normalizedDate(payload.documentDate);
  const expirationDate = normalizedDate(payload.expirationDate);
  if (!isReferential && !documentDate) {
    throw validationError("Ingrese la Fecha de Documento.", "documentDate");
  }
  if (!isReferential && !expirationDate) {
    throw validationError("Ingrese la Fecha de vencimiento.", "expirationDate");
  }

  const secondaryReference = typeof payload.secondaryReference === "string"
    ? payload.secondaryReference.trim().slice(0, 516)
    : "";

  return {
    branchId,
    documentType,
    description,
    providerId: positiveInteger(payload.providerId),
    categoryId,
    subcategoryId,
    level,
    isReferential,
    documentDate,
    expirationDate,
    secondaryReference,
    isActivePrincipal: parseBoolean(overrides.isActivePrincipal ?? payload.isActivePrincipal),
  };
}

function normalizeId(rawId, field, message) {
  const id = positiveInteger(rawId);
  if (!id) throw validationError(message, field);
  return id;
}

function storageError(result) {
  const error = new Error(result?.message || "No fue posible guardar el archivo.");
  error.status = 502;
  error.code = "DOCUMENT_STORAGE_ERROR";
  return error;
}

async function storeAttachment(rawAttachment, metadata, dependencies, options) {
  const attachment = normalizeAttachment(rawAttachment, options);
  const s3Key = `${randomBytes(6).toString("base64url")}.${attachment.extension}`;
  const result = await dependencies.uploadFileToS3({
    fileBase64: attachment.fileBase64,
    fileName: attachment.fileName,
    s3Key,
    contentType: attachment.contentType,
    metadata,
  });
  if (!result.success) throw storageError(result);
  return { ...attachment, s3Key };
}

async function resolveAttachment(attachment, dependencies) {
  if (!attachment) throw notFound("No existe el archivo...", "DOCUMENT_ATTACHMENT_NOT_FOUND");
  if (attachment.s3Key) {
    const remote = await dependencies.downloadS3File({ s3Key: attachment.s3Key });
    if (remote.success && remote.data?.buffer) {
      return {
        buffer: remote.data.buffer,
        fileName: attachment.fileName || attachment.s3Key,
        contentType: remote.data.contentType || contentTypeFor(attachment.extension),
      };
    }
  }
  if (attachment.buffer?.length) {
    return {
      buffer: attachment.buffer,
      fileName: attachment.fileName || `documento.${attachment.extension || "bin"}`,
      contentType: contentTypeFor(attachment.extension),
    };
  }
  throw notFound("No existe el archivo...", "DOCUMENT_ATTACHMENT_NOT_FOUND");
}

export function createDocumentService(documentRepository, dependencies = {}) {
  const storage = {
    uploadFileToS3: dependencies.uploadFileToS3 || uploadFileToS3,
    downloadS3File: dependencies.downloadS3File || downloadS3File,
  };

  return {
    list(countryCode, query) {
      return documentRepository.list(countryCode, normalizeFilters(query));
    },
    catalogs(countryCode, query) {
      return documentRepository.getCatalogs(countryCode, normalizeDocumentType(query?.documentType));
    },
    async get(countryCode, rawId) {
      const documentId = normalizeId(rawId, "id", "El documento solicitado no es valido.");
      const document = await documentRepository.getById(countryCode, documentId);
      if (!document) throw notFound("El documento solicitado no existe.", "DOCUMENT_NOT_FOUND");
      return document;
    },
    async create(auth, payload) {
      const document = normalizeDocumentPayload(payload);
      const attachment = await storeAttachment(payload.attachment, {
        module: "DocumentacionLegal",
        table: "tblArchivosDocumentos",
        countryCode: String(auth.countryCode),
        userId: String(auth.id),
      }, storage);
      return documentRepository.create(auth.countryCode, auth.id, document, attachment);
    },
    async createBranchDocument(auth, rawBranchId, payload) {
      const branchId = normalizeId(rawBranchId, "branchId", "La sucursal solicitada no es valida.");
      const document = normalizeDocumentPayload(payload, {
        branchId,
        documentType: 1,
        isActivePrincipal: true,
      });
      const attachment = await storeAttachment(payload.attachment, {
        module: "DocumentacionLegal",
        table: "tblArchivosDocumentos",
        branchId: String(branchId),
        userId: String(auth.id),
      }, storage);
      return documentRepository.create(auth.countryCode, auth.id, document, attachment);
    },
    updateReference2(auth, rawId, payload = {}) {
      const documentId = normalizeId(rawId, "id", "El documento solicitado no es valido.");
      const secondaryReference = typeof payload.secondaryReference === "string"
        ? payload.secondaryReference.trim().slice(0, 516)
        : "";
      return documentRepository.updateReference2(auth.countryCode, auth.id, documentId, secondaryReference);
    },
    approve(auth, rawId) {
      const documentId = normalizeId(rawId, "id", "El documento solicitado no es valido.");
      return documentRepository.setStatus(auth.countryCode, auth.id, documentId, 2);
    },
    reject(auth, rawId) {
      const documentId = normalizeId(rawId, "id", "El documento solicitado no es valido.");
      return documentRepository.setStatus(auth.countryCode, auth.id, documentId, 3);
    },
    remove(auth, rawId) {
      if (!DELETE_POSITION_CODES.has(Number(auth.positionCode))) throw forbidden();
      const documentId = normalizeId(rawId, "id", "El documento solicitado no es valido.");
      return documentRepository.softDelete(auth.countryCode, auth.id, documentId);
    },
    async attachment(countryCode, rawId) {
      const documentId = normalizeId(rawId, "id", "El documento solicitado no es valido.");
      return resolveAttachment(await documentRepository.getAttachment(countryCode, documentId), storage);
    },
    branch(countryCode, rawBranchId) {
      const branchId = normalizeId(rawBranchId, "branchId", "La sucursal solicitada no es valida.");
      return documentRepository.getBranchDetail(countryCode, branchId);
    },
    async addBookEvidence(auth, rawBranchId, rawAssignmentId, payload) {
      const branchId = normalizeId(rawBranchId, "branchId", "La sucursal solicitada no es valida.");
      const assignmentId = normalizeId(rawAssignmentId, "assignmentId", "El libro seleccionado no es valido.");
      const attachment = await storeAttachment(payload?.attachment, {
        module: "DocumentacionLegal",
        table: "tblLibroxSucursal_Archivo",
        branchId: String(branchId),
        userId: String(auth.id),
      }, storage, { fileNameLimit: 256 });
      return documentRepository.addBookEvidence(
        auth.countryCode,
        branchId,
        auth.id,
        assignmentId,
        attachment,
      );
    },
    updateBookRequired(auth, rawBranchId, rawAssignmentId, payload = {}) {
      const branchId = normalizeId(rawBranchId, "branchId", "La sucursal solicitada no es valida.");
      const assignmentId = normalizeId(rawAssignmentId, "assignmentId", "El libro seleccionado no es valido.");
      return documentRepository.updateBookRequired(
        auth.countryCode,
        branchId,
        assignmentId,
        parseBoolean(payload.isRequired),
      );
    },
    async bookEvidence(countryCode, rawBranchId, rawEvidenceId) {
      const branchId = normalizeId(rawBranchId, "branchId", "La sucursal solicitada no es valida.");
      const evidenceId = normalizeId(rawEvidenceId, "evidenceId", "La evidencia seleccionada no es valida.");
      const evidence = await documentRepository.getBookEvidence(countryCode, branchId, evidenceId);
      if (!evidence) throw notFound("La evidencia seleccionada no existe.", "BOOK_EVIDENCE_NOT_FOUND");
      return resolveAttachment(evidence, storage);
    },
    removeBookEvidence(auth, rawBranchId, rawEvidenceId) {
      if (!DELETE_POSITION_CODES.has(Number(auth.positionCode))) throw forbidden();
      const branchId = normalizeId(rawBranchId, "branchId", "La sucursal solicitada no es valida.");
      const evidenceId = normalizeId(rawEvidenceId, "evidenceId", "La evidencia seleccionada no es valida.");
      return documentRepository.removeBookEvidence(auth.countryCode, branchId, evidenceId);
    },
  };
}

export {
  contentTypeFor,
  normalizeAttachment,
  normalizeDocumentPayload,
  normalizeDocumentType,
  normalizeFilters,
};
