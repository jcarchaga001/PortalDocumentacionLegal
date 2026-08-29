import { Form, Select } from "antd";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { getRiskAnalyses, getRiskCatalogs } from "../services/riskService.js";
import { exportRowsToXlsx } from "../services/spreadsheetService.js";
import {
  compactRiskScore,
  legacyRiskCounter,
  legacyRiskStatusTone,
  nextLegacyRiskSort,
  RISK_PAGE_SIZE,
  RISK_QUERY_ERROR,
} from "./riskParity.js";
import "../styles/risk.css";

function filterQuery(values, sorting = {}) {
  return {
    societyId: values.societyId,
    riskScore: values.riskScore,
    accuracyScore: values.accuracyScore,
    statusId: values.statusId,
    sortBy: sorting.sortBy,
    sortDirection: sorting.sortDirection,
  };
}

export function RiskHistoryPage() {
  const [form] = Form.useForm();
  const [catalogs, setCatalogs] = useState({ societies: [], statuses: [], riskScores: [], accuracyScores: [] });
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: RISK_PAGE_SIZE, total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const sorting = useRef({ sortBy: "riskScore", sortDirection: "DESC" });
  const sequence = useRef(0);

  async function load(values = {}, page = 1, pageSize = RISK_PAGE_SIZE) {
    const requestId = ++sequence.current;
    setLoading(true);
    const result = await getRiskAnalyses({ ...filterQuery(values, sorting.current), page, pageSize });
    if (requestId !== sequence.current) return;
    if (result.success) {
      setRows(result.data?.items || []);
      setPagination({
        current: result.data?.page || page,
        pageSize: result.data?.pageSize || pageSize,
        total: result.data?.total || 0,
      });
      setError("");
    } else {
      setError(RISK_QUERY_ERROR);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    getRiskCatalogs().then((result) => {
      if (active && result.success) setCatalogs(result.data || {});
    });
    load();
    return () => {
      active = false;
      sequence.current += 1;
    };
  }, []);

  const columns = [
    { title: "Cod Archivo", key: "codArchivo", align: "right" },
    { title: "País", key: "countryName", align: "right" },
    { title: "Sociedad", key: "societyName" },
    { title: "Sucursal", key: "branchName" },
    { title: "Riesgo", key: "riskScore", align: "center" },
    { title: "Accuracy", key: "accuracyScore" },
    { title: "Estado", key: "statusName", align: "center" },
  ];

  async function exportAnalysis() {
    setExporting(true);
    const result = await getRiskAnalyses({
      ...filterQuery(form.getFieldsValue(), sorting.current),
      page: 1,
      pageSize: 500,
    });
    if (result.success) {
      await exportRowsToXlsx({
        fileName: "Analisis_riesgo.xlsx",
        sheetName: "Análisis de riesgo",
        columns: [
          { title: "Cod Archivo", key: "codArchivo", width: 16 },
          { title: "País", key: "countryName", width: 18 },
          { title: "Sociedad", key: "societyName", width: 42 },
          { title: "Sucursal", key: "branchName", width: 24 },
          { title: "Riesgo", key: "riskScore", width: 13 },
          { title: "Accuracy", key: "accuracyScore", width: 13 },
          { title: "Estado", key: "statusName", width: 18 },
        ],
        rows: result.data?.items || [],
      });
      setError("");
    } else {
      setError(RISK_QUERY_ERROR);
    }
    setExporting(false);
  }

  const simpleOptions = (items) => (items || []).map((item) => ({ value: Number(item.id), label: item.name }));
  const riskOptions = (catalogs.riskScores || []).map((item) => ({
    value: Number(item.value),
    label: `${item.value} - ${item.description}`,
  }));
  const accuracyOptions = (catalogs.accuracyScores || []).map((item) => ({ value: Number(item.value), label: String(item.value) }));

  return (
    <div className="legacy-risk-page">
      <div className="legacy-risk-title-row">
        <h1>Análisis Contratos</h1>
        <a
          href="#"
          className={`legacy-risk-export${exporting ? " is-loading" : ""}`}
          aria-label="Descargar Excel"
          title="Descargar Reporte Excel"
          aria-busy={exporting}
          onClick={(event) => {
            event.preventDefault();
            if (!exporting) exportAnalysis();
          }}
        >
          <i className="fa fa-file-excel-o fa-2x" aria-hidden="true" />
        </a>
      </div>

      <Form
        form={form}
        layout="vertical"
        className="legacy-risk-filters"
        onValuesChange={(_, values) => load(values, pagination.current, pagination.pageSize)}
      >
        <Form.Item name="societyId" label="Sociedad">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione..." options={simpleOptions(catalogs.societies)} />
        </Form.Item>
        <Form.Item name="riskScore" label="Riesgo">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione..." options={riskOptions} />
        </Form.Item>
        <Form.Item name="accuracyScore" label="Accuracy">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione..." options={accuracyOptions} />
        </Form.Item>
        <Form.Item name="statusId" label="Estado">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccione..." options={simpleOptions(catalogs.statuses)} />
        </Form.Item>
      </Form>

      <LegacyErrorFeedback message={error} />

      <div className={`legacy-risk-table-shell${loading ? " is-loading" : ""}`}>
        <table className="legacy-risk-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  tabIndex="0"
                  className={column.align ? `is-${column.align}` : ""}
                  onClick={() => {
                    sorting.current = nextLegacyRiskSort(sorting.current, column.key);
                    load(form.getFieldsValue(), 1, pagination.pageSize);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.click();
                    }
                  }}
                >
                  {column.title}
                  <i className="fa fa-sort legacy-risk-sort-icon" aria-hidden="true" />
                </th>
              ))}
              <th aria-label="Detalle" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.analysisId}>
                <td className="is-right">{row.codArchivo}</td>
                <td className="is-right">{row.countryName || ""}</td>
                <td>{row.societyName || ""}</td>
                <td>{row.branchName || ""}</td>
                <td className="is-center">
                  <span className={Number(row.riskScore) >= 9 ? "legacy-risk-critical" : ""}>
                    {compactRiskScore(row.riskScore)}
                  </span>
                </td>
                <td>{compactRiskScore(row.accuracyScore)}</td>
                <td className="is-center">
                  <span className={`legacy-risk-status is-${legacyRiskStatusTone(row.statusName)}`}>
                    {row.statusName || ""}
                  </span>
                </td>
                <td>
                  <Link
                    className="legacy-risk-detail-link"
                    to={{ pathname: "/scrDetalleRiesgo", search: `?CodArchivo=${row.codArchivo}` }}
                    aria-label={`Ver análisis ${row.codArchivo}`}
                    title="Ver detalle"
                  >
                    <i className="fa fa-info-circle fa-2x" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? <div className="legacy-risk-empty">No hay registros...</div> : null}
      </div>

      <div className="legacy-risk-table-footer">
        <span>{legacyRiskCounter(pagination.current, pagination.pageSize, pagination.total)}</span>
        <nav className="legacy-risk-pagination" aria-label="Pagination">
          <button
            type="button"
            aria-label="go to previous page"
            disabled={pagination.current <= 1}
            onClick={() => load(form.getFieldsValue(), pagination.current - 1, pagination.pageSize)}
          >
            <i className="fa fa-angle-left" aria-hidden="true" />
          </button>
          {Array.from({ length: Math.ceil(pagination.total / pagination.pageSize) }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              aria-label={page === pagination.current ? `page ${page}` : `go to page ${page}`}
              aria-current={page === pagination.current ? "true" : "false"}
              className={page === pagination.current ? "is-active" : ""}
              onClick={() => load(form.getFieldsValue(), page, pagination.pageSize)}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            aria-label="go to next page"
            disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
            onClick={() => load(form.getFieldsValue(), pagination.current + 1, pagination.pageSize)}
          >
            <i className="fa fa-angle-right" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
