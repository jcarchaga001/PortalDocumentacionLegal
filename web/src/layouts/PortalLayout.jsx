import { Dropdown, Layout } from "antd";
import { useHistory, useLocation } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { getCountryMetadata } from "../config/countryMetadata.js";
import { writeLegacyDocumentType } from "../config/legacyDocumentContext.js";
import {
  isPortalNavigationGroupActive,
  PORTAL_NAVIGATION_GROUPS,
} from "../config/legacyPortalNavigation.js";
import { runtimeConfig } from "../config/runtime.js";
import { ROUTES } from "../routes/routePaths.js";

const { Header, Content } = Layout;

export function PortalLayout({ children }) {
  const history = useHistory();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const country = getCountryMetadata(user?.countryCode);

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
            {PORTAL_NAVIGATION_GROUPS
              .filter((group) => !group.allowedPositions || group.allowedPositions.includes(Number(user?.positionCode)))
              .map((group) => (
              <Dropdown
                key={group.key}
                trigger={["hover", "click"]}
                placement="bottomLeft"
                overlayClassName="legacy-nav-dropdown"
                menu={{
                  items: group.items,
                  selectedKeys: group.items
                    .filter((item) => item.active !== false && (item.route || item.key) === location.pathname)
                    .map((item) => item.key),
                  onClick: ({ key }) => {
                    const item = group.items.find((candidate) => candidate.key === key);
                    if (item?.documentType) writeLegacyDocumentType(item.documentType);
                    history.push(item?.route || key);
                  },
                }}
              >
                <button
                  type="button"
                  className={`legacy-nav-item${isPortalNavigationGroupActive(group, location.pathname) ? " is-active" : ""}`}
                >
                  {group.label}
                </button>
              </Dropdown>
              ))}
          </nav>
        </div>

        <div className="legacy-session">
          {country && (
            <img
              className="legacy-country-flag"
              src={`${runtimeConfig.basePath}/brand/${country.flagAsset}`}
              alt={country.name}
            />
          )}
          <span>{user?.name || "Administrador Regional"}</span>
          <button type="button" className="legacy-logout" onClick={handleLogout}>
            <i className="fa fa-sign-out" aria-hidden="true" />
            <span className="legacy-wcag-hide-text">Log out</span>
          </button>
        </div>
      </Header>

      <Content className="portal-content">{children}</Content>
    </Layout>
  );
}
