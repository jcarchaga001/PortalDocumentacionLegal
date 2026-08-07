# Documentación Legal

Réplica full-stack del portal OutSystems `DocumentacionLegal`, separada en dos aplicaciones:

- `web`: React 19, Ant Design, Vite y servidor Express para el build.
- `api`: Express, sesión segura, acceso único a MySQL e integraciones TD.

La réplica conserva los nombres, parámetros y comportamiento observado en el portal y el OML. El inventario web cubre las **37 de 37 rutas legacy** identificadas; el detalle está en [PORTAL_MAP.md](./PORTAL_MAP.md).

## Estado funcional

- Acceso por país, usuario y clave, recuperación de acceso y cambio obligatorio de contraseña.
- Sesión firmada en cookie `HttpOnly`; las credenciales y los datos de conexión no se entregan al navegador.
- Pantalla principal, monitoreo de sucursales y dashboard global con filtros, métricas y exportación a Excel.
- Documentación de sucursales y administrativa: históricos con exportación a Excel y vista previa de archivos, registro, detalle, aprobación, rechazo, eliminación autorizada, próximos vencimientos, archivos y libros/evidencias por sucursal.
- Convenios: listado con exportación a Excel, registro, edición y detalle con ficha del cliente, contactos, sucursales que facturan, responsables, pagaré, trazabilidad y vista previa o descarga de adjuntos. Un convenio con pagaré conserva al menos un adjunto y el alta/edición persiste convenio y referencias de archivo en una sola transacción.
- Clientes corporativos: listado, alta, edición, activación y carga masiva desde Excel.
- Catálogos y permisos: usuarios, proveedores, categorías documentales, entes gubernamentales y acciones legales.
- Incidentes internos y externos: listados exportables, registro, detalle, comentarios, acciones, seguimiento y cierre.
- Casos laborales: historial exportable, detalle vigente y vista legacy diferenciada, permisos, prioridad, comentarios y gestión de acciones.
- Riesgo documental: histórico, filtros, detalle por archivo, cláusulas y acceso al PDF por S3.
- Diez plantillas de correo recuperadas del OML y procesos de vencimiento de documentos y convenios, con modo `dry-run` y entrega por TD Mail.

## Vistas previas y exportaciones

- Los históricos de documentos de sucursal y administrativos, junto con los próximos vencimientos, abren los archivos compatibles en un panel lateral y conservan la descarga como acción independiente.
- El detalle del convenio abre PDF, JPG, JPEG y PNG en el panel `Visor de Archivos`; los demás adjuntos mantienen su descarga sin presentar una vista previa inexistente.
- Los detalles de documento, documentación por sucursal y riesgo exponen la consulta o descarga del archivo asociado según la fuente legacy correspondiente.
- Las exportaciones a Excel están disponibles en el dashboard global, los tres históricos documentales, convenios, incidentes internos y externos, casos laborales y riesgo. Cada exportación parte de los filtros activos de su pantalla.
- Las 37 rutas incluyen por separado el detalle actual de casos laborales y `srcAccionesIncidentesLegal_OLD`; esta última conserva una composición legacy propia y no es un alias de la vista vigente.

## Configuración local

Los archivos locales `api/.env` y `web/.env` usan actualmente la subruta real `/DocumentacionLegal` y los puertos `3003` y `3002`. Para crear una configuración nueva:

```powershell
Copy-Item api/.env.example api/.env
Copy-Item web/.env.example web/.env
```

Complete los datos privados únicamente en esos archivos locales. La configuración pública mínima es:

```dotenv
# api/.env
PORT=3003
BASE_PATH=/DocumentacionLegal

DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
DOCUMENT_DB_NAME=
PROVIDER_DB_NAME=
HR_DB_NAME=
RISK_DB_NAME=

AUTH_HASH_URL=https://host/api/rest/general/GenerateMD5
SESSION_SECRET=
TD_API_BASE_URL=https://host/td/api/v1
```

```dotenv
# web/.env
PORT=3002
VITE_BASE_PATH=/DocumentacionLegal
VITE_API_BASE_URL=/DocumentacionLegal/api
API_PROXY_TARGET=http://127.0.0.1:3003
```

`BASE_PATH`, `VITE_BASE_PATH` y el prefijo de `VITE_API_BASE_URL` deben coincidir. `SESSION_SECRET` debe ser aleatorio y tener al menos 32 bytes. No copie claves, contraseñas, tokens ni destinatarios privados al repositorio.

## Fuentes de datos e integraciones

| Configuración | Fuente y responsabilidad |
|---|---|
| `DB_NAME` | MySQL de personas, credenciales, países, puestos y sucursales. |
| `DOCUMENT_DB_NAME` | MySQL de documentos, convenios, clientes, incidentes, catálogos y bitácoras. |
| `PROVIDER_DB_NAME` | MySQL del catálogo de proveedores. |
| `HR_DB_NAME` | MySQL de empleados y datos auxiliares de casos laborales y convenios. |
| `RISK_DB_NAME` | MySQL de análisis de riesgo, plantillas, cláusulas y metadatos de archivos. |
| `AUTH_HASH_URL` | Servicio HTTPS heredado de transformación de credenciales, consumido solo por el API. |
| `TD_API_BASE_URL` | API TD para subir, descargar y generar URL temporales de S3, y para enviar correo. |

El proveedor de credenciales del portal origen sólo admite su contrato heredado por `GET`. La réplica lo consume exclusivamente desde el API, exige HTTPS, rechaza URLs con credenciales embebidas y no expone la clave al navegador ni a los registros. Sustituir ese contrato por un hash moderno requiere una migración coordinada del proveedor y de las credenciales existentes.

Las consultas funcionales principales se restringen por el país guardado en la sesión. En las cargas, el API genera la clave S3 y rechaza una clave propuesta por el navegador. Para descargar o generar una URL temporal, además de exigir sesión y formato válido, comprueba que la clave esté vinculada a un registro visible del país autenticado; esto conserva el acceso legacy a históricos y convenios de clientes inactivos sin permitir cruces entre países.

## Arranque

### Visual Studio Code

Abra [DocumentacionLegal.code-workspace](./DocumentacionLegal.code-workspace), vaya a **Run and Debug** y seleccione:

```text
Portal completo · 3002 + 3003
```

La configuración comprueba ambos puertos, carga los datos privados del API desde `api/.env`, inicia API y web y abre:

```text
http://localhost:3002/DocumentacionLegal/Login
```

También puede ejecutar `API · puerto 3003` o `Web · puerto 3002` por separado. `launch.json` no contiene ni solicita credenciales: toda configuración sensible permanece en los `.env` ignorados por Git.

### Terminal

En una terminal:

```powershell
cd api
npm.cmd install
npm.cmd run dev
```

En otra terminal:

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

No es necesario volver a ejecutar `npm install` para corregir una variable ausente; Vite y el API cargan sus respectivos archivos `.env` al arrancar.

### Producción

```powershell
cd web
npm.cmd run build
npm.cmd start
```

```powershell
cd api
npm.cmd start
```

`ecosystem.config.js` define los procesos PM2 `documentacion-legal-web` y `documentacion-legal-api`. En el servidor solo se cambia la carpeta física y se mantienen los valores de despliegue en los `.env` de cada proceso.

## API

Todos los contratos viven bajo `/DocumentacionLegal/api`:

- `/auth`: países, login, sesión, recuperación, cambio de contraseña y logout.
- `/dashboard`: resumen global y monitoreo por sucursal.
- `/documents`: catálogos, históricos, detalle, registro, estados, adjuntos y libros/evidencias.
- `/agreements` y `/corporate-clients`: convenios, adjuntos, clientes y carga masiva.
- `/incidents`: incidentes internos/externos, casos laborales, acciones, comentarios y cierres.
- `/catalogs`: permisos, proveedores, categorías, entes y acciones legales.
- `/risk`: histórico, catálogos y detalle de análisis.
- `/td`: adaptador S3 con claves de carga generadas por el servidor y lecturas autorizadas contra registros visibles del país; la salud de TD Mail y el envío directo, que exige además el guard de ejecución live y su token operativo.

Salvo salud, países, login y recuperación, los contratos requieren una sesión válida.

## Notificaciones programadas

El comando predeterminado consulta candidatos sin modificar datos ni enviar correo:

```powershell
cd api
npm.cmd run notifications:dry-run -- --process=all
```

La ejecución efectiva está protegida por configuración explícita y usa TD Mail. Las plantillas, condiciones, destinatarios configurables y programación se describen en [api/NOTIFICATIONS.md](./api/NOTIFICATIONS.md).

## Verificación

```powershell
cd api
npm.cmd test

cd ../web
npm.cmd run build
```

La suite del API cubre autenticación y sesión, acceso seguro a catálogos, dashboard, documentos y S3, convenios/clientes, incidentes/casos laborales, riesgo y notificaciones. Las comprobaciones que consultan MySQL real son optativas y permanecen omitidas cuando no se habilita expresamente la integración. El build de Vite valida las 37 rutas y genera el artefacto de producción en `web/dist`.
