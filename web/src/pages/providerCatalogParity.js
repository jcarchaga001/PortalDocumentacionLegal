export const PROVIDER_CATALOG_PAGE_SIZE = 500;
export const PROVIDER_CATALOG_EMPTY_TEXT = "No hay datos para mostrar...";
export const PROVIDER_CATALOG_SUCCESS_MESSAGE = "Registro exitoso";
export const PROVIDER_CATALOG_DUPLICATE_RTN_MESSAGE = "El numero registrado de RTN ya existe";
export const PROVIDER_CATALOG_QUERY_ERROR = "Error executing query.";

export function isLegacyProviderBooleanVisible(value) {
  return value === true || value === 1 || value === "1";
}

export function isDuplicateProviderTaxNumber(result) {
  return result?.error?.code === "DUPLICATE_TAX_NUMBER";
}

export function isProviderQueryFailure(result) {
  const code = String(result?.error?.code || "");
  return code === "INTERNAL_ERROR"
    || code === "API_UNAVAILABLE"
    || code.startsWith("ER_");
}

export function formatProviderPaginationTotal(total, range = []) {
  const [start = 0, end = 0] = range;
  return `${start} to ${end} of ${Number(total || 0)} items`;
}

export function providerMutationRelationship(values, isEditing, originalProvider) {
  // The new-provider popup in the legacy OML binds its visible checkbox to
  // varActivo, while the branch relationship remains bound to Proveedor.isInterno.
  // The edit checkbox is also bound to the unrelated Proveedor.isInterno,
  // while GuardarEditar sends EditProveedor. Preserve the original row
  // relationship instead of silently "fixing" either source defect.
  if (isEditing) {
    const internal = originalProvider?.internal === true
      || originalProvider?.internal === 1
      || originalProvider?.internal === "1";
    return {
      internal,
      destinationId: internal ? (originalProvider?.destinationId ?? null) : null,
    };
  }
  const internal = false;
  return {
    internal,
    destinationId: internal ? (values?.destinationId ?? null) : null,
  };
}
