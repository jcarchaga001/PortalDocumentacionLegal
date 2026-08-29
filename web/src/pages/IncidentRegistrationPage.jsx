import { Button, Form, Input, Select, Upload } from "antd";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { validateLegacyIncidentFileName } from "../config/legacyFileContracts.js";
import { ROUTES } from "../routes/routePaths.js";
import { uploadIncidentFile } from "../services/incidentFileService.js";
import { createIncident, getIncidentCatalogs } from "../services/incidentService.js";
import { options } from "./IncidentUi.jsx";
import { INCIDENT_REGISTRATION_SURFACES } from "./incidentRegistrationParity.js";

const emptyCatalogs = { branches: [], agencies: [], recipients: [], types: [] };

function currentLocalDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function IncidentRegistrationView({ surface }) {
  const history = useHistory();
  const [form] = Form.useForm();
  const [catalogs, setCatalogs] = useState(emptyCatalogs);
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialVisitAt] = useState(currentLocalDateTime);
  const [previewUrl, setPreviewUrl] = useState("");
  const selectedFile = fileList[0]?.originFileObj || fileList[0] || null;
  const selectedFileName = selectedFile?.name || "";
  const selectedFileType = String(selectedFile?.type || "").toLowerCase();

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return undefined;
    }
    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  useEffect(() => {
    let active = true;
    getIncidentCatalogs(surface.scope).then((result) => {
      if (!active) return;
      if (result.success) setCatalogs(result.data || emptyCatalogs);
      else setError(result.message || "No fue posible cargar los catalogos.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [surface.scope]);

  async function changeBranch(branchId) {
    form.setFieldValue("visitorId", undefined);
    if (!branchId) {
      setCatalogs((current) => ({ ...current, recipients: [] }));
      return;
    }
    const result = await getIncidentCatalogs(surface.scope, { branchId });
    if (result.success) setCatalogs(result.data || emptyCatalogs);
    else setError(result.message || "No fue posible cargar los catalogos.");
  }

  function acceptEvidenceFile(file) {
    const validation = validateLegacyIncidentFileName(file?.name);
    if (!validation.valid) {
      setError(validation.message);
      return Upload.LIST_IGNORE;
    }
    setError("");
    return false;
  }

  async function submit(values) {
    const file = fileList[0]?.originFileObj || fileList[0];
    if (!file) {
      form.setFields([{ name: "evidence", errors: ["Adjunte el archivo de evidencia."] }]);
      setError(surface.incompleteFeedback);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const upload = await uploadIncidentFile(file, { scope: surface.scope, purpose: "incident-registration" });
      if (!upload.success) {
        setError(upload.message || "No fue posible cargar la evidencia.");
        return;
      }
      const result = await createIncident(surface.scope, { ...values, ...upload.data });
      if (!result.success) {
        setError(result.message || "No fue posible registrar el incidente.");
        return;
      }
      history.replace(ROUTES.externalIncidents);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`legacy-incident-page legacy-incident-form-page incident-registration-${surface.scope}`}
      data-incident-registration-surface={surface.sourceName}
    >
      <button type="button" className="legacy-incident-back" onClick={() => history.goBack()}>
        <i className="fa fa-arrow-left" aria-hidden="true" /> {surface.backText}
      </button>
      <div className="legacy-incident-title-row">
        <h1>{surface.title}</h1>
      </div>

      <LegacyErrorFeedback message={error} />

      <div className="legacy-incident-registration-columns">
        <div className="legacy-incident-registration-column">
          <Form
            form={form}
            layout="vertical"
            className="legacy-incident-registration"
            initialValues={{ visitAt: initialVisitAt }}
            requiredMark={false}
            onFinish={submit}
            onFinishFailed={() => setError(surface.incompleteFeedback)}
            disabled={loading}
          >
            <div className="legacy-incident-registration-grid">
              <Form.Item name="branchId" label={surface.branchLabel} rules={[{ required: true, message: "Seleccione una sucursal." }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={surface.branchPlaceholder}
                  options={options(catalogs.branches)}
                  onChange={changeBranch}
                />
              </Form.Item>
              <Form.Item className="legacy-incident-visit-field" name="visitAt" label={surface.visitLabel} rules={[{ required: true, message: "Ingrese la fecha de visita." }]}>
                <Input type="datetime-local" />
              </Form.Item>
              <Form.Item
                name="agencyId"
                label={surface.agencyLabel}
                rules={[{ required: true, message: surface.scope === "external" ? "Seleccione un ente gubernamental." : "Seleccione un area." }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={surface.agencyPlaceholder}
                  options={options(catalogs.agencies)}
                />
              </Form.Item>
              <Form.Item name="visitorId" label={surface.visitorLabel} rules={[{ required: true, message: "Seleccione un usuario." }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={surface.visitorPlaceholder}
                  options={options(catalogs.recipients)}
                />
              </Form.Item>
            </div>
            <Form.Item
              className="legacy-incident-comment-field"
              name="comment"
              label={surface.commentLabel}
              rules={[{ required: true, whitespace: true, message: "Ingrese el comentario del gerente." }]}
            >
              <Input.TextArea rows={3} maxLength={1024} />
            </Form.Item>
            <Form.Item className="legacy-incident-evidence-field" name="evidence" label={surface.evidenceLabel} required>
              <Upload.Dragger
                beforeUpload={acceptEvidenceFile}
                maxCount={1}
                fileList={fileList}
                showUploadList={false}
                onChange={({ fileList: next }) => {
                  setFileList(next.slice(-1));
                  form.setFields([{ name: "evidence", errors: [] }]);
                }}
              >
                <p className="ant-upload-drag-icon"><i className="fa fa-paperclip" aria-hidden="true" /></p>
                <p>{selectedFileName || surface.evidencePrompt}</p>
              </Upload.Dragger>
            </Form.Item>
            <div className="legacy-form-actions">
              <Button type="primary" htmlType="submit" loading={saving}>{surface.saveText}</Button>
            </div>
          </Form>
        </div>
        <div className="legacy-incident-registration-column legacy-incident-registration-preview">
          {!previewUrl ? (
            <span>{surface.emptyPreview}</span>
          ) : selectedFileType.startsWith("image/") ? (
            <img src={previewUrl} alt={selectedFileName} />
          ) : (
            <iframe src={previewUrl} title={selectedFileName || "Vista previa de evidencia"} />
          )}
        </div>
      </div>
    </div>
  );
}

export function InternalIncidentRegistrationPage() {
  return <IncidentRegistrationView surface={INCIDENT_REGISTRATION_SURFACES.internal} />;
}

export function ExternalIncidentRegistrationPage() {
  return <IncidentRegistrationView surface={INCIDENT_REGISTRATION_SURFACES.external} />;
}
