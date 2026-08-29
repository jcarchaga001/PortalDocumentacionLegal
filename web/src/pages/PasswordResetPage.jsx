import { useEffect, useRef, useState } from "react";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { ROUTES } from "../routes/routePaths.js";
import { resetPassword } from "../services/authService.js";
import { PASSWORD_RESET_LEGACY } from "./passwordResetParity.js";

export function PasswordResetPage() {
  const inFlight = useRef(false);
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = PASSWORD_RESET_LEGACY.browserTitle;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    inFlight.current = true;
    setFeedback("");
    const result = await resetPassword(password);
    inFlight.current = false;

    if (!result.success) {
      setFeedback(result.message || "No fue posible actualizar la clave.");
      return;
    }

    // GuardarOnClick termina directamente en Common\Login. El API ya invalida
    // la cookie, por lo que una navegación completa evita inventar un segundo
    // Logout y reconstruye el estado anónimo del destino.
    window.location.replace(`${runtimeConfig.basePath}${ROUTES.login}`);
  }

  return (
    <div className="legacy-password-reset-page">
      <LegacyErrorFeedback message={feedback} />
      <h1 className="legacy-password-reset-title">{PASSWORD_RESET_LEGACY.heading}</h1>
      <form
        action=""
        className="legacy-password-reset-form form card OSFillParent"
        data-form=""
        id="Form1"
        noValidate
        onSubmit={submit}
      >
        <div data-container="">
          <span className="legacy-password-reset-prompt">{PASSWORD_RESET_LEGACY.prompt}</span>
        </div>
        <div className="legacy-password-reset-field" data-container="">
          <label className="OSFillParent" data-label="" htmlFor={PASSWORD_RESET_LEGACY.inputId}>
            {PASSWORD_RESET_LEGACY.label}
          </label>
          <span className="input-password">
            <input
              aria-required={PASSWORD_RESET_LEGACY.mandatory}
              className="form-control OSFillParent"
              data-input=""
              id={PASSWORD_RESET_LEGACY.inputId}
              maxLength={PASSWORD_RESET_LEGACY.maxLength}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </span>
        </div>
        <div className="legacy-password-reset-actions" data-container="">
          <button
            className="btn btn-primary ThemeGrid_Width2"
            data-button=""
            type="submit"
          >
            {PASSWORD_RESET_LEGACY.button}
          </button>
        </div>
      </form>
    </div>
  );
}
