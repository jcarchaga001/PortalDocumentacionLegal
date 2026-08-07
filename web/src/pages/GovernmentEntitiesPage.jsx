import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Modal, Select, Table, message } from "antd";
import { useState } from "react";
import { useCatalogList, useCatalogLookups } from "../hooks/useCatalogList.js";
import {
  createGovernmentEntity,
  deactivateGovernmentEntity,
  getGovernmentEntities,
  updateGovernmentEntity,
} from "../services/catalogService.js";
import { isTrue, options } from "./CatalogUi.jsx";

const loadGovernmentEntities = (query) => getGovernmentEntities(query);
const areaOptions = [
  { value: "legal", label: "Legal" },
  { value: "regulatory", label: "Regulatorio" },
];

function entityFormValues(entity) {
  if (!entity) return { name: "", description: "", area: undefined, responsibleId: undefined };
  return {
    name: entity.name || "",
    description: entity.description || "",
    area: isTrue(entity.legal) ? "legal" : "regulatory",
    responsibleId: entity.responsibleId ? Number(entity.responsibleId) : undefined,
  };
}

export function GovernmentEntitiesPage() {
  const listing = useCatalogList(loadGovernmentEntities);
  const { lookups, error: lookupError } = useCatalogLookups();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function openModal(entity = null) {
    setEditing(entity);
    form.setFieldsValue(entityFormValues(entity));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function saveEntity(values) {
    setSaving(true);
    const result = editing
      ? await updateGovernmentEntity(editing.id, values)
      : await createGovernmentEntity(values);
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

  function confirmDeactivate(entity) {
    Modal.confirm({
      title: "Eliminar ente gubernamental",
      content: `¿Desea eliminar ${entity.name}?`,
      okText: "Eliminar",
      cancelText: "Cancelar",
      okButtonProps: { danger: true },
      async onOk() {
        const result = await deactivateGovernmentEntity(entity.id);
        if (result.success) {
          message.success(result.message);
          listing.reload();
        } else {
          message.error(result.message);
          throw new Error(result.message);
        }
      },
    });
  }

  const columns = [
    { title: "Ente Gubernamental", dataIndex: "name", key: "name", width: 280, sorter: true },
    { title: "Descripción", dataIndex: "description", key: "description", width: 430, sorter: true },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsible", width: 280, sorter: true },
    {
      title: "Aréa Encargada",
      key: "area",
      width: 190,
      sorter: true,
      render: (_, row) => isTrue(row.legal) ? "Legal" : isTrue(row.regulatory) ? "Regulatorio" : "",
    },
    {
      title: "",
      key: "actions",
      width: 70,
      align: "center",
      render: (_, row) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          aria-label={`Eliminar ${row.name}`}
          onClick={(event) => { event.stopPropagation(); confirmDeactivate(row); }}
        />
      ),
    },
  ];

  return (
    <div className="legacy-catalog-page">
      <div className="legacy-catalog-toolbar">
        <Button type="link" icon={<PlusOutlined />} onClick={() => openModal()}>Nuevo Ente</Button>
      </div>
      <h1>Catálogo Entes Gubernamentales</h1>
      <Form layout="vertical" className="legacy-catalog-filters is-three" onValuesChange={(_, values) => listing.setFilters(values)}>
        <Form.Item label="Ente Gubernamental:" name="entityId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione Ente" options={options(lookups.entities)} />
        </Form.Item>
        <Form.Item label="Responsable:" name="responsibleId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione Responsable" options={options(lookups.responsibles)} />
        </Form.Item>
        <Form.Item label="Aréa Encargada:" name="area">
          <Select allowClear placeholder="Seleccione Área" options={areaOptions} />
        </Form.Item>
      </Form>
      {(listing.error || lookupError) && <Alert type="error" showIcon message={listing.error || lookupError} />}
      <Table
        className="legacy-history-table legacy-catalog-table legacy-catalog-clickable"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: "No hay registros..." }}
        pagination={listing.pagination}
        onChange={listing.changeTable}
        onRow={(row) => ({ onClick: () => openModal(row) })}
        scroll={{ x: 1250 }}
      />

      <Modal
        title={editing ? "Editar Ente" : "Nuevo Ente"}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        width={620}
      >
        <Form form={form} layout="vertical" className="legacy-catalog-modal-form" onFinish={saveEntity}>
          <Form.Item label="Ente Gubernamental" name="name" rules={[{ required: true, message: "Complete el ente gubernamental." }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="Descripción" name="description"><Input.TextArea rows={3} maxLength={2000} /></Form.Item>
          <Form.Item label="Aréa Encargada" name="area" rules={[{ required: true, message: "Seleccione el área encargada." }]}>
            <Select placeholder="Seleccione Área" options={areaOptions} />
          </Form.Item>
          <Form.Item label="Responsables" name="responsibleId" rules={[{ required: true, message: "Seleccione un responsable." }]}>
            <Select showSearch optionFilterProp="label" placeholder="Seleccione Responsable" options={options(lookups.responsibles)} />
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
