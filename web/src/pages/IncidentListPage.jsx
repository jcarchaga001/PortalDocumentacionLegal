import { ExportOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Form, message, Table } from "antd";
import { useState } from "react";
import { runtimeConfig } from "../config/runtime.js";
import { exportIncidentHistoryXlsx } from "../services/incidentExportService.js";
import { getIncidents } from "../services/incidentService.js";
import {
  DateRangeField,
  ExportButton,
  IncidentMetrics,
  localIsoDate,
  SelectFilter,
  StatusTag,
} from "./IncidentUi.jsx";
import { useIncidentListing } from "./useIncidentListing.js";

const incidentMaxDate = localIsoDate(1);
const initialDateRange = [localIsoDate(0), incidentMaxDate];
const initialFormValues = { dateRange: initialDateRange };
const initialFilters = {
  startDate: initialDateRange[0],
  endDate: initialDateRange[1],
};

function buildIncidentFilters(values = {}) {
  const { dateRange = [], ...filters } = values;
  return {
    ...filters,
    startDate: dateRange[0] || undefined,
    endDate: dateRange[1] || undefined,
  };
}

const loadInternalIncidents = (query) => getIncidents("internal", query);
const loadExternalIncidents = (query) => getIncidents("external", query);

function IncidentListPage({ scope }) {
  const [exporting, setExporting] = useState(false);
  const external = scope === "external";
  const listing = useIncidentListing({
    catalogScope: scope,
    initialFilters,
    loadData: external ? loadExternalIncidents : loadInternalIncidents,
  });
  const agencyTitle = external ? "Ente Gubernamental" : "Area";
  const columns = [
    { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: 220 },
    { title: agencyTitle, dataIndex: "agencyName", key: "agencyName", width: 200 },
    { title: "Fecha Visita", dataIndex: "visitDate", key: "visitDate", width: 180 },
    { title: "Motivo", dataIndex: "motiveName", key: "motiveName", width: 190 },
    { title: "Recibio Visita", dataIndex: "recipientName", key: "recipientName", width: 220 },
    { title: "Comentario", dataIndex: "comment", key: "comment", width: 360, ellipsis: true },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: 130,
      render: (name, row) => <StatusTag id={row.statusId} name={name} />,
    },
    {
      title: "",
      key: "detail",
      width: 58,
      render: (_, row) => (
        <Button
          type="link"
          icon={<ExportOutlined />}
          href={`${runtimeConfig.basePath}/scrAccionesIncidentes?CodIncidente=${row.id}&codigoSucursal=${row.branchId || ""}&scope=${scope}`}
          aria-label={`Abrir incidente ${row.reference || row.id}`}
        />
      ),
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportIncidentHistoryXlsx(scope, listing.filters);
      if (!result.success) message.error(result.message || "No se pudo descargar el archivo.");
    } catch (error) {
      message.error(error.message || "No se pudo descargar el archivo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="legacy-incident-page">
      <div className="legacy-incident-title-row">
        <h1>{external ? "Control de Incidentes Externos" : "Control de Incidentes Internos"}</h1>
        <div className="legacy-incident-title-actions">
          <Button
            type="link"
            icon={<PlusOutlined />}
            href={`${runtimeConfig.basePath}/${external ? "scrRegistroIncicentesExternos" : "scrRegistroIncidentesInternos"}`}
          >
            Nuevo Incidente
          </Button>
          <ExportButton loading={exporting} onClick={handleExport} />
        </div>
      </div>

      <IncidentMetrics metrics={listing.metrics} />

      <Form
        layout="vertical"
        className="legacy-incident-filters"
        initialValues={initialFormValues}
        onValuesChange={(_, values) => listing.setFilters(buildIncidentFilters(values))}
      >
        <SelectFilter label="Sucursal:" name="branchId" items={listing.catalogs.branches} placeholder="Seleccione Sucursal" />
        <DateRangeField label="Fecha Apertura:" name="dateRange" maxDate={incidentMaxDate} />
        <SelectFilter label="Ente Regulatorio:" name="agencyId" items={listing.catalogs.agencies} placeholder="Seleccione..." />
        <SelectFilter label="Motivo Incidente:" name="motiveId" items={listing.catalogs.motives} placeholder="Seleccione Motivo de Incidente" />
        <SelectFilter label="Estado:" name="statusId" items={listing.catalogs.statuses} placeholder="Seleccione Estado" />
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
        scroll={{ x: 1560 }}
      />
    </div>
  );
}

export function InternalIncidentsPage() {
  return <IncidentListPage scope="internal" />;
}

export function ExternalIncidentsPage() {
  return <IncidentListPage scope="external" />;
}
