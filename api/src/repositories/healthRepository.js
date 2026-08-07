import { getDatabasePool } from "../config/database.js";

export async function pingDatabase() {
  const pool = getDatabasePool();
  const [rows] = await pool.query("SELECT 1 AS healthy");
  return rows[0]?.healthy === 1;
}

