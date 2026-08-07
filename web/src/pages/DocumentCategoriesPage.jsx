import { Alert, Checkbox, Form, Input, Select, Table, message } from "antd";
import { useState } from "react";
import { useCatalogList, useCatalogLookups } from "../hooks/useCatalogList.js";
import { getDocumentCategories, updateDocumentCategoryAccess } from "../services/catalogService.js";
import { LegacyAccessButton, LegacyBoolean, isTrue, options } from "./CatalogUi.jsx";

const loadDocumentCategories = (query) => getDocumentCategories(query);

export function DocumentCategoriesPage() {
  const listing = useCatalogList(loadDocumentCategories, {
    onlyRequired: false,
    onlyDocuments: false,
    onlyActive: false,
  });
  const { lookups, error: lookupError } = useCatalogLookups();
  const [savingId, setSavingId] = useState(null);

  async function toggleAccess(row) {
    setSavingId(row.id);
    const result = await updateDocumentCategoryAccess(row.id, !isTrue(row.accessAllowed));
    if (result.success) {
      message.success(result.message);
      listing.reload();
    } else {
      message.error(result.message);
    }
    setSavingId(null);
  }

  const columns = [
    { title: "Categoría", dataIndex: "categoryName", key: "category", width: 270, sorter: true },
    { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategory", width: 330, sorter: true },
    { title: "Obligatorio", dataIndex: "required", key: "required", width: 150, align: "center", sorter: true, render: (value) => <LegacyBoolean value={value} /> },
    { title: "Es Documento", dataIndex: "branchDocument", key: "document", width: 170, align: "center", sorter: true, render: (value) => <LegacyBoolean value={value} /> },
    {
      title: "Acceso Permitido",
      dataIndex: "accessAllowed",
      key: "active",
      width: 180,
      align: "center",
      sorter: true,
      render: (value, row) => (
        <LegacyAccessButton
          value={value}
          loading={savingId === row.id}
          label={`Acceso de ${row.subcategoryName}`}
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
        className="legacy-catalog-filters is-five"
        initialValues={{ onlyRequired: false, onlyDocuments: false, onlyActive: false }}
        onValuesChange={(_, values) => listing.setFilters(values)}
      >
        <Form.Item label="Categoría:" name="categoryId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione Categoría" options={options(lookups.categories)} />
        </Form.Item>
        <Form.Item label="Buscar:" name="search"><Input allowClear /></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyRequired" valuePropName="checked"><Checkbox>Solo Obligatorios</Checkbox></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyDocuments" valuePropName="checked"><Checkbox>Solo Documentos</Checkbox></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyActive" valuePropName="checked"><Checkbox>Solo Activos</Checkbox></Form.Item>
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
        scroll={{ x: 1100 }}
      />
    </div>
  );
}
