const COMMON_RUNTIME = Object.freeze({
  viewport: Object.freeze({ width: 1280, height: 720 }),
  backText: "Regresar pantalla anterior...",
  branchLabel: "Sucursal",
  branchPlaceholder: "Seleccione Sucursal",
  visitLabel: "Fecha Visita:",
  agencyPlaceholder: "Seleccione Ente",
  visitorLabel: "Usuario",
  visitorPlaceholder: "Seleccione Usuario",
  commentLabel: "Comentario del Gerente:",
  evidenceLabel: "Evidencia:",
  evidencePrompt: "Adjunte Archivo",
  emptyPreview: "Archivo no cargado...",
  saveText: "Guardar",
  incompleteFeedback: "Completar todos los campos",
  destination: "/srcIncidentesExternos",
  form: Object.freeze({
    left: 40,
    top: 248.675,
    width: 584.4,
    height: 739.3,
    padding: 24,
    border: "#dee2e6",
    radius: 4,
  }),
});

const INTERNAL = Object.freeze({
  sourceName: "scrRegistroIncidentesInternos",
  scope: "internal",
  omlKey: "xJXLnmYee0+6VzT7Xl+OBw",
  role: "Registered",
  title: "Registro Incidente Interno",
  agencyLabel: "Area",
  controls: Object.freeze([
    Object.freeze({ key: "1kRVfah4r0m1YiGamxP5dg", type: "Link", event: "OnClick" }),
    Object.freeze({ key: "bv8dsLiRWkq_ksmaf2OaUA", type: "Button", event: "OnClick" }),
  ]),
  clientActions: Object.freeze([
    "PersonasChanged", "GuardarOnClick", "SucursalOnChanged", "EnteOnChanged", "Upload1OnChange",
  ]),
  dataSources: Object.freeze([
    "GetTipo", "GetSucursales", "GetEnte", "GetPersonas", "GetEnteSeleccionado",
  ]),
  agencyFilter: "not tblEntesGubernamentales.IsExterno",
  createMapping: Object.freeze({
    fechaVisita: "FechaRegistro",
    fechaApertura: "fechaHora",
    isExterno: "GetEnteSeleccionado.List.Current.tblEntesGubernamentales.IsExterno",
  }),
  ...COMMON_RUNTIME,
});

const EXTERNAL = Object.freeze({
  sourceName: "scrRegistroIncicentesExternos",
  scope: "external",
  omlKey: "pR6y33_z40Wdg9I6bIFTMg",
  role: "Registered",
  title: "Registro Incidente Externo",
  agencyLabel: "Ente Gubernamental",
  controls: Object.freeze([
    Object.freeze({ key: "DPs+fScsC0KjXiYeyYTnCQ", type: "Link", event: "OnClick" }),
    Object.freeze({ key: "xG5rF+Z+jU2292larJM_UQ", type: "Button", event: "OnClick" }),
  ]),
  clientActions: Object.freeze([
    "Upload1OnChange", "PersonasChanged", "SucursalOnChanged", "GuardarOnClick", "EnteOnChanged",
  ]),
  dataSources: Object.freeze([
    "GetPersonas", "GetEnte", "GetTipo", "GetEnteSeleccionado", "GetSucursales",
  ]),
  agencyFilter: null,
  createMapping: Object.freeze({
    fechaVisita: null,
    fechaApertura: "FechaRegistro",
    isExterno: "DDL/default del productor; no visible en el OML consumidor",
  }),
  ...COMMON_RUNTIME,
});

export const INCIDENT_REGISTRATION_SURFACES = Object.freeze({
  internal: INTERNAL,
  external: EXTERNAL,
});

export const INCIDENT_REGISTRATION_QUERY_CONTRACT = Object.freeze({
  GetSucursales: Object.freeze([
    "tblSucursales.Codigo_Pais = Client.CodigoPais",
    "tblSucursales.isActivo",
    "tblSucursales.isAdministrativa = False",
    "ORDER BY tblSucursales.OrdenSucursal",
  ]),
  GetPersonas: Object.freeze([
    "tblPersonas.Codigo_Sucursal = IdSucursal",
    "tblPersonas.CodigoPais = Client.CodigoPais",
    "MaxRecords=50",
  ]),
  GetTipo: Object.freeze(["tblTiposIncidentes", "MaxRecords=50"]),
  GetEnte: Object.freeze(["tblEntesGubernamentales", "MaxRecords=50"]),
  GetEnteSeleccionado: Object.freeze([
    "tblEntesGubernamentales.codigoResponsable = tblPersonas.Codigo_Personas",
    "IdentifierToInteger(tblEntesGubernamentales.codigoEnte) = IdEnte",
    "MaxRecords=50",
  ]),
});
