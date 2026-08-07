import "dotenv/config";
import { closeDatabasePool } from "../src/config/database.js";
import { createNotificationRepository } from "../src/repositories/notificationRepository.js";
import { createNotificationService } from "../src/services/notificationService.js";

const ALLOWED_PROCESSES = new Set(["document-expirations", "agreement-expirations", "all"]);

function argumentsMap(argv) {
  const result = new Map();
  for (const argument of argv) {
    if (argument === "--commit") {
      result.set("commit", true);
      continue;
    }
    const [key, ...parts] = argument.replace(/^--/, "").split("=");
    result.set(key, parts.join("="));
  }
  return result;
}

const args = argumentsMap(process.argv.slice(2));
const selectedProcess = args.get("process") || "all";
if (!ALLOWED_PROCESSES.has(selectedProcess)) {
  throw new Error("--process debe ser document-expirations, agreement-expirations o all.");
}

const asOf = args.get("date");
if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  throw new Error("--date debe usar el formato YYYY-MM-DD.");
}

const dryRun = args.get("commit") !== true;
const service = createNotificationService({
  repository: createNotificationRepository(),
});

const output = { mode: dryRun ? "dry-run" : "commit", results: [] };

try {
  if (["document-expirations", "all"].includes(selectedProcess)) {
    output.results.push(await service.runDocumentExpirationProcess({ asOf, dryRun }));
  }
  if (["agreement-expirations", "all"].includes(selectedProcess)) {
    output.results.push(await service.runAgreementExpirationProcess({ asOf, dryRun }));
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} finally {
  await closeDatabasePool();
}
