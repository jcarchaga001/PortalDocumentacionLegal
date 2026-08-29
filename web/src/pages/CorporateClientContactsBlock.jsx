import { useEffect, useState } from "react";
import { getCorporateClientContacts } from "../services/corporateClientService.js";
import {
  CORPORATE_CLIENT_CONTACT_COLUMNS,
  CORPORATE_CLIENT_CONTACTS_EMPTY_TEXT,
} from "./corporateClientContactsParity.js";

export function CorporateClientContactsBlock({ clientId, onQueryError }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setContacts([]);
    setLoading(true);

    getCorporateClientContacts(clientId).then((result) => {
      if (!active) return;
      if (result?.success) {
        setContacts(result.data?.items || []);
      } else {
        onQueryError();
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      onQueryError();
      setLoading(false);
    });

    return () => { active = false; };
  }, [clientId, onQueryError]);

  return (
    <div className="corporate-client-contacts-block">
      <table className="corporate-client-contacts-table" role="grid" aria-busy={loading}>
        <thead>
          <tr className="corporate-client-contacts-header-row">
            {CORPORATE_CLIENT_CONTACT_COLUMNS.map((column) => (
              <th key={column.key} className="sortable" tabIndex={0}>
                {column.label}
                <span className="corporate-client-contacts-sortable-icon" aria-hidden="true" />
              </th>
            ))}
          </tr>
        </thead>
        {!loading && contacts.length > 0 ? (
          <tbody>
            {contacts.map((contact, index) => (
              <tr className="corporate-client-contacts-row" key={`${contact.id || "contact"}-${index}`}>
                <td>{contact.name}</td>
                <td>{contact.position}</td>
                <td>{contact.phone}</td>
                <td>{contact.email}</td>
              </tr>
            ))}
          </tbody>
        ) : null}
      </table>

      <div className="corporate-client-contacts-state">
        {loading ? (
          <div className="corporate-client-contacts-loading" aria-label="Cargando contactos" />
        ) : contacts.length === 0 ? (
          <div className="corporate-client-contacts-empty">{CORPORATE_CLIENT_CONTACTS_EMPTY_TEXT}</div>
        ) : null}
      </div>
    </div>
  );
}

