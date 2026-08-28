import assert from "node:assert/strict";
import test from "node:test";
import {
  createDocumentService,
  normalizeAttachment,
  normalizeDocumentPayload,
} from "../src/services/documentService.js";

const auth = Object.freeze({ id: 99, countryCode: 4, positionCode: 32 });

function validPayload(overrides = {}) {
  return {
    branchId: 10,
    documentType: 1,
    description: "Contrato prueba",
    categoryId: 2,
    subcategoryId: 5,
    level: 1,
    isReferential: false,
    documentDate: "2026-08-01",
    expirationDate: "2027-08-01",
    secondaryReference: "R2",
    attachment: {
      fileName: "documento.pdf",
      fileBase64: Buffer.from("pdf-test").toString("base64"),
    },
    ...overrides,
  };
}

test("registro documental conserva campos y sube el archivo con clave S3 legacy", async () => {
  const calls = [];
  const repository = {
    async create(countryCode, userId, document, attachment) {
      calls.push({ countryCode, userId, document, attachment });
      return { id: 123, reference: "CNT-01-000001" };
    },
  };
  const service = createDocumentService(repository, {
    async uploadFileToS3(payload) {
      calls.push({ upload: payload });
      return { success: true, data: {} };
    },
  });

  const result = await service.create(auth, validPayload());
  assert.equal(result.id, 123);
  assert.match(calls[0].upload.s3Key, /^[A-Za-z0-9_-]{8}\.pdf$/);
  assert.equal(calls[0].upload.metadata.table, "tblArchivosDocumentos");
  assert.equal(calls[1].countryCode, 4);
  assert.equal(calls[1].userId, 99);
  assert.equal(calls[1].document.documentType, 1);
  assert.equal(calls[1].attachment.fileName, "documento.pdf");
  assert.equal(calls[1].attachment.buffer.toString(), "pdf-test");
});

test("registro desde detalle de sucursal fuerza documento principal de sucursal", async () => {
  let captured;
  const service = createDocumentService({
    async create(_countryCode, _userId, document) {
      captured = document;
      return { id: 8 };
    },
  }, {
    async uploadFileToS3() {
      return { success: true };
    },
  });
  await service.createBranchDocument(auth, 77, validPayload({ branchId: 999, documentType: 2 }));
  assert.equal(captured.branchId, 77);
  assert.equal(captured.documentType, 1);
  assert.equal(captured.isActivePrincipal, true);
});

test("si S3 falla no se escribe metadata documental", async () => {
  let wrote = false;
  const service = createDocumentService({
    async create() {
      wrote = true;
    },
  }, {
    async uploadFileToS3() {
      return { success: false, message: "S3 no disponible" };
    },
  });
  await assert.rejects(() => service.create(auth, validPayload()), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.code, "DOCUMENT_STORAGE_ERROR");
    return true;
  });
  assert.equal(wrote, false);
});

test("descarga usa S3 y conserva el blob como respaldo del legacy", async () => {
  const repository = {
    async getAttachment() {
      return {
        fileName: "documento.pdf",
        extension: "pdf",
        s3Key: "abc.pdf",
        buffer: Buffer.from("legacy"),
      };
    },
  };
  const remoteService = createDocumentService(repository, {
    async downloadS3File() {
      return { success: true, data: { buffer: Buffer.from("s3"), contentType: "text/plain" } };
    },
  });
  const remoteAttachment = await remoteService.attachment(4, 1);
  assert.equal(remoteAttachment.buffer.toString(), "s3");
  assert.equal(remoteAttachment.contentType, "application/pdf");

  const fallbackService = createDocumentService(repository, {
    async downloadS3File() {
      return { success: false };
    },
  });
  assert.equal((await fallbackService.attachment(4, 1)).buffer.toString(), "legacy");
});

test("visor de libros corrige el MIME remoto aun si ext conserva punto o mayusculas", async () => {
  const service = createDocumentService({
    async getBookEvidence() {
      return {
        fileName: "FA63 Psicotropicas.pdf",
        extension: ".PDF",
        s3Key: "evidencia",
      };
    },
  }, {
    async downloadS3File() {
      return { success: true, data: { buffer: Buffer.from("%PDF-1.4"), contentType: "text/plain" } };
    },
  });

  const evidence = await service.bookEvidence(4, 226, 61);
  assert.equal(evidence.contentType, "application/pdf");
});

test("permisos de eliminacion replican puestos 7 y 32", async () => {
  const service = createDocumentService({
    async softDelete() {
      return { id: 1 };
    },
  });
  assert.throws(
    () => service.remove({ ...auth, positionCode: 3 }, 1),
    (error) => error.status === 403 && error.code === "FORBIDDEN",
  );
  assert.deepEqual(await service.remove(auth, 1), { id: 1 });
});

test("formatos de archivo coinciden con ComprimirArchivosMultimedia del legacy", () => {
  for (const extension of ["pdf", "jpg", "jpeg", "png", "bmp"]) {
    const attachment = normalizeAttachment({
      fileName: `archivo.${extension}`,
      fileBase64: Buffer.from("x").toString("base64"),
    });
    assert.equal(attachment.extension, extension);
  }
  assert.throws(
    () => normalizeAttachment({ fileName: "archivo.docx", fileBase64: "eA==" }),
    (error) => error.status === 400
      && error.field === "attachment"
      && error.message === "El formato del documento no es permitido",
  );
});

test("detalle sucursal conserva nivel opcional y exige ambas fechas aun si es referencial", () => {
  const referential = normalizeDocumentPayload(validPayload({ isReferential: true, level: undefined }));
  assert.equal(referential.isReferential, true);
  assert.equal(referential.level, null);
  assert.equal(referential.documentDate, "2026-08-01");
  assert.throws(
    () => normalizeDocumentPayload(validPayload({ isReferential: true, documentDate: undefined })),
    (error) => error.field === "documentDate",
  );
  assert.throws(
    () => normalizeDocumentPayload(validPayload({ isReferential: true, expirationDate: undefined })),
    (error) => error.field === "expirationDate",
  );
});
