import { Router } from "express";
import { createRiskController } from "../controllers/riskController.js";

export function createRiskRouter(riskService) {
  const router = Router();
  const controller = createRiskController(riskService);

  router.get("/catalogs", controller.catalogs);
  router.get("/:codArchivo", controller.detail);
  router.get("/", controller.list);

  return router;
}
