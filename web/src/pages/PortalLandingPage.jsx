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
import { ROUTES } from "../routes/routePaths.js";

const shortcuts = [
  { label: "Documentación", detail: "Sucursales", icon: <HomeOutlined />, route: ROUTES.documentHistory },
  { label: "Dashboard Global", icon: <BarChartOutlined /> },
  { label: "Proveedores", icon: <ReadOutlined /> },
  { label: "Documentación", detail: "Administrativa", icon: <FolderOpenOutlined />, route: ROUTES.administrativeDocuments },
  { label: "Dashboard Sucursales", icon: <BarChartOutlined /> },
  { label: "Configuración", icon: <SettingOutlined /> },
  { label: "Próximos a Vencer", icon: <AlertOutlined /> },
  { label: "Incidentes", icon: <TeamOutlined /> },
];

export function PortalLandingPage() {
  const history = useHistory();
  const { user } = useAuth();

  function openShortcut(shortcut) {
    if (shortcut.route) history.push(shortcut.route);
    else message.info("En desarrollo");
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
        {shortcuts.map((shortcut) => (
          <button type="button" key={`${shortcut.label}-${shortcut.detail || ""}`} onClick={() => openShortcut(shortcut)}>
            <span className="legacy-shortcut-icon">{shortcut.icon || <FileTextOutlined />}</span>
            <span>{shortcut.label}</span>
            {shortcut.detail ? <small>{shortcut.detail}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
