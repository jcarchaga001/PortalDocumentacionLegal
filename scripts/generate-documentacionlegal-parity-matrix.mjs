import fs from "node:fs";
import path from "node:path";

const inventoryRoot = process.argv[2];
const outputPath = process.argv[3] ?? path.resolve("docs/DOCUMENTACIONLEGAL_PARITY_MATRIX.md");

if (!inventoryRoot) {
  throw new Error(
    "Uso: node scripts/generate-documentacionlegal-parity-matrix.mjs <directorio-inventories> [salida]",
  );
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((candidate) => candidate.some(Boolean));
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(inventoryRoot, name), "utf8"));
}

function md(value) {
  const text = value === undefined || value === null || value === "" ? "—" : String(value);
  return text.replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", "<br>");
}

const screenContracts = {
  Login: ["/Login", "web/src/pages/LoginPage.jsx", "PARCIAL"],
  Mantenimiento: ["/Mantenimiento", "web/src/pages/MaintenancePage.jsx", "VERIFICADO"],
  InvalidPermissions: ["/InvalidPermissions", "web/src/pages/InvalidPermissionsPage.jsx", "PARCIAL"],
  scrResetarClave: ["/scrResetarClave", "web/src/pages/PasswordResetPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrPantallaPrincipal: ["/scrPantallaPrincipal", "web/src/pages/PortalLandingPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrDashboardMonitoreo: ["/scrDashboardMonitoreo", "web/src/pages/BranchMonitoringPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrDshGlobal: ["/scrDshGlobal", "web/src/pages/DashboardPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrHistoricoDocumentos: ["/scrHistoricoDocumentos", "web/src/pages/DocumentHistoryPage.jsx", "PARCIAL"],
  scrRegistroDocumento: ["/scrRegistroDocumento", "web/src/pages/DocumentCreatePage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrDetalleDocumento: ["/scrDetalleDocumento", "web/src/pages/DocumentDetailPage.jsx", "PARCIAL"],
  scrDetalleSucursalDocumentacion: ["/scrDetalleSucursalDocumentacion", "web/src/pages/BranchDocumentDetailPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrHistoricoAdministrativoDoc: ["/scrHistoricoAdministrativoDoc", "web/src/pages/AdministrativeDocumentHistoryPage.jsx", "PARCIAL"],
  scrProximosVencer: ["/scrProximosVencer", "web/src/pages/ExpiringDocumentsPage.jsx", "PARCIAL"],
  scrConvenios: ["/scrConvenios", "web/src/pages/AgreementsPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrRegistrarConvenio: ["/scrRegistrarConvenio", "web/src/pages/AgreementFormPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrConvenioDetalle: ["/scrConvenioDetalle", "web/src/pages/AgreementDetailPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrUsuariosPermisos: ["/scrUsuariosPermisos", "web/src/pages/UserPermissionsPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrCatalogoProveedores: ["/scrCatalogoProveedores", "web/src/pages/ProviderCatalogPage.jsx", "PARCIAL"],
  scrCategoriasDocumentos: ["/scrCategoriasDocumentos", "web/src/pages/DocumentCategoriesPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrCatalogoEntes: ["/scrCatalogoEntes", "web/src/pages/GovernmentEntitiesPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrClientesCorp: ["/scrClientesCorp", "web/src/pages/CorporateClientsPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrRegistroClientesCorp: ["/scrRegistroClientesCorp", "web/src/pages/CorporateClientFormPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrCargaMasivaClientesCorp: ["/scrCargaMasivaClientesCorp", "web/src/pages/CorporateClientBulkPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  srcCatalagoAccionesLegal: ["/srcCatalagoAccionesLegal", "web/src/pages/LegalActionsCatalogPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  srcIncidentesInternoVisita: ["/srcIncidentesInternoVisita", "web/src/pages/IncidentListPage.jsx (internal)", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrMisAccionesInternoVisita: ["/scrMisAccionesInternoVisita", "web/src/pages/IncidentActionsPage.jsx (internal)", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrRegistroIncidentesInternos: ["/scrRegistroIncidentesInternos", "web/src/pages/IncidentRegistrationPage.jsx (internal)", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  srcIncidentesExternos: ["/srcIncidentesExternos", "web/src/pages/IncidentListPage.jsx (external)", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrMisAccionesExternos: ["/scrMisAccionesExternos", "web/src/pages/IncidentActionsPage.jsx (external)", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrRegistroIncicentesExternos: ["/scrRegistroIncicentesExternos", "web/src/pages/IncidentRegistrationPage.jsx (external)", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrAccionesIncidentes: ["/scrAccionesIncidentes", "web/src/pages/IncidentDetailPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  srcHistorialIncidentesInternoLegal: ["/srcHistorialIncidentesInternoLegal", "web/src/pages/LaborCasesPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  srcMisAccionesCasosLaborales: ["/srcMisAccionesCasosLaborales", "web/src/pages/LaborActionsPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  srcAccionesIncidentesLegal: ["/srcAccionesIncidentesLegal", "web/src/pages/LaborCaseDetailPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  srcAccionesIncidentesLegal_OLD: ["/srcAccionesIncidentesLegal_OLD", "web/src/pages/LaborCaseDetailPage.jsx (legacy)", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrHistoricoRiesgo: ["/scrHistoricoRiesgo", "web/src/pages/RiskHistoryPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
  scrDetalleRiesgo: ["/scrDetalleRiesgo", "web/src/pages/RiskDetailPage.jsx", "IMPLEMENTADO_PENDIENTE_RUNTIME"],
};

const blockAnalogs = new Set([
  "ApplicationTitle",
  "UserInfo",
  "blkContactosClienteCorp",
  "blkEncabezadoDetalleSucursal",
  "BlkEstadosDoc",
  "BlkEstadosIncidentes",
  "blkGrafico",
  "blkGraficoSubcategorias",
  "BlkNivelesSeguridad",
  "NombreSucursal",
  "blkAreaGestor",
  "blkChekCentralizado",
  "blkComentariosIncidente",
  "blkComentariosIncidenteLegal",
  "BlkDetalleEvidenciasLegal",
  "blkEstados",
  "blkEstadosAccionesLegal",
  "blkEstadosIncideLegal",
  "blkEvidenciasLegal",
  "blkHiloIncidentes",
  "BlkHistoricoEstadosAccionesLegal",
  "BlkNivelesPrioridad",
  "BlRegistradoDpc",
  "BlRegistradoLibro",
  "ViewPDF",
  "blkDestinos",
]);

const absentBlocks = new Set();

const blockFiles = {
  Menu: "web/src/layouts/PortalLayout.jsx",
  UserInfo: "web/src/layouts/PortalLayout.jsx",
  UserInfoIA: "web/src/layouts/PortalLayout.jsx",
  LayoutSideMenu: "web/src/layouts/PortalLayout.jsx",
  LayoutTopMenu: "web/src/layouts/PortalLayout.jsx",
  LayoutTopMenuTable: "web/src/layouts/PortalLayout.jsx",
  blkComentariosIncidente: "web/src/pages/IncidentDetailPage.jsx",
  blkComentariosIncidenteLegal: "web/src/pages/LaborCaseDetailPage.jsx",
  BlkDetalleEvidenciasLegal: "web/src/pages/LaborCaseDetailPage.jsx",
  blkEvidenciasLegal: "web/src/pages/LaborCaseDetailPage.jsx",
  blkHiloIncidentes: "web/src/pages/IncidentDetailPage.jsx",
  BlkHistoricoEstadosAccionesLegal: "web/src/pages/LaborCaseDetailPage.jsx",
  blkDestinos: "web/src/pages/ProviderCatalogPage.jsx",
};

const landingControls = [
  {
    label: "Documentación Sucursales",
    condition: "Oculto solo si CodigoRol=1 y CodigoPuesto=2",
    client: "IrDocumentacion(tipoDocumento=1)",
    effect: "Navega a /scrHistoricoDocumentos; Client.tipoDocumento=1",
    feedback: "/scrHistoricoDocumentos",
  },
  {
    label: "Dashboard Global",
    condition: "Oculto solo si CodigoRol=1 y CodigoPuesto=2",
    client: "Navegación declarativa",
    effect: "Navega a /scrDshGlobal",
    feedback: "/scrDshGlobal",
  },
  {
    label: "Proveedores",
    condition: "Oculto solo si CodigoRol=1 y CodigoPuesto=2",
    client: "NotImplemented",
    effect: "Permanece en la pantalla",
    feedback: "Mensaje: En desarrollo",
  },
  {
    label: "Documentación Administrativa",
    condition: "Oculto solo si CodigoRol=1 y CodigoPuesto=2",
    client: "IrDocumentacion(tipoDocumento=2)",
    effect: "Navega a /scrHistoricoDocumentos; Client.tipoDocumento=2",
    feedback: "/scrHistoricoDocumentos",
  },
  {
    label: "Dashboard Sucursales",
    condition: "Oculto solo si CodigoRol=1 y CodigoPuesto=2",
    client: "Navegación declarativa",
    effect: "Navega a /scrCatalogoEntes",
    feedback: "/scrCatalogoEntes",
  },
  {
    label: "Configuración",
    condition: "Oculto solo si CodigoRol=1 y CodigoPuesto=2",
    client: "NotImplemented",
    effect: "Permanece en la pantalla",
    feedback: "Mensaje: En desarrollo",
  },
  {
    label: "Próximos a Vencer",
    condition: "Visible si CodigoRol!=1 o CodigoPuesto=2/7",
    client: "NotImplemented",
    effect: "Permanece en la pantalla",
    feedback: "Mensaje: En desarrollo",
  },
  {
    label: "Incidentes",
    condition: "Visible si CodigoRol!=1 o CodigoPuesto=2/7",
    client: "NotImplemented",
    effect: "Permanece en la pantalla",
    feedback: "Mensaje: En desarrollo",
  },
];

const observableFailureRows = [
  [
    "/scrMisAccionesInternoVisita",
    "Al cargar o refrescar la consulta",
    "Tabla vacía (0 filas)",
    "Error executing query.",
    "Error persistente; feedback-message-error",
    "Runtime autenticado 2026-08-28 + captura del usuario",
    "IMPLEMENTADO_PENDIENTE_RUNTIME",
  ],
  [
    "/scrMisAccionesExternos",
    "Al cargar o refrescar la consulta",
    "Tabla vacía (0 filas)",
    "Error executing query.",
    "Error persistente; feedback-message-error",
    "Runtime autenticado 2026-08-28",
    "IMPLEMENTADO_PENDIENTE_RUNTIME",
  ],
];

function surfaceState(surface) {
  if (surface.Kind === "Screen") {
    return screenContracts[surface.Name]?.[2] ?? "BLOQUEADO";
  }
  if (surface.Kind === "Email") {
    return "SIMULADO";
  }
  if (absentBlocks.has(surface.Name)) {
    return "AUSENTE";
  }
  return blockAnalogs.has(surface.Name) ? "IMPLEMENTADO_PENDIENTE_RUNTIME" : "PARCIAL";
}

function surfaceLocal(surface) {
  if (surface.Kind === "Screen") {
    return screenContracts[surface.Name]?.[1] ?? "sin mapeo";
  }
  if (surface.Kind === "Email") {
    return "api/src/services/legacyEmailTemplates.js";
  }
  return blockFiles[surface.Name] ?? "integrado sin componente 1:1";
}

function routeFor(owner) {
  return screenContracts[owner]?.[0] ?? "contexto de bloque / sin ruta propia";
}

const controls = readCsv("controls.csv");
const surfaces = readCsv("surface-actions.csv");

if (controls.length !== 340) {
  throw new Error(`Se esperaban 340 controles y se obtuvieron ${controls.length}.`);
}
if (surfaces.length !== 90) {
  throw new Error(`Se esperaban 90 superficies y se obtuvieron ${surfaces.length}.`);
}

const eventControlCount = controls.filter((control) => Boolean(control.Events)).length;
if (eventControlCount !== 324) {
  throw new Error(`Se esperaban 324 controles con evento y se obtuvieron ${eventControlCount}.`);
}

const controlsByOwner = new Map();
for (const control of controls) {
  const owner = control.Owner || "SIN_OWNER";
  controlsByOwner.set(owner, [...(controlsByOwner.get(owner) ?? []), control]);
}

const surfaceRows = surfaces.map((surface, index) => {
  const contract = screenContracts[surface.Name];
  const route = surface.Kind === "Screen" ? contract?.[0] ?? "sin mapeo" : "sin ruta propia";
  const controlCount = controlsByOwner.get(surface.Name)?.length ?? 0;
  return `| ${index + 1} | ${md(surface.Kind)} | ${md(surface.Flow)} | ${md(surface.Name)} | ${md(route)} | ${controlCount} | ${md(surface.ClientActions)} | ${md(surface.DataSets)} | ${md(surface.DataActions)} | ${md(surfaceLocal(surface))} | ${surfaceState(surface)} |`;
});

const ownerIndexes = new Map();
const controlRows = controls.map((control, index) => {
  const owner = control.Owner || "SIN_OWNER";
  const ownerIndex = (ownerIndexes.get(owner) ?? 0) + 1;
  ownerIndexes.set(owner, ownerIndex);

  const screenContract = screenContracts[owner];
  const blockStatus = absentBlocks.has(owner)
    ? "AUSENTE"
    : blockAnalogs.has(owner)
      ? "IMPLEMENTADO_PENDIENTE_RUNTIME"
      : "PARCIAL";
  let status = !control.OwnerKind
    ? "BLOQUEADO"
    : control.OwnerKind === "NRNodes.WebScreen"
      ? screenContract?.[2] ?? "BLOQUEADO"
      : blockStatus;

  const name = control.Name || `${control.DisplayName || control.ControlType.split(".").at(-1)} #${ownerIndex}`;
  let label = control.DisplayName || control.Name || "no expuesto";
  let condition = "POR_VALIDAR: expresión de Visible/Enabled no está enlazada por controls.csv";
  let visible = "POR_VALIDAR en runtime y por rol/estado";
  let client = control.Events
    ? "TRAZA_NO_EXPUESTA: falta unión control→ClientAction"
    : "Sin evento declarado";
  let server = "TRAZA_PENDIENTE: depende de resolver la ClientAction";
  let query = "TRAZA_PENDIENTE: no inferir por proximidad";
  let entity = "TRAZA_PENDIENTE: productor/entidad no atribuible al control";
  let effect = "RUNTIME_PENDIENTE";
  let feedback = "RUNTIME_PENDIENTE";
  let legacyEvidence = "Inspección control-a-control pendiente";

  if (owner === "scrPantallaPrincipal") {
    const legacy = landingControls[ownerIndex - 1];
    label = legacy.label;
    condition = legacy.condition;
    visible = "Regla OML recuperada; contraste multirrol pendiente";
    client = legacy.client;
    server = "No aplica";
    query = "No aplica";
    entity = "Client.tipoDocumento solo para accesos documentales";
    effect = legacy.effect;
    feedback = legacy.feedback;
    legacyEvidence = "Runtime autenticado 2026-08-28 + OML scrPantallaPrincipal";
  }

  if (!control.OwnerKind) {
    condition = "BLOQUEADO: el inventario no conserva owner";
    visible = "BLOQUEADO";
    client = "BLOQUEADO: ReferenceButton/ReferenceLink sin owner ni evento";
    server = "BLOQUEADO";
    query = "BLOQUEADO";
    entity = "BLOQUEADO";
    effect = "BLOQUEADO";
    feedback = "BLOQUEADO";
    legacyEvidence = "Requiere OutDoc/Service Studio o runtime que identifique el referer";
    status = "BLOQUEADO";
  }

  const localFile = screenContract?.[1] ?? blockFiles[owner] ?? "sin trazabilidad local 1:1";
  const omlEvidence = `inventories/controls.csv Key=${control.Key}; ${control.HandlerTargetStatus || "sin handler"}`;
  const test = status === "AUSENTE" ? "sin prueba" : "sin prueba control-a-control";

  return `| ${index + 1} | ${md(routeFor(owner))} | ${md(owner)} | ${md(condition)} | ${md(name)} | ${md(label)} | ${md(visible)} | ${md(control.Events || "sin evento")} | ${md(client)} | ${md(server)} | ${md(query)} | ${md(entity)} | ${md(effect)} | ${md(feedback)} | ${md(legacyEvidence)} | ${md(omlEvidence)} | ${md(localFile)} | ${md(test)} | ${status} |`;
});

const screenStates = Object.values(screenContracts).map((contract) => contract[2]);
const summary = new Map();
for (const state of screenStates) {
  summary.set(state, (summary.get(state) ?? 0) + 1);
}

const markdown = `# Matriz de paridad — DocumentacionLegal

Fecha de corte: 2026-08-28. Repositorio canónico: \`PortalDocumentacionLegal\`.

Esta matriz separa **presencia** de **paridad**. Las 37 rutas existen y están montadas, pero eso no acredita equivalencia visual, funcional, de permisos, datos o integraciones. Solo \`Mantenimiento\`, que es pública y no tiene acciones, se declara \`VERIFICADO\` después de comparar ambos estados del parámetro, assets y geometría en el mismo viewport. Las demás pantallas requieren runtime autenticado por rol y resultado observable.

## Estados permitidos

| Estado | Significado |
|---|---|
| \`VERIFICADO\` | Cadena completa contrastada contra legacy en runtime y con resultado equivalente. |
| \`IMPLEMENTADO_PENDIENTE_RUNTIME\` | Existe implementación local razonable, pero falta contraste autenticado o UAT. |
| \`PARCIAL\` | Existe una parte de la cadena, con brechas concretas. |
| \`SIMULADO\` | La integración o efecto está deliberadamente neutralizado en el ambiente seguro. |
| \`AUSENTE\` | No existe implementación local identificable. |
| \`BLOQUEADO\` | La evidencia disponible no permite reconstruir la cadena sin inventar. |

## Corte cuantitativo

- 37 pantallas web: ${summary.get("VERIFICADO") ?? 0} \`VERIFICADO\`, ${summary.get("IMPLEMENTADO_PENDIENTE_RUNTIME") ?? 0} \`IMPLEMENTADO_PENDIENTE_RUNTIME\` y ${summary.get("PARCIAL") ?? 0} \`PARCIAL\`.
- 43 bloques web y 10 correos: inventariados abajo, aunque muchos están integrados dentro de páginas y no conservan trazabilidad 1:1.
- 340 controles accionables: 273 de pantalla, 51 de bloque y 16 referencias sin owner.
- 324 controles declaran evento. \`controls.csv\` no enlaza el control con su ClientAction; esa unión queda explícitamente bloqueada en vez de inferirse por proximidad.
- 205 entidades externas y 31 productores: requieren DDL/OML productor, configuración, datos autorizados y UAT antes de cerrar sus contratos.

## Contratos de fallos observables

Un error visible del legacy no se corrige silenciosamente: tabla vacía, texto, severidad, posición, duración y momento del feedback forman parte del contrato hasta que una nueva evidencia canónica demuestre otro comportamiento.

| Ruta | Disparador | Resultado | Texto exacto | Feedback | Evidencia | Estado local |
|---|---|---|---|---|---|---|
${observableFailureRows.map((row) => `| ${row.map(md).join(" | ")} |`).join("\n")}

## Inventario de 90 superficies

Las listas de acciones/consultas son inventario de la superficie, no una atribución automática a cada control.

| # | Tipo | Flow | Superficie | Ruta | Controles | ClientActions | DataSets | DataActions | Implementación local | Estado |
|---:|---|---|---|---|---:|---|---|---|---|---|
${surfaceRows.join("\n")}

## Matriz de 340 controles e interacciones

\`TRAZA_NO_EXPUESTA\` significa que el extractor confirmó el evento, pero no expuso una relación probatoria control→ClientAction. \`TRAZA_PENDIENTE\` indica que API, consulta y entidad dependen de resolver primero esa relación. No se atribuyen handlers, SQL ni productores por cercanía en el XML.

| # | Ruta/contexto | Pantalla/bloque | Rol/condición | Control | Texto/tooltip | Visible/habilitado | Evento | Acción cliente | Acción servidor/API | Consulta/SQL | Entidad/integración | Resultado | Feedback/navegación | Evidencia legacy | Evidencia OML/OutDoc | Archivo local | Prueba | Estado |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${controlRows.join("\n")}

## Criterio de cierre

Una fila solo puede pasar a \`VERIFICADO\` cuando exista evidencia de: visibilidad por rol/estado, evento exacto, payload, autorización servidor, consulta/entidad o integración, mutación/resultado, feedback y navegación, además de comparación visual en el mismo viewport. Los defectos observables —incluidos mensajes de error y toasts— se comparan con el mismo rigor. Build y pruebas unitarias por sí solos no cumplen ese criterio.

Generado con \`scripts/generate-documentacionlegal-parity-matrix.mjs\` desde \`inventories/controls.csv\` y \`inventories/surface-actions.csv\` del análisis OML con hash \`DB173D39834F0571E454A8BA772958E100A057A94D1533543641B83D15A84C76\`.
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, markdown, "utf8");
console.log(`Matriz generada: ${outputPath}`);
console.log(`Superficies: ${surfaces.length}; controles: ${controls.length}; con evento: ${eventControlCount}`);
