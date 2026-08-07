import { getApiHealth, getDatabaseHealth } from "../services/systemHealthService.js";

export function apiHealth(_req, res) {
  res.json(getApiHealth());
}

export async function databaseHealth(_req, res) {
  const result = await getDatabaseHealth();
  res.status(result.success ? 200 : 503).json(result);
}

