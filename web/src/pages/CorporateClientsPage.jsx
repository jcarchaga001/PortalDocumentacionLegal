import { ContactsOutlined, EditOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Checkbox, Drawer, Form, Input, List, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import { getCorporateClient, getCorporateClients } from "../services/corporateClientService.js";

export function CorporateClientsPage() {
  const history = useHistory();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [contactClient, setContactClient] = useState(null);

  async function load(values = {}, page = 1, pageSize = pagination.pageSize) {
    setLoading(true);
    const result = await getCorporateClients({ ...values, page, pageSize });
    if (result.success) {
      setRows(result.data?.items || []);
      setPagination({ current: result.data?.page || page, pageSize: result.data?.pageSize || pageSize, total: result.data?.total || 0 });
    } else message.error(result.message);
    setLoading(false);
  }

  useEffect(() => { load({}, 1, 20); }, []);

  async function showContacts(clientId) {
    const result = await getCorporateClient(clientId);
    if (result.success) setContactClient(result.data);
    else message.error(result.message);
  }

  const columns = [
    { title: "Codigo FA", dataIndex: "faCode", key: "faCode", width: 130 },
    { title: "Nombre Cliente", dataIndex: "name", key: "name", width: 260 },
    { title: "Nombre Contacto", dataIndex: "contactName", key: "contactName", width: 190 },
    { title: "Puesto Contacto", dataIndex: "contactPosition", key: "contactPosition", width: 220 },
    { title: "Teléfono Contacto", dataIndex: "contactPhone", key: "contactPhone", width: 160 },
    { title: "Correo Contacto", dataIndex: "contactEmail", key: "contactEmail", width: 230 },
    { title: "Cliente Activo", dataIndex: "isActive", key: "isActive", width: 120, render: (value) => <Tag color={value ? "green" : "default"}>{value ? "Sí" : "No"}</Tag> },
    {
      title: "",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} aria-label="Editar cliente" onClick={() => history.push(`${ROUTES.corporateClientCreate}?CodCliente=${record.id}`)} />
          <Button type="link" icon={<ContactsOutlined />} onClick={() => showContacts(record.id)}>Contactos</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="legacy-list-page">
      <div className="legacy-list-toolbar">
        <Button type="link" icon={<UploadOutlined />} onClick={() => history.push(ROUTES.corporateClientBulk)}>Carga de Clientes</Button>
        <Button type="link" icon={<PlusOutlined />} onClick={() => history.push(ROUTES.corporateClientCreate)}>Crear Cliente</Button>
      </div>
      <h1>Clientes Corporativos</h1>
      <Form form={form} layout="inline" className="legacy-inline-filters" onValuesChange={(_, values) => load(values, 1, pagination.pageSize)}>
        <Form.Item label="Búsqueda" name="search"><Input allowClear /></Form.Item>
        <Form.Item name="activeOnly" valuePropName="checked"><Checkbox>Solo activos</Checkbox></Form.Item>
      </Form>
      <Table
        className="legacy-history-table"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1600 }}
        pagination={{ ...pagination, showSizeChanger: false }}
        onChange={(next) => load(form.getFieldsValue(), next.current, next.pageSize)}
      />
      <Drawer title={contactClient?.name || "Contactos"} open={Boolean(contactClient)} onClose={() => setContactClient(null)} width={560}>
        <List
          dataSource={contactClient?.contacts || []}
          locale={{ emptyText: "No hay contactos adicionales." }}
          renderItem={(contact) => <List.Item><List.Item.Meta title={contact.name} description={[contact.position, contact.phone, contact.email].filter(Boolean).join(" · ")} /></List.Item>}
        />
      </Drawer>
    </div>
  );
}
