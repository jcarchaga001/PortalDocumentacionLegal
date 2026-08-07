import { Button, Form, Input, message } from "antd";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { resetPassword } from "../services/authService.js";

export function PasswordResetPage() {
  const history = useHistory();
  const { signOut } = useAuth();
  const [saving, setSaving] = useState(false);

  async function submit(values) {
    setSaving(true);
    const result = await resetPassword(values.password);
    setSaving(false);
    if (!result.success) {
      message.error(result.message || "No fue posible actualizar la clave.");
      return;
    }
    message.success("Clave actualizada correctamente.");
    await signOut();
    history.replace(ROUTES.login);
  }

  return (
    <div className="legacy-password-reset-page">
      <section className="legacy-password-reset-card">
        <h1>Cambio de Credenciales</h1>
        <p>Debe de ingresar una clave personalizada.</p>
        <Form layout="vertical" onFinish={submit}>
          <Form.Item
            label="Clave"
            name="password"
            rules={[
              { required: true, message: "Ingrese una clave." },
              { min: 8, message: "La clave debe contener al menos 8 caracteres." },
            ]}
          >
            <Input.Password autoComplete="new-password" maxLength={256} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Guardar</Button>
        </Form>
      </section>
    </div>
  );
}
