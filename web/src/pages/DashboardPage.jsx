import {
  AuditOutlined,
  CloseCircleFilled,
  FileExcelOutlined,
  FileTextFilled,
  HourglassOutlined,
} from "@ant-design/icons";
import { Skeleton, Table } from "antd";
import { useEffect, useState } from "react";
import { getDashboardSummary } from "../services/dashboardService.js";
import { exportRowsToXlsx } from "../services/spreadsheetService.js";

const STATUS_COLORS = {
  current: "#37b24d",
  expiring: "#f76707",
  missing: "#c92a2a",
};

const emptySummary = {
  required: 0,
  current: 0,
  expiring: 0,
  missing: 0,
  subcategories: [],
  documents: [],
};

const documentColumns = [
  { title: "Sucursal", dataIndex: "branchName", key: "branchName" },
  { title: "Referencia", dataIndex: "reference", key: "reference" },
  { title: "Descripción", dataIndex: "description", key: "description" },
  { title: "Categoría", dataIndex: "categoryName", key: "categoryName" },
  { title: "Subcategoría", dataIndex: "subcategoryName", key: "subcategoryName" },
  { title: "Fecha de Contrato", dataIndex: "documentDate", key: "documentDate" },
  { title: "Fecha Vencimiento", dataIndex: "expirationDate", key: "expirationDate" },
  { title: "Tiempo Vencimiento", dataIndex: "expirationTime", key: "expirationTime" },
  { title: "Estado", dataIndex: "statusName", key: "statusName" },
];

function number(value) {
  return Number(value || 0);
}

function compliancePercent(current, expiring, required) {
  const requiredCount = number(required);
  if (!requiredCount) return 0;
  return Math.min(100, ((number(current) + number(expiring)) / requiredCount) * 100);
}

function DonutChart({ current, expiring, missing, size, strokeWidth }) {
  const values = [number(current), number(expiring), number(missing)];
  const total = values.reduce((sum, value) => sum + value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = values.map((value, index) => {
    const length = total ? (value / total) * circumference : 0;
    const segment = {
      color: [STATUS_COLORS.current, STATUS_COLORS.expiring, STATUS_COLORS.missing][index],
      dasharray: `${length} ${Math.max(0, circumference - length)}`,
      dashoffset: -offset,
    };
    offset += length;
    return segment;
  });

  return (
    <svg
      className="legacy-donut"
      role="img"
      aria-label={`Aprobado: ${values[0]}; Por Vencer: ${values[1]}; No Registrados: ${values[2]}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {total === 0 && (
        <circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke="#e9ecef" strokeWidth={strokeWidth} />
      )}
      {segments.map((segment) => (
        <circle
          key={segment.color}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={segment.color}
          strokeDasharray={segment.dasharray}
          strokeDashoffset={segment.dashoffset}
          strokeLinecap="butt"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  );
}

function ComplianceBar({ current, expiring, required }) {
  const percentage = compliancePercent(current, expiring, required);
  return (
    <div className="legacy-compliance-track" aria-hidden="true">
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
}

function Metric({ icon, iconClass, label, value }) {
  return (
    <div className="legacy-dashboard-metric">
      <div className="legacy-dashboard-metric-copy">
        <strong>{number(value).toLocaleString("es-HN")}</strong>
        <span>{label}</span>
      </div>
      <span className={`legacy-dashboard-metric-icon ${iconClass}`}>{icon}</span>
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
      <div className="legacy-subcategory-name">{item.name}</div>
      <ComplianceBar current={current} expiring={expiring} required={total} />
      <DonutChart current={current} expiring={expiring} missing={missing} size={126} strokeWidth={26} />
      <div className="legacy-subcategory-total">Total Documentos: {registered.toLocaleString("es-HN")}</div>
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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

  async function exportDashboard() {
    setExporting(true);
    await exportRowsToXlsx({
      fileName: "Dashboard General.xlsx",
      sheetName: "Documentos por Estado",
      columns: [
        { title: "Sucursal", key: "branchName", width: 28 },
        { title: "Referencia", key: "reference", width: 22 },
        { title: "Descripción", key: "description", width: 42 },
        { title: "Categoría", key: "categoryName", width: 24 },
        { title: "Subcategoría", key: "subcategoryName", width: 28 },
        { title: "Fecha de Contrato", key: "documentDate", width: 20 },
        { title: "Fecha Vencimiento", key: "expirationDate", width: 20 },
        { title: "Tiempo Vencimiento", key: "expirationTime", width: 22 },
        { title: "Estado", key: "statusName", width: 18 },
      ],
      rows: summary.documents || [],
    });
    setExporting(false);
  }

  return (
    <div className="legacy-dashboard-page">
      <div className="legacy-dashboard-title-row">
        <h1>Dashboard General</h1>
        <button
          type="button"
          aria-label="Descargar Excel"
          title="Descargar Excel"
          disabled={exporting}
          onClick={exportDashboard}
        >
          <FileExcelOutlined />
        </button>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <>
          <div className="legacy-dashboard-metrics">
            <Metric label="Documentos Requeridos" value={required} icon={<AuditOutlined />} iconClass="is-required" />
            <Metric label="Vigentes" value={current} icon={<FileTextFilled />} iconClass="is-current" />
            <Metric label="Por Vencer" value={expiring} icon={<HourglassOutlined />} iconClass="is-expiring" />
            <Metric label="Documentos Faltantes" value={missing} icon={<CloseCircleFilled />} iconClass="is-missing" />
          </div>

          <div className="legacy-dashboard-panels">
            <section className="legacy-status-panel">
              <div className="legacy-status-panel-head">
                <div>
                  <h2>Documentos por Estado</h2>
                  <ComplianceBar current={current} expiring={expiring} required={required} />
                </div>
                <div className="legacy-status-count">
                  <strong>{registered.toLocaleString("es-HN")}</strong>
                  <span>Documentos</span>
                </div>
              </div>
              <div className="legacy-status-chart">
                <DonutChart current={current} expiring={expiring} missing={missing} size={220} strokeWidth={49} />
              </div>
              <div className="legacy-status-legend">
                <span><i className="is-current" />Aprobado</span>
                <span><i className="is-expiring" />Por Vencer</span>
                <span><i className="is-missing" />No Registrados</span>
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

          <section className="legacy-dashboard-table">
            <h2>Documentos por Estado</h2>
            <Table
              rowKey={(record) => record.id || record.reference}
              columns={documentColumns}
              dataSource={summary.documents || []}
              pagination={false}
              locale={{ emptyText: "No hay registros..." }}
              scroll={{ x: 1300 }}
              size="small"
            />
          </section>
        </>
      )}
    </div>
  );
}
