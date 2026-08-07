import { Router } from "express";
import { apiHealth, databaseHealth } from "../controllers/healthController.js";

export function createHealthRouter() {
  const router = Router();
  router.get("/", apiHealth);
  router.get("/database", databaseHealth);
  return router;
}

