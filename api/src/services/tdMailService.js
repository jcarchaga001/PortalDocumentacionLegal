import { tdApiRequest } from "./tdApiClient.js";
import { validationFailure } from "./serviceResult.js";

function hasRecipients(to) {
  if (typeof to === "string") return Boolean(to.trim());
  return Array.isArray(to) && to.length > 0 && to.every((value) => typeof value === "string" && value.trim());
}

export async function checkMailHealth() {
  return tdApiRequest({ path: "/mail/health" });
}

export async function sendMail(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return validationFailure("El contenido del correo es obligatorio.", "payload");
  }
  if (!hasRecipients(payload.to)) {
    return validationFailure("to debe contener al menos un destinatario.", "to");
  }
  if (typeof payload.subject !== "string" || !payload.subject.trim()) {
    return validationFailure("subject es obligatorio.", "subject");
  }
  if (!payload.text && !payload.html) {
    return validationFailure("Debe enviarse text o html.", "text");
  }

  return tdApiRequest({ path: "/mail/send", method: "POST", body: payload });
}

export async function sendSimpleMail({ to, subject, text } = {}) {
  return sendMail({ to, subject, text });
}

