const DOCUMENT_TYPE_STORAGE_KEY = "DocumentacionLegal.tipoDocumento";
const LEGACY_SELECTED_BRANCH_STORAGE_KEY = "DocumentacionLegal.SucursalSelected";
const LEGACY_SELECTED_DOCUMENT_STORAGE_KEY = "DocumentacionLegal.IdRegistro";
const LEGACY_CONTEXT_COUNTRY_STORAGE_KEY = "DocumentacionLegal.ContextCountryCode";

function browserSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function normalizeDocumentType(value) {
  const documentType = Number(value);
  return documentType === 1 || documentType === 2 ? documentType : undefined;
}

function normalizeSelectedBranchId(value) {
  const branchId = Number(value);
  return Number.isInteger(branchId) && branchId > 0 ? branchId : undefined;
}

function normalizeSelectedDocumentId(value) {
  const documentId = Number(value);
  return Number.isInteger(documentId) && documentId > 0 ? documentId : undefined;
}

function normalizeCountryCode(value) {
  const countryCode = Number(value);
  return Number.isInteger(countryCode) && countryCode > 0 ? countryCode : undefined;
}

export function readLegacyDocumentType(storage = browserSessionStorage()) {
  if (!storage) return undefined;
  try {
    return normalizeDocumentType(storage.getItem(DOCUMENT_TYPE_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function writeLegacyDocumentType(value, storage = browserSessionStorage()) {
  const documentType = normalizeDocumentType(value);
  if (!documentType || !storage) return undefined;
  try {
    storage.setItem(DOCUMENT_TYPE_STORAGE_KEY, String(documentType));
    return documentType;
  } catch {
    return undefined;
  }
}

export function clearLegacyDocumentType(storage = browserSessionStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(DOCUMENT_TYPE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readLegacySelectedBranchId(storage = browserSessionStorage()) {
  if (!storage) return undefined;
  try {
    return normalizeSelectedBranchId(storage.getItem(LEGACY_SELECTED_BRANCH_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function writeLegacySelectedBranchId(value, storage = browserSessionStorage()) {
  const branchId = normalizeSelectedBranchId(value);
  if (!branchId || !storage) return undefined;
  try {
    storage.setItem(LEGACY_SELECTED_BRANCH_STORAGE_KEY, String(branchId));
    return branchId;
  } catch {
    return undefined;
  }
}

export function clearLegacySelectedBranchId(storage = browserSessionStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(LEGACY_SELECTED_BRANCH_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readLegacySelectedDocumentId(storage = browserSessionStorage()) {
  if (!storage) return undefined;
  try {
    return normalizeSelectedDocumentId(storage.getItem(LEGACY_SELECTED_DOCUMENT_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

export function writeLegacySelectedDocumentId(value, storage = browserSessionStorage()) {
  const documentId = normalizeSelectedDocumentId(value);
  if (!documentId || !storage) return undefined;
  try {
    storage.setItem(LEGACY_SELECTED_DOCUMENT_STORAGE_KEY, String(documentId));
    return documentId;
  } catch {
    return undefined;
  }
}

export function clearLegacySelectedDocumentId(storage = browserSessionStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(LEGACY_SELECTED_DOCUMENT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readLegacyContextCountryCode(storage = browserSessionStorage()) {
  if (!storage) return undefined;
  try {
    return normalizeCountryCode(storage.getItem(LEGACY_CONTEXT_COUNTRY_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

function writeLegacyContextCountryCode(value, storage = browserSessionStorage()) {
  const countryCode = normalizeCountryCode(value);
  if (!countryCode || !storage) return undefined;
  try {
    storage.setItem(LEGACY_CONTEXT_COUNTRY_STORAGE_KEY, String(countryCode));
    return countryCode;
  } catch {
    return undefined;
  }
}

export function clearLegacyDocumentContext(storage = browserSessionStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(DOCUMENT_TYPE_STORAGE_KEY);
    storage.removeItem(LEGACY_SELECTED_BRANCH_STORAGE_KEY);
    storage.removeItem(LEGACY_SELECTED_DOCUMENT_STORAGE_KEY);
    storage.removeItem(LEGACY_CONTEXT_COUNTRY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function resetLegacyDocumentContextForLogin(
  countryCode,
  storage = browserSessionStorage(),
) {
  if (!storage) return undefined;
  clearLegacyDocumentType(storage);
  clearLegacySelectedBranchId(storage);
  clearLegacySelectedDocumentId(storage);

  try {
    storage.removeItem(LEGACY_CONTEXT_COUNTRY_STORAGE_KEY);
  } catch {
    return undefined;
  }

  return writeLegacyContextCountryCode(countryCode, storage);
}

export function restoreLegacyDocumentContextForCountry(
  countryCode,
  storage = browserSessionStorage(),
) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode || !storage) {
    return { countryCode: undefined, countryChanged: false };
  }

  const previousCountryCode = readLegacyContextCountryCode(storage);
  const countryChanged = previousCountryCode !== undefined
    && previousCountryCode !== normalizedCountryCode;

  if (countryChanged) {
    clearLegacyDocumentType(storage);
    clearLegacySelectedBranchId(storage);
    clearLegacySelectedDocumentId(storage);
  }

  writeLegacyContextCountryCode(normalizedCountryCode, storage);
  return {
    countryCode: normalizedCountryCode,
    previousCountryCode,
    countryChanged,
  };
}

export {
  DOCUMENT_TYPE_STORAGE_KEY,
  LEGACY_CONTEXT_COUNTRY_STORAGE_KEY,
  LEGACY_SELECTED_BRANCH_STORAGE_KEY,
  LEGACY_SELECTED_DOCUMENT_STORAGE_KEY,
  normalizeCountryCode,
  normalizeDocumentType,
  normalizeSelectedBranchId,
  normalizeSelectedDocumentId,
};
