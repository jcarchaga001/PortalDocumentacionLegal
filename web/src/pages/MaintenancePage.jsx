import { useLocation } from "react-router-dom";

export function MaintenancePage() {
  const location = useLocation();
  const text = new URLSearchParams(location.search).get("MantenimientoText") || "Seguimiento a Farmacias";
  return <main className="legacy-maintenance-page">{text}</main>;
}
