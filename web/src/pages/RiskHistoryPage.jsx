import { FileExcelOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Select, Table, Tag } from "antd";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getRiskAnalyses, getRiskCatalogs } from "../services/riskService.js";
import { exportRowsToXlsx } from "../services/spreadsheetService.js";
import "../styles/risk.css";

const PAGE_SIZE = 50;

function compactScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "";
}

function statusColor(statusId) {
  return ({ 1: "green", 2: "default", 3: "red", 4: "orange" })[Number(statusId)] || "default";
}

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
  const [pagination, setPagination] = useState({ current: 1, pageSize: PAGE_SIZE, total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const sorting = useRef({ sortBy: "riskScore", sortDirection: "descend" });
  const sequence = useRef(0);

  async function load(values = {}, page = 1, pageSize = PAGE_SIZE) {
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
      setError(result.message || "No fue posible consultar los análisis de riesgo.");
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
    { title: "Cod Archivo", dataIndex: "codArchivo", key: "codArchivo", width: 125, sorter: true },
    { title: "País", dataIndex: "countryName", key: "countryName", width: 145, sorter: true },
    { title: "Sociedad", dataIndex: "societyName", key: "societyName", width: 330, sorter: true },
    { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: 220, sorter: true },
    {
      title: "Riesgo",
      dataIndex: "riskScore",
      key: "riskScore",
      width: 115,
      sorter: true,
      defaultSortOrder: "descend",
      render: (value) => <strong className={Number(value) >= 9 ? "legacy-risk-critical" : ""}>{compactScore(value)}</strong>,
    },
    { title: "Accuracy", dataIndex: "accuracyScore", key: "accuracyScore", width: 120, sorter: true, render: compactScore },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 135,
      sorter: true,
      render: (value, row) => <Tag color={statusColor(row.statusId)}>{value || ""}</Tag>,
    },
    {
      title: "",
      key: "detail",
      width: 60,
      align: "center",
      render: (_, row) => (
        <Link
          className="legacy-risk-detail-link"
          to={{ pathname: "/scrDetalleRiesgo", search: `?CodArchivo=${row.codArchivo}` }}
          aria-label={`Ver análisis ${row.codArchivo}`}
          title="Ver detalle"
        >
          <InfoCircleOutlined />
        </Link>
      ),
    },
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
      setError(result.message || "No fue posible generar el archivo de análisis de riesgo.");
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
        <Button
          type="text"
          className="legacy-risk-export"
          icon={<FileExcelOutlined />}
          loading={exporting}
          aria-label="Descargar Excel"
          title="Descargar Excel"
          onClick={exportAnalysis}
        />
      </div>

      <Form form={form} layout="vertical" className="legacy-risk-filters" onValuesChange={(_, values) => load(values)}>
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

      {error && <Alert className="legacy-risk-alert" type="error" showIcon message={error} />}

      <Table
        className="legacy-risk-table"
        rowKey="analysisId"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1250 }}
        locale={{ emptyText: "No hay registros..." }}
        pagination={{ ...pagination, showSizeChanger: false }}
        onChange={(nextPagination, _, sorter, extra) => {
          sorting.current = {
            sortBy: sorter.field || "riskScore",
            sortDirection: sorter.order || "descend",
          };
          load(
            form.getFieldsValue(),
            extra.action === "sort" ? 1 : nextPagination.current,
            nextPagination.pageSize,
          );
        }}
      />
    </div>
  );
}
