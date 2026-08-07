import { CheckOutlined, StopOutlined } from "@ant-design/icons";
import { Button } from "antd";

export function isTrue(value) {
  return value === true || value === 1 || value === "1";
}

export function LegacyBoolean({ value }) {
  const enabled = isTrue(value);
  return (
    <span className={`legacy-catalog-boolean ${enabled ? "is-enabled" : "is-disabled"}`} aria-label={enabled ? "Sí" : "No"}>
      {enabled ? <CheckOutlined /> : <StopOutlined />}
    </span>
  );
}

export function LegacyAccessButton({ value, loading, onClick, label }) {
  const enabled = isTrue(value);
  return (
    <Button
      type="text"
      className={`legacy-catalog-access ${enabled ? "is-enabled" : "is-disabled"}`}
      loading={loading}
      icon={enabled ? <CheckOutlined /> : <StopOutlined />}
      aria-label={`${label}: ${enabled ? "permitido" : "no permitido"}. Cambiar acceso`}
      title="Cambiar acceso"
      onClick={onClick}
    />
  );
}

export function options(items) {
  return (items || []).map((item) => ({ value: Number(item.id), label: item.name }));
}
