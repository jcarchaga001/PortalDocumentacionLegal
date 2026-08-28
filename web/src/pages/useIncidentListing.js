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
      setRows([]);
      setMetrics({});
      setPagination((current) => ({ ...current, current: page, total: 0 }));
      setError(result.message || "No fue posible consultar la información.");
      setErrorCode(result.error?.code || "");
    }
    setLoading(false);
  }, [loadData]);

  useEffect(() => {
    let active = true;
    getIncidentCatalogs(catalogScope).then((result) => {
      if (active && result.success) setCatalogs({ ...emptyCatalogs, ...(result.data || {}) });
    });
    return () => {
      active = false;
    };
  }, [catalogScope]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadPage(1, pagination.pageSize, filters), 180);
    return () => window.clearTimeout(timer);
  }, [filters, loadPage, pagination.pageSize]);

  return {
    catalogs,
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
