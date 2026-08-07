import { Router } from "express";
import { createDashboardController } from "../controllers/dashboardController.js";

export function createDashboardRouter(dashboardService) {
  const router = Router();
  const controller = createDashboardController(dashboardService);
  router.get("/summary", controller.summary);
  router.get("/monitoring/catalogs", controller.monitoringCatalogs);
  router.get("/monitoring", controller.monitoring);
  return router;
}
