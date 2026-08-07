import { LogoutOutlined } from "@ant-design/icons";
import { Dropdown, Layout } from "antd";
import { useHistory, useLocation } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { ROUTES } from "../routes/routePaths.js";

const { Header, Content } = Layout;

const navigationGroups = [
  {
    key: "documentation",
    label: "Documentación",
    items: [
      { key: ROUTES.documentHistory, label: "Documentación Sucursales" },
      { key: ROUTES.administrativeDocuments, label: "Documentación Administrativa" },
      { key: ROUTES.expiringDocuments, label: "Proximos a Vencer" },
      { key: ROUTES.agreements, label: "Registro de convenios" },
    ],
  },
  {
    key: "catalogs",
    label: "Catálogos",
    items: [
      { key: ROUTES.providers, label: "Provedores" },
      { key: ROUTES.documentCategories, label: "Categorías Documentos" },
      { key: ROUTES.governmentEntities, label: "Entes Gubernamentales" },
      { key: ROUTES.corporateClients, label: "Clientes Corporativos" },
      { key: ROUTES.legalActions, label: "Acciones Legal" },
    ],
  },
  {
    key: "incidents",
    label: "Incidentes",
    items: [
      { key: ROUTES.internalIncidents, label: "Incidentes Internos" },
      { key: ROUTES.internalIncidentActions, label: "Acciones Incidentes Internos" },
      { key: ROUTES.externalIncidents, label: "Incidentes Externos" },
      { key: ROUTES.externalIncidentActions, label: "Acciones Incidentes Externos" },
      { key: ROUTES.laborCases, label: "Control Casos Laborales" },
      { key: ROUTES.myLaborActions, label: "Mis Acciones Casos Laborales" },
    ],
  },
  {
    key: "configuration",
    allowedPositions: [7, 15],
    label: "Configuración",
    items: [
      { key: ROUTES.users, label: "Permisos Usuario Casos Laborales" },
    ],
  },
];

function isGroupActive(group, pathname) {
  return group.items.some(({ key }) => pathname === key);
}

export function PortalLayout({ children }) {
  const history = useHistory();
  const location = useLocation();
  const { signOut, user } = useAuth();

  async function handleLogout() {
    await signOut();
    history.replace(ROUTES.login);
  }

  return (
    <Layout className="portal-shell">
      <Header className="portal-header">
        <div className="legacy-header-main">
          <button
            className="legacy-brand"
            type="button"
            onClick={() => history.push(ROUTES.branchMonitoring)}
            aria-label="Documentación Legal"
          >
            <img src={`${runtimeConfig.basePath}/brand/logo.png`} alt="Documentación Legal" />
            <span>DocumentacionLegal</span>
          </button>

          <nav className="legacy-navigation" aria-label="Navegación principal">
            <button
              type="button"
              className={`legacy-nav-item${location.pathname === ROUTES.dashboard ? " is-active" : ""}`}
              onClick={() => history.push(ROUTES.dashboard)}
            >
              Dashboard
            </button>

            {navigationGroups
              .filter((group) => !group.allowedPositions || group.allowedPositions.includes(Number(user?.positionCode)))
              .map((group) => (
              <Dropdown
                key={group.key}
                trigger={["hover", "click"]}
                placement="bottomLeft"
                overlayClassName="legacy-nav-dropdown"
                menu={{
                  items: group.items,
                  selectedKeys: group.items.some(({ key }) => key === location.pathname) ? [location.pathname] : [],
                  onClick: ({ key }) => history.push(key),
                }}
              >
                <button
                  type="button"
                  className={`legacy-nav-item${isGroupActive(group, location.pathname) ? " is-active" : ""}`}
                >
                  {group.label}
                </button>
              </Dropdown>
              ))}
          </nav>
        </div>

        <div className="legacy-session">
          <img
            className="legacy-country-flag"
            src={`${runtimeConfig.basePath}/brand/country-honduras.png`}
            alt="Honduras"
          />
          <span>{user?.name || "Administrador Regional"}</span>
          <button type="button" className="legacy-logout" onClick={handleLogout} aria-label="Cerrar sesión">
            <LogoutOutlined />
          </button>
        </div>
      </Header>

      <Content className="portal-content">{children}</Content>
    </Layout>
  );
}
