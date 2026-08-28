import { DownloadOutlined, HistoryOutlined, MoreOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Checkbox,
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
import { useState } from "react";
import { useAuth } from "../config/AuthContext.jsx";
import { downloadBlob } from "../services/fileHelpers.js";
import { uploadIncidentFile } from "../services/incidentFileService.js";
import { getLaborActions, getLaborCase, updateLaborAction } from "../services/incidentService.js";
import { downloadS3File } from "../services/tdS3Service.js";
import { DateRangeField, localIsoDate, localMonthStartIso, options, SelectFilter, StatusTag } from "./IncidentUi.jsx";
import {
  actionHistoryFor,
  buildLaborActionMenuItems,
  formatLaborActionCloseDate,
  isAcceptedLaborActionEvidence,
  LABOR_ACTION_MESSAGES,
  LABOR_ACTION_SCREEN_CONTRACT,
} from "./laborActionsParity.js";
import { useIncidentListing } from "./useIncidentListing.js";

const laborActionMaxDate = localIsoDate(0);
const initialLaborActionDateRange = [localMonthStartIso(), laborActionMaxDate];
const initialLaborActionFormValues = { dateRange: initialLaborActionDateRange };
const initialLaborActionFilters = {
  startDate: initialLaborActionDateRange[0],
  endDate: initialLaborActionDateRange[1],
};

function buildLaborActionFilters(values = {}) {
  const { dateRange = [], ...filters } = values;
  return {
    ...filters,
    startDate: dateRange[0] || undefined,
    endDate: dateRange[1] || undefined,
  };
}

const loadLaborActions = (query) => getLaborActions({
  ...query,
  page: 1,
  pageSize: LABOR_ACTION_SCREEN_CONTRACT.pageSize,
});

const operationTitles = Object.freeze({
  close: "Cerrar Acción",
  reassign: "Reasignar Responsable",
  reschedule: "Reasignar Fecha",
});

export function LaborActionsPage() {
  const { user } = useAuth();
  const [evidenceError, setEvidenceError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [operation, setOperation] = useState(null);
  const [operationFile, setOperationFile] = useState(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [historyByAction, setHistoryByAction] = useState({});
  const [historyLoadingId, setHistoryLoadingId] = useState(null);
  const [operationForm] = Form.useForm();
  const includeEvidence = Form.useWatch("includeEvidence", operationForm);
  const listing = useIncidentListing({
    catalogScope: "labor-actions",
    initialFilters: initialLaborActionFilters,
    loadData: loadLaborActions,
  });

  async function downloadEvidence(s3Key, fileName, fallbackName) {
    if (!s3Key) return;
    setEvidenceError("");
    const result = await downloadS3File({ s3Key });
    if (result.success) {
      downloadBlob(result.data, fileName || fallbackName);
    } else {
      setEvidenceError(result.message || "No fue posible descargar la evidencia.");
    }
  }

  async function toggleHistory(row) {
    if (expandedRowKeys.includes(row.id)) {
      setExpandedRowKeys([]);
      return;
    }
    setExpandedRowKeys([row.id]);
    if (Object.hasOwn(historyByAction, row.id)) return;

    setHistoryLoadingId(row.id);
    const result = await getLaborCase(row.incidentId);
    if (result.success) {
      setHistoryByAction((current) => ({
        ...current,
        [row.id]: actionHistoryFor(result.data, row.id),
      }));
    } else {
      setEvidenceError(result.message || "No fue posible consultar el histórico de la acción.");
      setExpandedRowKeys([]);
    }
    setHistoryLoadingId(null);
  }

  async function executeOperation(row, requestedOperation, values = {}) {
    setSaving(true);
    setEvidenceError("");
    try {
      const result = await updateLaborAction(row.id, { operation: requestedOperation, ...values });
      if (!result.success) {
        message.error(result.message);
        return false;
      }
      message.success(LABOR_ACTION_MESSAGES.updated);
      setOperation(null);
      setSelectedAction(null);
      setOperationFile(null);
      operationForm.resetFields();
      setHistoryByAction((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      listing.refresh();
      return true;
    } finally {
      setSaving(false);
    }
  }

  function openOperation(row, requestedOperation) {
    if (requestedOperation === "start" || requestedOperation === "cancel") {
      void executeOperation(row, requestedOperation);
      return;
    }
    setSelectedAction(row);
    setOperation(requestedOperation);
    setOperationFile(null);
    operationForm.resetFields();
    if (requestedOperation === "close") operationForm.setFieldValue("includeEvidence", false);
    if (requestedOperation === "reassign") operationForm.setFieldValue("responsibleId", row.responsibleId);
    if (requestedOperation === "reschedule") operationForm.setFieldValue("dueDate", row.closeDate || undefined);
  }

  async function saveOperation() {
    let values;
    try {
      values = await operationForm.validateFields();
    } catch {
      message.error(LABOR_ACTION_MESSAGES.incomplete);
      return;
    }

    let attachment = {};
    if (operation === "close" && values.includeEvidence) {
      if (!operationFile) {
        operationForm.setFields([{ name: "evidence", errors: [LABOR_ACTION_MESSAGES.evidenceRequired] }]);
        return;
      }
      setSaving(true);
      try {
        const upload = await uploadIncidentFile(operationFile, {
          caseId: String(selectedAction.incidentId),
          actionId: String(selectedAction.id),
          purpose: "labor-action-close",
        });
        if (!upload.success) {
          message.error(upload.message);
          return;
        }
        attachment = upload.data;
      } finally {
        setSaving(false);
      }
    }

    const payload = {
      ...values,
      ...(operation === "close" ? { includeEvidence: Boolean(values.includeEvidence) } : {}),
      ...attachment,
    };
    delete payload.evidence;
    await executeOperation(selectedAction, operation, payload);
  }

  function acceptEvidence(file) {
    if (!isAcceptedLaborActionEvidence(file?.name)) {
      setOperationFile(null);
      message.error(LABOR_ACTION_MESSAGES.invalidEvidence);
      return Upload.LIST_IGNORE;
    }
    setOperationFile(file);
    operationForm.setFields([{ name: "evidence", errors: [] }]);
    return false;
  }

  const columns = [
    { title: "Número Incidente", dataIndex: "incidentNumber", key: "incidentNumber", width: 170 },
    {
      title: "Fecha Cierre",
      dataIndex: "closeDate",
      key: "closeDate",
      width: 145,
      render: (value) => formatLaborActionCloseDate(value),
    },
    { title: "Nombre Acción", dataIndex: "actionName", key: "actionName", width: 230 },
    { title: "Descripción", dataIndex: "description", key: "description", width: 360, ellipsis: true },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsibleName", width: 230 },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 140,
      render: (name, row) => <StatusTag id={row.statusId} name={name} />,
    },
    {
      title: "Evidencia",
      key: "evidence",
      width: 100,
      render: (_, row) => row.hasEvidence ? (
        <Button
          type="text"
          icon={<DownloadOutlined />}
          onClick={() => downloadEvidence(row.keyS3, row.fileName, `evidencia-${row.id}`)}
          aria-label={`Descargar evidencia ${row.incidentNumber || row.id}`}
        />
      ) : null,
    },
    {
      title: "Histórico",
      key: "history",
      width: 100,
      render: (_, row) => (
        <Button
          type="text"
          icon={<HistoryOutlined />}
          loading={historyLoadingId === row.id}
          onClick={() => toggleHistory(row)}
          aria-label={`Histórico de ${row.actionName || row.id}`}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 58,
      render: (_, row) => {
        const items = buildLaborActionMenuItems(row, user);
        return items.length > 1 ? (
          <Dropdown
            trigger={["click"]}
            menu={{ items, onClick: ({ key }) => key !== "title" && openOperation(row, key) }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label={`Opciones de ${row.actionName || row.id}`} />
          </Dropdown>
        ) : null;
      },
    },
  ];

  function expandedHistory(row) {
    const entries = historyByAction[row.id] || [];
    return (
      <List
        className="legacy-labor-action-history"
        loading={historyLoadingId === row.id}
        dataSource={entries}
        locale={{ emptyText: "No items to show..." }}
        renderItem={(entry) => (
          <List.Item
            actions={Number(entry.statusId) === 5 && entry.s3Key ? [
              <Button
                key="download"
                type="text"
                icon={<DownloadOutlined />}
                onClick={() => downloadEvidence(entry.s3Key, row.fileName, `evidencia-${entry.id}`)}
                aria-label={`Descargar evidencia histórica ${entry.id}`}
              />,
            ] : []}
          >
            <div className="legacy-labor-action-history-row">
              <span>{entry.registeredAt || ""}</span>
              <StatusTag id={entry.statusId} name={entry.statusName} />
              <strong>{entry.userName || ""}</strong>
              <p>{entry.description || ""}</p>
            </div>
          </List.Item>
        )}
      />
    );
  }

  return (
    <div className="legacy-incident-page legacy-action-page">
      <div className="legacy-incident-title-row">
        <h1>Mis Acciones Caso Laboral</h1>
      </div>

      <Form
        layout="vertical"
        className="legacy-incident-filters labor-action-filters"
        initialValues={initialLaborActionFormValues}
        onValuesChange={(_, values) => listing.setFilters(buildLaborActionFilters(values))}
      >
        <DateRangeField label="Fecha Cierre:" name="dateRange" maxDate={laborActionMaxDate} />
        <SelectFilter label="Nombre Acción:" name="actionId" items={listing.catalogs.actions} placeholder="Seleccione Acción" />
        <SelectFilter label="Estado:" name="statusId" items={listing.catalogs.statuses} placeholder="Seleccione Estado" />
        <Form.Item label="Búsqueda:" name="search"><Input.Search allowClear /></Form.Item>
      </Form>

      {(listing.error || evidenceError) && (
        <Alert className="legacy-incident-alert" type="error" showIcon message={listing.error || evidenceError} />
      )}

      <Table
        className="legacy-incident-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: "No items to show..." }}
        pagination={false}
        expandable={{
          expandedRowKeys,
          expandedRowRender: expandedHistory,
          expandIcon: () => null,
          showExpandColumn: false,
        }}
        scroll={{ x: 1600 }}
      />

      <Modal
        title={operationTitles[operation]}
        open={Boolean(operation)}
        onCancel={() => setOperation(null)}
        onOk={saveOperation}
        okText="Actualizar"
        confirmLoading={saving}
      >
        <Form form={operationForm} layout="vertical">
          {operation === "reassign" && (
            <Form.Item name="responsibleId" label="Responsable*" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={options(listing.catalogs.responsiblePeople)}
                placeholder="Seleccione Responsable..."
              />
            </Form.Item>
          )}
          {operation === "reschedule" && (
            <Form.Item name="dueDate" label="Fecha Cierre*" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
          )}
          {operation === "close" && (
            <>
              <Form.Item name="justification" label="Descripción*" rules={[{ required: true, whitespace: true }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item name="includeEvidence" valuePropName="checked">
                <Checkbox>¿Adjuntar evidencia?</Checkbox>
              </Form.Item>
              {includeEvidence && (
                <Form.Item name="evidence" label="Evidencia">
                  <Upload
                    accept=".png,.jpeg,.jpg,.pdf"
                    beforeUpload={acceptEvidence}
                    maxCount={1}
                    onRemove={() => setOperationFile(null)}
                  >
                    <Button>Adjunte Archivo</Button>
                  </Upload>
                </Form.Item>
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
