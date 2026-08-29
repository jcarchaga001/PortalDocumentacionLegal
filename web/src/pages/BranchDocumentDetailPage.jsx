import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Dropdown,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Spin,
  Upload,
  message,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../config/AuthContext.jsx";
import {
  readLegacySelectedBranchId,
} from "../config/legacyDocumentContext.js";
import { runtimeConfig } from "../config/runtime.js";
import { LEGACY_FEEDBACK_CONTRACTS, showLegacyFeedback } from "../config/legacyFeedbackContracts.js";
import { getBranchMonitoring } from "../services/dashboardService.js";
import {
  addBookEvidence,
  createBranchDocument,
  deleteDocument,
  getBookEvidence,
  getBookEvidencePreviewUrl,
  getBranchBookCatalog,
  getBranchDocumentDetail,
  getDocumentAttachment,
  getDocumentAttachmentPreviewUrl,
  getDocumentCatalogs,
} from "../services/documentService.js";
import { blobToDataUrl, downloadBlob, fileToBase64 } from "../services/fileHelpers.js";
import {
  attachmentPreviewKind,
  attachmentPreviewMimeType,
  attachmentPreviewMode,
  bookIndicator,
  buildBranchDocumentSummary,
  canDeleteBranchDocument,
  canManageLegacyBookEvidence,
  currentBookEvidences,
  documentIndicator,
  getDocumentStatusTone,
  legacyGoogleViewerUrl,
  legacyBookList,
  mergeLegacyBookCatalog,
  matchesLegacyDocumentSearch,
} from "./branchDocumentDetailParity.js";
import "./BranchDocumentDetailPage.css";

const EMPTY_MATCHES = (
  <div className="branch-detail-empty-list">
    <div>We couldn´t find any matches.</div>
    <div>Try adjusting your search.</div>
  </div>
);

function branchPictureSource(branch) {
  if (branch?.image?.fileBase64) {
    const extension = String(branch.image.extension || "png").replace(/^\./, "").toLowerCase();
    const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
    return `data:${mime};base64,${branch.image.fileBase64}`;
  }
  return `${runtimeConfig.basePath}/brand/branch-detail/fondoFA.png`;
}

function LegacyIndicator({ kind }) {
  if (kind === "registered") {
    return <i className="fa fa-check branch-selector-status is-registered" aria-label="Registrado" />;
  }
  if (kind === "pending") {
    return <i className="fa fa-exclamation branch-selector-status is-pending" aria-label="Pendiente" />;
  }
  if (kind === "expired") {
    return <span className="branch-selector-status is-expired">Vencido</span>;
  }
  return <span />;
}

function InlinePreview({ preview, emptyText = "No existe el archivo..." }) {
  if (preview?.loading) return <div className="branch-viewer-message"><Spin /></div>;
  if (preview?.error) return <div className="branch-viewer-message">{preview.error}</div>;
  if (!preview?.url) return <div className="branch-viewer-message">{emptyText}</div>;

  const kind = preview.mode || attachmentPreviewKind(preview.extension);
  if (kind === "image") {
    return <img className="branch-inline-image" src={preview.url} alt={preview.fileName || "Documento"} />;
  }
  if (kind === "pdf") {
    return (
      <div className="branch-inline-pdf-container">
        <embed className="branch-inline-pdf" src={preview.url} type="application/pdf" />
      </div>
    );
  }
  if (kind === "s3" || kind === "s3-uninitialized") {
    return <iframe className="branch-inline-s3" src={preview.url} title="" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="branch-inline-google-container">
      <iframe
        className="branch-inline-google"
        src={legacyGoogleViewerUrl(preview.url)}
        title=""
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function ComplianceDonut({ percent }) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <svg className="branch-compliance-donut" viewBox="0 0 165 165" role="img" aria-label={`Registradas ${safePercent}%`}>
      <circle cx="82.5" cy="82.5" r="67.5" pathLength="100" className="branch-donut-trail" />
      <circle
        cx="82.5"
        cy="82.5"
        r="67.5"
        pathLength="100"
        className="branch-donut-value"
        stroke={safePercent === 100 ? "#37b24d" : "#dc3545"}
        strokeDasharray={`${safePercent} ${100 - safePercent}`}
      />
    </svg>
  );
}

function MenuIcon({ type }) {
  return type === "add"
    ? <i className="fa fa-plus-square branch-menu-icon is-add" aria-hidden="true" />
    : <i className="fa fa-trash branch-menu-icon is-delete" aria-hidden="true" />;
}

export function BranchDocumentDetailPage() {
  const { user } = useAuth();
  const branchId = readLegacySelectedBranchId();
  const canDeleteDocument = canDeleteBranchDocument(user?.positionCode);
  const canDownloadBookEvidence = canManageLegacyBookEvidence(user?.positionCode);
  const [detail, setDetail] = useState(null);
  const [catalogs, setCatalogs] = useState({ providers: [], categories: [], subcategories: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("documents");
  const [documentSearch, setDocumentSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(1);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [documentDrawer, setDocumentDrawer] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generatingRequest, setGeneratingRequest] = useState(false);
  const [documentForm] = Form.useForm();
  const [evidenceForm] = Form.useForm();
  const [documentPreview, setDocumentPreview] = useState(null);
  const [bookPreview, setBookPreview] = useState(null);
  const [monitoringSummary, setMonitoringSummary] = useState(null);
  const documentPreviewRequest = useRef(0);
  const bookPreviewRequest = useRef(0);

  async function load({ isCurrent = () => true } = {}) {
    if (!branchId) {
      if (isCurrent()) setLoading(false);
      return;
    }
    if (isCurrent()) setLoading(true);
    const [detailResult, catalogResult, monitoringResult] = await Promise.all([
      getBranchDocumentDetail(branchId),
      getDocumentCatalogs(1),
      getBranchMonitoring({ branchId }),
    ]);
    if (!isCurrent()) return;
    if (detailResult.success) setDetail(detailResult.data);
    else message.error(detailResult.message);
    if (catalogResult.success) setCatalogs((current) => ({ ...current, ...catalogResult.data }));
    if (monitoringResult.success) setMonitoringSummary(monitoringResult.data?.[0] || null);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    setSelectedSubcategoryId(1);
    setSelectedBookId(null);
    setDocumentPreview(null);
    setBookPreview(null);
    setMonitoringSummary(null);
    load({ isCurrent: () => active });
    return () => {
      active = false;
    };
  }, [branchId]);

  useEffect(() => {
    if (!detail || Number(detail.branch?.id) !== Number(branchId)) return;
    const initialEntry = (detail.documents || []).find((entry) => Number(entry.subcategoryId) === 1);
    if (!initialEntry) return;
    if (initialEntry.document?.attachment?.hasS3) {
      // The legacy calls its S3 producer with an empty Client.CODS3 on first load,
      // exposing the bucket root. Preserve its empty 1500px frame without
      // reproducing that unsafe cross-document listing.
      setDocumentPreview({
        url: "about:blank",
        fileName: initialEntry.document.attachment.fileName || "Documento",
        extension: initialEntry.document.attachment.extension || "",
        mode: "s3-uninitialized",
      });
      return;
    }
    void selectDocument(initialEntry);
  }, [detail, branchId]);

  useEffect(() => () => {
    if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url);
  }, [documentPreview?.url]);

  useEffect(() => () => {
    if (bookPreview?.url) URL.revokeObjectURL(bookPreview.url);
  }, [bookPreview?.url]);

  const options = (items) => (items || []).map((item) => ({ value: item.id, label: item.name }));
  const filteredDocuments = (detail?.documents || []).filter((entry) => matchesLegacyDocumentSearch(entry, documentSearch));
  // SearchKeywordLibro exists but GetLibros never consumes it in the legacy model.
  const filteredBooks = legacyBookList(detail?.books);
  const selectedDocumentEntry = (detail?.documents || []).find((entry) => entry.subcategoryId === selectedSubcategoryId);
  const selectedBook = (detail?.books || []).find((book) => book.assignmentId === selectedBookId);
  const selectedBookEvidence = currentBookEvidences(selectedBook)[0];
  const summary = monitoringSummary || buildBranchDocumentSummary(detail?.documents);

  function openDocumentForm(entry) {
    setSelectedEntry(entry);
    documentForm.setFieldsValue({
      level: undefined,
      categoryId: entry.categoryId,
      subcategoryId: entry.subcategoryId,
      isReferential: false,
      isActivePrincipal: true,
      attachment: [],
    });
    setDocumentDrawer(true);
  }

  async function submitDocument(values) {
    const file = values.attachment?.[0]?.originFileObj;
    setSaving(true);
    setGeneratingRequest(true);
    try {
      const result = await createBranchDocument(branchId, {
        ...values,
        categoryId: selectedEntry.categoryId,
        subcategoryId: selectedEntry.subcategoryId,
        documentDate: values.documentDate?.format("YYYY-MM-DD"),
        expirationDate: values.expirationDate?.format("YYYY-MM-DD"),
        attachment: file ? {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileBase64: await fileToBase64(file),
        } : null,
      });
      if (!result.success) {
        message.error(result.message);
        if (result.error?.field) documentForm.setFields([{ name: result.error.field, errors: [result.message] }]);
        return;
      }
      message.success("Registro exitoso");
      setDocumentDrawer(false);
      documentForm.resetFields();
      await load();
    } catch {
      message.error("No se puede leer archivo (Archivo con errores)");
    } finally {
      setSaving(false);
      setGeneratingRequest(false);
    }
  }

  function confirmDocumentDelete(entry) {
    if (!entry.document) {
      showLegacyFeedback(message, LEGACY_FEEDBACK_CONTRACTS.missingFileToDelete);
      return;
    }
    Modal.confirm({
      title: `Confirma que desea eliminar el documento ${entry.document.reference || ""}`,
      okText: "Aceptar",
      cancelText: "Cancelar",
      okButtonProps: { danger: true },
      async onOk() {
        const result = await deleteDocument(entry.document.id);
        if (!result.success) throw new Error(result.message);
        message.success("Registro eliminado exitosamente");
        setDocumentPreview(null);
        await load();
      },
    });
  }

  async function selectDocument(entry) {
    setSelectedSubcategoryId(entry.subcategoryId);
    const requestId = ++documentPreviewRequest.current;
    if (!entry.document?.hasAttachment) {
      setDocumentPreview(null);
      return;
    }
    setDocumentPreview({ loading: true });
    const result = await getDocumentAttachment(entry.document.id);
    if (requestId !== documentPreviewRequest.current) return;
    if (!result.success) {
      setDocumentPreview({ error: result.message || "No existe el archivo..." });
      return;
    }
    const attachment = entry.document.attachment || {};
    const extension = attachment.extension || "";
    const mode = attachmentPreviewMode(attachment);
    setDocumentPreview({
      url: mode === "google"
        ? getDocumentAttachmentPreviewUrl(entry.document.id)
        : await blobToDataUrl(result.data, attachmentPreviewMimeType(extension)),
      fileName: attachment.fileName || "Documento",
      extension,
      mode,
    });
  }

  function openEvidence(book) {
    setSelectedAssignment(book);
    evidenceForm.resetFields();
    setEvidenceModal(true);
  }

  async function submitEvidence(values) {
    const file = values.attachment?.[0]?.originFileObj;
    setSaving(true);
    try {
      const result = await addBookEvidence(branchId, selectedAssignment.assignmentId, file ? {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileBase64: await fileToBase64(file),
      } : null);
      if (!result.success) {
        message.error(result.message);
        return;
      }
      // AceptarAgregarOnClick closes the popup and refreshes GetLibros only.
      // GetTblRegistroLibros remains stale until another selection/reload.
      setEvidenceModal(false);
      evidenceForm.resetFields();
      const booksResult = await getBranchBookCatalog(branchId);
      if (booksResult.success) {
        setDetail((current) => mergeLegacyBookCatalog(current, booksResult.data));
      } else {
        message.error(booksResult.message);
      }
    } catch {
      message.error("No se puede leer archivo (Archivo con errores)");
    } finally {
      setSaving(false);
    }
  }

  async function loadBookPreview(book) {
    setSelectedBookId(book.assignmentId);
    const requestId = ++bookPreviewRequest.current;
    const evidence = currentBookEvidences(book)[0];
    if (!evidence) {
      setBookPreview(null);
      return;
    }
    setBookPreview({ loading: true });
    const result = await getBookEvidence(branchId, evidence.id);
    if (requestId !== bookPreviewRequest.current) return;
    if (!result.success) {
      setBookPreview({ error: result.message || "No existe el archivo..." });
      return;
    }
    const extension = evidence.extension || "";
    const kind = attachmentPreviewKind(extension);
    setBookPreview({
      url: kind === "google"
        ? getBookEvidencePreviewUrl(branchId, evidence.id)
        : await blobToDataUrl(result.data, attachmentPreviewMimeType(extension)),
      fileName: evidence.fileName || "Documento",
      extension,
      mode: kind,
    });
  }

  async function downloadEvidence(evidence) {
    const result = await getBookEvidence(branchId, evidence.id, true);
    if (!result.success) {
      message.error(result.message);
      return;
    }
    downloadBlob(result.data, evidence.fileName || `evidencia.${evidence.extension}`);
  }

  function openLegacyEvidenceDeletePopup(book) {
    // Safe deviation: both legacy delete popups call AceptarOnClick and can
    // soft-delete the selected document even when the user chose a book
    // evidence. Keep that destructive cross-action disabled until explicitly
    // authorized against disposable data.
    Modal.confirm({
      title: `Confirma que desea eliminar la evidencia de libro ${book.name}`,
      okText: "Aceptar",
      cancelText: "Cancelar",
      okButtonProps: { danger: true },
    });
  }

  if (loading) return <div className="legacy-document-loading"><Spin /></div>;
  if (!branchId || !detail) return <div className="legacy-document-empty-file">La sucursal seleccionada no existe.</div>;

  const documentTab = (
    <div className="branch-detail-workspace" id="branch-documents-panel" role="tabpanel" aria-labelledby="branch-documents-tab">
      <section className="branch-selector-card" aria-label="Documentos">
        <div className="branch-selector-heading"><div className="branch-selector-title"><i className="fa fa-folder-open fa-2x" aria-hidden="true" /><span>Documentos</span></div></div>
        <Input
          className="branch-selector-search"
          prefix={<i className="fa fa-search" aria-hidden="true" />}
          value={documentSearch}
          onChange={(event) => setDocumentSearch(event.target.value)}
          placeholder="Buscar Documentos"
        />
        <div className="branch-selector-list">
          {filteredDocuments.length ? filteredDocuments.map((entry) => {
            const isSelected = selectedSubcategoryId === entry.subcategoryId;
            const menuItems = [{
              type: "group",
              label: "Opciones del Archivo",
              children: [
                { key: "add", icon: <MenuIcon type="add" />, label: "Agregar Documento" },
                ...(canDeleteDocument ? [{ key: "delete", icon: <MenuIcon type="delete" />, label: "Eliminar Archivo", danger: true }] : []),
              ],
            }];
            return (
              <div className="branch-selector-item" key={entry.subcategoryId}>
                <div className="branch-selector-main">
                  <span className="branch-selector-lock">{entry.isRequired ? <i className="fa fa-lock" aria-label="Obligatorio" /> : null}</span>
                  <span className="branch-selector-button-cell">
                    <button
                      type="button"
                      className={`branch-selector-button${isSelected ? " is-selected" : ""}`}
                      onClick={() => selectDocument(entry)}
                    ><span className="branch-selector-button-copy"><span>{entry.subcategoryName}</span></span></button>
                  </span>
                  <span className="branch-selector-status-cell"><LegacyIndicator kind={documentIndicator(entry)} /></span>
                </div>
                {isSelected ? (
                  <span className="branch-selector-options">
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: menuItems,
                        onClick: ({ key, domEvent }) => {
                          domEvent.stopPropagation();
                          if (key === "add") openDocumentForm(entry);
                          else confirmDocumentDelete(entry);
                        },
                      }}
                    >
                      <button type="button" aria-label="Opciones del Archivo" onClick={(event) => event.stopPropagation()}><i className="fa fa-ellipsis-v" aria-hidden="true" /></button>
                    </Dropdown>
                  </span>
                ) : null}
              </div>
            );
          }) : EMPTY_MATCHES}
        </div>
      </section>
      <section className="branch-document-viewer" aria-label="Vista previa del documento">
        <InlinePreview preview={documentPreview} />
      </section>
    </div>
  );

  const booksTab = (
    <div className="branch-detail-workspace" id="branch-books-panel" role="tabpanel" aria-labelledby="branch-books-tab">
      <section className="branch-selector-card" aria-label="Libros">
        <div className="branch-selector-heading"><div className="branch-selector-title"><i className="fa fa-folder-open fa-2x" aria-hidden="true" /><span>Libros</span></div></div>
        <Input
          className="branch-selector-search"
          prefix={<i className="fa fa-search" aria-hidden="true" />}
          value={bookSearch}
          onChange={(event) => setBookSearch(event.target.value)}
          placeholder="Buscar Libros"
        />
        <div className="branch-selector-list">
          {filteredBooks.length ? filteredBooks.map((book) => {
            const isSelected = selectedBookId === book.assignmentId;
            const menuItems = [{
              type: "group",
              label: "Opciones del Archivo",
              children: [
                { key: "add", icon: <MenuIcon type="add" />, label: "Agregar Evidencia" },
                ...(canDeleteDocument ? [{ key: "delete", icon: <MenuIcon type="delete" />, label: "Eliminar Evidencia", danger: true }] : []),
              ],
            }];
            return (
              <div className="branch-selector-item" key={book.assignmentId}>
                <div className="branch-selector-main">
                  <span className="branch-selector-lock">{book.isRequired ? <i className="fa fa-lock" aria-label="Obligatorio" /> : null}</span>
                  <span className="branch-selector-button-cell">
                    <button
                      type="button"
                      className={`branch-selector-button${isSelected ? " is-selected" : ""}`}
                      onClick={() => loadBookPreview(book)}
                    ><span className="branch-selector-button-copy"><span>{book.name}</span></span></button>
                  </span>
                  <span className="branch-selector-status-cell">
                    {selectedSubcategoryId ? <LegacyIndicator kind={bookIndicator(book)} /> : null}
                  </span>
                </div>
                {selectedSubcategoryId ? (
                  <span className="branch-selector-options">
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: menuItems,
                        onClick: ({ key, domEvent }) => {
                          domEvent.stopPropagation();
                          if (key === "add") openEvidence(book);
                          else openLegacyEvidenceDeletePopup(book);
                        },
                      }}
                    >
                      <button type="button" aria-label="Opciones del Archivo" onClick={(event) => event.stopPropagation()}><i className="fa fa-ellipsis-v" aria-hidden="true" /></button>
                    </Dropdown>
                  </span>
                ) : null}
              </div>
            );
          }) : EMPTY_MATCHES}
        </div>
      </section>
      <section className="branch-document-viewer branch-book-viewer" aria-label="Vista previa de evidencia">
        {selectedBookEvidence && canDownloadBookEvidence ? (
          <button className="branch-book-download" type="button" onClick={() => downloadEvidence(selectedBookEvidence)}>
            {selectedBookEvidence.fileName} <span>(Descargar Archivo...)</span>
          </button>
        ) : null}
        {selectedBookEvidence ? (
          <div className="branch-book-identifiers" aria-hidden="true"><span>{selectedBook.assignmentId}</span><span>{selectedBook.bookId}</span></div>
        ) : null}
        <InlinePreview preview={bookPreview} emptyText={selectedBook ? "No existe el archivo..." : "Seleccione un libro..."} />
      </section>
    </div>
  );

  const selectedDocument = selectedDocumentEntry?.document;

  return (
    <main className="branch-detail-legacy">
      <h1>Detalle Documentación Legal</h1>
      <div className="branch-detail-hero">
        <section className="branch-identity-card">
          <div className="branch-photo-column"><img src={branchPictureSource(detail.branch)} alt={detail.branch.name || "Sucursal"} /></div>
          <div className="branch-information-column">
            <div className="branch-title-row">
              <img src={`${runtimeConfig.basePath}/brand/branch-detail/logoFarmaciaAhorro.jpg`} alt="Farmacias del Ahorro" />
              <strong>{detail.branch.code} - {detail.branch.name}</strong>
            </div>
            <div className="branch-contact-content">
              <div className="branch-contact-field"><label>Gerente de Farmacia</label><span><i className="fa fa-user" aria-hidden="true" /> {detail.branch.pharmacyManagerName || ""}</span></div>
              <div className="branch-contact-field"><label>Gerente de Área</label><span><i className="fa fa-user-secret" aria-hidden="true" /> {detail.branch.areaManagerName || ""}</span></div>
              <div className="branch-contact-field"><label>Email</label><span><i className="fa fa-envelope" aria-hidden="true" /> {detail.branch.pharmacyManagerEmail || ""}</span></div>
              <div className="branch-information-separator" />
              <div className="branch-document-heading">Información de Documento</div>
              {selectedDocument ? (
                <div className="branch-selected-document">
                  <h2>{selectedDocumentEntry.subcategoryName}</h2>
                  <div className="branch-selected-reference-row">
                    <span>{selectedDocument.reference || ""}</span>
                    <span className={`branch-status-tag is-${getDocumentStatusTone(selectedDocument)}`}>{selectedDocument.statusName || ""}</span>
                  </div>
                  <div className="branch-selected-description">{selectedDocument.description || ""}</div>
                  <div className="branch-selected-dates">
                    <span><i className="fa fa-calendar-check-o" aria-hidden="true" /> {selectedDocument.documentDate || ""}</span>
                    <span><i className="fa fa-calendar-times-o" aria-hidden="true" /> {selectedDocument.expirationDate || ""}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
        <aside className="branch-summary-card" aria-label="Resumen de documentación requerida">
          <ComplianceDonut percent={summary.registeredPercent} />
          <div className="branch-summary-percent is-registered">Registradas: {summary.registeredPercent}%</div>
          <div className="branch-summary-percent is-expiring">Por Vencer: {summary.expiringPercent}%</div>
          <div className="branch-summary-data">
            <div className="branch-summary-data-title">Documentación Requerida</div>
            <div>Requeridas: {summary.required}</div>
            <div>Registradas: {summary.registered}</div>
            <div>Documentación por Vencer: {summary.expiring}</div>
            <div>Otos Documentos: {summary.other}</div>
          </div>
        </aside>
      </div>

      <div className="branch-tabs">
        <div className="branch-tabs-header" role="tablist" aria-label="Documentación de sucursal">
          <button id="branch-documents-tab" type="button" role="tab" aria-selected={activeTab === "documents"} aria-controls="branch-documents-panel" className={activeTab === "documents" ? "is-active" : ""} onClick={() => setActiveTab("documents")}>Documentos Legales</button>
          <button id="branch-books-tab" type="button" role="tab" aria-selected={activeTab === "books"} aria-controls="branch-books-panel" className={activeTab === "books" ? "is-active" : ""} onClick={() => setActiveTab("books")}>Libros</button>
        </div>
        {activeTab === "documents" ? documentTab : booksTab}
      </div>

      <Drawer title="Agregar Documento" open={documentDrawer} width="50%" onClose={() => setDocumentDrawer(false)} destroyOnClose>
        <Form form={documentForm} layout="vertical" className="legacy-create-form legacy-branch-document-form" onFinish={submitDocument}>
          <h2>Ingrese Información:</h2>
          <Form.Item label="Nivel Documento" name="level">
            <Radio.Group>
              <Radio.Button value={1}>Público</Radio.Button><Radio.Button value={2}>Privado</Radio.Button><Radio.Button value={3}>Restringido</Radio.Button><Radio.Button value={4}>Confidencial</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <div className="legacy-create-grid">
            <Form.Item label="Descripción Contrato" name="description" rules={[{ required: true, message: "Ingrese una descripción." }]}><Input maxLength={20} /></Form.Item>
            <Form.Item label="Proveedor" name="providerId"><Select allowClear showSearch optionFilterProp="label" placeholder="Seleccionar..." options={options(catalogs.providers)} /></Form.Item>
            <Form.Item label="Categoría" name="categoryId"><Select disabled options={options(catalogs.categories)} /></Form.Item>
            <Form.Item label="Subcategoría" name="subcategoryId"><Select disabled options={options(catalogs.subcategories)} /></Form.Item>
            <Form.Item label="Fecha de Documento" name="documentDate" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item>
            <Form.Item label="Fecha de vencimiento" name="expirationDate" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item>
            <Form.Item name="isReferential" valuePropName="checked"><Checkbox>Es Referencial</Checkbox></Form.Item>
            <Form.Item name="isActivePrincipal" valuePropName="checked"><Checkbox>Activo Principal</Checkbox></Form.Item>
            <Form.Item label="Referencia 2" name="secondaryReference"><Input maxLength={516} /></Form.Item>
          </div>
          <Form.Item className="legacy-create-upload" name="attachment" valuePropName="fileList" getValueFromEvent={(event) => Array.isArray(event) ? event : event?.fileList} rules={[{ required: true, message: "Adjunte el archivo." }]}>
            <Upload beforeUpload={() => false} maxCount={1}><Button>Adjunte Archivo</Button></Upload>
          </Form.Item>
          <div className="legacy-create-actions"><Button onClick={() => setDocumentDrawer(false)}>Cancelar</Button><Button type="primary" htmlType="submit" loading={saving}>Registrar</Button></div>
        </Form>
      </Drawer>

      <Modal title="Agregue la evidencia" open={evidenceModal} onCancel={() => setEvidenceModal(false)} footer={null} destroyOnClose>
        <Form form={evidenceForm} layout="vertical" onFinish={submitEvidence}>
          <Form.Item name="attachment" valuePropName="fileList" getValueFromEvent={(event) => Array.isArray(event) ? event : event?.fileList}>
            <Upload beforeUpload={() => false} maxCount={1}><Button>Adjunte Archivo</Button></Upload>
          </Form.Item>
          <div className="legacy-create-actions"><Button onClick={() => setEvidenceModal(false)}>Cancelar</Button><Button type="primary" htmlType="submit" loading={saving}>Aceptar</Button></div>
        </Form>
      </Modal>

      {generatingRequest ? <div className="branch-request-loading" role="status"><Spin /><span>Generando Solicitud...</span></div> : null}
    </main>
  );
}
