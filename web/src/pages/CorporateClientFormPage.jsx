import { MinusCircleOutlined, PlusCircleOutlined } from "@ant-design/icons";
import { Button, Form, Input, Space, Switch, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import {
  createCorporateClient,
  getCorporateClient,
  setCorporateClientStatus,
  updateCorporateClient,
} from "../services/corporateClientService.js";

function clientIdFromSearch(search) {
  const value = Number(new URLSearchParams(search).get("CodCliente"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function CorporateClientFormPage() {
  const history = useHistory();
  const location = useLocation();
  const clientId = useMemo(() => clientIdFromSearch(location.search), [location.search]);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(Boolean(clientId));
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let active = true;
    if (!clientId) return () => { active = false; };
    getCorporateClient(clientId).then((result) => {
      if (!active) return;
      if (result.success) {
        form.setFieldsValue(result.data);
        setIsActive(result.data.isActive);
      } else message.error(result.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [clientId, form]);

  async function submit(values) {
    setSaving(true);
    const result = clientId
      ? await updateCorporateClient(clientId, values)
      : await createCorporateClient(values);
    if (!result.success) {
      message.error(result.message);
      setSaving(false);
      return;
    }
    if (clientId && result.data?.isActive !== isActive) {
      const statusResult = await setCorporateClientStatus(clientId, isActive);
      if (!statusResult.success) message.warning(statusResult.message);
    }
    message.success(clientId ? "Cliente actualizado correctamente." : "Cliente creado correctamente.");
    history.replace(ROUTES.corporateClients);
  }

  return (
    <div className="legacy-form-page legacy-client-form-page">
      <h1>{clientId ? "Editar Cliente Corporativo" : "Nuevo Cliente Corporativo"}</h1>
      <Form form={form} layout="vertical" className="legacy-business-form" onFinish={submit} disabled={loading}>
        <div className="legacy-business-grid">
          <Form.Item label="Nombre Cliente" name="name" rules={[{ required: true, message: "Ingrese el nombre del cliente." }]}><Input maxLength={250} /></Form.Item>
          <Form.Item label="CodigoFA" name="faCode" rules={[{ required: true, message: "Ingrese el CodigoFA." }]}><Input maxLength={30} /></Form.Item>
          <Form.Item label="Nombre Contacto Principal" name="contactName"><Input maxLength={120} /></Form.Item>
          <Form.Item label="Puesto Contacto Principal" name="contactPosition"><Input maxLength={160} /></Form.Item>
          <Form.Item label="Correo Contacto Principal" name="contactEmail" rules={[{ type: "email", message: "Ingrese un correo válido." }]}><Input maxLength={120} /></Form.Item>
          <Form.Item label="Teléfono Contacto Principal" name="contactPhone"><Input addonBefore="+504" maxLength={25} /></Form.Item>
          {clientId ? <Form.Item label="Cliente Activo"><Switch checked={isActive} onChange={setIsActive} checkedChildren="Sí" unCheckedChildren="No" /></Form.Item> : null}
        </div>

        <section className="legacy-form-section">
          <h2>Contactos Extras</h2>
          <Form.List name="contacts">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div className="legacy-contact-row" key={key}>
                    <Form.Item {...restField} name={[name, "id"]} hidden><Input /></Form.Item>
                    <Form.Item {...restField} label="Nombre" name={[name, "name"]} rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item {...restField} label="Puesto" name={[name, "position"]}><Input /></Form.Item>
                    <Form.Item
                      {...restField}
                      label="Teléfono"
                      name={[name, "phone"]}
                      rules={[{ required: true, whitespace: true, message: "Ingrese el número de teléfono del contacto." }]}
                    >
                      <Input addonBefore="+504" />
                    </Form.Item>
                    <Form.Item {...restField} label="Correo" name={[name, "email"]} rules={[{ type: "email" }]}><Input /></Form.Item>
                    <Button type="text" danger icon={<MinusCircleOutlined />} aria-label="Quitar contacto" onClick={() => remove(name)} />
                  </div>
                ))}
                <Button type="dashed" icon={<PlusCircleOutlined />} onClick={() => add()} block>Agregar contacto</Button>
              </>
            )}
          </Form.List>
        </section>
        <Space className="legacy-form-actions">
          <Button danger onClick={() => history.push(ROUTES.corporateClients)}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>{clientId ? "Actualizar Cliente" : "Crear Cliente"}</Button>
        </Space>
      </Form>
    </div>
  );
}
