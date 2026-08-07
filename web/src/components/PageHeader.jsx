import { Typography } from "antd";

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="page-header">
      <div className="page-heading-copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <Typography.Title level={1}>{title}</Typography.Title>
        {description ? <Typography.Paragraph>{description}</Typography.Paragraph> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}

