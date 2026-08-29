import { Fragment, useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { ROUTES } from "../routes/routePaths.js";
import { getCorporateClients } from "../services/corporateClientService.js";
import { CorporateClientContactsBlock } from "./CorporateClientContactsBlock.jsx";
import {
  CORPORATE_CLIENT_COLUMNS,
  CORPORATE_CLIENT_EMPTY_TEXT,
  CORPORATE_CLIENT_PAGE_SIZE,
  CORPORATE_CLIENT_QUERY_ERROR,
  corporateClientActiveLabel,
  corporateClientPaginationPages,
  corporateClientPaginationSummary,
} from "./corporateClientsParity.js";
import "./CorporateClientsPage.css";

export function CorporateClientsPage() {
  const history = useHistory();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedClientIds, setExpandedClientIds] = useState(() => new Set());
  const [feedback, setFeedback] = useState(null);

  const showQueryError = useCallback(() => {
    setFeedback({ message: CORPORATE_CLIENT_QUERY_ERROR, id: Date.now() });
  }, []);

  async function loadPage(nextPage) {
    setLoading(true);
    const result = await getCorporateClients({
      page: nextPage,
      pageSize: CORPORATE_CLIENT_PAGE_SIZE,
      activeOnly: true,
    }).catch(() => null);

    if (result?.success) {
      setRows(result.data?.items || []);
      setPage(result.data?.page || nextPage);
      setTotal(Number(result.data?.total || 0));
      setExpandedClientIds(new Set());
    } else {
      showQueryError();
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);

    getCorporateClients({
      page: 1,
      pageSize: CORPORATE_CLIENT_PAGE_SIZE,
      activeOnly: true,
    }).then((result) => {
      if (!active) return;
      if (result.success) {
        setRows(result.data?.items || []);
        setPage(result.data?.page || 1);
        setTotal(Number(result.data?.total || 0));
      } else {
        showQueryError();
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      showQueryError();
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  function toggleContacts(clientId) {
    setExpandedClientIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  const pageNumbers = corporateClientPaginationPages(total);

  return (
    <div className="corporate-clients-page">
      <LegacyErrorFeedback key={feedback?.id} message={feedback?.message} />

      <div className="corporate-clients-heading-row">
        <h1 className="content-top-title heading1 ph">Clientes Corporativos</h1>
        <div className="corporate-clients-toolbar">
          <button
            type="button"
            className="corporate-clients-toolbar-action"
            onClick={() => history.push(ROUTES.corporateClientBulk)}
          >
            Carga de Clientes
          </button>
          <span className="corporate-clients-toolbar-separator" aria-hidden="true" />
          <button
            type="button"
            className="corporate-clients-toolbar-action corporate-clients-create-action"
            onClick={() => history.push(ROUTES.corporateClientCreate)}
          >
            <i className="icon fa fa-plus fa-1x" aria-hidden="true" />
            <span>Crear Cliente</span>
          </button>
        </div>
      </div>

      <div className="corporate-clients-table-overflow">
        <table className="corporate-clients-table" aria-busy={loading}>
          <colgroup>
            {CORPORATE_CLIENT_COLUMNS.map((column) => (
              <col key={column.key} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {CORPORATE_CLIENT_COLUMNS.map((column) => (
                <th key={column.key} scope="col">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr className="corporate-clients-empty-row">
                <td colSpan={CORPORATE_CLIENT_COLUMNS.length}>{CORPORATE_CLIENT_EMPTY_TEXT}</td>
              </tr>
            ) : rows.map((client) => (
              <Fragment key={client.id}>
                <tr>
                  <td>{client.faCode}</td>
                  <td>{client.name}</td>
                  <td>{client.contactName}</td>
                  <td>{client.contactPosition}</td>
                  <td>{client.contactPhone}</td>
                  <td>{client.contactEmail}</td>
                  <td className="corporate-clients-active-cell">{corporateClientActiveLabel(client.isActive)}</td>
                  <td className="corporate-clients-actions-cell">
                    <div className="corporate-clients-row-actions">
                      <button
                        type="button"
                        className="corporate-clients-edit-action"
                        aria-label={`Editar cliente ${client.name}`}
                        onClick={() => history.push(`${ROUTES.corporateClientCreate}?CodCliente=${client.id}`)}
                      >
                        <i className="icon fa fa-pencil-square-o fa-2x" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="corporate-clients-contacts-action"
                        aria-expanded={expandedClientIds.has(client.id)}
                        onClick={() => toggleContacts(client.id)}
                      >
                        <i
                          className={`icon fa ${expandedClientIds.has(client.id) ? "fa-chevron-up" : "fa-chevron-down"} fa-1x`}
                          aria-hidden="true"
                        />
                        <span>Contactos</span>
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedClientIds.has(client.id) ? (
                  <tr className="corporate-clients-expanded-row">
                    <td colSpan={CORPORATE_CLIENT_COLUMNS.length}>
                      <CorporateClientContactsBlock clientId={client.id} onQueryError={showQueryError} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="corporate-clients-pagination">
        <span className="corporate-clients-pagination-summary">
          {corporateClientPaginationSummary(page, total)}
        </span>
        <nav className="corporate-clients-pagination-nav" aria-label="Paginación de clientes corporativos">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => loadPage(page - 1)}
          >
            <i className="icon fa fa-angle-left fa-1x" aria-hidden="true" />
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              type="button"
              key={pageNumber}
              className={pageNumber === page ? "is-active" : ""}
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => loadPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={page >= pageNumbers.length}
            onClick={() => loadPage(page + 1)}
          >
            <i className="icon fa fa-angle-right fa-1x" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
