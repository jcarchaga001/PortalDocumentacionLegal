import { normalizedSuccess } from "../services/serviceResult.js";

export function createRiskController(riskService) {
  return {
    async list(req, res, next) {
      try {
        const data = await riskService.list(req.auth.countryCode, req.query);
        res.json(normalizedSuccess("Análisis de riesgo consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async catalogs(req, res, next) {
      try {
        const data = await riskService.catalogs(req.auth.countryCode);
        res.json(normalizedSuccess("Catálogos de análisis de riesgo consultados correctamente.", data));
      } catch (error) {
        next(error);
      }
    },

    async detail(req, res, next) {
      try {
        const data = await riskService.detail(req.params.codArchivo, req.auth.countryCode);
        res.json(normalizedSuccess("Detalle del análisis de riesgo consultado correctamente.", data));
      } catch (error) {
        next(error);
      }
    },
  };
}
