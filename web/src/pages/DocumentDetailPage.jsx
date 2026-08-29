import { Button, Checkbox, Input, Modal, Spin, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { ROUTES } from "../routes/routePaths.js";
import { runtimeConfig } from "../config/runtime.js";
import {
  readLegacySelectedDocumentId,
  writeLegacySelectedDocumentId,
} from "../config/legacyDocumentContext.js";
import {
  approveDocument,
  getDocument,
  getDocumentAttachment,
  rejectDocument,
  updateDocumentReference2,
} from "../services/documentService.js";
import {
  documentDetailActions,
  documentIdFromSearch,
  documentLevelTone,
  documentStatusTone,
  legacyDocumentDateInputValue,
  isLegacyDocumentApprovalValid,
} from "./documentDetailParity.js";

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
  const queryDocumentId = useMemo(() => documentIdFromSearch(location.search), [location.search]);
  const documentId = queryDocumentId || readLegacySelectedDocumentId() || null;
  const [document, setDocument] = useState(null);
  const [providerName, setProviderName] = useState("");
  const [secondaryReference, setSecondaryReference] = useState("");
  const [objectUrl, setObjectUrl] = useState("");
  const [fileError, setFileError] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approvalValidationAttempted, setApprovalValidationAttempted] = useState(false);

  useEffect(() => {
    if (queryDocumentId) writeLegacySelectedDocumentId(queryDocumentId);
  }, [queryDocumentId]);

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
      setProviderName(result.data?.providerName || "");
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

  function approveCurrentDocument() {
    setApprovalValidationAttempted(true);
    if (!isLegacyDocumentApprovalValid(secondaryReference)) return;
    void changeStatus((id) => approveDocument(id, secondaryReference));
  }

  if (loading) return <div className="legacy-document-loading"><Spin /></div>;
  if (!documentId || !document) {
    return <div className="legacy-document-empty-file">El documento solicitado no existe.</div>;
  }

  const actions = documentDetailActions(document.statusId);

  return (
    <div className="legacy-document-detail-page">
      <h1>Registro de Documento</h1>
      <div className="legacy-document-card">
        <div className="legacy-document-branch">
          <img
            src={`${runtimeConfig.basePath}/brand/branch-detail/logoFarmaciaAhorro.jpg`}
            alt="FA"
          />
          <strong>{document.branchCode} - {document.branchName?.replace(/^\S+\s+/, "")}</strong>
        </div>

        <div className="legacy-document-form-card">
          <div className="legacy-document-heading">
            <h2>Documento N°: {document.reference}</h2>
            <span className={`legacy-document-status ${documentStatusTone(document.statusId)}`}>{document.statusName}</span>
          </div>

          <div className="legacy-document-fields">
            <div className="legacy-document-provider">
              <label>Proveedor</label>
              <Input value={providerName} maxLength={512} onChange={(event) => setProviderName(event.target.value)} />
            </div>
            <div>
              <label>Número Contrato <em>*</em></label>
              <Input value={document.description || ""} maxLength={20} disabled />
            </div>
            <div>
              <label>Nivel Documento</label>
              <span className={`legacy-document-level ${documentLevelTone(document.levelName)}`}>{document.levelName || ""}</span>
            </div>
            <div>
              <label>Categoría</label>
              <Input value={document.categoryName || ""} maxLength={128} disabled />
            </div>
            <div>
              <label>Subcategoría</label>
              <Input value={document.subcategoryName || ""} maxLength={128} disabled />
            </div>
            <div>
              <label>Fecha de Documento <em>*</em></label>
              <Input type="date" value={legacyDocumentDateInputValue(document.documentDate)} disabled />
            </div>
            <div>
              <label>Fecha de Vencimiento <em>*</em></label>
              <Input type="date" value={legacyDocumentDateInputValue(document.expirationDate)} disabled />
            </div>
            <label className="legacy-document-checkbox">
              <Checkbox checked={document.isReferential} disabled />
              <span>Es Referencial</span>
            </label>
            <div>
              <label>Referencia 2</label>
              <Input
                value={secondaryReference}
                maxLength={516}
                status={approvalValidationAttempted && !isLegacyDocumentApprovalValid(secondaryReference) ? "error" : undefined}
                aria-invalid={approvalValidationAttempted && !isLegacyDocumentApprovalValid(secondaryReference)}
                onChange={(event) => setSecondaryReference(event.target.value)}
              />
            </div>
          </div>

          <div className="legacy-document-preview">
            <AttachmentPreview
              document={document}
              objectUrl={objectUrl}
              error={fileError}
              loading={attachmentLoading}
            />
          </div>
        </div>

        <div className="legacy-document-actions">
          {actions.includes("reject") ? <Button className="legacy-document-reject" onClick={() => changeStatus(rejectDocument)}>Rechazar</Button> : null}
          {actions.includes("approve") ? <Button className="legacy-document-approve" onClick={approveCurrentDocument}>Aprobar</Button> : null}
          {actions.includes("update") ? <Button type="primary" onClick={updateReference}>Actualizar</Button> : null}
        </div>
      </div>
      <Modal
        className="legacy-document-loading-modal"
        open={saving}
        closable={false}
        footer={null}
        centered
        maskClosable={false}
        keyboard={false}
      >
        <h3>Favor Espere...</h3>
        <div className="legacy-document-loading-modal-content">
          <Spin size="large" />
          <span>Generando Solicitud...</span>
        </div>
      </Modal>
    </div>
  );
}

export { documentIdFromSearch } from "./documentDetailParity.js";
