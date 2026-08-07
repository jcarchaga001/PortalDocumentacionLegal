import { ArrowRightOutlined, CheckOutlined, CloseOutlined, FileExcelOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Select, Table, message } from "antd";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyDateRangePicker } from "../components/LegacyDateRangePicker.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { getAgreementCatalogs, getAgreements } from "../services/agreementService.js";
import { exportRowsToXlsx } from "../services/spreadsheetService.js";

function buildFilters(values = {}, page = 1, pageSize = 50) {
  const dateRange = values.dateRange || [];
  return {
    clientId: values.clientId,
    startDate: dateRange[0] || undefined,
    endDate: dateRange[1] || undefined,
    indefinite: values.indefinite,
    page,
    pageSize,
  };
}

export function AgreementsPage() {
  const history = useHistory();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });

  async function load(values = {}, page = 1, pageSize = pagination.pageSize) {
    setLoading(true);
    const result = await getAgreements(buildFilters(values, page, pageSize));
    if (result.success) {
      setRows(result.data?.items || []);
      setPagination({
        current: result.data?.page || page,
        pageSize: result.data?.pageSize || pageSize,
        total: result.data?.total || 0,
      });
    } else {
      message.error(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    Promise.all([getAgreementCatalogs(), getAgreements({ page: 1, pageSize: 50 })]).then(([catalogResult, listResult]) => {
      if (!active) return;
      if (catalogResult.success) setClients(catalogResult.data?.clients || []);
      if (listResult.success) {
        setRows(listResult.data?.items || []);
        setPagination({
          current: listResult.data?.page || 1,
          pageSize: listResult.data?.pageSize || 50,
          total: listResult.data?.total || 0,
        });
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function exportExcel() {
    setExporting(true);
    const result = await getAgreements(buildFilters(form.getFieldsValue(), 1, 100));
    if (result.success) {
      await exportRowsToXlsx({
        fileName: "Convenios Clientes Corporativos.xlsx",
        sheetName: "Convenios",
        columns: [
          { title: "Nombre Cliente", key: "clientName", width: 35 },
          { title: "Sucursal", key: "accountManagerArea", width: 40 },
          { title: "Gestor de Cuenta", key: "accountManagerName", width: 30 },
          { title: "Límite de Crédito", key: "creditLimit", width: 18 },
          { title: "Días de Crédito", key: "creditDays", width: 16 },
          { title: "Tiene Pagaré", key: "hasPromissoryNote", width: 15 },
          { title: "Estatus Pagaré", key: "promissoryStatus", width: 18 },
          { title: "Fecha Inicio Convenio", key: "startDate", width: 20 },
          { title: "Fecha Final Convenio", key: "endDate", width: 20 },
        ],
        rows: (result.data?.items || []).map((item) => ({
          ...item,
          hasPromissoryNote: item.hasPromissoryNote ? "Sí" : "No",
          promissoryStatus: item.hasPromissoryNote
            ? (item.isPromissoryNoteExpired ? "Vencido" : "En Vigencia")
            : "",
          endDate: item.isIndefinite ? "Indefinido" : item.endDate,
        })),
      });
    } else {
      message.error(result.message);
    }
    setExporting(false);
  }

  function clearDateRange() {
    const values = { ...form.getFieldsValue(), dateRange: ["", ""] };
    form.setFieldsValue({ dateRange: values.dateRange });
    load(values, 1, pagination.pageSize);
  }

  const columns = [
    { title: "Nombre Cliente", dataIndex: "clientName", key: "clientName", width: 260 },
    { title: "Sucursal", dataIndex: "accountManagerArea", key: "accountManagerArea", width: 250, ellipsis: true },
    { title: "Gestor de Cuenta", dataIndex: "accountManagerName", key: "accountManagerName", width: 200 },
    {
      title: "Límite de Crédito",
      dataIndex: "creditLimit",
      key: "creditLimit",
      width: 145,
      render: (value, record) => `${record.isDollar ? "US $ " : ""}${Number(value || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    { title: "Días de Crédito", dataIndex: "creditDays", key: "creditDays", width: 135 },
    { title: "Tiene Pagaré", dataIndex: "hasPromissoryNote", key: "hasPromissoryNote", width: 120, render: (value) => (value ? "Sí" : "No") },
    {
      title: "Estatus Pagaré",
      key: "promissoryStatus",
      width: 145,
      render: (_, record) => record.hasPromissoryNote ? (record.isPromissoryNoteExpired ? "Vencido" : "En Vigencia") : "",
    },
    { title: "Fecha Inicio Convenio", dataIndex: "startDate", key: "startDate", width: 170 },
    { title: "Fecha Final Convenio", key: "endDate", width: 170, render: (_, record) => record.isIndefinite ? "Indefinido" : record.endDate },
    { title: "Centralizado", key: "centralized", width: 120, align: "center", render: (_, record) => record.isCentralized ? <CheckOutlined /> : null },
    {
      title: "",
      key: "actions",
      fixed: "right",
      width: 58,
      render: (_, record) => (
        <Button
          type="text"
          icon={<ArrowRightOutlined />}
          aria-label="Ver convenio"
          onClick={() => history.push(`${ROUTES.agreementDetail}?CodConvenio=${record.id}`)}
        />
      ),
    },
  ];

  return (
    <div className="legacy-list-page legacy-agreements-page">
      <div className="legacy-list-toolbar">
        <Button type="text" icon={<FileExcelOutlined />} loading={exporting} onClick={exportExcel} aria-label="Descargar Excel" />
        <Button type="link" icon={<PlusOutlined />} onClick={() => history.push(ROUTES.agreementCreate)}>Nuevo Convenio</Button>
      </div>
      <h1>Convenios Clientes Corporativos</h1>
      <Form
        form={form}
        layout="vertical"
        className="legacy-list-filters legacy-agreement-filters"
        onValuesChange={(_, values) => load(values, 1, pagination.pageSize)}
      >
        <Form.Item label="Nombre Cliente" name="clientId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Select..." options={clients.map((item) => ({ value: item.id, label: item.name }))} />
        </Form.Item>
        <Form.Item label="Fecha Final">
          <div className="legacy-agreement-date-filter">
            <Form.Item name="dateRange" noStyle>
              <LegacyDateRangePicker
                className="full-width"
                placeholder="Select a date range"
                aria-label="Select a date range"
              />
            </Form.Item>
            <button
              type="button"
              className="legacy-agreement-date-clear"
              aria-label="Limpiar fecha final"
              title="Limpiar fecha final"
              onClick={clearDateRange}
            >
              <CloseOutlined />
            </button>
          </div>
        </Form.Item>
        <Form.Item label="Indefinidos" name="indefinite" valuePropName="checked"><Checkbox /></Form.Item>
      </Form>
      <Table
        className="legacy-history-table"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 1850 }}
        pagination={{ ...pagination, showSizeChanger: false }}
        onChange={(next) => load(form.getFieldsValue(), next.current, next.pageSize)}
        rowClassName={(record) => record.expirationStatus === "Por Vencer" ? "is-expiring" : record.expirationStatus === "Vencido" ? "is-expired" : ""}
      />
    </div>
  );
}
