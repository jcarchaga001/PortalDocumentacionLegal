import { Router } from "express";
import { createIncidentController } from "../controllers/incidentController.js";
import { createRequireAuthorization } from "../middlewares/requireAuthorization.js";

export function createIncidentRouter(incidentService) {
  const router = Router();
  const controller = createIncidentController(incidentService);
  const requireIncidentClose = createRequireAuthorization({ positionCodes: [7, 32], userIds: [1578] });

  router.get("/catalogs/:scope", controller.catalogs);
  router.get("/labor/cases", controller.laborCases);
  router.get("/labor/actions", controller.laborActions);
  router.post("/labor/cases/:caseId/actions", controller.createLaborAction);
  router.post("/labor/cases/:caseId/comments", controller.addLaborComment);
  router.patch("/labor/actions/:actionId", controller.updateLaborAction);
  router.patch("/labor/cases/:caseId", controller.updateLaborCase);
  router.get("/labor/cases/:caseId", controller.laborCase);
  router.get("/:scope/actions", controller.actions);
  router.patch("/:scope/actions/:actionId", controller.updateIncidentAction);
  router.post("/:scope/:incidentId/actions", controller.createIncidentAction);
  router.post("/:scope/:incidentId/comments", controller.addIncidentComment);
  router.post("/:scope/:incidentId/close", requireIncidentClose, controller.closeIncident);
  router.get("/:scope/:incidentId", controller.incident);
  router.post("/:scope", controller.createIncident);
  router.get("/:scope", controller.incidents);

  return router;
}
