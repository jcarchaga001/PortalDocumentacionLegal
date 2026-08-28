import { App, Button, Form, Input, Select } from "antd";
import { useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { ROUTES } from "../routes/routePaths.js";
import { getCountries } from "../services/authService.js";
import { requestPasswordRecovery } from "../services/authService.js";

export function LoginPage() {
  const { message } = App.useApp();
  const history = useHistory();
  const location = useLocation();
  const { signIn } = useAuth();
  const [form] = Form.useForm();
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoveryType, setRecoveryType] = useState("usuario");
  const [recoveryUser, setRecoveryUser] = useState("");
  const [recoveryAlias, setRecoveryAlias] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setCountries([]);
    setCountriesError("");
    setCountriesLoading(true);
    getCountries()
      .then((result) => {
        if (!active) return;
        if (!result.success) {
          setCountriesError(result.message || "No fue posible cargar los países disponibles.");
          return;
        }
        if (!Array.isArray(result.data) || result.data.length === 0) {
          setCountriesError("No hay países disponibles para iniciar sesión.");
          return;
        }
        setCountries(result.data);
      })
      .catch(() => {
        if (active) setCountriesError("No fue posible cargar los países disponibles.");
      })
      .finally(() => {
        if (active) setCountriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const countriesReady = !countriesLoading && !countriesError && countries.length > 0;

  async function handleSubmit(values) {
    if (!countriesReady) {
      message.error(countriesError || "Espere mientras se cargan los países disponibles.");
      return;
    }
    if (!values.countryCode) {
      message.error("Debe Seleccionar País");
      return;
    }
    setSubmitting(true);
    const result = await signIn(values);
    setSubmitting(false);

    if (!result.success) {
      message.error(result.message || "No fue posible iniciar sesión.");
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
    if (!countriesReady) {
      message.error(countriesError || "Espere mientras se cargan los países disponibles.");
      return;
    }
    const countryCode = form.getFieldValue("countryCode");
    if (!countryCode) {
      message.error("Debe Seleccionar País");
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
      message.error(result.message || "No fue posible recuperar la clave.");
      return;
    }
    message.success(result.message);
    setForgotOpen(false);
    setRecoveryUser("");
    setRecoveryAlias("");
  }

  return (
    <>
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
            if (!values.countryCode) message.error("Debe Seleccionar País");
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
                loading={countriesLoading}
                disabled={!countriesReady}
                options={countries.map((country) => ({
                  value: country.countryCode,
                  label: country.name,
                }))}
              />
            </Form.Item>

            {(countriesLoading || countriesError) && (
              <div
                className={`legacy-country-catalog-status${countriesError ? " is-error" : ""}`}
                role={countriesError ? "alert" : "status"}
              >
                {countriesError || "Cargando países..."}
              </div>
            )}

            <Form.Item
              label={<span>Usuario <b>*</b></span>}
              name="username"
              rules={[{ required: true, message: "Campo Obligatorio" }]}
            >
              <Input autoComplete="username" />
            </Form.Item>

            <Form.Item
              label={<span>Clave <b>*</b></span>}
              name="password"
              rules={[{ required: true, message: "Campo Obligatorio" }]}
            >
              <Input type="password" autoComplete="current-password" />
            </Form.Item>

            <div className="legacy-forgot-row">
              <button
                className="legacy-forgot-link"
                type="button"
                title="¿Olvido su contraseña?  Registre nuevamente"
                disabled={!countriesReady}
                onClick={() => setForgotOpen(true)}
              >
                Olvidé Contraseña
              </button>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={!countriesReady}
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
                  <span className="legacy-recovery-icon" aria-hidden="true">!</span>
                  <span>Ingrese las credenciales</span>
                </div>

                <label className="legacy-recovery-country">País</label>

                <div className="legacy-recovery-primary legacy-recovery-field">
                  <label>{recoveryType === "usuario" ? "Usuario" : "Correo Electrónico"}</label>
                  <div className={`legacy-recovery-input-row ${recoveryType === "correo" ? "has-gutter" : ""}`}>
                    <input
                      type="text"
                      maxLength={250}
                      required
                      value={recoveryUser}
                      onChange={(event) => setRecoveryUser(event.target.value)}
                    />
                    {recoveryType === "correo" && <input type="text" value="@farmavalue.com" disabled required aria-label="Dominio" />}
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
                    <label>Debe Ingresar un Correo</label>
                    <div className="legacy-recovery-input-row is-adjacent">
                      <input
                        type="text"
                        maxLength={250}
                        required
                        value={recoveryAlias}
                        onChange={(event) => setRecoveryAlias(event.target.value)}
                      />
                      <input type="text" value="@farmavalue.com" disabled required aria-label="Dominio" />
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
