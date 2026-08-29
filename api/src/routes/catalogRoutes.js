import { Router } from "express";
import { createCatalogController } from "../controllers/catalogController.js";
import { createRequireAuthorization } from "../middlewares/requireAuthorization.js";

export function createCatalogRouter(catalogService) {
  const router = Router();
  const controller = createCatalogController(catalogService);
  const requireUserPermissionManagement = createRequireAuthorization({ positionCodes: [7, 15] });

  router.get("/lookups", controller.lookups);

  router.get("/users/lookups", requireUserPermissionManagement, controller.userPermissionLookups);
  router.get("/users", requireUserPermissionManagement, controller.listUsers);
  router.patch("/users/:id/access", requireUserPermissionManagement, controller.setUserAccess);

  router.get("/providers", controller.listProviders);
  router.get("/providers/branches", controller.listProviderBranches);
  router.get("/providers/:id/destinations", controller.listProviderDestinations);
  router.post("/providers", controller.createProvider);
  router.put("/providers/:id", controller.updateProvider);

  router.get("/document-categories/lookups", controller.documentCategoryLookups);
  router.get("/document-categories", controller.listCategories);
  router.patch("/document-categories/:id/access", controller.setCategoryAccess);

  router.get("/government-entities/lookups", controller.entityLookups);
  router.get("/government-entities", controller.listEntities);
  router.post("/government-entities", controller.createEntity);
  router.put("/government-entities/:id", controller.updateEntity);
  router.delete("/government-entities/:id", controller.deactivateEntity);

  router.get("/legal-actions", controller.listLegalActions);
  router.get("/legal-actions/:id", controller.getLegalAction);
  router.post("/legal-actions", controller.createLegalAction);
  router.put("/legal-actions/:id", controller.updateLegalAction);

  return router;
}
