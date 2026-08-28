export const PROVIDER_DESTINATION_COLUMN_TITLES = Object.freeze([
  "Banco",
  "Tipo de Cuenta",
  "Moneda",
]);

export const PROVIDER_DESTINATION_EMPTY_TEXT = "No tiene destinos vinculados...";

export function formatProviderDestinationCurrency(isDollars, currencySymbol = "") {
  if (isDollars === true || Number(isDollars) === 1) return "Dolares $";
  return `Local ${String(currencySymbol || "").trim()}`.trimEnd();
}
