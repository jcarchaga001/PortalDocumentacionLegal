import { useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { LegacyErrorFeedback } from "../components/LegacyErrorFeedback.jsx";
import { runtimeConfig } from "../config/runtime.js";
import { ROUTES } from "../routes/routePaths.js";
import {
  createCorporateClient,
  getCorporateClient,
  updateCorporateClient,
} from "../services/corporateClientService.js";
import {
  CORPORATE_CLIENT_FORM_FEEDBACK,
  emptyClient,
  emptyContact,
  normalizeLegacyPhone,
} from "./corporateClientFormParity.js";
import "./CorporateClientFormPage.css";

function clientIdFromSearch(search) {
  const value = Number(new URLSearchParams(search).get("CodCliente"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function LegacyPhoneInput({ id, label, value, onChange, separateDialCode = false, disabled = false }) {
  return (
    <div className={`corporate-client-phone${separateDialCode ? " has-dial-code" : ""}`}>
      <button type="button" className="corporate-client-country" aria-label="Selected country" disabled={disabled}>
        <img
          className="corporate-client-flag"
          src={`${runtimeConfig.basePath}/brand/country-honduras.png`}
          alt=""
          aria-hidden="true"
        />
        <span className="corporate-client-country-caret" aria-hidden="true" />
        {separateDialCode ? <span className="corporate-client-dial-code">+504</span> : null}
        <span className="legacy-wcag-hide-text">Honduras +504</span>
      </button>
      <input
        id={id}
        aria-label={label}
        type="text"
        maxLength={25}
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Field({ id, label, value, onChange, maxLength, mandatory = false, invalid = false }) {
  return (
    <div className="corporate-client-field">
      <label htmlFor={id} className={mandatory ? "is-mandatory" : ""}>{label}</label>
      <input
        id={id}
        type="text"
        maxLength={maxLength}
        required={mandatory}
        aria-invalid={invalid || undefined}
        className={invalid ? "not-valid" : ""}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid ? <span className="corporate-client-validation">Campo Obligatorio</span> : null}
    </div>
  );
}

function StoredContactRow({ contact, index, onRemove }) {
  return (
    <div className="corporate-client-contact-grid corporate-client-stored-contact">
      <div className="corporate-client-field"><label htmlFor={`contact-name-${index}`}>Nombre</label><input id={`contact-name-${index}`} value={contact.name || ""} disabled readOnly /></div>
      <div className="corporate-client-field"><label htmlFor={`contact-position-${index}`}>Puesto</label><input id={`contact-position-${index}`} value={contact.position || ""} disabled readOnly /></div>
      <div className="corporate-client-field"><label htmlFor={`contact-phone-${index}`}>Teléfono</label><input id={`contact-phone-${index}`} value={contact.phone || ""} disabled readOnly /></div>
      <div className="corporate-client-field"><label htmlFor={`contact-email-${index}`}>Correo</label><input id={`contact-email-${index}`} value={contact.email || ""} disabled readOnly /></div>
      <div className="corporate-client-contact-action">
        <a href="#" aria-label={`Remover contacto ${index + 1}`} onClick={(event) => { event.preventDefault(); onRemove(index); }}>
          <i className="icon fa fa-minus-circle fa-2x" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

export function CorporateClientFormPage() {
  const history = useHistory();
  const location = useLocation();
  const clientId = useMemo(() => clientIdFromSearch(location.search), [location.search]);
  const [client, setClient] = useState(emptyClient);
  const [contacts, setContacts] = useState([]);
  const [removedContactIds, setRemovedContactIds] = useState([]);
  const [draft, setDraft] = useState(emptyContact);
  const [invalid, setInvalid] = useState({ name: false, faCode: false });
  const [loading, setLoading] = useState(Boolean(clientId));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(
    clientId ? null : { type: "error", message: CORPORATE_CLIENT_FORM_FEEDBACK.initialTelephoneFailure },
  );

  useEffect(() => {
    let active = true;
    if (!clientId) return () => { active = false; };
    setLoading(true);
    getCorporateClient(clientId).then((result) => {
      if (!active) return;
      if (result.success) {
        setClient({ ...emptyClient, ...result.data });
        setContacts(Array.isArray(result.data?.contacts) ? result.data.contacts : []);
      } else {
        setFeedback({ type: "error", message: CORPORATE_CLIENT_FORM_FEEDBACK.queryFailure });
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [clientId]);

  const setClientValue = (name, value) => {
    setClient((current) => ({ ...current, [name]: value }));
    if (name === "name" || name === "faCode") setInvalid((current) => ({ ...current, [name]: false }));
  };

  const setDraftValue = (name, value) => setDraft((current) => ({ ...current, [name]: value }));

  function addContact(event) {
    event.preventDefault();
    if (draft.name === "") {
      setFeedback({ type: "warning", message: CORPORATE_CLIENT_FORM_FEEDBACK.contactNameRequired });
      return;
    }
    const phone = normalizeLegacyPhone(draft.phone);
    if (phone === "") {
      setFeedback({ type: "warning", message: CORPORATE_CLIENT_FORM_FEEDBACK.contactPhoneRequired });
      return;
    }
    setContacts((current) => [...current, { ...draft, phone }]);
    setDraft(emptyContact);
  }

  function removeContact(index) {
    setContacts((current) => {
      const selected = current[index];
      if (Number(selected?.id) > 0) {
        setRemovedContactIds((removed) => removed.includes(Number(selected.id)) ? removed : [...removed, Number(selected.id)]);
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  async function submit(event) {
    event.preventDefault();
    const nextInvalid = { name: client.name === "", faCode: client.faCode === "" };
    if (nextInvalid.name || nextInvalid.faCode) {
      setInvalid(nextInvalid);
      setFeedback({ type: "warning", message: CORPORATE_CLIENT_FORM_FEEDBACK.mandatoryFields });
      return;
    }

    setSaving(true);
    const payload = { ...client, contacts, removedContactIds };
    const result = clientId
      ? await updateCorporateClient(clientId, payload)
      : await createCorporateClient(payload);
    if (!result.success) {
      setFeedback({ type: "error", message: CORPORATE_CLIENT_FORM_FEEDBACK.queryFailure });
      setSaving(false);
      return;
    }
    history.push(ROUTES.corporateClients);
  }

  return (
    <div className="legacy-form-page legacy-client-form-page" aria-busy={loading || saving}>
      <LegacyErrorFeedback message={feedback?.message} type={feedback?.type} />
      <div className="corporate-client-form-title">{clientId ? "Editar Cliente Corporativo" : "Nuevo Cliente Corporativo"}</div>

      <form className="corporate-client-form" onSubmit={submit} noValidate>
        <fieldset disabled={loading}>
          <div className="corporate-client-main-grid">
            <Field id="Input_Nombre_Cliente" label="Nombre Cliente" value={client.name} onChange={(value) => setClientValue("name", value)} maxLength={250} mandatory invalid={invalid.name} />
            <Field id="Input_CodigoFA" label="CodigoFA" value={client.faCode} onChange={(value) => setClientValue("faCode", value)} maxLength={30} mandatory invalid={invalid.faCode} />
            <Field id="Input_NombreContacto" label="Nombre Contacto Principal" value={client.contactName} onChange={(value) => setClientValue("contactName", value)} maxLength={120} />
            <Field id="Input_PuestoContacto" label="Puesto Contacto Principal" value={client.contactPosition} onChange={(value) => setClientValue("contactPosition", value)} maxLength={160} />
            <Field id="Input_CorreoContacto" label="Correo Contacto Principal" value={client.contactEmail} onChange={(value) => setClientValue("contactEmail", value)} maxLength={120} />
            <div className="corporate-client-field corporate-client-main-phone">
              <label htmlFor="Input_TelefonoContacto">Telefono Contacto Principal</label>
              <LegacyPhoneInput id="Input_TelefonoContacto" label="Telefono Contacto Principal" value={client.contactPhone} onChange={(value) => setClientValue("contactPhone", value)} disabled={loading} />
            </div>
          </div>

          <section className="corporate-client-contacts-card">
            <h2>Contactos Extras</h2>
            {contacts.map((contact, index) => <StoredContactRow key={`${contact.id || "new"}-${index}`} contact={contact} index={index} onRemove={removeContact} />)}
            <div className="corporate-client-contact-grid corporate-client-draft-contact">
              <Field id="Input_Nombre13" label="Nombre" value={draft.name} onChange={(value) => setDraftValue("name", value)} maxLength={120} />
              <Field id="Input_Nombre14" label="Puesto" value={draft.position} onChange={(value) => setDraftValue("position", value)} maxLength={160} />
              <div className="corporate-client-field"><label htmlFor="Input_Nombre15">Teléfono</label><LegacyPhoneInput id="Input_Nombre15" value={draft.phone} onChange={(value) => setDraftValue("phone", value)} separateDialCode disabled={loading} /></div>
              <Field id="Input_Nombre16" label="Correo" value={draft.email} onChange={(value) => setDraftValue("email", value)} maxLength={120} />
              <div className="corporate-client-contact-action">
                <a href="#" aria-label="Agregar contacto" onClick={addContact}><i className="icon fa fa-plus-circle fa-2x" aria-hidden="true" /></a>
              </div>
            </div>
          </section>

          <div className="corporate-client-form-actions">
            <button type="button" className="corporate-client-cancel" onClick={() => history.push(ROUTES.corporateClients)}>Cancelar</button>
            <button type="submit" className="corporate-client-save" disabled={saving}>
              {saving ? <span className="corporate-client-saving-spinner" aria-hidden="true" /> : null}
              {clientId ? "Guardar" : "Crear Cliente"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
