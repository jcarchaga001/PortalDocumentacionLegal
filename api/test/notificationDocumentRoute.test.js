import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import { createNotificationRouter } from "../src/routes/notificationRoutes.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";

async function withServer(context, executionDependencies, notificationService, action) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { id: 1, countryCode: 4, positionCode: 7 };
    next();
  });
  app.use("/notifications", createNotificationRouter(notificationService, executionDependencies));
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return action(`http://127.0.0.1:${server.address().port}/notifications`);
}

test("el envío manual queda bloqueado por la guardia y responde normalizado", async (context) => {
  let executions = 0;
  await withServer(
    context,
    { enabled: false },
    {
      async sendDocumentExpiration() {
        executions += 1;
        return { sent: true };
      },
    },
    async (origin) => {
      const response = await fetch(`${origin}/documents/70/expiration/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const body = await response.json();
      assert.equal(response.status, 403);
      assert.equal(body.success, false);
      assert.equal(body.error.code, "NOTIFICATION_EXECUTION_DISABLED");
    },
  );
  assert.equal(executions, 0);
});

test("el envío autorizado toma país e id de la ruta sin aceptar destinatario del cliente", async (context) => {
  const token = "t".repeat(32);
  let received;
  await withServer(
    context,
    { enabled: true, token, positionCodes: "7" },
    {
      async sendDocumentExpiration(input) {
        received = input;
        return { sent: true, dryRun: false, recipientCount: 1 };
      },
    },
    async (origin) => {
      const response = await fetch(`${origin}/documents/70/expiration/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-notification-run-token": token,
        },
        body: JSON.stringify({ dryRun: false, to: "alterado@example.com", countryCode: 99 }),
      });
      const body = await response.json();
      assert.equal(response.status, 202);
      assert.equal(body.success, true);
      assert.equal(body.data.sent, true);
    },
  );
  assert.deepEqual(received, { countryCode: 4, documentId: "70", dryRun: false });
});
