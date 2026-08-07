import { timingSafeEqual } from "node:crypto";
import { normalizedFailure } from "../services/serviceResult.js";

function includesNumber(values, candidate) {
  const normalized = Buffer.from(String(Number(candidate) || 0));
  return values.some((value) => {
    const allowed = Buffer.from(String(Number(value) || 0));
    return allowed.length === normalized.length && timingSafeEqual(allowed, normalized);
  });
}

export function createRequireAuthorization({ positionCodes = [], userIds = [] } = {}) {
  return function requireAuthorization(req, res, next) {
    if (
      includesNumber(positionCodes, req.auth?.positionCode)
      || includesNumber(userIds, req.auth?.id)
    ) {
      return next();
    }
    return res.status(403).json(
      normalizedFailure("No tiene permisos para realizar esta operacion.", { code: "FORBIDDEN" }),
    );
  };
}
