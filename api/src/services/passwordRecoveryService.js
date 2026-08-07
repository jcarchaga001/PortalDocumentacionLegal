import { randomInt } from "node:crypto";
import { sendMail } from "./tdMailService.js";

const COUNTRY_HONDURAS = 4;
const TEMPORARY_PASSWORD_LENGTH = 10;
const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export class PasswordRecoveryValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "PasswordRecoveryValidationError";
    this.status = 400;
    this.code = "VALIDATION_ERROR";
    this.field = field;
  }
}

export class PasswordRecoveryNotFoundError extends Error {
  constructor() {
    super("Credenciales incorrectas.");
    this.name = "PasswordRecoveryNotFoundError";
    this.status = 400;
    this.code = "RECOVERY_IDENTITY_NOT_FOUND";
  }
}

function recoveryDomain() {
  const value = (process.env.RECOVERY_EMAIL_DOMAIN || "farmavalue.com").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    throw new Error("RECOVERY_EMAIL_DOMAIN no contiene un dominio valido.");
  }
  return value;
}

function normalizeAlias(value, field) {
  const alias = typeof value === "string" ? value.trim().replace(/@.*$/, "") : "";
  if (!alias || alias.length > 120 || !/^[a-z0-9._-]+$/i.test(alias)) {
    throw new PasswordRecoveryValidationError("Ingrese un correo valido.", field);
  }
  return alias;
}

function normalizeUsername(value) {
  const username = typeof value === "string" ? value.trim() : "";
  if (!username || username.length > 254 || !/^[^\s]+$/.test(username)) {
    throw new PasswordRecoveryValidationError("Ingrese un usuario valido.", "identifier");
  }
  return username;
}

function normalizeRecoveryRequest(input = {}) {
  const type = input.type === "correo" ? "correo" : input.type === "usuario" ? "usuario" : "";
  const countryCode = Number(input.countryCode);
  if (!type) throw new PasswordRecoveryValidationError("Seleccione el tipo de ingreso.", "type");
  if (countryCode !== COUNTRY_HONDURAS) {
    throw new PasswordRecoveryValidationError("Seleccione un pais valido.", "countryCode");
  }

  const domain = recoveryDomain();
  if (type === "correo") {
    const alias = normalizeAlias(input.identifier, "identifier");
    return {
      countryCode,
      username: `${alias}@${domain}`,
      destination: `${alias}@${domain}`,
    };
  }

  const deliveryAlias = normalizeAlias(input.deliveryAlias, "deliveryAlias");
  return {
    countryCode,
    username: normalizeUsername(input.identifier),
    destination: `${deliveryAlias}@${domain}`,
  };
}

function normalizeNewPassword(value) {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 256) {
    throw new PasswordRecoveryValidationError("La clave debe contener entre 8 y 256 caracteres.", "password");
  }
  return password;
}

function temporaryPassword() {
  let value = "";
  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index += 1) {
    value += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return value;
}

function displayName(person) {
  return [person.Primer_Nombre, person.Primer_Apellido].filter(Boolean).join(" ").trim() || "Usuario";
}

function registeredRecoveryDestination(person) {
  const alias = normalizeAlias(person?.Correo_electronico, "identifier");
  return `${alias}@${recoveryDomain()}`;
}

export function createPasswordRecoveryService({
  personRepository,
  passwordHashService,
  sendMailImpl = sendMail,
}) {
  return {
    async request(input) {
      const recovery = normalizeRecoveryRequest(input);
      const people = await personRepository.findActiveForRecovery(recovery);
      if (people.length !== 1) throw new PasswordRecoveryNotFoundError();

      const person = people[0];
      const registeredDestination = registeredRecoveryDestination(person);
      if (registeredDestination.toLowerCase() !== recovery.destination.toLowerCase()) {
        throw new PasswordRecoveryNotFoundError();
      }
      const generatedPassword = temporaryPassword();
      const credential = await passwordHashService.hash(generatedPassword);

      const mailResult = await sendMailImpl({
        to: registeredDestination,
        subject: "Portal de Documentacion Legal - recuperacion de clave",
        text: [
          `Hola ${displayName(person)},`,
          "",
          `Su usuario es: ${person.Correo_electronico}`,
          `Su clave temporal es: ${generatedPassword}`,
          "Al ingresar, el portal le solicitara registrar una clave personalizada.",
        ].join("\n"),
      });
      if (!mailResult.success) {
        const error = new Error("No fue posible enviar el correo de recuperacion.");
        error.status = 502;
        error.code = "RECOVERY_EMAIL_FAILED";
        throw error;
      }

      const updated = await personRepository.updateCredential({
        personId: person.Codigo_Personas,
        credential,
        mustResetPassword: true,
      });
      if (!updated) throw new PasswordRecoveryNotFoundError();

      return { destination: registeredDestination.replace(/^(.{2}).+(@.+)$/, "$1***$2") };
    },

    async reset(personId, newPassword) {
      const id = Number(personId);
      if (!Number.isInteger(id) || id <= 0) {
        throw new PasswordRecoveryValidationError("La sesion no contiene un usuario valido.", "personId");
      }
      const credential = await passwordHashService.hash(normalizeNewPassword(newPassword));
      const updated = await personRepository.updateCredential({
        personId: id,
        credential,
        mustResetPassword: false,
      });
      if (!updated) {
        const error = new Error("No fue posible actualizar la clave.");
        error.status = 404;
        error.code = "PERSON_NOT_FOUND";
        throw error;
      }
      return { updated: true };
    },
  };
}

export { normalizeNewPassword, normalizeRecoveryRequest };
