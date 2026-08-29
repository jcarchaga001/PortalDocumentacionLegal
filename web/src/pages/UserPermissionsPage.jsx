import { Checkbox, Input, Select } from "antd";
import { useEffect, useState } from "react";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { useCatalogList } from "../hooks/useCatalogList.js";
import {
  getPermissionUserLookups,
  getPermissionUsers,
  updatePermissionUser,
} from "../services/catalogService.js";
import "./UserPermissionsPage.css";
import {
  paginationPages,
  paginationSummary,
  permissionActionFor,
  USER_PERMISSION_COLUMNS,
  USER_PERMISSION_EMPTY_TEXT,
  USER_PERMISSION_PAGE_SIZE,
  USER_PERMISSION_QUERY_ERROR,
  USER_PERMISSION_SUCCESS,
} from "./userPermissionsParity.js";

const loadPermissionUsers = (query) => getPermissionUsers(query);
const EMPTY_LOOKUPS = Object.freeze({ branches: [], positions: [] });

function lookupOptions(items) {
  return (items || []).map((item) => ({ value: Number(item.id), label: item.name }));
}

export function UserPermissionsPage() {
  const listing = useCatalogList(loadPermissionUsers, {
    onlyAllowed: false,
    pageSize: USER_PERMISSION_PAGE_SIZE,
  });
  const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
  const [lookupError, setLookupError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let active = true;
    getPermissionUserLookups().then((result) => {
      if (!active) return;
      if (result.success) {
        setLookups({ ...EMPTY_LOOKUPS, ...(result.data || {}) });
        setLookupError("");
      } else {
        setLookupError(USER_PERMISSION_QUERY_ERROR);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function changeFilters(values) {
    // Las cuatro acciones FilterOnChange del OML refrescan GetPersonas sin
    // asignar StartIndex=0; conservar la página es un defecto observable.
    listing.setFilters(values, { resetPage: false });
  }

  async function toggleAccess(row) {
    const action = permissionActionFor(row.accessAllowed);
    const sequence = Date.now();
    setSavingId(row.id);
    // LinkAsignarPermiso muestra primero el Boolean IsPermiso como Info.
    setFeedback({ type: "info", message: action.infoMessage, sequence });
    try {
      const result = await updatePermissionUser(row.id, action.nextAllowed);
      if (!result.success) {
        setFeedback({ type: "error", message: USER_PERMISSION_QUERY_ERROR, sequence: sequence + 1 });
        return;
      }
      listing.reload();
      setFeedback({ type: "success", message: USER_PERMISSION_SUCCESS, sequence: sequence + 1 });
    } catch {
      setFeedback({ type: "error", message: USER_PERMISSION_QUERY_ERROR, sequence: sequence + 1 });
    } finally {
      setSavingId(null);
    }
  }

  const queryFailed = Boolean(listing.error || lookupError);
  const visibleFeedback = feedback || (queryFailed
    ? { type: "error", message: USER_PERMISSION_QUERY_ERROR, sequence: "query" }
    : null);
  const total = Number(listing.pagination.total || 0);
  const currentPage = Number(listing.pagination.current || 1);
  const pages = paginationPages(total, USER_PERMISSION_PAGE_SIZE);

  return (
    <div className="legacy-user-permissions-page" data-screen="scrUsuariosPermisos">
      {visibleFeedback && (
        <LegacyErrorFeedback
          key={visibleFeedback.sequence}
          type={visibleFeedback.type}
          message={visibleFeedback.message}
        />
      )}

      <h1>Permisos Casos Laborales</h1>

      <div className="legacy-user-permissions-filters" aria-label="Filtros de permisos">
        <div className="legacy-user-permissions-filter">
          <label htmlFor="permission-branch">Sucursal / Area:</label>
          <Select
            id="permission-branch"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Seleccionar..."
            value={listing.filters.branchId}
            options={lookupOptions(lookups.branches)}
            onChange={(branchId) => changeFilters({ branchId })}
          />
        </div>

        <div className="legacy-user-permissions-filter">
          <label htmlFor="permission-position">Puesto</label>
          <Select
            id="permission-position"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Seleccionar..."
            value={listing.filters.positionId}
            options={lookupOptions(lookups.positions)}
            onChange={(positionId) => changeFilters({ positionId })}
          />
        </div>

        <div className="legacy-user-permissions-filter">
          <label htmlFor="permission-search">Buscar:</label>
          <Input
            id="permission-search"
            value={listing.filters.search || ""}
            onChange={(event) => changeFilters({ search: event.target.value })}
          />
        </div>

        <div className="legacy-user-permissions-filter is-checkbox">
          <Checkbox
            checked={Boolean(listing.filters.onlyAllowed)}
            onChange={(event) => changeFilters({ onlyAllowed: event.target.checked })}
          >
            Solo Acceso Permitido
          </Checkbox>
        </div>
      </div>

      <div className="legacy-user-permissions-table-wrap">
        <table className="legacy-user-permissions-table">
          <colgroup>
            {USER_PERMISSION_COLUMNS.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {USER_PERMISSION_COLUMNS.map((column) => (
                <th key={column.key} className={`is-${column.align}`} scope="col">
                  <span className="legacy-user-permissions-header-content">
                    {column.label}
                    {column.sortable && (
                      <span className="legacy-user-permissions-sorter" aria-hidden="true" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listing.rows.map((row) => {
              const action = permissionActionFor(row.accessAllowed);
              return (
                <tr key={row.id}>
                  <td className="is-center">{row.id}</td>
                  <td className="is-left" title={row.name}>{row.name}</td>
                  <td className="is-left" title={row.positionName}>{row.positionName}</td>
                  <td className="is-center" title={row.email}>{row.email}</td>
                  <td className="is-center">
                    <button
                      type="button"
                      className="legacy-user-permissions-access"
                      data-tooltip={action.tooltip}
                      aria-label={action.tooltip}
                      disabled={savingId === row.id}
                      onClick={() => toggleAccess(row)}
                    >
                      <i
                        className={`fa ${savingId === row.id ? "fa-spinner fa-spin" : action.icon} fa-2x`}
                        style={{ color: action.color }}
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!listing.loading && listing.rows.length === 0 && (
              <tr>
                <td className="legacy-user-permissions-empty-cell" colSpan={USER_PERMISSION_COLUMNS.length}>
                  {USER_PERMISSION_EMPTY_TEXT}
                </td>
              </tr>
            )}
            {listing.loading && listing.rows.length === 0 && (
              <tr>
                <td className="legacy-user-permissions-loading-cell" colSpan={USER_PERMISSION_COLUMNS.length}>
                  <i className="fa fa-spinner fa-spin" aria-hidden="true" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="legacy-user-permissions-pagination">
        <span>{paginationSummary(currentPage, USER_PERMISSION_PAGE_SIZE, total)}</span>
        {pages.length > 0 && (
          <nav className="legacy-user-permissions-pagination-controls" aria-label="Paginación">
            <button
              type="button"
              className="legacy-user-permissions-page-button"
              aria-label="Página anterior"
              disabled={currentPage <= 1}
              onClick={() => changeFilters({ page: currentPage - 1 })}
            >
              <i className="fa fa-angle-left" aria-hidden="true" />
            </button>
            {pages.map((page) => (
              <button
                key={page}
                type="button"
                className={`legacy-user-permissions-page-button${page === currentPage ? " is-current" : ""}`}
                aria-current={page === currentPage ? "page" : undefined}
                onClick={() => changeFilters({ page })}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className="legacy-user-permissions-page-button"
              aria-label="Página siguiente"
              disabled={currentPage >= pages.length}
              onClick={() => changeFilters({ page: currentPage + 1 })}
            >
              <i className="fa fa-angle-right" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
