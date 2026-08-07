import { portalApiRequest } from "./portalApiClient.js";

export function checkMailHealth() {
  return portalApiRequest({ path: "td/mail/health" });
}

export function sendMail(payload) {
  return portalApiRequest({ path: "td/mail/send", method: "POST", body: payload });
}

export function sendSimpleMail({ to, subject, text }) {
  return sendMail({ to, subject, text });
}

