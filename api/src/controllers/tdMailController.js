import { checkMailHealth, sendMail } from "../services/tdMailService.js";

function resultStatus(result) {
  if (result.success) return 200;
  return result.error?.code === "VALIDATION_ERROR" ? 400 : 502;
}

export async function health(_req, res) {
  const result = await checkMailHealth();
  res.status(resultStatus(result)).json(result);
}

export async function send(req, res) {
  const result = await sendMail(req.body);
  res.status(resultStatus(result)).json(result);
}

