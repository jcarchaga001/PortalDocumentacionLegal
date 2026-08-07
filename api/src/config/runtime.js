import "dotenv/config";

export function requireEnvironment(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria ${name}.`);
  }

  return value;
}

export function normalizeBasePath(value, variableName = "BASE_PATH") {
  const normalized = value.trim().replace(/\/$/, "");

  if (!normalized.startsWith("/") || normalized === "/") {
    throw new Error(`${variableName} debe ser una subruta que empiece con '/', por ejemplo /NOMBRE_PROYECTO.`);
  }

  if (normalized.includes("\\") || normalized.includes("?") || normalized.includes("#")) {
    throw new Error(`${variableName} contiene caracteres no permitidos.`);
  }

  return normalized;
}

export function getPort(name, fallback) {
  const rawValue = process.env[name]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;

  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} debe ser un puerto valido.`);
  }

  return value;
}

export function getPositiveInteger(name, fallback) {
  const rawValue = process.env[name]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo.`);
  }

  return value;
}

