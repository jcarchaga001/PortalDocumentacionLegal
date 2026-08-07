import { normalizedFailure } from "../services/serviceResult.js";
import { SESSION_COOKIE_NAME } from "../services/sessionService.js";

export function createRequireAuthentication(sessionService, { allowPasswordReset = false } = {}) {
  return async function requireAuthentication(req, res, next) {
    const token = req.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      return res.status(401).json(
        normalizedFailure("La sesion no es valida o ha vencido.", { code: "UNAUTHENTICATED" }),
      );
    }

    try {
      req.auth = await sessionService.verifyToken(token);
      if (req.auth.mustResetPassword && !allowPasswordReset) {
        return res.status(403).json(
          normalizedFailure("Debe cambiar la contrasena temporal antes de continuar.", {
            code: "PASSWORD_RESET_REQUIRED",
          }),
        );
      }
      return next();
    } catch {
      sessionService.clearCookie(res);
      return res.status(401).json(
        normalizedFailure("La sesion no es valida o ha vencido.", { code: "UNAUTHENTICATED" }),
      );
    }
  };
}
