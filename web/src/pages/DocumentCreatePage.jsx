import { LeftCircleOutlined } from "@ant-design/icons";
import { Button, Checkbox, DatePicker, Form, Input, Radio, Select, Upload, message } from "antd";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import { createDocument, getDocumentCatalogs } from "../services/documentService.js";
import { fileToBase64 } from "../services/fileHelpers.js";

export function DocumentCreatePage() {
  const history = useHistory();
  const [form] = Form.useForm();
  const [documentType, setDocumentType] = useState();
  const [catalogs, setCatalogs] = useState({ branches: [], administrativeBranches: [], providers: [], categories: [], subcategories: [] });
  const [saving, setSaving] = useState(false);
  const selectedCategoryId = Form.useWatch("categoryId", form);
  const isReferential = Form.useWatch("isReferential", form);

  useEffect(() => {
    let active = true;
    getDocumentCatalogs(documentType || 1).then((result) => {
      if (active && result.success) setCatalogs((current) => ({ ...current, ...result.data }));
    });
    return () => {
      active = false;
    };
  }, [documentType]);

  const options = (items) => (items || []).map((item) => ({ value: item.id, label: item.name }));
  const subcategoryOptions = options(
    (catalogs.subcategories || []).filter((item) => !selectedCategoryId || Number(item.categoryId) === Number(selectedCategoryId)),
  );

  async function handleSubmit(values) {
    setSaving(true);
    try {
      const file = values.attachment?.[0]?.originFileObj;
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
        <LeftCircleOutlined /> Volver a pantalla anterior
      </button>
      <h1>Registro de Documento</h1>

      <Form
        form={form}
        layout="vertical"
        className="legacy-create-form"
        initialValues={{ level: 1, isReferential: false }}
        onFinish={handleSubmit}
        onValuesChange={(changed) => {
          if (Object.prototype.hasOwnProperty.call(changed, "documentType")) setDocumentType(changed.documentType);
          if (changed.categoryId) form.setFieldValue("subcategoryId", undefined);
          if (changed.isReferential) {
            form.setFieldsValue({ documentDate: undefined, expirationDate: undefined });
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

          <Form.Item
            className="legacy-type-field"
            label="Tipo Documento"
            name="documentType"
            rules={[{ required: true, message: "Seleccione el tipo de documento." }]}
          >
            <Radio.Group className="legacy-type-group">
              <Radio value={1}>Sucursales</Radio>
              <Radio value={2}>Administrativo</Radio>
            </Radio.Group>
          </Form.Item>

          {documentType ? (
            <Form.Item
              className="legacy-branch-field"
              label={documentType === 1 ? "Sucursales" : "Administrativo"}
              name="branchId"
              rules={[{ required: true, message: "Debe seleccionar sucursal." }]}
            >
              <Select
                showSearch
                placeholder="Seleccionar..."
                optionFilterProp="label"
                options={options(documentType === 1 ? catalogs.branches : catalogs.administrativeBranches)}
              />
            </Form.Item>
          ) : null}

          <div className={`legacy-create-grid${!isReferential ? " has-dates" : ""}`}>
            <Form.Item label="Descripción Contrato" name="description" rules={[{ required: true, message: "Ingrese una descripción." }]}> 
              <Input maxLength={20} />
            </Form.Item>
            <Form.Item label="Proveedor" name="providerId">
              <Select allowClear showSearch placeholder="Seleccionar..." optionFilterProp="label" options={options(catalogs.providers)} />
            </Form.Item>
            <Form.Item label="Categoría" name="categoryId" rules={[{ required: true, message: "Seleccione la categoría." }]}>
              <Select showSearch placeholder="Seleccionar..." optionFilterProp="label" options={options(catalogs.categories)} />
            </Form.Item>
            <Form.Item label="Subcategoría" name="subcategoryId" rules={[{ required: true, message: "Seleccione la subcategoría." }]}>
              <Select showSearch placeholder="Seleccionar..." optionFilterProp="label" options={subcategoryOptions} disabled={!selectedCategoryId} />
            </Form.Item>

            {!isReferential ? (
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

          <Form.Item
            className="legacy-create-upload"
            name="attachment"
            valuePropName="fileList"
            getValueFromEvent={(event) => Array.isArray(event) ? event : event?.fileList}
            rules={[{ required: true, message: "Adjunte el archivo." }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.jpg,.jpeg,.png,.bmp">
              <Button>Adjunte Archivo</Button>
            </Upload>
          </Form.Item>
        </div>

        <div className="legacy-create-actions">
          <Button htmlType="button" className="legacy-create-cancel" onClick={() => history.goBack()}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Registrar</Button>
        </div>
      </Form>
    </div>
  );
}
