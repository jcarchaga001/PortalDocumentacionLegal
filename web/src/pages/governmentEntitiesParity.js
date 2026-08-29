export const GOVERNMENT_ENTITIES_PAGE_SIZE = 500;
export const GOVERNMENT_ENTITIES_AGGREGATE_LIMIT = 50;
export const GOVERNMENT_ENTITIES_QUERY_ERROR = "Error executing query.";

export const GOVERNMENT_ENTITIES_FEEDBACK = Object.freeze({
  saved: "Se ha guardado correctamente",
  updated: "Se ha actualizado correctamente",
  deactivated: "Ente inactiva",
});

export const GOVERNMENT_ENTITY_AREAS = Object.freeze([
  { value: "legal", label: "Legal" },
  { value: "regulatory", label: "Regulatorio" },
]);

export function governmentEntityCreatePayload({ name, description }) {
  // Mandatory=False for both inputs. The legacy popup's area and responsible
  // OnChanged actions are no-ops and their visible selections are not used by
  // CreateOrUpdateTblEntesGubernamentales.
  return {
    name: typeof name === "string" ? name.slice(0, 128) : "",
    description: typeof description === "string" ? description.slice(0, 65_535) : "",
  };
}

export function governmentEntityArea(row) {
  if (row?.legal === true || row?.legal === 1 || row?.legal === "1") return "Legal";
  if (row?.regulatory === true || row?.regulatory === 1 || row?.regulatory === "1") return "Regulatorio";
  return "";
}

export function governmentEntityPaginationTotal(total, range) {
  return `${range[0]} to ${range[1]} of ${total} items`;
}

