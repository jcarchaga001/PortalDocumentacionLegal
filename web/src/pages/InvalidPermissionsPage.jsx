import { useHistory } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { ROUTES } from "../routes/routePaths.js";

export function InvalidPermissionsPage() {
  const history = useHistory();
  const { loading, user } = useAuth();

  function goBack() {
    history.goBack();
  }

  return (
    <div className="legacy-invalid-permissions-page">
      <header className="legacy-invalid-permissions-header">
        <div className="legacy-invalid-permissions-header-content">
          <button
            type="button"
            className="legacy-brand"
            onClick={() => history.push(ROUTES.branchMonitoring)}
          >
            <img src={`${runtimeConfig.basePath}/brand/logo.png`} alt="" />
            <span>DocumentacionLegal</span>
          </button>
        </div>
      </header>
      <main className="legacy-invalid-permissions-main">
        <section className="legacy-invalid-permissions blank-slate large">
          <div className="ph blank-slate-icon">
            <i className="icon text-neutral-4 fa fa-exclamation-triangle fa-1x" aria-hidden="true" />
          </div>
          <div className="ph blank-slate-description">
            <h1 className="heading6">No tiene permisos para ingresar a esta pantalla.</h1>
            <p className="margin-top-s">Contacte su administrador.</p>
          </div>
          <div className="ph blank-slate-actions">
            <button type="button" className="btn" onClick={goBack}>
              <i className="icon fa fa-angle-left fa-1x" aria-hidden="true" />
              <span className="margin-left-s">Regresar</span>
            </button>
            {!loading && !user ? (
              <button
                type="button"
                className="btn btn-primary margin-left-m"
                onClick={() => history.push(ROUTES.login)}
              >
                Ingresar
              </button>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
