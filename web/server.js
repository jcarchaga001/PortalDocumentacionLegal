import "dotenv/config";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachNotificationExecutionToken } from "./notificationProxy.js";

function requireBasePath() {
  // CAMBIAR AQUI LA RUTA BASE DEL PORTAL SI EL PROYECTO USA OTRA SUBRUTA
  const configuredPath = process.env.VITE_BASE_PATH?.trim() || process.env.BASE_PATH?.trim();

  if (!configuredPath) {
    throw new Error("Falta VITE_BASE_PATH (o BASE_PATH). Configure la subruta real del portal.");
  }

  const normalized = configuredPath.replace(/\/$/, "");
  if (!normalized.startsWith("/") || normalized === "/") {
    throw new Error("VITE_BASE_PATH debe ser una subruta como /NOMBRE_PROYECTO; no puede ser '/'.");
  }
  if (normalized.includes("\\") || normalized.includes("?") || normalized.includes("#")) {
    throw new Error("VITE_BASE_PATH contiene caracteres no permitidos.");
  }

  return normalized;
}

const basePath = requireBasePath();
const port = Number(process.env.PORT || 3002);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT debe ser un puerto valido.");
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(currentDirectory, "dist");
const indexFile = path.join(distDirectory, "index.html");
const app = express();

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const apiProxyTarget = process.env.API_PROXY_TARGET?.trim();
if (apiProxyTarget) {
  const target = new URL(apiProxyTarget);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
    throw new Error("API_PROXY_TARGET debe ser una URL HTTP(S) sin credenciales.");
  }

  app.use(
    `${basePath}/api`,
    createProxyMiddleware({
      target: target.origin,
      changeOrigin: true,
      xfwd: true,
      pathRewrite: (requestPath) => `${basePath}/api${requestPath}`,
      on: {
        proxyReq(proxyRequest, request) {
          attachNotificationExecutionToken(
            proxyRequest,
            request,
            process.env.NOTIFICATION_RUN_TOKEN,
          );
        },
      },
    }),
  );
}

app.use(basePath, express.static(distDirectory, { index: false, redirect: false }));

app.get(basePath, (_req, res) => res.sendFile(indexFile));
app.get(`${basePath}/*`, (_req, res) => res.sendFile(indexFile));

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: `El portal solo esta disponible bajo la subruta configurada ${basePath}.`,
    data: null,
    error: { code: "NOT_FOUND" },
  });
});

app.listen(port, () => {
  console.log(`Documentacion Legal WEB disponible bajo ${basePath} en el puerto ${port}`);
});
