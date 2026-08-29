import { Checkbox, Input, Select } from "antd";
import { useEffect, useState } from "react";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { useCatalogList } from "../hooks/useCatalogList.js";
import {
  getDocumentCategories,
  getDocumentCategoryLookups,
  updateDocumentCategoryAccess,
} from "../services/catalogService.js";
import "./DocumentCategoriesPage.css";
import {
  categoryAccessActionFor,
  DOCUMENT_CATEGORY_COLUMNS,
  DOCUMENT_CATEGORY_EMPTY_TEXT,
  DOCUMENT_CATEGORY_PAGE_SIZE,
  DOCUMENT_CATEGORY_QUERY_ERROR,
  DOCUMENT_CATEGORY_SUCCESS,
  isCategoryAccessAllowed,
  paginationPages,
  paginationSummary,
} from "./documentCategoriesParity.js";

const loadDocumentCategories = (query) => getDocumentCategories(query);
const EMPTY_LOOKUPS = Object.freeze({ branches: [], positions: [] });

function lookupOptions(items) {
  return (items || []).map((item) => ({ value: Number(item.id), label: item.name }));
}

function rowFlag(rowFlags, row, key) {
  const override = rowFlags[row.id]?.[key];
  return override === undefined ? isCategoryAccessAllowed(row[key]) : override;
}

export function DocumentCategoriesPage() {
  const listing = useCatalogList(loadDocumentCategories, {
    isBloqueadas: false,
    pageSize: DOCUMENT_CATEGORY_PAGE_SIZE,
  });
  const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
  const [lookupError, setLookupError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [rowFlags, setRowFlags] = useState({});

  useEffect(() => {
    let active = true;
    getDocumentCategoryLookups().then((result) => {
      if (!active) return;
      if (result.success) {
        setLookups({ ...EMPTY_LOOKUPS, ...(result.data || {}) });
        setLookupError("");
      } else {
        setLookupError(DOCUMENT_CATEGORY_QUERY_ERROR);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Los Checkbox de las filas solo modifican el registro del Aggregate en
    // memoria. Cualquier Refresh GetPersonas descarta ese cambio local.
    setRowFlags({});
  }, [listing.rows]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function refreshWith(values) {
    // Ninguno de estos filtros forma parte de GetPersonas. Las Client Actions
    // solo refrescan el Aggregate y conservan StartIndex.
    listing.setFilters(values, { resetPage: false });
  }

  function setLocalFlag(row, key, checked) {
    setRowFlags((current) => ({
      ...current,
      [row.id]: { ...current[row.id], [key]: checked },
    }));
  }

  async function toggleAccess(event, row) {
    event.preventDefault();
    if (savingId !== null) return;
    const action = categoryAccessActionFor(row.accessAllowed);
    const sequence = Date.now();
    setSavingId(row.id);
    setFeedback({ type: "info", message: action.infoMessage, sequence });
    try {
      const result = await updateDocumentCategoryAccess(row.id, action.nextAllowed);
      if (!result.success) {
        setFeedback({ type: "error", message: DOCUMENT_CATEGORY_QUERY_ERROR, sequence: sequence + 1 });
        return;
      }
      listing.reload();
      setFeedback({ type: "success", message: DOCUMENT_CATEGORY_SUCCESS, sequence: sequence + 1 });
    } catch {
      setFeedback({ type: "error", message: DOCUMENT_CATEGORY_QUERY_ERROR, sequence: sequence + 1 });
    } finally {
      setSavingId(null);
    }
  }

  const queryFailed = Boolean(listing.error || lookupError);
  const visibleFeedback = feedback || (queryFailed
    ? { type: "error", message: DOCUMENT_CATEGORY_QUERY_ERROR, sequence: "query" }
    : null);
  const total = Number(listing.pagination.total || 0);
  const currentPage = Number(listing.pagination.current || 1);
  const pages = paginationPages(total, DOCUMENT_CATEGORY_PAGE_SIZE);
  const sharedChecked = Boolean(listing.filters.isBloqueadas);

  return (
    <div className="legacy-document-categories-page" data-screen="scrCategoriasDocumentos">
      {visibleFeedback && (
        <LegacyErrorFeedback
          key={visibleFeedback.sequence}
          type={visibleFeedback.type}
          message={visibleFeedback.message}
        />
      )}

      <h1>Permisos Casos Laborales</h1>

      <div className="legacy-document-categories-filters" aria-label="Filtros de categorías documentales">
        <div className="legacy-document-categories-filter">
          <label htmlFor="document-category-branch">Categoría:</label>
          <Select
            id="document-category-branch"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Seleccionar..."
            value={listing.filters.branchId}
            options={lookupOptions(lookups.branches)}
            onChange={(branchId) => refreshWith({ branchId })}
          />
        </div>

        <div className="legacy-document-categories-filter">
          <label htmlFor="document-category-search">Buscar:</label>
          <Input
            id="document-category-search"
            maxLength={50}
            value={listing.filters.search || ""}
            onChange={(event) => refreshWith({ search: event.target.value })}
          />
        </div>

        {["Solo Obligatorios", "Solo Documentos", "Solo Activos"].map((label) => (
          <div className="legacy-document-categories-filter is-checkbox" key={label}>
            <Checkbox
              checked={sharedChecked}
              onChange={(event) => refreshWith({ isBloqueadas: event.target.checked })}
            >
              {label}
            </Checkbox>
          </div>
        ))}
      </div>

      <div className="legacy-document-categories-table-wrap">
        <table className="legacy-document-categories-table">
          <thead>
            <tr>
              {DOCUMENT_CATEGORY_COLUMNS.map((column) => (
                <th key={column.key} className={`is-${column.align}`} scope="col">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listing.rows.map((row) => {
              const action = categoryAccessActionFor(row.accessAllowed);
              return (
                <tr key={row.id}>
                  <td className="is-center" title={row.categoryName}>
                    <span className="legacy-document-categories-category">{row.categoryName}</span>
                  </td>
                  <td className="is-left" title={row.subcategoryName}>{row.subcategoryName}</td>
                  <td className="is-center">
                    <input
                      className="legacy-document-categories-row-checkbox"
                      type="checkbox"
                      checked={rowFlag(rowFlags, row, "required")}
                      onChange={(event) => setLocalFlag(row, "required", event.target.checked)}
                      aria-label={`Obligatorio: ${row.subcategoryName}`}
                    />
                  </td>
                  <td className="is-center">
                    <input
                      className="legacy-document-categories-row-checkbox"
                      type="checkbox"
                      checked={rowFlag(rowFlags, row, "branchDocument")}
                      onChange={(event) => setLocalFlag(row, "branchDocument", event.target.checked)}
                      aria-label={`Es Documento: ${row.subcategoryName}`}
                    />
                  </td>
                  <td className="is-center">
                    <a
                      href="#"
                      className="legacy-document-categories-access"
                      data-tooltip={action.tooltip}
                      aria-label={action.tooltip}
                      aria-disabled={savingId === row.id ? "true" : undefined}
                      onClick={(event) => toggleAccess(event, row)}
                    >
                      <i
                        className={`fa ${savingId === row.id ? "fa-spinner fa-spin" : action.icon} fa-2x`}
                        style={{ color: action.color }}
                        aria-hidden="true"
                      />
                    </a>
                  </td>
                </tr>
              );
            })}
            {!listing.loading && listing.rows.length === 0 && (
              <tr>
                <td className="legacy-document-categories-empty-cell" colSpan={DOCUMENT_CATEGORY_COLUMNS.length}>
                  {DOCUMENT_CATEGORY_EMPTY_TEXT}
                </td>
              </tr>
            )}
            {listing.loading && listing.rows.length === 0 && (
              <tr>
                <td className="legacy-document-categories-loading-cell" colSpan={DOCUMENT_CATEGORY_COLUMNS.length}>
                  <i className="fa fa-spinner fa-spin" aria-hidden="true" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="legacy-document-categories-pagination">
        <span>{paginationSummary(currentPage, DOCUMENT_CATEGORY_PAGE_SIZE, total)}</span>
        {pages.length > 0 && (
          <nav className="legacy-document-categories-pagination-controls" aria-label="Paginación">
            <button
              type="button"
              className="legacy-document-categories-page-button"
              aria-label="Página anterior"
              disabled={currentPage <= 1}
              onClick={() => refreshWith({ page: currentPage - 1 })}
            >
              <i className="fa fa-angle-left" aria-hidden="true" />
            </button>
            {pages.map((page) => (
              <button
                key={page}
                type="button"
                className={`legacy-document-categories-page-button${page === currentPage ? " is-current" : ""}`}
                aria-current={page === currentPage ? "page" : undefined}
                onClick={() => refreshWith({ page })}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className="legacy-document-categories-page-button"
              aria-label="Página siguiente"
              disabled={currentPage >= pages.length}
              onClick={() => refreshWith({ page: currentPage + 1 })}
            >
              <i className="fa fa-angle-right" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
