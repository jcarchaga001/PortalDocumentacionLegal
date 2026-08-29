export const USER_PERMISSION_PAGE_SIZE = 500;
export const USER_PERMISSION_EMPTY_TEXT = "No hay datos para mostrar...";
export const USER_PERMISSION_QUERY_ERROR = "Error executing query.";
export const USER_PERMISSION_SUCCESS = "¡Registro Completado!";

export const USER_PERMISSION_COLUMNS = Object.freeze([
  Object.freeze({ key: "id", label: "Codigo SAF", width: "12.02%", align: "center", sortable: true }),
  Object.freeze({ key: "name", label: "Nombre Persona", width: "26.33%", align: "left", sortable: true }),
  Object.freeze({ key: "positionName", label: "Puesto", width: "23.13%", align: "left", sortable: true }),
  Object.freeze({ key: "email", label: "Correo", width: "24.91%", align: "center", sortable: true }),
  Object.freeze({ key: "accessAllowed", label: "Acceso Permitido", width: "13.61%", align: "center", sortable: false }),
]);

export function isPermissionAllowed(value) {
  return value === true || value === 1 || value === "1";
}

export function permissionActionFor(value) {
  if (isPermissionAllowed(value)) {
    return {
      allowed: true,
      nextAllowed: false,
      description: "Deshabilitó acceso",
      infoMessage: "False",
      icon: "fa-check",
      color: "#228700",
      tooltip: "Inhabilitar",
    };
  }
  return {
    allowed: false,
    nextAllowed: true,
    description: "Habilitó acceso",
    infoMessage: "True",
    icon: "fa-ban",
    color: "#f70000",
    tooltip: "Habilitar",
  };
}

export function paginationSummary(page, pageSize, total) {
  const normalizedTotal = Math.max(0, Number(total) || 0);
  if (normalizedTotal === 0) return "0 to 0 of 0 items";
  const normalizedPageSize = Math.max(1, Number(pageSize) || USER_PERMISSION_PAGE_SIZE);
  const maxPage = Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize));
  const normalizedPage = Math.min(maxPage, Math.max(1, Number(page) || 1));
  const first = ((normalizedPage - 1) * normalizedPageSize) + 1;
  const last = Math.min(normalizedPage * normalizedPageSize, normalizedTotal);
  return `${first} to ${last} of ${normalizedTotal} items`;
}

export function paginationPages(total, pageSize = USER_PERMISSION_PAGE_SIZE) {
  const count = Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(pageSize) || 1));
  return Array.from({ length: count }, (_, index) => index + 1);
}
