import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Form, Input, Modal, Select, Space, Table, message } from "antd";
import { useState } from "react";
import { useCatalogList, useCatalogLookups } from "../hooks/useCatalogList.js";
import { createProvider, getProviders, updateProvider } from "../services/catalogService.js";
import { LegacyBoolean, isTrue, options } from "./CatalogUi.jsx";

const loadProviders = (query) => getProviders(query);

function providerFormValues(provider) {
  if (!provider) {
    return {
      commercialName: "",
      legalName: "",
      taxNumber: "",
      active: false,
      withholdingOne: false,
      withholdingTwelve: false,
      internal: false,
      destinationId: undefined,
    };
  }
  return {
    commercialName: provider.commercialName || "",
    legalName: provider.legalName || "",
    taxNumber: provider.taxNumber || "",
    active: isTrue(provider.active),
    withholdingOne: isTrue(provider.withholdingOne),
    withholdingTwelve: isTrue(provider.withholdingTwelve),
    internal: isTrue(provider.internal),
    destinationId: provider.destinationId ? Number(provider.destinationId) : undefined,
  };
}

export function ProviderCatalogPage() {
  const listing = useCatalogList(loadProviders, { onlyExternal: true, onlyActive: true });
  const { lookups, error: lookupError } = useCatalogLookups();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function openModal(provider = null) {
    setEditing(provider);
    form.setFieldsValue(providerFormValues(provider));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function saveProvider(values) {
    setSaving(true);
    const payload = {
      ...values,
      legalName: values.legalName || null,
      destinationId: values.internal ? values.destinationId : null,
      active: Boolean(values.active),
      withholdingOne: Boolean(values.withholdingOne),
      withholdingTwelve: Boolean(values.withholdingTwelve),
      internal: Boolean(values.internal),
    };
    const result = editing
      ? await updateProvider(editing.id, payload)
      : await createProvider(payload);
    if (result.success) {
      message.success(result.message);
      closeModal();
      listing.reload();
    } else {
      message.error(result.message);
      if (result.error?.field) {
        form.setFields([{ name: result.error.field, errors: [result.message] }]);
      }
    }
    setSaving(false);
  }

  const columns = [
    { title: "Nombre Comercial", dataIndex: "commercialName", key: "commercialName", width: 280, sorter: true },
    { title: "Nombre Legal", dataIndex: "legalName", key: "legalName", width: 280, sorter: true },
    { title: "Número Fiscal", dataIndex: "taxNumber", key: "taxNumber", width: 180, sorter: true },
    { title: "Tipo", dataIndex: "internal", key: "type", width: 120, sorter: true, render: (value) => isTrue(value) ? "Interno" : "Externo" },
    { title: "Activo", dataIndex: "active", key: "active", width: 95, align: "center", sorter: true, render: (value) => <LegacyBoolean value={value} /> },
    { title: "Ret. 1%", dataIndex: "withholdingOne", key: "withholdingOne", width: 95, align: "center", render: (value) => <LegacyBoolean value={value} /> },
    { title: "Ret. 12.5%", dataIndex: "withholdingTwelve", key: "withholdingTwelve", width: 115, align: "center", render: (value) => <LegacyBoolean value={value} /> },
    {
      title: "",
      key: "actions",
      width: 175,
      fixed: "right",
      render: (_, row) => (
        <Space size={4}>
          <Button type="link" className="legacy-catalog-row-link" onClick={() => openModal(row)}>Destinos</Button>
          <Button type="text" icon={<EditOutlined />} aria-label={`Editar ${row.commercialName}`} onClick={() => openModal(row)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="legacy-catalog-page">
      <div className="legacy-catalog-toolbar">
        <Button type="link" icon={<PlusOutlined />} onClick={() => openModal()}>Nuevo Proveedor</Button>
      </div>
      <h1>Catálogo de Proveedores</h1>
      <Form
        layout="vertical"
        className="legacy-catalog-filters is-four"
        initialValues={{ onlyExternal: true, onlyActive: true }}
        onValuesChange={(_, values) => listing.setFilters(values)}
      >
        <Form.Item label="Nombre" name="name"><Input allowClear /></Form.Item>
        <Form.Item label="Número Fiscal" name="taxNumber"><Input allowClear /></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyExternal" valuePropName="checked"><Checkbox>Solo Externos</Checkbox></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyActive" valuePropName="checked"><Checkbox>Solo Activas</Checkbox></Form.Item>
      </Form>
      {(listing.error || lookupError) && <Alert type="error" showIcon message={listing.error || lookupError} />}
      <Table
        className="legacy-history-table legacy-catalog-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: "No hay registros..." }}
        pagination={listing.pagination}
        onChange={listing.changeTable}
        scroll={{ x: 1450 }}
      />

      <Modal
        title={editing ? "Editar Proveedor" : "Nuevo Proveedor"}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        width={620}
      >
        <Form form={form} layout="vertical" className="legacy-catalog-modal-form" onFinish={saveProvider}>
          <Form.Item label="Nombre de Proveedor" name="commercialName" rules={[{ required: true, message: "Complete el nombre del proveedor." }]}>
            <Input maxLength={512} />
          </Form.Item>
          <Form.Item label="Nombre Legal" name="legalName"><Input maxLength={512} /></Form.Item>
          <Form.Item label="Número Fiscal" name="taxNumber" rules={[{ required: true, message: "Complete el número fiscal." }]}>
            <Input maxLength={64} />
          </Form.Item>
          <div className="legacy-catalog-checkbox-grid">
            <Form.Item name="active" valuePropName="checked"><Checkbox>Activo</Checkbox></Form.Item>
            <Form.Item name="withholdingOne" valuePropName="checked"><Checkbox>Retencion 1%</Checkbox></Form.Item>
            <Form.Item name="withholdingTwelve" valuePropName="checked"><Checkbox>Retencion 12.5%</Checkbox></Form.Item>
            <Form.Item name="internal" valuePropName="checked"><Checkbox>Proveedor Interno</Checkbox></Form.Item>
          </div>
          <Form.Item noStyle shouldUpdate={(before, after) => before.internal !== after.internal}>
            {({ getFieldValue }) => getFieldValue("internal") ? (
              <Form.Item label="Destino" name="destinationId">
                <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione Destino" options={options(lookups.branches)} />
              </Form.Item>
            ) : null}
          </Form.Item>
          <div className="legacy-catalog-modal-actions">
            <Button onClick={closeModal}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Guardar</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
