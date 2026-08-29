import { Button, Form, Input, message, Select, Table } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  DocumentAttachmentDrawer,
  previewFromAttachment,
} from "../components/DocumentAttachmentDrawer.jsx";
import { LegacyDateRangePicker } from "../components/LegacyDateRangePicker.jsx";
import { LEGACY_FEEDBACK_CONTRACTS, isMissingDocumentAttachmentResult, showLegacyFeedback } from "../config/legacyFeedbackContracts.js";
import { downloadDocumentXlsx, documentExportTimestamp } from "../services/documentExportService.js";
import {
  getDocumentAttachment,
  getDocumentCatalogs,
  getExpiringDocuments,
  sendDocumentExpirationEmail,
} from "../services/documentService.js";
import { EXPIRING_DOCUMENT_EXPORT_COLUMNS } from "./documentExportMappings.js";
import {
  EXPIRING_ATTACHMENT_DOWNLOAD_NAME,
  EXPIRING_DOCUMENT_PAGE_SIZE,
  EXPIRING_QUERY_ERROR,
  expiringDocumentFilters,
  expiringLevelClass,
  expiringPaginationTotal,
  expiringTableChange,
  hasExpiringAttachmentAction,
} from "./expiringDocumentsParity.js";

const PAGE_SIZE = EXPIRING_DOCUMENT_PAGE_SIZE;

function localTodayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function documentColumns(openAttachment, sendEmail, sendingDocumentId) {
  return [
  { title: "Sucursal", dataIndex: "branchName", key: "branchName", fixed: "left", width: 190, sorter: true },
  { title: "Referencia", dataIndex: "reference", key: "reference", width: 140, sorter: true },
  { title: "Descripción", dataIndex: "description", key: "description", width: 260, ellipsis: true },
  { title: "Proveedor", dataIndex: "providerName", key: "providerCode", width: 180, ellipsis: true, sorter: true },
  { title: "Categoría", dataIndex: "categoryName", key: "categoryName", width: 180, sorter: true },
  { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName", width: 220, sorter: true },
  { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate", width: 150, sorter: true },
  { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate", width: 160, sorter: true },
  { title: "Tiempo Vencimiento", dataIndex: "expirationTime", key: "expirationTime", width: 170 },
  { title: "Registró Documento", dataIndex: "createdByName", key: "createdByName", width: 190 },
  {
    title: "Nivel Documento",
    dataIndex: "levelName",
    key: "levelName",
    width: 150,
    render: (value) => value ? <span className={`legacy-expiring-tag ${expiringLevelClass(value)}`}>{value}</span> : null,
  },
  {
    title: "Estado",
    dataIndex: "statusName",
    key: "statusName",
    width: 130,
    render: (value) => value ? <span className="legacy-expiring-tag is-status">{value}</span> : null,
  },
  {
    title: "",
    key: "actions",
    fixed: "right",
    width: 84,
    render: (_, record) => (
      <div className="legacy-expiring-actions">
        {hasExpiringAttachmentAction(record) ? <Button
          type="text"
          size="small"
          className="legacy-expiring-action is-preview"
          icon={<i className="icon fa fa-file-image-o fa-2x" aria-hidden="true" />}
          aria-label="Ver Archivo"
          title="Ver Archivo"
          onClick={() => openAttachment(record)}
        /> : null}
        <Button
          type="text"
          size="small"
          className="legacy-expiring-action is-email"
          icon={<i className="icon fa fa-envelope-o fa-2x" aria-hidden="true" />}
          aria-label="Enviar Correo"
          title="Enviar Correo"
          loading={sendingDocumentId === record.id}
          onClick={() => sendEmail(record)}
        />
      </div>
    ),
  },
  ];
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
  const todayIso = localTodayIso();
  const initialDateRange = [todayIso, todayIso];

  async function openAttachment(record) {
    if (!record.attachmentId) {
      showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.missingDocumentAttachment);
      return;
    }
    const result = await getDocumentAttachment(record.id);
    if (!result.success) {
      if (isMissingDocumentAttachmentResult(result)) showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.missingDocumentAttachment);
      else message.error(result.message);
      return;
    }
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return {
        ...previewFromAttachment(record, result.data),
        downloadFileName: EXPIRING_ATTACHMENT_DOWNLOAD_NAME,
      };
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
    if (!result.success) message.error(result.message);
  }

  async function loadDocuments(values = {}, page = 1, pageSize = PAGE_SIZE) {
    const sequence = ++requestSequence.current;
    setLoading(true);
    const result = await getExpiringDocuments({
      ...expiringDocumentFilters(values, sorting.current),
      page,
      pageSize,
    });
    if (sequence !== requestSequence.current) return;
    if (result.success) {
      const items = result.data?.items || result.data || [];
      setRows(items);
      setPagination({ current: result.data?.page || page, pageSize: result.data?.pageSize || pageSize, total: result.data?.total ?? items.length });
    } else {
      message.error(EXPIRING_QUERY_ERROR);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    getDocumentCatalogs("all", { surface: "expiring" }).then((catalogResult) => {
      if (!active) return;
      if (catalogResult.success) setCatalogs((current) => ({ ...current, ...catalogResult.data }));
      else message.error(EXPIRING_QUERY_ERROR);
    });
    loadDocuments({ dates: initialDateRange }, 1, PAGE_SIZE);
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
    if (rows.length === 0) {
      showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.emptyExport);
      return;
    }
    setExporting(true);
    try {
      const values = form.getFieldsValue();
      const result = await downloadDocumentXlsx({
        filters: {
          ...expiringDocumentFilters(values),
          documentType: "all",
          includeInactive: true,
          statusId: 4,
        },
        columns: EXPIRING_DOCUMENT_EXPORT_COLUMNS,
        fileName: `DocumentaciónLegalHN_PorVencer_${documentExportTimestamp()}.xlsx`,
        sheetName: "Sheet1",
        legacyPlain: true,
      });
      if (!result.success) {
        if (result.error?.code === "EMPTY_EXPORT") showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.emptyExport);
        else message.error(result.message);
      }
    } catch {
      message.error("No fue posible generar el archivo de Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="legacy-history-page">
      <div className="legacy-history-new-row">
        <Button
          type="text"
          className="legacy-expiring-export"
          icon={<i className="icon fa fa-file-excel-o fa-1x" aria-hidden="true" />}
          aria-label="Descargar Excel"
          title="Descargar Excel"
          loading={exporting}
          onClick={handleExport}
        />
      </div>

      <h1>Histórico Documentos por Vencer</h1>

      <Form
        form={form}
        layout="vertical"
        className="legacy-history-filters is-five-columns"
        initialValues={{ dates: initialDateRange }}
        onValuesChange={(changedValues, values) => {
          loadDocuments(values, pagination.current, pagination.pageSize);
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
        <Form.Item label="Categoría Documento" name="categoryId"><Select allowClear showSearch placeholder="Seleccione..." options={options(catalogs.categories)} /></Form.Item>
        <Form.Item label="Subcategoría Documento" name="subcategoryId"><Select allowClear showSearch placeholder="Seleccione..." options={options(catalogs.subcategories)} /></Form.Item>
        <Form.Item label="Descripción / Referencia" name="search"><Input allowClear /></Form.Item>
      </Form>

      <Table
        className="legacy-history-table legacy-expiring-table"
        rowKey={(record) => record.id}
        columns={documentColumns(openAttachment, sendEmail, sendingDocumentId)}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 2100 }}
        locale={{ emptyText: "No hay registros..." }}
        sortDirections={["ascend", "descend", "ascend"]}
        pagination={{ ...pagination, showSizeChanger: false, showTotal: expiringPaginationTotal }}
        onChange={(nextPagination, _, sorter, extra) => {
          const change = expiringTableChange(nextPagination, sorter, extra.action);
          if (change.sorting) sorting.current = change.sorting;
          loadDocuments(form.getFieldsValue(), change.page, change.pageSize);
        }}
      />
      <DocumentAttachmentDrawer preview={preview} onClose={closePreview} />
    </div>
  );
}
