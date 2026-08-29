import { Modal, Select, Table } from "antd";
import { useEffect, useRef, useState } from "react";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { useCatalogList } from "../hooks/useCatalogList.js";
import {
  createGovernmentEntity,
  deactivateGovernmentEntity,
  getGovernmentEntities,
  getGovernmentEntityLookups,
  updateGovernmentEntity,
} from "../services/catalogService.js";
import {
  GOVERNMENT_ENTITIES_AGGREGATE_LIMIT,
  GOVERNMENT_ENTITIES_FEEDBACK,
  GOVERNMENT_ENTITIES_PAGE_SIZE,
  GOVERNMENT_ENTITIES_QUERY_ERROR,
  GOVERNMENT_ENTITY_AREAS,
  governmentEntityArea,
  governmentEntityCreatePayload,
  governmentEntityPaginationTotal,
} from "./governmentEntitiesParity.js";
import "./GovernmentEntitiesPage.css";

const emptyLookups = Object.freeze({ entities: [], responsibles: [] });

// The filtered Aggregate is always refreshed with StartIndex=0 and
// MaxRecords=50. The Pagination widget retains its own StartIndex, an
// observable legacy defect deliberately preserved here.
const loadGovernmentEntities = (query) => getGovernmentEntities({
  ...query,
  page: 1,
  pageSize: GOVERNMENT_ENTITIES_AGGREGATE_LIMIT,
  sortBy: undefined,
  sortOrder: undefined,
});

function lookupOptions(items) {
  return (items || []).map((item, index) => ({
    key: `${item?.id ?? 0}-${index}`,
    value: Number(item?.id || 0),
    label: item?.name || "",
  }));
}

export function GovernmentEntitiesPage() {
  const listing = useCatalogList(loadGovernmentEntities, { pageSize: GOVERNMENT_ENTITIES_PAGE_SIZE });
  const [lookups, setLookups] = useState(emptyLookups);
  const [lookupError, setLookupError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftArea, setDraftArea] = useState(undefined);
  const [draftResponsible, setDraftResponsible] = useState(undefined);
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);

  useEffect(() => {
    let active = true;
    getGovernmentEntityLookups().then((result) => {
      if (!active) return;
      if (result.success) {
        setLookups({ ...emptyLookups, ...(result.data || {}) });
        setLookupError(false);
      } else {
        setLookupError(true);
      }
    });
    return () => {
      active = false;
      window.clearTimeout(feedbackTimer.current);
    };
  }, []);

  function showFeedback(type, message) {
    window.clearTimeout(feedbackTimer.current);
    setFeedback({ type, message });
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 5_000);
  }

  function openNewEntity(event) {
    event.preventDefault();
    // NuevoEnteOnClick only flips VarCrear and popup visibility. It does not
    // clear draft variables left by a prior CancelarOnClick.
    setCreateMode(true);
    setEditing(null);
    setModalOpen(true);
  }

  function openHiddenEdit(event, row) {
    event.preventDefault();
    setCreateMode(false);
    setEditing(row);
    setDraftName(row.name || "");
    setDraftDescription(row.description || "");
    setDraftArea(governmentEntityArea(row) === "Legal" ? "legal" : "regulatory");
    setDraftResponsible(Number(row.responsibleId || 0));
    setModalOpen(true);
  }

  function closeModal() {
    // CancelarOnClick does not reset any Form value.
    setModalOpen(false);
  }

  async function saveEntity(event) {
    event.preventDefault();
    const result = createMode
      ? await createGovernmentEntity(governmentEntityCreatePayload({
          name: draftName,
          description: draftDescription,
        }))
      : await updateGovernmentEntity(editing.id, {
          name: draftName,
          description: draftDescription,
          legal: editing?.legal,
          regulatory: editing?.regulatory,
          responsibleId: 0,
        });

    if (!result.success) {
      showFeedback("error", GOVERNMENT_ENTITIES_QUERY_ERROR);
      return;
    }
    setModalOpen(false);
    showFeedback(
      "info",
      createMode ? GOVERNMENT_ENTITIES_FEEDBACK.saved : GOVERNMENT_ENTITIES_FEEDBACK.updated,
    );
    listing.reload();
  }

  async function deactivateEntity(event, row) {
    event.preventDefault();
    const result = await deactivateGovernmentEntity(row.id);
    if (!result.success) {
      showFeedback("error", GOVERNMENT_ENTITIES_QUERY_ERROR);
      return;
    }
    showFeedback("success", GOVERNMENT_ENTITIES_FEEDBACK.deactivated);
    listing.reload();
  }

  const columns = [
    { title: "Ente Gubernamental", dataIndex: "name", key: "name", width: "25.53760%", align: "center", sorter: true },
    { title: "Descripción", dataIndex: "description", key: "description", width: "17.28706%", align: "center", sorter: true },
    { title: "Responsable", dataIndex: "responsibleName", key: "responsible", width: "30.80567%", align: "center", sorter: true },
    {
      title: "Aréa Encargada",
      key: "area",
      width: "18.12123%",
      align: "center",
      render: (_, row) => governmentEntityArea(row),
    },
    {
      title: "",
      key: "actions",
      width: "8.24845%",
      align: "center",
      render: (_, row) => (
        <div className="legacy-government-entities-actions">
          <a
            href="#"
            className="legacy-government-entities-edit"
            aria-hidden="true"
            tabIndex={-1}
            data-client-action="EditarOnClick"
            onClick={(event) => openHiddenEdit(event, row)}
          >
            <i className="fa fa-pencil-square-o" aria-hidden="true" />
          </a>
          <a
            href="#"
            className="legacy-government-entities-delete"
            aria-label={`Inactivar ${row.name || "ente gubernamental"}`}
            data-client-action="BorrarOnClick"
            onClick={(event) => deactivateEntity(event, row)}
          >
            <i className="fa fa-trash" aria-hidden="true" />
          </a>
        </div>
      ),
    },
  ];

  const setFiltersWithoutReset = (values) => listing.setFilters(values, { resetPage: false });

  return (
    <div className="legacy-government-entities-page">
      {(listing.error || lookupError) ? <LegacyErrorFeedback message={GOVERNMENT_ENTITIES_QUERY_ERROR} /> : null}
      {feedback ? <LegacyErrorFeedback type={feedback.type} message={feedback.message} /> : null}

      <div className="legacy-government-entities-heading">
        <h1>Catálogo Entes Gubernamentales</h1>
        <a href="#" className="legacy-government-entities-new" data-client-action="NuevoEnteOnClick" onClick={openNewEntity}>
          + Nuevo Ente
        </a>
      </div>

      <div className="legacy-government-entities-filters">
        <label>
          <span>Ente Gubernamental:</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Seleccione Ente"
            options={lookupOptions(lookups.entities)}
            onChange={(entityId) => setFiltersWithoutReset({ entityId })}
          />
        </label>
        <label>
          <span>Responsable:</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Seleccione Responsable"
            options={lookupOptions(lookups.responsibles)}
            onChange={(responsibleId) => setFiltersWithoutReset({ responsibleId })}
          />
        </label>
        <label>
          <span>Aréa Encargada:</span>
          <Select allowClear placeholder="Seleccione" options={GOVERNMENT_ENTITY_AREAS} onChange={(area) => setFiltersWithoutReset({ area })} />
        </label>
      </div>

      <Table
        className="legacy-government-entities-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{
          // The empty check is incorrectly wired to the unfiltered Aggregate.
          emptyText: listing.pagination.total > 0 ? "" : "No hay datos para mostrar...",
        }}
        pagination={{
          ...listing.pagination,
          pageSize: GOVERNMENT_ENTITIES_PAGE_SIZE,
          showSizeChanger: false,
          showTotal: governmentEntityPaginationTotal,
          onChange: (page) => listing.setFilters({ page }, { resetPage: false }),
        }}
        tableLayout="fixed"
      />

      <Modal
        className="legacy-government-entities-modal"
        open={modalOpen}
        footer={null}
        closable={false}
        maskClosable={false}
        keyboard={false}
        centered
        width={500}
      >
        <div className="legacy-government-entities-modal-heading">
          <img src={`${runtimeConfig.basePath}/brand/country-honduras.png`} alt="" />
          <div>{createMode ? "Nuevo Ente" : "Editar Ente"}</div>
          <span aria-hidden="true" />
        </div>
        <form className="legacy-government-entities-form" onSubmit={saveEntity} noValidate>
          <label className="is-text-field">
            <span>Ente Gubernamental</span>
            <input autoFocus type="text" maxLength={128} value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <label className="is-text-field">
            <span>Descripción</span>
            <input type="text" maxLength={65_535} value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} />
          </label>
          <label className="is-select-field">
            <span>Aréa Encargada:</span>
            <Select allowClear placeholder="Seleccione" options={GOVERNMENT_ENTITY_AREAS} value={draftArea} onChange={setDraftArea} />
          </label>
          <label className="is-select-field">
            <span>Responsables:</span>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Seleccione Responsable"
              options={lookupOptions(lookups.responsibles)}
              value={draftResponsible}
              onChange={setDraftResponsible}
            />
          </label>
          <div className="legacy-government-entities-modal-actions">
            <button type="button" className="is-cancel" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="is-save">{createMode ? "Guardar" : "Actualizar"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
