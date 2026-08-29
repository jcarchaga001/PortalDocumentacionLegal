import { ROUTES } from "../routes/routePaths.js";

export const LANDING_SHORTCUTS = Object.freeze([
  Object.freeze({ label: "Documentación", detail: "Sucursales", icon: "home", route: ROUTES.documentHistory, documentType: 1, group: "primary" }),
  Object.freeze({ label: "Dashboard Global", icon: "dashboardGlobal", route: ROUTES.dashboard, group: "primary" }),
  Object.freeze({ label: "Proveedores", icon: "providers", group: "primary" }),
  Object.freeze({ label: "Documentación", detail: "Administrativa", icon: "documents", route: ROUTES.documentHistory, documentType: 2, group: "primary" }),
  Object.freeze({ label: "Dashboard Sucursales", icon: "dashboardBranches", route: ROUTES.governmentEntities, group: "primary" }),
  Object.freeze({ label: "Configuración", icon: "settings", group: "primary" }),
  Object.freeze({ label: "Próximos a Vencer", icon: "warning", group: "secondary" }),
  Object.freeze({ label: "Incidentes", icon: "incidents", group: "secondary" }),
]);

export function canShowLandingShortcut(shortcut, user) {
  const roleCode = Number(user?.roleCode);
  const positionCode = Number(user?.positionCode);

  if (shortcut.group === "primary") return !(roleCode === 1 && positionCode === 2);
  return roleCode !== 1 || [2, 7].includes(positionCode);
}

export const PORTAL_NAVIGATION_GROUPS = Object.freeze([
  Object.freeze({
    key: "dashboard",
    label: "Dashboard",
    items: Object.freeze([
      Object.freeze({ key: ROUTES.dashboard, label: "Dashboard Global" }),
      Object.freeze({ key: ROUTES.branchMonitoring, label: "Dashboard Sucursales" }),
      Object.freeze({ key: ROUTES.riskHistory, label: "Análisis Contratos" }),
    ]),
  }),
  Object.freeze({
    key: "documentation",
    label: "Documentación",
    items: Object.freeze([
      Object.freeze({ key: ROUTES.documentHistory, label: "Documentación Sucursales", documentType: 1 }),
      Object.freeze({ key: ROUTES.administrativeDocuments, label: "Documentación Administrativa", documentType: 2 }),
      Object.freeze({ key: ROUTES.expiringDocuments, label: "Proximos a Vencer" }),
      Object.freeze({ key: ROUTES.agreements, label: "Registro de convenios" }),
    ]),
  }),
  Object.freeze({
    key: "catalogs",
    label: "Catálogos",
    items: Object.freeze([
      Object.freeze({ key: "catalog-users", label: "Usuarios", route: ROUTES.documentHistory, active: false }),
      Object.freeze({ key: ROUTES.providers, label: "Provedores" }),
      Object.freeze({ key: ROUTES.documentCategories, label: "Categorías Documentos" }),
      Object.freeze({ key: ROUTES.governmentEntities, label: "Entes Gubernamentales" }),
      Object.freeze({ key: ROUTES.corporateClients, label: "Clientes Corporativos" }),
      Object.freeze({ key: ROUTES.legalActions, label: "Acciones Legal" }),
    ]),
  }),
  Object.freeze({
    key: "incidents",
    label: "Incidentes",
    items: Object.freeze([
      Object.freeze({ key: ROUTES.internalIncidents, label: "Incidentes Internos" }),
      Object.freeze({ key: ROUTES.internalIncidentActions, label: "Acciones Incidentes Internos" }),
      Object.freeze({ key: ROUTES.externalIncidents, label: "Incidentes Externos" }),
      Object.freeze({ key: ROUTES.externalIncidentActions, label: "Acciones Incidentes Externos" }),
      Object.freeze({ key: ROUTES.laborCases, label: "Control Casos Laborales" }),
      Object.freeze({ key: ROUTES.myLaborActions, label: "Mis Acciones Casos Laborales" }),
    ]),
  }),
  Object.freeze({
    key: "configuration",
    allowedPositions: Object.freeze([7, 15]),
    label: "Configuración",
    items: Object.freeze([
      Object.freeze({ key: ROUTES.users, label: "Permisos Usuario Casos Laborales" }),
    ]),
  }),
]);

export function isPortalNavigationGroupActive(group, pathname) {
  return group.items.some((item) => item.active !== false && pathname === (item.route || item.key));
}
