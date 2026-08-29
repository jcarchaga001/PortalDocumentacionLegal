import { message } from "antd";
import { useHistory } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { writeLegacyDocumentType } from "../config/legacyDocumentContext.js";
import { canShowLandingShortcut, LANDING_SHORTCUTS } from "../config/legacyPortalNavigation.js";

const shortcutIcons = Object.freeze({
  home: "fa-home",
  dashboardGlobal: "fa-area-chart",
  providers: "fa-newspaper-o",
  documents: "fa-folder-open",
  dashboardBranches: "fa-pie-chart",
  settings: "fa-cog",
  warning: "fa-exclamation-triangle",
  incidents: "fa-user-secret",
});

export function PortalLandingPage() {
  const history = useHistory();
  const { user } = useAuth();
  const initials = (user?.name || "Administrador Regional")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const visibleShortcuts = LANDING_SHORTCUTS.filter((shortcut) => canShowLandingShortcut(shortcut, user));

  function openShortcut(shortcut) {
    if (!shortcut.route) {
      message.info("En desarrollo");
      return;
    }
    if (shortcut.documentType) writeLegacyDocumentType(shortcut.documentType);
    history.push(shortcut.route);
  }

  function shortcutButton(shortcut, extraClass = "") {
    const iconClass = shortcutIcons[shortcut.icon] || "fa-file-text-o";
    return (
      <button
        type="button"
        className={`btn btn-primary OSFillParent legacy-shortcut ${extraClass}`.trim()}
        key={`${shortcut.label}-${shortcut.detail || ""}`}
        onClick={() => openShortcut(shortcut)}
      >
        <i className={`icon fa ${iconClass} fa-1x`} aria-hidden="true" />
        <span>{shortcut.label}</span>
        {shortcut.detail ? <small>{shortcut.detail}</small> : null}
      </button>
    );
  }

  return (
    <div className="legacy-landing-page">
      <div className="legacy-landing-welcome">
        <div className="legacy-landing-avatar" role="img" aria-label={`user initials, ${initials}`}>
          {initials}
        </div>
        <h1>Bienvenido {user?.name || "Administrador Regional"}</h1>
      </div>
      <div className="legacy-shortcut-layout">
        <div className="legacy-shortcut-grid">
          {visibleShortcuts.filter((shortcut) => shortcut.group === "primary").map((shortcut) => shortcutButton(shortcut))}
        </div>
        <div className="legacy-shortcut-secondary">
          {visibleShortcuts.filter((shortcut) => shortcut.group === "secondary").map((shortcut) => (
            shortcutButton(shortcut, "is-secondary")
          ))}
        </div>
      </div>
    </div>
  );
}
