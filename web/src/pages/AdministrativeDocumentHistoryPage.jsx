import { ExportOutlined, FileExcelOutlined, FileImageOutlined } from "@ant-design/icons";
import { Button, Form, Input, message, Select, Space, Table, Tag } from "antd";
import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  DocumentAttachmentDrawer,
  previewFromAttachment,
} from "../components/DocumentAttachmentDrawer.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { downloadDocumentXlsx, documentExportTimestamp } from "../services/documentExportService.js";
import {
  getAdministrativeDocuments,
  getDocumentAttachment,
  getDocumentCatalogs,
} from "../services/documentService.js";
import { ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS } from "./documentExportMappings.js";

const PAGE_SIZE = 50;

function documentColumns(openDetail, openAttachment) {
  return [
  { title: "Sucursal", dataIndex: "branchName", key: "branchName", fixed: "left", width: 190, sorter: true },
  { title: "Referencia", dataIndex: "reference", key: "reference", width: 140, sorter: true },
  { title: "Descripción", dataIndex: "description", key: "description", width: 260, ellipsis: true, sorter: true },
  { title: "Proveedor", dataIndex: "providerName", key: "providerName", width: 180, ellipsis: true, sorter: true },
  { title: "Categoría", dataIndex: "categoryName", key: "categoryName", width: 180, sorter: true },
  { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName", width: 220, sorter: true },
  { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate", width: 150, sorter: true, render: (value, row) => row.isReferential ? "N/A" : value },
  { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate", width: 160, sorter: true, render: (value, row) => row.isReferential ? "N/A" : value },
  { title: "Nivel Documento", dataIndex: "levelName", key: "levelName", width: 150, sorter: true },
  { title: "Nivel Documento", key: "referential", width: 150, render: (_, row) => row.isReferential ? <Tag>Referencial</Tag> : null },
  { title: "Estado", dataIndex: "statusName", key: "statusName", width: 130, sorter: true, render: (value) => <Tag color={value === "Vigente" ? "green" : value === "Por Vencer" ? "orange" : value === "Vencido" ? "red" : "default"}>{value || ""}</Tag> },
  {
    title: "",
    key: "actions",
    fixed: "right",
    width: 84,
    render: (_, record) => (
      <Space size={4}>
        <Button
          type="text"
          size="small"
          icon={<ExportOutlined />}
          aria-label="Ver documento"
          title="Ver documento"
          onClick={() => openDetail(record)}
        />
        {record.attachmentId ? (
          <Button
            type="text"
            size="small"
            icon={<FileImageOutlined />}
            aria-label="Ver Archivo"
            title="Ver Archivo"
            onClick={() => openAttachment(record)}
          />
        ) : null}
      </Space>
    ),
  },
  ];
}

function requestFilters(values, sorting = {}) {
  return {
    branchId: values.branchId,
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId,
    statusId: values.statusId,
    search: values.search,
    sortBy: sorting.sortBy,
    sortDirection: sorting.sortDirection,
  };
}

export function AdministrativeDocumentHistoryPage() {
  const history = useHistory();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: PAGE_SIZE, total: 0 });
  const [catalogs, setCatalogs] = useState({ branches: [], categories: [], subcategories: [], statuses: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const requestSequence = useRef(0);
  const sorting = useRef({});

  function openDetail(record) {
    history.push(`${ROUTES.documentDetail}?CodDocumento=${record.id}`);
  }

  async function openAttachment(record) {
    const result = await getDocumentAttachment(record.id);
    if (!result.success) {
      message.error(result.message);
      return;
    }
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return previewFromAttachment(record, result.data);
    });
  }

  function closePreview() {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function loadDocuments(values = {}, page = 1, pageSize = PAGE_SIZE) {
    const sequence = ++requestSequence.current;
    setLoading(true);
    const result = await getAdministrativeDocuments({ ...requestFilters(values, sorting.current), page, pageSize });
    if (sequence !== requestSequence.current) return;
    if (result.success) {
      const items = result.data?.items || result.data || [];
      setRows(items);
      setPagination({
        current: result.data?.page || page,
        pageSize: result.data?.pageSize || pageSize,
        total: result.data?.total ?? items.length,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    getDocumentCatalogs("administrative").then((catalogResult) => {
      if (active && catalogResult.success) setCatalogs((current) => ({ ...current, ...catalogResult.data }));
    });
    loadDocuments({}, 1, PAGE_SIZE);
    return () => {
      active = false;
      requestSequence.current += 1;
    };
  }, []);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  const options = (items) => (items || []).map((item) => ({ value: item.id, label: item.name }));

  async function handleExport() {
    setExporting(true);
    try {
      const values = form.getFieldsValue();
      const result = await downloadDocumentXlsx({
        filters: {
          branchId: values.branchId,
          categoryId: values.categoryId,
          subcategoryId: values.subcategoryId,
          statusId: values.statusId,
          search: values.search,
          documentType: "administrative",
        },
        columns: ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS,
        fileName: `CasosAseguradora_${documentExportTimestamp()}.xlsx`,
        sheetName: "Sheet1",
      });
      if (!result.success) message.error(result.message);
    } catch {
      message.error("No fue posible generar el archivo de Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="legacy-history-page">
      <div className="legacy-history-new-row">
        <button type="button" onClick={() => history.push(ROUTES.documentCreate)}>+ Nuevo Documento</button>
        <Button type="text" icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>Descargar Excel</Button>
      </div>

      <h1>Histórico Documentos Administrativo</h1>

      <Form form={form} layout="vertical" className="legacy-history-filters is-five-columns" onValuesChange={(_, values) => loadDocuments(values)}>
        <Form.Item label="Sucursal" name="branchId"><Select allowClear showSearch placeholder="Seleccione Sucursal" options={options(catalogs.branches)} /></Form.Item>
        <Form.Item label="Categoría Documento" name="categoryId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.categories)} /></Form.Item>
        <Form.Item label="Subcategoría Documento" name="subcategoryId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.subcategories)} /></Form.Item>
        <Form.Item label="Estado" name="statusId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.statuses)} /></Form.Item>
        <Form.Item label="Descripción / Referencia" name="search"><Input allowClear /></Form.Item>
      </Form>

      <Table
        className="legacy-history-table"
        rowKey={(record) => record.id}
        columns={documentColumns(openDetail, openAttachment)}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1900 }}
        locale={{ emptyText: "No hay registros..." }}
        pagination={{ ...pagination, showSizeChanger: false }}
        onChange={(nextPagination, _, sorter) => {
          sorting.current = { sortBy: sorter.field, sortDirection: sorter.order };
          loadDocuments(form.getFieldsValue(), nextPagination.current, nextPagination.pageSize);
        }}
      />
      <DocumentAttachmentDrawer preview={preview} onClose={closePreview} />
    </div>
  );
}
