import mysql from "mysql2/promise";
import { requireEnvironment } from "./runtime.js";

let pool;

export function getDatabasePool() {
  if (!pool) {
    const port = Number(process.env.DB_PORT || 3306);

    if (!Number.isInteger(port) || port <= 0) {
      throw new Error("DB_PORT debe ser un puerto valido.");
    }

    pool = mysql.createPool({
      host: requireEnvironment("DB_HOST"),
      port,
      user: requireEnvironment("DB_USER"),
      password: process.env.DB_PASSWORD ?? "",
      database: requireEnvironment("DB_NAME"),
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60_000,
      queueLimit: 0,
      enableKeepAlive: true,
    });
  }

  return pool;
}

export async function closeDatabasePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

