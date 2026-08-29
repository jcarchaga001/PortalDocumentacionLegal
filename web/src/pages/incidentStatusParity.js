export const INCIDENT_STATUS_COLORS = Object.freeze({
  1: "blue",
  2: "#37b24d",
  4: "gold",
  5: "green",
  6: "red",
  7: "red",
  8: "gold",
  10: "purple",
});

export function incidentStatusColor(id) {
  return INCIDENT_STATUS_COLORS[Number(id)] || "default";
}
