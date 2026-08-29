import { useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { bulkUpsertCorporateClients } from "../services/corporateClientService.js";
import { downloadCorporateClientTemplate, parseCorporateClientWorkbook } from "../services/spreadsheetService.js";
import {
  appendCorporateClientImportRows,
  CORPORATE_CLIENT_BULK_COLUMNS,
  CORPORATE_CLIENT_BULK_EMPTY_FILE_LABEL,
  nextCorporateClientBulkSort,
  removeCorporateClientImportRow,
  removeInvalidCorporateClientImportRows,
  sortCorporateClientImportRows,
} from "./corporateClientBulkParity.js";
import "./CorporateClientBulkPage.css";

function BulkLoadingOverlay() {
  return (
    <div className="corporate-client-bulk-loading" role="status" aria-live="polite">
      <div className="corporate-client-bulk-loading-dialog">
        <i className="fa fa-spinner fa-spin" aria-hidden="true" />
      </div>
    </div>
  );
}

function SortIndicator({ active, direction }) {
  return (
    <span className={`corporate-client-bulk-sorter${active ? " is-active" : ""}`} aria-hidden="true">
      <i className={`fa fa-caret-up${active && direction === "asc" ? " is-selected" : ""}`} />
      <i className={`fa fa-caret-down${active && direction === "desc" ? " is-selected" : ""}`} />
    </span>
  );
}

export function CorporateClientBulkPage() {
  const history = useHistory();
  const fileInputRef = useRef(null);
  const [fileLabel, setFileLabel] = useState(CORPORATE_CLIENT_BULK_EMPTY_FILE_LABEL);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [sort, setSort] = useState(null);
  const hasInvalidRows = rows.some((row) => !row.isValid);
  const visibleRows = useMemo(() => sortCorporateClientImportRows(rows, sort), [rows, sort]);

  function showError(message) {
    setFeedback({ id: Date.now(), message });
  }

  async function readFile(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFileLabel(selectedFile.name);
    setFeedback(null);
    setIsLoading(true);
    try {
      const items = await parseCorporateClientWorkbook(selectedFile);
      setRows((current) => appendCorporateClientImportRows(current, items));
    } catch (error) {
      showError(error?.message || "Error executing query.");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  async function downloadTemplate() {
    setFeedback(null);
    try {
      await downloadCorporateClientTemplate();
    } catch (error) {
      showError(error?.message || "Error executing query.");
    }
  }

  async function upload() {
    if (hasInvalidRows) return;
    if (rows.length === 0) {
      history.push(ROUTES.corporateClients);
      return;
    }
    setFeedback(null);
    setIsLoading(true);
    const result = await bulkUpsertCorporateClients(rows).catch(() => null);
    if (result?.success) {
      history.push(ROUTES.corporateClients);
      return;
    }
    showError(result?.message || "Error executing query.");
    setIsLoading(false);
  }

  function removeAllInvalid() {
    setIsLoading(true);
    setRows((current) => removeInvalidCorporateClientImportRows(current));
    setIsLoading(false);
  }

  function changeSort(column) {
    if (!column.sortable) return;
    setSort((current) => nextCorporateClientBulkSort(current, column.key));
  }

  return (
    <div className="corporate-client-bulk-page" data-screen="scrCargaMasivaClientesCorp">
      <LegacyErrorFeedback key={feedback?.id} message={feedback?.message} />
      {isLoading ? <BulkLoadingOverlay /> : null}

      <div className="corporate-client-bulk-breadcrumbs content-breadcrumbs ph">
        <a href="#" className="corporate-client-bulk-back" onClick={(event) => { event.preventDefault(); history.push(ROUTES.corporateClients); }}>
          <i className="icon fa fa-angle-left fa-1x" aria-hidden="true" />Volver al listado
        </a>
      </div>

      <div className="corporate-client-bulk-heading-row">
        <div className="content-top-title heading1 ph" role="heading" aria-level="1">Carga Masiva Clientes Corporativos</div>
        <button type="button" className="corporate-client-bulk-template" onClick={downloadTemplate}>Descargar Plantilla</button>
      </div>

      <div className="corporate-client-bulk-upload-row">
        <div className="corporate-client-bulk-file-field">
          <span className="corporate-client-bulk-file-label">Excel a Cargar</span>
          <button type="button" className="corporate-client-bulk-file-control" onClick={() => fileInputRef.current?.click()}>
            <i className="fa fa-paperclip" aria-hidden="true" /><span>{fileLabel}</span>
          </button>
          <input ref={fileInputRef} className="corporate-client-bulk-file-input" type="file" accept="" aria-label="Excel a Cargar" onChange={readFile} />
        </div>
        <button type="button" className="corporate-client-bulk-submit btn btn-primary" disabled={hasInvalidRows} onClick={upload}>Subir</button>
      </div>

      <div className="corporate-client-bulk-table-wrap">
        <table className="corporate-client-bulk-table">
          <colgroup>
            <col style={{ width: "151.525px" }} /><col style={{ width: "197.6px" }} />
            <col style={{ width: "213.625px" }} /><col style={{ width: "202.6px" }} />
            <col style={{ width: "194.825px" }} /><col style={{ width: "181.15px" }} />
            <col style={{ width: "57.075px" }} />
          </colgroup>
          <thead><tr>
            {CORPORATE_CLIENT_BULK_COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.sortable ? (
                  <button type="button" onClick={() => changeSort(column)}>
                    <span>{column.label}</span><SortIndicator active={sort?.key === column.key} direction={sort?.direction} />
                  </button>
                ) : column.label}
              </th>
            ))}
            <th className="corporate-client-bulk-actions-heading" scope="col">
              {hasInvalidRows ? (
                <button type="button" title="Remover todos los registros no validos" aria-label="Remover todos los registros no validos" onClick={removeAllInvalid}>
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
              ) : null}
            </th>
          </tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.importRowId}>
                {CORPORATE_CLIENT_BULK_COLUMNS.map((column) => (
                  <td key={column.key} className={row.isValid ? undefined : "is-invalid"}>{row[column.key]}</td>
                ))}
                <td className={`corporate-client-bulk-row-actions${row.isValid ? "" : " is-invalid"}`}>
                  {!row.isValid ? (
                    <div>
                      <span className="corporate-client-bulk-invalid-tooltip" title={row.validationMessage}>
                        <i className="fa fa-exclamation-circle" aria-hidden="true" />
                      </span>
                      <button type="button" title="Remover registro" aria-label="Remover registro" onClick={() => setRows((current) => removeCorporateClientImportRow(current, row.importRowId))}>
                        <i className="fa fa-trash" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
