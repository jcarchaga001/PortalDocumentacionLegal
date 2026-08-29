import { useMemo, useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import {
  LEGACY_AGREEMENT_UPLOAD,
  legacyAgreementStoredExtension,
  validateLegacyAgreementCandidate,
} from "../config/legacyFileContracts.js";
import { ROUTES } from "../routes/routePaths.js";
import {
  createAgreement,
  getAgreement,
  getAgreementCatalogs,
  updateAgreement,
} from "../services/agreementService.js";
import { fileToBase64 } from "../services/fileHelpers.js";
import { uploadFileToS3 } from "../services/tdS3Service.js";
import {
  AGREEMENT_FORM_FEEDBACK,
  EMPTY_AGREEMENT_FORM,
  agreementToForm,
  legacyBranchLabel,
  recalculatePromissoryState,
  validateAgreementForm,
} from "./agreementFormParity.js";
import "./AgreementFormPage.css";

function agreementIdFromSearch(search) {
  const value = Number(new URLSearchParams(search).get("CodConvenio"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function todayLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function optionLabel(option) {
  return option?.name || "";
}

function LegacySearchSelect({ id, value, options, placeholder, onChange, getLabel = optionLabel }) {
  const selected = options.find((option) => String(option.id) === String(value));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabel = selected ? getLabel(selected) : "";
  const visibleOptions = options
    .filter((option) => getLabel(option).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .slice(0, 100);

  return (
    <div className="agreement-search-select">
      <input
        id={id}
        className="agreement-search-select__control"
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={open ? query : selectedLabel}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      <i className="fa fa-chevron-down agreement-select-caret" aria-hidden="true" />
      {open ? (
        <div className="agreement-select-options" role="listbox">
          {visibleOptions.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={String(option.id) === String(value)}
              className={`agreement-select-option${String(option.id) === String(value) ? " is-selected" : ""}`}
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(String(option.id)); setOpen(false); setQuery(""); }}
            >
              {getLabel(option)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegacyMultiSelect({ id, values, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabels = options
    .filter((option) => values.includes(String(option.id)))
    .map(legacyBranchLabel);
  const visibleOptions = options
    .filter((option) => legacyBranchLabel(option).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .slice(0, 100);

  function toggle(optionId) {
    const normalizedId = String(optionId);
    onChange(values.includes(normalizedId)
      ? values.filter((value) => value !== normalizedId)
      : [...values, normalizedId]);
  }

  return (
    <div className="agreement-multi-select">
      <input
        id={id}
        className="agreement-multi-select__control"
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={open ? query : selectedLabels.join(", ")}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      <i className="fa fa-chevron-down agreement-select-caret" aria-hidden="true" />
      {open ? (
        <div className="agreement-select-options" role="listbox" aria-multiselectable="true">
          {visibleOptions.map((option) => {
            const selected = values.includes(String(option.id));
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`agreement-select-option${selected ? " is-selected" : ""}`}
                key={option.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(option.id)}
              >
                {legacyBranchLabel(option)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Checkbox({ id, checked, onChange, label }) {
  return (
    <label className="agreement-form-checkbox" htmlFor={id} aria-label={label}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="agreement-form-checkbox-mark" aria-hidden="true" />
    </label>
  );
}

function CurrencyInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const normalizedValue = String(value ?? "").replaceAll(",", "");
  const number = Number(normalizedValue);
  const displayValue = focused || normalizedValue === "" || !Number.isFinite(number)
    ? normalizedValue
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);
  return (
    <input
      id="Input_LimiteCredito"
      className="agreement-form-input"
      type="text"
      inputMode="decimal"
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => onChange(event.target.value.replaceAll(",", ""))}
    />
  );
}

export function AgreementFormPage() {
  const history = useHistory();
  const location = useLocation();
  const agreementId = useMemo(() => agreementIdFromSearch(location.search), [location.search]);
  const [catalogs, setCatalogs] = useState({ clients: [], branches: [], accountManagers: [] });
  const [values, setValues] = useState({ ...EMPTY_AGREEMENT_FORM });
  const [files, setFiles] = useState([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([]);
  const [loading, setLoading] = useState(Boolean(agreementId));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(Boolean(agreementId));
    Promise.all([
      getAgreementCatalogs(),
      agreementId ? getAgreement(agreementId) : Promise.resolve(null),
    ]).then(([catalogResult, agreementResult]) => {
      if (!active) return;
      if (catalogResult.success) {
        setCatalogs({ clients: [], branches: [], accountManagers: [], ...(catalogResult.data || {}) });
      } else {
        setFeedback({ type: "error", message: AGREEMENT_FORM_FEEDBACK.queryFailure });
      }
      if (agreementResult?.success) {
        setValues(agreementToForm(agreementResult.data));
        setFiles((agreementResult.data?.attachments || []).map((attachment) => ({
          uid: `existing-${attachment.id}`,
          name: attachment.fileName,
          attachmentId: attachment.id,
          s3Key: attachment.s3Key,
          isExisting: true,
        })));
      } else if (agreementResult && !agreementResult.success) {
        setFeedback({ type: "error", message: AGREEMENT_FORM_FEEDBACK.queryFailure });
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setFeedback({ type: "error", message: AGREEMENT_FORM_FEEDBACK.queryFailure });
      setLoading(false);
    });
    return () => { active = false; };
  }, [agreementId]);

  const setValue = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  function cancel() {
    history.push(agreementId
      ? `${ROUTES.agreementDetail}?CodConvenio=${agreementId}`
      : ROUTES.agreements);
  }

  function addFiles(event) {
    const candidates = Array.from(event.target.files || []);
    const accepted = [];
    for (const file of candidates) {
      const validation = validateLegacyAgreementCandidate(file, files.length + accepted.length);
      if (validation.valid) {
        accepted.push({ uid: `new-${Date.now()}-${accepted.length}`, name: file.name, file, isExisting: false });
      }
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
    event.target.value = "";
  }

  function removeFile(file) {
    if (file.isExisting && Number(file.attachmentId) > 0) {
      setRemovedAttachmentIds((current) => current.includes(Number(file.attachmentId))
        ? current
        : [...current, Number(file.attachmentId)]);
    }
    setFiles((current) => current.filter((entry) => entry.uid !== file.uid));
  }

  async function uploadAttachments() {
    const attachments = [];
    for (const entry of files.filter((file) => !file.isExisting)) {
      const uploadResult = await uploadFileToS3({
        fileBase64: await fileToBase64(entry.file),
        fileName: entry.file.name,
        contentType: entry.file.type || "application/octet-stream",
        metadata: {
          module: "DocumentacionLegal",
          domain: "agreements",
          ...(agreementId ? { agreementId: String(agreementId) } : {}),
        },
      });
      const s3Key = uploadResult.success ? uploadResult.data?.s3Key : "";
      if (!s3Key) throw new Error(uploadResult.message || "S3_UPLOAD_FAILED");
      attachments.push({
        s3Key,
        fileName: entry.file.name,
        extension: legacyAgreementStoredExtension(entry.file.name),
      });
    }
    return attachments;
  }

  async function submit(event) {
    event.preventDefault();
    setFeedback(null);
    const validationMessage = validateAgreementForm(values, files.length);
    if (validationMessage) {
      setFeedback({ type: "warning", message: validationMessage });
      return;
    }

    setSaving(true);
    let attachments;
    try {
      attachments = await uploadAttachments();
    } catch (error) {
      setFeedback({ type: "error", message: error.message === "S3_UPLOAD_FAILED"
        ? AGREEMENT_FORM_FEEDBACK.queryFailure
        : error.message });
      setSaving(false);
      return;
    }

    const payload = {
      clientId: Number(values.clientId),
      accountManagerCode: values.accountManagerCode,
      branchIds: values.branchIds.map(Number),
      creditDays: Number(values.creditDays),
      creditLimit: Number(String(values.creditLimit).replaceAll(",", "")),
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      hasPromissoryNote: values.promissoryState !== "no",
      isPromissoryNoteExpired: values.promissoryState === "expired",
      promissoryNoteExpirationDate: values.promissoryNoteExpirationDate || undefined,
      isDollar: values.isDollar,
      isIndefinite: values.isIndefinite,
      isPromissoryNoteIndefinite: values.isPromissoryNoteIndefinite,
      observation: values.observation,
      removedAttachmentIds,
      attachments,
    };
    const result = agreementId
      ? await updateAgreement(agreementId, payload)
      : await createAgreement(payload);
    if (!result.success) {
      setFeedback({ type: "error", message: result.message || AGREEMENT_FORM_FEEDBACK.queryFailure });
      setSaving(false);
      return;
    }
    cancel();
  }

  const selectedBranches = catalogs.branches.filter((branch) => values.branchIds.includes(String(branch.id)));
  const promissoryDateDisabled = values.promissoryState === "no" || values.isPromissoryNoteIndefinite;

  return (
    <div className="agreement-form-page" aria-busy={loading || saving}>
      <LegacyErrorFeedback message={feedback?.message} type={feedback?.type} />
      <div className="agreement-form-title">{agreementId ? "Editar Convenio" : "Nuevo Convenio"}</div>

      <form className="agreement-form-card" onSubmit={submit} noValidate>
        <fieldset disabled={loading || saving}>
          <div className="agreement-form-columns">
            <div>
              <div className="agreement-form-field">
                <label htmlFor="ClienteCorp">Nombre del Cliente</label>
                <LegacySearchSelect id="ClienteCorp" value={values.clientId} options={catalogs.clients} placeholder="Seleccion un Cliente..." onChange={(value) => setValue("clientId", value)} />
              </div>
              <div className="agreement-form-field">
                <label className="is-mandatory" htmlFor="Input_DiasCredito">Días de Crédito</label>
                <input id="Input_DiasCredito" className="agreement-form-input" type="number" min="0" step="1" value={values.creditDays} onChange={(event) => setValue("creditDays", event.target.value)} />
              </div>
              <div className="agreement-form-field">
                <label className="is-mandatory" htmlFor="Input_FechaInicial">Fecha Inicial</label>
                <input id="Input_FechaInicial" className="agreement-form-input" type="date" value={values.startDate} onChange={(event) => setValue("startDate", event.target.value)} />
              </div>
              <div className="agreement-form-field agreement-form-radio-field">
                <label className="is-mandatory">¿Tiene Pagaré?</label>
                <div className="agreement-form-radios" role="radiogroup">
                  {[["yes", "Si"], ["no", "No"], ["expired", "Vencido"]].map(([value, label]) => (
                    <label className="agreement-form-radio" key={value}>
                      <input type="radio" name="HasPagare" value={value} checked={values.promissoryState === value} onChange={() => setValue("promissoryState", value)} />
                      <span className="agreement-form-radio-mark" aria-hidden="true" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="agreement-form-field">
                <label htmlFor="Sucursales">Sucursales que Facturan</label>
                <LegacyMultiSelect id="Sucursales" values={values.branchIds} options={catalogs.branches} placeholder="Seleccion las Sucursales..." onChange={(value) => setValue("branchIds", value)} />
              </div>
            </div>

            <div>
              <div className="agreement-form-field">
                <label htmlFor="GestorCuenta">Gestor de Cuenta</label>
                <LegacySearchSelect id="GestorCuenta" value={values.accountManagerCode} options={catalogs.accountManagers} placeholder="Seleccion al gestor..." onChange={(value) => setValue("accountManagerCode", value)} />
              </div>
              <div className="agreement-form-composite">
                <div className="agreement-form-composite-labels">
                  <label className="is-mandatory" htmlFor="Input_LimiteCredito">Límite de Crédito</label>
                  <label htmlFor="IsDollar">En Dólares</label>
                </div>
                <div className="agreement-form-composite-row">
                  <CurrencyInput value={values.creditLimit} onChange={(value) => setValue("creditLimit", value)} />
                  <Checkbox id="IsDollar" label="En Dólares" checked={values.isDollar} onChange={(value) => setValue("isDollar", value)} />
                </div>
              </div>
              <div className="agreement-form-composite">
                <div className="agreement-form-composite-labels">
                  <label className="is-mandatory" htmlFor="Input_FechaFinal">Fecha Final</label>
                  <label htmlFor="Checkbox1">Indefinido</label>
                </div>
                <div className="agreement-form-composite-row">
                  <input id="Input_FechaFinal" className="agreement-form-input" type="date" disabled={values.isIndefinite} value={values.endDate} onChange={(event) => setValue("endDate", event.target.value)} />
                  <Checkbox id="Checkbox1" label="Indefinido" checked={values.isIndefinite} onChange={(value) => setValue("isIndefinite", value)} />
                </div>
              </div>
              <div className="agreement-form-composite">
                <div className="agreement-form-composite-labels">
                  <label htmlFor="Input_FechaInicial2">Fecha Vencimiento Pagaré</label>
                  <label htmlFor="Checkbox2">Indefinido</label>
                </div>
                <div className="agreement-form-composite-row">
                  <input
                    id="Input_FechaInicial2"
                    className="agreement-form-input"
                    type="date"
                    disabled={promissoryDateDisabled}
                    value={values.promissoryNoteExpirationDate}
                    onChange={(event) => setValues((current) => ({
                      ...current,
                      promissoryNoteExpirationDate: event.target.value,
                      promissoryState: recalculatePromissoryState(current.promissoryState, event.target.value, todayLocal()),
                    }))}
                  />
                  <Checkbox id="Checkbox2" label="Indefinido" checked={values.isPromissoryNoteIndefinite} onChange={(value) => setValue("isPromissoryNoteIndefinite", value)} />
                </div>
              </div>
              <div className="agreement-form-field">
                <label htmlFor="TextArea_Observacion">Observación</label>
                <textarea id="TextArea_Observacion" className="agreement-form-textarea" value={values.observation} onChange={(event) => setValue("observation", event.target.value)} />
              </div>
            </div>
          </div>

          <div className="agreement-form-branch-region">
            <div className="agreement-form-branch-tags" aria-label="Sucursales seleccionadas">
              {selectedBranches.map((branch) => <span className="agreement-form-branch-tag" key={branch.id}>{branch.internalCode || legacyBranchLabel(branch)}</span>)}
            </div>
          </div>

          <label className="agreement-form-upload">
            <input type="file" multiple accept={LEGACY_AGREEMENT_UPLOAD.accept} onChange={addFiles} />
            <i className="fa fa-file-o" aria-hidden="true" />
            <span className="agreement-form-upload-primary">{LEGACY_AGREEMENT_UPLOAD.prompt}</span>
            <span className="agreement-form-upload-secondary">{LEGACY_AGREEMENT_UPLOAD.browseText}</span>
          </label>

          <div className={`agreement-form-files${files.length ? " has-files" : ""}`}>
            {files.map((file) => (
              <div className="agreement-form-file" key={file.uid}>
                <i className={`fa ${file.name.toLocaleLowerCase().endsWith(".pdf") ? "fa-file-pdf-o" : "fa-file-o"}`} aria-hidden="true" />
                <span>{file.name}</span>
                <i className="fa fa-check" aria-label="Archivo válido" />
                <button type="button" className="agreement-form-file-remove" title="Eliminar" aria-label={`Eliminar ${file.name}`} onClick={() => removeFile(file)}>
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className="agreement-form-actions">
            <button type="button" className="agreement-form-cancel" onClick={cancel}>Cancelar</button>
            <button type="submit" className="agreement-form-save" disabled={saving}>
              {saving ? <span className="agreement-form-spinner" aria-hidden="true" /> : null}
              {agreementId ? "Guardar" : "Crear convenio"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
