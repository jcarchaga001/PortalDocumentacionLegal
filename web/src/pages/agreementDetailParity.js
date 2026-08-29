export const AGREEMENT_DETAIL_QUERY_ERROR = "Error executing query.";

export const AGREEMENT_DETAIL_CONTROL_CHAIN = Object.freeze({
  IE6Al12IIkiadNdakeKpxw: "VolverOnClick",
  rdJ8DNY_QUK1G23RL0J99Q: "EditarOnClick",
  u21JdMj9VE6oU8PxlxTgmw: "VerClienteOnClick",
  "3UbOoptDbkSid7ioC6Cwfw": "VerOnClick",
  MW0AZANyEkyTatCBALXwZw: "DescargarArchivoOnClick",
});

export const LEGACY_AGREEMENT_PREVIEW_EXTENSIONS = Object.freeze([
  ".pdf",
  ".jpeg",
  ".jpg",
  ".png",
]);

export function agreementIdFromSearch(search) {
  const value = Number(new URLSearchParams(search).get("CodConvenio"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function isLegacyAgreementPreviewable(extension) {
  return LEGACY_AGREEMENT_PREVIEW_EXTENSIONS.includes(String(extension || ""));
}

export function legacyAgreementBranchLabel(branch) {
  const value = String(branch || "");
  return /^FA900(?:\s|-|$)/.test(value) ? "Centralizadas" : value;
}

export function legacyAgreementEndDate(agreement = {}) {
  return agreement.isIndefinite ? "Indefinido" : (agreement.endDate || "");
}

export function legacyAgreementPromissoryText(agreement = {}) {
  if (agreement.hasPromissoryNote) {
    return `Sí tiene, vence el ${agreement.promissoryNoteExpirationDate || ""}`;
  }
  if (agreement.isPromissoryNoteExpired) {
    return `Esta Vencido desde ${agreement.promissoryNoteExpirationDate || ""}`;
  }
  return "No tiene";
}

export function legacyAgreementCreditLimit(agreement = {}) {
  const amount = Number(agreement.creditLimit || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return agreement.isDollar ? `US $ ${amount}` : amount;
}

export function legacyAgreementAuditText(agreement = {}) {
  const createdAt = [agreement.createdDate, agreement.createdTime].filter(Boolean).join(" ");
  const updatedAt = [agreement.updatedDate, agreement.updatedTime].filter(Boolean).join(" ");
  const created = `Creado el: ${createdAt} por: ${agreement.createdByName || ""}`;
  return agreement.updatedByPersonId
    ? `${created}/Actualizado el: ${updatedAt} por: ${agreement.updatedByName || ""}`
    : created;
}
