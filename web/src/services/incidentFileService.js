import { fileToBase64 } from "./fileHelpers.js";
import { uploadFileToS3 } from "./tdS3Service.js";

export async function uploadIncidentFile(file, metadata = {}) {
  if (!file) return { success: true, data: { s3Key: null, fileName: null } };
  const result = await uploadFileToS3({
    fileBase64: await fileToBase64(file),
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    metadata: { module: "DocumentacionLegal", domain: "incidents", ...metadata },
  });
  if (!result.success) return result;
  const s3Key = result.data?.s3Key;
  if (!s3Key) return { success: false, message: "El API no devolvio la clave del archivo." };
  return { success: true, data: { s3Key, fileName: file.name } };
}
