import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { Button, Descriptions, Drawer, Empty, List, Spin, Table, Tag, Tooltip, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import { getAgreement } from "../services/agreementService.js";
import { getCorporateClient } from "../services/corporateClientService.js";
import { downloadBlob } from "../services/fileHelpers.js";
import { downloadS3File } from "../services/tdS3Service.js";

const PREVIEWABLE_EXTENSIONS = new Set([".pdf", ".jpeg", ".jpg", ".png"]);

function agreementIdFromSearch(search) {
  const value = Number(new URLSearchParams(search).get("CodConvenio"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeExtension(extension, fileName = "") {
  const fromName = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const value = String(extension || fromName).trim().toLowerCase();
  return value && !value.startsWith(".") ? `.${value}` : value;
}

function dateAndTime(date, time) {
  return [date, time].filter(Boolean).join(" ");
}

function formatCreditLimit(agreement) {
  const amount = Number(agreement.creditLimit || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return agreement.isDollar ? `US $ ${amount}` : amount;
}

function promissoryNoteText(agreement) {
  if (agreement.hasPromissoryNote) {
    return `Sí tiene, vence el ${agreement.promissoryNoteExpirationDate || ""}`;
  }
  if (agreement.isPromissoryNoteExpired) {
    return `Esta Vencido desde ${agreement.promissoryNoteExpirationDate || ""}`;
  }
  return "No tiene";
}

function AttachmentIcon({ extension }) {
  if (extension === ".pdf") return <FilePdfOutlined />;
  if ([".jpeg", ".jpg", ".png"].includes(extension)) return <FileImageOutlined />;
  return <FileOutlined />;
}

function AttachmentPreview({ preview }) {
  if (!preview || preview.loading) {
    return <div className="legacy-agreement-preview-state"><Spin /></div>;
  }
  if (preview.error || !preview.url) {
    return <Empty description="No se pudo cargar el archivo." />;
  }
  if (preview.extension === ".pdf") {
    return <iframe className="legacy-agreement-preview-pdf" src={preview.url} title={preview.fileName} sandbox="" referrerPolicy="no-referrer" />;
  }
  return <img className="legacy-agreement-preview-image" src={preview.url} alt={preview.fileName} />;
}

const contactColumns = [
  { title: "Nombre", dataIndex: "name", key: "name" },
  { title: "Puesto", dataIndex: "position", key: "position" },
  { title: "Teléfono", dataIndex: "phone", key: "phone" },
  { title: "Correo", dataIndex: "email", key: "email" },
];

export function AgreementDetailPage() {
  const history = useHistory();
  const location = useLocation();
  const agreementId = useMemo(() => agreementIdFromSearch(location.search), [location.search]);
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [client, setClient] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRequest = useRef(0);

  useEffect(() => {
    let active = true;
    if (!agreementId) {
      setLoading(false);
      return () => { active = false; };
    }
    getAgreement(agreementId).then((result) => {
      if (!active) return;
      if (result.success) setAgreement(result.data);
      else message.error(result.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [agreementId]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  async function openClientDetails() {
    setClientDrawerOpen(true);
    setClientLoading(true);
    const result = await getCorporateClient(agreement.clientId);
    if (result.success) setClient(result.data);
    else {
      setClient(null);
      message.error(result.message);
    }
    setClientLoading(false);
  }

  async function downloadAttachment(attachment) {
    const result = await downloadS3File({ s3Key: attachment.s3Key });
    if (!result.success) {
      message.error(result.message);
      return;
    }
    downloadBlob(result.data, attachment.fileName || attachment.s3Key);
  }

  async function openAttachment(attachment) {
    const requestId = ++previewRequest.current;
    const extension = normalizeExtension(attachment.extension, attachment.fileName);
    setPreview({
      id: attachment.id,
      extension,
      fileName: attachment.fileName || "Archivo",
      loading: true,
      error: false,
      url: "",
    });
    const result = await downloadS3File({ s3Key: attachment.s3Key });
    if (requestId !== previewRequest.current) return;
    if (!result.success) {
      setPreview((current) => current?.id === attachment.id ? { ...current, loading: false, error: true } : current);
      message.error(result.message);
      return;
    }
    const url = URL.createObjectURL(result.data);
    setPreview((current) => current?.id === attachment.id ? { ...current, loading: false, url } : current);
  }

  function closePreview() {
    previewRequest.current += 1;
    setPreview(null);
  }

  if (loading) return <div className="legacy-detail-loading"><Spin /></div>;
  if (!agreement) return <Empty description="Convenio no encontrado" />;

  const createdAt = dateAndTime(agreement.createdDate, agreement.createdTime);
  const updatedAt = dateAndTime(agreement.updatedDate, agreement.updatedTime);

  return (
    <div className="legacy-detail-page">
      <div className="legacy-detail-toolbar">
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => history.push(ROUTES.agreements)}>Volver</Button>
        <Button type="link" icon={<EditOutlined />} onClick={() => history.push(`${ROUTES.agreementCreate}?CodConvenio=${agreement.id}`)}>Editar</Button>
      </div>
      <h1>Detalle Convenio</h1>
      <Descriptions bordered column={3} className="legacy-detail-descriptions">
        <Descriptions.Item label="Nombre del Cliente">
          <Button className="legacy-agreement-client-link" type="link" onClick={openClientDetails}>
            {agreement.clientName}
          </Button>
        </Descriptions.Item>
        <Descriptions.Item label="Fecha Inicial">{agreement.startDate}</Descriptions.Item>
        <Descriptions.Item label="Gestor de Cuenta">{agreement.accountManagerName}</Descriptions.Item>
        <Descriptions.Item label="Límite de Crédito">{formatCreditLimit(agreement)}</Descriptions.Item>
        <Descriptions.Item label="Fecha Final">{agreement.isIndefinite ? "Indefinido" : agreement.endDate}</Descriptions.Item>
        <Descriptions.Item label="Puesto del Gestor">{agreement.accountManagerPosition}</Descriptions.Item>
        <Descriptions.Item label="Días de Crédito">{agreement.creditDays}</Descriptions.Item>
        <Descriptions.Item label="¿Tiene Pagaré?">{promissoryNoteText(agreement)}</Descriptions.Item>
        <Descriptions.Item label="Sucursal/Departamento del Gestor">{agreement.accountManagerArea}</Descriptions.Item>
        <Descriptions.Item label="Observacíon" span={3}>{agreement.observation || ""}</Descriptions.Item>
      </Descriptions>

      <section className="legacy-detail-section">
        <h2>Sucursales que Facturan</h2>
        <div className="legacy-branch-tags">
          {(agreement.branchNames || []).map((branch) => <Tag key={branch}>{branch}</Tag>)}
          {!agreement.branchNames?.length ? <span>Centralizado</span> : null}
        </div>
      </section>

      <section className="legacy-detail-section">
        <h2>Adjuntos del Convenio</h2>
        <List
          className="legacy-agreement-attachments"
          locale={{ emptyText: "No hay adjuntos registrados." }}
          dataSource={agreement.attachments || []}
          renderItem={(attachment) => {
            const extension = normalizeExtension(attachment.extension, attachment.fileName);
            const actions = [];
            if (PREVIEWABLE_EXTENSIONS.has(extension)) {
              actions.push(
                <Tooltip key="preview" title="Ver Archivo">
                  <Button
                    type="text"
                    aria-label="Ver Archivo"
                    icon={<EyeOutlined />}
                    onClick={() => openAttachment(attachment)}
                  />
                </Tooltip>,
              );
            }
            actions.push(
              <Tooltip key="download" title="Descargar Archivo">
                <Button
                  type="text"
                  aria-label="Descargar Archivo"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadAttachment(attachment)}
                />
              </Tooltip>,
            );
            return (
              <List.Item actions={actions}>
                <List.Item.Meta
                  avatar={<AttachmentIcon extension={extension} />}
                  title={(
                    <div className="legacy-agreement-attachment-field">
                      <span>Nombre Archivo</span>
                      <strong>{attachment.fileName}</strong>
                    </div>
                  )}
                  description={(
                    <div className="legacy-agreement-attachment-field">
                      <span>Fecha Hora de Carga</span>
                      <strong>{dateAndTime(attachment.createdDate, attachment.createdTime)}</strong>
                    </div>
                  )}
                />
              </List.Item>
            );
          }}
        />
      </section>

      <div className="legacy-detail-created">
        Creado el: {createdAt} por: {agreement.createdByName || ""}
        {agreement.updatedByPersonId ? `/Actualizado el: ${updatedAt} por: ${agreement.updatedByName || ""}` : null}
      </div>

      <Drawer
        title="Visor de Archivos"
        placement="right"
        width="60%"
        open={Boolean(preview)}
        closable={false}
        onClose={closePreview}
        destroyOnHidden
      >
        <AttachmentPreview preview={preview} />
      </Drawer>

      <Drawer
        title={client?.name || agreement.clientName}
        placement="right"
        width="40%"
        open={clientDrawerOpen}
        closable={false}
        onClose={() => setClientDrawerOpen(false)}
      >
        {clientLoading ? (
          <div className="legacy-agreement-preview-state"><Spin /></div>
        ) : client ? (
          <div className="legacy-agreement-client-panel">
            <Descriptions column={1} colon={false} size="small">
              <Descriptions.Item label="Código FA">{client.faCode || ""}</Descriptions.Item>
              <Descriptions.Item label="Puesto del Contacto">{client.contactPosition || ""}</Descriptions.Item>
              <Descriptions.Item label="Corre del Contacto">{client.contactEmail || ""}</Descriptions.Item>
              <Descriptions.Item label="Contacto Principal">{client.contactName || ""}</Descriptions.Item>
              <Descriptions.Item label="Teléfono del Contacto">{client.contactPhone || ""}</Descriptions.Item>
            </Descriptions>
            <h3>Contactos adicionales</h3>
            <Table
              rowKey={(contact) => contact.id || `${contact.name}-${contact.email}`}
              columns={contactColumns}
              dataSource={client.allContacts || client.contacts || []}
              locale={{ emptyText: "No hay contactos adicionales." }}
              pagination={false}
              size="small"
              scroll={{ x: 560 }}
            />
          </div>
        ) : (
          <Empty description="No fue posible consultar el cliente." />
        )}
      </Drawer>
    </div>
  );
}
