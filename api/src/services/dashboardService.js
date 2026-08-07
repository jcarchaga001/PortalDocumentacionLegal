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
  };
}
