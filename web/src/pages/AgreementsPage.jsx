import { Checkbox, Select } from "antd";
import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyDateRangePicker } from "../components/LegacyDateRangePicker.jsx";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { getAgreementClients, getAgreements } from "../services/agreementService.js";
import { exportRowsToXlsx } from "../services/spreadsheetService.js";
import {
  AGREEMENTS_COLUMNS,
  AGREEMENTS_EXPORT_FILE,
  AGREEMENTS_PAGE_SIZE,
  AGREEMENTS_QUERY_ERROR,
  agreementEndDate,
  agreementPaginationSummary,
  agreementPromissoryStatus,
  agreementRowClassName,
  buildAgreementFilters,
  formatAgreementCurrency,
} from "./agreementsParity.js";
import "./AgreementsPage.css";

const EMPTY_RANGE = ["", ""];

function exportRows(rows) {
  return rows.map((record) => ({
    clientName: record.clientName || "",
    accountManagerArea: record.accountManagerArea || "",
    accountManagerName: record.accountManagerName || "",
    creditLimit: formatAgreementCurrency(record.creditLimit, record.isDollar, record.currencySymbol),
    creditDays: record.creditDays ?? "",
    hasPromissoryNote: record.hasPromissoryNote ? "Sí" : "No",
    promissoryStatus: agreementPromissoryStatus(record),
    startDate: record.startDate || "",
    endDate: agreementEndDate(record),
    centralized: record.isCentralized ? "Sí" : "",
  }));
}

function AgreementCell({ column, record, onOpen }) {
  if (column.key === "creditLimit") {
    return formatAgreementCurrency(record.creditLimit, record.isDollar, record.currencySymbol);
  }
  if (column.key === "hasPromissoryNote") return record.hasPromissoryNote ? "Sí" : "No";
  if (column.key === "promissoryStatus") return agreementPromissoryStatus(record);
  if (column.key === "endDate") return agreementEndDate(record);
  if (column.key === "centralized") {
    return record.isCentralized
      ? <i className="fa fa-check agreements-page__status-icon" aria-label="Centralizado" />
      : null;
  }
  if (column.key === "actions") {
    return (
      <button
        type="button"
        className="agreements-page__detail"
        title="Ver Detalle"
        aria-label="Ver Detalle"
        onClick={() => onOpen(record.id)}
      >
        <i className="fa fa-external-link" aria-hidden="true" />
      </button>
    );
  }
  return record[column.key] ?? "";
}

export function AgreementsPage() {
  const history = useHistory();
  const pickerRef = useRef(null);
  const clearOnlyRef = useRef(false);
  const requestRef = useRef(0);
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [clientId, setClientId] = useState(undefined);
  const [visibleDateRange, setVisibleDateRange] = useState(EMPTY_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState(EMPTY_RANGE);
  const [indefinite, setIndefinite] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: AGREEMENTS_PAGE_SIZE,
    total: 0,
  });

  async function load(next = {}, page = 1) {
    const requestId = ++requestRef.current;
    setLoading(true);
    setFeedback("");
    const filters = buildAgreementFilters({
      clientId: Object.hasOwn(next, "clientId") ? next.clientId : clientId,
      appliedDateRange: Object.hasOwn(next, "appliedDateRange")
        ? next.appliedDateRange
        : appliedDateRange,
      indefinite: Object.hasOwn(next, "indefinite") ? next.indefinite : indefinite,
    }, page);
    const result = await getAgreements(filters);
    if (requestId !== requestRef.current) return;
    if (result.success) {
      setRows(result.data?.items || []);
      setPagination({
        current: result.data?.page || page,
        pageSize: AGREEMENTS_PAGE_SIZE,
        total: Number(result.data?.total || 0),
      });
    } else {
      setRows([]);
      setPagination({ current: page, pageSize: AGREEMENTS_PAGE_SIZE, total: 0 });
      setFeedback(AGREEMENTS_QUERY_ERROR);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    getAgreementClients().then((result) => {
      if (!active) return;
      if (result.success) setClients(result.data || []);
      else setFeedback(AGREEMENTS_QUERY_ERROR);
    });
    load({}, 1);
    return () => {
      active = false;
      requestRef.current += 1;
    };
    // La preparación legacy ejecuta GetClientes y GetConvenios una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeClient(value) {
    setClientId(value);
    load({ clientId: value }, 1);
  }

  function changeDateRange(range) {
    const nextRange = Array.isArray(range) ? range : EMPTY_RANGE;
    setVisibleDateRange(nextRange);
    if (clearOnlyRef.current) {
      clearOnlyRef.current = false;
      return;
    }
    setAppliedDateRange(nextRange);
    load({ appliedDateRange: nextRange }, 1);
  }

  function clearVisibleDateRange() {
    // NullDatesOnClick del OML solo llama DatePickerClear: conserva Fecha1/Fecha2
    // y no refresca GetConvenios. Se replica deliberadamente ese defecto.
    clearOnlyRef.current = true;
    pickerRef.current?.clear();
    setVisibleDateRange(EMPTY_RANGE);
  }

  function changeIndefinite(event) {
    const nextValue = event.target.checked;
    setIndefinite(nextValue);
    load({ indefinite: nextValue }, 1);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      await exportRowsToXlsx({
        fileName: AGREEMENTS_EXPORT_FILE,
        sheetName: "Convenios",
        columns: [
          { title: "Nombre Cliente", key: "clientName", width: 35 },
          { title: "Sucursal", key: "accountManagerArea", width: 30 },
          { title: "Gestor de Cuenta", key: "accountManagerName", width: 30 },
          { title: "Límite de Crédito", key: "creditLimit", width: 22 },
          { title: "Días de Crédito", key: "creditDays", width: 18 },
          { title: "Tiene Pagaré", key: "hasPromissoryNote", width: 18 },
          { title: "Estatus Pagaré", key: "promissoryStatus", width: 18 },
          { title: "Fecha Inicio Convenio", key: "startDate", width: 22 },
          { title: "Fecha Final Convenio", key: "endDate", width: 22 },
          { title: "Centralizado", key: "centralized", width: 16 },
        ],
        rows: exportRows(rows),
      });
    } catch {
      setFeedback(AGREEMENTS_QUERY_ERROR);
    } finally {
      setExporting(false);
    }
  }

  const pageCount = Math.ceil(pagination.total / AGREEMENTS_PAGE_SIZE);
  const summary = agreementPaginationSummary(
    pagination.current,
    AGREEMENTS_PAGE_SIZE,
    rows.length,
    pagination.total,
  );

  return (
    <div className="agreements-page">
      {feedback ? <LegacyErrorFeedback message={feedback} /> : null}

      <div className="agreements-page__toolbar">
        <button
          type="button"
          className="agreements-page__export"
          title="Descargar archivo Excel"
          aria-label="Descargar archivo Excel"
          disabled={exporting}
          onClick={exportExcel}
        >
          <i className="fa fa-file-excel-o" aria-hidden="true" />
        </button>
      </div>

      <div className="agreements-page__heading-row">
        <h1>Convenios Clientes Corporativos</h1>
        <button
          type="button"
          className="agreements-page__new"
          onClick={() => history.push(ROUTES.agreementCreate)}
        >
          <i className="fa fa-plus" aria-hidden="true" />
          Nuevo Convenio
        </button>
      </div>

      <div className="agreements-page__filters">
        <div className="agreements-page__field agreements-page__client">
          <label htmlFor="agreement-client">Nombre Cliente</label>
          <Select
            id="agreement-client"
            value={clientId}
            placeholder="Select..."
            showSearch
            allowClear
            optionFilterProp="label"
            aria-label="Select an option"
            options={clients.map((item) => ({ value: item.id, label: item.name }))}
            onChange={changeClient}
          />
        </div>

        <div className="agreements-page__field">
          <label htmlFor="agreement-final-date">Fecha Final</label>
          <div className="agreements-page__date-control">
            <LegacyDateRangePicker
              ref={pickerRef}
              id="agreement-final-date"
              value={visibleDateRange}
              placeholder=""
              aria-label="Select a date range"
              onChange={changeDateRange}
            />
            <button
              type="button"
              className="agreements-page__date-clear"
              aria-label="Limpiar Fecha Final"
              onClick={clearVisibleDateRange}
            >
              <i className="fa fa-times" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="agreements-page__field agreements-page__indefinite">
          <label htmlFor="agreement-indefinite">Indefinidos</label>
          <Checkbox
            id="agreement-indefinite"
            checked={indefinite}
            aria-label="Indefinidos"
            onChange={changeIndefinite}
          />
        </div>
      </div>

      <div className="agreements-page__table-region">
        <table className="agreements-page__table">
          <colgroup>
            {AGREEMENTS_COLUMNS.map((column) => (
              <col key={column.key} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {AGREEMENTS_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.id} className={agreementRowClassName(record)}>
                {AGREEMENTS_COLUMNS.map((column) => (
                  <td key={column.key}>
                    <AgreementCell
                      column={column}
                      record={record}
                      onOpen={(id) => history.push(`${ROUTES.agreementDetail}?CodConvenio=${id}`)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <div className="agreements-page__loading">Loading...</div> : null}

        {pagination.total > 0 ? (
          <div className="agreements-page__pagination">
            <span className="agreements-page__pagination-summary">{summary}</span>
            <div className="agreements-page__pagination-pages">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <button
                  type="button"
                  key={page}
                  className={page === pagination.current ? "is-active" : ""}
                  aria-current={page === pagination.current ? "page" : undefined}
                  onClick={() => load({}, page)}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
