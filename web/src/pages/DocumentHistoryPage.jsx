import { DownloadOutlined } from "@ant-design/icons";
import { Button, Drawer, Form, Input, Modal, Select, Space, Table, message } from "antd";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyDateRangePicker } from "../components/LegacyDateRangePicker.jsx";
import { useAuth } from "../config/AuthContext.jsx";
import { LEGACY_FEEDBACK_CONTRACTS, showLegacyFeedback } from "../config/legacyFeedbackContracts.js";
import { writeLegacySelectedDocumentId } from "../config/legacyDocumentContext.js";
import { ROUTES } from "../routes/routePaths.js";
import { downloadDocumentXlsx, documentExportTimestamp } from "../services/documentExportService.js";
import {
  deleteDocument,
  getBranchDocumentHistoryCatalogs,
  getDocumentAttachment,
  getDocuments,
} from "../services/documentService.js";
import { BRANCH_DOCUMENT_EXPORT_COLUMNS } from "./documentExportMappings.js";
import { buildLegacyBranchHistoryFilters } from "./documentHistoryFilters.js";
import {
  LEGACY_BRANCH_HISTORY_TABLE_WIDTH,
  legacyBranchHistoryHasAttachment,
  legacyBranchHistoryInitialRange,
  legacyBranchHistoryLevelTone,
  legacyBranchHistorySort,
  legacyBranchHistoryStatusTone,
} from "./documentHistoryParity.js";

const PAGE_SIZE = 50;

function localTodayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function PreviewContent({ extension, url }) {
  if (!url) return <div className="legacy-document-empty-file">No existe el archivo...</div>;
  if (["jpg", "jpeg", "png", "bmp"].includes(extension)) {
    return <img className="legacy-document-image" src={url} alt="Vista previa del documento" />;
  }
  if (extension === "pdf") {
    return <iframe className="legacy-document-pdf" src={url} title="Vista previa del documento" sandbox="" referrerPolicy="no-referrer" />;
  }
  return <div className="legacy-document-empty-file">No se puede leer archivo (Archivo con errores)</div>;
}

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

function documentColumns(openDetail, openAttachment, canDelete, confirmDelete, sortState) {
  return [
    { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: 133, ...sortable(sortState, "branchName") },
    { title: "Referencia", dataIndex: "reference", key: "reference", width: 128, ...sortable(sortState, "reference") },
    { title: "Descripción", dataIndex: "description", key: "description", width: 118 },
    {
      title: "Proveedor",
      dataIndex: "providerName",
      key: "providerId",
      width: 131,
      ...sortable(sortState, "providerId"),
    },
    { title: "Categoría", dataIndex: "categoryName", key: "categoryName", width: 123, ...sortable(sortState, "categoryName") },
    { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName", width: 145, ...sortable(sortState, "subcategoryName") },
    { title: "Referencia 2", dataIndex: "secondaryReference", key: "secondaryReference", width: 135 },
    { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate", width: 177, ...sortable(sortState, "documentDate") },
    { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate", width: 180, ...sortable(sortState, "expirationDate") },
    { title: "Usuario Carga", dataIndex: "createdByName", key: "createdByName", width: 133 },
    {
      title: "Nivel Documento",
      dataIndex: "levelName",
      key: "levelName",
      width: 154,
      render: (value, record) => <LegacyTag tone={legacyBranchHistoryLevelTone(record.levelId)}>{value}</LegacyTag>,
    },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 104,
      render: (value, record) => <LegacyTag tone={legacyBranchHistoryStatusTone(record.statusId)}>{value}</LegacyTag>,
    },
    {
      title: "",
      key: "actions",
      width: 132,
      render: (_, record) => (
        <Space className="legacy-history-actions" size={16}>
          <button type="button" className="legacy-history-action" aria-label="Ver Detalle" title="Ver Detalle" onClick={() => openDetail(record)}>
            <i className="icon fa fa-external-link fa-1x" aria-hidden="true" />
          </button>
          {legacyBranchHistoryHasAttachment(record) ? (
            <button type="button" className="legacy-history-action is-file" aria-label="Ver Archivo" title="Ver Archivo" onClick={() => openAttachment(record)}>
              <i className="icon fa fa-file-image-o fa-2x" aria-hidden="true" />
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" className="legacy-history-action is-delete" aria-label="Anular" title="Anular" onClick={() => confirmDelete(record)}>
              <i className="icon fa fa-ban fa-2x" aria-hidden="true" />
            </button>
          ) : null}
        </Space>
      ),
    },
  ];
}

export function DocumentHistoryPage() {
  const history = useHistory();
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: PAGE_SIZE, total: 0 });
  const [catalogs, setCatalogs] = useState({ branches: [], categories: [], subcategories: [], statuses: [] });
  const [sortState, setSortState] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const canDelete = [7, 32].includes(Number(user?.positionCode));
  const todayIso = localTodayIso();
  const initialDateRange = legacyBranchHistoryInitialRange(todayIso);

  function openDetail(record) {
    writeLegacySelectedDocumentId(record.id);
    history.push(ROUTES.documentDetail);
  }

  async function openAttachment(record) {
    const result = await getDocumentAttachment(record.id);
    const fileName = record.attachmentFileName || record.reference || "Documento";
    if (!result.success) {
      if (result.error?.code === "DOCUMENT_ATTACHMENT_NOT_FOUND") {
        setPreview({ url: null, fileName, extension: "" });
      } else {
        message.error(result.message);
      }
      return;
    }
    const extension = String(fileName).split(".").pop().toLowerCase();
    setPreview({
      url: URL.createObjectURL(result.data),
      fileName,
      extension,
    });
  }

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  function confirmDelete(record) {
    setPendingDelete(record);
  }

  async function loadDocuments(values = {}, page = 1, pageSize = pagination.pageSize, nextSort = sortState) {
    setLoading(true);
    const result = await getDocuments({
      ...buildLegacyBranchHistoryFilters(values),
      ...nextSort,
      page,
      pageSize,
    });
    if (result.success) {
      setRows(result.data?.items || result.data || []);
      setPagination({
        current: result.data?.page || page,
        pageSize: result.data?.pageSize || pageSize,
        total: result.data?.total ?? (result.data?.items || result.data || []).length,
      });
    }
    setLoading(false);
  }

  async function executeDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const result = await deleteDocument(pendingDelete.id);
    if (!result.success) {
      message.error(result.message);
      setDeleting(false);
      return;
    }
    setPendingDelete(null);
    setDeleting(false);
    await loadDocuments(form.getFieldsValue(), pagination.current, pagination.pageSize, sortState);
  }

  async function exportDocuments() {
    setExporting(true);
    try {
      const result = await downloadDocumentXlsx({
        filters: buildLegacyBranchHistoryFilters(form.getFieldsValue()),
        fileName: `DocumentacionLegalHN_${documentExportTimestamp()}.xlsx`,
        sheetName: "Sheet1",
        columns: BRANCH_DOCUMENT_EXPORT_COLUMNS,
      });
      if (!result.success) {
        if (result.error?.code === "EMPTY_EXPORT") showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.emptyExport);
        else message.warning(result.message);
      }
    } catch {
      message.error("No fue posible generar el archivo de Excel.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      getBranchDocumentHistoryCatalogs(),
      getDocuments({ ...buildLegacyBranchHistoryFilters({}), page: 1, pageSize: PAGE_SIZE }),
    ]).then(([catalogResult, documentResult]) => {
      if (!active) return;
      if (catalogResult.success) setCatalogs((current) => ({ ...current, ...catalogResult.data }));
      if (documentResult.success) {
        setRows(documentResult.data?.items || documentResult.data || []);
        setPagination({
          current: documentResult.data?.page || 1,
          pageSize: documentResult.data?.pageSize || PAGE_SIZE,
          total: documentResult.data?.total ?? (documentResult.data?.items || documentResult.data || []).length,
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const options = (items) => (items || []).map((item) => ({ value: item.id, label: item.name }));
  const confirmationTitle = Number(user?.countryCode) === 4 ? "Farmacias del Ahorro" : "Farmavalue";
  const confirmationLogo = Number(user?.countryCode) === 4
    ? "/brand/branch-detail/logoFarmaciaAhorro.jpg"
    : "/brand/logo.png";

  return (
    <div className="legacy-history-page">
      <div className="legacy-history-new-row">
        <button type="button" onClick={() => history.push(ROUTES.documentCreate)}>
          <span aria-hidden="true">+</span> Nuevo Documento
        </button>
        <Button
          className="legacy-history-excel"
          type="text"
          icon={<i className="icon fa fa-file-excel-o fa-1x" aria-hidden="true" />}
          aria-label="Descargar Excel"
          title="Descargar Excel"
          loading={exporting}
          onClick={exportDocuments}
        />
      </div>

      <h1>Histórico Documentos</h1>

      <Form
        form={form}
        layout="vertical"
        className="legacy-history-filters"
        initialValues={{ dateRange: initialDateRange }}
        onValuesChange={(_, values) => loadDocuments(values, 1, pagination.pageSize, sortState)}
      >
        <Form.Item label="Sucursal" name="branchId"><Select allowClear showSearch placeholder="Seleccione Sucursal" options={options(catalogs.branches)} /></Form.Item>
        <Form.Item label="Fechas" name="dateRange">
          <LegacyDateRangePicker
            className="full-width"
            placeholder="Seleccione un rango de fechas"
            aria-label="Seleccione un rango de fechas"
            maxDate={todayIso}
          />
        </Form.Item>
        <Form.Item label="Categoría Documento" name="categoryId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.categories)} /></Form.Item>
        <Form.Item label="Subcategoría Documento" name="subcategoryId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.subcategories)} /></Form.Item>
        <Form.Item label="Estado" name="statusId"><Select allowClear placeholder="Seleccione..." options={options(catalogs.statuses)} /></Form.Item>
        <Form.Item label="Descripción / Referencia" name="search"><Input allowClear /></Form.Item>
      </Form>

      <Table
        className="legacy-history-table"
        rowKey={(record) => record.id || record.reference}
        columns={documentColumns(openDetail, openAttachment, canDelete, confirmDelete, sortState)}
        dataSource={rows}
        loading={loading}
        tableLayout="fixed"
        scroll={{ x: LEGACY_BRANCH_HISTORY_TABLE_WIDTH }}
        pagination={{
          ...pagination,
          showSizeChanger: false,
          showLessItems: true,
          showTotal: (total, range) => `${range[0]} to ${range[1]} of ${total} items`,
        }}
        onChange={(nextPagination, _filters, sorter, extra) => {
          const nextSort = legacyBranchHistorySort(sorter);
          setSortState(nextSort);
          loadDocuments(
            form.getFieldsValue(),
            extra?.action === "sort" ? 1 : nextPagination.current,
            nextPagination.pageSize,
            nextSort,
          );
        }}
        size="middle"
      />

      <Drawer
        title="Vista Previa de Archivo"
        placement="right"
        width="50%"
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        extra={preview?.url ? (
          <a href={preview.url} download={preview.fileName} aria-label="Descargar archivo" title="Descargar archivo">
            <DownloadOutlined />
          </a>
        ) : null}
        destroyOnHidden
      >
        {preview ? <PreviewContent {...preview} /> : null}
      </Drawer>

      <Modal
        className="legacy-history-confirm-modal"
        open={Boolean(pendingDelete)}
        title={null}
        footer={null}
        closable={false}
        maskClosable={false}
        centered
        width={500}
        onCancel={() => !deleting && setPendingDelete(null)}
      >
        <div className="legacy-history-confirm-body">
          <img src={confirmationLogo} alt="" />
          <div>
            <h2>{confirmationTitle}</h2>
            <p>Confirma que desea eliminar el documento</p>
          </div>
        </div>
        <div className="legacy-history-confirm-actions">
          <Button className="is-cancel" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancelar</Button>
          <Button className="is-accept" loading={deleting} onClick={executeDelete}>Aceptar</Button>
        </div>
      </Modal>
    </div>
  );
}
