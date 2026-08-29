export const CORPORATE_CLIENT_FORM_FEEDBACK = Object.freeze({
  initialTelephoneFailure: "Cannot read properties of undefined (reading 'getInstance')",
  mandatoryFields: "Tiene campos obligatorios vacíos.",
  contactNameRequired: "Ingrese el nombre del contacto.",
  contactPhoneRequired: "Ingrese el número de teléfono del contacto.",
  queryFailure: "Error executing query.",
});

export const emptyClient = Object.freeze({
  name: "",
  faCode: "",
  contactName: "",
  contactPosition: "",
  contactEmail: "",
  contactPhone: "",
});

export const emptyContact = Object.freeze({
  id: undefined,
  name: "",
  position: "",
  phone: "",
  email: "",
});

export function normalizeLegacyPhone(value, dialCode = "+504") {
  const phone = typeof value === "string" ? value : "";
  if (phone === "") return "";
  return phone.startsWith("+") ? phone : `${dialCode}${phone}`;
}
