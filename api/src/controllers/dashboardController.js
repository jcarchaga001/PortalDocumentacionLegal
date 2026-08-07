import { normalizedSuccess } from "../services/serviceResult.js";

export function createDashboardController(dashboardService) {
  return {
    async summary(req, res, next) {
      try {
        const summary = await dashboardService.getSummary(req.auth.countryCode);
        res.json(normalizedSuccess("Resumen documental calculado correctamente.", summary));
      } catch (error) {
        next(error);
      }
    },
    async monitoring(req, res, next) {
      try {
        const data = await dashboardService.getBranchMonitoring(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Monitoreo de sucursales consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
    async monitoringCatalogs(req, res, next) {
      try {
        const data = await dashboardService.getMonitoringCatalogs(req.auth.countryCode);
        res.json(normalizedSuccess("Catalogos de monitoreo consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
  };
}
