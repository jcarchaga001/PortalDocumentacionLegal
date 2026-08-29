const DASHBOARD_DOCUMENT_STATUS_IDS = new Set([2, 4, 5]);
const DASHBOARD_DOCUMENT_SORT_FIELDS = new Set([
  "branchName",
  "reference",
  "categoryName",
  "subcategoryName",
  "documentDate",
  "expirationDate",
]);

function validationError(message, field) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  error.field = field;
  return error;
}

export function normalizeDashboardDocumentFilters(query = {}) {
  const statusId = Number(query.statusId);
  if (!Number.isInteger(statusId) || !DASHBOARD_DOCUMENT_STATUS_IDS.has(statusId)) {
    throw validationError("El estado documental seleccionado no es valido.", "statusId");
  }

  const rawStartIndex = Number(query.startIndex);
  const rawMaxRecords = Number(query.maxRecords);
  const startIndex = Number.isInteger(rawStartIndex) && rawStartIndex >= 0 ? rawStartIndex : 0;
  const maxRecords = Number.isInteger(rawMaxRecords) && rawMaxRecords > 0
    ? Math.min(rawMaxRecords, 50)
    : 50;
  const sortBy = DASHBOARD_DOCUMENT_SORT_FIELDS.has(query.sortBy) ? query.sortBy : undefined;
  const sortDirection = sortBy && (
    query.sortDirection === "desc" || query.sortDirection === "descend"
  )
    ? "desc"
    : sortBy
      ? "asc"
      : undefined;

  return {
    statusId,
    startIndex,
    maxRecords,
    sortBy,
    sortDirection,
  };
}

export function createDashboardService(dashboardRepository) {
  const positiveInteger = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : undefined;
  };

  return {
    async getSummary(countryCode) {
      const rows = await dashboardRepository.getSummary(countryCode);
      const global = rows.find((row) => row.scope === "global") || {};
      const number = (value) => Number(value || 0);

      return {
        required: number(global.required_count),
        current: number(global.current_count),
        expiring: number(global.expiring_count),
        missing: number(global.missing_count),
        totalRegistered: number(global.registered_count),
        subcategories: rows
          .filter((row) => row.scope === "subcategory")
          .map((row) => ({
            id: number(row.subcategory_id),
            name: row.name,
            current: number(row.current_count),
            expiring: number(row.expiring_count),
            missing: number(row.missing_count),
            registered: number(row.registered_count),
            total: number(row.required_count),
          })),
      };
    },

    async getBranchMonitoring(countryCode, query = {}) {
      const rows = await dashboardRepository.getBranchMonitoring(countryCode, {
        managerId: positiveInteger(query.managerId),
        branchId: positiveInteger(query.branchId),
      });
      const number = (value) => Number(value || 0);
      return rows.map((row) => {
        const required = number(row.required_count);
        const registered = number(row.registered_count);
        const expiring = number(row.expiring_count);
        return {
          id: number(row.branch_id),
          code: row.branch_code,
          name: row.branch_name,
          managerId: row.manager_id == null ? null : number(row.manager_id),
          managerName: row.manager_name || "",
          required,
          registered,
          expiring,
          other: number(row.other_count),
          registeredPercent: required ? Math.round((registered / required) * 100) : 0,
          expiringPercent: required ? Math.round((expiring / required) * 100) : 0,
        };
      });
    },

    getMonitoringCatalogs(countryCode) {
      return dashboardRepository.getMonitoringCatalogs(countryCode);
    },

    async getDocuments(countryCode, query = {}) {
      const filters = normalizeDashboardDocumentFilters(query);
      const result = await dashboardRepository.getDocuments(countryCode, filters);
      return {
        rows: result.rows,
        count: Number(result.count || 0),
        startIndex: filters.startIndex,
        maxRecords: filters.maxRecords,
      };
    },

    async getExportRows(countryCode) {
      const rows = await dashboardRepository.getExportRows(countryCode);
      const number = (value) => Number(value || 0);
      const normalizedRows = rows.map((row) => ({
        vigente: number(row.vigente),
        porVencer: number(row.porVencer),
        nombreSubcategoria: row.nombreSubcategoria || "",
        nombreSucursal: row.nombreSucursal || "",
        nombreEstado: row.nombreEstado || "",
        codigoSucursal: number(row.codigoSucursal),
        codigoSubcategoria: number(row.codigoSubcategoria),
        estado: number(row.estado),
        noExiste: number(row.noExiste),
      }));
      return {
        rows: normalizedRows,
        count: normalizedRows.length,
      };
    },
  };
}
