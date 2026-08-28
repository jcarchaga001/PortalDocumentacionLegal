import { useLocation } from "react-router-dom";
import { runtimeConfig } from "../config/runtime.js";

export function MaintenancePage() {
  const location = useLocation();
  const text = new URLSearchParams(location.search).get("MantenimientoText")?.trim();

  return (
    <main className="legacy-maintenance-page">
      <header className="legacy-maintenance-header">
        <div className="legacy-maintenance-logo-column">
          <img src={`${runtimeConfig.basePath}/brand/logo-white.png`} alt="3C" />
        </div>
        <h1>Seguimiento a Farmacias</h1>
      </header>
      <div className="legacy-maintenance-spacer" aria-hidden="true" />
      <section className="legacy-maintenance-content">
        <p className="legacy-maintenance-message">{text || ""}</p>
        <img
          className="legacy-maintenance-illustration"
          src={`${runtimeConfig.basePath}/brand/maintenance.png`}
          alt=""
        />
      </section>
    </main>
  );
}
