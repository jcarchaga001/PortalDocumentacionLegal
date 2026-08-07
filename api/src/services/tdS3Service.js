import { tdApiRequest } from "./tdApiClient.js";
import { normalizedSuccess, validationFailure } from "./serviceResult.js";

function validateS3Key(s3Key, required = true) {
  if (!s3Key && !required) return null;
  if (typeof s3Key !== "string" || !s3Key.trim()) {
    return validationFailure("s3Key es obligatorio.", "s3Key");
  }
  if (/[\\/]/.test(s3Key)) {
    return validationFailure("s3Key no puede contener '/' ni '\\'.", "s3Key");
  }
  return null;
}

export async function uploadFileToS3(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return validationFailure("El contenido de carga es obligatorio.", "payload");
  }

  const contentFields = ["fileText", "fileBase64", "jsonBody"];
  if (!contentFields.some((field) => Object.hasOwn(payload, field))) {
    return validationFailure("Debe enviarse fileText, fileBase64 o jsonBody.", "payload");
  }

  if (!payload.fileName && !payload.s3Key) {
    return validationFailure("Debe enviarse fileName o s3Key.", "fileName");
  }

  const keyError = validateS3Key(payload.s3Key, false);
  if (keyError) return keyError;

  return tdApiRequest({ path: "/s3/upload", method: "POST", body: payload });
}

export async function getS3TemporaryUrl({ s3Key, expiresInSeconds } = {}) {
  const keyError = validateS3Key(s3Key);
  if (keyError) return keyError;

  if (
    expiresInSeconds !== undefined &&
    (!Number.isInteger(Number(expiresInSeconds)) || Number(expiresInSeconds) < 1 || Number(expiresInSeconds) > 604_800)
  ) {
    return validationFailure("expiresInSeconds debe estar entre 1 y 604800.", "expiresInSeconds");
  }

  return tdApiRequest({
    path: "/s3/url",
    query: { s3Key, expiresInSeconds },
  });
}

export async function downloadS3File({ s3Key } = {}) {
  const keyError = validateS3Key(s3Key);
  if (keyError) return keyError;

  const result = await tdApiRequest({
    path: "/s3/download",
    query: { s3Key },
    responseType: "buffer",
  });

  if (!result.success) return result;

  return normalizedSuccess(result.message, {
    buffer: result.data,
    contentType: result.meta?.contentType || "application/octet-stream",
    contentDisposition: result.meta?.contentDisposition,
  });
}

