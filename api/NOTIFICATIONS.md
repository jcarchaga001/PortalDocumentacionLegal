# Notificaciones y procesos legacy

Este módulo replica las diez pantallas de correo definidas en el flujo `Emails` del OML de `DocumentacionLegal` y el proceso público `prcVerificarProximoVencer`. Los envíos salen exclusivamente por `tdMailService`; no se configura SMTP directo en este portal.

## Plantillas recuperadas

| Pantalla OML | Uso recuperado | Destinatarios y condición legacy |
| --- | --- | --- |
| `emNotiAccionLegal` | Asignación de acción legal | La pantalla existe en el OML, pero el artefacto no contiene un nodo `SendEmail` que permita recuperar un destinatario fijo. Se expone para que el flujo llamador entregue `to`/`cc`. |
| `emNotiAccionCasosLaborales` | Acción de caso laboral (`CorreoAccion`) | `To`: correo entregado por el flujo. `CC`: responsable legal configurado. |
| `emNotiAccionComentario` | Comentario urgente | Sólo si el destinatario tiene `isUsuario = False` y correo; `To`: destinatario; `CC`: usuario que asignó o Transformación Digital si es usuario técnico. |
| `emNotificacionAreaLegal` | Resumen tabular de documentos | `To`: correo legal; `CC`: responsable de documentación legal. |
| `emNotiAccionConveniosAVencer` | Convenios a menos de 30 días | `To`: responsable de convenios; `CC`: gerentes de cuenta con correo; `BCC`: supervisores configurados. |
| `emNotificacionLegal` | Documento próximo a vencer | `To`: `tblSucursales.correoSucursal`; `CC`: área legal. |
| `emNotiincidente` | Incidente reportado, interno o externo | Sólo si el destinatario tiene `isUsuario = False` y correo; `CC`: correo de sucursal y responsables de incidentes. ARSA/CQFH agrega el responsable regulatorio. |
| `emNotificacionRRHH` | Acción asignada a RR. HH. | Sólo si el destinatario tiene `isUsuario = False` y correo válido; `CC`: responsable de RR. HH. |
| `emNotiAccion` | Acción de incidente | Sólo si el destinatario tiene `isUsuario = False` y correo; `To`: destinatario; `CC`: usuario que asignó. |
| `emNotificacionLegalVencido` | Documento vencido | `To`: `tblSucursales.correoSucursal`; `CC`: área legal. |

Se conservaron los asuntos y textos funcionales observados, incluidos los nombres legacy. Todo valor dinámico se escapa antes de insertarse en HTML y cada plantilla produce alternativa `text`.

## Proceso `prcVerificarProximoVencer`

La consulta usa:

- `dbaiupyjxopa5m.tblDocumentos`
- `dbaiupyjxopa5m.tblCategoriaDocumentos`
- `dbaiupyjxopa5m.tblSubcategoriaDocumentos`
- `dbpqiygwlvvnhg.tblSucursales`

Comportamiento recuperado:

1. Documentos no referenciales con `fechaVencimiento < hoy`, estado `2` o `4` y sin `mailVencido` pasan a estado `5`, marcan `mailVencido = 1` y generan `emNotificacionLegalVencido`.
2. Documentos no referenciales con estado `2`, desde hoy y antes de `AddMonths(hoy, 3)`, pasan a estado `4` y generan `emNotificacionLegal`.
3. Los documentos procesados se agrupan en `emNotificacionAreaLegal`, con sucursal, categoría, subcategoría, documento, referencia, vencimiento y estado.

La reclamación de cada registro es condicional. Una segunda ejecución no vuelve a enviar documentos que ya cambiaron de estado. Si TD rechaza el envío individual, el estado reclamado se revierte para permitir reintento.

El OML también contiene la acción pública `ConveniosAVencer`, aunque no es un `Process` de OutSystems. Se replica como trabajo programable: selecciona convenios no indefinidos, no reportados y con vencimiento entre hoy y 29 días; después del reclamo marca `isReportado = 1` y envía un único resumen.

## Ejecución manual segura

Desde `api`:

```powershell
# Sólo consulta y muestra conteos. No modifica ni envía.
npm.cmd run notifications:dry-run -- --process=document-expirations

# Fecha de corte reproducible, todavía sin cambios.
npm.cmd run notifications:dry-run -- --process=all --date=2026-08-06

# Ejecución efectiva: además requiere NOTIFICATION_LIVE_ENABLED=true.
npm.cmd run notifications:run -- --process=document-expirations
```

El modo predeterminado del CLI y de todos los endpoints de envío, workflow y procesos es `dry-run`. La ejecución efectiva requiere `--commit` en CLI o `{"dryRun": false}` en API.

## Guard de ejecución real

Hay defensa en dos capas:

1. El servicio bloquea cualquier envío o reclamo antes de consultar candidatos cuando `NOTIFICATION_LIVE_ENABLED` no es exactamente `true`. Esto también protege el CLI.
2. En HTTP, el middleware de las rutas mutables exige además:
   - `req.auth.positionCode` incluido en `NOTIFICATION_ADMIN_POSITION_CODES`;
   - cabecera `X-Notification-Run-Token` igual a `NOTIFICATION_RUN_TOKEN`;
   - token configurado con al menos 32 bytes.

Una petición sin `dryRun: false` nunca envía ni reclama registros y no necesita token. Un ejemplo de ejecución HTTP efectiva es:

```http
POST /DocumentacionLegal/api/notifications/processes/document-expirations/run
Content-Type: application/json
X-Notification-Run-Token: <secreto-de-al-menos-32-bytes>

{"dryRun": false}
```

El token no se acepta en query string ni se registra. El CLI es una vía local/servidor: no usa el token HTTP, pero exige simultáneamente `NOTIFICATION_LIVE_ENABLED=true` y `--commit`.

El botón `Enviar Correo` de `scrProximosVencer` usa la misma guardia. El proxy web agrega la cabecera sólo a `POST /notifications/documents/:id/expiration/send`, desde su variable server-side `NOTIFICATION_RUN_TOKEN` (sin prefijo `VITE_`); el secreto no forma parte del bundle. El API vuelve a consultar el documento dentro del país autenticado, ignora destinatarios enviados por el navegador y fija `legal.hn@farmavalue.com`, como el flujo `SendemPorVencer` observado.

## Programación

El OML conserva `CurrDateTime()` como activación de la actividad, pero no incluye una agenda exportable. Una agenda equivalente recomendada es diaria, fuera del horario de mayor uso.

En Windows Task Scheduler:

- Programa: `npm.cmd`
- Argumentos: `run notifications:run -- --process=document-expirations`
- Iniciar en: la ruta absoluta de `DocumentacionLegal\api`
- Frecuencia sugerida: diaria a las 06:00

Para convenios puede crearse una segunda tarea diaria con `--process=agreement-expirations`. En Linux/cron, el comando equivalente es:

```cron
0 6 * * * cd /ruta/DocumentacionLegal/api && /usr/bin/npm run notifications:run -- --process=document-expirations
```

## API autenticada

Al montar el router bajo `${BASE_PATH}/api/notifications`:

- `GET /templates`
- `POST /templates/:template/preview`
- `POST /templates/:template/send`
- `POST /workflows/:workflow`
- `POST /documents/:documentId/expiration/send`
- `POST /processes/document-expirations/run`
- `POST /processes/agreement-expirations/run`

Flujos disponibles: `legal-action`, `incident-action`, `urgent-comment`, `human-resources-action`, `incident-reported`, `incident-legal` y `labor-action`.

### Estado de enlace con acciones de negocio

`incidentService` llama automáticamente sólo los puntos comprobados en el OML actual:

- alta de incidente interno o externo: `incident-reported`, dirigido al responsable de la primera acción automática del ente;
- alta de una acción de incidente: `incident-action`;
- alta de una acción laboral: `human-resources-action` únicamente cuando el responsable autorizado está marcado como RR. HH.; si el responsable es el solicitante no-RR. HH., el OML no envía correo y la API lo informa como omitido;
- reasignación de una acción laboral: `labor-action`, equivalente a la acción OML `CorreoAccion`.

Las demás operaciones no disparan correos automáticamente mientras no exista una llamada demostrable en el OML. En particular, los procesos de documentos y convenios **no** están conectados a los CRUD: `prcVerificarProximoVencer` y `ConveniosAVencer` siguen siendo trabajos independientes, ejecutables por CLI o por sus endpoints protegidos.

### Política posterior a la transacción

El cambio de negocio se confirma antes de intentar el correo. Un rechazo de TD, un destinatario incompleto o el guard deshabilitado no revierte ni hace fallar la operación ya guardada. La respuesta conserva los datos creados o actualizados y agrega `data.notification`:

- `success: true` y `sent: true` cuando TD aceptó el envío;
- `success: true`, `sent: false` y `skipped: true` cuando el OML no prescribe correo o el destinatario no es elegible;
- `success: false`, `sent: false` y un `code` cuando el intento posterior al commit falló.

El mensaje de error es deliberadamente genérico y no expone respuestas ni configuración del proveedor. Esta integración no implementa un outbox ni un reintento automático para acciones interactivas.

## Variables opcionales

Todas permiten sobrescribir los destinatarios recuperados del OML sin cambiar código:

- `NOTIFICATION_LIVE_ENABLED` (`false` por defecto)
- `NOTIFICATION_RUN_TOKEN` (secreto de 32 bytes o más; sólo HTTP live)
- `NOTIFICATION_ADMIN_POSITION_CODES` (por defecto `7,15,32`)
- `DIGITAL_TRANSFORMATION_EMAIL`
- `HR_NOTIFICATION_CC`
- `INCIDENT_NOTIFICATION_CC`
- `INCIDENT_REGULATORY_CC`
- `INCIDENT_LEGAL_NOTIFICATION_TO`
- `LABOR_ACTION_NOTIFICATION_CC`
- `DOCUMENT_EXPIRATION_CC`
- `LEGAL_NOTIFICATION_EMAIL`
- `LEGAL_NOTIFICATION_CC`
- `AGREEMENT_NOTIFICATION_TO`
- `AGREEMENT_NOTIFICATION_BCC`

Si no se definen, se usan los destinatarios observados en el OML. Las variables obligatorias de base de datos y TD siguen siendo las mismas del API (`DB_*`, `DOCUMENT_DB_NAME`, `HR_DB_NAME`, `TD_API_BASE_URL`, etc.).

## Montaje en `app.js`

```js
import { createNotificationRepository } from "./repositories/notificationRepository.js";
import { createNotificationRouter } from "./routes/notificationRoutes.js";
import { createNotificationService } from "./services/notificationService.js";

const notificationService = createNotificationService({
  repository: createNotificationRepository(),
});

app.use(
  `${apiBasePath}/notifications`,
  requireAuthentication,
  createNotificationRouter(notificationService),
);

const incidentService = createIncidentService(createIncidentRepository(), {
  notificationService,
});
```

Los flujos automáticos de negocio no pasan por el endpoint manual, por lo que no usan `X-Notification-Run-Token`; sí respetan el guard central `NOTIFICATION_LIVE_ENABLED`. El token y los puestos permitidos continúan siendo obligatorios para invocaciones HTTP reales de `/notifications`.
