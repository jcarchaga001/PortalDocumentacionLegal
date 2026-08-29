import { Drawer, Spin, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { getAgreement, getAgreementContacts } from "../services/agreementService.js";
import { downloadBlob } from "../services/fileHelpers.js";
import { downloadS3File } from "../services/tdS3Service.js";
import {
  AGREEMENT_DETAIL_QUERY_ERROR,
  agreementIdFromSearch,
  isLegacyAgreementPreviewable,
  legacyAgreementAuditText,
  legacyAgreementBranchLabel,
  legacyAgreementCreditLimit,
  legacyAgreementEndDate,
  legacyAgreementPromissoryText,
} from "./agreementDetailParity.js";
import "./AgreementDetailPage.css";

function dateAndTime(date, time) {
  return [date, time].filter(Boolean).join(" ");
}

function attachmentIconClass(extension) {
  const normalized = String(extension || "").toLowerCase();
  if (normalized === ".pdf") return "fa-file-pdf-o";
  if ([".jpeg", ".jpg", ".png"].includes(normalized)) return "fa-file-image-o";
  return "fa-file-o";
}

function Field({ label, children }) {
  return (
    <div className="legacy-agreement-detail__field">
      <span className="legacy-agreement-detail__label">{label}</span>
      <span className="legacy-agreement-detail__value">{children}</span>
    </div>
  );
}

function AttachmentPreview({ preview }) {
  if (!preview || preview.loading) {
    return <div className="legacy-agreement-preview-state"><Spin /></div>;
  }
  if (preview.error || !preview.url) {
    return <div className="legacy-agreement-preview-state" />;
  }
  if (preview.extension === ".pdf") {
    return <iframe className="legacy-agreement-preview-pdf" src={preview.url} title={preview.fileName} sandbox="" referrerPolicy="no-referrer" />;
  }
  return <img className="legacy-agreement-preview-image" src={preview.url} alt={preview.fileName} />;
}

export function AgreementDetailPage() {
  const history = useHistory();
  const location = useLocation();
  const agreementId = useMemo(() => agreementIdFromSearch(location.search), [location.search]);
  const [agreement, setAgreement] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const previewRequest = useRef(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setFeedback("");
      setAgreement(null);
      setClient(null);
      if (!agreementId) {
        setLoading(false);
        return;
      }
      const agreementResult = await getAgreement(agreementId);
      if (!active) return;
      if (!agreementResult.success) {
        setFeedback(AGREEMENT_DETAIL_QUERY_ERROR);
        setLoading(false);
        return;
      }
      setAgreement(agreementResult.data);
      const contactsResult = await getAgreementContacts(agreementId);
      if (!active) return;
      if (contactsResult.success) setClient(contactsResult.data);
      else setFeedback(AGREEMENT_DETAIL_QUERY_ERROR);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [agreementId]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  async function openAttachment(attachment) {
    const requestId = ++previewRequest.current;
    const extension = String(attachment.extension || "");
    setPreview({ id: attachment.id, extension, fileName: attachment.fileName || "", loading: true, error: false, url: "" });
    const result = await downloadS3File({ s3Key: attachment.s3Key });
    if (requestId !== previewRequest.current) return;
    if (!result.success) {
      setPreview((current) => current?.id === attachment.id ? { ...current, loading: false, error: true } : current);
      setFeedback(result.message || AGREEMENT_DETAIL_QUERY_ERROR);
      return;
    }
    const url = URL.createObjectURL(result.data);
    setPreview((current) => current?.id === attachment.id ? { ...current, loading: false, url } : current);
  }

  async function downloadAttachment(attachment) {
    setDownloadLoading(true);
    const result = await downloadS3File({ s3Key: attachment.s3Key });
    setDownloadLoading(false);
    if (!result.success) {
      setFeedback(result.message || AGREEMENT_DETAIL_QUERY_ERROR);
      return;
    }
    downloadBlob(result.data, attachment.fileName || attachment.s3Key);
  }

  function closePreview() {
    previewRequest.current += 1;
    setPreview(null);
  }

  if (loading) return <div className="legacy-agreement-detail__loading"><Spin /></div>;

  return (
    <div className="legacy-agreement-detail">
      <LegacyErrorFeedback message={feedback} />
      {agreement ? (
        <>
          <div className="legacy-agreement-detail__toolbar">
            <button className="legacy-agreement-detail__link" type="button" onClick={() => history.push(ROUTES.agreements)}>
              <i className="fa fa-chevron-left fa-1x" aria-hidden="true" />Volver
            </button>
            <button className="legacy-agreement-detail__link" type="button" onClick={() => history.push(`${ROUTES.agreementCreate}?CodConvenio=${agreement.id}`)}>
              <i className="fa fa-pencil-square-o fa-1x" aria-hidden="true" />Editar
            </button>
          </div>

          <section className="legacy-agreement-detail__card">
            <h1 className="legacy-agreement-detail__heading">Detalle Convenio</h1>
            <div className="legacy-agreement-detail__grid">
              <div className="legacy-agreement-detail__column">
                <Field label="Nombre del Cliente">
                  <button className="legacy-agreement-detail__link legacy-agreement-detail__client" type="button" onClick={() => setClientDrawerOpen(true)}>{agreement.clientName}</button>
                </Field>
                <Field label="Fecha Inicial">{agreement.startDate}</Field>
                <Field label="Gestor de Cuenta">{agreement.accountManagerName}</Field>
              </div>
              <div className="legacy-agreement-detail__column">
                <Field label="Límite de Crédito">{legacyAgreementCreditLimit(agreement)}</Field>
                <Field label="Fecha Final">{legacyAgreementEndDate(agreement)}</Field>
                <Field label="Puesto del Gestor">{agreement.accountManagerPosition}</Field>
              </div>
              <div className="legacy-agreement-detail__column">
                <Field label="Días de Crédito">{agreement.creditDays}</Field>
                <Field label="¿Tiene Pagaré?">{legacyAgreementPromissoryText(agreement)}</Field>
                <Field label="Sucursal/Departamento del Gestor">{agreement.accountManagerArea}</Field>
              </div>
              <div className="legacy-agreement-detail__column">
                <Field label="Observacíon">{agreement.observation || ""}</Field>
              </div>
            </div>
          </section>

          <section className="legacy-agreement-detail__card">
            <h2 className="legacy-agreement-detail__heading">Sucursales que Facturan</h2>
            <div className="legacy-agreement-detail__list">
              {(agreement.branchNames || []).map((branch) => (
                <div className="legacy-agreement-branch" key={branch}>
                  <div className="legacy-agreement-branch__card"><div className="legacy-agreement-branch__value">{legacyAgreementBranchLabel(branch)}</div></div>
                </div>
              ))}
            </div>
          </section>

          <section className="legacy-agreement-detail__card">
            <h2 className="legacy-agreement-detail__heading">Adjuntos del Convenio</h2>
            <div className="legacy-agreement-attachment-list">
              {(agreement.attachments || []).map((attachment) => (
                <article className="legacy-agreement-attachment" key={attachment.id}>
                  <div className="legacy-agreement-attachment__row">
                    <div className="legacy-agreement-attachment__type"><i className={`fa ${attachmentIconClass(attachment.extension)} fa-2x`} aria-hidden="true" /></div>
                    <div className="legacy-agreement-attachment__field legacy-agreement-attachment__field--name">
                      <span className="legacy-agreement-attachment__label">Nombre Archivo</span><span className="legacy-agreement-attachment__value">{attachment.fileName}</span>
                    </div>
                    <div className="legacy-agreement-attachment__field legacy-agreement-attachment__field--date">
                      <span className="legacy-agreement-attachment__label">Fecha Hora de Carga</span><span className="legacy-agreement-attachment__value">{dateAndTime(attachment.createdDate, attachment.createdTime)}</span>
                    </div>
                    <div className="legacy-agreement-attachment__actions">
                      {isLegacyAgreementPreviewable(attachment.extension) ? (
                        <Tooltip title="Ver" placement="top"><button className="legacy-agreement-detail__icon-link legacy-agreement-detail__icon-link--preview" type="button" aria-label="Ver" onClick={() => openAttachment(attachment)}><i className="fa fa-eye fa-2x" aria-hidden="true" /></button></Tooltip>
                      ) : null}
                      <Tooltip title="Descargar" placement="top"><button className="legacy-agreement-detail__icon-link" type="button" aria-label="Descargar" onClick={() => downloadAttachment(attachment)}><i className="fa fa-download fa-2x" aria-hidden="true" /></button></Tooltip>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="legacy-agreement-detail__audit">{legacyAgreementAuditText(agreement)}</div>

          <Drawer rootClassName="legacy-agreement-preview-drawer" title="Visor de Archivos" placement="right" width="60%" open={Boolean(preview)} closable={false} onClose={closePreview} destroyOnHidden>
            <AttachmentPreview preview={preview} />
          </Drawer>

          <Drawer rootClassName="legacy-agreement-client-drawer" title={client?.name || agreement.clientName} placement="right" width="40%" open={clientDrawerOpen} closable={false} onClose={() => setClientDrawerOpen(false)}>
            {client ? (
              <div className="legacy-agreement-client">
                <div className="legacy-agreement-client__grid">
                  <div className="legacy-agreement-client__field"><span className="legacy-agreement-client__label">Código FA</span><span className="legacy-agreement-client__value">{client.faCode || ""}</span></div>
                  <div className="legacy-agreement-client__field"><span className="legacy-agreement-client__label">Puesto del Contacto</span><span className="legacy-agreement-client__value">{client.contactPosition || "No tiene"}</span></div>
                  <div className="legacy-agreement-client__field"><span className="legacy-agreement-client__label">Corre del Contacto</span><span className="legacy-agreement-client__value">{client.contactEmail || "No tiene"}</span></div>
                  <div className="legacy-agreement-client__field"><span className="legacy-agreement-client__label">Contacto Principal</span><span className="legacy-agreement-client__value">{client.contactName || ""}</span></div>
                  <div className="legacy-agreement-client__field"><span className="legacy-agreement-client__label">Teléfono</span><span className="legacy-agreement-client__value">{client.contactPhone || ""}</span></div>
                </div>
                <section className="legacy-agreement-client__contacts">
                  <h3>Contactos adicionales</h3>
                  <table className="legacy-agreement-client__table">
                    <thead><tr><th>Nombre</th><th>Puesto</th><th>Teléfono</th><th>Correo</th></tr></thead>
                    <tbody>{(client.contacts || []).map((contact, index) => <tr key={contact.id || `contact-${index}`}><td>{contact.name || ""}</td><td>{contact.position || ""}</td><td>{contact.phone || ""}</td><td>{contact.email || ""}</td></tr>)}</tbody>
                  </table>
                </section>
              </div>
            ) : null}
          </Drawer>
        </>
      ) : null}
      {downloadLoading ? <div className="legacy-agreement-download-mask"><Spin /></div> : null}
    </div>
  );
}
