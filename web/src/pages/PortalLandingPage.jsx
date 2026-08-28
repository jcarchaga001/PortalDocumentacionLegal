import {
  AlertOutlined,
  BarChartOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  ReadOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { message } from "antd";
import { useHistory } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { writeLegacyDocumentType } from "../config/legacyDocumentContext.js";
import { canShowLandingShortcut, LANDING_SHORTCUTS } from "../config/legacyPortalNavigation.js";

const shortcutIcons = {
  home: <HomeOutlined />,
  dashboard: <BarChartOutlined />,
  providers: <ReadOutlined />,
  documents: <FolderOpenOutlined />,
  settings: <SettingOutlined />,
  warning: <AlertOutlined />,
  incidents: <TeamOutlined />,
};

export function PortalLandingPage() {
  const history = useHistory();
  const { user } = useAuth();

  function openShortcut(shortcut) {
    if (!shortcut.route) {
      message.info("En desarrollo");
      return;
    }
    if (shortcut.documentType) writeLegacyDocumentType(shortcut.documentType);
    history.push(shortcut.route);
  }

  return (
    <div className="legacy-landing-page">
      <div className="legacy-landing-welcome">
        <div className="legacy-landing-avatar" aria-hidden="true">
          {(user?.name || "Administrador Regional").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
        </div>
        <h1>Bienvenido {user?.name || "Administrador Regional"}</h1>
      </div>
      <div className="legacy-shortcut-grid">
        {LANDING_SHORTCUTS.filter((shortcut) => canShowLandingShortcut(shortcut, user)).map((shortcut) => (
          <button type="button" key={`${shortcut.label}-${shortcut.detail || ""}`} onClick={() => openShortcut(shortcut)}>
            <span className="legacy-shortcut-icon">{shortcutIcons[shortcut.icon] || <FileTextOutlined />}</span>
            <span>{shortcut.label}</span>
            {shortcut.detail ? <small>{shortcut.detail}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
