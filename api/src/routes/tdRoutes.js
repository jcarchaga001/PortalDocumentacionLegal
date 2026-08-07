import { Router } from "express";
import { createTdS3Controller } from "../controllers/tdS3Controller.js";
import { health, send } from "../controllers/tdMailController.js";
import { createRequireNotificationExecution } from "../middlewares/requireNotificationExecution.js";

export function createTdRouter(executionDependencies = {}, s3Dependencies = {}) {
  const router = Router();
  const s3Controller = createTdS3Controller(s3Dependencies);
  const requireLiveMailExecution = createRequireNotificationExecution({
    ...executionDependencies,
    forceLive: true,
  });

  router.post("/s3/upload", s3Controller.upload);
  router.get("/s3/url", s3Controller.temporaryUrl);
  router.get("/s3/download", s3Controller.download);
  router.get("/mail/health", health);
  router.post("/mail/send", requireLiveMailExecution, send);

  return router;
}
