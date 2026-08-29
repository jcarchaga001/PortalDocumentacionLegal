export const MAINTENANCE_BROWSER_TITLE = "Portal Documentación Legal";
export const MAINTENANCE_HEADING = "Seguimiento a Farmacias";

export const MAINTENANCE_ASSETS = Object.freeze({
  logo: "/brand/logo-white.png",
  illustration: "/brand/maintenance.png",
});

// The OML exposes MantenimientoText as the screen's optional serializable
// input. Its two similarly named Site Properties are explicitly unused.
export function maintenanceTextFromSearch(search = "") {
  return new URLSearchParams(search).get("MantenimientoText") ?? "";
}
