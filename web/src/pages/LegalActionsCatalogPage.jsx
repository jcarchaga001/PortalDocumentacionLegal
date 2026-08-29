import { Checkbox, Modal, Table } from "antd";
import { useEffect, useRef, useState } from "react";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { useCatalogList } from "../hooks/useCatalogList.js";
import {
  createLegalAction,
  getLegalAction,
  getLegalActions,
  updateLegalAction,
} from "../services/catalogService.js";
import {
  formatLegacyLegalActionDate,
  LEGAL_ACTIONS_FEEDBACK,
  LEGAL_ACTIONS_PAGE_SIZE,
  LEGAL_ACTIONS_QUERY_ERROR,
  legalActionPaginationTotal,
  legalActionPayload,
} from "./legalActionsCatalogParity.js";
import "./LegalActionsCatalogPage.css";

const loadLegalActions = (query) => getLegalActions(query);

function LegacyLegalActionState({ active }) {
  const enabled = active === true || active === 1 || active === "1";
  return (
    <i
      className={`icon fa ${enabled ? "fa-check is-active" : "fa-times-circle is-inactive"} fa-2x`}
      aria-label={enabled ? "Activo" : "Inactivo"}
    />
  );
}

export function LegalActionsCatalogPage() {
  const listing = useCatalogList(loadLegalActions, { pageSize: LEGAL_ACTIONS_PAGE_SIZE });
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftActive, setDraftActive] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  function showFeedback(type, message) {
    window.clearTimeout(feedbackTimer.current);
    setFeedback({ type, message });
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 5_000);
  }

  async function openModal(action = null) {
    const isEditing = Boolean(action);
    setEditing(action);
    setDraftName(action?.name || "");
    setDraftActive(isEditing ? Boolean(action.active) : false);
    setModalOpen(true);

    const result = await getLegalAction(action?.id || 0);
    if (!result.success) {
      showFeedback("error", LEGAL_ACTIONS_QUERY_ERROR);
      return;
    }

    setDraftName(result.data?.name || "");
    setDraftActive(isEditing ? Boolean(result.data?.active) : false);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setDraftName("");
    setDraftActive(false);
  }

  async function saveAction(event) {
    event.preventDefault();
    const isEditing = Boolean(editing);
    const payload = legalActionPayload({
      name: draftName,
      active: draftActive,
      editing: isEditing,
    });
    const result = isEditing
      ? await updateLegalAction(editing.id, payload)
      : await createLegalAction(payload);

    if (!result.success) {
      showFeedback("error", LEGAL_ACTIONS_QUERY_ERROR);
      return;
    }

    closeModal();
    showFeedback("success", isEditing ? LEGAL_ACTIONS_FEEDBACK.updated : LEGAL_ACTIONS_FEEDBACK.created);
    listing.reload();
  }

  const sortOrder = (key) => (
    listing.filters.sortBy === key
      ? (listing.filters.sortOrder === "desc" ? "descend" : "ascend")
      : null
  );

  const columns = [
    {
      title: "Nombre Acción",
      dataIndex: "name",
      key: "name",
      width: "33.08%",
      align: "center",
      sorter: true,
      sortDirections: ["ascend", "descend", "ascend"],
      sortOrder: sortOrder("name"),
    },
    {
      title: "Fecha Creado",
      dataIndex: "createdAt",
      key: "createdAt",
      width: "20.25%",
      align: "center",
      sorter: true,
      sortDirections: ["ascend", "descend", "ascend"],
      sortOrder: sortOrder("createdAt"),
      render: formatLegacyLegalActionDate,
    },
    {
      title: "Usuario Creado",
      dataIndex: "createdBy",
      key: "createdBy",
      width: "27.53%",
      align: "center",
      sorter: true,
      sortDirections: ["ascend", "descend", "ascend"],
      sortOrder: sortOrder("createdBy"),
    },
    {
      title: "Activo",
      dataIndex: "active",
      key: "active",
      width: "10.20%",
      align: "center",
      render: (active) => <LegacyLegalActionState active={active} />,
    },
    {
      title: "",
      key: "actions",
      width: "8.94%",
      align: "center",
      render: (_, row) => (
        <a
          href="#"
          className="legacy-legal-actions-edit"
          aria-label={`Editar ${row.name || "acción legal"}`}
          onClick={(event) => {
            event.preventDefault();
            openModal(row);
          }}
        >
          <i className="icon fa fa-pencil-square-o fa-2x" aria-hidden="true" />
        </a>
      ),
    },
  ];

  return (
    <div className="legacy-legal-actions-page">
      {listing.error ? <LegacyErrorFeedback message={LEGAL_ACTIONS_QUERY_ERROR} /> : null}
      {feedback ? <LegacyErrorFeedback message={feedback.message} type={feedback.type} /> : null}

      <div className="legacy-legal-actions-heading">
        <h1>Catálogo Acciones Legal</h1>
        <a
          href="#"
          className="legacy-legal-actions-new"
          onClick={(event) => {
            event.preventDefault();
            openModal();
          }}
        >
          + Acción Legal
        </a>
      </div>

      <Table
        className="legacy-legal-actions-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        locale={{ emptyText: "No hay registros..." }}
        pagination={{
          ...listing.pagination,
          showTotal: legalActionPaginationTotal,
          showSizeChanger: false,
        }}
        onChange={listing.changeTable}
        tableLayout="fixed"
      />

      <Modal
        className={`legacy-legal-actions-modal ${editing ? "is-editing" : "is-creating"}`}
        open={modalOpen}
        footer={null}
        closable={false}
        maskClosable={false}
        keyboard={false}
        centered
        width={500}
        destroyOnHidden
      >
        <section className="legacy-legal-actions-section" aria-label="Editar Incidente">
          <div className="legacy-legal-actions-section-title">Editar Incidente</div>
          <div className="legacy-legal-actions-section-content">
            <form className="legacy-legal-actions-form" onSubmit={saveAction} noValidate>
              <div className="legacy-legal-actions-field">
                <label htmlFor="legacy-legal-action-name">Nombre Acción</label>
                <input
                  id="legacy-legal-action-name"
                  className="legacy-legal-actions-input"
                  type="text"
                  maxLength={250}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </div>

              {editing ? (
                <div className="legacy-legal-actions-field is-checkbox">
                  <label htmlFor="legacy-legal-action-active">Activo</label>
                  <Checkbox
                    id="legacy-legal-action-active"
                    checked={draftActive}
                    onChange={(event) => setDraftActive(event.target.checked)}
                  />
                </div>
              ) : null}

              <div className="legacy-legal-actions-modal-actions">
                <button className="legacy-legal-actions-save" type="submit">
                  {editing ? "Editar Acción" : "Guardar Acción"}
                </button>
                <button className="legacy-legal-actions-back" type="button" onClick={closeModal}>
                  Regresar
                </button>
              </div>
            </form>
          </div>
        </section>
      </Modal>
    </div>
  );
}
