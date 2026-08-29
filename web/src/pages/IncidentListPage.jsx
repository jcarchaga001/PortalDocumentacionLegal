import { Form, Table } from "antd";
import { useMemo, useState } from "react";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { legacyIncidentDetailHref } from "../config/legacyIncidentContext.js";
import { runtimeConfig } from "../config/runtime.js";
import { exportIncidentHistoryXlsx } from "../services/incidentExportService.js";
import { getIncidents } from "../services/incidentService.js";
import { DateRangeField, localIsoDate, SelectFilter } from "./IncidentUi.jsx";
import {
  formatIncidentListDate,
  INCIDENT_LIST_METRICS,
  INCIDENT_LIST_PAGE_SIZE,
  INCIDENT_LIST_SURFACES,
  incidentListMetrics,
  incidentListPaginationSummary,
  incidentListStatusClass,
} from "./incidentListParity.js";
import { useIncidentListing } from "./useIncidentListing.js";

const incidentMaxDate = localIsoDate(1);
const initialDateRange = [localIsoDate(0), incidentMaxDate];
const initialFormValues = { dateRange: initialDateRange };
const initialFilters = { startDate: initialDateRange[0], endDate: initialDateRange[1] };

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

function IncidentListMetrics({ rows }) {
  const metrics = useMemo(() => incidentListMetrics(rows), [rows]);
  return (
    <div className="legacy-incident-list-metrics" aria-label="Resumen de incidentes de la página actual">
      {INCIDENT_LIST_METRICS.map((metric) => (
        <div className="legacy-incident-list-metric" key={metric.key}>
          <i className={`fa ${metric.icon} ${metric.className}`} aria-hidden="true" />
          <span>{metric.label}</span>
          <strong>{metrics[metric.key]}</strong>
        </div>
      ))}
    </div>
  );
}

function IncidentListStatus({ row }) {
  return (
    <span className={`legacy-incident-list-status ${incidentListStatusClass(row.statusId)}`}>
      {row.statusName || "—"}
    </span>
  );
}

function IncidentListPager({ pagination, rowCount, onChange }) {
  const summary = incidentListPaginationSummary({ ...pagination, rowCount });
  if (!summary) return null;
  const pageCount = Math.ceil(pagination.total / pagination.pageSize);
  return (
    <div className="legacy-incident-list-pager">
      <span>{summary}</span>
      {pageCount > 1 ? (
        <div className="legacy-incident-list-pager-controls">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={pagination.current <= 1}
            onClick={() => onChange({ ...pagination, current: pagination.current - 1 })}
          >
            <i className="fa fa-chevron-left" aria-hidden="true" />
          </button>
          <span>{pagination.current}</span>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={pagination.current >= pageCount}
            onClick={() => onChange({ ...pagination, current: pagination.current + 1 })}
          >
            <i className="fa fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function IncidentListPage({ scope }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const surface = INCIDENT_LIST_SURFACES[scope];
  const external = scope === "external";
  const listing = useIncidentListing({
    catalogScope: surface.catalogScope,
    initialFilters,
    initialPageSize: INCIDENT_LIST_PAGE_SIZE,
    loadData: external ? loadExternalIncidents : loadInternalIncidents,
    resetPageOnFilters: false,
  });
  const widths = surface.columnWidths;
  const columns = [
    { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: widths[0] },
    { title: surface.agencyColumn, dataIndex: "agencyName", key: "agencyName", width: widths[1] },
    { title: "Fecha Visita", dataIndex: "visitDate", key: "visitDate", width: widths[2], render: formatIncidentListDate },
    { title: "Motivo", dataIndex: "motiveName", key: "motiveName", width: widths[3] },
    { title: "Recibio Visita", dataIndex: "recipientName", key: "recipientName", width: widths[4] },
    { title: "Comentario", dataIndex: "comment", key: "comment", width: widths[5] },
    {
      title: "Estado",
      dataIndex: "statusName",
      key: "statusName",
      width: widths[6],
      render: (_, row) => <IncidentListStatus row={row} />,
    },
    {
      title: "",
      key: "detail",
      width: widths[7],
      render: (_, row) => (
        <a
          className="legacy-incident-list-detail"
          href={legacyIncidentDetailHref(runtimeConfig.basePath, surface.detailRoute, row.id, row.branchId)}
          aria-label={`Abrir incidente ${row.reference || row.id}`}
        >
          <i className="fa fa-external-link" aria-hidden="true" />
        </a>
      ),
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const result = await exportIncidentHistoryXlsx(scope, listing.filters);
      if (!result.success) setExportError(result.message || "No se pudo descargar el archivo.");
    } catch (error) {
      setExportError(error.message || "No se pudo descargar el archivo.");
    } finally {
      setExporting(false);
    }
  };

  const feedback = exportError || listing.error || listing.catalogError;
  return (
    <div className={`legacy-incident-page legacy-incident-list-page is-${scope}`} data-legacy-screen={surface.screen}>
      <LegacyErrorFeedback message={feedback} />
      <div className="legacy-incident-list-title-row">
        <h1>{surface.title}</h1>
        <div className="legacy-incident-list-title-actions">
          <a href={`${runtimeConfig.basePath}/${surface.createRoute}`}>+ Nuevo Incidente</a>
          <button
            type="button"
            className="legacy-incident-list-export"
            aria-label="Descargar Excel"
            title="Descargar Excel"
            disabled={exporting}
            onClick={handleExport}
          >
            <i className={`fa ${exporting ? "fa-spinner fa-spin" : "fa-file-excel-o"}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <IncidentListMetrics rows={listing.rows} />

      <Form
        layout="vertical"
        className="legacy-incident-filters legacy-incident-list-filters"
        initialValues={initialFormValues}
        onValuesChange={(_, values) => listing.setFilters(buildIncidentFilters(values))}
      >
        <SelectFilter label="Sucursal:" name="branchId" items={listing.catalogs.branches} placeholder="Seleccione Sucursal" />
        <DateRangeField label="Fecha Apertura:" name="dateRange" maxDate={incidentMaxDate} />
        <SelectFilter label="Ente Regulatorio:" name="agencyId" items={listing.catalogs.agencies} placeholder="Seleccione..." />
        <SelectFilter label="Motivo Incidente:" name="motiveId" items={listing.catalogs.motives} placeholder="Seleccione Motivo de Incidente" />
        <SelectFilter label="Estado:" name="statusId" items={listing.catalogs.statuses} placeholder="Seleccione Estado" />
      </Form>

      <Table
        className="legacy-incident-table legacy-incident-list-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: null }}
        pagination={false}
        tableLayout="fixed"
      />
      {!listing.loading && listing.rows.length === 0 ? <div className="legacy-incident-list-empty">No hay registros...</div> : null}
      <IncidentListPager pagination={listing.pagination} rowCount={listing.rows.length} onChange={listing.changePage} />
    </div>
  );
}

export function InternalIncidentsPage() {
  return <IncidentListPage scope="internal" />;
}

export function ExternalIncidentsPage() {
  return <IncidentListPage scope="external" />;
}
