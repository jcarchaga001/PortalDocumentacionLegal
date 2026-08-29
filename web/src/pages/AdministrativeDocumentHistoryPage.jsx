import { Button, Form, Input, message, Select, Table } from "antd";
import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { writeLegacySelectedDocumentId } from "../config/legacyDocumentContext.js";
import { LEGACY_FEEDBACK_CONTRACTS, isMissingDocumentAttachmentResult, showLegacyFeedback } from "../config/legacyFeedbackContracts.js";
import {
  DocumentAttachmentDrawer,
  previewFromAttachment,
} from "../components/DocumentAttachmentDrawer.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { downloadDocumentXlsx, documentExportTimestamp } from "../services/documentExportService.js";
import {
  getAdministrativeDocuments,
  getDocumentAttachment,
  getAdministrativeDocumentHistoryCatalogs,
} from "../services/documentService.js";
import { ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS } from "./documentExportMappings.js";
import {
  ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS,
  ADMINISTRATIVE_HISTORY_EXPORT_MAX_ROWS,
  ADMINISTRATIVE_HISTORY_MIN_TABLE_WIDTH,
  ADMINISTRATIVE_HISTORY_PAGE_SIZE,
  ADMINISTRATIVE_HISTORY_QUERY_ERROR,
  administrativeHistoryPaginationTotal,
  legacyAdministrativeHistoryDate,
  legacyAdministrativeHistoryHasAttachment,
  legacyAdministrativeHistoryLevelTone,
  legacyAdministrativeHistorySort,
  legacyAdministrativeHistoryStatusTone,
} from "./administrativeDocumentHistoryParity.js";

const PAGE_SIZE = ADMINISTRATIVE_HISTORY_PAGE_SIZE;

function LegacyTag({ children, tone }) {
  if (!children) return null;
  return <span className={`legacy-history-tag ${tone}`.trim()}>{children}</span>;
}

function sortable(sortState, key) {
  return {
    sorter: true,
    sortDirections: ["ascend", "descend", "ascend"],
    sortOrder: sortState.sortBy === key ? sortState.sortDirection : null,
  };
}

function documentColumns(openDetail, openAttachment, sortState) {
  return [
  { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[0], ...sortable(sortState, "branchName") },
  { title: "Referencia", dataIndex: "reference", key: "reference", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[1], ...sortable(sortState, "reference") },
  { title: "Descripción", dataIndex: "description", key: "description", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[2] },
  { title: "Proveedor", dataIndex: "providerName", key: "providerId", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[3], ...sortable(sortState, "providerId") },
  { title: "Categoría", dataIndex: "categoryName", key: "categoryName", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[4], ...sortable(sortState, "categoryName") },
  { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[5], ...sortable(sortState, "subcategoryName") },
  { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[6], ...sortable(sortState, "documentDate"), render: (_, row) => legacyAdministrativeHistoryDate(row, "documentDate") },
  { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate", width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[7], ...sortable(sortState, "expirationDate"), render: (_, row) => legacyAdministrativeHistoryDate(row, "expirationDate") },
  {
    title: "Nivel Documento",
    dataIndex: "levelName",
    key: "levelName",
    width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[8],
    render: (value, row) => <LegacyTag tone={legacyAdministrativeHistoryLevelTone(row.levelId)}>{value}</LegacyTag>,
  },
  {
    title: "Nivel Documento",
    key: "referential",
    width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[9],
    render: (_, row) => row.isReferential ? <LegacyTag tone="is-primary">Referencial</LegacyTag> : null,
  },
  {
    title: "Estado",
    dataIndex: "statusName",
    key: "statusName",
    width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[10],
    render: (value, row) => <LegacyTag tone={legacyAdministrativeHistoryStatusTone(row.statusId)}>{value}</LegacyTag>,
  },
  {
    title: "",
    key: "actions",
    width: ADMINISTRATIVE_HISTORY_COLUMN_WIDTHS[11],
    render: (_, record) => (
      <div className="legacy-history-actions legacy-administrative-history-actions">
        <button
          type="button"
          className="legacy-history-action"
          aria-label="Ver documento"
          onClick={() => openDetail(record)}
        >
          <i className="icon fa fa-external-link fa-1x" aria-hidden="true" />
        </button>
        {legacyAdministrativeHistoryHasAttachment(record) ? (
          <button
            type="button"
            className="legacy-history-action is-file"
            aria-label="Ver Archivo"
            title="Ver Archivo"
            onClick={() => openAttachment(record)}
          >
            <i className="icon fa fa-file-image-o fa-2x" aria-hidden="true" />
          </button>
        ) : null}
      </div>
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
    surface: "administrative-history",
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
  const [sortState, setSortState] = useState({});

  function openDetail(record) {
    writeLegacySelectedDocumentId(record.id);
    history.push(ROUTES.documentDetail);
  }

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
      return previewFromAttachment(record, result.data);
    });
  }

  function closePreview() {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function loadDocuments(values = {}, page = 1, pageSize = PAGE_SIZE, nextSort = sortState) {
    const sequence = ++requestSequence.current;
    setLoading(true);
    const result = await getAdministrativeDocuments({ ...requestFilters(values, nextSort), page, pageSize });
    if (sequence !== requestSequence.current) return;
    if (result.success) {
      const items = result.data?.items || result.data || [];
      setRows(items);
      setPagination({
        current: result.data?.page || page,
        pageSize: result.data?.pageSize || pageSize,
        total: result.data?.total ?? items.length,
      });
    } else message.error(ADMINISTRATIVE_HISTORY_QUERY_ERROR);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    getAdministrativeDocumentHistoryCatalogs().then((catalogResult) => {
      if (!active) return;
      if (catalogResult.success) setCatalogs((current) => ({ ...current, ...catalogResult.data }));
      else message.error(ADMINISTRATIVE_HISTORY_QUERY_ERROR);
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
    if (rows.length === 0) {
      showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.emptyExport);
      return;
    }
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
          surface: "administrative-history",
        },
        columns: ADMINISTRATIVE_DOCUMENT_EXPORT_COLUMNS,
        fileName: `CasosAseguradora_${documentExportTimestamp()}.xlsx`,
        sheetName: "Sheet1",
        legacyPlain: true,
        maxRows: ADMINISTRATIVE_HISTORY_EXPORT_MAX_ROWS,
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
    <div
      className="legacy-history-page legacy-administrative-history-page"
      style={{ "--legacy-administrative-history-min-width": `${ADMINISTRATIVE_HISTORY_MIN_TABLE_WIDTH}px` }}
    >
      <div className="legacy-history-new-row">
        <button type="button" aria-label="Nuevo Documento" onClick={() => history.push(ROUTES.documentCreate)}><span>+ Nuevo Documento</span></button>
        <Button
          className="legacy-history-excel legacy-administrative-history-excel"
          type="text"
          icon={<i className="icon fa fa-file-excel-o fa-1x" aria-hidden="true" />}
          aria-label="Descargar Excel"
          title="Descargar Excel"
          loading={exporting}
          onClick={handleExport}
        />
      </div>

      <h1>Histórico Documentos Administrativo</h1>

      <Form
        form={form}
        layout="vertical"
        className="legacy-history-filters is-five-columns legacy-administrative-history-filters"
        onValuesChange={(_, values) => loadDocuments(values, pagination.current, pagination.pageSize, sortState)}
      >
        <Form.Item label="Sucursal" name="branchId"><Select allowClear showSearch placeholder="Seleccione Sucursal" options={options(catalogs.branches)} /></Form.Item>
        <Form.Item label="Categoría Documento" name="categoryId"><Select allowClear showSearch placeholder="Seleccione..." options={options(catalogs.categories)} /></Form.Item>
        <Form.Item label="Subcategoría Documento" name="subcategoryId"><Select allowClear showSearch placeholder="Seleccione..." options={options(catalogs.subcategories)} /></Form.Item>
        <Form.Item label="Estado" name="statusId"><Select allowClear showSearch placeholder="Seleccione..." options={options(catalogs.statuses)} /></Form.Item>
        <Form.Item label="Descripción / Referencia" name="search"><Input allowClear /></Form.Item>
      </Form>

      <Table
        className="legacy-history-table legacy-administrative-history-table"
        rowKey={(record) => record.id || record.reference}
        columns={documentColumns(openDetail, openAttachment, sortState)}
        dataSource={rows}
        loading={loading}
        tableLayout="fixed"
        locale={{ emptyText: "No hay registros..." }}
        sortDirections={["ascend", "descend", "ascend"]}
        pagination={{
          ...pagination,
          showSizeChanger: false,
          showLessItems: true,
          showTotal: administrativeHistoryPaginationTotal,
        }}
        onChange={(nextPagination, _, sorter, extra) => {
          const nextSort = extra?.action === "sort" ? legacyAdministrativeHistorySort(sorter) : sortState;
          if (extra?.action === "sort") setSortState(nextSort);
          loadDocuments(
            form.getFieldsValue(),
            extra?.action === "sort" ? 1 : nextPagination.current,
            nextPagination.pageSize,
            nextSort,
          );
        }}
      />
      <DocumentAttachmentDrawer preview={preview} onClose={closePreview} />
    </div>
  );
}
