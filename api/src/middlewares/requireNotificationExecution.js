import { timingSafeEqual } from "node:crypto";
import { normalizedFailure } from "../services/serviceResult.js";

function enabledByEnvironment(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function parsePositionCodes(value) {
  const source = Array.isArray(value) ? value : String(value || "7,15,32").split(",");
  return new Set(source.map(Number).filter((item) => Number.isInteger(item) && item > 0));
}

function tokensMatch(expected, supplied) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const suppliedBuffer = Buffer.from(String(supplied || ""), "utf8");
  if (expectedBuffer.length < 32 || expectedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function forbidden(res, message, code) {
  return res.status(403).json(normalizedFailure(message, { code }));
}

export function createRequireNotificationExecution({
  enabled = enabledByEnvironment(process.env.NOTIFICATION_LIVE_ENABLED),
  token = process.env.NOTIFICATION_RUN_TOKEN,
  positionCodes = process.env.NOTIFICATION_ADMIN_POSITION_CODES,
  forceLive = false,
} = {}) {
  const allowedPositions = parsePositionCodes(positionCodes);

  return function requireNotificationExecution(req, res, next) {
    if (!forceLive && req.body?.dryRun !== false) return next();
    if (!enabled) {
      return forbidden(
        res,
        "La ejecución real de notificaciones está deshabilitada.",
        "NOTIFICATION_EXECUTION_DISABLED",
      );
    }
    if (!allowedPositions.has(Number(req.auth?.positionCode))) {
      return forbidden(
        res,
        "No tiene permisos para ejecutar notificaciones reales.",
        "NOTIFICATION_EXECUTION_FORBIDDEN",
      );
    }
    if (!tokensMatch(token, req.get("x-notification-run-token"))) {
      return forbidden(
        res,
        "No se pudo autorizar la ejecución real de notificaciones.",
        "NOTIFICATION_EXECUTION_FORBIDDEN",
      );
    }
    return next();
  };
}
