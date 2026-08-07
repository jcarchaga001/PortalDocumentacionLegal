import { Router } from "express";
import { createNotificationController } from "../controllers/notificationController.js";
import { createRequireNotificationExecution } from "../middlewares/requireNotificationExecution.js";

export function createNotificationRouter(notificationService, executionDependencies = {}) {
  const router = Router();
  const controller = createNotificationController(notificationService);
  const requireNotificationExecution = createRequireNotificationExecution(executionDependencies);

  router.get("/templates", controller.templates);
  router.post("/templates/:template/preview", controller.preview);
  router.post("/templates/:template/send", requireNotificationExecution, controller.send);
  router.post("/workflows/:workflow", requireNotificationExecution, controller.workflow);
  router.post(
    "/documents/:documentId/expiration/send",
    requireNotificationExecution,
    controller.documentExpiration,
  );
  router.post("/processes/document-expirations/run", requireNotificationExecution, controller.documentExpirations);
  router.post("/processes/agreement-expirations/run", requireNotificationExecution, controller.agreementExpirations);

  return router;
}
