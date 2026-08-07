import { InboxOutlined } from "@ant-design/icons";
import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select, Upload, message } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import {
  createAgreement,
  getAgreement,
  getAgreementCatalogs,
  updateAgreement,
} from "../services/agreementService.js";
import { fileToBase64 } from "../services/fileHelpers.js";
import { uploadFileToS3 } from "../services/tdS3Service.js";

function agreementIdFromSearch(search) {
  const value = Number(new URLSearchParams(search).get("CodConvenio"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function AgreementFormPage() {
  const history = useHistory();
  const location = useLocation();
  const agreementId = useMemo(() => agreementIdFromSearch(location.search), [location.search]);
  const [form] = Form.useForm();
  const [catalogs, setCatalogs] = useState({ clients: [], branches: [], accountManagers: [] });
  const [files, setFiles] = useState([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([]);
  const [loading, setLoading] = useState(Boolean(agreementId));
  const [saving, setSaving] = useState(false);
  const isIndefinite = Form.useWatch("isIndefinite", form);
  const promissoryState = Form.useWatch("promissoryState", form);
  const isPromissoryNoteIndefinite = Form.useWatch("isPromissoryNoteIndefinite", form);

  useEffect(() => {
    let active = true;
    Promise.all([getAgreementCatalogs(), agreementId ? getAgreement(agreementId) : Promise.resolve(null)]).then(([catalogResult, agreementResult]) => {
      if (!active) return;
      if (catalogResult.success) setCatalogs(catalogResult.data || {});
      if (agreementResult?.success) {
        const agreement = agreementResult.data;
        form.setFieldsValue({
          ...agreement,
          startDate: agreement.startDate ? dayjs(agreement.startDate) : null,
          endDate: agreement.endDate ? dayjs(agreement.endDate) : null,
          promissoryNoteExpirationDate: agreement.promissoryNoteExpirationDate
            ? dayjs(agreement.promissoryNoteExpirationDate)
            : null,
          promissoryState: !agreement.hasPromissoryNote
            ? "no"
            : agreement.isPromissoryNoteExpired ? "expired" : "yes",
        });
        setFiles((agreement.attachments || []).map((attachment) => ({
          uid: `existing-${attachment.id}`,
          name: attachment.fileName,
          status: "done",
          attachmentId: attachment.id,
          isExisting: true,
        })));
      } else if (agreementResult && !agreementResult.success) {
        message.error(agreementResult.message);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [agreementId, form]);

  async function uploadAttachments() {
    const attachments = [];
    const failures = [];
    for (const entry of files.filter((file) => file.originFileObj)) {
      const file = entry.originFileObj;
      const uploadResult = await uploadFileToS3({
        fileBase64: await fileToBase64(file),
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        metadata: {
          module: "DocumentacionLegal",
          domain: "agreements",
          ...(agreementId ? { agreementId: String(agreementId) } : {}),
        },
      });
      if (!uploadResult.success) {
        failures.push(file.name);
        continue;
      }
      const s3Key = uploadResult.data?.s3Key;
      if (!s3Key) {
        failures.push(file.name);
        continue;
      }
      const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
      attachments.push({
        s3Key,
        fileName: file.name,
        extension,
      });
    }
    return { attachments, failures };
  }

  async function submit(values) {
    setSaving(true);
    const hasPromissoryNote = values.promissoryState !== "no";
    if (hasPromissoryNote && files.length === 0) {
      message.error("Afirmo que el cliente tiene pagare, porfavor agregar el archivo.");
      setSaving(false);
      return;
    }
    let uploadBatch;
    try {
      uploadBatch = await uploadAttachments();
    } catch {
      message.error("No fue posible leer o cargar los archivos del convenio.");
      setSaving(false);
      return;
    }
    const { attachments, failures } = uploadBatch;
    if (failures.length) {
      message.error(`No se cargaron: ${failures.join(", ")}`);
      setSaving(false);
      return;
    }
    const payload = {
      ...values,
      startDate: values.startDate?.format("YYYY-MM-DD"),
      endDate: values.endDate?.format("YYYY-MM-DD"),
      hasPromissoryNote,
      isPromissoryNoteExpired: values.promissoryState === "expired",
      promissoryNoteExpirationDate: values.promissoryNoteExpirationDate?.format("YYYY-MM-DD"),
      removedAttachmentIds,
      attachments,
    };
    delete payload.promissoryState;
    const result = agreementId
      ? await updateAgreement(agreementId, payload)
      : await createAgreement(payload);
    if (!result.success) {
      message.error(result.message);
      setSaving(false);
      return;
    }
    const savedId = result.data?.id || agreementId;
    message.success(agreementId ? "Convenio actualizado correctamente." : "Convenio creado correctamente.");
    history.replace(`${ROUTES.agreementDetail}?CodConvenio=${savedId}`);
  }

  const options = (items) => (items || []).map((item) => ({ value: item.id, label: item.name }));

  return (
    <div className="legacy-form-page">
      <h1>{agreementId ? "Editar Convenio" : "Nuevo Convenio"}</h1>
      <Form
        form={form}
        layout="vertical"
        className="legacy-business-form"
        initialValues={{ creditDays: 0, creditLimit: 0, promissoryState: "no", branchIds: [], isDollar: false, isIndefinite: false, isPromissoryNoteIndefinite: false }}
        onFinish={submit}
        disabled={loading}
      >
        <div className="legacy-business-grid">
          <Form.Item label="Nombre del Cliente" name="clientId" rules={[{ required: true, message: "Seleccione un cliente." }]}>
            <Select showSearch optionFilterProp="label" placeholder="Seleccione un Cliente..." options={options(catalogs.clients)} />
          </Form.Item>
          <Form.Item label="Días de Crédito" name="creditDays" rules={[{ required: true }]}><InputNumber min={0} max={3650} className="full-width" /></Form.Item>
          <Form.Item label="Fecha Inicial" name="startDate" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item>
          <Form.Item label="¿Tiene Pagaré?" name="promissoryState">
            <Radio.Group options={[{ label: "Sí", value: "yes" }, { label: "No", value: "no" }, { label: "Vencido", value: "expired" }]} />
          </Form.Item>
          <Form.Item label="Sucursales que Facturan" name="branchIds" rules={[{ required: true, message: "Seleccione al menos 1 sucursal que facture." }]}>
            <Select mode="multiple" showSearch optionFilterProp="label" placeholder="Seleccione las Sucursales..." options={options(catalogs.branches)} />
          </Form.Item>
          <Form.Item label="Gestor de Cuenta" name="accountManagerCode" rules={[{ required: true, message: "Seleccione al Gestor de la cuenta." }]}>
            <Select showSearch allowClear optionFilterProp="label" placeholder="Seleccione al gestor..." options={options(catalogs.accountManagers)} />
          </Form.Item>
          <Form.Item label="Límite de Crédito" required>
            <div className="legacy-inline-control">
              <Form.Item name="creditLimit" noStyle rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item>
              <Form.Item name="isDollar" valuePropName="checked" noStyle><Checkbox>En Dólares</Checkbox></Form.Item>
            </div>
          </Form.Item>
          <Form.Item label="Fecha Final" required={!isIndefinite}>
            <div className="legacy-inline-control">
              <Form.Item name="endDate" noStyle rules={isIndefinite ? [] : [{ required: true, message: "Seleccione la fecha final." }]}><DatePicker disabled={isIndefinite} className="full-width" /></Form.Item>
              <Form.Item name="isIndefinite" valuePropName="checked" noStyle><Checkbox>Indefinido</Checkbox></Form.Item>
            </div>
          </Form.Item>
          {promissoryState !== "no" ? (
            <Form.Item label="Fecha Vencimiento Pagaré" required={!isPromissoryNoteIndefinite}>
              <div className="legacy-inline-control">
                <Form.Item name="promissoryNoteExpirationDate" noStyle rules={isPromissoryNoteIndefinite ? [] : [{ required: true }]}><DatePicker disabled={isPromissoryNoteIndefinite} className="full-width" /></Form.Item>
                <Form.Item name="isPromissoryNoteIndefinite" valuePropName="checked" noStyle><Checkbox>Indefinido</Checkbox></Form.Item>
              </div>
            </Form.Item>
          ) : <div />}
        </div>
        <Form.Item label="Observación" name="observation"><Input.TextArea rows={4} /></Form.Item>
        <Upload.Dragger
          multiple
          fileList={files}
          beforeUpload={() => false}
          onChange={({ fileList }) => setFiles(fileList)}
          onRemove={(file) => {
            if (file.isExisting && file.attachmentId) {
              setRemovedAttachmentIds((current) => [...new Set([...current, file.attachmentId])]);
            }
            return true;
          }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>Arrastre los archivos aquí.</p>
          <p className="ant-upload-hint">Buscar para subir.</p>
        </Upload.Dragger>
        <div className="legacy-form-actions">
          <Button danger onClick={() => history.push(ROUTES.agreements)}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>{agreementId ? "Actualizar convenio" : "Crear convenio"}</Button>
        </div>
      </Form>
    </div>
  );
}
