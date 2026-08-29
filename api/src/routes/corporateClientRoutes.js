import { Router } from "express";
import { createCorporateClientController } from "../controllers/corporateClientController.js";

export function createCorporateClientRouter(service) {
  const router = Router();
  const controller = createCorporateClientController(service);
  router.get("/", controller.list);
  router.post("/bulk", controller.bulkUpsert);
  router.get("/:id/contacts", controller.contacts);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.patch("/:id/status", controller.setStatus);
  return router;
}
