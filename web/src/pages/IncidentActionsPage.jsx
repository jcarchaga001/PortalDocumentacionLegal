import {
  ArrowLeftOutlined,
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
  Modal,
  Select,
  Table,
  Upload,
  message,
} from "antd";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { useAuth } from "../config/AuthContext.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { downloadBlob } from "../services/fileHelpers.js";
import { uploadIncidentFile } from "../services/incidentFileService.js";
import {
  getIncident,
  getIncidentActions,
  updateIncidentAction,
} from "../services/incidentService.js";
import { downloadS3File } from "../services/tdS3Service.js";
import {
  DateRangeField,
  localIsoDate,
  options,
  SelectFilter,
  StatusTag,
} from "./IncidentUi.jsx";
import {
  getIncidentActionMenu,
  getIncidentActionQueryPresentation,
  getIncidentActionSurface,
  incidentActionModalTitle,
  runIncidentActionOperation,
} from "./incidentActionSurface.js";
import { useIncidentListing } from "./useIncidentListing.js";
import "./IncidentActionsPage.css";

const actionMaxDate = localIsoDate(1);
const initialActionDateRange = [localIsoDate(0), actionMaxDate];
const initialActionFormValues = {
  startDateRange: initialActionDateRange,
  dueDateRange: initialActionDateRange,
};
const initialActionFilters = {
  startDate: initialActionDateRange[0],
  endDate: initialActionDateRange[1],
  dueStartDate: initialActionDateRange[0],
  dueEndDate: initialActionDateRange[1],
};

function buildActionFilters(values = {}) {
  const { startDateRange = [], dueDateRange = [], ...filters } = values;
  return {
    ...filters,
    startDate: startDateRange[0] || undefined,
    endDate: startDateRange[1] || undefined,
    dueStartDate: dueDateRange[0] || undefined,
    dueEndDate: dueDateRange[1] || undefined,
  };
}

function display(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function IncidentDrawerField({ label, children }) {
  return (
    <div className="legacy-action-drawer-field">
      <span>{label}</span>
      <strong>{display(children)}</strong>
    </div>
  );
}

const loadInternalActions = (query) => getIncidentActions("internal", query);
const loadExternalActions = (query) => getIncidentActions("external", query);

function IncidentActionsPage({ scope }) {
  const history = useHistory();
  const { user } = useAuth();
  const surface = getIncidentActionSurface(scope);
  const external = surface.external;
  const listing = useIncidentListing({
    catalogScope: `${scope}-actions`,
    initialFilters: initialActionFilters,
    initialPageSize: 50,
    loadData: external ? loadExternalActions : loadInternalActions,
  });
  const [selectedAction, setSelectedAction] = useState(null);
  const [operation, setOperation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [operationForm] = Form.useForm();
  const [detailRow, setDetailRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const queryPresentation = getIncidentActionQueryPresentation({
    rows: listing.rows,
    loading: listing.loading,
    pagination: { ...listing.pagination, showSizeChanger: false },
    errorCode: listing.errorCode,
  });

  const canMutate = (row) => Number(user?.id) === 1
    || Number(row.responsibleId) === Number(user?.id);

  async function runOperation(row, nextOperation, values = {}, file = null) {
    setSaving(true);
    try {
      const result = await runIncidentActionOperation({
        scope,
        row,
        operation: nextOperation,
        values,
        evidenceFile: file,
        uploadEvidence: uploadIncidentFile,
        updateAction: updateIncidentAction,
      });
      if (!result.success) {
        if (result.field === "evidence") {
          operationForm.setFields([{ name: "evidence", errors: [result.message] }]);
        } else {
          message.error(result.message || "No fue posible actualizar la acción.");
        }
        return false;
      }
      message.success("Se ha actualizado el estado");
      setOperation(null);
      setSelectedAction(null);
      setEvidenceFile(null);
      operationForm.resetFields();
      listing.refresh();
      return true;
    } catch (error) {
      message.error(error.message || "No fue posible actualizar la acción.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openOperation(row, nextOperation) {
    if (nextOperation === "start") {
      runOperation(row, nextOperation);
      return;
    }
    setSelectedAction(row);
    setOperation(nextOperation);
    setEvidenceFile(null);
    operationForm.resetFields();
    if (nextOperation === "reassign") {
      operationForm.setFieldValue("responsibleId", row.responsibleId);
    }
    if (nextOperation === "reschedule") {
      operationForm.setFieldValue("dueDate", row.expectedDueDate);
    }
  }

  async function saveOperation() {
    try {
      const values = await operationForm.validateFields();
      await runOperation(selectedAction, operation, values, evidenceFile);
    } catch {
      // Ant Design mantiene la validación visible.
    }
  }

  async function openExternalDetail(row) {
    setDetailRow(row);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    const result = await getIncident("external", row.incidentId);
    if (result.success) setDetail(result.data);
    else setDetailError(result.message || "No fue posible consultar el incidente.");
    setDetailLoading(false);
  }

  async function downloadIncidentEvidence() {
    if (!detail?.s3Key) return;
    const result = await downloadS3File({ s3Key: detail.s3Key });
    if (result.success) {
      downloadBlob(result.data, `incidente-${detail.reference || detail.id}`);
    } else {
      message.error(result.message || "No fue posible descargar el archivo.");
    }
  }

  const columns = [
    { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: 220 },
    { title: "Nombre Acción", dataIndex: "actionName", key: "actionName", width: 220 },
    { title: "Descripción", dataIndex: "description", key: "description", width: 330, ellipsis: true },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsibleName", width: 220 },
    {
      title: "Incidente",
      dataIndex: "incidentReference",
      key: "incidentReference",
      width: 170,
      render: (reference, row) => external ? (
        <Button type="link" className="legacy-action-reference" onClick={() => openExternalDetail(row)}>
          {display(reference)}
        </Button>
      ) : display(reference),
    },
    { title: "Fecha Inicio", dataIndex: "startDate", key: "startDate", width: 140 },
    { title: "Fecha Probable Vencimiento", dataIndex: "expectedDueDate", key: "expectedDueDate", width: 190 },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 140,
      render: (name, row) => <StatusTag id={row.statusId} name={name} />,
    },
    {
      title: "",
      key: "actions",
      width: 58,
      render: (_, row) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: getIncidentActionMenu({ statusId: row.statusId, canMutate: canMutate(row) }),
            onClick: ({ key }) => openOperation(row, key),
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label={`Opciones de ${row.actionName || row.id}`} />
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="legacy-incident-page legacy-action-page">
      <button type="button" className="legacy-incident-back" onClick={() => history.goBack()}>
        <ArrowLeftOutlined /> Regresar pantalla anterior...
      </button>
      <div className="legacy-incident-title-row">
        <h1>{external ? "Acciones Incidentes Externos" : "Acciones Incidentes Internos"}</h1>
      </div>

      <Form
        layout="vertical"
        className="legacy-incident-filters has-six"
        initialValues={initialActionFormValues}
        onValuesChange={(_, values) => listing.setFilters(buildActionFilters(values))}
      >
        <SelectFilter label="Sucursal" name="branchId" items={listing.catalogs.branches} placeholder="Seleccione Sucursal" />
        <DateRangeField label="Fecha Inicio" name="startDateRange" maxDate={actionMaxDate} />
        <SelectFilter label="Responsable" name="responsibleId" items={listing.catalogs.responsiblePeople} placeholder="Seleccione Usuario" />
        <SelectFilter label="Estado" name="statusId" items={listing.catalogs.statuses} placeholder="Seleccione Estado" />
        <Form.Item label="Buscar Referencia" name="search"><Input allowClear /></Form.Item>
        <DateRangeField label="Fecha Vencimiento" name="dueDateRange" maxDate={actionMaxDate} />
      </Form>

      {queryPresentation.showError && (
        <LegacyErrorFeedback
          key={`${scope}-${JSON.stringify(listing.filters)}`}
          message={queryPresentation.errorMessage}
        />
      )}

      <Table
        className="legacy-incident-table"
        rowKey="id"
        columns={columns}
        dataSource={queryPresentation.rows}
        loading={queryPresentation.loading}
        locale={{ emptyText: "No hay registros..." }}
        pagination={queryPresentation.pagination}
        onChange={listing.changePage}
        scroll={{ x: 1700 }}
      />

      <Modal
        title={incidentActionModalTitle(operation)}
        open={Boolean(operation)}
        onCancel={() => setOperation(null)}
        onOk={saveOperation}
        okText="Actualizar"
        confirmLoading={saving}
      >
        <Form form={operationForm} layout="vertical">
          {operation === "reassign" && (
            <Form.Item name="responsibleId" label="Responsable*" rules={[{ required: true, message: "Debe Seleccionar un Responsable" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={options(listing.catalogs.responsiblePeople)}
                placeholder="Seleccione Responsable..."
              />
            </Form.Item>
          )}
          {operation === "reschedule" && (
            <Form.Item name="dueDate" label="Fecha Probable Vencimiento*" rules={[{ required: true, message: "Debe Seleccionar una fecha válida" }]}>
              <Input type="date" min={localIsoDate(0)} />
            </Form.Item>
          )}
          {["cancel", "close"].includes(operation) && (
            <Form.Item name="justification" label="Justificación*" rules={[{ required: true, whitespace: true, message: "Ingresar justificación" }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
          )}
          {operation === "close" && (
            <Form.Item name="evidence" label="Evidencia*">
              <Upload
                beforeUpload={() => false}
                maxCount={1}
                onChange={({ fileList }) => setEvidenceFile(fileList[0]?.originFileObj || null)}
              >
                <Button icon={<UploadOutlined />}>Adjuntar documento</Button>
              </Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {external && (
        <Drawer
          className="legacy-action-detail-drawer"
          title="Detalle Incidente Externo"
          open={Boolean(detailRow)}
          onClose={() => setDetailRow(null)}
          width={450}
        >
          {detailLoading && <div className="legacy-incident-loading">Cargando Información...</div>}
          {detailError && <div className="legacy-action-detail-error">{detailError}</div>}
          {detail && (
            <>
              <Button
                type="link"
                className="legacy-action-go-incident"
                href={`${runtimeConfig.basePath}/scrAccionesIncidentes?CodIncidente=${detail.id}&codigoSucursal=${detail.branchId || ""}&scope=external`}
              >
                Ir a Incidente
              </Button>
              <div className="legacy-action-drawer-reference">N°: {display(detail.reference)}</div>
              <IncidentDrawerField label="Sucursal">{detail.branchName}</IncidentDrawerField>
              <IncidentDrawerField label="Tipo Incidente">{detail.typeName}</IncidentDrawerField>
              <IncidentDrawerField label="Motivo Incidente">{detail.motiveName}</IncidentDrawerField>
              <IncidentDrawerField label="Categoría Incidente">{detail.categoryId}</IncidentDrawerField>
              <IncidentDrawerField label="Fecha de Registro">{detail.registrationDate || detail.openingDate}</IncidentDrawerField>
              <IncidentDrawerField label="Recibio Visita">{detail.visitorName}</IncidentDrawerField>
              <IncidentDrawerField label="Usuario Registró">{detail.registeredByName}</IncidentDrawerField>
              <IncidentDrawerField label="Descargar Archivo">
                {detail.s3Key ? (
                  <Button type="link" icon={<DownloadOutlined />} onClick={downloadIncidentEvidence}>
                    Descargar Archivo...
                  </Button>
                ) : "—"}
              </IncidentDrawerField>
              <div className="legacy-action-drawer-long-field"><span>Comentario Visita</span><p>{display(detail.comment)}</p></div>
              <div className="legacy-action-drawer-long-field"><span>Justificación</span><p>{display(detail.justification)}</p></div>
            </>
          )}
        </Drawer>
      )}
    </div>
  );
}

export function InternalIncidentActionsPage() {
  return <IncidentActionsPage scope="internal" />;
}

export function ExternalIncidentActionsPage() {
  return <IncidentActionsPage scope="external" />;
}
