import { ArrowLeftOutlined, PaperClipOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Select, Upload, message } from "antd";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import { uploadIncidentFile } from "../services/incidentFileService.js";
import { createIncident, getIncidentCatalogs } from "../services/incidentService.js";
import { options } from "./IncidentUi.jsx";

const emptyCatalogs = { branches: [], agencies: [], recipients: [] };

function currentLocalDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function IncidentRegistrationPage({ scope }) {
  const history = useHistory();
  const [form] = Form.useForm();
  const [catalogs, setCatalogs] = useState(emptyCatalogs);
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialVisitAt] = useState(currentLocalDateTime);
  const external = scope === "external";

  useEffect(() => {
    let active = true;
    getIncidentCatalogs(scope).then((result) => {
      if (!active) return;
      if (result.success) setCatalogs(result.data || emptyCatalogs);
      else setError(result.message || "No fue posible cargar los catalogos.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [scope]);

  async function changeBranch(branchId) {
    form.setFieldValue("visitorId", undefined);
    if (!branchId) {
      setCatalogs((current) => ({ ...current, recipients: [] }));
      return;
    }
    const result = await getIncidentCatalogs(scope, { branchId });
    if (result.success) setCatalogs(result.data || emptyCatalogs);
    else message.error(result.message);
  }

  async function submit(values) {
    const file = fileList[0]?.originFileObj || fileList[0];
    if (!file) {
      form.setFields([{ name: "evidence", errors: ["Adjunte el archivo de evidencia."] }]);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const upload = await uploadIncidentFile(file, { scope, purpose: "incident-registration" });
      if (!upload.success) {
        setError(upload.message || "No fue posible cargar la evidencia.");
        return;
      }
      const result = await createIncident(scope, { ...values, ...upload.data });
      if (!result.success) {
        setError(result.message || "No fue posible registrar el incidente.");
        return;
      }
      message.success("Incidente registrado correctamente.");
      history.replace(
        `${ROUTES.incidentDetail}?CodIncidente=${result.data.id}&codigoSucursal=${result.data.branchId || ""}&scope=${scope}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="legacy-incident-page legacy-incident-form-page">
      <button type="button" className="legacy-incident-back" onClick={() => history.goBack()}>
        <ArrowLeftOutlined /> Regresar pantalla anterior...
      </button>
      <div className="legacy-incident-title-row">
        <h1>{external ? "Registro Incidente Externo" : "Registro Incidente Interno"}</h1>
      </div>

      {error && <Alert className="legacy-incident-alert" type="error" showIcon message={error} />}

      <Form
        form={form}
        layout="vertical"
        className="legacy-incident-registration"
        initialValues={{ visitAt: initialVisitAt }}
        requiredMark={false}
        onFinish={submit}
        disabled={loading}
      >
        <div className="legacy-incident-registration-grid">
          <Form.Item name="branchId" label="Sucursal" rules={[{ required: true, message: "Seleccione una sucursal." }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Seleccione Sucursal"
              options={options(catalogs.branches)}
              onChange={changeBranch}
            />
          </Form.Item>
          <Form.Item className="legacy-incident-visit-field" name="visitAt" label="Fecha Visita:" rules={[{ required: true, message: "Ingrese la fecha de visita." }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item
            name="agencyId"
            label={external ? "Ente Gubernamental" : "Area"}
            rules={[{ required: true, message: external ? "Seleccione un ente gubernamental." : "Seleccione un area." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Seleccione Ente"
              options={options(catalogs.agencies)}
            />
          </Form.Item>
          <Form.Item name="visitorId" label="Usuario" rules={[{ required: true, message: "Seleccione un usuario." }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Seleccione Usuario"
              options={options(catalogs.recipients)}
            />
          </Form.Item>
        </div>
        <Form.Item
          className="legacy-incident-comment-field"
          name="comment"
          label="Comentario del Gerente:"
          rules={[{ required: true, whitespace: true, message: "Ingrese el comentario del gerente." }]}
        >
          <Input.TextArea rows={3} maxLength={1024} />
        </Form.Item>
        <Form.Item className="legacy-incident-evidence-field" name="evidence" label="Evidencia:" required>
          <Upload.Dragger
            beforeUpload={() => false}
            maxCount={1}
            fileList={fileList}
            onChange={({ fileList: next }) => {
              setFileList(next.slice(-1));
              form.setFields([{ name: "evidence", errors: [] }]);
            }}
          >
            <p className="ant-upload-drag-icon"><PaperClipOutlined /></p>
            <p>Adjunte Archivo</p>
          </Upload.Dragger>
        </Form.Item>
        <div className="legacy-form-actions">
          <Button type="primary" htmlType="submit" loading={saving}>Guardar</Button>
        </div>
      </Form>
    </div>
  );
}

export function InternalIncidentRegistrationPage() {
  return <IncidentRegistrationPage scope="internal" />;
}

export function ExternalIncidentRegistrationPage() {
  return <IncidentRegistrationPage scope="external" />;
}
