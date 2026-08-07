const MANUAL_DOCUMENT_NOTIFICATION_PATH = /\/notifications\/documents\/\d+\/expiration\/send$/;

export function attachNotificationExecutionToken(proxyRequest, request, rawToken) {
  const token = String(rawToken || "").trim();
  const requestPath = String(request?.url || "").split("?", 1)[0];
  if (
    token.length >= 32
    && String(request?.method || "").toUpperCase() === "POST"
    && MANUAL_DOCUMENT_NOTIFICATION_PATH.test(requestPath)
  ) {
    proxyRequest.setHeader("x-notification-run-token", token);
    return true;
  }
  return false;
}
