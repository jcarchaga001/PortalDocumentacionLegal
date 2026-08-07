import { Alert, Checkbox, Form, Input, Select, Table, message } from "antd";
import { useState } from "react";
import { useCatalogList, useCatalogLookups } from "../hooks/useCatalogList.js";
import { getPermissionUsers, updatePermissionUser } from "../services/catalogService.js";
import { LegacyAccessButton, isTrue, options } from "./CatalogUi.jsx";

const loadPermissionUsers = (query) => getPermissionUsers(query);

export function UserPermissionsPage() {
  const listing = useCatalogList(loadPermissionUsers, { onlyAllowed: false });
  const { lookups, error: lookupError } = useCatalogLookups();
  const [savingId, setSavingId] = useState(null);

  async function toggleAccess(row) {
    setSavingId(row.id);
    const result = await updatePermissionUser(row.id, !isTrue(row.accessAllowed));
    if (result.success) {
      message.success(result.message);
      listing.reload();
    } else {
      message.error(result.message);
    }
    setSavingId(null);
  }

  const columns = [
    { title: "Codigo SAF", dataIndex: "id", key: "id", width: 130, sorter: true },
    { title: "Nombre Persona", dataIndex: "name", key: "name", width: 310, sorter: true },
    { title: "Puesto", dataIndex: "positionName", key: "position", width: 260, sorter: true },
    { title: "Correo", dataIndex: "email", key: "email", width: 300, sorter: true },
    {
      title: "Acceso Permitido",
      dataIndex: "accessAllowed",
      key: "accessAllowed",
      width: 170,
      align: "center",
      render: (value, row) => (
        <LegacyAccessButton
          value={value}
          loading={savingId === row.id}
          label={`Acceso de ${row.name}`}
          onClick={() => toggleAccess(row)}
        />
      ),
    },
  ];

  return (
    <div className="legacy-catalog-page">
      <h1>Permisos Casos Laborales</h1>
      <Form
        layout="vertical"
        className="legacy-catalog-filters is-four"
        initialValues={{ onlyAllowed: false }}
        onValuesChange={(_, values) => listing.setFilters(values)}
      >
        <Form.Item label="Sucursal / Area:" name="branchId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione Sucursal" options={options(lookups.branches)} />
        </Form.Item>
        <Form.Item label="Puesto" name="positionId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione Puesto" options={options(lookups.positions)} />
        </Form.Item>
        <Form.Item label="Buscar:" name="search"><Input allowClear /></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyAllowed" valuePropName="checked">
          <Checkbox>Solo Acceso Permitido</Checkbox>
        </Form.Item>
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
        scroll={{ x: 1170 }}
      />
    </div>
  );
}
