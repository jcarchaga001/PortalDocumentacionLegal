import { Dropdown, Layout } from "antd";
import { useEffect, useMemo, useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileGroupKey, setMobileGroupKey] = useState(null);
  const visibleNavigationGroups = useMemo(
    () => PORTAL_NAVIGATION_GROUPS.filter(
      (group) => !group.allowedPositions || group.allowedPositions.includes(Number(user?.positionCode)),
    ),
    [user?.positionCode],
  );

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileGroupKey(null);
  }, [location.pathname]);

  async function handleLogout(event) {
    event?.preventDefault();
    await signOut();
    window.location.assign(runtimeConfig.postLogoutUrl);
  }

  function navigateToItem(item) {
    if (!item) return;
    if (item.documentType) writeLegacyDocumentType(item.documentType);
    history.push(item.route || item.key);
    setMobileMenuOpen(false);
    setMobileGroupKey(null);
  }

  function renderBrand(className = "") {
    return (
      <button
        className={`legacy-brand${className ? ` ${className}` : ""}`}
        type="button"
        onClick={() => history.push(ROUTES.branchMonitoring)}
      >
        <img src={`${runtimeConfig.basePath}/brand/logo.png`} alt="" />
        <span>DocumentacionLegal</span>
      </button>
    );
  }

  return (
    <Layout className="portal-shell">
      <Header className="portal-header">
        <div className="legacy-header-main">
          <button
            className="legacy-menu-icon"
            type="button"
            aria-label="Toggle the Menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          {renderBrand("legacy-mobile-brand")}

          <nav
            className={`legacy-app-menu-content${mobileMenuOpen ? " is-open" : ""}`}
            aria-label="Navegación principal"
          >
            {renderBrand("legacy-side-brand")}

            <div className="legacy-navigation legacy-navigation-desktop" role="menubar">
              {visibleNavigationGroups.map((group) => (
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
                    onClick: ({ key }) => navigateToItem(
                      group.items.find((candidate) => candidate.key === key),
                    ),
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={`legacy-nav-item${isPortalNavigationGroupActive(group, location.pathname) ? " is-active" : ""}`}
                  >
                    {group.label}
                  </button>
                </Dropdown>
              ))}
            </div>

            <div className="legacy-navigation-mobile" role="menubar">
              {visibleNavigationGroups.map((group) => {
                const expanded = mobileGroupKey === group.key;
                return (
                  <div className="legacy-mobile-nav-group" key={group.key}>
                    <button
                      type="button"
                      role="menuitem"
                      aria-expanded={expanded}
                      className={`legacy-mobile-nav-heading${isPortalNavigationGroupActive(group, location.pathname) ? " is-active" : ""}`}
                      onClick={() => setMobileGroupKey(expanded ? null : group.key)}
                    >
                      {group.label}
                    </button>
                    {expanded && (
                      <div className="legacy-mobile-submenu">
                        {group.items.map((item) => (
                          <button
                            type="button"
                            className={(item.route || item.key) === location.pathname && item.active !== false ? "is-active" : ""}
                            key={item.key}
                            onClick={() => navigateToItem(item)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="legacy-session">
              {country && (
                <img
                  className="legacy-country-flag"
                  src={`${runtimeConfig.basePath}/brand/${country.flagAsset}`}
                  alt=""
                />
              )}
              <span>{user?.name || "Administrador Regional"}</span>
              <a href="#" className="legacy-logout" onClick={handleLogout}>
                <i className="fa fa-sign-out" aria-hidden="true" />
                <span className="legacy-wcag-hide-text">Log out</span>
              </a>
            </div>
          </nav>
        </div>

        <button
          type="button"
          className={`legacy-menu-overlay${mobileMenuOpen ? " is-open" : ""}`}
          aria-label=""
          onClick={() => setMobileMenuOpen(false)}
        />
      </Header>

      <Content className="portal-content">{children}</Content>
    </Layout>
  );
}
