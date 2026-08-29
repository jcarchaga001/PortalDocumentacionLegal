export function documentIdFromSearch(search) {
  const query = new URLSearchParams(search);
  const value = [query.get("IdRegistro"), query.get("CodDocumento")]
    .map(Number)
    .find((candidate) => Number.isInteger(candidate) && candidate > 0);
  return value || null;
}

export function legacyDocumentDateInputValue(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

export function documentStatusTone(statusId) {
  if (Number(statusId) === 2) return "is-success";
  if ([3, 5].includes(Number(statusId))) return "is-danger";
  if (Number(statusId) === 4) return "is-warning";
  return "is-neutral";
}

export function documentLevelTone(levelName) {
  const normalized = String(levelName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized === "publico") return "is-public";
  if (normalized === "privado") return "is-private";
  return "is-neutral";
}

export function documentDetailActions(statusId) {
  return Number(statusId) === 1
    ? ["reject", "approve", "update"]
    : ["update"];
}

export function isLegacyDocumentApprovalValid(secondaryReference) {
  return typeof secondaryReference === "string" && secondaryReference.length > 0;
}
