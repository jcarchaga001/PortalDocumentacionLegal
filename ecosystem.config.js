const path = require("node:path");

const DEPLOY_ROOT = "/var/www/nodeapps";
// CAMBIAR AQUI UNICAMENTE LA CARPETA FISICA DEL PROYECTO EN EL SERVIDOR
const PROJECT_FOLDER = "NOMBRE_CARPETA_PROYECTO";
const PROJECT_ROOT = path.join(DEPLOY_ROOT, PROJECT_FOLDER);

module.exports = {
  apps: [
    {
      name: "documentacion-legal-api",
      script: "server.js",
      cwd: path.join(PROJECT_ROOT, "api"),
      env: {
        NODE_ENV: "production",
        PORT: 3003,
      },
    },
    {
      name: "documentacion-legal-web",
      script: "server.js",
      cwd: path.join(PROJECT_ROOT, "web"),
      env: {
        NODE_ENV: "production",
        PORT: 3002,
      },
    },
  ],
};
