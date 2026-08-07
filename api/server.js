import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./src/app.js";
import { closeDatabasePool } from "./src/config/database.js";
import { getPort, normalizeBasePath, requireEnvironment } from "./src/config/runtime.js";

// CAMBIAR AQUI LA RUTA BASE DEL PORTAL SI EL PROYECTO USA OTRA SUBRUTA
const basePath = normalizeBasePath(requireEnvironment("BASE_PATH"), "BASE_PATH");
const port = getPort("PORT", 3003);
const app = createApp({ basePath });
const server = createServer(app);

server.listen(port, () => {
  console.log(`Documentacion Legal API disponible bajo ${basePath}/api en el puerto ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} recibido; cerrando API.`);
  server.close(async () => {
    await closeDatabasePool();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

