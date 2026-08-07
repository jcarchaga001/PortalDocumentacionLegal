import { portalApiRequest } from "./portalApiClient.js";

export function uploadFileToS3(payload) {
  return portalApiRequest({ path: "td/s3/upload", method: "POST", body: payload });
}

export function getS3TemporaryUrl({ s3Key, expiresInSeconds }) {
  return portalApiRequest({
    path: "td/s3/url",
    query: { s3Key, expiresInSeconds },
  });
}

export function downloadS3File({ s3Key }) {
  return portalApiRequest({
    path: "td/s3/download",
    query: { s3Key },
    responseType: "blob",
  });
}

