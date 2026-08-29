import dayjs from "dayjs";

export const LEGAL_ACTIONS_PAGE_SIZE = 50;

export const LEGAL_ACTIONS_QUERY_ERROR = "Error executing query.";

export const LEGAL_ACTIONS_FEEDBACK = Object.freeze({
  created: "¡Se ha guardado correctamente!",
  updated: "¡Se ha actualizado correctamente!",
});

export const LEGAL_ACTION_SORT_FIELDS = Object.freeze([
  "name",
  "createdAt",
  "createdBy",
]);

export function formatLegacyLegalActionDate(value) {
  if (!value) return "";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm:ss") : String(value);
}

export function legalActionPayload({ name, active, editing }) {
  return {
    name: typeof name === "string" ? name.slice(0, 250) : "",
    active: editing ? Boolean(active) : false,
  };
}

export function legalActionPaginationTotal(total, range) {
  if (!total || !Array.isArray(range) || range.length < 2) return `0 to 0 of ${Number(total) || 0} items`;
  return `${range[0]} to ${range[1]} of ${total} items`;
}
