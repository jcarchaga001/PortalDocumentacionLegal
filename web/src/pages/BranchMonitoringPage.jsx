import { Alert, Form, Progress, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import { getBranchMonitoring, getBranchMonitoringCatalogs } from "../services/dashboardService.js";

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
      if (active && result.success) setCatalogs(result.data || {});
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
      else setError(result.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [filters]);

  const branchOptions = useMemo(
    () => (catalogs.branches || [])
      .filter((branch) => !filters.managerId || Number(branch.managerId) === Number(filters.managerId))
      .map((branch) => ({ value: branch.id, label: branch.name })),
    [catalogs.branches, filters.managerId],
  );

  return (
    <div className="legacy-monitoring-page">
      <Form layout="vertical" className="legacy-monitoring-filters">
        <Form.Item label="Nombre GA">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Selecione..."
            options={(catalogs.managers || []).map((item) => ({ value: item.id, label: item.name }))}
            onChange={(managerId) => setFilters({ managerId, branchId: undefined })}
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
            onChange={(branchId) => setFilters((current) => ({ ...current, branchId }))}
          />
        </Form.Item>
      </Form>

      {error ? <Alert type="error" showIcon message={error} /> : null}
      {loading ? <div className="legacy-monitoring-loading"><Spin size="large" /></div> : (
        <div className="legacy-monitoring-grid">
          {rows.map((branch) => (
            <button
              type="button"
              className="legacy-monitoring-card"
              key={branch.id}
              onClick={() => history.push(`${ROUTES.branchDocumentDetail}?SucursalSelected=${branch.id}`)}
            >
              <strong>{branch.code}</strong>
              <span className="legacy-monitoring-branch-name">{branch.name}</span>
              <Progress
                percent={branch.registeredPercent}
                showInfo={false}
                strokeColor="#5cb85c"
                trailColor="#ededed"
                strokeLinecap="square"
              />
              <span>Registradas: {branch.registeredPercent}%</span>
              <span>Por Vencer: {branch.expiringPercent}%</span>
              <h2>Documentación Requerida</h2>
              <div className="legacy-monitoring-counts">
                <i>Requeridas: {branch.required}</i>
                <i>Registradas: {branch.registered}</i>
                <i>Documentación por Vencer: {branch.expiring}</i>
                <i>Otos Documentos: {branch.other}</i>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
