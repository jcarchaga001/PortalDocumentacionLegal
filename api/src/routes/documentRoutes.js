import { Router } from "express";
import { createDocumentController } from "../controllers/documentController.js";
import { createRequireAuthorization } from "../middlewares/requireAuthorization.js";

export function createDocumentRouter(documentService) {
  const router = Router();
  const controller = createDocumentController(documentService);
  const requireDocumentDelete = createRequireAuthorization({ positionCodes: [7, 32] });
  router.get("/catalogs", controller.catalogs);
  router.get("/branches/:branchId", controller.branch);
  router.post("/branches/:branchId/documents", controller.createBranchDocument);
  router.post("/branches/:branchId/books/:assignmentId/evidence", controller.addBookEvidence);
  router.patch("/branches/:branchId/books/:assignmentId", controller.updateBookRequired);
  router.get("/branches/:branchId/books/evidence/:evidenceId/attachment", controller.bookEvidence);
  router.delete(
    "/branches/:branchId/books/evidence/:evidenceId",
    requireDocumentDelete,
    controller.removeBookEvidence,
  );
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id/attachment", controller.attachment);
  router.post("/:id/approve", controller.approve);
  router.post("/:id/reject", controller.reject);
  router.patch("/:id/reference-2", controller.updateReference2);
  router.delete("/:id", requireDocumentDelete, controller.remove);
  router.get("/:id", controller.get);
  return router;
}
