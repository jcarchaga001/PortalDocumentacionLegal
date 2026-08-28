const ALLOWED_COUNTRY_CODES = new Set([4]);

export class AuthValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "AuthValidationError";
    this.status = 400;
    this.code = "VALIDATION_ERROR";
    this.field = field;
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Datos de ingreso no válidos");
    this.name = "InvalidCredentialsError";
    this.status = 401;
    this.code = "INVALID_CREDENTIALS";
  }
}

function validateCredentials(input = {}) {
  const usernameValue = input.username ?? input.email;
  const username = typeof usernameValue === "string" ? usernameValue.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const countryCode = Number(input.countryCode ?? input.codigoPais);

  if (!username || username.length > 254) {
    throw new AuthValidationError("Ingrese un usuario valido.", "username");
  }
  if (!password || password.length > 256) {
    throw new AuthValidationError("Ingrese una clave valida.", "password");
  }
  if (!Number.isInteger(countryCode) || !ALLOWED_COUNTRY_CODES.has(countryCode)) {
    throw new AuthValidationError("Seleccione un pais valido.", "countryCode");
  }

  return { username, password, countryCode };
}

function cleanName(person) {
  return [person.Primer_Nombre, person.Segundo_Nombre, person.Primer_Apellido, person.Segundo_Apellido]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAvailableCountries(rows = []) {
  return rows
    .map((row) => ({
      countryCode: Number(row.countryCode ?? row.Codigo_Pais),
      name: String(row.name ?? row.Nombre_Pais ?? "").trim(),
    }))
    .filter((country) => ALLOWED_COUNTRY_CODES.has(country.countryCode) && country.name);
}

export function createAuthService({ countryRepository, personRepository, passwordHashService }) {
  async function listCountries() {
    return normalizeAvailableCountries(await countryRepository.listActiveLoginCountries());
  }

  return {
    listCountries,

    async authenticate(input) {
      const credentials = validateCredentials(input);
      const countries = await listCountries();
      if (!countries.some((country) => country.countryCode === credentials.countryCode)) {
        throw new AuthValidationError("Seleccione un pais valido.", "countryCode");
      }

      const credential = await passwordHashService.hash(credentials.password);
      const people = await personRepository.findActiveByCredentials({
        email: credentials.username,
        credential,
        countryCode: credentials.countryCode,
      });

      if (people.length !== 1) {
        if (people.length > 1) console.warn("Autenticacion ambigua: existen multiples personas activas para la misma identidad.");
        throw new InvalidCredentialsError();
      }

      const person = people[0];
      return {
        id: Number(person.Codigo_Personas),
        name: cleanName(person) || "Usuario",
        countryCode: Number(person.CodigoPais),
        roleCode: person.CodigoRol == null ? null : Number(person.CodigoRol),
        branchCode: person.Codigo_Sucursal == null ? null : Number(person.Codigo_Sucursal),
        positionCode: person.Codigo_Puesto == null ? null : Number(person.Codigo_Puesto),
        mustResetPassword: Boolean(person.isResetear),
      };
    },
  };
}

export { normalizeAvailableCountries, validateCredentials };
