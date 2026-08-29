export const AGREEMENT_FORM_CONTROL_KEYS = Object.freeze({
  removeAttachment: "dG5e0wbBGEKw4ZfZFeyinQ",
  cancel: "VcL+BZAjY0uBMTdf58jkig",
  create: "SS6HTcIRI0euJlr4Bx_tpA",
  update: "w_f_3N3+aEWwAJPpJ7wVZA",
});

export const AGREEMENT_FORM_FEEDBACK = Object.freeze({
  clientRequired: "Seleccione al Cliente del convenio.",
  managerRequired: "Seleccione al Gestor de la cuenta.",
  branchesRequired: "Seleccione al menos 1 sucursal que facture.",
  promissoryAttachmentRequired: "Afirmo que el cliente tiene pagare, porfavor agregar el archivo.",
  mandatoryFields: "Hay Campos obligatorios vacíos.",
  invalidDates: 'La "Fecha Final" debe ser mayor a la "Fecha Inicial".',
  queryFailure: "Error executing query.",
});

export const EMPTY_AGREEMENT_FORM = Object.freeze({
  clientId: "",
  accountManagerCode: "",
  creditDays: "0",
  creditLimit: "0",
  startDate: "",
  endDate: "",
  promissoryState: "no",
  promissoryNoteExpirationDate: "",
  branchIds: [],
  isDollar: false,
  isIndefinite: false,
  isPromissoryNoteIndefinite: false,
  observation: "",
});

export function agreementToForm(agreement = {}) {
  return {
    ...EMPTY_AGREEMENT_FORM,
    clientId: agreement.clientId ? String(agreement.clientId) : "",
    accountManagerCode: agreement.accountManagerCode ? String(agreement.accountManagerCode) : "",
    creditDays: String(agreement.creditDays ?? 0),
    creditLimit: String(agreement.creditLimit ?? 0),
    startDate: agreement.startDate || "",
    endDate: agreement.endDate || "",
    promissoryState: !agreement.hasPromissoryNote
      ? "no"
      : agreement.isPromissoryNoteExpired ? "expired" : "yes",
    promissoryNoteExpirationDate: agreement.promissoryNoteExpirationDate || "",
    branchIds: Array.isArray(agreement.branchIds) ? agreement.branchIds.map(String) : [],
    isDollar: Boolean(agreement.isDollar),
    isIndefinite: Boolean(agreement.isIndefinite),
    isPromissoryNoteIndefinite: Boolean(agreement.isPromissoryNoteIndefinite),
    observation: agreement.observation || "",
  };
}

export function legacyBranchLabel(branch = {}) {
  if (branch.internalCode === "FA900") return "Centralizadas";
  if (branch.internalCode && branch.branchName) return `${branch.internalCode} - ${branch.branchName}`;
  return branch.name || "";
}

export function validateAgreementForm(values, fileCount) {
  if (!Number(values.clientId)) return AGREEMENT_FORM_FEEDBACK.clientRequired;
  if (!String(values.accountManagerCode || "").trim()) return AGREEMENT_FORM_FEEDBACK.managerRequired;
  if (!Array.isArray(values.branchIds) || values.branchIds.length === 0) {
    return AGREEMENT_FORM_FEEDBACK.branchesRequired;
  }
  if (values.promissoryState !== "no" && fileCount === 0) {
    return AGREEMENT_FORM_FEEDBACK.promissoryAttachmentRequired;
  }

  const creditDays = Number(values.creditDays);
  const creditLimit = Number(String(values.creditLimit).replaceAll(",", ""));
  const missingMandatory = !values.startDate
    || (!values.isIndefinite && !values.endDate)
    || !Number.isInteger(creditDays)
    || creditDays < 0
    || !Number.isFinite(creditLimit)
    || creditLimit < 0
    || (values.promissoryState !== "no"
      && !values.isPromissoryNoteIndefinite
      && !values.promissoryNoteExpirationDate);
  if (missingMandatory) return AGREEMENT_FORM_FEEDBACK.mandatoryFields;
  if (!values.isIndefinite && values.startDate >= values.endDate) {
    return AGREEMENT_FORM_FEEDBACK.invalidDates;
  }
  return "";
}

export function recalculatePromissoryState(currentState, expirationDate, currentDate) {
  if (currentState === "no" || !expirationDate) return currentState;
  return expirationDate < currentDate ? "expired" : "yes";
}
