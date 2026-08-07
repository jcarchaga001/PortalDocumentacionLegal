import assert from "node:assert/strict";
import test from "node:test";
import { getS3TemporaryUrl, uploadFileToS3 } from "../src/services/tdS3Service.js";
import { sendMail } from "../src/services/tdMailService.js";

test("S3 rechaza claves con separadores de ruta", async () => {
  const result = await uploadFileToS3({
    fileText: "contenido",
    fileName: "archivo.txt",
    s3Key: "carpeta/archivo.txt",
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.error.field, "s3Key");
});

test("S3 limita la vigencia de URL temporal", async () => {
  const result = await getS3TemporaryUrl({
    s3Key: "archivo.pdf",
    expiresInSeconds: 604_801,
  });

  assert.equal(result.success, false);
  assert.equal(result.error.field, "expiresInSeconds");
});

test("SMTP requiere destinatario, asunto y contenido", async () => {
  const withoutRecipient = await sendMail({ subject: "Asunto", text: "Mensaje" });
  const withoutSubject = await sendMail({ to: "persona@dominio.com", text: "Mensaje" });
  const withoutContent = await sendMail({ to: "persona@dominio.com", subject: "Asunto" });

  assert.equal(withoutRecipient.error.field, "to");
  assert.equal(withoutSubject.error.field, "subject");
  assert.equal(withoutContent.error.field, "text");
});

