import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PASSWORD_RESET_LEGACY } from "../src/pages/passwordResetParity.js";

test("scrResetarClave conserva los textos y propiedades exactas del OML/runtime", () => {
  assert.deepEqual(PASSWORD_RESET_LEGACY, {
    browserTitle: "Portal Documentación Legal",
    heading: "Cambio de Credenciales",
    prompt: "Debe de ingresar una clave personalizada.",
    label: "Clave",
    button: "Guardar",
    inputId: "Input_Credencial",
    maxLength: 128,
    mandatory: false,
    buttonWidth: "15.0327%",
  });
});

test("scrResetarClave usa password nativo sin ojo ni validacion minima inventada", async () => {
  const page = await readFile(new URL("../src/pages/PasswordResetPage.jsx", import.meta.url), "utf8");

  assert.match(page, /type="password"/);
  assert.match(page, /maxLength=\{PASSWORD_RESET_LEGACY\.maxLength\}/);
  assert.match(page, /aria-required=\{PASSWORD_RESET_LEGACY\.mandatory\}/);
  assert.match(page, /className="btn btn-primary ThemeGrid_Width2"/);
  assert.match(page, /type="submit"/);
  assert.match(page, /window\.location\.replace\(`\$\{runtimeConfig\.basePath\}\$\{ROUTES\.login\}`\)/);
  assert.doesNotMatch(page, /Input\.Password|autoComplete|min:\s*8|required:\s*true|message\.success|Clave actualizada correctamente/);
});

test("scrResetarClave conserva geometria y colorimetria medidas a 1280 por 720", async () => {
  const css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");
  const start = css.indexOf(".legacy-password-reset-page");
  const end = css.indexOf(".legacy-invalid-permissions-page", start);
  const resetCss = css.slice(start, end);

  assert.match(resetCss, /margin: 0 0 32px;/);
  assert.match(resetCss, /font-size: 32px;/);
  assert.match(resetCss, /line-height: 40px;/);
  assert.match(resetCss, /padding: 24px;/);
  assert.match(resetCss, /border: 1px solid #dee2e6;/);
  assert.match(resetCss, /font-size: 18px;/);
  assert.match(resetCss, /margin-top: 20px;/);
  assert.match(resetCss, /border: 1px solid #ced4da;/);
  assert.match(resetCss, /margin: 0 0 24px;/);
  assert.match(resetCss, /width: 15\.0327%;/);
  assert.match(resetCss, /background: #4d5c66;/);
});

test("la ruta de reset permanece protegida mientras Anonymous no tenga UAT seguro", async () => {
  const routes = await readFile(new URL("../src/routes/AppRoutes.jsx", import.meta.url), "utf8");
  const protectedStart = routes.indexOf('<ProtectedRoute path="/">');
  const resetRoute = routes.indexOf("<Route path={ROUTES.passwordReset} exact component={PasswordResetPage} />");
  const protectedEnd = routes.indexOf("</ProtectedRoute>", protectedStart);

  assert.ok(protectedStart >= 0 && resetRoute > protectedStart && resetRoute < protectedEnd);
});

