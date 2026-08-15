# Franthina Manager

Sistema de administración para la pastelería artesanal Franthina. SPA modular,
sin frameworks pesados, construida con HTML5 + CSS3 + JavaScript ES2024+.

## Estado de este entregable

Base arquitectónica completa más **13 módulos funcionales** de administración
(Dashboard, Productos, Ingredientes, Recetas, Inventario, Producción,
Clientes, Ventas, Caja, Pedidos, Proveedores, Compras y Reportes) más, desde
v0.19, una **tienda pública** con catálogo, carrito y checkout, separada del
admin: todo el sistema de gestión vive ahora en `/admin`, y `/` es la tienda
que ve cualquier visitante. Un pedido hecho desde la tienda crea un Pedido
real, visible en `/admin/pedidos`. Desde v0.22, tanto la tienda como
`/admin/pedidos` tienen integración con WhatsApp (links `wa.me`, sin API ni
backend) para mandar el resumen del pedido con un toque. Desde v0.25, los
datos viven en Supabase (no en el navegador) y `/admin` está protegido por
login real (Supabase Auth) — ver `core/auth.js` y `core/router.js`. Con esto
el núcleo comercial completo del brief original está cubierto — ver
`docs/ROADMAP.md` para lo que queda (roles/permisos reales, multiusuario,
SaaS, integraciones).

**Importante**: aunque `/admin` ya pide login, los roles/permisos por tipo de
usuario todavía no están implementados — cualquier cuenta con sesión iniciada
tiene acceso completo. No crees cuentas para empleados todavía (ver
`docs/ROADMAP.md`, "Usuarios y roles").

## Cómo ejecutarlo

Es una SPA 100% estática, sin build step. Necesita servirse por HTTP (no
`file://`) porque usa ES Modules e IndexedDB/Service Worker.

```bash
# Cualquier servidor estático funciona, por ejemplo:
npx serve .
# o
python3 -m http.server 8080
```

Luego abrir `http://localhost:8080` (o el puerto que indique tu servidor).

## Publicar en GitHub Pages

El proyecto está preparado para funcionar tal cual en GitHub Pages, tanto si
se publica en la raíz de un dominio (`usuario.github.io`) como en un
subdirectorio de repositorio (`usuario.github.io/nombre-repo/`):

1. Subí el contenido de esta carpeta a un repositorio de GitHub (puede ser la
   raíz del repo o la rama que uses para Pages).
2. En el repositorio: **Settings → Pages → Build and deployment → Source:
   "Deploy from a branch"**, elegí la rama (ej. `main`) y la carpeta `/ (root)`.
3. Guardá. GitHub te va a dar la URL pública en unos minutos
   (`https://usuario.github.io/nombre-repo/`).

Detalles técnicos ya resueltos para que esto funcione:

- Todas las rutas de la SPA (`core/router.js`, `app.js`) resuelven el
  subdirectorio real de despliegue en tiempo de ejecución a través de
  `core/basePath.js` — no hay que tocar nada a mano.
- `404.html` redirige a `index.html` preservando la ruta pedida (sin importar
  cuántos niveles tenga, ej. `/admin/productos`), así que entrar directo o
  refrescar en una ruta interna no rompe (GitHub Pages no soporta
  reescritura de rutas del lado del servidor).
- `service-worker.js` y `manifest.json` usan rutas relativas al scope real,
  así el modo offline y el "Agregar a pantalla de inicio" funcionan también
  bajo un subdirectorio.
- Si publicás en un repo tipo `usuario.github.io` (user/org page, se sirve
  desde la raíz del dominio) en vez de un project site
  (`usuario.github.io/nombre-repo/`), hay que ajustar una sola constante:
  `pathSegmentsToKeep` al principio de `404.html`, de `1` a `0` — el
  comentario en ese archivo lo explica.

## Arquitectura en una página

```
index.html          → shell HTML mínimo, carga app.js
app.js               → arranque: shell, rutas, accesibilidad, service worker
core/                → infraestructura transversal (nunca contiene reglas de negocio)
  config.js           → constantes globales, rutas, navegación
  router.js           → router propio con lazy loading
  state.js            → estado global de UI (accesibilidad, tema, ruta actual)
  eventBus.js          → comunicación desacoplada entre módulos
  errors.js           → manejo centralizado de errores, mensajes amigables
  logger.js           → registro de eventos para auditoría futura
  utils.js            → funciones puras reutilizables (moneda, fechas, ids...)
  storage/            → capa de abstracción de almacenamiento
    StorageAdapter.js    → contrato/interfaz
    LocalStorageAdapter.js → implementación actual (MVP)
    index.js             → fachada única que el resto de la app consume
design-system/       → tokens.css + base.css + components.css
components/           → biblioteca de componentes reutilizables (modal, toast, tabla...)
modules/              → un directorio por feature de negocio (ver abajo)
```

## Regla de oro de los módulos

Cada carpeta en `modules/` es independiente y sigue siempre el mismo patrón:

| Archivo | Responsabilidad |
|---|---|
| `*.model.js` | Forma de los datos |
| `*.validator.js` | Reglas de validación |
| `*.service.js` | Lógica de negocio + storage |
| `*.renderer.js` | Genera HTML, nunca toca storage **ni importa el Service** (ver `docs/ARCHITECTURE.md`) |
| `*.controller.js` | Coordina Service + Renderer + DOM |
| `index.js` | Única puerta de entrada pública del módulo |

**Un módulo nunca importa los archivos internos de otro módulo.** Si necesita
datos de otro módulo, consume su `Service` público (ver `dashboard.service.js`
como ejemplo) o se comunica vía `core/eventBus.js`. Esto es lo que permite
agregar, quitar o reemplazar módulos sin romper el resto del sistema.

## Cambiar la fuente de almacenamiento

Hoy los datos viven en `localStorage`. Para migrar a IndexedDB, Supabase o una
REST API en el futuro **no se toca ningún módulo de negocio**: se implementa
un nuevo adaptador en `core/storage/` que cumpla `StorageAdapter`, y se cambia
un único valor en `core/config.js` (`storageAdapter`).

## Accesibilidad

Implementado en este entregable: tamaño de fuente (3 niveles), alto contraste,
espaciado ampliado, reducir animaciones, modo claro/oscuro — todo desde
**Configuración**, persistido y aplicado globalmente vía clases en `<html>`
(ver `design-system/tokens.css`). Objetivo de contraste: WCAG AA como mínimo.

## Arquitectura, convenciones y qué queda deliberadamente afuera

Ver `docs/ARCHITECTURE.md` — documenta la convención de nombres de archivo,
por qué las colecciones de storage están centralizadas, qué piezas de la capa
de datos (migraciones, backup, estado, eventos, persistencia) ya están
resueltas, y por qué no hay carpetas vacías para módulos futuros.

Ver `docs/EVENTS.md` para el catálogo completo de eventos del `eventBus`,
quién emite cada uno y quién escucha.

Ver `docs/DATA-FLOW.md` para el recorrido real de una acción (crear una
venta) a través de UI → Controller → Validator → Service → Storage →
Renderer, `docs/STORAGE.md` para la forma de cada colección, y
`docs/METRICS.md` para el historial de tests por versión.

Ver `docs/BUSINESS-RULES.md` para las invariantes del negocio explícitas
(qué nunca debe poder pasar, y dónde se garantiza en código).

## Testing

Hay un test de integración de extremo a extremo en `tests/` que ejecuta el
código real del proyecto (no una reimplementación) encadenando todos los
módulos: Ingredientes → Recetas → Producción → Inventario → Productos →
Clientes → Caja → Ventas → Dashboard. Ver `tests/README.md`.

```bash
cd tests
npm install
npm test
```

## Documentación por módulo

Ver `docs/module-*.md` para cada uno de los 12 módulos, y `docs/ROADMAP.md`
para lo que sigue.
