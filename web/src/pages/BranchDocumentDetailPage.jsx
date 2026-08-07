import {
  DeleteOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  PlusSquareOutlined,
} from "@ant-design/icons";
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Radio,
  Select,
  Spin,
  Tabs,
  Upload,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import {
  addBookEvidence,
  createBranchDocument,
  deleteBookEvidence,
  deleteDocument,
  getBookEvidence,
  getBranchDocumentDetail,
  getDocumentAttachment,
  getDocumentCatalogs,
  updateBookRequired,
} from "../services/documentService.js";
import { downloadBlob, fileToBase64 } from "../services/fileHelpers.js";

function branchIdFromSearch(search) {
  const value = Number(new URLSearchParams(search).get("SucursalSelected"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function searchMatch(value, search) {
  return String(value || "").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"));
}

function PreviewContent({ extension, url, fileName }) {
  if (!url) return <div className="legacy-document-empty-file">No existe el archivo...</div>;
  if (["jpg", "jpeg", "png", "bmp"].includes(extension?.toLowerCase())) {
    return <img className="legacy-document-image" src={url} alt={fileName} />;
  }
  if (extension?.toLowerCase() === "pdf") {
    return <iframe className="legacy-document-pdf" src={url} title={fileName} sandbox="" referrerPolicy="no-referrer" />;
  }
  return <div className="legacy-document-empty-file">No se puede leer archivo (Archivo con errores)</div>;
}

export function BranchDocumentDetailPage() {
  const location = useLocation();
  const { user } = useAuth();
  const branchId = useMemo(() => branchIdFromSearch(location.search), [location.search]);
  const canDelete = [7, 32].includes(Number(user?.positionCode));
  const [detail, setDetail] = useState(null);
  const [catalogs, setCatalogs] = useState({ providers: [], categories: [], subcategories: [] });
  const [loading, setLoading] = useState(true);
  const [documentSearch, setDocumentSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [documentDrawer, setDocumentDrawer] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [documentForm] = Form.useForm();
  const [evidenceForm] = Form.useForm();
  const isReferential = Form.useWatch("isReferential", documentForm);
  const [preview, setPreview] = useState(null);

  async function load() {
    if (!branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [detailResult, catalogResult] = await Promise.all([
      getBranchDocumentDetail(branchId),
      getDocumentCatalogs(1),
    ]);
    if (detailResult.success) {
      setDetail(detailResult.data);
      if (!selectedBookId && detailResult.data?.books?.length) {
        setSelectedBookId(detailResult.data.books[0].assignmentId);
      }
    } else {
      message.error(detailResult.message);
    }
    if (catalogResult.success) setCatalogs((current) => ({ ...current, ...catalogResult.data }));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [branchId]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const options = (items) => (items || []).map((item) => ({ value: item.id, label: item.name }));
  const filteredDocuments = (detail?.documents || []).filter((entry) => (
    !documentSearch
    || searchMatch(entry.categoryName, documentSearch)
    || searchMatch(entry.subcategoryName, documentSearch)
    || searchMatch(entry.document?.reference, documentSearch)
  ));
  const filteredBooks = (detail?.books || []).filter((book) => !bookSearch || searchMatch(book.name, bookSearch));
  const selectedBook = (detail?.books || []).find((book) => book.assignmentId === selectedBookId);

  function openDocumentForm(entry) {
    setSelectedEntry(entry);
    documentForm.setFieldsValue({
      level: 1,
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
    try {
      const result = await createBranchDocument(branchId, {
        ...values,
        categoryId: selectedEntry.categoryId,
        subcategoryId: selectedEntry.subcategoryId,
        documentDate: values.documentDate?.format("YYYY-MM-DD"),
        expirationDate: values.expirationDate?.format("YYYY-MM-DD"),
        attachment: file
          ? {
              fileName: file.name,
              contentType: file.type || "application/octet-stream",
              fileBase64: await fileToBase64(file),
            }
          : null,
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
    }
  }

  function confirmDocumentDelete(entry) {
    Modal.confirm({
      title: `Confirma que desea eliminar el documento ${entry.document?.reference || ""}`,
      okText: "Aceptar",
      cancelText: "Cancelar",
      okButtonProps: { danger: true },
      async onOk() {
        const result = await deleteDocument(entry.document.id);
        if (!result.success) throw new Error(result.message);
        message.success("Registro eliminado exitosamente");
        await load();
      },
    });
  }

  async function openDocumentPreview(document) {
    const result = await getDocumentAttachment(document.id);
    if (!result.success) {
      message.error(result.message);
      return;
    }
    setPreview({
      url: URL.createObjectURL(result.data),
      fileName: document.attachment?.fileName || "Documento",
      extension: document.attachment?.extension || "",
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
      const result = await addBookEvidence(branchId, selectedAssignment.assignmentId, file
        ? {
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            fileBase64: await fileToBase64(file),
          }
        : null);
      if (!result.success) {
        message.error(result.message);
        return;
      }
      message.success("Registro exitoso");
      setEvidenceModal(false);
      await load();
    } catch {
      message.error("No se puede leer archivo (Archivo con errores)");
    } finally {
      setSaving(false);
    }
  }

  async function downloadEvidence(evidence) {
    const result = await getBookEvidence(branchId, evidence.id);
    if (!result.success) {
      message.error(result.message);
      return;
    }
    downloadBlob(result.data, evidence.fileName || `evidencia.${evidence.extension}`);
  }

  function confirmEvidenceDelete(book, evidence) {
    Modal.confirm({
      title: `Confirma que desea eliminar la evidencia de libro ${book.name}`,
      okText: "Aceptar",
      cancelText: "Cancelar",
      okButtonProps: { danger: true },
      async onOk() {
        const result = await deleteBookEvidence(branchId, evidence.id);
        if (!result.success) throw new Error(result.message);
        message.success("Registro eliminado exitosamente");
        await load();
      },
    });
  }

  async function changeRequired(book, checked) {
    const result = await updateBookRequired(branchId, book.assignmentId, checked);
    if (!result.success) {
      message.error(result.message);
      return;
    }
    await load();
  }

  if (loading) return <div className="legacy-document-loading"><Spin /></div>;
  if (!branchId || !detail) {
    return <div className="legacy-document-empty-file">La sucursal seleccionada no existe.</div>;
  }

  const documentTab = (
    <div className="legacy-branch-tab-content">
      <div className="legacy-branch-tab-heading">
        <h2>Documentos</h2>
        <Input.Search value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Buscar Documentos" />
      </div>
      <List
        dataSource={filteredDocuments}
        locale={{ emptyText: <Empty description={<><div>We couldn´t find any matches.</div><div>Try adjusting your search.</div></>} /> }}
        renderItem={(entry) => {
          const menuItems = [
            { key: "add", icon: <PlusSquareOutlined />, label: "Agregar Documento" },
            ...(canDelete && entry.document ? [{ key: "delete", danger: true, icon: <DeleteOutlined />, label: "Eliminar Archivo" }] : []),
          ];
          return (
            <List.Item
              className="legacy-branch-list-item"
              actions={[
                <Dropdown
                  key="options"
                  trigger={["click"]}
                  menu={{
                    items: menuItems,
                    onClick: ({ key }) => key === "add" ? openDocumentForm(entry) : confirmDocumentDelete(entry),
                  }}
                >
                  <Button type="text" icon={<EllipsisOutlined />} aria-label="Opciones del Archivo" />
                </Dropdown>,
              ]}
            >
              <List.Item.Meta
                title={`${entry.categoryName} - ${entry.subcategoryName}`}
                description={entry.document ? (
                  <div className="legacy-branch-document-info">
                    <span>{entry.document.reference}</span>
                    <span>{entry.document.statusName}</span>
                    <span>{entry.document.isReferential ? "Referencial" : entry.document.expirationDate || ""}</span>
                    {entry.document.hasAttachment ? (
                      <button type="button" onClick={() => openDocumentPreview(entry.document)}>
                        {entry.document.attachment?.fileName}
                      </button>
                    ) : <span>No existe el archivo...</span>}
                  </div>
                ) : null}
              />
            </List.Item>
          );
        }}
      />
    </div>
  );

  const booksTab = (
    <div className="legacy-branch-tab-content legacy-books-tab">
      <div className="legacy-branch-tab-heading">
        <h2>Libros</h2>
        <Input.Search value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} placeholder="Buscar Libros" />
      </div>
      <div className="legacy-books-layout">
        <List
          dataSource={filteredBooks}
          locale={{ emptyText: <Empty description={<><div>We couldn´t find any matches.</div><div>Try adjusting your search.</div></>} /> }}
          renderItem={(book) => {
            const currentEvidence = book.evidences.find((evidence) => !evidence.isHistoric);
            return (
              <List.Item
                className={`legacy-branch-list-item${selectedBookId === book.assignmentId ? " is-selected" : ""}`}
                onClick={() => setSelectedBookId(book.assignmentId)}
                actions={[
                  <Checkbox
                    key="required"
                    checked={book.isRequired}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => changeRequired(book, event.target.checked)}
                  />,
                  <Dropdown
                    key="options"
                    trigger={["click"]}
                    menu={{
                      items: [
                        { key: "add", icon: <PlusSquareOutlined />, label: "Agregar Evidencia" },
                        ...(canDelete && currentEvidence ? [{ key: "delete", danger: true, icon: <DeleteOutlined />, label: "Eliminar Evidencia" }] : []),
                      ],
                      onClick: ({ key, domEvent }) => {
                        domEvent.stopPropagation();
                        if (key === "add") openEvidence(book);
                        else confirmEvidenceDelete(book, currentEvidence);
                      },
                    }}
                  >
                    <Button type="text" icon={<EllipsisOutlined />} aria-label="Opciones del Archivo" onClick={(event) => event.stopPropagation()} />
                  </Dropdown>,
                ]}
              >
                {book.name}
              </List.Item>
            );
          }}
        />
        <div className="legacy-book-evidence-list">
          {!selectedBook ? <div>Seleccione un libro...</div> : (
            selectedBook.evidences.filter((evidence) => !evidence.isHistoric).map((evidence) => (
              <button key={evidence.id} type="button" onClick={() => downloadEvidence(evidence)}>
                {evidence.fileName} <span>(Descargar Archivo...)</span> <DownloadOutlined />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="legacy-branch-detail-page">
      <h1>Detalle Documentación Legal</h1>
      <div className="legacy-branch-summary">
        <div>
          <strong>{detail.branch.code} - {detail.branch.name}</strong>
          <span>{detail.branch.address || ""}</span>
        </div>
        <div><label>Gerente de Farmacia</label><span>{detail.branch.pharmacyManagerName || ""}</span></div>
        <div><label>Gerente de Área</label><span>{detail.branch.areaManagerName || ""}</span></div>
      </div>
      <h2 className="legacy-branch-information-title">Información de Documento</h2>
      <Tabs items={[
        { key: "documents", label: "Documentos Legales", children: documentTab },
        { key: "books", label: "Libros", children: booksTab },
      ]} />

      <Drawer
        title="Agregar Documento"
        open={documentDrawer}
        width={760}
        onClose={() => setDocumentDrawer(false)}
        destroyOnClose
      >
        <Form
          form={documentForm}
          layout="vertical"
          className="legacy-create-form legacy-branch-document-form"
          onFinish={submitDocument}
          onValuesChange={(changed) => {
            if (changed.isReferential) documentForm.setFieldsValue({ documentDate: undefined, expirationDate: undefined });
          }}
        >
          <h2>Ingrese Información:</h2>
          <Form.Item label="Nivel Documento" name="level" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value={1}>Público</Radio.Button>
              <Radio.Button value={2}>Privado</Radio.Button>
              <Radio.Button value={3}>Restringido</Radio.Button>
              <Radio.Button value={4}>Confidencial</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <div className="legacy-create-grid">
            <Form.Item label="Descripción Contrato" name="description" rules={[{ required: true, message: "Ingrese una descripción." }]}>
              <Input maxLength={20} />
            </Form.Item>
            <Form.Item label="Proveedor" name="providerId">
              <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccionar..." options={options(catalogs.providers)} />
            </Form.Item>
            <Form.Item label="Categoría" name="categoryId">
              <Select disabled options={options(catalogs.categories)} />
            </Form.Item>
            <Form.Item label="Subcategoría" name="subcategoryId">
              <Select disabled options={options(catalogs.subcategories)} />
            </Form.Item>
            {!isReferential ? (
              <>
                <Form.Item label="Fecha de Documento" name="documentDate" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item>
                <Form.Item label="Fecha de vencimiento" name="expirationDate" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item>
              </>
            ) : null}
            <Form.Item name="isReferential" valuePropName="checked"><Checkbox>Es Referencial</Checkbox></Form.Item>
            <Form.Item name="isActivePrincipal" valuePropName="checked"><Checkbox>Activo Principal</Checkbox></Form.Item>
            <Form.Item label="Referencia 2" name="secondaryReference"><Input maxLength={516} /></Form.Item>
          </div>
          <Form.Item
            className="legacy-create-upload"
            name="attachment"
            valuePropName="fileList"
            getValueFromEvent={(event) => Array.isArray(event) ? event : event?.fileList}
            rules={[{ required: true, message: "Adjunte el archivo." }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.jpg,.jpeg,.png,.bmp">
              <Button>Adjunte Archivo</Button>
            </Upload>
          </Form.Item>
          <div className="legacy-create-actions">
            <Button onClick={() => setDocumentDrawer(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Registrar</Button>
          </div>
        </Form>
      </Drawer>

      <Modal title="Agregue la evidencia" open={evidenceModal} onCancel={() => setEvidenceModal(false)} footer={null} destroyOnClose>
        <Form form={evidenceForm} layout="vertical" onFinish={submitEvidence}>
          <Form.Item
            name="attachment"
            valuePropName="fileList"
            getValueFromEvent={(event) => Array.isArray(event) ? event : event?.fileList}
            rules={[{ required: true, message: "Adjunte el archivo." }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.jpg,.jpeg,.png,.bmp">
              <Button>Adjunte Archivo</Button>
            </Upload>
          </Form.Item>
          <div className="legacy-create-actions">
            <Button onClick={() => setEvidenceModal(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Aceptar</Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={preview?.fileName || ""}
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {preview ? (
          <>
            <a className="legacy-document-file-name" href={preview.url} download={preview.fileName}>{preview.fileName}</a>
            <PreviewContent {...preview} />
          </>
        ) : null}
      </Modal>
    </div>
  );
}

export { branchIdFromSearch };
