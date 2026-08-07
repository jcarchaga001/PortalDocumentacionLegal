import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { attachNotificationExecutionToken } from "./notificationProxy.js";

function readBasePath(env) {
  // CAMBIAR AQUI LA RUTA BASE DEL PORTAL SI EL PROYECTO USA OTRA SUBRUTA
  const configuredPath = env.VITE_BASE_PATH?.trim();
  if (!configuredPath) {
    throw new Error("Falta VITE_BASE_PATH. Configure la subruta real del portal.");
  }

  const normalized = configuredPath.replace(/\/$/, "");
  if (!normalized.startsWith("/") || normalized === "/") {
    throw new Error("VITE_BASE_PATH debe ser una subruta como /NOMBRE_PROYECTO.");
  }
  return normalized;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const basePath = readBasePath(env);
  const apiProxyTarget = env.API_PROXY_TARGET?.trim();
  const notificationRunToken = env.NOTIFICATION_RUN_TOKEN;

  return {
    base: `${basePath}/`,
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (
              id.includes("@ant-design/icons") ||
              id.includes("/antd/") ||
              id.includes("\\antd\\")
            ) {
              return "antd";
            }
            return "vendor";
          },
        },
      },
    },
    server: {
      port: Number(env.PORT || 3002),
      strictPort: true,
      proxy: apiProxyTarget
        ? {
            [`${basePath}/api`]: {
              target: apiProxyTarget,
              changeOrigin: true,
              configure(proxy) {
                proxy.on("proxyReq", (proxyRequest, request) => {
                  attachNotificationExecutionToken(proxyRequest, request, notificationRunToken);
                });
              },
            },
          }
        : undefined,
    },
  };
});
