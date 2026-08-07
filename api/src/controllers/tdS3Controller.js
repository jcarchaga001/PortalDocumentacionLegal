import { randomBytes } from "node:crypto";
import { createS3AuthorizationRepository } from "../repositories/s3AuthorizationRepository.js";
import {
  downloadS3File,
  getS3TemporaryUrl,
  uploadFileToS3,
} from "../services/tdS3Service.js";
import { normalizedFailure } from "../services/serviceResult.js";

function resultStatus(result) {
  if (result.success) return 200;
  return result.error?.code === "VALIDATION_ERROR" ? 400 : 502;
}

function generatedS3Key(fileName) {
  const extension = String(fileName || "").trim().match(/\.([A-Za-z0-9]{1,6})$/)?.[1]?.toLowerCase();
  const token = randomBytes(6).toString("base64url");
  return extension ? `${token}.${extension}` : token;
}

function unavailable(res) {
  return res.status(404).json(normalizedFailure(
    "El archivo solicitado no existe o no esta disponible.",
    { code: "FILE_NOT_AVAILABLE" },
  ));
}

export function createTdS3Controller({
  authorizationRepository = createS3AuthorizationRepository(),
  uploadFileToS3Impl = uploadFileToS3,
  getS3TemporaryUrlImpl = getS3TemporaryUrl,
  downloadS3FileImpl = downloadS3File,
  generateKey = generatedS3Key,
} = {}) {
  async function authorize(req, res, s3Key) {
    if (!s3Key || !await authorizationRepository.isKeyAccessible(req.auth.countryCode, s3Key)) {
      unavailable(res);
      return false;
    }
    return true;
  }

  return {
    async upload(req, res, next) {
      try {
        if (req.body && Object.hasOwn(req.body, "s3Key")) {
          return res.status(400).json(normalizedFailure(
            "La clave del archivo es generada exclusivamente por el servidor.",
            { code: "VALIDATION_ERROR", field: "s3Key" },
          ));
        }
        const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
        if (!fileName || fileName.length > 255) {
          return res.status(400).json(normalizedFailure(
            "El nombre del archivo es obligatorio.",
            { code: "VALIDATION_ERROR", field: "fileName" },
          ));
        }
        const s3Key = generateKey(fileName);
        const result = await uploadFileToS3Impl({
          ...req.body,
          fileName,
          s3Key,
          metadata: {
            ...(req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {}),
            countryCode: String(req.auth.countryCode),
            uploadedBy: String(req.auth.id),
          },
        });
        if (result.success) {
          const upstreamData = result.data && typeof result.data === "object" && !Array.isArray(result.data)
            ? result.data
            : {};
          result.data = { ...upstreamData, s3Key };
        }
        return res.status(resultStatus(result)).json(result);
      } catch (error) {
        return next(error);
      }
    },

    async temporaryUrl(req, res, next) {
      try {
        const s3Key = req.query.s3Key;
        if (!await authorize(req, res, s3Key)) return undefined;
        const result = await getS3TemporaryUrlImpl({
          s3Key,
          expiresInSeconds: req.query.expiresInSeconds,
        });
        return res.status(resultStatus(result)).json(result);
      } catch (error) {
        return next(error);
      }
    },

    async download(req, res, next) {
      try {
        const s3Key = req.query.s3Key;
        if (!await authorize(req, res, s3Key)) return undefined;
        const result = await downloadS3FileImpl({ s3Key });

        if (!result.success) {
          return res.status(resultStatus(result)).json(result);
        }

        res.setHeader("Content-Type", result.data.contentType);
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(s3Key)}`);
        return res.send(result.data.buffer);
      } catch (error) {
        return next(error);
      }
    },
  };
}

export { generatedS3Key };
