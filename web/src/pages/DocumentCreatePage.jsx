import { Button, Checkbox, DatePicker, Form, Input, Modal, Radio, Select, Spin, Upload, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { LEGACY_FEEDBACK_CONTRACTS, showLegacyFeedback } from "../config/legacyFeedbackContracts.js";
import { validateLegacyDocumentFileName } from "../config/legacyFileContracts.js";
import { readLegacyDocumentType, writeLegacyDocumentType } from "../config/legacyDocumentContext.js";
import { ROUTES } from "../routes/routePaths.js";
import {
  createDocument,
  getDocumentCatalogs,
  getDocumentRegistrationSubcategories,
} from "../services/documentService.js";
import { fileToBase64 } from "../services/fileHelpers.js";
import {
  LEGACY_DOCUMENT_REGISTRATION_SURFACE,
  legacyRegistrationBranchLabel,
  legacyRegistrationPreviewKind,
  legacyRegistrationShowsDates,
} from "./documentCreateParity.js";

export function DocumentCreatePage() {
  const history = useHistory();
  const [form] = Form.useForm();
  const [documentType, setDocumentType] = useState(() => readLegacyDocumentType());
  const [catalogs, setCatalogs] = useState({ branches: [], administrativeBranches: [], providers: [], categories: [], subcategories: [] });
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const categoryChangeInitialized = useRef(false);
  const selectedCategoryId = Form.useWatch("categoryId", form);
  const isReferential = Form.useWatch("isReferential", form);
  const attachmentList = Form.useWatch("attachment", form);
  const selectedFile = attachmentList?.[0]?.originFileObj || attachmentList?.[0] || null;

  useEffect(() => {
    let active = true;
    getDocumentCatalogs(1, { surface: LEGACY_DOCUMENT_REGISTRATION_SURFACE }).then((result) => {
      if (active && result.success) setCatalogs((current) => ({ ...current, ...result.data }));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!categoryChangeInitialized.current) {
      categoryChangeInitialized.current = true;
      return undefined;
    }
    let active = true;
    setCatalogs((current) => ({ ...current, subcategories: [] }));
    getDocumentRegistrationSubcategories(selectedCategoryId || 0).then((result) => {
      if (active && result.success) {
        setCatalogs((current) => ({ ...current, subcategories: result.data?.subcategories || [] }));
      }
    });
    return () => { active = false; };
  }, [selectedCategoryId]);

  useEffect(() => {
    if (!selectedFile || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      setPreviewUrl("");
      return undefined;
    }
    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  const options = (items) => (items || []).map((item) => ({ value: item.id, label: item.name }));
  const subcategoryOptions = options(
    (catalogs.subcategories || []).filter((item) => !selectedCategoryId || Number(item.categoryId) === Number(selectedCategoryId)),
  );

  async function handleSubmit(values) {
    setSaving(true);
    try {
      if (!values.branchId) {
        message.info("Debe seleccionar sucursal");
        return;
      }
      const file = values.attachment?.[0]?.originFileObj || values.attachment?.[0];
      const fileValidation = file ? validateLegacyDocumentFileName(file.name) : null;
      if (fileValidation && !fileValidation.valid) {
        showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.unsupportedDocumentFormat, fileValidation.message);
        return;
      }
      const result = await createDocument({
        ...values,
        documentDate: values.documentDate?.format("YYYY-MM-DD"),
        expirationDate: values.expirationDate?.format("YYYY-MM-DD"),
        attachment: file
          ? {
              fileName: file.name,
              contentType: file.type || "application/octet-stream",
              fileBase64: await fileToBase64(file),
            }
          : null,
      });
      if (result.success) {
        message.success("Registro exitoso");
        history.push(ROUTES.documentHistory);
      } else {
        message.error(result.message);
        if (result.error?.field) form.setFields([{ name: result.error.field, errors: [result.message] }]);
      }
    } catch {
      message.error("No se puede leer archivo (Archivo con errores)");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="legacy-create-page">
      <button className="legacy-create-back" type="button" onClick={() => history.goBack()}>
        <i className="fa fa-arrow-circle-left" aria-hidden="true" /> Volver a pantalla anterior
      </button>
      <h1>Registro de Documento</h1>

      <Form
        form={form}
        layout="vertical"
        className="legacy-create-form"
        initialValues={{ isReferential: false, documentType }}
        onFinish={handleSubmit}
        onValuesChange={(changed) => {
          if (Object.prototype.hasOwnProperty.call(changed, "documentType")) {
            setDocumentType(changed.documentType);
            writeLegacyDocumentType(changed.documentType);
          }
          if (Object.prototype.hasOwnProperty.call(changed, "categoryId")) {
            form.setFieldValue("subcategoryId", undefined);
          }
        }}
      >
        <div className="legacy-create-inner">
          <h2>Ingrese Información:</h2>

          <Form.Item className="legacy-level-field" label="Nivel Documento" name="level">
            <Radio.Group className="legacy-level-group">
              <Radio.Button value={1}>Público</Radio.Button>
              <Radio.Button value={2}>Privado</Radio.Button>
              <Radio.Button value={3}>Restringido</Radio.Button>
              <Radio.Button value={4}>Confidencial</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <div className="legacy-create-type-row">
            <Form.Item className="legacy-type-field" label="Tipo Documento" name="documentType">
              <Radio.Group className="legacy-type-group">
                <Radio value={1}>Sucursales</Radio>
                <Radio value={2}>Administrativo</Radio>
              </Radio.Group>
            </Form.Item>

            {documentType ? (
              <Form.Item
                className="legacy-branch-field"
                label={legacyRegistrationBranchLabel(documentType)}
                name="branchId"
              >
                <Select
                  showSearch
                  placeholder="Seleccionar..."
                  optionFilterProp="label"
                  options={options(documentType === 1 ? catalogs.branches : catalogs.administrativeBranches)}
                />
              </Form.Item>
            ) : <div />}
          </div>

          <div className={`legacy-create-grid${!isReferential ? " has-dates" : ""}`}>
            <Form.Item label="Descripción Contrato" name="description" rules={[{ required: true, message: "Ingrese una descripción." }]}> 
              <Input maxLength={20} />
            </Form.Item>
            <Form.Item label="Proveedor" name="providerId">
              <Select allowClear showSearch placeholder="Seleccionar..." optionFilterProp="label" options={options(catalogs.providers)} />
            </Form.Item>
            <Form.Item label="Categoría" name="categoryId">
              <Select showSearch placeholder="Seleccionar..." optionFilterProp="label" options={options(catalogs.categories)} />
            </Form.Item>
            <Form.Item label="Subcategoría" name="subcategoryId">
              <Select showSearch placeholder="Seleccionar..." optionFilterProp="label" options={subcategoryOptions} />
            </Form.Item>

            {legacyRegistrationShowsDates(isReferential) ? (
              <>
                <Form.Item label="Fecha de Documento" name="documentDate" rules={[{ required: true }]}> 
                  <DatePicker className="full-width" placeholder="mm/dd/aaaa" />
                </Form.Item>
                <Form.Item label="Fecha de vencimiento" name="expirationDate" rules={[{ required: true }]}> 
                  <DatePicker className="full-width" placeholder="mm/dd/aaaa" />
                </Form.Item>
              </>
            ) : null}

            <Form.Item className="legacy-reference-check" name="isReferential" valuePropName="checked">
              <Checkbox>Es Referencial</Checkbox>
            </Form.Item>
            <Form.Item label="Referencia 2" name="secondaryReference"><Input maxLength={516} /></Form.Item>
          </div>

          <div className="legacy-create-file-layout">
            <div className="legacy-create-file-controls">
              <Form.Item
                className="legacy-create-upload"
                name="attachment"
                valuePropName="fileList"
                getValueFromEvent={(event) => Array.isArray(event) ? event : event?.fileList}
                rules={[{ required: true, message: "Adjunte el archivo." }]}
              >
                <Upload beforeUpload={() => false} maxCount={1} showUploadList={false}>
                  <div className="legacy-create-upload-box">
                    <i className="fa fa-paperclip" aria-hidden="true" />
                    <span>{selectedFile?.name || "Adjunte Archivo"}</span>
                  </div>
                </Upload>
              </Form.Item>
              {selectedFile ? (
                <button
                  type="button"
                  className="legacy-create-file-delete"
                  aria-label="Eliminar Archivo"
                  title="Eliminar Archivo"
                  onClick={() => {}}
                >
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {selectedFile && previewUrl ? (
              <div className="legacy-create-file-preview">
                {legacyRegistrationPreviewKind(selectedFile.name) === "pdf" ? (
                  <iframe title={selectedFile.name} src={previewUrl} />
                ) : legacyRegistrationPreviewKind(selectedFile.name) === "image" ? (
                  <img src={previewUrl} alt={selectedFile.name} />
                ) : (
                  <div className="legacy-create-file-preview-error">No se puede leer archivo (Archivo con errores)</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="legacy-create-actions">
          <Button htmlType="button" className="legacy-create-cancel" onClick={() => history.goBack()}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Registrar</Button>
        </div>
      </Form>
      <Modal
        className="legacy-create-loading-modal"
        open={saving}
        closable={false}
        footer={null}
        centered
        maskClosable={false}
        keyboard={false}
        width={500}
      >
        <h3><i className="fa fa-exclamation-triangle" aria-hidden="true" /> Favor Espere...</h3>
        <div className="legacy-create-loading-modal-content" role="status" aria-live="polite">
          <Spin size="large" />
          <span>Generando Solicitud...</span>
        </div>
      </Modal>
    </div>
  );
}
