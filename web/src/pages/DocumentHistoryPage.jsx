import {
  DownloadOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  PlusOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Form, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyDateRangePicker } from "../components/LegacyDateRangePicker.jsx";
import { useAuth } from "../config/AuthContext.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { downloadDocumentXlsx, documentExportTimestamp } from "../services/documentExportService.js";
import { deleteDocument, getDocumentAttachment, getDocumentCatalogs, getDocuments } from "../services/documentService.js";

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
  if (extension === "pdf") return <iframe className="legacy-document-pdf" src={url} title="Vista previa del documento" sandbox="" referrerPolicy="no-referrer" />;
  return <div className="legacy-document-empty-file">No se puede leer archivo (Archivo con errores)</div>;
}

function documentColumns(openDetail, openAttachment, canDelete, confirmDelete) {
  return [
  { title: "Sucursal", dataIndex: "branchName", key: "branchName", fixed: "left", width: 190 },
  { title: "Referencia", dataIndex: "reference", key: "reference", width: 140 },
  { title: "Descripción", dataIndex: "description", key: "description", width: 260, ellipsis: true },
  { title: "Proveedor", dataIndex: "providerName", key: "providerName", width: 180, ellipsis: true },
  { title: "Categoría", dataIndex: "categoryName", key: "categoryName", width: 180 },
  { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName", width: 220 },
  { title: "Referencia 2", dataIndex: "secondaryReference", key: "secondaryReference", width: 140 },
  { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate", width: 150 },
  { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate", width: 160 },
  { title: "Usuario carga", dataIndex: "createdByName", key: "createdByName", width: 170 },
  { title: "Nivel Documento", dataIndex: "levelName", key: "levelName", width: 150 },
  {
    title: "Estado",
    dataIndex: "statusName",
    key: "statusName",
    width: 130,
    render: (value) => <Tag color={value === "Vigente" ? "green" : value === "Por Vencer" ? "gold" : "default"}>{value || "—"}</Tag>,
  },
  {
    title: "",
    key: "actions",
    fixed: "right",
    width: 132,
    render: (_, record) => (
      <Space size={4}>
        <Button type="text" size="small" icon={<EyeOutlined />} aria-label="Ver documento" onClick={() => openDetail(record)} />
        <Button
          type="text"
          size="small"
          icon={<FileImageOutlined />}
          aria-label="Ver Archivo"
          title="Ver Archivo"
          disabled={!record.hasAttachment}
          onClick={() => openAttachment(record)}
        />
        {canDelete ? (
          <Button
            type="text"
            size="small"
            icon={<StopOutlined style={{ color: "rgb(201, 6, 6)" }} />}
            aria-label="Anular"
            title="Anular"
            onClick={() => confirmDelete(record)}
          />
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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const dateRangeSelected = useRef(false);
  const canDelete = [7, 32].includes(Number(user?.positionCode));
  const todayIso = localTodayIso();
  const initialDateRange = [todayIso, todayIso];

  function withAppliedDateRange(values = {}) {
    return dateRangeSelected.current ? values : { ...values, dateRange: [] };
  }

  function openDetail(record) {
    history.push(`${ROUTES.documentDetail}?IdRegistro=${record.id}`);
  }

  async function openAttachment(record) {
    const result = await getDocumentAttachment(record.id);
    if (!result.success) {
      message.error(result.message);
      return;
    }
    const fileName = record.attachmentFileName || record.reference || "Documento";
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
    Modal.confirm({
      title: Number(user?.countryCode) === 4 ? "Farmacias del Ahorro" : "Farmavalue",
      content: "Confirma que desea eliminar el documento",
      icon: null,
      okText: "Aceptar",
      cancelText: "Cancelar",
      async onOk() {
        const result = await deleteDocument(record.id);
        if (!result.success) {
          message.error(result.message);
          throw new Error(result.message);
        }
        message.success("Registro eliminado exitosamente");
        await loadDocuments(form.getFieldsValue(), pagination.current, pagination.pageSize);
      },
    });
  }

  async function exportDocuments() {
    setExporting(true);
    try {
      const values = withAppliedDateRange(form.getFieldsValue());
      const selectedRange = values.dateRange || [];
      const result = await downloadDocumentXlsx({
        filters: {
          branchId: values.branchId,
          startDate: selectedRange[0] || undefined,
          endDate: selectedRange[1] || undefined,
          categoryId: values.categoryId,
          subcategoryId: values.subcategoryId,
          statusId: values.statusId,
          search: values.search,
        },
        fileName: `DocumentacionLegalHN_${documentExportTimestamp()}.xlsx`,
        sheetName: "DocumentacionLegalHN",
        columns: [
          { title: "nivelDocumento", dataIndex: "levelName", width: 20 },
          { title: "usuarioCreacion", dataIndex: "createdByName", width: 30 },
          { title: "codInternoSucursal", dataIndex: "branchCode", width: 20 },
          { title: "Proveedor", dataIndex: "providerName", width: 32 },
          { title: "fechaVencimiento", dataIndex: "expirationDate", width: 20 },
          { title: "fechaContrato", dataIndex: "documentDate", width: 18 },
          { title: "numContrato", dataIndex: "description", width: 34 },
          { title: "sucursal", dataIndex: "branchOnlyName", width: 32 },
          { title: "estado", dataIndex: "statusName", width: 18 },
          { title: "numRefencia", dataIndex: "reference", width: 22 },
          { title: "Categoria", dataIndex: "categoryName", width: 24 },
        ],
      });
      if (!result.success) message.warning(result.message);
    } catch {
      message.error("No fue posible generar el archivo de Excel.");
    } finally {
      setExporting(false);
    }
  }

  async function loadDocuments(values = {}, page = 1, pageSize = pagination.pageSize) {
    setLoading(true);
    const appliedValues = withAppliedDateRange(values);
    const selectedRange = appliedValues.dateRange || [];
    const result = await getDocuments({
      branchId: appliedValues.branchId,
      startDate: selectedRange[0] || undefined,
      endDate: selectedRange[1] || undefined,
      categoryId: appliedValues.categoryId,
      subcategoryId: appliedValues.subcategoryId,
      statusId: appliedValues.statusId,
      search: appliedValues.search,
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

  useEffect(() => {
    let active = true;
    Promise.all([getDocumentCatalogs(), getDocuments({ page: 1, pageSize: PAGE_SIZE })]).then(([catalogResult, documentResult]) => {
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

  return (
    <div className="legacy-history-page">
      <div className="legacy-history-new-row">
        <button type="button" onClick={() => history.push(ROUTES.documentCreate)}>
          <PlusOutlined /> Nuevo Documento
        </button>
        <Button
          type="text"
          icon={<FileExcelOutlined style={{ color: "rgb(8, 169, 62)", fontSize: 20 }} />}
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
        onValuesChange={(changedValues, values) => {
          if (Object.hasOwn(changedValues, "dateRange")) dateRangeSelected.current = true;
          loadDocuments(values, 1, pagination.pageSize);
        }}
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
        columns={documentColumns(openDetail, openAttachment, canDelete, confirmDelete)}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 2200 }}
        pagination={{ ...pagination, showSizeChanger: false }}
        onChange={(nextPagination) => loadDocuments(form.getFieldsValue(), nextPagination.current, nextPagination.pageSize)}
        size="middle"
      />

      <Drawer
        title="Vista Previa de Archivo"
        placement="right"
        width={900}
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
    </div>
  );
}
