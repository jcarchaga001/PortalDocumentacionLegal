const COUNTRY_METADATA = Object.freeze({
  4: Object.freeze({
    name: "Honduras",
    flagAsset: "country-honduras.png",
  }),
});

// Static entity ConfiguracionPaises from the canonical OML. Asset metadata is
// intentionally separate: only assets verified byte-for-byte are rendered.
const LEGACY_COUNTRY_CONFIGURATION = Object.freeze([
  Object.freeze({ countryCode: 1, countryName: "Regional", companyName: "Grupo 3C", terminalId: 0, isActive: true, legacyFlagName: null }),
  Object.freeze({ countryCode: 2, countryName: "Mexico", companyName: "Farmavalue", terminalId: 0, isActive: true, legacyFlagName: "mexico" }),
  Object.freeze({ countryCode: 3, countryName: "Guatemala", companyName: "Farmavalue", terminalId: 0, isActive: true, legacyFlagName: "guatemala" }),
  Object.freeze({ countryCode: 4, countryName: "Honduras", companyName: "Farmacias del Ahorro", terminalId: 8, isActive: true, legacyFlagName: "honduras" }),
  Object.freeze({ countryCode: 5, countryName: "El Salvador", companyName: "Farmavalue", terminalId: 0, isActive: true, legacyFlagName: "bandera" }),
  Object.freeze({ countryCode: 6, countryName: "Nicaragua", companyName: "Farmavalue", terminalId: 0, isActive: true, legacyFlagName: "nicaragua" }),
  Object.freeze({ countryCode: 7, countryName: "Costa Rica", companyName: "Farmavalue", terminalId: 10, isActive: true, legacyFlagName: "costarica" }),
  Object.freeze({ countryCode: 8, countryName: "Panamá", companyName: "Farmavalue", terminalId: 0, isActive: true, legacyFlagName: "panama" }),
  Object.freeze({ countryCode: 9, countryName: "República Dominicana", companyName: "Farmavalue", terminalId: 0, isActive: true, legacyFlagName: "repdominicana" }),
  Object.freeze({ countryCode: 10, countryName: "Guatemala Ap", companyName: "Apomedix", terminalId: 0, isActive: true, legacyFlagName: null }),
]);

export function getCountryMetadata(countryCode) {
  const normalizedCode = Number(countryCode);
  if (!Number.isInteger(normalizedCode)) return null;
  return COUNTRY_METADATA[normalizedCode] || null;
}

export function getLegacyCountryConfiguration(countryCode) {
  const normalizedCode = Number(countryCode);
  if (!Number.isInteger(normalizedCode)) return null;
  return LEGACY_COUNTRY_CONFIGURATION.find((country) => country.countryCode === normalizedCode) || null;
}

export { COUNTRY_METADATA, LEGACY_COUNTRY_CONFIGURATION };
