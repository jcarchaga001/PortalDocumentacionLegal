# Brechas verificadas — DocumentacionLegal

Fecha de corte: 2026-08-28.

Este documento registra únicamente diferencias demostrables entre el módulo OML/OutDoc, el runtime legacy autenticado y el repositorio canónico `PortalDocumentacionLegal`. Una ruta montada, un build correcto o un botón visible no equivalen a paridad.

## Baseline reproducible

- Repo/checkout: `main` en `7c8880cd71ea7c7b7bb8b07701b5ec7bf0fb15a6` antes de esta ronda; working tree limpio al iniciar.
- Runtime local confirmado desde el repo canónico: web en `localhost:3002`; API en `localhost:3003`; health `200` en `/DocumentacionLegal/api/health`.
- Web: build Vite correcto; 4/4 pruebas existentes correctas; warning no bloqueante de chunks mayores de 500 kB.
- API: 138 pruebas; 136 correctas, 0 fallidas y 2 omitidas por requerir MySQL/riesgo real.
- Inventario canónico: 37 pantallas, 43 bloques, 10 correos, 540 flujos de acciones, 221 consultas, 340 controles accionables y 324 controles con evento.
- Fuentes: OML SHA-256 `DB173D39834F0571E454A8BA772958E100A057A94D1533543641B83D15A84C76`; OutDoc SHA-256 `977D014B8982ED13238ABC763F27C7CCA205F4DF57F0467076ACEBCD5057E217`.

La matriz control-a-control está en [DOCUMENTACIONLEGAL_PARITY_MATRIX.md](./DOCUMENTACIONLEGAL_PARITY_MATRIX.md).

## Validación de esta ronda

- API: 168 pruebas, 166 correctas, 0 fallidas y 2 omitidas por requerir MySQL/UAT real.
- Web: 33/33 pruebas correctas ejecutadas con `node --test` (el paquete web no define script `npm test`).
- Build Vite de producción correcto; persiste únicamente el warning previo por chunks mayores de 500 kB.
- `git diff --check` correcto.
- Runtime local: health `200`; `/auth/countries` devuelve solo Honduras desde `tblPaises`.
- Runtime público: `Mantenimiento` comparado nuevamente contra legacy, con el mismo parámetro y viewport; composición, texto y assets equivalentes.
- Runtime autenticado local: las dos listas de acciones de incidentes conservaron título, seis filtros, columnas, cero filas y el feedback persistente `Error executing query.`; no se ejercitaron operaciones de fila porque el legacy tampoco produjo filas.
- `scrDashboardMonitoreo`, viewport `1289×912`: 113 tarjetas legacy y 113 locales; comparación 113/113 con `text diff=0`, `rect diff=0` y resultado de grid `9517`. Filtros, navegación y permiso `Anonymous`/`Registered` continúan pendientes por rol/UAT.
- `scrDetalleSucursalDocumentacion`, mismo viewport: documentos 27/27 y libros 4/4 con `text diff=0` y `rect diff=0`; `FA63` resuelve `branchId=226`, el contexto seleccionado sobrevive refresh y el query string ya no es autoridad. La selección inicial reproduce `subCategoria=1` y el resumen usa las métricas independientes de `blkGrafico`.
- Visores cerrados en runtime: `docId=913`, extensión vacía y sin S3 usa Google Viewer `763.921875×600` sin mensaje; documentos S3 tras click usan iframe `763.921875×1500`; libros muestran enlace, ids `137/2` y embed PDF `763.921875×800`. El transporte local es same-origin y responde PDF como `application/pdf`.
- Excepción de seguridad: con `Client.CODS3` vacío el legacy firma la raíz del bucket y expone XML/listado; local conserva un frame vacío de 1500px y deliberadamente no reproduce esa exposición.
- No se ejecutaron correos, S3, CLI `--commit`, mutaciones de proceso ni pruebas funcionales contra producción.

## Correcciones a supuestos anteriores

| Supuesto | Evidencia actual | Decisión de paridad |
|---|---|---|
| Seis de ocho accesos del landing estaban sin implementar. | Runtime autenticado, clic a clic: cuatro muestran `En desarrollo`; Dashboard Global y Dashboard Sucursales sí navegan. | Conectar solo esos dos destinos y conservar cuatro `NotImplemented`. |
| Login debía mostrar todos los países activos. | `GetPaises` filtra `isActivo=True` **y** `Codigo_Pais=4`; el runtime muestra solo Honduras. | Consultar la tabla, pero conservar alcance canónico código 4. No ampliar países. |
| `isMantenimiento`/`MantenimientoText` Site Properties controlaban la pantalla. | El modelo marca ambas Site Properties sin uso. La pantalla recibe `MantenimientoText` como parámetro de entrada. | Mantener el parámetro; mostrar heading fijo y texto opcional por separado. |
| Las rutas current/OLD de caso laboral podían compartir una vista equivalente. | Son pantallas distintas: current agrega chat, dos DataActions y cuatro ClientActions; OLD usa datasets propios. | Mantener dos rutas y auditar cada composición de forma independiente. |
| El filtro Fechas del histórico de sucursales debía restringir la tabla. | El aggregate usa `(rango de fecha) OR codigoSucursal <> NullIdentifier()`. En runtime, seleccionar solo 2026-08-28 mantuvo `1 to 50 of 1541 items` y filas fuera del rango. | Conservar el selector y su refresh, pero omitir `startDate/endDate` de tabla y Excel en esa superficie. |
| Un fallo del legacy podía corregirse silenciosamente en la réplica. | `scrMisAccionesInternoVisita` y `scrMisAccionesExternos` terminan la carga con tabla vacía y el feedback persistente exacto `Error executing query.` en el runtime canónico del 2026-08-28. | El fallo observable también es contrato: conservar estado vacío, texto, severidad, posición y momento del feedback hasta que una nueva evidencia legacy demuestre otro comportamiento. |

## Brechas 1–5

### 1. Landing y contrato `tipoDocumento`

**Estado:** `IMPLEMENTADO_PENDIENTE_RUNTIME` tras conectar los destinos verificados.

Contrato legacy confirmado:

- Documentación Sucursales → `scrHistoricoDocumentos`, asignando `Client.tipoDocumento=1`.
- Dashboard Global → `scrDshGlobal`.
- Proveedores → permanece y muestra `En desarrollo`.
- Documentación Administrativa → `scrHistoricoDocumentos`, asignando `Client.tipoDocumento=2`.
- Dashboard Sucursales → `scrCatalogoEntes`.
- Configuración, Próximos a Vencer e Incidentes → permanecen y muestran `En desarrollo`.
- Primeros seis accesos: ocultos únicamente para `CodigoRol=1 && CodigoPuesto=2`.
- Últimos dos: visibles si `CodigoRol!=1` o puesto `2/7`.

**Implementado:** la réplica conserva un equivalente session-scoped de `Client.tipoDocumento` al entrar por landing o menú y lo reutiliza al abrir `scrRegistroDocumento`. No se añadió un query param inerte. El histórico no filtra por este valor porque el OML solo lo consume en notificación y registro, no en el aggregate del histórico. El contexto se limpia tanto al completar un nuevo login como al cerrar sesión, evitando que otro usuario de la misma pestaña herede el tipo anterior.

**Evidencia requerida para cerrar:** comparar ambas entradas documentales con el mismo usuario y capturar filtros, columnas, consulta y resultados; prueba de navegación/visibilidad con al menos los perfiles que cubran puesto 2, 7 y otro puesto bajo rol 1; validar que “Nuevo Documento” precarga tipo 1/2 después de cada entrada y tras recarga de la pestaña.

### 2. `GetPaises`, `ConfiguracionPaises` y logos

**Estado:** `IMPLEMENTADO_PENDIENTE_RUNTIME` tras sustituir los literales por el catálogo data-driven; Login completo continúa `PARCIAL` por sus demás flujos.

Contrato legacy confirmado:

```sql
SELECT Codigo_Pais, Nombre_Pais
FROM tblPaises
WHERE isActivo = 1
  AND Codigo_Pais = 4
ORDER BY Nombre_Pais
LIMIT 50;
```

- `Bandera` está en la proyección OML, pero el dropdown no la consume.
- `ConfiguracionPaises` es una entidad estática distinta; para código 4 define Honduras, empresa `Farmacias del Ahorro` y terminal 8.
- Los bloques de logo eligen un asset por `empresa`; las banderas de cabecera provienen de assets estáticos por código.
- La tabla física contiene otros códigos activos. Exponerlos sería ampliar el comportamiento sin respaldo del OML.

**Implementado y probado localmente:** repositorio y endpoint con activo+código 4+orden+limit; rechazo antes del hash/persona para país no autorizado o inactivo; loading/error del Login; sesión/layout sin bandera falsa para código desconocido. El endpoint local devolvió únicamente `{ countryCode: 4, name: "Honduras" }`. La validación visible usa los textos legacy `Debe Seleccionar País` y `Campo Obligatorio`.

La autenticación activa también conserva el error exacto `Datos de ingreso no válidos`. `DoSSO` y `DoLoginSessionClosed` no forman parte de esa cadena: el OML marca ambas User Actions como `Unused`, no tienen referers, trigger, toast, redirect ni efecto observable; `TokenSession` también está sin uso. No se crearon endpoints ni persistencia para reanimar código muerto y no se copiaron las cuentas técnicas heredadas embebidas en `DoLoginSessionClosed`.

**Evidencia requerida para cerrar:** contraste autenticado del login y sesión resultante, estados loading/error en navegador, y comparación visual del asset/logo para código 4.

### 3. Autorización funcional

**Estado:** `PARCIAL` y de alto riesgo.

La sesión solo acredita autenticación. La autorización legacy depende de puesto, usuario, responsable, país, propietario y estado del objeto. Reglas recuperadas, todavía no exhaustivas:

- Configuración: puesto 7 o 15.
- Controles privilegiados documentales: puesto 32 o 7.
- Cierre de incidente: puesto 32/7 o usuario 1578.
- Casos laborales: inicio según estado/responsable o usuario 1; cierre/anulación según responsable o usuario 1; reasignaciones excluyen estados 5/3.
- Mis acciones laborales: usuario 1 ve activas; otros solo las asignadas como responsable actual.

**Implementado/auditado en esta ronda:** Configuración de usuarios ya exige puestos 7/15; cierre de incidentes ya exige puesto 7/32 o usuario 1578; acciones laborales ya validan owner/usuario 1/estado después de bloquear y leer el objeto; “Mis acciones” ya filtra por usuario; las eliminaciones de documento y evidencia ahora agregan guard explícito de puesto 7/32 antes del servicio, además del aislamiento por país/objeto.

Los catálogos Proveedores, Categorías, Entes y Acciones Legal no heredan el guard 7/15: sus enlaces están `Visible=True`/`Enabled=True`, los flujos mutantes no contienen una condición de puesto/rol/usuario y el runtime los mostró habilitados para Administrador Regional. La réplica conserva autenticación global incluso en Categorías, cuya pantalla OML también declara `Anonymous`; no se relajó esa frontera sin UAT.

Convenios y Clientes Corporativos solo demuestran `SystemRole Registered`: crear/editar/carga masiva y sus accesos no contienen condición de rol, puesto, usuario, propietario o estado. `Client.codigoUsuario` se usa para auditoría, no como autorización. Por ello `requireAuthentication` es el único gate 403/401 respaldado y no se añadió un rol inventado. Los endpoints locales separados de agregar/quitar adjuntos de convenio y cambiar estado de cliente descomponen un único submit legacy; su contrato 1:1 queda `BLOQUEADO`, aunque mantienen sesión, pertenencia al país y validaciones de dominio.

**Brecha restante:** otros flujos documentales, archivos, incidentes y casos todavía requieren atribución endpoint por endpoint. Que una ruta solo exija sesión no es una brecha cuando `Registered` es el contrato recuperado, pero esconder un botón en React tampoco demuestra autorización del servidor. `PATCH /labor/cases/:caseId` no se endureció con reglas de acciones porque corresponde al menú del caso y esa equivalencia no está demostrada.

**Evidencia requerida para cerrar:** por endpoint, expresión OML de visibilidad/condición, puesto/usuario/estado/owner exactos, objeto consultado antes de mutar, respuesta equivalente 403/redirect y pruebas negativas. Después: política declarativa central servidor, autorización object-level y espejo de visibilidad en UI. No relajar rutas porque el OML indique `Anonymous` sin comprobar el runtime.

### 4. Mantenimiento

**Estado:** `VERIFICADO` en el viewport auditado, con y sin parámetro.

Runtime confirmado:

- Siempre muestra `Seguimiento a Farmacias`.
- Con `?MantenimientoText=MENSAJE` muestra el heading fijo y debajo `MENSAJE`.
- Sin parámetro solo muestra el heading.
- No posee datasets ni acciones.

**Evidencia de cierre:** captura y geometría comparadas con/sin parámetro en el mismo viewport; mismo logo (hash idéntico al asset legacy), misma ilustración canónica `Image1.png` (SHA-256 `6AFA03EC12564E393D3F01EFE18D98BB10F1F5FB863AD91133FE44BF9CB942AB`), heading, mensaje, colores, escala y espaciado equivalentes. `isMantenimiento` no se cableó porque sigue sin referencia probatoria.

### 5. `srcAccionesIncidentesLegal` y `_OLD`

**Estado:** current y OLD `IMPLEMENTADO_PENDIENTE_RUNTIME` después de separar sus contratos; ninguna se declara verificada sin contraste autenticado local.

- Current: 33 controles, 32 ClientActions, 13 consultas; agrega chat, `GetPersonasAcciones`, `GetPersonasLegal`, `AceptarCambioEstadoOnClick`, `GetPersonasAccionesOnAfterFetch`, `CerrarPopupJustificacionOnClick` y `CancelarCasoOnClick`.
- OLD: 26 controles, 28 ClientActions, 12 consultas; usa `GetResponsables` y `GetPersonasReasignar` y no posee los agregados current anteriores.
- La réplica conserva un componente compartido, pero ahora selecciona un contrato explícito por superficie. Current consulta `GetPersonasAcciones`/`GetPersonasLegal`, muestra fecha de registro, campos actuales, editor de Responsable Legal, hilo y “Caso pendiente de información”. OLD consulta su `GetResponsables` con `LEFT JOIN`, `isRRHH` y `LIMIT 50`, y omite esos controles exclusivos.
- El runtime legacy observado mostró 6 responsables en current y 8 en OLD. La consulta OLD mantiene además aislamiento por país como restricción deliberada de seguridad; no alteró esas 8 opciones observadas.
- `GetPersonasReasignar` aparece en el modelo OLD, pero está sin uso. No se inventó un endpoint ni una unión para ese dataset.

**Evidencia requerida para cerrar:** iniciar sesión en el runtime local con perfiles autorizados, comparar ambas rutas en el mismo caso/viewport, y verificar cada acción común —iniciar, cerrar, anular, reasignar responsable/fecha— con sus reglas por estado/propietario, payload, persistencia, feedback y navegación. No eliminar ni redirigir OLD.

## Brechas 6–10

### 6. Cadena control → resultado

**Estado:** `BLOQUEADO` para la unión automática; `PARCIAL` por superficie.

`controls.csv` confirma 340 controles y 324 eventos, pero no enlaza cada control con su ClientAction. Solo 35 controles de pantalla tienen `Name`; ninguno de bloque lo tiene. Inferir por proximidad en XML produciría falsos positivos.

**Evidencia requerida:** OutDoc/Service Studio que exponga handler target, o inspección runtime individual que identifique la acción; luego trazar ClientAction → ServerAction/API → consulta → entidad/integración → efecto → feedback/navegación. Actualizar una fila de la matriz por cada cadena cerrada.

### 7. Entidades externas y productores

**Estado:** `BLOQUEADO` para contratos no observados.

Hay 205 entidades externas, 31 productores y 680 contratos inferibles. El nombre lógico no demuestra tabla física, columnas, joins, cardinalidad ni reglas del productor.

**Evidencia requerida:** DDL/`INFORMATION_SCHEMA`, OML de cada productor, Site Properties/configuración no sensible, muestras autorizadas y UAT. No inventar nombres físicos o joins. Documentar schema y productor por consulta antes de afirmar paridad.

### 8. Popups y menús contextuales

**Estado:** `PARCIAL`; `blkDestinos` queda `IMPLEMENTADO_PENDIENTE_RUNTIME` para filas no vacías.

El OML contiene 62 popups. En casos laborales el runtime confirmó `Ver Detalle`, `Reasignar Responsable` y `Anular Caso`; faltan 59+ contratos visuales/funcionales por atribuir y probar. `blkDestinos/GetDestino` ya se replica como expansión inline independiente del modal de edición, con filtros por país/proveedor/estado 5, columnas Banco/Tipo de Cuenta/Moneda y el vacío `No tiene destinos vinculados...`. En 30 expansiones legacy observadas no hubo filas y la base autorizada no ofreció un fixture estado 5, por lo que el estado vacío sí fue contrastado pero el contenido no puede cerrarse en runtime.

**Evidencia requerida:** trigger, condición visible/enabled, título, campos, validaciones, botones, loading, cierre, payload, errores y efecto por popup; screenshot antes/después en viewport común. Para `blkDestinos`, obtener un proveedor autorizado con destino estado 5 y comparar banco, número de cuenta y moneda.

### 9. Archivos, Excel, S3, PDF/ZIP, MIME, Base64 y correo

**Estado:** mezcla de `PARCIAL`, `SIMULADO` e `IMPLEMENTADO_PENDIENTE_RUNTIME`.

- Inventario: 19 cargas, 28 descargas, 7 exportaciones Excel, 1 importación Excel y 14 nodos de correo.
- Las 19 cargas nativas ya están inventariadas en `web/src/config/legacyFileContracts.js`; ninguna declara `Accept` ni tamaño en el widget Upload. Doce flujos de incidentes/acciones validan el nombre contra `png/jpeg/jpg/pdf` y conservan variantes tipográficas distintas de `extención`/`extensión` en el toast.
- `scrRegistroDocumento` valida al guardar `pdf/jpg/jpeg/png/bmp` y usa exactamente `El formato del documento no es permitido`, sin punto. El selector local ya no restringe antes de elegir y el límite de dominio inventado de 35 MiB se eliminó. El transporte JSON local continúa limitado a 50 MiB y el productor `ComprimirArchivosMultimedia` no está disponible, por lo que tamaño efectivo y compresión binaria siguen pendientes.
- `scrRegistrarConvenio` expone `.pdf,.jpeg,.jpg,.png,.docx,.doc,.xls,.xlsx,.txt`, máximo 500 archivos y `100000000` bytes; conserva DataURL/Base64 y la extensión desde el primer punto. El texto de exceso proviene de `MultiFileUpload.GenericErrorMessage`, no incluido, y el API local de 50 MiB no permite demostrar el máximo legacy de 100 MB: no se inventó un toast ni se declaró paridad de transporte.
- `scrCargaMasivaClientesCorp` no tiene `Accept` ni validación de extensión en el OML; convierte el binario a filas y valida los datos. Se retiró la restricción local `.xlsx` y se conserva `Seleccione un archivo..`.
- Los diez nombres de plantillas existen localmente y tienen pruebas de render; el envío real permanece neutralizado/gated.
- `SendemPorVencer` manual obtiene el destinatario desde `tblSucursales.correoSucursal`, usa el CC Legal/Angie observado e ignora cualquier `to` enviado por el cliente. El nodo alternativo que consumía `Destinario` está desconectado.
- Excel documental: el orden real de `RecordListToExcel1` es `codInternoSucursal, estado, fechaContrato, Categoria, sucursal, Proveedor, nivelDocumento, numRefencia, fechaVencimiento, usuarioCreacion, numContrato` y ya se conserva. En administrativo, OML deja sin `SourceValue` nivel/estado/usuario/proveedor; en próximos a vencer solo Proveedor queda sin fuente. Esos vacíos son salida legacy, no una brecha a rellenar. Sigue pendiente abrir ambos XLS en Excel con datos autorizados. `EnviarCorreoOnClick` de ambos históricos no está enlazado a ningún control; `Filter_RangoFechasOnSelected` administrativo también está huérfano y esa pantalla no muestra Fechas. En detalle, `EliminarArchivoOnClick` conecta `Start→End` y el popup Aceptar/Cancelar queda inaccesible porque ningún flujo asigna `ispopUp=True`. Esas acciones no se inventaron como funciones activas.
- `scrDetalleSucursalDocumentacion`: el preview local ya no depende de abrir un Blob en modal. Documentos y evidencias usan una URL del mismo origen bajo el API del portal y el backend entrega `.pdf` con `Content-Type: application/pdf`. El runtime cerró tres estados: Google Viewer `763.921875×600` sin mensaje para `docId=913`/extensión vacía/sin S3; iframe documental S3 `763.921875×1500` después del click; enlace, ids `137/2` y embed de libro `763.921875×800`.
- **Excepción de seguridad, no brecha a replicar:** cuando `Client.CODS3` está vacío, el legacy firma la raíz del bucket y expone su XML/listado. La réplica conserva el frame vacío de 1500px, pero no realiza la firma vacía ni devuelve el listado. S3, ACL/URL temporal, Base64 y compresión permanecen pendientes para casos válidos, sin copiar esa fuga.

**Evidencia requerida:** fixtures no productivos por tipo/MIME/tamaño; binario y nombre descargado; contenido/columnas/orden/formato del XLSX abierto en Excel; validación de import y rollback; claves S3 y ACL/URL temporal sin exponer credenciales; PDF/ZIP/Base64; destinatarios/asunto/cuerpo de correo en sandbox. No enviar correos reales ni mutar producción durante auditoría.

### 10. Proceso `prcVerificarProximoVencer`

**Estado:** algoritmo `IMPLEMENTADO_PENDIENTE_RUNTIME`, transporte externo `SIMULADO`; agenda, timezone y reintento durable del resumen `BLOQUEADO`.

El flujo conectado del OML ejecuta dos fases, no una consulta combinada:

1. `fechaVencimiento < AddMonths(hoy, 3) AND estadoDocumento=2`, sin límite inferior; transición `2→4` y `emNotificacionLegal`.
2. Después de esas mutaciones, `fechaVencimiento < hoy AND estadoDocumento IN (2,4)`; transición `(2|4)→5`, `mailVencido=1` y `emNotificacionLegalVencido`.

Por ese orden, un documento ya vencido en estado 2 recibe ambos avisos en una ejecución. El resumen `emNotificacionAreaLegal` solo se intenta si **ambas** listas originales tienen registros. La cadena duplicada con sufijo `2` está huérfana: su nodo inicial no tiene conector desde `Start` y no se ejecuta.

**Implementado y probado sin tocar datos reales:** dos consultas secuenciales, claims condicionales por fase, mutex local y advisory lock MySQL para abarcar ambas fases/resumen, rechazo `409` de un segundo runner, idempotencia, restauración acotada al fallar un envío, fecha `asOf` obligatoria en live, `dry-run` por omisión y guardia doble para live. Las pruebas usan repositorios y transporte simulados; no se invocó CLI `--commit`, endpoint live, MySQL ni TD/SMTP.

**Evidencia requerida para cerrar:** configuración externa que lanza el proceso, timezone/calendario del ambiente, DDL e índices físicos, ejecución UAT autorizada sobre fixtures persistidos, destinatarios y plantillas en sandbox. El OML no declara handler ni política de retry; tampoco existe un outbox recuperado para reintentar solo el resumen sin duplicar avisos individuales. Además, una caída abrupta entre el `UPDATE` y el envío puede dejar una transición final sin correo: el lock elimina la carrera entre runners cooperantes, pero no sustituye un lease/outbox durable.

## Brechas funcionales adicionales ya localizadas

- `scrDashboardMonitoreo`: las 113/113 tarjetas cerraron `text diff=0`, `rect diff=0` y grid `9517` en `1289×912`. El bloque recibe solo sucursal: requeridas, registradas, por vencer y otros no dependen del documento seleccionado. Quedan filtros y navegación con datos alternos, fallo de consulta y validación de los permisos declarados `Anonymous`/`Registered`.
- `scrDetalleSucursalDocumentacion`: documentos 27/27 y libros 4/4 cerraron `text diff=0` y `rect diff=0`. `FA63` corresponde a `branchId=226`; la autoridad es el contexto seleccionado, que sobrevive refresh, no el query string. El OML no ejecuta una ClientAction `OnInitialize`; `subCategoria` inicia literalmente en 1 y `GetTblRegistroDocumentoes` toma el activo principal de esa subcategoría. `GetTblRegistroDocumentoes_ActivoPrin` no contiene filtro `IsActivoPrincipal`, depende de `Documento.subCategoriaDocumento` y sirve al alta, no a la selección inicial. Siguen `PARCIAL` las acciones por puestos 7/32, altas/bajas, descarga/S3 y estados con otros datos; la firma vacía que expone el bucket legacy queda excluida por seguridad.
- `scrMisAccionesInternoVisita` y `scrMisAccionesExternos`: el OML tiene 18/19 controles y 21/22 ClientActions. En el runtime canónico ambas consultas fallan al cargar, dejan cero filas y muestran `Error executing query.`; ese estado ya se replica con feedback persistente y geometría/CSS legacy. El switch OML 1 anular, 2 cerrar, 3 reasignar responsable, 4 reasignar fecha y 5 iniciar quedó reconstruido, pero filas/menús/popups siguen bloqueados para comparación porque el runtime canónico no devuelve registros.
- `srcMisAccionesCasosLaborales`: ya conserva filtro de 50, reglas responsable/usuario 1 y estados 3/5, iniciar/cerrar/anular, reasignaciones conectadas pero `Visible=False`, histórico inline y evidencia. La anulación cambia solo a estado 3, sin pedir ni persistir una justificación que el OML no recoge. El runtime devolvió cero filas incluso ampliando 2020–2026, por lo que menús, popups, histórico y formato de fechas con datos siguen `IMPLEMENTADO_PENDIENTE_RUNTIME`.
- `scrDetalleDocumento`: falta validar el alcance visual del menú overflow con otros roles/estados; su `EliminarArchivoOnClick` observado no produce mutación en el OML.
- `scrHistoricoDocumentos`: el selector Fechas refresca pero deliberadamente no filtra tabla/Excel, igual que el runtime. `scrHistoricoAdministrativoDoc` no muestra ese filtro. Los `EnviarCorreoOnClick` de ambas superficies carecen de control enlazado.
- `PortalLayout`: ya replica el grupo Dashboard con `Dashboard Global`, `Dashboard Sucursales` y `Análisis Contratos`, además del destino del logo; falta contraste autenticado del menú local, visibilidad por puesto y estado activo.
- `DoSSO`, `DoLoginSessionClosed` y `TokenSession` quedan deliberadamente sin equivalente local porque el OML los marca sin uso y con cero llamadas; implementarlos ampliaría el comportamiento. Queda pendiente UAT del cierre/expiración de la sesión activa y contrastar `Timeout=3600` con el TTL local.

## Regla de entrega

No usar `100%`, `idéntico` o `terminado` hasta cerrar: runtime por roles, productores y datos, archivos/integraciones, proceso, comparación visual y UAT. Cada avance debe registrar archivo, prueba, evidencia legacy y diferencias pendientes en la matriz.
