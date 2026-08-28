const COUNTRY_METADATA = Object.freeze({
  4: Object.freeze({
    name: "Honduras",
    flagAsset: "country-honduras.png",
  }),
});

export function getCountryMetadata(countryCode) {
  const normalizedCode = Number(countryCode);
  if (!Number.isInteger(normalizedCode)) return null;
  return COUNTRY_METADATA[normalizedCode] || null;
}

export { COUNTRY_METADATA };
