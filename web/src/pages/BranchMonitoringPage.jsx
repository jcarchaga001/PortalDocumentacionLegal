import { Form, Select, Spin, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { writeLegacySelectedBranchId } from "../config/legacyDocumentContext.js";
import { ROUTES } from "../routes/routePaths.js";
import { getBranchMonitoring, getBranchMonitoringCatalogs } from "../services/dashboardService.js";
import {
  branchMonitoringMetrics,
  BRANCH_MONITORING_TOOLTIPS,
  monitoringQueryErrorMessage,
  monitoringCatalogOptions,
  updateMonitoringFilter,
} from "./branchMonitoringParity.js";
import "./BranchMonitoringPage.css";

const DONUT_SIZE = 165;
const DONUT_RADIUS = 67;
const DONUT_CENTER = DONUT_SIZE / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function MonitoringDonut({ branch }) {
  const metrics = branchMonitoringMetrics(branch);
  const progressLength = DONUT_CIRCUMFERENCE * (metrics.registeredRawPercent / 100);

  return (
    <div className="legacy-monitoring-donut">
      <svg
        viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        role="progressbar"
        aria-label={`Documentación registrada de ${branch.code}`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={metrics.registeredAriaValue}
      >
        <circle
          className="legacy-monitoring-donut-trail"
          cx={DONUT_CENTER}
          cy={DONUT_CENTER}
          r={DONUT_RADIUS}
        />
        {progressLength > 0 && (
          <circle
            className="legacy-monitoring-donut-progress"
            cx={DONUT_CENTER}
            cy={DONUT_CENTER}
            r={DONUT_RADIUS}
            stroke={metrics.progressColor}
            strokeDasharray={`${progressLength} ${DONUT_CIRCUMFERENCE}`}
            transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}
          />
        )}
      </svg>
    </div>
  );
}

function MonitoringSummaryLine({ title, children, className = "" }) {
  return (
    <Tooltip title={title} placement="top">
      <div
        className={`legacy-monitoring-summary-line ${className}`.trim()}
        role="button"
        tabIndex="0"
      >
        {children}
      </div>
    </Tooltip>
  );
}

function MonitoringCard({ branch, onOpen }) {
  const metrics = branchMonitoringMetrics(branch);

  function openFromKeyboard(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(branch.id);
    }
  }

  return (
    <div className="legacy-monitoring-card list-item">
      <div className="legacy-monitoring-card-content">
        <div className="legacy-monitoring-card-header">
          <label className="legacy-monitoring-code-label"><span className="legacy-monitoring-branch-code">{branch.code}</span></label>
          <span className="legacy-monitoring-branch-name">{branch.name}</span>
        </div>

        <div
          className="legacy-monitoring-chart"
          role="button"
          tabIndex="0"
          onClick={() => onOpen(branch.id)}
          onKeyDown={openFromKeyboard}
          aria-label={`Abrir documentación de ${branch.code} ${branch.name}`}
        >
          <MonitoringDonut branch={branch} />
        </div>

        <div className="legacy-monitoring-percentages">
          <div className="legacy-monitoring-registered">Registradas: {metrics.registeredText}</div>
          <div className="legacy-monitoring-expiring">Por Vencer: {metrics.expiringText}</div>
        </div>

        <div className="legacy-monitoring-summary">
          <div className="legacy-monitoring-summary-title"><span>Documentación Requerida</span></div>
          <MonitoringSummaryLine title={BRANCH_MONITORING_TOOLTIPS.required}>
            Requeridas: {metrics.required}
          </MonitoringSummaryLine>
          <MonitoringSummaryLine title={BRANCH_MONITORING_TOOLTIPS.registered}>
            Registradas: {metrics.registered}
          </MonitoringSummaryLine>
          <MonitoringSummaryLine
            title={BRANCH_MONITORING_TOOLTIPS.expiring}
            className="legacy-monitoring-summary-expiring"
          >
            Documentación por Vencer: {metrics.expiring}
          </MonitoringSummaryLine>
          <MonitoringSummaryLine title={BRANCH_MONITORING_TOOLTIPS.other}>
            Otos Documentos: {metrics.other}
          </MonitoringSummaryLine>
        </div>
      </div>
    </div>
  );
}

export function BranchMonitoringPage() {
  const history = useHistory();
  const [filters, setFilters] = useState({});
  const [catalogs, setCatalogs] = useState({ managers: [], branches: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getBranchMonitoringCatalogs().then((result) => {
      if (!active) return;
      if (result.success) setCatalogs(result.data || {});
      else setError(monitoringQueryErrorMessage());
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getBranchMonitoring(filters).then((result) => {
      if (!active) return;
      if (result.success) setRows(result.data || []);
      else setError(monitoringQueryErrorMessage(result.message));
      setLoading(false);
    });
    return () => { active = false; };
  }, [filters]);

  const managerOptions = useMemo(
    () => monitoringCatalogOptions(catalogs.managers),
    [catalogs.managers],
  );
  const branchOptions = useMemo(
    () => monitoringCatalogOptions(catalogs.branches),
    [catalogs.branches],
  );

  function openBranch(branchId) {
    writeLegacySelectedBranchId(branchId);
    history.push(ROUTES.branchDocumentDetail);
  }

  return (
    <div className="legacy-monitoring-page">
      <Form layout="vertical" className="legacy-monitoring-filters columns columns3">
        <Form.Item label="Nombre GA">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Selecione..."
            value={filters.managerId}
            options={managerOptions}
            onChange={(managerId) => setFilters((current) => updateMonitoringFilter(current, "managerId", managerId))}
          />
        </Form.Item>
        <Form.Item label="Sucursal">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Selecione..."
            options={branchOptions}
            value={filters.branchId}
            onChange={(branchId) => setFilters((current) => updateMonitoringFilter(current, "branchId", branchId))}
          />
        </Form.Item>
      </Form>

      <LegacyErrorFeedback key={`${filters.managerId || ""}-${filters.branchId || ""}`} message={error} />
      {loading ? <div className="legacy-monitoring-loading"><Spin size="large" /></div> : (
        <div className="legacy-monitoring-grid list list-group">
          {rows.map((branch) => (
            <MonitoringCard key={branch.id} branch={branch} onOpen={openBranch} />
          ))}
        </div>
      )}
    </div>
  );
}
