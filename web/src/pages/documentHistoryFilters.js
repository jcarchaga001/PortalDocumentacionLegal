/**
 * El aggregate legacy combina el rango con `codigoSucursal <> NullIdentifier()`
 * mediante OR. En documentos de sucursal esa segunda condición siempre se cumple:
 * el selector refresca la tabla, pero no restringe ni la tabla ni su exportación.
 */
export function buildLegacyBranchHistoryFilters(values = {}) {
  return {
    surface: "branch-history",
    branchId: values.branchId,
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId,
    statusId: values.statusId,
    search: values.search,
  };
}
