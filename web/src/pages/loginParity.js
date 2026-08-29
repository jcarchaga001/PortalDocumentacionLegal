export const LOGIN_FEEDBACK = Object.freeze({
  countryRequired: "Debe Seleccionar País",
  invalidCredentials: "Datos de ingreso no válidos",
  queryError: "Error executing query.",
  requiredField: "Campo Obligatorio",
  recoverySuccess: "Se ha enviado sus datos de ingreso al correo ingresado",
});

export const LOGIN_COUNTRY_CODE = 4;

export function legacyLoginCountries(countries) {
  if (!Array.isArray(countries)) return [];
  return countries.filter((country) => Number(country?.countryCode) === LOGIN_COUNTRY_CODE);
}
