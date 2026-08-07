import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Table } from "antd";
import { useHistory } from "react-router-dom";
import { runtimeConfig } from "../config/runtime.js";
import { getIncidentActions } from "../services/incidentService.js";
import { DateRangeField, localIsoDate, SelectFilter, StatusTag } from "./IncidentUi.jsx";
import { useIncidentListing } from "./useIncidentListing.js";

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

const loadInternalActions = (query) => getIncidentActions("internal", query);
const loadExternalActions = (query) => getIncidentActions("external", query);

function IncidentActionsPage({ scope }) {
  const history = useHistory();
  const external = scope === "external";
  const listing = useIncidentListing({
    catalogScope: `${scope}-actions`,
    initialFilters: initialActionFilters,
    loadData: external ? loadExternalActions : loadInternalActions,
  });
  const columns = [
    { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: 220 },
    { title: "Nombre Acción", dataIndex: "actionName", key: "actionName", width: 220 },
    { title: "Descripción", dataIndex: "description", key: "description", width: 330, ellipsis: true },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsibleName", width: 220 },
    { title: "Incidente", dataIndex: "incidentReference", key: "incidentReference", width: 170 },
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
      key: "edit",
      width: 58,
      render: (_, row) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          href={`${runtimeConfig.basePath}/scrAccionesIncidentes?CodIncidente=${row.incidentId}&scope=${scope}&actionId=${row.id}`}
          aria-label={`Abrir acción ${row.actionName || row.id}`}
        />
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

      {listing.error && <Alert className="legacy-incident-alert" type="error" showIcon message={listing.error} />}

      <Table
        className="legacy-incident-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: "No hay registros..." }}
        pagination={{ ...listing.pagination, showSizeChanger: false }}
        onChange={listing.changePage}
        scroll={{ x: 1700 }}
      />
    </div>
  );
}

export function InternalIncidentActionsPage() {
  return <IncidentActionsPage scope="internal" />;
}

export function ExternalIncidentActionsPage() {
  return <IncidentActionsPage scope="external" />;
}
