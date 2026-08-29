import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { runtimeConfig } from "../config/runtime.js";
import {
  MAINTENANCE_ASSETS,
  MAINTENANCE_BROWSER_TITLE,
  MAINTENANCE_HEADING,
  maintenanceTextFromSearch,
} from "./maintenanceParity.js";

export function MaintenancePage() {
  const location = useLocation();
  const text = maintenanceTextFromSearch(location.search);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = MAINTENANCE_BROWSER_TITLE;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="legacy-maintenance-page">
      <header className="legacy-maintenance-header">
        <div className="legacy-maintenance-logo-column">
          <img src={`${runtimeConfig.basePath}${MAINTENANCE_ASSETS.logo}`} alt="" />
        </div>
        <div className="legacy-maintenance-title" role="heading" aria-level="1">
          <span>{MAINTENANCE_HEADING}</span>
        </div>
      </header>
      <div className="legacy-maintenance-spacer" aria-hidden="true" />
      <section className="legacy-maintenance-content">
        <div className="legacy-maintenance-message"><span>{text}</span></div>
        <div className="legacy-maintenance-illustration-column">
          <img
            className="legacy-maintenance-illustration"
            src={`${runtimeConfig.basePath}${MAINTENANCE_ASSETS.illustration}`}
            alt=""
          />
        </div>
      </section>
    </main>
  );
}
