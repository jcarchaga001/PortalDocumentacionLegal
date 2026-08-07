import {
  ArrowLeftOutlined,
  CommentOutlined,
  DownloadOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Drawer,
  Dropdown,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Table,
  Upload,
  message,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useAuth } from "../config/AuthContext.jsx";
import { downloadBlob } from "../services/fileHelpers.js";
import { uploadIncidentFile } from "../services/incidentFileService.js";
import {
  addIncidentComment,
  closeIncident,
  createIncidentAction,
  getIncident,
  getIncidentCatalogs,
  updateIncidentAction,
} from "../services/incidentService.js";
import { downloadS3File } from "../services/tdS3Service.js";
import { options, StatusTag } from "./IncidentUi.jsx";

function readRequest(search) {
  const query = new URLSearchParams(search);
  const incidentId = Number(query.get("CodIncidente"));
  const actionId = Number(query.get("actionId"));
  const scope = query.get("scope") === "internal" ? "internal" : "external";
  return {
    incidentId: Number.isInteger(incidentId) && incidentId > 0 ? incidentId : null,
    actionId: Number.isInteger(actionId) && actionId > 0 ? actionId : null,
    scope,
  };
}

function display(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
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
  const request = useMemo(() => readRequest(location.search), [location.search]);
  const canCloseIncident = [7, 32].includes(Number(user?.positionCode)) || Number(user?.id) === 1578;
  const [data, setData] = useState(null);
  const [catalogs, setCatalogs] = useState({ responsiblePeople: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [newActionOpen, setNewActionOpen] = useState(false);
  const [operation, setOperation] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [historyAction, setHistoryAction] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionFile, setActionFile] = useState(null);
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
    else setError(detailResult.message || "No fue posible consultar el incidente.");
    if (catalogResult.success) setCatalogs(catalogResult.data || {});
    setLoading(false);
  }, [request.incidentId, request.scope]);

  useEffect(() => { load(); }, [load]);

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
      const result = await addIncidentComment(request.scope, request.incidentId, values);
      if (!result.success) return message.error(result.message);
      setData(result.data);
      commentForm.resetFields();
    } catch {
      // Ant Design mantiene la validacion visible.
    }
  }

  const columns = [
    { title: "Nombre Acción", dataIndex: "name", key: "name", width: 190 },
    { title: "Descripción", dataIndex: "description", key: "description", width: 315 },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsibleName", width: 156 },
    { title: "Fecha Inicio", dataIndex: "startDate", key: "startDate", width: 149 },
    { title: "Fecha Probable Vencimieno", dataIndex: "dueDate", key: "dueDate", width: 154 },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 168,
      render: (name, row) => <StatusTag id={row.statusId} name={name} />,
    },
    {
      title: "",
      key: "actions",
      width: 51,
      render: (_, row) => {
        const closed = [3, 5].includes(Number(row.statusId));
        const canMutate = !closed && (
          Number(user?.id) === 1
          || Number(row.responsibleId) === Number(user?.id)
        );
        const items = [
          ...(canMutate && Number(row.statusId) === 1 ? [{ key: "start", label: "Iniciar acción" }] : []),
          ...(canMutate ? [
            { key: "reassign", label: "Reasignar Responsable" },
            { key: "reschedule", label: "Reasignar Fecha" },
            { key: "close", label: "Cerrar acción" },
            { key: "cancel", label: "Anular acción" },
          ] : []),
          { key: "history", label: "Histórico" },
        ];
        return (
          <Dropdown
            trigger={["click"]}
            menu={{
              items,
              onClick: ({ key }) => key === "history" ? setHistoryAction(row) : openOperation(row, key),
            }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label={`Opciones de ${row.name}`} />
          </Dropdown>
        );
      },
    },
  ];

  const selectedHistory = historyAction
    ? (data?.actionHistory || []).filter((entry) => Number(entry.actionId) === Number(historyAction.id))
    : [];

  return (
    <div className="legacy-incident-page legacy-incident-detail-page">
      <button type="button" className="legacy-incident-back" onClick={() => history.goBack()}>
        <ArrowLeftOutlined /> Regresar pantalla anterior...
      </button>
      <div className="legacy-incident-title-row">
        <h1>Detalle Incidente {request.scope === "external" ? "Externo" : "Interno"}</h1>
        <Button type="text" icon={<CommentOutlined />} onClick={() => setCommentsOpen(true)}>
          {data?.comments?.length || 0}
        </Button>
      </div>

      {error && <Alert className="legacy-incident-alert" type="error" showIcon message={error} />}
      {loading && <div className="legacy-incident-loading">Cargando Información...</div>}

      {data && (
        <>
          <div className="legacy-incident-detail-card">
            <div className="legacy-incident-reference-row">
              <strong>N°: {display(data.reference)}</strong>
              <StatusTag id={data.statusId} name={data.statusName} />
            </div>
            <div className="legacy-incident-detail-grid">
              <DetailField label="Sucursal">{data.branchName}</DetailField>
              <DetailField label="Tipo Incidente">{data.typeName}</DetailField>
              <DetailField label="Motivo Incidente">{data.motiveName}</DetailField>
              <DetailField label="Categoría Incidente">{data.categoryId}</DetailField>
              <DetailField label="Fecha de Registro">{data.registrationDate || data.openingDate}</DetailField>
              <DetailField label="Recibio Visita">{data.visitorName}</DetailField>
              <DetailField label="Usuario Registró">{data.registeredByName}</DetailField>
              <DetailField label="Descargar archivo">
                {data.s3Key ? (
                  <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadEvidence(data.s3Key)}>
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
              <Button type="link" icon={<PlusOutlined />} onClick={() => setNewActionOpen(true)}>
                Nueva acción
              </Button>
            )}
          </div>
          <Table
            className="legacy-incident-table"
            rowKey="id"
            rowClassName={(row) => Number(row.id) === request.actionId ? "is-selected" : ""}
            columns={columns}
            dataSource={data.actions || []}
            pagination={false}
          />
          {Number(data.statusId) !== 5 && canCloseIncident && (
            <div className="legacy-form-actions legacy-incident-close-actions">
              <Button danger onClick={() => setCloseOpen(true)}>Cerrar Incidente</Button>
            </div>
          )}
        </>
      )}

      <Drawer title="Comentarios del Incidente" open={commentsOpen} onClose={() => setCommentsOpen(false)} width={430}>
        <Form form={commentForm} layout="vertical">
          <Form.Item name="comment" rules={[{ required: true, whitespace: true, message: "Ingrese un comentario." }]}>
            <Input.TextArea rows={3} placeholder="Agregar comentario" />
          </Form.Item>
          <Button type="primary" onClick={saveComment}>+ Agregar</Button>
        </Form>
        <List
          className="legacy-incident-comment-list"
          dataSource={data?.comments || []}
          locale={{ emptyText: "No hay comentarios." }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta title={item.userName || "Usuario"} description={item.registeredAt} />
              <p>{item.comment}</p>
            </List.Item>
          )}
        />
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
              <Upload beforeUpload={() => false} maxCount={1} onChange={({ fileList }) => setActionFile(fileList[0]?.originFileObj || null)}>
                <Button icon={<DownloadOutlined />}>Adjuntar documento</Button>
              </Upload>
            </Form.Item>
          )}
          {operation === "start" && <p>La acción cambiará a En Ejecución.</p>}
        </Form>
      </Modal>

      <Modal title={`Histórico · ${historyAction?.name || "Acción"}`} open={Boolean(historyAction)} onCancel={() => setHistoryAction(null)} footer={null}>
        <List
          dataSource={selectedHistory}
          locale={{ emptyText: "No hay movimientos registrados." }}
          renderItem={(item) => <List.Item><List.Item.Meta title={item.description} description={`${item.userName || "Usuario"} · ${item.registeredAt || ""}`} /></List.Item>}
        />
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
