import { message, Skeleton, Table } from "antd";
import { useCallback, useEffect, useState } from "react";
import { LegacyDonutChart } from "../components/LegacyDonutChart.jsx";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { LEGACY_FEEDBACK_CONTRACTS, showLegacyFeedback } from "../config/legacyFeedbackContracts.js";
import { getDashboardDocuments, getDashboardExportRows, getDashboardSummary } from "../services/dashboardService.js";
import { exportRowsToXlsx } from "../services/spreadsheetService.js";
import {
  DASHBOARD_EXPORT_FIELDS,
  DASHBOARD_SORT_DIRECTIONS,
  DASHBOARD_TABLE_WIDTHS,
  dashboardExportFileName,
  dashboardPaginationWindow,
  dashboardProgress,
} from "./dashboardGlobalParity.js";

const STATUS_COLORS = {
  current: "#37b24d",
  expiring: "#f76707",
  missing: "#c92a2a",
};

const DOCUMENT_STATUS_TONES = Object.freeze({
  1: "is-yellow",
  2: "is-green",
  3: "is-neutral",
  4: "is-orange",
  5: "is-red",
});

const emptySummary = {
  required: 0,
  current: 0,
  expiring: 0,
  missing: 0,
  subcategories: [],
  documents: [],
};

const documentColumns = [
  { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: 137.5625, sorter: true, onHeaderCell: () => ({ className: "legacy-table-header-center" }), render: (value) => <div><span>{value}</span></div> },
  { title: "Referencia", dataIndex: "reference", key: "reference", width: 132.265625, sorter: true, onHeaderCell: () => ({ className: "legacy-table-header-center" }), render: (value) => <div><span>{value}</span></div> },
  { title: "Descripción", dataIndex: "description", key: "description", width: 164.203125, onHeaderCell: () => ({ className: "legacy-table-header-muted" }), render: (value) => <span>{value}</span> },
  { title: "Categoría", dataIndex: "categoryName", key: "categoryName", width: 127.359375, sorter: true, onHeaderCell: () => ({ className: "legacy-table-header-muted" }), render: (value) => <span>{value}</span> },
  { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName", width: 149.484375, sorter: true, onHeaderCell: () => ({ className: "legacy-table-header-muted" }), render: (value) => <span>{value}</span> },
  { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate", width: 182.203125, sorter: true, align: "center", onHeaderCell: () => ({ className: "legacy-table-header-center" }), render: (value) => <span>{value}</span> },
  { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate", width: 185.296875, sorter: true, align: "center", onHeaderCell: () => ({ className: "legacy-table-header-center" }), render: (value) => <span>{value}</span> },
  { title: "Tiempo Vencimiento", dataIndex: "expirationTime", key: "expirationTime", width: 178.8125, align: "center", onHeaderCell: () => ({ className: "legacy-table-header-left legacy-table-header-muted" }), render: (value) => <span>{value}</span> },
  { title: "Estado", dataIndex: "statusName", key: "statusName", width: 106.09375, align: "center", onHeaderCell: () => ({ className: "legacy-table-header-center legacy-table-header-state" }), render: (value, row) => <DashboardDocumentStatus id={row.statusId} name={value} /> },
];

function number(value) {
  return Number(value || 0);
}

function DashboardDocumentStatus({ id, name }) {
  return <span className={`legacy-dashboard-status-tag ${DOCUMENT_STATUS_TONES[number(id)] || "is-neutral"}`}><span>{name || ""}</span></span>;
}

function ComplianceBar({ current, expiring, required }) {
  const { percentage, color } = dashboardProgress({ current, expiring, required });
  return (
    <div className="legacy-compliance-track" aria-hidden="true">
      <span style={{ width: `${percentage}%`, background: color }} />
    </div>
  );
}

function Metric({ iconClass, colorClass, label, value, onClick }) {
  return (
    <div className="legacy-dashboard-metric" onClick={onClick}>
      <div className="legacy-dashboard-metric-copy">
        <strong>{number(value).toLocaleString("es-HN")}</strong>
        <span>{label}</span>
      </div>
      <span className={`legacy-dashboard-metric-icon ${colorClass}`}>
        <i className={`icon text-dark-grey fa ${iconClass} fa-1x`} aria-hidden="true" />
      </span>
    </div>
  );
}

function SubcategoryCell({ item }) {
  const current = number(item.current);
  const expiring = number(item.expiring);
  const missing = number(item.missing);
  const total = number(item.total) || current + expiring + missing;
  const registered = current + expiring;

  return (
    <div className="legacy-subcategory-cell">
      <div className="legacy-subcategory-heading">
        <div className="legacy-subcategory-name"><span>{item.name}</span></div>
        <ComplianceBar current={current} expiring={expiring} required={total} />
      </div>
      <LegacyDonutChart current={current} expiring={expiring} missing={missing} height={150} />
      <div className="legacy-subcategory-total">
        <span>Total Documentos: </span><span>{registered.toLocaleString("es-HN")}</span>
      </div>
    </div>
  );
}

function paginationItems(current, pages) {
  if (pages <= 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const items = [1];
  const start = Math.max(2, Math.min(current - 1, pages - 3));
  const end = Math.min(pages - 1, start + 2);
  if (start > 2) items.push("ellipsis-start");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < pages - 1) items.push("ellipsis-end");
  items.push(pages);
  return items;
}

function LegacyDashboardPagination({ count, startIndex, onChange }) {
  if (count <= 0) return null;
  const { pages, current, first, last } = dashboardPaginationWindow(count, startIndex);
  return (
    <div className="legacy-dashboard-pagination">
      <div className="legacy-dashboard-pagination-summary">{first} to {last} of {count} items</div>
      <div className="legacy-dashboard-pagination-controls">
        <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => onChange(current - 1)}>
          <i className="fa fa-angle-left" aria-hidden="true" />
        </button>
        {paginationItems(current, pages).map((item) => typeof item === "number" ? (
          <button key={item} type="button" className={item === current ? "is--active" : ""} aria-current={item === current ? "page" : undefined} onClick={() => onChange(item)}>{item}</button>
        ) : <span key={item}>...</span>)}
        <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => onChange(current + 1)}>
          <i className="fa fa-angle-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentStatus, setDocumentStatus] = useState(null);
  const [documentStartIndex, setDocumentStartIndex] = useState(0);
  const [documentSort, setDocumentSort] = useState({});
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    getDashboardSummary().then((result) => {
      if (!active) return;
      if (result.success) setSummary({ ...emptySummary, ...result.data });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const required = number(summary.required);
  const current = number(summary.current);
  const expiring = number(summary.expiring);
  const missing = number(summary.missing);
  const registered = current + expiring;
  const activeColumnWidths = DASHBOARD_TABLE_WIDTHS[documentStatus] || DASHBOARD_TABLE_WIDTHS.empty;
  const activeDocumentColumns = documentColumns.map((column, index) => ({ ...column, width: activeColumnWidths[index] }));
  const dashboardTableWidth = activeColumnWidths.reduce((sum, width) => sum + width, 0);

  const loadDocuments = useCallback(async (status, startIndex = 0, sort = {}) => {
    setDocumentStatus(status);
    setDocumentStartIndex(startIndex);
    setDocumentLoading(true);
    setFeedback("");
    const result = await getDashboardDocuments({
      statusId: status,
      startIndex,
      maxRecords: 50,
    });
    if (result.success) {
      setDocuments(result.data?.items || result.data?.rows || result.data || []);
      setDocumentCount(number(result.data?.count ?? result.data?.total));
    } else {
      setDocuments([]);
      setDocumentCount(0);
      setFeedback(result.message || "Error executing query.");
    }
    setDocumentLoading(false);
  }, []);

  const filterDocuments = useCallback((status) => loadDocuments(status, documentStartIndex, documentSort), [documentSort, documentStartIndex, loadDocuments]);

  const changeDocumentPage = useCallback((page) => {
    if (!documentStatus) return;
    loadDocuments(documentStatus, (page - 1) * 50, documentSort);
  }, [documentSort, documentStatus, loadDocuments]);

  const changeDocumentSort = useCallback((_pagination, _filters, sorter) => {
    if (!documentStatus || Array.isArray(sorter)) return;
    const sortBy = sorter.order ? sorter.columnKey : undefined;
    const sortDirection = sorter.order === "descend" ? "desc" : sorter.order === "ascend" ? "asc" : undefined;
    const nextSort = sortBy ? { sortBy, sortDirection } : {};
    setDocumentSort(nextSort);
    loadDocuments(documentStatus, 0, nextSort);
  }, [documentStatus, loadDocuments]);

  async function exportDashboard() {
    setFeedback("");
    setExporting(true);
    const result = await getDashboardExportRows();
    const rows = result.success ? (result.data?.rows || []) : [];
    if (rows.length === 0) {
      if (result.success || result.error?.code === "EMPTY_EXPORT") {
        showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.emptyExport);
      } else {
        setFeedback(result.message || "Error executing query.");
      }
      setExporting(false);
      return;
    }
    await exportRowsToXlsx({
      fileName: dashboardExportFileName(),
      sheetName: "Sheet1",
      columns: DASHBOARD_EXPORT_FIELDS.map((field) => ({ title: field, key: field })),
      rows,
      legacyPlain: true,
    });
    setExporting(false);
  }

  return (
    <div className="legacy-dashboard-page">
      <LegacyErrorFeedback message={feedback} />
      <div className="legacy-dashboard-title-row">
        <h1>Dashboard General</h1>
        <a href="#" id="LinkExportExcel" aria-disabled={exporting} onClick={(event) => { event.preventDefault(); if (!exporting) exportDashboard(); }}>
          <i className="icon fa fa-file-excel-o fa-1x" aria-hidden="true" />
        </a>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <>
          <div className="legacy-dashboard-metrics">
            <Metric label="Documentos Requeridos" value={required} iconClass="fa-gavel" colorClass="is-required" />
            <Metric label="Vigentes" value={current} iconClass="fa-file-text" colorClass="is-current" onClick={() => filterDocuments(2)} />
            <Metric label="Por Vencer" value={expiring} iconClass="fa-hourglass-end" colorClass="is-expiring" onClick={() => filterDocuments(4)} />
            <Metric label="Documentos Faltantes" value={missing} iconClass="fa-times-circle" colorClass="is-missing" onClick={() => filterDocuments(5)} />
          </div>

          <div className="legacy-dashboard-panels">
            <section className="legacy-status-panel">
              <div className="legacy-status-panel-head">
                <div>
                  <h2>Documentos por Estado</h2>
                  <ComplianceBar current={current} expiring={expiring} required={required} />
                </div>
                <div className="legacy-status-count">
                  <div className="legacy-status-count-content">
                    <div><span>{registered.toLocaleString("es-HN")} Documentos</span></div>
                  </div>
                </div>
              </div>
              <div className="legacy-status-chart">
                <LegacyDonutChart current={current} expiring={expiring} missing={missing} height={300} showLegend />
              </div>
            </section>

            <section className="legacy-subcategories-panel">
              <h2>Subcategorias Obligatorias</h2>
              <div className="legacy-subcategories-grid">
                {(summary.subcategories || []).map((item) => (
                  <SubcategoryCell key={item.id || item.name} item={item} />
                ))}
              </div>
            </section>
          </div>

          <section className="legacy-dashboard-table" style={{ "--legacy-dashboard-table-width": `${dashboardTableWidth + 2}px` }}>
            <h2>Documentos por Estado</h2>
            <Table
              rowKey="id"
              columns={activeDocumentColumns}
              dataSource={documents}
              loading={documentLoading}
              pagination={false}
              onChange={changeDocumentSort}
              sortDirections={DASHBOARD_SORT_DIRECTIONS}
              showSorterTooltip={false}
              tableLayout="fixed"
              locale={{ emptyText: "No hay registros..." }}
              scroll={{ x: dashboardTableWidth }}
              size="small"
            />
            <LegacyDashboardPagination count={documentCount} startIndex={documentStartIndex} onChange={changeDocumentPage} />
          </section>
        </>
      )}
    </div>
  );
}
