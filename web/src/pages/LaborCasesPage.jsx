import { ExportOutlined, MoreOutlined } from "@ant-design/icons";
import { Alert, Button, Dropdown, Form, Input, message, Modal, Select, Switch, Table } from "antd";
import { useState } from "react";
import { useHistory } from "react-router-dom";
import { runtimeConfig } from "../config/runtime.js";
import { exportLaborCaseHistoryXlsx } from "../services/incidentExportService.js";
import { getLaborCases, updateLaborCase } from "../services/incidentService.js";
import {
  DateRangeField,
  ExportButton,
  IncidentMetrics,
  localIsoDate,
  localMonthStartIso,
  options,
  SelectFilter,
  StatusTag,
} from "./IncidentUi.jsx";
import { useIncidentListing } from "./useIncidentListing.js";

const laborMaxDate = localIsoDate(0);
const initialLaborDateRange = [localMonthStartIso(), laborMaxDate];
const initialLaborFormValues = {
  dateRange: initialLaborDateRange,
  activeEmployees: true,
};
const initialLaborFilters = {
  startDate: initialLaborDateRange[0],
  endDate: initialLaborDateRange[1],
  activeEmployees: true,
};

function buildLaborFilters(values = {}) {
  const { dateRange = [], ...filters } = values;
  return {
    ...filters,
    startDate: dateRange[0] || undefined,
    endDate: dateRange[1] || undefined,
  };
}

const loadLaborCases = (query) => getLaborCases(query);

export function LaborCasesPage() {
  const history = useHistory();
  const [exporting, setExporting] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [mutatingCaseId, setMutatingCaseId] = useState(null);
  const [reassignCase, setReassignCase] = useState(null);
  const [reassignForm] = Form.useForm();
  const listing = useIncidentListing({
    catalogScope: "labor-cases",
    initialFilters: initialLaborFilters,
    loadData: loadLaborCases,
  });
  const columns = [
    { title: "Sucursal", dataIndex: "branchName", key: "branchName", width: 220 },
    { title: "Fecha Registro", dataIndex: "registrationDate", key: "registrationDate", width: 180 },
    { title: "Número Incidente", dataIndex: "incidentNumber", key: "incidentNumber", width: 160 },
    { title: "Responsable Incidente", dataIndex: "responsibleName", key: "responsibleName", width: 230 },
    { title: "Empleado Infractor", dataIndex: "employeeName", key: "employeeName", width: 230 },
    { title: "Puesto Empleado Infractor", dataIndex: "employeePosition", key: "employeePosition", width: 220 },
    { title: "DNI", dataIndex: "identityNumber", key: "identityNumber", width: 160 },
    { title: "Fecha de Conocimiento", dataIndex: "awarenessDate", key: "awarenessDate", width: 190 },
    { title: "Fecha del Hecho", dataIndex: "eventDate", key: "eventDate", width: 170 },
    { title: "Nivel de Seguridad", dataIndex: "securityLevel", key: "securityLevel", width: 180 },
    { title: "Prioridad", dataIndex: "priorityName", key: "priorityName", width: 120 },
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
      width: 110,
      render: (_, row) => {
        const items = [
          { key: "title", label: "Opciones de Acción", disabled: true },
          { key: "detail", label: "Ver Detalle" },
          { key: "reassign", label: "Reasignar Responsable" },
          { key: "cancel", label: "Anular Caso" },
        ];
        return (
          <div className="legacy-row-actions">
            <Dropdown
              trigger={["click"]}
              menu={{ items, onClick: ({ key }) => handleRowAction(row, key) }}
            >
              <Button
                type="text"
                icon={<MoreOutlined />}
                loading={Number(mutatingCaseId) === Number(row.id)}
                aria-label={`Opciones de ${row.incidentNumber || row.id}`}
              />
            </Dropdown>
            <Button
              type="text"
              icon={<ExportOutlined />}
              href={`${runtimeConfig.basePath}/srcAccionesIncidentesLegal?CodIncidente=${row.id}`}
              aria-label={`Abrir caso ${row.incidentNumber || row.id}`}
            />
          </div>
        );
      },
    },
  ];

  function detailPath(row) {
    return `/srcAccionesIncidentesLegal?CodIncidente=${row.id}`;
  }

  function handleRowAction(row, operation) {
    if (operation === "detail") {
      history.push(detailPath(row));
      return;
    }
    if (operation === "reassign") {
      setMutationError("");
      setReassignCase(row);
      reassignForm.setFieldsValue({ responsibleId: row.responsibleId || undefined });
      return;
    }
    if (operation === "cancel") cancelCase(row);
  }

  async function cancelCase(row) {
    setMutatingCaseId(row.id);
    setMutationError("");
    try {
      const result = await updateLaborCase(row.id, { operation: "cancel" });
      if (!result.success) {
        setMutationError(result.message || "No fue posible anular el caso laboral.");
        return;
      }
      message.success("Caso laboral anulado correctamente.");
      listing.refresh();
    } catch (error) {
      setMutationError(error.message || "No fue posible anular el caso laboral.");
    } finally {
      setMutatingCaseId(null);
    }
  }

  async function saveReassignment() {
    try {
      const values = await reassignForm.validateFields();
      setMutatingCaseId(reassignCase.id);
      setMutationError("");
      const result = await updateLaborCase(reassignCase.id, {
        operation: "reassign",
        responsibleId: values.responsibleId,
      });
      if (!result.success) {
        setMutationError(result.message || "No fue posible reasignar el caso laboral.");
        return;
      }
      setReassignCase(null);
      reassignForm.resetFields();
      message.success("Responsable reasignado correctamente.");
      listing.refresh();
    } catch (error) {
      if (error?.errorFields) return;
      setMutationError(error.message || "No fue posible reasignar el caso laboral.");
    } finally {
      setMutatingCaseId(null);
    }
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportLaborCaseHistoryXlsx(listing.filters);
      if (!result.success) message.error(result.message || "No se pudo descargar el archivo.");
    } catch (error) {
      message.error(error.message || "No se pudo descargar el archivo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="legacy-incident-page legacy-labor-page">
      <div className="legacy-incident-title-row">
        <h1>Control Casos Laborales</h1>
        <ExportButton loading={exporting} onClick={handleExport} />
      </div>

      <IncidentMetrics metrics={listing.metrics} labor />

      <Form
        layout="vertical"
        className="legacy-incident-filters labor-filters"
        initialValues={initialLaborFormValues}
        onValuesChange={(_, values) => listing.setFilters(buildLaborFilters(values))}
      >
        <SelectFilter label="Sucursal:" name="branchId" items={listing.catalogs.branches} placeholder="Seleccione Sucursal" />
        <DateRangeField label="Fecha del Hecho:" name="dateRange" maxDate={laborMaxDate} />
        <SelectFilter label="Nivel de Seguridad:" name="levelId" items={listing.catalogs.levels} placeholder="Seleccione Nivel Seguridad" />
        <SelectFilter label="Responsable:" name="responsibleId" items={listing.catalogs.responsiblePeople} placeholder="Seleccione Responsable" />
        <SelectFilter label="Estado:" name="statusId" items={listing.catalogs.statuses} placeholder="Seleccione Estado" />
        <Form.Item label="Búsqueda:" name="search"><Input.Search allowClear /></Form.Item>
        <Form.Item label="Personal Activo" name="activeEmployees" valuePropName="checked" className="legacy-active-switch">
          <Switch />
        </Form.Item>
      </Form>

      {(listing.error || mutationError) && (
        <Alert className="legacy-incident-alert" type="error" showIcon message={listing.error || mutationError} />
      )}

      <Table
        className="legacy-incident-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: "No hay registros..." }}
        pagination={{ ...listing.pagination, showSizeChanger: false }}
        onChange={listing.changePage}
        scroll={{ x: 2450 }}
      />

      <Modal
        title="Reasignar Usuario"
        open={Boolean(reassignCase)}
        onCancel={() => {
          setReassignCase(null);
          reassignForm.resetFields();
        }}
        onOk={saveReassignment}
        okText="Actualizar"
        cancelButtonProps={{ style: { display: "none" } }}
        confirmLoading={Boolean(reassignCase) && Number(mutatingCaseId) === Number(reassignCase.id)}
        forceRender
      >
        <Form form={reassignForm} layout="vertical">
          <Form.Item
            name="responsibleId"
            label="Responsable*"
            rules={[{ required: true, message: "Seleccione un responsable." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={options(listing.catalogs.responsiblePeople)}
              placeholder="Seleccione Responsable..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
