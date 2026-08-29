import { Router } from "express";
import { createAgreementController } from "../controllers/agreementController.js";

export function createAgreementRouter(agreementService) {
  const router = Router();
  const controller = createAgreementController(agreementService);
  router.get("/catalogs", controller.catalogs);
  router.get("/clients", controller.clients);
  router.get("/", controller.list);
  router.get("/:id/contacts", controller.contacts);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.post("/:id/attachments", controller.addAttachment);
  router.delete("/:id/attachments/:attachmentId", controller.removeAttachment);
  return router;
}
