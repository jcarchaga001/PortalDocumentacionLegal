import { WarningOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, Modal, Select, Space, Spin, Table, message } from "antd";
import { useEffect, useState } from "react";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { useCatalogList } from "../hooks/useCatalogList.js";
import {
  createProvider,
  getProviderBranches,
  getProviderDestinations,
  getProviders,
  updateProvider,
} from "../services/catalogService.js";
import { isTrue, options } from "./CatalogUi.jsx";
import {
  formatProviderDestinationCurrency,
  PROVIDER_DESTINATION_COLUMN_TITLES,
  PROVIDER_DESTINATION_EMPTY_TEXT,
} from "./providerDestinations.js";
import {
  formatProviderPaginationTotal,
  isDuplicateProviderTaxNumber,
  isLegacyProviderBooleanVisible,
  isProviderQueryFailure,
  providerMutationRelationship,
  PROVIDER_CATALOG_DUPLICATE_RTN_MESSAGE,
  PROVIDER_CATALOG_EMPTY_TEXT,
  PROVIDER_CATALOG_PAGE_SIZE,
  PROVIDER_CATALOG_QUERY_ERROR,
  PROVIDER_CATALOG_SUCCESS_MESSAGE,
} from "./providerCatalogParity.js";
import "./ProviderCatalogPage.css";

const loadProviders = (query) => getProviders(query);

function LegacyProviderBoolean({ value }) {
  return (
    <span className="legacy-provider-boolean" aria-label={isLegacyProviderBooleanVisible(value) ? "Sí" : "No"}>
      {isLegacyProviderBooleanVisible(value) ? <i className="fa fa-check" aria-hidden="true" /> : null}
    </span>
  );
}

function providerFormValues(provider) {
  if (!provider) {
    return {
      commercialName: "",
      legalName: "",
      taxNumber: "",
      active: false,
      withholdingOne: false,
      withholdingTwelve: false,
      destinationId: undefined,
    };
  }
  return {
    commercialName: provider.commercialName || "",
    legalName: provider.legalName || "",
    taxNumber: provider.taxNumber || "",
    active: isTrue(provider.active),
    withholdingOne: isTrue(provider.withholdingOne),
    withholdingTwelve: isTrue(provider.withholdingTwelve),
    editInternalToggle: false,
    destinationId: undefined,
  };
}

export function ProviderCatalogPage() {
  const listing = useCatalogList(loadProviders, {
    onlyExternal: true,
    onlyActive: true,
    pageSize: PROVIDER_CATALOG_PAGE_SIZE,
  });
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providerBranches, setProviderBranches] = useState([]);
  const [branchError, setBranchError] = useState("");
  const [destinationError, setDestinationError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [newInternalToggle, setNewInternalToggle] = useState(false);
  const [, setLegacyInternalBranchEditRequested] = useState(false);
  const [expandedProviderIds, setExpandedProviderIds] = useState([]);
  const [destinationsByProvider, setDestinationsByProvider] = useState({});

  useEffect(() => {
    let active = true;
    getProviderBranches().then((result) => {
      if (!active) return;
      if (result.success) {
        setProviderBranches(result.data || []);
        setBranchError("");
      } else {
        setProviderBranches([]);
        setBranchError(result.message || PROVIDER_CATALOG_QUERY_ERROR);
      }
    });
    return () => { active = false; };
  }, []);

  function openModal(provider = null) {
    setOperationError("");
    setEditing(provider);
    form.setFieldsValue({
      ...providerFormValues(provider),
      ...(!provider ? { newInternalToggle } : {}),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function saveProvider(values) {
    setOperationError("");
    setSaving(true);
    const relationship = providerMutationRelationship(values, Boolean(editing), editing);
    const payload = {
      ...values,
      ...relationship,
      legalName: values.legalName || null,
      active: Boolean(values.active),
      withholdingOne: Boolean(values.withholdingOne),
      withholdingTwelve: Boolean(values.withholdingTwelve),
    };
    delete payload.newInternalToggle;
    delete payload.editInternalToggle;
    const result = editing
      ? await updateProvider(editing.id, payload)
      : await createProvider(payload);
    if (result.success) {
      message.success(PROVIDER_CATALOG_SUCCESS_MESSAGE);
      closeModal();
      listing.reload();
    } else {
      if (isDuplicateProviderTaxNumber(result)) {
        message.warning(PROVIDER_CATALOG_DUPLICATE_RTN_MESSAGE);
      } else if (isProviderQueryFailure(result)) {
        setOperationError(PROVIDER_CATALOG_QUERY_ERROR);
      } else {
        message.error(result.message);
      }
      if (result.error?.field) {
        form.setFields([{ name: result.error.field, errors: [result.message] }]);
      }
    }
    setSaving(false);
  }

  async function toggleProviderDestinations(provider) {
    const providerId = Number(provider.id);
    const isExpanded = expandedProviderIds.includes(providerId);
    if (isExpanded) {
      setExpandedProviderIds((current) => current.filter((id) => id !== providerId));
      return;
    }

    setExpandedProviderIds((current) => [...current, providerId]);
    if (destinationsByProvider[providerId]?.loaded) return;
    setDestinationsByProvider((current) => ({
      ...current,
      [providerId]: { items: [], currencySymbol: "", error: "", loading: true, loaded: false },
    }));
    const result = await getProviderDestinations(providerId);
    setDestinationError(result.success ? "" : (result.message || PROVIDER_CATALOG_QUERY_ERROR));
    setDestinationsByProvider((current) => ({
      ...current,
      [providerId]: result.success
        ? {
            items: result.data?.items || [],
            currencySymbol: result.data?.currencySymbol || "",
            error: "",
            loading: false,
            loaded: true,
          }
        : {
            items: [],
            currencySymbol: "",
            error: result.message || "No fue posible consultar los destinos vinculados.",
            loading: false,
            loaded: false,
          },
    }));
  }

  function renderProviderDestinations(provider) {
    const destinationState = destinationsByProvider[Number(provider.id)] || {
      items: [],
      currencySymbol: "",
      error: "",
      loading: true,
    };
    if (destinationState.loading) {
      return <div className="legacy-provider-destinations-loading"><Spin size="small" /></div>;
    }
    if (destinationState.error) {
      return null;
    }
    if (destinationState.items.length === 0) {
      return <div className="legacy-provider-destinations-empty">{PROVIDER_DESTINATION_EMPTY_TEXT}</div>;
    }
    return (
      <div className="legacy-provider-destinations">
        <Table
          className="legacy-provider-destinations-table"
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={destinationState.items}
          columns={[
            {
              title: PROVIDER_DESTINATION_COLUMN_TITLES[0],
              dataIndex: "bankName",
              key: "bankName",
            },
            {
              title: PROVIDER_DESTINATION_COLUMN_TITLES[1],
              dataIndex: "accountNumber",
              key: "accountNumber",
            },
            {
              title: PROVIDER_DESTINATION_COLUMN_TITLES[2],
              key: "currency",
              render: (_, row) => formatProviderDestinationCurrency(
                row.isDollars,
                destinationState.currencySymbol,
              ),
            },
          ]}
        />
      </div>
    );
  }

  const columns = [
    { title: "Nombre Comercial", dataIndex: "commercialName", key: "commercialName", width: 235, sorter: true, sortDirections: ["ascend", "descend", "ascend"] },
    { title: "Nombre Legal", dataIndex: "legalName", key: "legalName", width: 235, align: "center", sorter: true, sortDirections: ["ascend", "descend", "ascend"] },
    { title: "Número Fiscal", dataIndex: "taxNumber", key: "taxNumber", width: 162, align: "center", sorter: true, sortDirections: ["ascend", "descend", "ascend"] },
    { title: "Tipo ", dataIndex: "internal", key: "type", width: 95, render: (value) => isTrue(value) ? "Interno" : "Externo" },
    { title: "Activo", dataIndex: "active", key: "active", width: 106, align: "center", sorter: true, sortDirections: ["ascend", "descend", "ascend"], render: (value) => <LegacyProviderBoolean value={value} /> },
    { title: "Ret. 1%", dataIndex: "withholdingOne", key: "withholdingOne", width: 93, align: "center", render: (value) => <LegacyProviderBoolean value={value} /> },
    { title: "Ret. 12.5%", dataIndex: "withholdingTwelve", key: "withholdingTwelve", width: 112, align: "center", render: (value) => <LegacyProviderBoolean value={value} /> },
    {
      title: "",
      key: "actions",
      width: 160,
      render: (_, row) => (
        <Space size={4}>
          <Button
            type="link"
            className="legacy-catalog-row-link legacy-provider-destination-trigger"
            icon={<i className={`fa ${expandedProviderIds.includes(Number(row.id)) ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true" />}
            onClick={() => toggleProviderDestinations(row)}
          >
            Destinos
          </Button>
          <Button className="legacy-provider-edit" type="text" icon={<i className="fa fa-pencil-square-o" aria-hidden="true" />} aria-label={`Editar ${row.commercialName}`} onClick={() => openModal(row)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="legacy-catalog-page legacy-provider-catalog-page">
      <div className="legacy-provider-page-header">
        <h1>Catálogo de Proveedores</h1>
        <Button type="link" onClick={() => openModal()}>+ Nuevo Proveedor</Button>
      </div>
      <Form
        layout="vertical"
        className="legacy-catalog-filters is-four"
        initialValues={{ onlyExternal: true, onlyActive: true }}
        onValuesChange={(_, values) => listing.setFilters(values, { resetPage: false })}
      >
        <Form.Item label="Nombre" name="name"><Input prefix={<i className="fa fa-search" aria-hidden="true" />} maxLength={50} /></Form.Item>
        <Form.Item label="Número Fiscal" name="taxNumber"><Input prefix={<i className="fa fa-search" aria-hidden="true" />} maxLength={50} /></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyExternal" valuePropName="checked"><Checkbox>Solo Externos</Checkbox></Form.Item>
        <Form.Item className="legacy-catalog-check" name="onlyActive" valuePropName="checked"><Checkbox>Solo Activas</Checkbox></Form.Item>
      </Form>
      {(listing.error || branchError || destinationError || operationError) && (
        <LegacyErrorFeedback message={PROVIDER_CATALOG_QUERY_ERROR} />
      )}
      <Table
        className="legacy-history-table legacy-catalog-table"
        rowKey="id"
        columns={columns}
        dataSource={listing.rows}
        loading={listing.loading}
        locale={{ emptyText: PROVIDER_CATALOG_EMPTY_TEXT }}
        pagination={{
          ...listing.pagination,
          showTotal: formatProviderPaginationTotal,
        }}
        onChange={listing.changeTable}
        expandable={{
          expandedRowKeys: expandedProviderIds,
          expandedRowRender: renderProviderDestinations,
          showExpandColumn: false,
        }}
      />

      <Modal
        className="legacy-provider-editor-modal"
        title={(
          <div className="legacy-provider-modal-title">
            <img src={`${runtimeConfig.basePath}/brand/branch-detail/logoFarmaciaAhorro.jpg`} alt="Farmacias del Ahorro" />
            <span>{editing ? "Modificar Proveedor" : "Nuevo Proveedor"}</span>
          </div>
        )}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
        centered
        closable={false}
        maskClosable={false}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          className="legacy-catalog-modal-form legacy-provider-modal-form"
          onValuesChange={(changed) => {
            if (!editing && Object.hasOwn(changed, "newInternalToggle")) {
              setNewInternalToggle(Boolean(changed.newInternalToggle));
            }
          }}
          onFinish={saveProvider}
        >
          <Form.Item label="Nombre de Proveedor" name="commercialName">
            <Input maxLength={512} />
          </Form.Item>
          <Form.Item label="Nombre Legal" name="legalName"><Input maxLength={512} /></Form.Item>
          <Form.Item label="Número Fiscal" name="taxNumber" rules={[{ required: true, message: "Campo Obligatorio" }]}>
            <Input maxLength={64} />
          </Form.Item>
          <div className="legacy-catalog-checkbox-grid legacy-provider-checkbox-grid">
            <Form.Item label="Activo" name="active" valuePropName="checked"><Checkbox aria-label="Activo" /></Form.Item>
            <Form.Item label="Retencion 1%" name="withholdingOne" valuePropName="checked"><Checkbox aria-label="Retencion 1%" /></Form.Item>
            <Form.Item label="Retencion 12.5%" name="withholdingTwelve" valuePropName="checked"><Checkbox aria-label="Retencion 12.5%" /></Form.Item>
            <Form.Item label="Proveedor Interno" name={editing ? "editInternalToggle" : "newInternalToggle"} valuePropName="checked"><Checkbox aria-label="Proveedor Interno" /></Form.Item>
            {editing && (
              <Form.Item noStyle shouldUpdate={(before, after) => before.editInternalToggle !== after.editInternalToggle}>
                {({ getFieldValue }) => (
                  <div className="legacy-provider-branch-field">
                    <div className="legacy-provider-branch-label">Seleccione Sucursal</div>
                    {getFieldValue("editInternalToggle") ? (
                      <Form.Item name="destinationId">
                        <Select allowClear showSearch optionFilterProp="label" placeholder="Seleccionar..." options={options(providerBranches)} />
                      </Form.Item>
                    ) : null}
                    {isTrue(editing.internal) ? (
                      <div className="legacy-provider-existing-branch">
                        <Input defaultValue={editing.destinationName || ""} aria-label="Sucursal interna actual" />
                        <Button
                          type="link"
                          className="legacy-provider-existing-branch-edit"
                          icon={<i className="fa fa-pencil-square-o" aria-hidden="true" />}
                          aria-label="Editar sucursal interna"
                          onClick={() => setLegacyInternalBranchEditRequested(true)}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </Form.Item>
            )}
          </div>
          <div className="legacy-catalog-modal-actions">
            <Button className="legacy-provider-cancel" onClick={closeModal}>Cancelar</Button>
            <Button type="primary" htmlType="submit">Guardar</Button>
          </div>
        </Form>
      </Modal>

      <Modal
        className="legacy-provider-loading-modal"
        open={saving}
        closable={false}
        maskClosable={false}
        footer={null}
        centered
        width={500}
        title={<span><WarningOutlined /> Favor Espere...</span>}
      >
        <div className="legacy-provider-loading-content">
          <Spin size="large" />
          <span>Generando Solicitud...</span>
        </div>
      </Modal>
    </div>
  );
}
