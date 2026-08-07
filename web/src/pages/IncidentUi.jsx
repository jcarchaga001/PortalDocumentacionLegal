import {
  CaretRightOutlined,
  FileExcelOutlined,
  FolderOpenOutlined,
  PauseOutlined,
  StarOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, Select, Tag } from "antd";
import { LegacyDateRangePicker } from "../components/LegacyDateRangePicker.jsx";
import "../styles/incidents.css";
export { localIsoDate, localMonthStartIso } from "../utils/dateRange.js";

export function options(items) {
  return (items || []).map((item) => ({ value: item.id, label: item.name }));
}

export function StatusTag({ id, name }) {
  const colors = { 1: "blue", 2: "orange", 4: "gold", 5: "green", 6: "red", 7: "red", 8: "gold", 10: "purple" };
  return <Tag color={colors[Number(id)] || "default"}>{name || "—"}</Tag>;
}

export function DateRangeField({
  label,
  name,
  maxDate,
  placeholder = "Seleccione un rango de fechas",
}) {
  return (
    <Form.Item label={label} name={name} className="legacy-incident-date-field">
      <LegacyDateRangePicker
        maxDate={maxDate}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </Form.Item>
  );
}

const metricDefinitions = [
  { key: "open", label: "Abiertos", icon: <FolderOpenOutlined />, className: "is-open" },
  { key: "inProgress", label: "En Ejecución", icon: <CaretRightOutlined />, className: "is-progress" },
  { key: "paused", label: "En Pausa", icon: <PauseOutlined />, className: "is-paused" },
  { key: "closed", label: "Cerrados", icon: <StarOutlined />, className: "is-closed" },
];

export function IncidentMetrics({ metrics = {}, labor = false }) {
  const definitions = labor ? metricDefinitions.filter((item) => item.key !== "paused") : metricDefinitions;
  return (
    <div className={`legacy-incident-metrics ${labor ? "has-three" : ""}`}>
      {definitions.map((item) => (
        <div className="legacy-incident-metric" key={item.key}>
          <span className={`legacy-incident-metric-icon ${item.className}`}>{item.icon}</span>
          <div>
            <span>{item.label}</span>
            <strong>{Number(metrics[item.key] || 0).toLocaleString("es-HN")}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadCsv(fileName, columns, rows) {
  const header = columns.map((column) => escapeCsv(column.title)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column.key])).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", header, "\r\n", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ onClick, loading = false }) {
  return (
    <Button
      type="text"
      className="legacy-incident-export"
      icon={<FileExcelOutlined />}
      aria-label="Descargar Excel"
      title="Descargar Excel"
      loading={loading}
      onClick={onClick}
    />
  );
}

export function SelectFilter({ label, name, items, placeholder }) {
  return (
    <Form.Item label={label} name={name}>
      <Select allowClear showSearch optionFilterProp="label" placeholder={placeholder} options={options(items)} />
    </Form.Item>
  );
}
