# Mapa de réplica del portal

Inventario contrastado con el portal activo y el módulo OML de `DocumentacionLegal`.

**Presencia web: 37/37 rutas legacy identificadas.** Todas están declaradas en `web/src/routes/routePaths.js` y montadas en `web/src/routes/AppRoutes.jsx`. Esto acredita presencia, no paridad. Se conservaron nombres históricos, errores tipográficos y parámetros de URL porque forman parte de los enlaces del sistema origen.

El estado probatorio actual está en [`docs/DOCUMENTACIONLEGAL_PARITY_MATRIX.md`](docs/DOCUMENTACIONLEGAL_PARITY_MATRIX.md) y las diferencias verificadas en [`docs/DOCUMENTACIONLEGAL_GAPS.md`](docs/DOCUMENTACIONLEGAL_GAPS.md). Esos documentos prevalecen sobre las descripciones resumidas de este mapa.

| # | Área | Ruta legacy | Alcance local previsto/observado; pendiente de paridad salvo estado explícito en la matriz |
|---:|---|---|---|
| 1 | Acceso | `Login` | País, usuario, clave, recuperación de acceso y creación de sesión; conserva `Datos de ingreso no válidos`. `DoSSO` y `DoLoginSessionClosed` no se reaniman porque el OML los marca sin llamadas. |
| 2 | Acceso | `Mantenimiento` | Pantalla pública de mantenimiento legacy. |
| 3 | Acceso | `InvalidPermissions` | Mensaje de permisos insuficientes y retorno seguro. |
| 4 | Acceso | `scrResetarClave` | Cambio obligatorio de contraseña y cierre de la marca de restablecimiento. |
| 5 | Inicio | `scrPantallaPrincipal` | Ocho accesos: cuatro navegaciones y cuatro mensajes legacy `En desarrollo`; visibilidad condicionada por rol/puesto. |
| 6 | Dashboard | `scrDashboardMonitoreo` | Filtros de gerente/sucursal, tarjetas y porcentajes por sucursal. |
| 7 | Dashboard | `scrDshGlobal` | Métricas globales, siete subcategorías, filtros y exportación a Excel. |
| 8 | Documentación | `scrHistoricoDocumentos` | Histórico de sucursales con filtros, paginación, detalle, vista previa de archivo, exportación a Excel y nuevo registro. Fechas refresca pero no restringe tabla/XLS, igual que el aggregate legacy verificado. |
| 9 | Documentación | `scrRegistroDocumento` | Registro transaccional, validaciones legacy y carga del archivo a S3. |
| 10 | Documentación | `scrDetalleDocumento` | Consulta y vista previa del archivo, descarga, referencia 2, aprobación, rechazo y eliminación autorizada. |
| 11 | Documentación | `scrDetalleSucursalDocumentacion` | Resumen documental de sucursal, registro asociado y libros/evidencias. |
| 12 | Documentación | `scrHistoricoAdministrativoDoc` | Histórico administrativo con filtros, catálogos reales, acceso al detalle, vista previa de archivos y exportación a Excel. |
| 13 | Documentación | `scrProximosVencer` | Documentos próximos a vencer con estados, rangos, filtros legacy, vista previa, aviso por correo y exportación a Excel. |
| 14 | Convenios | `scrConvenios` | Listado, filtros, estado, cliente, exportación a Excel y navegación al detalle. |
| 15 | Convenios | `scrRegistrarConvenio` | Alta y edición, cliente, sucursales, vigencia, responsables y adjuntos; si existe pagaré se exige al menos un archivo y la persistencia es transaccional. |
| 16 | Convenios | `scrConvenioDetalle` | Detalle completo con ficha y contactos del cliente, sucursales que facturan, gestor, pagaré, trazabilidad y adjuntos con vista previa o descarga. |
| 17 | Configuración | `scrUsuariosPermisos` | Consulta de usuarios y actualización auditada de acceso. |
| 18 | Catálogos | `scrCatalogoProveedores` | Listado, alta, edición y expansión inline `Destinos` contra los catálogos MySQL aislados por país. |
| 19 | Catálogos | `scrCategoriasDocumentos` | Categorías/subcategorías y cambio auditado de disponibilidad. |
| 20 | Catálogos | `scrCatalogoEntes` | Listado, alta, edición y desactivación de entes gubernamentales. |
| 21 | Clientes | `scrClientesCorp` | Listado, filtros, edición y cambio de estado. |
| 22 | Clientes | `scrRegistroClientesCorp` | Alta y edición de cliente y contactos. |
| 23 | Clientes | `scrCargaMasivaClientesCorp` | Importación y validación masiva desde Excel. |
| 24 | Catálogos | `srcCatalagoAccionesLegal` | Listado, alta y edición de acciones legales, incluido su estado activo. |
| 25 | Incidentes internos | `srcIncidentesInternoVisita` | Histórico filtrable de incidentes internos y exportación a Excel. |
| 26 | Incidentes internos | `scrMisAccionesInternoVisita` | El runtime canónico falla la consulta: tabla vacía y feedback persistente `Error executing query.`; ese defecto visible se conserva y las operaciones quedan reconstruidas detrás del contrato. |
| 27 | Incidentes internos | `scrRegistroIncidentesInternos` | Registro validado con catálogos, responsables y evidencia. |
| 28 | Incidentes externos | `srcIncidentesExternos` | Histórico filtrable de incidentes externos y exportación a Excel. |
| 29 | Incidentes externos | `scrMisAccionesExternos` | Igual que la variante interna, conserva tabla vacía y `Error executing query.`; el OML adicional de detalle lateral externo permanece reconstruido para validación futura con filas. |
| 30 | Incidentes externos | `scrRegistroIncicentesExternos` | Registro validado con el nombre tipográfico conservado del origen. |
| 31 | Incidentes | `scrAccionesIncidentes` | Detalle, evidencia, comentarios, historial, acciones y cierre. |
| 32 | Casos laborales | `srcHistorialIncidentesInternoLegal` | Histórico, filtros, exportación a Excel y menú por caso para ver detalle, reasignar responsable o anular. |
| 33 | Casos laborales | `srcMisAccionesCasosLaborales` | Acciones propias con reglas por responsable/admin y estado, iniciar/cerrar/anular, reasignaciones conectadas pero ocultas por `Visible=False`, evidencia e histórico inline. |
| 34 | Casos laborales | `srcAccionesIncidentesLegal` | Detalle, permisos, prioridad, comentarios, acciones e historial. |
| 35 | Casos laborales | `srcAccionesIncidentesLegal_OLD` | Vista legacy diferenciada del caso laboral, con cabecera, campos y acciones propios; no es un alias del detalle vigente. |
| 36 | Riesgo | `scrHistoricoRiesgo` | Histórico, filtros, orden, paginación y exportación. |
| 37 | Riesgo | `scrDetalleRiesgo` | Detalle por `CodArchivo`, escala de riesgo, PDF y nueve cláusulas. |

## Vistas previas y exportaciones

- `scrHistoricoDocumentos`, `scrHistoricoAdministrativoDoc` y `scrProximosVencer` muestran la acción de vista previa cuando el registro tiene un archivo compatible. El visor se abre en un panel lateral y la descarga permanece disponible de forma independiente.
- `scrConvenioDetalle` usa el panel derecho `Visor de Archivos` para PDF, JPG, JPEG y PNG. La acción de descarga se conserva para todos los adjuntos y no se ofrece un visor para formatos que el origen no previsualiza.
- `scrDetalleDocumento`, `scrDetalleSucursalDocumentacion` y `scrDetalleRiesgo` mantienen el acceso al archivo asociado dentro de su flujo de detalle.
- Las 19 cargas nativas conservan sus contratos separados. Registro Documento valida al guardar PDF/JPG/JPEG/PNG/BMP; Convenios usa su lista de nueve extensiones y máximo de 500; Carga Masiva no restringe la selección por extensión porque el OML tampoco lo hace. Los límites producidos por componentes externos permanecen bloqueados cuando el texto/efecto no está en el módulo.
- Exportan a Excel `scrDshGlobal`, `scrHistoricoDocumentos`, `scrHistoricoAdministrativoDoc`, `scrProximosVencer`, `scrConvenios`, `srcIncidentesInternoVisita`, `srcIncidentesExternos`, `srcHistorialIncidentesInternoLegal` y `scrHistoricoRiesgo`. Los datos exportados se obtienen con los filtros activos de cada pantalla, salvo el rango de Fechas de `scrHistoricoDocumentos`, que el legacy refresca pero deja neutralizado por su condición `OR codigoSucursal <> NullIdentifier()`.
- Los Excel documentales conservan el orden exacto de once columnas de `RecordListToExcel1`. Administrativo deja vacíos estado, proveedor, nivel y usuario; Próximos a Vencer deja vacío proveedor. Son salidas legacy intencionales, no valores pendientes de completar.
- `srcAccionesIncidentesLegal` y `srcAccionesIncidentesLegal_OLD` cuentan como rutas independientes dentro de las 37: comparten el dominio del caso laboral, pero presentan variantes de pantalla diferentes.

## Módulos sin ruta de navegación

El OML también contiene diez pantallas de correo y los procesos de vencimiento de documentos y convenios. No se cuentan como rutas web porque se ejecutan desde servicios/acciones. La réplica conserva sus plantillas y reglas en el módulo de notificaciones del API; el envío se realiza mediante TD Mail y los procesos admiten `dry-run`.

## Reglas legacy preservadas

- El país proviene de la sesión firmada; Honduras usa el código `4` en los datos observados.
- Los usuarios activos se consultan en `tblPersonas` con las condiciones recuperadas del origen.
- Dashboard y monitoreo calculan sucursales elegibles × subcategorías obligatorias.
- Los estados documentales principales son `2` vigente, `4` por vencer y ausencia de ambos faltante.
- Para cada sucursal y subcategoría se conserva la selección del documento activo equivalente al aggregate de OutSystems.
- Los históricos documentales se restringen por país, estado activo y tipo de sucursal.
- La subcategoría se valida contra su categoría al registrar documentos.
- `referenciaDocumento` es una clasificación reutilizable, no un identificador único.
- Las cargas S3 reciben el archivo, pero la clave se genera en el API y no puede ser elegida por el cliente. Las URLs temporales y descargas exigen sesión y sólo aceptan claves vinculadas a registros visibles del país autenticado, incluidos los históricos expuestos por el legacy.
- Las escrituras de documentos, convenios, clientes, catálogos e incidentes usan validaciones de dominio y transacciones cuando intervienen varias tablas.
- Los cambios de permisos y categorías generan su bitácora correspondiente.
- Las acciones de incidentes y casos laborales solo aceptan las transiciones recuperadas del OML.
- El riesgo usa `codPlantilla_Doc` como `CodArchivo`, igual que el portal origen.

## Fuentes verificadas

- MySQL de personas/sucursales, documentación, proveedores, recursos humanos y riesgo, seleccionados mediante `DB_NAME`, `DOCUMENT_DB_NAME`, `PROVIDER_DB_NAME`, `HR_DB_NAME` y `RISK_DB_NAME`.
- TD S3 para carga, descarga y URL temporal de documentos, evidencias, adjuntos y PDF de riesgo.
- TD Mail para recuperación de acceso, plantillas transaccionales y avisos programados.
- Servicio HTTPS heredado de transformación de credenciales, invocado únicamente desde el API.

## Verificación automatizada

- `api`: pruebas de autenticación, sesión, consultas y escrituras documentales, S3, dashboard, catálogos, incidentes/casos laborales, riesgo y notificaciones.
- `web`: build de Vite sobre el inventario completo de rutas y sus imports.
- Las pruebas de integración contra MySQL real son optativas para evitar depender de una base remota durante cada ejecución local.

Comandos:

```powershell
cd api
npm.cmd test

cd ../web
npm.cmd run build
```
