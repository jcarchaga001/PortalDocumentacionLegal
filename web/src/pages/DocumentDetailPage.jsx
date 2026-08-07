import { Button, Checkbox, Input, Spin, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import {
  approveDocument,
  getDocument,
  getDocumentAttachment,
  rejectDocument,
  updateDocumentReference2,
} from "../services/documentService.js";

function documentIdFromSearch(search) {
  const query = new URLSearchParams(search);
  const value = [query.get("IdRegistro"), query.get("CodDocumento")]
    .map(Number)
    .find((candidate) => Number.isInteger(candidate) && candidate > 0);
  return value || null;
}

function dateValue(value, referential) {
  if (referential) return "N/A";
  return value || "";
}

function AttachmentPreview({ document, objectUrl, error, loading }) {
  if (!document?.hasAttachment) return <div className="legacy-document-empty-file">No existe el archivo...</div>;
  if (loading) return <div className="legacy-document-loading"><Spin size="small" /></div>;
  if (error || !objectUrl) return <div className="legacy-document-empty-file">No se puede leer archivo</div>;
  const extension = document.attachment?.extension?.toLowerCase();
  if (["jpg", "jpeg", "png", "bmp"].includes(extension)) {
    return <img className="legacy-document-image" src={objectUrl} alt={document.attachment?.fileName || "Documento"} />;
  }
  if (extension === "pdf") {
    return <iframe className="legacy-document-pdf" src={objectUrl} title={document.attachment?.fileName || "Documento"} sandbox="" referrerPolicy="no-referrer" />;
  }
  return <div className="legacy-document-empty-file">No se puede leer archivo</div>;
}

export function DocumentDetailPage() {
  const history = useHistory();
  const location = useLocation();
  const documentId = useMemo(() => documentIdFromSearch(location.search), [location.search]);
  const [document, setDocument] = useState(null);
  const [secondaryReference, setSecondaryReference] = useState("");
  const [objectUrl, setObjectUrl] = useState("");
  const [fileError, setFileError] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let currentObjectUrl = "";
    async function load() {
      if (!documentId) {
        setLoading(false);
        return;
      }
      const result = await getDocument(documentId);
      if (!active) return;
      if (!result.success) {
        message.error(result.message);
        setLoading(false);
        return;
      }
      setDocument(result.data);
      setSecondaryReference(result.data?.secondaryReference || "");
      setLoading(false);
      if (result.data?.hasAttachment) {
        setAttachmentLoading(true);
        const attachmentResult = await getDocumentAttachment(documentId);
        if (!active) return;
        if (attachmentResult.success) {
          currentObjectUrl = URL.createObjectURL(attachmentResult.data);
          setObjectUrl(currentObjectUrl);
        } else {
          setFileError(true);
        }
        setAttachmentLoading(false);
      }
    }
    load();
    return () => {
      active = false;
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [documentId]);

  async function updateReference() {
    setSaving(true);
    const result = await updateDocumentReference2(documentId, secondaryReference);
    setSaving(false);
    if (result.success) {
      setDocument(result.data);
      message.success(result.message);
    } else {
      message.error(result.message);
    }
  }

  async function changeStatus(action) {
    const result = await action(documentId);
    if (!result.success) {
      message.error(result.message);
      return;
    }
    message.success(result.message);
    history.push(ROUTES.documentHistory);
  }

  if (loading) return <div className="legacy-document-loading"><Spin /></div>;
  if (!documentId || !document) {
    return <div className="legacy-document-empty-file">El documento solicitado no existe.</div>;
  }

  return (
    <div className="legacy-document-detail-page">
      <h1>Registro de Documento</h1>
      <div className="legacy-document-branch">{document.branchCode} - {document.branchName?.replace(/^\S+\s+/, "")}</div>
      <div className="legacy-document-card">
        <div className="legacy-document-heading">
          <h2>Documento N°: {document.reference}</h2>
          <span className={`legacy-document-status status-${document.statusId}`}>{document.statusName}</span>
        </div>

        <div className="legacy-document-fields">
          <div><label>Proveedor</label><span>{document.providerName || ""}</span></div>
          <div><label>Número Contrato</label><span>{document.description || ""}</span></div>
          <div><label>Nivel Documento</label><span>{document.levelName || ""}</span></div>
          <div><label>Categoría</label><span>{document.categoryName || ""}</span></div>
          <div><label>Subcategoría</label><span>{document.subcategoryName || ""}</span></div>
          <div><label>Fecha de Documento</label><span>{dateValue(document.documentDate, document.isReferential)}</span></div>
          <div><label>Fecha de Vencimiento</label><span>{dateValue(document.expirationDate, document.isReferential)}</span></div>
          <div className="legacy-document-checkbox"><Checkbox checked={document.isReferential} disabled /> <span>Es Referencial</span></div>
          <div>
            <label>Referencia 2</label>
            <Input value={secondaryReference} maxLength={516} onChange={(event) => setSecondaryReference(event.target.value)} />
          </div>
        </div>

        <div className="legacy-document-preview">
          {objectUrl && document.attachment?.fileName ? (
            <a className="legacy-document-file-name" href={objectUrl} download={document.attachment.fileName}>
              {document.attachment.fileName}
            </a>
          ) : null}
          <AttachmentPreview
            document={document}
            objectUrl={objectUrl}
            error={fileError}
            loading={attachmentLoading}
          />
        </div>

        <div className="legacy-document-actions">
          {document.statusId === 1 ? (
            <>
              <Button danger onClick={() => changeStatus(rejectDocument)}>Rechazar</Button>
              <Button type="primary" onClick={() => changeStatus(approveDocument)}>Aprobar</Button>
            </>
          ) : null}
          <Button type="primary" loading={saving} onClick={updateReference}>Actualizar</Button>
        </div>
      </div>
    </div>
  );
}

export { documentIdFromSearch };
