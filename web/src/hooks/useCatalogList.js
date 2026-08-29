import { useCallback, useEffect, useRef, useState } from "react";
import { getCatalogLookups } from "../services/catalogService.js";

export function useCatalogList(loadData, initialFilters = {}) {
  const initialFiltersRef = useRef(initialFilters);
  const [filters, setFilterState] = useState(() => ({
    ...initialFiltersRef.current,
    page: 1,
    pageSize: initialFiltersRef.current.pageSize || 20,
  }));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const result = await loadData(filters);
      if (!active) return;
      if (result.success) {
        setRows(result.data?.items || []);
        setTotal(Number(result.data?.total || 0));
        setError("");
      } else {
        setRows([]);
        setTotal(0);
        setError(result.message || "No fue posible consultar los registros.");
      }
      setLoading(false);
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters, loadData, revision]);

  const setFilters = useCallback((values, { resetPage = true } = {}) => {
    setFilterState((current) => ({
      ...current,
      ...values,
      ...(resetPage ? { page: 1 } : {}),
    }));
  }, []);

  const changeTable = useCallback((pagination, _tableFilters, sorter) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    setFilterState((current) => ({
      ...current,
      page: pagination.current || 1,
      pageSize: pagination.pageSize || current.pageSize,
      ...(activeSorter?.order
        ? {
            sortBy: activeSorter.columnKey,
            sortOrder: activeSorter.order === "descend" ? "desc" : "asc",
          }
        : {}),
    }));
  }, []);

  const reload = useCallback(() => setRevision((current) => current + 1), []);

  return {
    rows,
    loading,
    error,
    filters,
    pagination: { current: filters.page, pageSize: filters.pageSize, total, showSizeChanger: false },
    setFilters,
    changeTable,
    reload,
  };
}

const emptyLookups = {
  branches: [],
  positions: [],
  categories: [],
  responsibles: [],
  entities: [],
};

export function useCatalogLookups() {
  const [lookups, setLookups] = useState(emptyLookups);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCatalogLookups().then((result) => {
      if (!active) return;
      if (result.success) {
        setLookups({ ...emptyLookups, ...(result.data || {}) });
        setError("");
      } else {
        setError(result.message || "No fue posible consultar los catálogos auxiliares.");
      }
    });
    return () => { active = false; };
  }, []);

  return { lookups, error };
}
