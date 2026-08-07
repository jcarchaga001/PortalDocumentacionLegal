import { FileExcelOutlined, FileImageOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Form, Input, message, Select, Space, Table, Tag } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  DocumentAttachmentDrawer,
  previewFromAttachment,
} from "../components/DocumentAttachmentDrawer.jsx";
import { LegacyDateRangePicker } from "../components/LegacyDateRangePicker.jsx";
import { downloadDocumentXlsx, documentExportTimestamp } from "../services/documentExportService.js";
import {
  getDocumentAttachment,
  getDocumentCatalogs,
  getExpiringDocuments,
  sendDocumentExpirationEmail,
} from "../services/documentService.js";

const PAGE_SIZE = 50;

function localTodayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function documentColumns(openAttachment, sendEmail, sendingDocumentId) {
  return [
  { title: "Sucursal", dataIndex: "branchName", key: "branchName", fixed: "left", width: 190, sorter: true },
  { title: "Referencia", dataIndex: "reference", key: "reference", width: 140, sorter: true },
  { title: "Descripción", dataIndex: "description", key: "description", width: 260, ellipsis: true, sorter: true },
  { title: "Proveedor", dataIndex: "providerName", key: "providerName", width: 180, ellipsis: true, sorter: true },
  { title: "Categoría", dataIndex: "categoryName", key: "categoryName", width: 180, sorter: true },
  { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName", width: 220, sorter: true },
  { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate", width: 150, sorter: true },
  { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate", width: 160, sorter: true },
  { title: "Tiempo Vencimiento", dataIndex: "expirationTime", key: "expirationTime", width: 170 },
  { title: "Registró Documento", dataIndex: "createdByName", key: "createdByName", width: 190, sorter: true },
  { title: "Nivel Documento", dataIndex: "levelName", key: "levelName", width: 150, sorter: true },
  { title: "Estado", dataIndex: "statusName", key: "statusName", width: 130, sorter: true, render: (value) => <Tag color="orange">{value || ""}</Tag> },
  {
    title: "",
    key: "actions",
    fixed: "right",
    width: 84,
    render: (_, record) => (
      <Space size={4}>
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
        <Button
          type="text"
          size="small"
          icon={<MailOutlined />}
          aria-label="Enviar Correo"
          title="Enviar Correo"
          loading={sendingDocumentId === record.id}
          onClick={() => sendEmail(record)}
        />
      </Space>
    ),
  },
  ];
}

// Orden exacto de ExportarXLSCasos (RecordListToExcel1) en el OML.
const exportColumns = [
  { title: "nivelDocumento", key: "nivelDocumento", value: (row) => row.levelName },
  { title: "usuarioCreacion", key: "usuarioCreacion", value: (row) => row.createdByName },
  { title: "codInternoSucursal", key: "codInternoSucursal", value: (row) => row.branchCode },
  { title: "Proveedor", key: "Proveedor", value: () => "" },
  { title: "fechaVencimiento", key: "fechaVencimiento", value: (row) => row.expirationDate },
  { title: "fechaContrato", key: "fechaContrato", value: (row) => row.documentDate },
  { title: "numContrato", key: "numContrato", value: (row) => row.description },
  { title: "sucursal", key: "sucursal", value: (row) => row.branchOnlyName },
  { title: "estado", key: "estado", value: (row) => row.statusName },
  { title: "numRefencia", key: "numRefencia", value: (row) => row.reference },
  { title: "Categoria", key: "Categoria", value: (row) => row.categoryName },
];

function requestFilters(values, sorting = {}) {
  const dates = values.dates || [];
  return {
    branchId: values.branchId,
    startDate: dates[0] || undefined,
    endDate: dates[1] || undefined,
    categoryId: values.categoryId,
    subcategoryId: values.subcategoryId,
    search: values.search,
    sortBy: sorting.sortBy,
    sortDirection: sorting.sortDirection,
  };
}

export function ExpiringDocumentsPage() {
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: PAGE_SIZE, total: 0 });
  const [catalogs, setCatalogs] = useState({ branches: [], categories: [], subcategories: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sendingDocumentId, setSendingDocumentId] = useState(null);
  const requestSequence = useRef(0);
  const sorting = useRef({});
  const dateRangeSelected = useRef(false);
  const todayIso = localTodayIso();
  const initialDateRange = [todayIso, todayIso];

  function withAppliedDateRange(values = {}) {
    return dateRangeSelected.current ? values : { ...values, dates: [] };
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

  async function sendEmail(record) {
    setSendingDocumentId(record.id);
    const result = await sendDocumentExpirationEmail(record.id);
    setSendingDocumentId(null);
    if (result.success) {
      message.success(result.message);
    } else {
      message.error(result.message);
    }
  }

  async function loadDocuments(values = {}, page = 1, pageSize = PAGE_SIZE) {
    const sequence = ++requestSequence.current;
    setLoading(true);
    const result = await getExpiringDocuments({
      ...requestFilters(withAppliedDateRange(values), sorting.current),
      page,
      pageSize,
    });
    if (sequence !== requestSequence.current) return;
    if (result.success) {
      const items = result.data?.items || result.data || [];
      setRows(items);
      setPagination({ current: result.data?.page || page, pageSize: result.data?.pageSize || pageSize, total: result.data?.total ?? items.length });
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    getDocumentCatalogs("all").then((catalogResult) => {
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
      const values = withAppliedDateRange(form.getFieldsValue());
      const result = await downloadDocumentXlsx({
        filters: {
          ...requestFilters(values, sorting.current),
          documentType: "all",
          includeInactive: true,
          statusId: 4,
        },
        columns: exportColumns,
        fileName: `DocumentaciónLegalHN_PorVencer_${documentExportTimestamp()}.xlsx`,
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
        <Button type="text" icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>Descargar Excel</Button>
      </div>

      <h1>Histórico Documentos por Vencer</h1>

      <Form
        form={form}
        layout="vertical"
        className="legacy-history-filters is-five-columns"
        initialValues={{ dates: initialDateRange }}
        onValuesChange={(changedValues, values) => {
          if (Object.hasOwn(changedValues, "dates")) dateRangeSelected.current = true;
          loadDocuments(values);
        }}
      >
        <Form.Item label="Sucursal" name="branchId"><Select allowClear showSearch placeholder="Seleccione Sucursal" options={options(catalogs.branches)} /></Form.Item>
        <Form.Item label="Fechas" name="dates">
          <LegacyDateRangePicker
            className="full-width"
            placeholder="Seleccione un rango de fechas"
            aria-label="Seleccione un rango de fechas"
            maxDate={todayIso}
          />
        </Form.Item>
        <Form.Item label="Categoría Documento" name="categoryId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.categories)} /></Form.Item>
        <Form.Item label="Subcategoría Documento" name="subcategoryId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.subcategories)} /></Form.Item>
        <Form.Item label="Descripción / Referencia" name="search"><Input allowClear /></Form.Item>
      </Form>

      <Table
        className="legacy-history-table"
        rowKey={(record) => record.id}
        columns={documentColumns(openAttachment, sendEmail, sendingDocumentId)}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 2100 }}
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
