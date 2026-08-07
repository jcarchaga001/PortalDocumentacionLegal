const TEMPLATE_METADATA = Object.freeze({
  emNotiAccionLegal: {
    subject: "Notificación Portal Casos Laborales - Asignación Acción",
    description: "Asignación de una acción legal de un caso laboral.",
  },
  emNotiAccionCasosLaborales: {
    subject: "Notificación Portal Casos Laborales - Asignación Acción",
    description: "Asignación de una acción de un caso laboral.",
  },
  emNotiAccionComentario: {
    subject: "Notificación Portal Casos Laborales - Comentario Urgente",
    description: "Comentario urgente de un caso laboral.",
  },
  emNotificacionAreaLegal: {
    subject: "Notificación del Portal de Documentación Legal",
    description: "Resumen de documentos vencidos o próximos a vencer para el área legal.",
  },
  emNotiAccionConveniosAVencer: {
    subject: "Atención - Convenios por Vencer",
    description: "Resumen de convenios que vencen durante los próximos treinta días.",
  },
  emNotificacionLegal: {
    subject: "Notificación del Portal de Documentación Legal",
    description: "Aviso individual de documento próximo a vencer.",
  },
  emNotiincidente: {
    subject: "Notificación Porta Incidentes",
    description: "Aviso de un incidente externo reportado por una sucursal.",
  },
  emNotificacionRRHH: {
    subject: "Notificación Porta Incidentes",
    description: "Asignación de una acción de un caso laboral a Recursos Humanos.",
  },
  emNotiAccion: {
    subject: "Notificación Porta Incidentes - Asignación Acción",
    description: "Asignación de una acción de un incidente.",
  },
  emNotificacionLegalVencido: {
    subject: "Notificación del Portal de Documentación Legal",
    description: "Aviso individual de documento vencido.",
  },
});

export const LEGACY_EMAIL_TEMPLATE_NAMES = Object.freeze(Object.keys(TEMPLATE_METADATA));

function templateError(message, field = "template") {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.status = 400;
  error.field = field;
  return error;
}

function value(input, ...keys) {
  for (const key of keys) {
    if (input?.[key] !== undefined && input[key] !== null) return input[key];
  }
  return "";
}

function plain(valueToNormalize) {
  return String(valueToNormalize ?? "").trim();
}

function escapeHtml(valueToEscape) {
  return String(valueToEscape ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseDate(valueToParse) {
  if (valueToParse instanceof Date && !Number.isNaN(valueToParse.getTime())) {
    return valueToParse;
  }
  const normalized = plain(valueToParse).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const MONTHS = Object.freeze(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]);

export function formatLegacyEmailDate(valueToFormat) {
  const date = parseDate(valueToFormat);
  if (!date) return plain(valueToFormat);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${MONTHS[date.getUTCMonth()]}/${date.getUTCFullYear()}`;
}

function formatTableDate(valueToFormat) {
  const date = parseDate(valueToFormat);
  if (!date) return plain(valueToFormat);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function brandName(input) {
  const configured = plain(value(input, "companyName", "CompanyName"));
  if (configured) return configured;
  return Number(value(input, "countryCode", "CodigoPais", "CodPais")) === 4
    ? "Farmacias del Ahorro"
    : "Farmavalue";
}

function htmlLayout({ input, title, paragraphs = [], table = "" }) {
  const brand = escapeHtml(brandName(input));
  const paragraphHtml = paragraphs
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#343a40;line-height:1.55">${escapeHtml(paragraph)}</p>`)
    .join("");

  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f1f3f5;color:#202327;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f3f5;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:650px">
          <tr><td style="padding:0 24px 20px;text-align:center;font-weight:700;color:#4f575e">${brand}</td></tr>
          <tr><td style="background:#fff;border-radius:8px;padding:32px">
            <h1 style="font-size:24px;line-height:1.25;margin:0 0 20px;color:#202327">${escapeHtml(title)}</h1>
            ${paragraphHtml}${table}
          </td></tr>
          <tr><td style="padding:20px;text-align:center;font-size:12px;color:#6a7178">© ${new Date().getUTCFullYear()} ${brand}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function tableHtml(columns, rows) {
  const headers = columns
    .map((column) => `<th scope="col" style="padding:10px 8px;border-bottom:2px solid #dee2e6;text-align:left;font-size:12px;color:#4f575e">${escapeHtml(column.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td style="padding:10px 8px;border-bottom:1px solid #e9ecef;font-size:13px;vertical-align:top">${escapeHtml(column.read(row))}</td>`).join("")}</tr>`)
    .join("");
  return `<div style="overflow-x:auto"><table role="table" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function tableText(columns, rows) {
  const header = columns.map((column) => column.label).join(" | ");
  const body = rows.map((row) => columns.map((column) => plain(column.read(row))).join(" | "));
  return [header, ...body].join("\n");
}

function actionAssignment(input, { labor = false } = {}) {
  const dueDate = value(input, labor ? "closeDate" : "startDate", labor ? "FechaCierre" : "FechaInicio");
  const sender = plain(value(input, "assignedBy", "UsuarioAsigno"));
  const action = plain(value(input, "action", "Accion"));
  const branch = plain(value(input, "branchName", "SucursalNam"));
  return `Se le notifica que el usuario ${sender} le asigno una nueva acción (${action} ), para la Sucursal ${branch} con fecha de vencimiento ${formatLegacyEmailDate(dueDate)}`;
}

function renderActionTemplate(name, input, options) {
  const message = actionAssignment(input, options);
  const portal = options.labor
    ? "Puede consultar mas información en el portal Casos Laborales"
    : "Puede consultar mas información en el portal de Casos Laborales";
  return {
    subject: TEMPLATE_METADATA[name].subject,
    text: `${message}\n\n${portal}`,
    html: htmlLayout({ input, title: "Asignación de acción", paragraphs: [message, portal] }),
  };
}

function renderUrgentComment(input) {
  const message = `Se le notifica que el usuario ${plain(value(input, "assignedBy", "UsuarioAsigno"))} le envio un comentario de caracter urgente, por lo que se pide valide en FAO el mensaje enviado para el Caso Laboral ${plain(value(input, "caseReference", "ReferenciaCaso"))}`;
  const portal = "Puede consultar mas información en el portal de Casos Laborales";
  return {
    subject: TEMPLATE_METADATA.emNotiAccionComentario.subject,
    text: `${message}\n\n${portal}`,
    html: htmlLayout({ input, title: "Comentario urgente", paragraphs: [message, portal] }),
  };
}

const DOCUMENT_COLUMNS = Object.freeze([
  { label: "Sucursal", read: (row) => value(row, "branch", "Sucursal") },
  { label: "Categoría", read: (row) => value(row, "category", "Categoria") },
  { label: "Subcategoría", read: (row) => value(row, "subcategory", "subcategoria") },
  { label: "Documento", read: (row) => value(row, "documentCode", "CodigoDocumento") },
  { label: "Referencia", read: (row) => value(row, "documentReference", "referenciaDoc") },
  { label: "Fecha Vencimiento", read: (row) => formatTableDate(value(row, "dueDate", "fechaVencimiento")) },
  { label: "Estado", read: (row) => value(row, "status", "Estado") },
]);

function renderLegalArea(input) {
  const documents = value(input, "documents", "ListDocumentosLegal");
  const rows = Array.isArray(documents) ? documents : [];
  const intro = "Se notifica que el siguiente listado de documentos esta a punto de vencer o venció segun la fecha establecida.";
  const table = rows.length ? tableHtml(DOCUMENT_COLUMNS, rows) : "";
  const textTable = rows.length ? `\n\n${tableText(DOCUMENT_COLUMNS, rows)}` : "";
  return {
    subject: TEMPLATE_METADATA.emNotificacionAreaLegal.subject,
    text: `Aviso Documento Vencido\n\n${intro}${textTable}`,
    html: htmlLayout({ input, title: "Aviso Documento Vencido", paragraphs: [intro], table }),
  };
}

const AGREEMENT_COLUMNS = Object.freeze([
  { label: "Cliente", read: (row) => value(row, "clientName", "Nombre_Cliente") },
  { label: "Gerente de cuenta", read: (row) => value(row, "managerName", "NombreCompleto") },
  { label: "Fecha inicial", read: (row) => formatTableDate(value(row, "startDate", "FechaInicial")) },
  { label: "Fecha final", read: (row) => formatTableDate(value(row, "endDate", "FechaFinal")) },
]);

function renderAgreements(input) {
  const agreements = value(input, "agreements", "Convenios");
  const rows = Array.isArray(agreements) ? agreements : [];
  const intro = "Se notifica que los siguientes convenios vencerán dentro de los próximos 30 días.";
  const table = rows.length ? tableHtml(AGREEMENT_COLUMNS, rows) : "";
  const textTable = rows.length ? `\n\n${tableText(AGREEMENT_COLUMNS, rows)}` : "";
  return {
    subject: TEMPLATE_METADATA.emNotiAccionConveniosAVencer.subject,
    text: `${intro}${textTable}`,
    html: htmlLayout({ input, title: "Convenios por Vencer", paragraphs: [intro], table }),
  };
}

function documentBelongsTo(input) {
  const type = Number(value(input, "documentType", "tipoDcumento"));
  const owner = plain(value(input, "belongsTo", "PerteneceA"));
  return type === 1 ? ` a la sucursal ${owner}` : `al departamento ${owner}`;
}

function renderDocument(input, expired) {
  const document = plain(value(input, "documentName", "varDocumento"));
  const reference = plain(value(input, "documentReference", "documentoRef"));
  const contract = plain(value(input, "contractNumber", "Contrato"));
  const ending = expired ? "venció su vigencia." : "esta próximo a vencer.";
  const message = `Se notifica que el documento ${document} - ${reference} con el numero de contrato ${contract} que pertenece ${documentBelongsTo(input)} ${ending}`;
  const due = `Fecha vencimiento: ${formatTableDate(value(input, "dueDate", "FechaVencimiento"))}`;
  return {
    subject: TEMPLATE_METADATA[expired ? "emNotificacionLegalVencido" : "emNotificacionLegal"].subject,
    text: `${expired ? "Aviso Documento Vencido" : "Aviso Documento Próximo a Vencer"}\n\n${message}\n\n${due}`,
    html: htmlLayout({
      input,
      title: expired ? "Aviso Documento Vencido" : "Aviso Documento Próximo a Vencer",
      paragraphs: [message, due],
    }),
  };
}

function renderIncident(input) {
  const branch = plain(value(input, "branchName", "SucursalNam"));
  const action = plain(value(input, "action", "Accion"));
  const date = formatLegacyEmailDate(value(input, "startDate", "FechaInicio"));
  const message = `Se le notifica que la sucursal ${branch} reportó un Incidente Externo por visita (${action} ) con fecha ${date}`;
  const portal = "Puede consultar mas información en el modulo de Incidentes";
  return {
    subject: TEMPLATE_METADATA.emNotiincidente.subject,
    text: `${message}\n\n${portal}`,
    html: htmlLayout({ input, title: "Incidente externo", paragraphs: [message, portal] }),
  };
}

function renderHumanResources(input) {
  const assignee = plain(value(input, "assignedUser", "UsuarioAsignado"));
  const action = plain(value(input, "action", "Accion"));
  const date = formatLegacyEmailDate(value(input, "startDate", "FechaInicio"));
  const message = `Estimado(a) ${assignee}, se le notifica que se le ha asignado una acción dentro de un caso laboral (${action} ) con fecha ${date}`;
  const portal = "Puede consultar más información en el módulo de casos laborales del portal.";
  return {
    subject: TEMPLATE_METADATA.emNotificacionRRHH.subject,
    text: `${message}\n\n${portal}`,
    html: htmlLayout({ input, title: "Asignación de acción", paragraphs: [message, portal] }),
  };
}

function renderIncidentAction(input) {
  const message = actionAssignment(input);
  const portal = "Puede consultar mas información en el portal de Incidentes";
  return {
    subject: TEMPLATE_METADATA.emNotiAccion.subject,
    text: `${message}\n\n${portal}`,
    html: htmlLayout({ input, title: "Asignación de acción", paragraphs: [message, portal] }),
  };
}

const RENDERERS = Object.freeze({
  emNotiAccionLegal: (input) => renderActionTemplate("emNotiAccionLegal", input, { labor: false }),
  emNotiAccionCasosLaborales: (input) => renderActionTemplate("emNotiAccionCasosLaborales", input, { labor: true }),
  emNotiAccionComentario: renderUrgentComment,
  emNotificacionAreaLegal: renderLegalArea,
  emNotiAccionConveniosAVencer: renderAgreements,
  emNotificacionLegal: (input) => renderDocument(input, false),
  emNotiincidente: renderIncident,
  emNotificacionRRHH: renderHumanResources,
  emNotiAccion: renderIncidentAction,
  emNotificacionLegalVencido: (input) => renderDocument(input, true),
});

export function listLegacyEmailTemplates() {
  return LEGACY_EMAIL_TEMPLATE_NAMES.map((name) => ({ name, ...TEMPLATE_METADATA[name] }));
}

export function renderLegacyEmail(templateName, input = {}) {
  const renderer = RENDERERS[templateName];
  if (!renderer) {
    throw templateError("La plantilla de correo solicitada no existe.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw templateError("Los datos de la plantilla deben ser un objeto.", "data");
  }
  return { template: templateName, ...renderer(input) };
}
