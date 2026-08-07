import { pingDatabase } from "../repositories/healthRepository.js";
import { normalizedFailure, normalizedSuccess } from "./serviceResult.js";

export function getApiHealth() {
  return normalizedSuccess("API disponible.", {
    service: "documentacion-legal-api",
    timestamp: new Date().toISOString(),
  });
}

export async function getDatabaseHealth(ping = pingDatabase) {
  try {
    const healthy = await ping();
    return healthy
      ? normalizedSuccess("Conexion MySQL disponible.", { database: "available" })
      : normalizedFailure("MySQL no confirmo una respuesta valida.", { code: "DATABASE_INVALID_RESPONSE" });
  } catch (error) {
    console.error("Database health check failed.", error?.code || error?.name || "UNKNOWN");
    return normalizedFailure("No fue posible conectar con MySQL.", {
      code: "DATABASE_UNAVAILABLE",
    });
  }
}
