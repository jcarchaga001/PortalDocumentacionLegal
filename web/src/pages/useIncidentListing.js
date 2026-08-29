import { useCallback, useEffect, useRef, useState } from "react";
import { getIncidentCatalogs } from "../services/incidentService.js";

const emptyCatalogs = {
  branches: [],
  statuses: [],
  motives: [],
  agencies: [],
  responsiblePeople: [],
  levels: [],
  actions: [],
};

export function useIncidentListing({
  catalogScope,
  initialFilters,
  initialPageSize = 20,
  loadData,
  resetPageOnFilters = true,
}) {
  const [catalogs, setCatalogs] = useState(emptyCatalogs);
  const [filters, setFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: initialPageSize,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogErrorCode, setCatalogErrorCode] = useState("");
  const requestSequence = useRef(0);

  const loadPage = useCallback(async (page, pageSize, query) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    const result = await loadData({ ...query, page, pageSize });
    if (requestId !== requestSequence.current) return;
    if (result.success) {
      const data = result.data || {};
      setRows(data.items || []);
      setMetrics(data.metrics || {});
      setPagination({
        current: data.page || page,
        pageSize: data.pageSize || pageSize,
        total: data.total || 0,
      });
      setError("");
      setErrorCode("");
    } else {
      // El runtime conserva resultados anteriores cuando una consulta
      // dependiente falla; el feedback se muestra sin destruir la tabla.
      setPagination((current) => ({ ...current, current: page }));
      setError(result.message || "No fue posible consultar la información.");
      setErrorCode(result.error?.code || "");
    }
    setLoading(false);
  }, [loadData]);

  useEffect(() => {
    let active = true;
    getIncidentCatalogs(catalogScope).then((result) => {
      if (!active) return;
      if (result.success) {
        setCatalogs({ ...emptyCatalogs, ...(result.data || {}) });
        setCatalogError("");
        setCatalogErrorCode("");
      } else {
        setCatalogs(emptyCatalogs);
        setCatalogError(result.message || "No fue posible consultar la información.");
        setCatalogErrorCode(result.error?.code || "");
      }
    });
    return () => {
      active = false;
    };
  }, [catalogScope]);

  useEffect(() => {
    const targetPage = resetPageOnFilters ? 1 : pagination.current;
    const timer = window.setTimeout(() => loadPage(targetPage, pagination.pageSize, filters), 180);
    return () => window.clearTimeout(timer);
  }, [filters, loadPage, pagination.pageSize, resetPageOnFilters]);

  return {
    catalogs,
    catalogError,
    catalogErrorCode,
    error,
    errorCode,
    filters,
    loading,
    metrics,
    pagination,
    rows,
    setFilters,
    changePage(next) {
      loadPage(next.current || 1, next.pageSize || pagination.pageSize, filters);
    },
    refresh() {
      loadPage(pagination.current, pagination.pageSize, filters);
    },
  };
}
