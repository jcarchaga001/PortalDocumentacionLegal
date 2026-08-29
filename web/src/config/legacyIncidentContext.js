function normalizeIncidentId(value) {
  const incidentId = Number(value);
  return Number.isInteger(incidentId) && incidentId > 0 ? incidentId : undefined;
}

export function legacyIncidentDetailHref(basePath, detailRoute, incidentId, branchId) {
  const normalizedId = normalizeIncidentId(incidentId);
  const normalizedBranchId = normalizeIncidentId(branchId);
  return `${basePath}/${detailRoute}?CodIncidente=${normalizedId || ""}&codigoSucursal=${normalizedBranchId || ""}`;
}

export function readLegacyIncidentDetailRequest(search) {
  const query = new URLSearchParams(search);
  const incidentId = normalizeIncidentId(query.get("CodIncidente"));
  const branchId = normalizeIncidentId(query.get("codigoSucursal"));
  return {
    incidentId,
    branchId,
    // scrAccionesIncidentes es una sola superficie legacy. El servidor resuelve
    // isExterno desde el incidente persistido; nunca se publica scope en la URL.
    scope: "external",
  };
}
