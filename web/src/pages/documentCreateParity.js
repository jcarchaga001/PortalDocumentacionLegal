import { fileExtension } from "../config/legacyFileContracts.js";

export const LEGACY_DOCUMENT_REGISTRATION_SURFACE = "registration";

export function legacyRegistrationBranchLabel(documentType) {
  if (Number(documentType) === 1) return "Sucursal";
  if (Number(documentType) === 2) return "Area";
  return "";
}

export function legacyRegistrationShowsDates(isReferential) {
  return !Boolean(isReferential);
}

export function legacyRegistrationPreviewKind(fileName) {
  const extension = fileExtension(fileName);
  if (extension === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "bmp"].includes(extension)) return "image";
  return "unsupported";
}
