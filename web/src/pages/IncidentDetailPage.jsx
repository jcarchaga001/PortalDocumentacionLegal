import {
  ArrowLeftOutlined,
  CommentOutlined,
  DownloadOutlined,
  MoreOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Drawer,
  Dropdown,
  Form,
  Input,
  List,
  Modal,
  Select,
  Table,
  Upload,
  message,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { useAuth } from "../config/AuthContext.jsx";
import { readLegacyIncidentDetailRequest } from "../config/legacyIncidentContext.js";
import {
  validateLegacyIncidentCommentFileName,
  validateLegacyIncidentFileName,
} from "../config/legacyFileContracts.js";
import { downloadBlob } from "../services/fileHelpers.js";
import { uploadIncidentFile } from "../services/incidentFileService.js";
import {
  addIncidentComment,
  closeIncident,
  createIncidentAction,
  getIncident,
  getIncidentActionDetail,
  getIncidentCatalogs,
  updateIncidentAction,
} from "../services/incidentService.js";
import { downloadS3File } from "../services/tdS3Service.js";
import { options, StatusTag } from "./IncidentUi.jsx";
import {
  compareIncidentActionRows,
  formatLegacyActionDate,
  getIncidentActionMenu,
} from "./incidentActionSurface.js";
import {
  canOpenIncidentDetailActionMenu,
  formatLegacyIncidentDate,
  formatLegacyIncidentTimestamp,
  incidentDetailDisplay,
  incidentDetailQueryFeedback,
} from "./incidentDetailParity.js";

function display(value) {
  return incidentDetailDisplay(value);
}

function DetailField({ label, children }) {
  return (
    <div className="legacy-incident-detail-field">
      <span>{label}</span>
      <strong>{display(children)}</strong>
    </div>
  );
}

export function IncidentDetailPage() {
  const history = useHistory();
  const location = useLocation();
  const { user } = useAuth();
  const request = useMemo(() => readLegacyIncidentDetailRequest(location.search), [location.search]);
  const [data, setData] = useState(null);
  const [catalogs, setCatalogs] = useState({ responsiblePeople: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentEditorOpen, setCommentEditorOpen] = useState(false);
  const [newActionOpen, setNewActionOpen] = useState(false);
  const [operation, setOperation] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionDetailOpen, setActionDetailOpen] = useState(false);
  const [actionDetailLoading, setActionDetailLoading] = useState(false);
  const [selectedActionDetail, setSelectedActionDetail] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionFile, setActionFile] = useState(null);
  const [commentFile, setCommentFile] = useState(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const [newActionForm] = Form.useForm();
  const [operationForm] = Form.useForm();
  const [closeForm] = Form.useForm();
  const [commentForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!request.incidentId) {
      setError("El incidente solicitado no es valido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [detailResult, catalogResult] = await Promise.all([
      getIncident(request.scope, request.incidentId),
      getIncidentCatalogs(`${request.scope}-actions`, { incidentId: request.incidentId }),
    ]);
    if (detailResult.success) setData(detailResult.data);
    else setData(null);
    setError(incidentDetailQueryFeedback(detailResult, catalogResult));
    if (catalogResult.success) setCatalogs(catalogResult.data || {});
    setLoading(false);
  }, [request.incidentId, request.scope]);

  useEffect(() => { load(); }, [load]);

  async function openActionDetail(action) {
    setSelectedActionDetail(action);
    setActionDetailOpen(true);
    setActionDetailLoading(true);
    const result = await getIncidentActionDetail(request.scope, request.incidentId, action.id);
    if (result.success) {
      setSelectedActionDetail(result.data);
    } else {
      setError(result.error?.code === "INCIDENT_ACTION_QUERY_ERROR"
        ? "Error executing query."
        : (result.message || "No fue posible consultar la acción."));
    }
    setActionDetailLoading(false);
  }

  async function downloadEvidence(s3Key, fileName) {
    if (!s3Key) return;
    const result = await downloadS3File({ s3Key });
    if (result.success) downloadBlob(result.data, fileName || `evidencia-${data?.reference || request.incidentId}`);
    else message.error(result.message);
  }

  async function saveNewAction() {
    try {
      const values = await newActionForm.validateFields();
      setSaving(true);
      const result = await createIncidentAction(request.scope, request.incidentId, values);
      if (!result.success) return message.error(result.message);
      setData(result.data);
      setNewActionOpen(false);
      newActionForm.resetFields();
      message.success("Acción registrada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  function openOperation(action, nextOperation) {
    setSelectedAction(action);
    setOperation(nextOperation);
    setActionFile(null);
    operationForm.resetFields();
    if (nextOperation === "reassign") operationForm.setFieldValue("responsibleId", action.responsibleId);
    if (nextOperation === "reschedule") operationForm.setFieldValue("dueDate", action.dueDate);
  }

  function acceptActionEvidence(file) {
    const validation = validateLegacyIncidentFileName(file?.name);
    if (!validation.valid) {
      message.error(validation.message);
      return Upload.LIST_IGNORE;
    }
    setActionFile(file);
    operationForm.setFields([{ name: "evidence", errors: [] }]);
    return false;
  }

  function acceptCommentAttachment(file) {
    const validation = validateLegacyIncidentCommentFileName(file?.name);
    if (!validation.valid) {
      message.error(validation.message);
      return Upload.LIST_IGNORE;
    }
    setCommentFile(file);
    return false;
  }

  async function saveOperation() {
    try {
      const values = await operationForm.validateFields();
      setSaving(true);
      let attachment = {};
      if (operation === "close") {
        if (!actionFile) {
          operationForm.setFields([{ name: "evidence", errors: ["Adjunte la evidencia de cierre."] }]);
          return;
        }
        const upload = await uploadIncidentFile(actionFile, {
          scope: request.scope,
          incidentId: String(request.incidentId),
          actionId: String(selectedAction.id),
        });
        if (!upload.success) return message.error(upload.message);
        attachment = { ...upload.data, requiresEvidence: true };
      }
      const result = await updateIncidentAction(request.scope, selectedAction.id, {
        operation,
        ...values,
        ...attachment,
      });
      if (!result.success) return message.error(result.message);
      setData(result.data);
      setOperation(null);
      message.success("Acción actualizada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCloseIncident() {
    try {
      const values = await closeForm.validateFields();
      setSaving(true);
      const result = await closeIncident(request.scope, request.incidentId, values);
      if (!result.success) return message.error(result.message);
      setData(result.data);
      setCloseOpen(false);
      closeForm.resetFields();
      message.success("Incidente cerrado correctamente.");
    } finally {
      setSaving(false);
    }
  }

  async function saveComment() {
    try {
      const values = await commentForm.validateFields();
      setCommentSaving(true);
      let attachment = {};
      if (commentFile) {
        const upload = await uploadIncidentFile(commentFile, {
          scope: request.scope,
          incidentId: String(request.incidentId),
          purpose: "incident-comment",
        });
        if (!upload.success) return message.error(upload.message);
        attachment = upload.data;
      }
      const result = await addIncidentComment(request.scope, request.incidentId, {
        ...values,
        ...attachment,
      });
      if (!result.success) return message.error(result.message);
      setData(result.data);
      commentForm.resetFields();
      setCommentFile(null);
      setCommentEditorOpen(false);
    } catch {
      // Ant Design mantiene la validacion visible.
    } finally {
      setCommentSaving(false);
    }
  }

  const columns = [
    {
      title: "Nombre Acción",
      dataIndex: "name",
      key: "name",
      width: 190.0125,
      sorter: compareIncidentActionRows("name"),
      render: (name, row) => (
        <button type="button" className="legacy-incident-action-link" onClick={() => openActionDetail(row)}>
          {display(name)}
        </button>
      ),
    },
    { title: "Descripción", dataIndex: "description", key: "description", width: 315.65, sorter: compareIncidentActionRows("description") },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsibleName", width: 154.5, sorter: compareIncidentActionRows("responsibleName") },
    {
      title: "Fecha Inicio",
      dataIndex: "startDate",
      key: "startDate",
      width: 149.425,
      sorter: compareIncidentActionRows("startDate"),
      render: formatLegacyActionDate,
    },
    {
      title: "Fecha Probable Vencimieno",
      dataIndex: "dueDate",
      key: "dueDate",
      width: 153.875,
      render: formatLegacyActionDate,
    },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 168.7875,
      sorter: compareIncidentActionRows("statusName"),
      render: (name, row) => <StatusTag id={row.statusId} name={name} />,
    },
    {
      title: "",
      key: "actions",
      width: 50.95,
      render: (_, row) => {
        if (!canOpenIncidentDetailActionMenu(row, user)) return null;
        const items = getIncidentActionMenu({ statusId: row.statusId }).map((item) => ({
          key: item.key,
          disabled: item.disabled,
          label: (
            <span className="legacy-incident-operation-item" style={{ color: item.color }}>
              <i className={`fa fa-${item.icon}`} aria-hidden="true" />
              {item.label}
            </span>
          ),
        }));
        return (
          <Dropdown
            trigger={["click"]}
            menu={{
              items,
              onClick: ({ key }) => openOperation(row, key),
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label={`Opciones de ${row.name}`} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div className="legacy-incident-page legacy-incident-detail-page">
      <button type="button" className="legacy-incident-back" onClick={() => history.goBack()}>
        <ArrowLeftOutlined /> Regresar pantalla anterior...
      </button>
      <div className="legacy-incident-title-row">
        <h1>Detalle Incidente {request.scope === "external" ? "Externo" : "Interno"}</h1>
        <button type="button" className="legacy-incident-comments-trigger" onClick={() => setCommentsOpen(true)} aria-label="Comentarios del Incidente">
          <CommentOutlined />
          <span>{data?.comments?.length || 0}</span>
        </button>
      </div>

      <LegacyErrorFeedback message={error} />
      {loading && <div className="legacy-incident-loading">Cargando Información...</div>}

      {data && (
        <>
          <div className="legacy-incident-detail-card">
            <div className="legacy-incident-reference-row">
              <strong>N°: {display(data.reference)}</strong>
              <button
                type="button"
                className="legacy-incident-status-link"
                onClick={() => Number(data.statusId) !== 5 && setCloseOpen(true)}
                aria-label="Estado del incidente"
              >
                <StatusTag id={data.statusId} name={data.statusName} />
              </button>
            </div>
            <div className="legacy-incident-detail-grid">
              <DetailField label="Sucursal">{data.branchName}</DetailField>
              <DetailField label="Tipo Incidente">{data.typeName}</DetailField>
              <DetailField label="Motivo">{data.motiveName}</DetailField>
              <DetailField label="Categoría Incidente">{data.categoryId}</DetailField>
              <DetailField label="Fecha">{formatLegacyIncidentTimestamp(data.registrationDate || data.openingDate)}</DetailField>
              <DetailField label="Recibio Visita">{data.visitorName}</DetailField>
              <DetailField label="Usuario Registró">{data.visitorName}</DetailField>
              <DetailField label="Descargar archivo">
                {data.s3Key ? (
                  <Button type="link" onClick={() => downloadEvidence(data.s3Key)}>
                    Descargar Archivo...
                  </Button>
                ) : "—"}
              </DetailField>
            </div>
            <div className="legacy-incident-long-field"><span>Comentario Visita:</span><p>{display(data.comment)}</p></div>
            <div className="legacy-incident-long-field"><span>Justificación:</span><p>{display(data.justification)}</p></div>
          </div>

          <div className="legacy-incident-section-title">
            <h2>Acciones Generadas</h2>
            {Number(data.statusId) !== 5 && (
              <Button type="link" onClick={() => setNewActionOpen(true)}>
                + Nueva acción
              </Button>
            )}
          </div>
          <Table
            className="legacy-incident-table"
            rowKey="id"
            columns={columns}
            dataSource={data.actions || []}
            pagination={false}
          />
        </>
      )}

      <Drawer
        className="legacy-incident-comments-drawer"
        title="Comentarios del Incidente"
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        width="30%"
        extra={<Button type="link" onClick={() => setCommentEditorOpen(true)}>+Agregar</Button>}
      >
        {commentEditorOpen && <Form form={commentForm} layout="vertical" className="legacy-incident-comment-form">
          <Form.Item name="comment" rules={[{ required: true, whitespace: true, message: "Ingrese un comentario." }]}>
            <Input.TextArea rows={3} placeholder="Agregar comentario" />
          </Form.Item>
          <Upload
            beforeUpload={acceptCommentAttachment}
            fileList={commentFile ? [commentFile] : []}
            maxCount={1}
            onRemove={() => setCommentFile(null)}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>{commentFile?.name || "Adjuntar Archivo"}</Button>
          </Upload>
          <Button type="primary" loading={commentSaving} onClick={saveComment}>+ Agregar</Button>
          <Button type="link" onClick={() => setCommentEditorOpen(false)}>Cancelar</Button>
        </Form>}
        <List
          className="legacy-incident-comment-list"
          dataSource={data?.comments || []}
          locale={{ emptyText: "No hay comentarios." }}
          renderItem={(item) => (
            <List.Item
              actions={item.s3Key ? [
                <Button
                  key="download-comment-attachment"
                  type="text"
                  icon={<DownloadOutlined />}
                  aria-label="Descargar adjunto del comentario"
                  onClick={() => downloadEvidence(item.s3Key, item.fileName)}
                />,
              ] : []}
            >
              <div className="legacy-incident-comment-entry">
                <time>{formatLegacyIncidentDate(item.registeredAt)}</time>
                <i className="fa fa-check" aria-hidden="true" />
                <p>{item.comment}</p>
                <span>{item.userName || "Usuario"}</span>
              </div>
            </List.Item>
          )}
        />
      </Drawer>

      <Drawer
        className="legacy-incident-action-drawer"
        title={null}
        open={actionDetailOpen}
        onClose={() => setActionDetailOpen(false)}
        width="30%"
      >
        {actionDetailLoading ? <div className="legacy-incident-loading">Cargando Información...</div> : (
          <div className="legacy-incident-action-detail-card">
            <div className="legacy-incident-action-detail-grid">
              <DetailField label="Fecha de En">{formatLegacyIncidentDate(selectedActionDetail?.dueDate) || "1900-01-01"}</DetailField>
              <DetailField label="Recibio Finalizado">{formatLegacyIncidentDate(selectedActionDetail?.closeDate) || "1900-01-01"}</DetailField>
              <DetailField label="Usuario Responsable">{selectedActionDetail?.responsibleName}</DetailField>
              <DetailField label="Administrador">{selectedActionDetail?.administratorName}</DetailField>
            </div>
            <div className="legacy-incident-action-comment">
              <span>Comentario</span>
              <p>{display(selectedActionDetail?.justification)}</p>
            </div>
            <button
              type="button"
              className="legacy-incident-action-download"
              onClick={() => downloadEvidence(selectedActionDetail?.s3Key, selectedActionDetail?.fileName)}
            >
              {selectedActionDetail?.fileName
                ? `${selectedActionDetail.fileName} (Descargar Archivo...)`
                : "(Descargar Archivo...)"}
            </button>
          </div>
        )}
      </Drawer>

      <Modal
        title="Registrar Nueva Acción:"
        open={newActionOpen}
        onCancel={() => setNewActionOpen(false)}
        onOk={saveNewAction}
        okText="Guardar"
        confirmLoading={saving}
      >
        <Form form={newActionForm} layout="vertical">
          <Form.Item name="name" label="Nombre Acción*" rules={[{ required: true, whitespace: true }]}><Input /></Form.Item>
          <Form.Item name="responsibleId" label="Responsable*" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={options(catalogs.responsiblePeople)} placeholder="Seleccione Responsable..." />
          </Form.Item>
          <Form.Item name="dueDate" label="Fecha Probable Vencimiento*" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="description" label="Descripción"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={{ start: "Iniciar acción", close: "Cerrar acción", cancel: "Anular acción", reassign: "Reasignar Responsable", reschedule: "Reasignar Fecha" }[operation]}
        open={Boolean(operation)}
        onCancel={() => setOperation(null)}
        onOk={saveOperation}
        okText="Actualizar"
        confirmLoading={saving}
      >
        <Form form={operationForm} layout="vertical">
          {operation === "reassign" && (
            <Form.Item name="responsibleId" label="Responsable*" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={options(catalogs.responsiblePeople)} />
            </Form.Item>
          )}
          {operation === "reschedule" && (
            <Form.Item name="dueDate" label="Fecha Probable Vencimiento*" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          )}
          {["close", "cancel"].includes(operation) && (
            <Form.Item name="justification" label="Justificación*" rules={[{ required: true, whitespace: true }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
          )}
          {operation === "close" && (
            <Form.Item name="evidence" label="Evidencia*">
              <Upload beforeUpload={acceptActionEvidence} maxCount={1} onRemove={() => setActionFile(null)}>
                <Button icon={<DownloadOutlined />}>Adjuntar documento</Button>
              </Upload>
            </Form.Item>
          )}
          {operation === "start" && <p>La acción cambiará a En Ejecución.</p>}
        </Form>
      </Modal>

      <Modal title="Cerrar Incidente" open={closeOpen} onCancel={() => setCloseOpen(false)} onOk={saveCloseIncident} okText="Cerrar Incidente" confirmLoading={saving}>
        <Form form={closeForm} layout="vertical">
          <Form.Item name="justification" label="Justificación*" rules={[{ required: true, whitespace: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
