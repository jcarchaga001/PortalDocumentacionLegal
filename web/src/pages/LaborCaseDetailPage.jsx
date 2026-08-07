import {
  ArrowLeftOutlined,
  CommentOutlined,
  DownloadOutlined,
  EditOutlined,
  HistoryOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Checkbox,
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
import { useAuth } from "../config/AuthContext.jsx";
import { downloadBlob } from "../services/fileHelpers.js";
import { uploadIncidentFile } from "../services/incidentFileService.js";
import {
  addLaborComment,
  createLaborAction,
  getIncidentCatalogs,
  getLaborCase,
  updateLaborAction,
  updateLaborCase,
} from "../services/incidentService.js";
import { downloadS3File } from "../services/tdS3Service.js";
import { options, StatusTag } from "./IncidentUi.jsx";

function requestFromSearch(search) {
  const query = new URLSearchParams(search);
  const caseId = Number(query.get("CodIncidente"));
  const actionId = Number(query.get("actionId"));
  return {
    caseId: Number.isInteger(caseId) && caseId > 0 ? caseId : null,
    actionId: Number.isInteger(actionId) && actionId > 0 ? actionId : null,
  };
}

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function CaseField({ label, value, onEdit }) {
  return (
    <div className="legacy-incident-detail-field">
      <span>{label}</span>
      <div className="legacy-editable-value">
        <strong>{valueOrDash(value)}</strong>
        {onEdit && <Button type="text" icon={<EditOutlined />} onClick={onEdit} aria-label={`Editar ${label}`} />}
      </div>
    </div>
  );
}

export function LaborCaseDetailPage({ legacy = false }) {
  const history = useHistory();
  const location = useLocation();
  const { user } = useAuth();
  const request = useMemo(() => requestFromSearch(location.search), [location.search]);
  const [data, setData] = useState(null);
  const [catalogs, setCatalogs] = useState({ actions: [], responsiblePeople: [], levels: [], priorities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [newActionOpen, setNewActionOpen] = useState(false);
  const [caseOperation, setCaseOperation] = useState(null);
  const [actionOperation, setActionOperation] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [historyAction, setHistoryAction] = useState(null);
  const [newActionFile, setNewActionFile] = useState(null);
  const [actionFile, setActionFile] = useState(null);
  const [caseFile, setCaseFile] = useState(null);
  const [newActionForm] = Form.useForm();
  const [caseForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [commentForm] = Form.useForm();
  const includeEvidence = Form.useWatch("includeEvidence", newActionForm);
  const actionIncludeEvidence = Form.useWatch("includeEvidence", actionForm);

  const load = useCallback(async () => {
    if (!request.caseId) {
      setError("El caso laboral solicitado no es valido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [detailResult, catalogResult] = await Promise.all([
      getLaborCase(request.caseId),
      getIncidentCatalogs("labor-actions"),
    ]);
    if (detailResult.success) {
      setData(detailResult.data);
      if (request.actionId) {
        const requestedAction = (detailResult.data.actions || []).find((item) => Number(item.id) === request.actionId);
        if (requestedAction) setHistoryAction(requestedAction);
      }
    } else setError(detailResult.message || "No fue posible consultar el caso laboral.");
    if (catalogResult.success) setCatalogs(catalogResult.data || {});
    setLoading(false);
  }, [request.actionId, request.caseId]);

  useEffect(() => { load(); }, [load]);

  async function downloadEvidence(s3Key, fileName) {
    if (!s3Key) return;
    const result = await downloadS3File({ s3Key });
    if (result.success) downloadBlob(result.data, fileName || `evidencia-${data?.incidentNumber || request.caseId}`);
    else message.error(result.message);
  }

  async function saveNewAction() {
    try {
      const values = await newActionForm.validateFields();
      setSaving(true);
      let attachment = {};
      if (values.includeEvidence) {
        if (!newActionFile) {
          newActionForm.setFields([{ name: "evidence", errors: ["Adjunte la evidencia."] }]);
          return;
        }
        const upload = await uploadIncidentFile(newActionFile, { caseId: String(request.caseId), purpose: "labor-action-create" });
        if (!upload.success) return message.error(upload.message);
        attachment = upload.data;
      }
      const payload = { ...values, ...attachment };
      delete payload.includeEvidence;
      delete payload.evidence;
      const result = await createLaborAction(request.caseId, payload);
      if (!result.success) return message.error(result.message);
      setData(result.data);
      setNewActionOpen(false);
      newActionForm.resetFields();
      setNewActionFile(null);
      message.success("Acción laboral registrada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  function openCaseOperation(operation) {
    setCaseOperation(operation);
    setCaseFile(null);
    caseForm.resetFields();
    if (operation === "responsible") caseForm.setFieldValue("responsibleId", data.responsibleId);
    if (operation === "security") caseForm.setFieldValue("levelId", data.securityLevelId);
    if (operation === "priority") caseForm.setFieldValue("priorityId", data.priorityId);
  }

  async function saveCaseOperation() {
    try {
      const values = await caseForm.validateFields();
      setSaving(true);
      let attachment = {};
      if (caseOperation === "close" && caseFile) {
        const upload = await uploadIncidentFile(caseFile, { caseId: String(request.caseId), purpose: "labor-case-close" });
        if (!upload.success) return message.error(upload.message);
        attachment = upload.data;
      }
      if (caseOperation === "close" && data.requiresEvidence && !caseFile) {
        caseForm.setFields([{ name: "evidence", errors: ["Adjunte la evidencia requerida."] }]);
        return;
      }
      const result = await updateLaborCase(request.caseId, {
        operation: caseOperation,
        ...values,
        ...attachment,
        requiresEvidence: data.requiresEvidence,
      });
      if (!result.success) return message.error(result.message);
      setData(result.data);
      setCaseOperation(null);
      message.success("Caso laboral actualizado correctamente.");
    } finally {
      setSaving(false);
    }
  }

  function openActionOperation(action, operation) {
    setSelectedAction(action);
    setActionOperation(operation);
    setActionFile(null);
    actionForm.resetFields();
    if (operation === "reassign") actionForm.setFieldValue("responsibleId", action.responsibleId);
    if (operation === "reschedule") actionForm.setFieldValue("dueDate", action.closeDate || action.expectedDueDate);
    if (operation === "close") actionForm.setFieldValue("includeEvidence", false);
  }

  async function saveActionOperation() {
    try {
      const values = await actionForm.validateFields();
      setSaving(true);
      let attachment = {};
      if (actionOperation === "close" && values.includeEvidence) {
        if (!actionFile) {
          actionForm.setFields([{ name: "evidence", errors: ["Adjunte el documento de cierre."] }]);
          return;
        }
        const upload = await uploadIncidentFile(actionFile, {
          caseId: String(request.caseId),
          actionId: String(selectedAction.id),
          purpose: "labor-action-close",
        });
        if (!upload.success) return message.error(upload.message);
        attachment = upload.data;
      }
      const result = await updateLaborAction(selectedAction.id, {
        operation: actionOperation,
        ...values,
        ...(actionOperation === "close" ? { includeEvidence: Boolean(values.includeEvidence) } : {}),
        ...attachment,
      });
      if (!result.success) return message.error(result.message);
      setData(result.data);
      setActionOperation(null);
      message.success("Acción laboral actualizada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  async function saveComment() {
    try {
      const values = await commentForm.validateFields();
      const result = await addLaborComment(request.caseId, values);
      if (!result.success) return message.error(result.message);
      setData(result.data);
      commentForm.resetFields();
    } catch {
      // Ant Design conserva el mensaje de campo requerido.
    }
  }

  const actionColumns = [
    { title: "Nombre Acción", dataIndex: "name", key: "name", width: 169 },
    { title: "Descripción", dataIndex: "description", key: "description", width: 146 },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsibleName", width: 153 },
    { title: "Fecha Cierre", dataIndex: "closeDate", key: "closeDate", width: 198, render: (value) => valueOrDash(value) },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 168,
      render: (name, row) => <StatusTag id={row.statusId} name={name} />,
    },
    {
      title: "Evidencia",
      key: "evidence",
      width: 124,
      render: (_, row) => row.s3Key ? (
        <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadEvidence(row.s3Key, row.fileName)}>Descargar</Button>
      ) : <span>No adjuntada</span>,
    },
    {
      title: "Histórico",
      key: "history",
      width: 144,
      render: (_, row) => <Button type="link" icon={<HistoryOutlined />} onClick={() => setHistoryAction(row)}>Histórico</Button>,
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_, row) => {
        const ended = [3, 5].includes(Number(row.statusId));
        const canOwnerMutate = !ended && (
          Number(user?.id) === 1
          || Number(row.responsibleId) === Number(user?.id)
        );
        const items = [
          ...(canOwnerMutate && Number(row.statusId) === 1 ? [{ key: "start", label: "Iniciar acción" }] : []),
          ...(!ended ? [
            { key: "reassign", label: "Reasignar Responsable" },
            { key: "reschedule", label: "Reasignar Fecha" },
          ] : []),
          ...(canOwnerMutate ? [
            { key: "close", label: "Cerrar acción" },
            { key: "cancel", label: "Anular acción" },
          ] : []),
        ];
        return items.length ? (
          <Dropdown trigger={["click"]} menu={{ items, onClick: ({ key }) => openActionOperation(row, key) }}>
            <Button type="text" icon={<MoreOutlined />} aria-label={`Opciones de ${row.name}`} />
          </Dropdown>
        ) : null;
      },
    },
  ];

  const selectedHistory = historyAction
    ? (data?.actionHistory || []).filter((entry) => Number(entry.actionId) === Number(historyAction.id))
    : [];

  return (
    <div className="legacy-incident-page legacy-incident-detail-page legacy-labor-detail-page">
      <button type="button" className="legacy-incident-back" onClick={() => history.goBack()}>
        <ArrowLeftOutlined /> Regresar pantalla anterior...
      </button>
      <div className="legacy-incident-title-row">
        <h1>Detalle Caso Laboral</h1>
        <div>
          <Button type="text" icon={<CommentOutlined />} onClick={() => setCommentsOpen(true)}>{data?.comments?.length || 0}</Button>
        </div>
      </div>

      {error && <Alert className="legacy-incident-alert" type="error" showIcon message={error} />}
      {loading && <div className="legacy-incident-loading">Cargando Información...</div>}

      {data && (
        <>
          <div className="legacy-incident-detail-card legacy-labor-detail-card">
            <div className="legacy-incident-reference-row">
              <div><strong>N°: {data.incidentNumber}</strong>{!legacy && <span>{data.registrationDate}</span>}</div>
              <StatusTag id={data.statusId} name={data.statusName} />
            </div>
            {legacy ? (
              <>
                <div className="legacy-incident-detail-grid legacy-labor-secondary-grid">
                  <CaseField label="Sucursal" value={data.branchName} />
                  <CaseField label="Nombre Empleado Infractor" value={data.employeeName} />
                  <CaseField label="DNI" value={data.identityNumber} />
                  <CaseField label="Nombre Solicitante" value={data.applicantName} />
                </div>
                <div className="legacy-incident-detail-grid legacy-labor-edit-grid">
                  <CaseField label="Nivel de Seguridad" value={data.securityLevelName || "No asignado"} onEdit={() => openCaseOperation("security")} />
                  <CaseField label="Nivel Prioridad" value={data.priorityName || "No asignado"} onEdit={() => openCaseOperation("priority")} />
                </div>
              </>
            ) : (
              <>
                <div className="legacy-labor-primary-grid">
                  <div className="legacy-incident-detail-field legacy-labor-employee-field">
                    <span>Empleado Infractor</span>
                    <strong>{valueOrDash(data.employeeName)}</strong>
                    <small>{valueOrDash(data.identityNumber)}</small>
                  </div>
                  <CaseField label="Fecha de Conociemiento" value={data.awarenessDate} />
                </div>
                <div className="legacy-incident-detail-grid legacy-labor-secondary-grid">
                  <CaseField label="Sucursal" value={data.branchName} />
                  <CaseField label="Fecha el Hecho" value={data.eventDate} />
                  <CaseField label="Nombre Solicitante" value={data.applicantName} />
                  <CaseField label="Correo Solicitante" value={data.applicantEmail} />
                </div>
              </>
            )}
            <div className="legacy-labor-comment-label">Comentario del Solicitante</div>
            <div className="legacy-incident-long-field legacy-labor-comment-field"><p>{data.applicantComment}</p></div>
            {!legacy && (
              <div className="legacy-incident-detail-grid legacy-labor-edit-grid">
                <CaseField label="Responsable Legal" value={data.responsibleName} onEdit={() => openCaseOperation("responsible")} />
                <CaseField label="Nivel de Seguridad" value={data.securityLevelName || "No asignado"} onEdit={() => openCaseOperation("security")} />
                <CaseField label="Nivel Prioridad" value={data.priorityName || "No asignado"} onEdit={() => openCaseOperation("priority")} />
              </div>
            )}
          </div>

          {!legacy && (
            <div className="legacy-labor-thread-link">
              <Button type="text" icon={<CommentOutlined />} onClick={() => setTimelineOpen(true)}>{data.history?.length || 0}</Button>
            </div>
          )}

          <div className="legacy-incident-section-title">
            <h2>Acciones Generadas</h2>
            {Number(data.statusId) !== 5 && (
              <Button type="link" icon={<PlusOutlined />} onClick={() => setNewActionOpen(true)}>Nueva acción</Button>
            )}
          </div>
          <Table
            className="legacy-incident-table"
            rowKey="id"
            columns={actionColumns}
            dataSource={data.actions || []}
            pagination={false}
          />

          <div className="legacy-incident-attachments">
            <h2>Documentos adjuntos</h2>
            <List
              dataSource={data.files || []}
              locale={{ emptyText: "No hay documentos adjuntos." }}
              renderItem={(file) => (
                <List.Item actions={[<Button key="download" type="text" icon={<DownloadOutlined />} onClick={() => downloadEvidence(file.s3Key, file.fileName)} />]}>
                  {file.fileName}
                </List.Item>
              )}
            />
          </div>
          {Number(data.statusId) !== 5 && (
            <div className="legacy-form-actions legacy-incident-close-actions">
              {!legacy && <Button onClick={() => openCaseOperation("pending")}>Caso pendiente de información</Button>}
              <Button danger onClick={() => openCaseOperation("close")}>Cerrar Caso</Button>
            </div>
          )}
        </>
      )}

      <Drawer title="Comentarios del Caso" open={commentsOpen} onClose={() => setCommentsOpen(false)} width={430}>
        <Form form={commentForm} layout="vertical">
          <Form.Item name="comment" rules={[{ required: true, whitespace: true, message: "Ingrese un comentario." }]}>
            <Input.TextArea rows={3} placeholder="Agregar comentario" />
          </Form.Item>
          <Button type="primary" onClick={saveComment}>+ Agregar</Button>
        </Form>
        <List
          dataSource={data?.comments || []}
          locale={{ emptyText: "No hay comentarios." }}
          renderItem={(item) => <List.Item><List.Item.Meta title={item.userName || "Usuario"} description={item.registeredAt} /><p>{item.comment}</p></List.Item>}
        />
      </Drawer>

      <Drawer title="Hilo del Caso" open={timelineOpen} onClose={() => setTimelineOpen(false)} width={430}>
        <List
          dataSource={data?.history || []}
          locale={{ emptyText: "No hay movimientos registrados." }}
          renderItem={(item) => <List.Item><List.Item.Meta title={item.description} description={`${item.userName || "Usuario"} · ${item.registeredAt || ""}`} /></List.Item>}
        />
      </Drawer>

      <Modal title="Registrar Nueva Acción:" open={newActionOpen} onCancel={() => setNewActionOpen(false)} onOk={saveNewAction} okText="Guardar" confirmLoading={saving}>
        <Form form={newActionForm} layout="vertical">
          <Form.Item name="actionId" label="Nombre Acción*" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={options(catalogs.actions)} placeholder="Seleccione Acción..." />
          </Form.Item>
          <Form.Item name="responsibleId" label="Responsable*" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={options(catalogs.responsiblePeople)} placeholder="Seleccione Responsable..." />
          </Form.Item>
          <Form.Item name="dueDate" label="Fecha Cierre Acción*" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="includeEvidence" valuePropName="checked"><Checkbox>¿Adjuntar evidencia?</Checkbox></Form.Item>
          {includeEvidence && (
            <Form.Item name="evidence" label="Evidencia">
              <Upload beforeUpload={() => false} maxCount={1} onChange={({ fileList }) => setNewActionFile(fileList[0]?.originFileObj || null)}>
                <Button>Adjuntar documento</Button>
              </Upload>
            </Form.Item>
          )}
          <Form.Item name="description" label="Descripción"><Input.TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={{ responsible: "Responsable Legal", security: "Nivel de Seguridad", priority: "Nivel Prioridad", pending: "Cambio de estado justificado", close: "Cerrar Caso" }[caseOperation]}
        open={Boolean(caseOperation)}
        onCancel={() => setCaseOperation(null)}
        onOk={saveCaseOperation}
        okText={caseOperation === "pending" ? "Aceptar cambio estado" : "Actualizar"}
        confirmLoading={saving}
      >
        <Form form={caseForm} layout="vertical">
          {caseOperation === "responsible" && <Form.Item name="responsibleId" label="Responsable Legal*" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={options(catalogs.responsiblePeople)} /></Form.Item>}
          {caseOperation === "security" && <Form.Item name="levelId" label="Nivel de Seguridad*" rules={[{ required: true }]}><Select options={options(catalogs.levels)} /></Form.Item>}
          {caseOperation === "priority" && <Form.Item name="priorityId" label="Nivel Prioridad*" rules={[{ required: true }]}><Select options={options(catalogs.priorities)} /></Form.Item>}
          {["pending", "close"].includes(caseOperation) && <Form.Item name="justification" label="Justificación cambio estado*" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} /></Form.Item>}
          {caseOperation === "close" && (
            <Form.Item name="evidence" label={`Evidencia${data?.requiresEvidence ? "*" : ""}`}>
              <Upload beforeUpload={() => false} maxCount={1} onChange={({ fileList }) => setCaseFile(fileList[0]?.originFileObj || null)}><Button>Adjuntar documento</Button></Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={{ start: "Iniciar acción", close: "Cerrar acción", cancel: "Anular acción", reassign: "Reasignar Responsable", reschedule: "Reasignar Fecha" }[actionOperation]}
        open={Boolean(actionOperation)}
        onCancel={() => setActionOperation(null)}
        onOk={saveActionOperation}
        okText="Actualizar"
        confirmLoading={saving}
      >
        <Form form={actionForm} layout="vertical">
          {actionOperation === "reassign" && <Form.Item name="responsibleId" label="Responsable*" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={options(catalogs.responsiblePeople)} /></Form.Item>}
          {actionOperation === "reschedule" && <Form.Item name="dueDate" label="Fecha Cierre Acción*" rules={[{ required: true }]}><Input type="date" /></Form.Item>}
          {["close", "cancel"].includes(actionOperation) && <Form.Item name="justification" label="Justificación*" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} /></Form.Item>}
          {actionOperation === "close" && (
            <Form.Item name="includeEvidence" valuePropName="checked">
              <Checkbox>¿Adjuntar evidencia?</Checkbox>
            </Form.Item>
          )}
          {actionOperation === "close" && actionIncludeEvidence && (
            <Form.Item name="evidence" label="Evidencia">
              <Upload beforeUpload={() => false} maxCount={1} onChange={({ fileList }) => setActionFile(fileList[0]?.originFileObj || null)}>
                <Button>Adjuntar documento</Button>
              </Upload>
            </Form.Item>
          )}
          {actionOperation === "start" && <p>La acción cambiará a En Ejecución.</p>}
        </Form>
      </Modal>

      <Modal title={`Histórico · ${historyAction?.name || "Acción"}`} open={Boolean(historyAction)} onCancel={() => setHistoryAction(null)} footer={null}>
        <List
          dataSource={selectedHistory}
          locale={{ emptyText: "No hay movimientos registrados." }}
          renderItem={(item) => <List.Item><List.Item.Meta title={item.description} description={`${item.statusName || ""} · ${item.userName || "Usuario"} · ${item.registeredAt || ""}`} /></List.Item>}
        />
      </Modal>
    </div>
  );
}
