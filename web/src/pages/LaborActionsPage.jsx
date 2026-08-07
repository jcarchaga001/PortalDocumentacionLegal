import { DownloadOutlined, EditOutlined, HistoryOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Table } from "antd";
import { useState } from "react";
import { runtimeConfig } from "../config/runtime.js";
import { getLaborActions } from "../services/incidentService.js";
import { downloadBlob } from "../services/fileHelpers.js";
import { downloadS3File } from "../services/tdS3Service.js";
import { DateRangeField, localIsoDate, localMonthStartIso, SelectFilter, StatusTag } from "./IncidentUi.jsx";
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

const loadLaborActions = (query) => getLaborActions(query);

export function LaborActionsPage() {
  const [evidenceError, setEvidenceError] = useState("");
  const listing = useIncidentListing({
    catalogScope: "labor-actions",
    initialFilters: initialLaborActionFilters,
    loadData: loadLaborActions,
  });

  async function downloadEvidence(row) {
    setEvidenceError("");
    const result = await downloadS3File({ s3Key: row.keyS3 });
    if (result.success) {
      downloadBlob(result.data, row.fileName || `evidencia-${row.id}`);
    } else {
      setEvidenceError(result.message || "No fue posible descargar la evidencia.");
    }
  }

  const columns = [
    { title: "Número Incidente", dataIndex: "incidentNumber", key: "incidentNumber", width: 170 },
    { title: "Fecha Cierre", dataIndex: "closeDate", key: "closeDate", width: 145, render: (value) => value || "—" },
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
        <Button type="text" icon={<DownloadOutlined />} onClick={() => downloadEvidence(row)} aria-label={`Descargar evidencia ${row.incidentNumber || row.id}`} />
      ) : <span>No adjuntada</span>,
    },
    {
      title: "Histórico",
      key: "history",
      width: 100,
      render: (_, row) => (
        <Button
          type="text"
          icon={<HistoryOutlined />}
          href={`${runtimeConfig.basePath}/srcAccionesIncidentesLegal?CodIncidente=${row.incidentId}&actionId=${row.id}`}
          aria-label={`Histórico de ${row.actionName || row.id}`}
        />
      ),
    },
    {
      title: "",
      key: "edit",
      width: 58,
      render: (_, row) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          href={`${runtimeConfig.basePath}/srcAccionesIncidentesLegal?CodIncidente=${row.incidentId}`}
          aria-label={`Actualizar ${row.actionName || row.id}`}
        />
      ),
    },
  ];

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
        pagination={{ ...listing.pagination, showSizeChanger: false }}
        onChange={listing.changePage}
        scroll={{ x: 1600 }}
      />
    </div>
  );
}
