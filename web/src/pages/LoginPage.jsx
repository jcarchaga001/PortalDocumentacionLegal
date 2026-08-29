import { Button, Form, Input, Select } from "antd";
import { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { useAuth } from "../config/AuthContext.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { ROUTES } from "../routes/routePaths.js";
import { getCountries } from "../services/authService.js";
import { requestPasswordRecovery } from "../services/authService.js";
import { legacyLoginCountries, LOGIN_FEEDBACK } from "./loginParity.js";

export function LoginPage() {
  const history = useHistory();
  const location = useLocation();
  const { signIn } = useAuth();
  const [form] = Form.useForm();
  const [countries, setCountries] = useState([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [feedback, setFeedback] = useState({ message: "", type: "error" });
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoveryType, setRecoveryType] = useState("usuario");
  const [recoveryUser, setRecoveryUser] = useState("");
  const [recoveryAlias, setRecoveryAlias] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setCountries([]);
    getCountries()
      .then((result) => {
        if (!active) return;
        if (!result.success) {
          setFeedback({ message: LOGIN_FEEDBACK.queryError, type: "error" });
          return;
        }
        setCountries(legacyLoginCountries(result.data));
      })
      .catch(() => {
        if (active) setFeedback({ message: LOGIN_FEEDBACK.queryError, type: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleCountries = countries.filter((country) => (
    !countrySearch || country.name?.toLocaleLowerCase().includes(countrySearch.toLocaleLowerCase())
  ));

  async function handleSubmit(values) {
    setFeedback({ message: "", type: "error" });
    if (!values.countryCode) {
      setFeedback({ message: LOGIN_FEEDBACK.countryRequired, type: "error" });
      return;
    }
    setSubmitting(true);
    const result = await signIn(values);
    setSubmitting(false);

    if (!result.success) {
      setFeedback({ message: result.message || LOGIN_FEEDBACK.invalidCredentials, type: "error" });
      return;
    }

    const requestedPath = location.state?.from?.pathname;
    if (result.data?.mustResetPassword) {
      history.replace(ROUTES.passwordReset);
      return;
    }
    history.replace(requestedPath && requestedPath !== ROUTES.login ? requestedPath : ROUTES.dashboard);
  }

  async function handleRecovery() {
    setFeedback({ message: "", type: "error" });
    const countryCode = form.getFieldValue("countryCode");
    if (!countryCode) {
      setFeedback({ message: "Credenciales Incorrectas", type: "error" });
      return;
    }
    setRecoverySubmitting(true);
    const result = await requestPasswordRecovery({
      type: recoveryType,
      countryCode,
      identifier: recoveryUser,
      deliveryAlias: recoveryAlias,
    });
    setRecoverySubmitting(false);
    if (!result.success) {
      setFeedback({ message: result.message || "Credenciales Incorrectas", type: "error" });
      return;
    }
    setFeedback({ message: result.message || LOGIN_FEEDBACK.recoverySuccess, type: "success" });
    setForgotOpen(false);
    setRecoveryUser("");
    setRecoveryAlias("");
  }

  return (
    <>
      <LegacyErrorFeedback message={feedback.message} type={feedback.type} />
      <main
        className="login-screen"
        style={{ "--login-background": `url(${runtimeConfig.basePath}/brand/login-background.jpg)` }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          onFinishFailed={({ values }) => {
            if (!values.countryCode) {
              setFeedback({ message: LOGIN_FEEDBACK.countryRequired, type: "error" });
            }
          }}
          className="login-form"
        >
          <div className="legacy-login-logo">
            <img src={`${runtimeConfig.basePath}/brand/logo-white.png`} alt="3C Group" />
          </div>

          <div className="legacy-login-title">Portal de Documentación Legal</div>

          <div className="legacy-login-inputs">
            <Form.Item name="countryCode">
              <Select
                placeholder="Seleccione País"
                allowClear
                popupClassName="legacy-country-dropdown"
                popupRender={(menu) => (
                  <>
                    <div
                      className="legacy-country-popup-search"
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <i className="fa fa-search" aria-hidden="true" />
                      <input
                        aria-label="Buscar país"
                        placeholder="Search..."
                        value={countrySearch}
                        onChange={(event) => setCountrySearch(event.target.value)}
                      />
                    </div>
                    {menu}
                  </>
                )}
                options={visibleCountries.map((country) => ({
                  value: country.countryCode,
                  label: country.name,
                }))}
              />
            </Form.Item>

            <Form.Item
              label={<span>Usuario <b>*</b></span>}
              name="username"
              rules={[{ required: true, message: LOGIN_FEEDBACK.requiredField }]}
            >
              <Input maxLength={250} required />
            </Form.Item>

            <Form.Item
              label={<span>Clave <b>*</b></span>}
              name="password"
              rules={[{ required: true, message: LOGIN_FEEDBACK.requiredField }]}
            >
              <Input type="password" required />
            </Form.Item>

            <div className="legacy-forgot-row">
              <a
                className="legacy-forgot-link"
                href="#"
                title="¿Olvido su contraseña?  Registre nuevamente"
                onClick={(event) => {
                  event.preventDefault();
                  setForgotOpen(true);
                }}
              >
                Olvidé Contraseña
              </a>
            </div>

            <Button
              type="primary"
              htmlType="button"
              loading={submitting}
              onClick={() => form.submit()}
              block
            >
              Ingresar
            </Button>
          </div>
        </Form>
      </main>

      {forgotOpen && (
        <div className="legacy-recovery-backdrop" role="presentation">
          <div
            className={`legacy-recovery-dialog is-${recoveryType}`}
            role="dialog"
            aria-modal="true"
            aria-label="Ingrese las credenciales"
          >
            <div className="legacy-recovery-card">
              <div className="legacy-recovery-content">
                <div className="legacy-recovery-heading">
                  <i className="fa fa-exclamation-circle legacy-recovery-icon" aria-hidden="true" />
                  <span>Ingrese las credenciales</span>
                </div>

                <label className="legacy-recovery-country">País</label>

                <div className="legacy-recovery-primary legacy-recovery-field">
                  <label>{recoveryType === "usuario" ? "Usuario" : "Correo Electrónico"}<b>*</b></label>
                  <div className={`legacy-recovery-input-row ${recoveryType === "correo" ? "has-gutter" : ""}`}>
                    <input
                      type="text"
                      maxLength={250}
                      required
                      value={recoveryUser}
                      onChange={(event) => setRecoveryUser(event.target.value)}
                    />
                    {recoveryType === "correo" && <input type="text" value="@farmavalue.com" maxLength={250} disabled required aria-label="Dominio" />}
                  </div>
                </div>

                <div className="legacy-recovery-type">
                  <label>Tipo de Ingreso</label>
                  <label className="legacy-recovery-radio">
                    <input
                      type="radio"
                      name="recoveryType"
                      checked={recoveryType === "usuario"}
                      onChange={() => setRecoveryType("usuario")}
                    />
                    <span>Usuario</span>
                  </label>
                  <label className="legacy-recovery-radio">
                    <input
                      type="radio"
                      name="recoveryType"
                      checked={recoveryType === "correo"}
                      onChange={() => setRecoveryType("correo")}
                    />
                    <span>Correo</span>
                  </label>
                </div>

                {recoveryType === "usuario" && (
                  <div className="legacy-recovery-secondary legacy-recovery-field">
                    <label>Debe Ingresar un Correo<b>*</b></label>
                    <div className="legacy-recovery-input-row is-adjacent">
                      <input
                        type="text"
                        maxLength={250}
                        required
                        value={recoveryAlias}
                        onChange={(event) => setRecoveryAlias(event.target.value)}
                      />
                      <input type="text" value="@farmavalue.com" maxLength={250} disabled required aria-label="Dominio" />
                    </div>
                  </div>
                )}

                <div className="legacy-recovery-actions">
                  <button
                    className="legacy-recovery-cancel"
                    type="button"
                    onClick={() => setForgotOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="legacy-recovery-send"
                    type="button"
                    disabled={recoverySubmitting}
                    onClick={handleRecovery}
                  >
                    {recoverySubmitting ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
