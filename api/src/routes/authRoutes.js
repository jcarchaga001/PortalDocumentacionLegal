import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createAuthController } from "../controllers/authController.js";
import { createRequireAuthentication } from "../middlewares/requireAuthentication.js";
import { normalizedFailure } from "../services/serviceResult.js";

export function createAuthRouter({ authService, sessionService, passwordRecoveryService }) {
  const router = Router();
  const controller = createAuthController({ authService, sessionService, passwordRecoveryService });
  const requireAuthentication = createRequireAuthentication(sessionService, { allowPasswordReset: true });
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_req, res) {
      res.status(429).json(
        normalizedFailure("Demasiados intentos. Espere unos minutos antes de volver a intentar.", {
          code: "TOO_MANY_ATTEMPTS",
        }),
      );
    },
  });
  const recoveryLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_req, res) {
      res.status(429).json(
        normalizedFailure("Demasiadas solicitudes de recuperacion. Intente mas tarde.", {
          code: "TOO_MANY_RECOVERY_ATTEMPTS",
        }),
      );
    },
  });

  router.get("/countries", controller.countries);
  router.post("/login", loginLimiter, controller.login);
  router.post("/password-recovery", recoveryLimiter, controller.requestPasswordRecovery);
  router.get("/me", requireAuthentication, controller.me);
  router.post("/reset-password", requireAuthentication, controller.resetPassword);
  router.post("/logout", controller.logout);
  return router;
}
