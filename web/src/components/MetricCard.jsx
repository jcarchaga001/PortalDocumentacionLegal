import { Card, Typography } from "antd";

export function MetricCard({ label, value, detail }) {
  return (
    <Card className="metric-card" bordered={false}>
      <Typography.Text className="metric-label">{label}</Typography.Text>
      <div className="metric-value">{value}</div>
      <Typography.Text type="secondary">{detail}</Typography.Text>
    </Card>
  );
}

