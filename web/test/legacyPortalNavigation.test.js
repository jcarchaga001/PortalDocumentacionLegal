import assert from "node:assert/strict";
import test from "node:test";
import {
  canShowLandingShortcut,
  isPortalNavigationGroupActive,
  LANDING_SHORTCUTS,
  PORTAL_NAVIGATION_GROUPS,
} from "../src/config/legacyPortalNavigation.js";

test("landing conserva cuatro destinos y cuatro accesos En desarrollo", () => {
  assert.equal(LANDING_SHORTCUTS.length, 8);
  assert.deepEqual(
    LANDING_SHORTCUTS.map(({ label, detail, route, documentType }) => ({ label, detail, route, documentType })),
    [
      { label: "Documentación", detail: "Sucursales", route: "/scrHistoricoDocumentos", documentType: 1 },
      { label: "Dashboard Global", detail: undefined, route: "/scrDshGlobal", documentType: undefined },
      { label: "Proveedores", detail: undefined, route: undefined, documentType: undefined },
      { label: "Documentación", detail: "Administrativa", route: "/scrHistoricoDocumentos", documentType: 2 },
      { label: "Dashboard Sucursales", detail: undefined, route: "/scrCatalogoEntes", documentType: undefined },
      { label: "Configuración", detail: undefined, route: undefined, documentType: undefined },
      { label: "Próximos a Vencer", detail: undefined, route: undefined, documentType: undefined },
      { label: "Incidentes", detail: undefined, route: undefined, documentType: undefined },
    ],
  );
});

test("landing replica la visibilidad por rol y puesto", () => {
  const visibleLabels = (user) => LANDING_SHORTCUTS
    .filter((shortcut) => canShowLandingShortcut(shortcut, user))
    .map(({ label, detail }) => `${label}${detail ? ` ${detail}` : ""}`);

  assert.deepEqual(visibleLabels({ roleCode: 1, positionCode: 2 }), ["Próximos a Vencer", "Incidentes"]);
  assert.equal(visibleLabels({ roleCode: 1, positionCode: 7 }).length, 8);
  assert.equal(visibleLabels({ roleCode: 1, positionCode: 3 }).length, 6);
  assert.equal(visibleLabels({ roleCode: 2, positionCode: 3 }).length, 8);
});

test("menu conserva grupos, destinos legacy y restriccion de Configuracion", () => {
  assert.deepEqual(PORTAL_NAVIGATION_GROUPS.map(({ label }) => label), [
    "Dashboard",
    "Documentación",
    "Catálogos",
    "Incidentes",
    "Configuración",
  ]);

  const dashboard = PORTAL_NAVIGATION_GROUPS[0];
  assert.deepEqual(dashboard.items.map(({ label, key }) => [label, key]), [
    ["Dashboard Global", "/scrDshGlobal"],
    ["Dashboard Sucursales", "/scrDashboardMonitoreo"],
    ["Análisis Contratos", "/scrHistoricoRiesgo"],
  ]);

  const catalogs = PORTAL_NAVIGATION_GROUPS[2];
  assert.deepEqual(catalogs.items[0], {
    key: "catalog-users",
    label: "Usuarios",
    route: "/scrHistoricoDocumentos",
    active: false,
  });
  assert.deepEqual(PORTAL_NAVIGATION_GROUPS[4].allowedPositions, [7, 15]);
  assert.equal(isPortalNavigationGroupActive(catalogs, "/scrHistoricoDocumentos"), false);
  assert.equal(isPortalNavigationGroupActive(dashboard, "/scrHistoricoRiesgo"), true);
});
