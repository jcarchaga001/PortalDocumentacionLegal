import { normalizedFailure } from "../services/serviceResult.js";

export function notFoundHandler(req, res) {
  res.status(404).json(
    normalizedFailure("El recurso solicitado no existe.", {
      code: "NOT_FOUND",
      path: req.originalUrl,
    }),
  );
}

export function errorHandler(error, _req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const publicMessage = status >= 500 ? "Ocurrio un error inesperado en el servidor." : error.message;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json(
    normalizedFailure(publicMessage, {
      code: error.code || "INTERNAL_ERROR",
      ...(error.field ? { field: error.field } : {}),
    }),
  );
}
