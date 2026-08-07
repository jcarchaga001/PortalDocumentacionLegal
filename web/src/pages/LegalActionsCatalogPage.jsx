import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Form, Input, Modal, Table, message } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { useCatalogList } from "../hooks/useCatalogList.js";
import { createLegalAction, getLegalActions, updateLegalAction } from "../services/catalogService.js";
import { LegacyBoolean } from "./CatalogUi.jsx";

const loadLegalActions = (query) => getLegalActions(query);

function displayDate(value) {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm") : value || "";
}

export function LegalActionsCatalogPage() {
  const listing = useCatalogList(loadLegalActions);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function openModal(action = null) {
    setEditing(action);
    form.setFieldsValue({ name: action?.name || "", active: action ? Boolean(action.active) : true });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function saveAction(values) {
    setSaving(true);
    const result = editing
      ? await updateLegalAction(editing.id, values)
      : await createLegalAction({ ...values, active: true });
    if (result.success) {
      message.success(result.message);
      closeModal();
      listing.reload();
    } else {
      message.error(result.message);
      if (result.error?.field) form.setFields([{ name: result.error.field, errors: [result.message] }]);
    }
    setSaving(false);
  }

  const columns = [
    { title: "Nombre Acción", dataIndex: "name", key: "name", width: 390, sorter: true },
    { title: "Fecha Creado", dataIndex: "createdAt", key: "createdAt", width: 230, sorter: true, render: displayDate },
    { title: "Usuario Creado", dataIndex: "createdBy", key: "createdBy", width: 300, sorter: true },
    { title: "Activo", dataIndex: "active", key: "active", width: 130, align: "center", sorter: true, render: (value) => <LegacyBoolean value={value} /> },
    {
      title: "",
      key: "actions",
      width: 70,
      align: "center",
      render: (_, row) => <Button type="text" icon={<EditOutlined />} aria-label={`Editar ${row.name}`} onClick={() => openModal(row)} />,
    },
  ];

  return (
    <div className="legacy-catalog-page">
      <div className="legacy-catalog-toolbar">
        <Button type="link" icon={<PlusOutlined />} onClick={() => openModal()}>Acción Legal</Button>
      </div>
      <h1>Catálogo Acciones Legal</h1>
      {listing.error && <Alert type="error" showIcon message={listing.error} />}
      <Table
        className="legacy-history-table legacy-catalog-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: "No hay registros..." }}
        pagination={listing.pagination}
        onChange={listing.changeTable}
        scroll={{ x: 1100 }}
      />

      <Modal title="Editar Incidente" open={modalOpen} onCancel={closeModal} footer={null} destroyOnHidden width={620}>
        <Form form={form} layout="vertical" className="legacy-catalog-modal-form" onFinish={saveAction}>
          <Form.Item label="Nombre Acción" name="name" rules={[{ required: true, message: "Complete el nombre de la acción." }]}>
            <Input maxLength={250} />
          </Form.Item>
          {editing && (
            <Form.Item name="active" valuePropName="checked">
              <Checkbox>Activo</Checkbox>
            </Form.Item>
          )}
          <div className="legacy-catalog-modal-actions">
            <Button type="primary" htmlType="submit" loading={saving}>
              {editing ? "Editar Acción" : "Guardar Acción"}
            </Button>
            <Button onClick={closeModal}>Regresar</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
