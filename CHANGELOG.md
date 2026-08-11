# Changelog

## [Sin versionar] — v0.27, primer paso: visibilidad de usuarios
Primera parte de "Usuarios y roles" del roadmap, a propósito acotada: hoy
hay un solo usuario (vos), y todavía no se probó el login básico — así que
en vez de reescribir de una todas las políticas de seguridad para
restringir por rol (alto riesgo sin verificar la base), se agrega solo lo
que ya aporta valor ahora: **saber quién tiene acceso**. La restricción
real por rol (que un Empleado no pueda ver costos, por ejemplo) queda para
cuando el login esté confirmado y haya más de una persona usando la app.

### Agregado
- `franthina_schema_v027_profiles.sql`: tabla `profiles` (un perfil por
  usuario, con un rol), con creación automática al registrarse — 100%
  aditivo, no toca ninguna tabla ni política existente.
- `core/userProfiles.js`, y una tarjeta nueva "👥 Usuarios con acceso" en
  Configuración: lista de emails + rol de quienes tienen una cuenta. Solo
  aparece si la app está usando Supabase (con localStorage no hay usuarios
  reales que listar).

## [Sin versionar] — v0.26: migrar los datos de prueba del celular a la nube
Herramienta para subir a Supabase lo que haya quedado cargado en el
celular desde antes de conectar la nube — así no hay que volver a cargar
productos de prueba a mano.

### Agregado
- `core/legacyLocalMigration.js`: lee los datos que quedaron en localStorage
  de antes de pasar a Supabase (única excepción en todo el proyecto a la
  regla de "nunca leer un adapter de storage directo" — acá es intencional,
  porque el adapter activo ahora es Supabase y no puede ver esos datos).
- Configuración: nueva tarjeta "☁️ Migrar datos de este celular a la nube",
  que solo aparece si hay datos viejos para migrar (no molesta si ya se
  migró, o si nunca hubo datos locales). Un solo botón, con confirmación
  explícita que avisa si va a reemplazar algo que ya se haya cargado
  directamente en la nube.

### Nota técnica
Reusa `restoreBackup()` (`core/backup.js`) tal cual, sin duplicar la lógica
de restauración — solo se agregó una forma nueva de *armar* el objeto de
backup, leyendo localStorage en vez de la fachada de storage.

## [0.25.0] — Base de datos en la nube (Supabase) + login de administración
Salto grande: los datos dejan de vivir solo en el navegador (localStorage) y
pasan a una base de datos real en la nube, con acceso a `/admin` protegido
por sesión de verdad. Se adelantó la nube antes que el login (v0.24 original
del roadmap) porque un login "real" no se puede hacer bien sin un backend de
autenticación de por medio — construirlos en el orden inverso hubiera dejado
v0.24 a medio camino.

### Agregado
- `core/supabaseClient.js`, `core/auth.js`: cliente y sesión de Supabase,
  compartidos por toda la app.
- `core/storage/CloudStorageAdapter.js`: misma interfaz que
  `LocalStorageAdapter` — ningún `*.service.js` de los 13 módulos tuvo que
  cambiar para pasar a la nube, tal como preveía la arquitectura original
  (`core/storage/index.js` ya tenía el punto de extensión comentado).
- `modules/login/index.js`: pantalla de acceso (email + contraseña, mostrar/
  ocultar contraseña, mensajes de error traducidos). Sin registro público
  a propósito — el usuario de administración se crea a mano en el panel de
  Supabase, nunca desde la app.
- `core/router.js`: soporte de "guard" (`setGuard`) — bloquea la carga de
  cualquier ruta de `/admin` sin sesión iniciada ANTES de que el módulo
  protegido llegue a pedir datos, en vez de bloquear después.
- Botón "Cerrar sesión" en el pie del menú de administración.
- `franthina_schema.sql`, `franthina_schema_fix.sql`: esquema completo (13
  tablas + valores de configuración), con seguridad a nivel de fila (RLS):
  todo requiere sesión, salvo crear un pedido/cliente desde la tienda
  (checkout de invitado) y leer el catálogo público de productos — a través
  de una función dedicada que nunca expone costo, notas ni stock exacto.

### Cambiado
- `modules/products/product.service.js`: nuevo método `listPublic()` — la
  tienda ya no lee la tabla real de productos (protegida), sino la función
  seguray `get_public_products()`. `store-catalog` y `store-cart` actualizados
  para usarlo.
- `store-cart.controller.js`: la búsqueda de cliente repetido por teléfono/
  email ahora tolera no tener permiso de lectura (un visitante sin sesión
  solo puede crear clientes, no leerlos) — si no puede buscar, crea uno
  nuevo directamente en vez de romper el checkout.
- `app.js`: las migraciones de datos ahora corren solo una vez y solo con
  sesión iniciada — antes corrían para cualquier visitante, lo que rompería
  la tienda pública contra una base con permisos reales.

### Nota
`APP_CONFIG.storageAdapter` quedó en `'supabase'`. Si algo no anda, volver a
`'localStorage'` en `core/config.js` restaura el comportamiento anterior al
instante mientras se investiga.

## [Sin versionar] — v0.23, primera pasada: Ventas, Pedidos, Compras, Producción
Primera parte de la auditoría UX completa (v0.23 del roadmap). Se midió el
flujo real de cada acción frecuente contra el ideal ("elegir + confirmar,
sin pasos de más") y se revisaron mensajes, valores por defecto y accesos
directos. Producción y la carga de una venta simple ya estaban al nivel
ideal (receta/producto → confirmar, con valores por defecto sensatos) — no
necesitaron cambios. Se encontraron y corrigieron 2 problemas reales:

### Corregido
- **Bug de precio pegado al producto anterior** (Ventas, Pedidos, Compras):
  al elegir un producto/ingrediente en una fila del carrito, el precio se
  autocompletaba — pero si después se cambiaba la elección por otra, el
  precio viejo quedaba pegado en vez de actualizarse, mostrando un total
  incorrecto sin ningún aviso. Ahora el precio siempre sigue a la elección
  actual.
- **Fricción real en Pedidos**: el cliente es obligatorio para crear un
  pedido, pero si todavía no estaba cargado no había forma de agregarlo sin
  cancelar, ir a Clientes, crearlo, y volver a empezar el pedido de cero
  (perdiendo los productos ya cargados). Ahora hay un botón "➕ Nuevo
  cliente" al lado del selector, que abre un alta rápida (nombre + teléfono)
  sin salir del formulario del pedido — el cliente recién creado queda
  seleccionado al toque.

## [Sin versionar] — Rediseño de la vista del cliente
Pase de diseño enfocado en la experiencia de compra (catálogo, carrito,
checkout) — la vista de administración no cambió.

### Corregido
- La tienda le mostraba al cliente el nombre interno de la herramienta
  ("Franthina Manager") en vez del nombre del negocio. Ahora usa
  `APP_CONFIG.storeName` ("Franthina Repostería"), separado de `appName`
  (que sigue siendo el nombre del admin) — se ve en el encabezado, el pie,
  el título de la pestaña del navegador y el hero.
- Bug de especificidad CSS: `.product-card__media span` (pensado para el
  ícono de reemplazo) sin querer también le pegaba a la etiqueta de
  categoría de la tarjeta, agrandándola de más. Se separó en su propia
  clase (`.product-card__media-icon`) en vez de forzarlo con `!important`.

### Agregado
- **Borde festoneado** (`.scallop-divider`) entre el hero y el catálogo —
  la firma visual de la tienda, evoca el borde de una fuente de pastelería
  o la tapa de una caja de repostería.
- Hero con acento en tipografía script ("Franthina") sobre el título
  principal, con un fondo cálido en degradé.
- Tarjetas de producto: etiqueta de categoría, ícono de reemplazo con
  fondo degradé (en vez de un emoji suelto), elevación e ingreso animado
  y escalonado al cargar la página (respeta `prefers-reduced-motion` del
  sistema operativo, no solo el interruptor manual de Configuración — ver
  abajo).
- **Selector de cantidad "− n +"** (`components/qtyStepper.js`), en
  reemplazo del campo numérico suelto, tanto en el catálogo como en el
  carrito — más cómodo de tocar en el celular.
- Carrito: miniatura de cada producto, total destacado en un bloque de
  color de marca, formulario de datos agrupado en una tarjeta con
  encabezado.
- `design-system/tokens.css`: además del interruptor manual de "Animaciones
  reducidas" en Configuración, ahora también se respeta
  `prefers-reduced-motion` del sistema operativo aunque la persona nunca
  haya entrado a esa pantalla.

## [0.22.0] — Integración con WhatsApp
Siguiente paso del roadmap: conectar la tienda y los Pedidos con WhatsApp,
sin necesitar ninguna API ni backend — son links `wa.me` (WhatsApp
Click-to-Chat): el navegador abre WhatsApp con el número y el mensaje ya
cargados, y una persona lo confirma y lo manda a mano. Nunca se envía nada
automáticamente.

### Agregado
- `core/whatsapp.js`: helper `buildWhatsAppLink(telefono, mensaje)`.
- **Tienda pública**: al confirmar una compra, si el negocio configuró su
  WhatsApp (ver abajo), aparece un botón "Enviar pedido por WhatsApp" con
  el resumen (productos, total, fecha de entrega, nombre) ya redactado.
- **`/admin/pedidos`**: cada fila de la tabla tiene un botón 💬 para
  escribirle al cliente por WhatsApp (si tiene teléfono cargado), con un
  mensaje que resume los productos, el total y el estado del pedido.
- **Configuración**: nueva sección "Datos del negocio" para cargar el
  número de WhatsApp una sola vez (`core/state.js`,
  `business.whatsappNumber`, persistido igual que las preferencias de
  accesibilidad).

## [Sin versionar] — Fotos de producto con vista previa, filtro de categorías colapsable
### Corregido
- **Fotos que no cargaban en la tienda**: la causa más común es pegar el
  link "Compartir" de Google Drive, que apunta a una página de vista previa
  y no a la imagen en sí — un `<img src>` no puede mostrar eso. Ahora
  `core/utils.js` (`normalizeImageUrl`) detecta ese patrón de URL y lo
  convierte automáticamente al formato que sí funciona, tanto al guardar el
  producto como al mostrar fotos que ya se habían guardado con el link viejo.

### Agregado
- `modules/products/`: vista previa en vivo de la foto en el formulario —
  apenas se pega un link se intenta cargar ahí mismo, y si no es una imagen
  válida se avisa al toque (antes había que guardar el producto y entrar a
  la tienda para descubrirlo). También se sumó ayuda explícita sobre qué
  tipo de link funciona (Imgur, o el link "para ver" de Drive — no el de
  "Compartir").
- Filtro de categorías de la tienda ahora colapsado por defecto: se ve solo
  un chip con la categoría actual ("Todas ▾"); al tocarlo se despliegan
  todas las categorías, y elegir una vuelve a colapsar la lista.

## [0.19.0] — Tienda pública + separación Tienda / Administración
Primera versión con una tienda pública de verdad, separada del sistema de
gestión. Nada del admin existente se tocó ni se eliminó — se movió detrás
de `/admin` y se le sumó una tienda nueva en `/`.

**Importante sobre seguridad**: esto es una separación de *rutas*, no de
*permisos*. `/admin` sigue siendo una URL más, sin login — cualquiera que
la conozca puede entrar. La protección real (login + roles) es una versión
futura del roadmap; por ahora, no compartas el link de `/admin` públicamente.

### Agregado
- **Tienda pública** (`modules/store-catalog/`, `modules/store-cart/`):
  - Catálogo (`/`) con filtro por categoría, mostrando nombre, descripción,
    foto, precio y disponibilidad de cada producto activo — nunca el costo,
    el margen, ni el stock exacto (ver `product.model.js`, comentario en
    `Product.costPrice`/`Product.notes`).
  - Carrito (`/carrito`), persistido en el propio navegador del visitante
    (`core/storeCart.js`, no pasa por el sistema de colecciones del admin).
  - Checkout: al confirmar, busca (por teléfono/email) o crea el Cliente, y
    crea un Pedido real a través de `orderService` — el mismo Pedido que
    ya se ve en `/admin/pedidos`, con estado "Pendiente" (no descuenta stock
    hasta que se marca como entregado desde el admin, igual que un pedido
    cargado a mano).
- `modules/products/`: dos campos nuevos, opcionales — `description` (texto
  para la tienda) e `imageUrl` (link a una foto). El campo `active` ahora
  también controla si el producto se ve en la tienda pública, además de su
  uso previo en el admin.
- `core/config.js`: `ROUTES.STORE_HOME` (`/`) y `ROUTES.STORE_CART`
  (`/carrito`).

### Cambiado
- **Todas las rutas del admin ahora viven bajo `/admin`** (antes `/`,
  `/productos`, etc. — ahora `/admin`, `/admin/productos`, etc.). Un solo
  cambio en `core/config.js` (`ROUTES`) alcanzó para todo el admin, porque
  ya estaba centralizado ahí.
- `app.js`: reestructurado para sostener dos "zonas" (tienda y admin) con
  un único Router y un único nodo `<main>` que nunca se recrea — evita
  crear más de una instancia de Router (que acumularía listeners de
  navegación del navegador) al cruzar entre zonas.
- `404.html`: ya no asume rutas de un solo nivel — ahora soporta rutas
  anidadas como `/admin/productos` sin romperse al refrescar la página.

## [Sin versionar] — Pruebas a fondo + modo offline
Tercera y última etapa de pulido post-v0.18 (Robustez ✓ → Accesibilidad ✓ →
Pruebas a fondo ✓).

### Corregido
- **Bug real e importante en el modo offline** (`service-worker.js`): la
  estrategia era "cache primero, para siempre" — una vez que un archivo
  (`app.js`, cualquier módulo) quedaba guardado en el caché del navegador,
  se seguía sirviendo esa misma copia indefinidamente sin volver a chequear
  el servidor, sin importar cuántas actualizaciones se subieran a GitHub
  Pages después. Cambiado a **network-first** para todo el código de la app
  (HTML/JS/CSS/JSON): siempre intenta traer la versión más nueva primero, y
  solo usa la copia guardada si no hay conexión a internet. Los íconos/
  imágenes siguen siendo cache-first (cambian poco, no vale la pena pedirlos
  de nuevo cada vez). También se subió la versión de caché (`v1` → `v2`)
  para que quienes ya habían visitado el sitio antes limpien la copia vieja
  una única vez.

### Verificado
- **Sintaxis**: se revisó cada archivo `.js` del proyecto (no solo los
  tocados en este pase) — cero errores.
- **Lógica de negocio real**, con un harness en Node puro que simula
  `localStorage` (no se pudo correr el test suite oficial de
  `tests/integration/`: requiere `jsdom`, y este entorno no tiene acceso a
  internet para instalarlo — si vos podés correrlo desde tu PC con
  `cd tests && npm install && npm test`, es un chequeo extra que vale la
  pena hacer):
  - Cálculo de margen de producto.
  - Rechazo de producto sin nombre / con precio negativo.
  - Detección de nombre duplicado (la misma lógica que usa el Controller).
  - Detección de stock bajo en ingredientes (con y sin alerta).
  - Cálculo de costo de receta a partir del costo real de sus ingredientes.
  - Rechazo de cliente sin nombre.
  - Alta y baja de productos.
  - Los 12 chequeos pasaron correctamente.

## [Sin versionar] — Accesibilidad: foco atrapado, teclado, errores anunciados
Segunda de tres etapas de pulido post-v0.18 (Robustez ✓ → Accesibilidad →
Pruebas a fondo). La base de a11y ya era sólida (skip-link, `:focus-visible`,
`aria-live` en toasts, headers de tabla ordenables con `<button>` real) —
se corrigieron 3 gaps concretos.

### Corregido
- **Los modales no atrapaban el foco de verdad** (`components/modal.js`,
  afecta a los ~15 formularios y a todos los diálogos de confirmación de la
  app): con teclado, Tab se escapaba hacia el sidebar y otros elementos
  ocultos detrás del fondo oscuro. Ahora Tab/Shift+Tab quedan atrapados
  dentro del modal mientras está abierto.
- **El menú ☰ en mobile no era navegable por teclado** (`app.js`): al
  abrirlo no movía el foco adentro, Escape no lo cerraba, y Tab se escapaba
  igual que en los modales. Ahora: al abrir, el foco va al primer link;
  Escape cierra y devuelve el foco al botón ☰; Tab queda atrapado dentro del
  menú mientras está abierto.
- **Errores de formulario invisibles para lectores de pantalla** (los 11
  módulos con formularios): el texto de error se mostraba en rojo junto al
  campo, pero sin `aria-invalid` ni `aria-describedby` — un lector de
  pantalla no anunciaba nada al llegar a un campo inválido. Ahora cada campo
  inválido queda correctamente anunciado y asociado a su mensaje de error.

### Agregado
- `components/dataTable.js`: `aria-sort` en el `<th>` de la columna
  ordenada, y el `aria-label` del botón de orden ahora indica el estado
  actual ("Ordenado por Nombre, ascendente...") en vez de un genérico
  "Ordenar por Nombre" que no reflejaba si ya estaba activo.

## [Sin versionar] — Robustez: errores de guardado, doble-envío en modales
Primera de tres etapas de pulido post-v0.18 (Robustez → Accesibilidad →
Pruebas a fondo). Validaciones y confirmaciones ya estaban bien cubiertas en
todos los módulos — se revisaron y no necesitaron cambios. Se encontraron y
corrigieron dos gaps reales:

### Agregado
- `core/errors.js`: nueva clase `StorageError`, con mensaje específico y
  accionable para cuando el navegador no puede guardar (sin espacio
  disponible, o bloqueado por una pestaña de incógnito/privada) — antes
  cualquier fallo de `localStorage.setItem` cascadeaba al mensaje genérico
  "Ocurrió un problema inesperado", sin decirle al usuario qué hacer.
- `core/storage/LocalStorageAdapter.js`: si se detectan datos corruptos al
  leer una colección, ahora se avisa una vez por sesión con un toast (antes
  se descartaban en silencio y la sección aparecía vacía sin explicación).

### Corregido
- **Doble-envío en modales** (`components/modal.js`, afecta a los ~15
  formularios de la app por igual, ya que todos pasan por `openModal`): un
  doble-tap rápido en "Guardar"/"Confirmar" — común en pantallas táctiles —
  podía disparar la acción dos veces antes de que la primera terminara,
  pudiendo crear un registro duplicado (por ejemplo, una venta repetida que
  descuenta stock dos veces). Ahora los botones del pie del modal se
  deshabilitan apenas se hace clic, hasta que la acción termina.

## [Sin versionar] — Fix: la página se veía "cortada" y había que scrollear a la derecha en celular
Causa real: CSS Grid no permite que un ítem de grid (`.app-main`, dentro de
`.app-shell`) se achique más allá del contenido más ancho que tenga adentro,
a menos que se le indique lo contrario (`min-width` implícito es `auto`, no
`0`). En pantallas angostas, eso "empujaba" toda la página hacia la derecha
en vez de dejar que el contenido interno (tablas, filas) scrollee por su
cuenta como estaba pensado.

### Corregido
- `.app-shell`, `.app-sidebar` y `.app-main`: agregado `min-width: 0`, para
  que puedan achicarse al ancho real de la pantalla en vez de heredar el
  ancho de su contenido más ancho.
- `html, body`: agregado `overflow-x: hidden` como red de seguridad general,
  para que ningún elemento (presente o futuro) pueda volver a generar scroll
  horizontal de la página completa.
- `body`: agregado `overflow-wrap: break-word` (heredado por todo el texto
  de la app), para que un texto largo sin espacios (un email, una URL) se
  corte de línea en vez de forzar desborde horizontal.

## [Sin versionar] — Pulido v0.18: búsqueda, estados vacíos e íconos
Antes de arrancar v0.19 (separación tienda/administración), un pase de
pulido sobre lo que ya existe.

### Corregido
- **Bug de foco en los buscadores** (Productos, Ingredientes, Recetas,
  Clientes, Proveedores): al escribir, cada tecleo terminaba redibujando la
  página completa — incluida la propia caja de búsqueda — así que el campo
  perdía el foco y el texto escrito se borraba solo cada ~250ms. Ahora la
  búsqueda solo redibuja la región de la tabla (`renderXTable()`, nuevo, se
  extrajo del renderer de página completa); la caja de búsqueda nunca se
  destruye mientras se escribe.
- El término buscado ahora se mantiene visible en el campo si la tabla se
  vuelve a pintar por otro motivo (ej. ordenar una columna mientras hay una
  búsqueda activa) — antes se perdía.

### Agregado
- `core/utils.js`: `emptyStateMessage(term, baseMessage)` — distingue el
  mensaje de "todavía no cargaste nada" del de "no encontramos resultados
  para tu búsqueda", que antes eran el mismo texto (confuso: sugería crear
  el primer registro aunque ya hubiera datos, solo que la búsqueda no
  encontró coincidencias).
- `apple-touch-icon` en `index.html`, para que el logo de Franthina se vea
  bien al "Agregar a pantalla de inicio" en iOS.

## [Sin versionar] — Fix: botón ☰ tapaba el título y el logo
El botón hamburguesa (`position: fixed`, arriba a la izquierda) quedaba
flotando encima del contenido en vez de dejarle lugar: tapaba el `<h1>` de
cada sección cuando el menú estaba cerrado, y tapaba el logo/nombre de la
app cuando el menú estaba abierto.

### Cambiado
- `.app-main` ahora reserva espacio arriba (`padding-top`) en pantallas
  chicas para que el título de cada sección no quede debajo del botón ☰.
- El botón ☰ ahora se oculta mientras el menú está abierto (`app.js`,
  `setupSidebarToggle`) en vez de quedar superpuesto al logo; el menú se
  sigue pudiendo cerrar tocando afuera o eligiendo una sección.

## [Sin versionar] — Pase de responsividad mobile en toda la app
Los fixes anteriores (menú y scroll del sidebar) resolvían la navegación,
pero el resto de la interfaz seguía teniendo varios puntos que se rompían o
se veían apretados en pantallas chicas. Este es un barrido general.

### Cambiado (design-system/components.css — afecta a todos los módulos)
- `.row` ahora envuelve (`flex-wrap: wrap`) por defecto. Esta única clase
  utilitaria se usa en decenas de lugares (headers, pares de campos,
  filas de ítem de Ventas/Pedidos/Compras/Recetas, listas de reportes), así
  que el cambio arregla de una sola vez todos los layouts que antes se
  comprimían en una sola línea ilegible en mobile.
- Filas de ítem (`[data-item-row]`, usadas en Ventas, Pedidos, Compras y
  Recetas: producto/ingrediente + cantidad + precio) apilan cada campo a
  ancho completo debajo de los 640px, en vez de aplastarse los 3-4 juntos.
- `.tabs` (usado en Reportes) ahora scrollea horizontalmente en vez de
  desbordar la pantalla cuando no entran las 6 pestañas.
- `.app-main`, `.modal`/`.modal-backdrop` y `.toast-region` reducen su
  padding/posición bajo los 480px para aprovechar mejor el ancho disponible
  en celulares chicos (320-375px).

## [Sin versionar] — Fix: menú de navegación inaccesible en celular
El botón hamburguesa (`#sidebar-toggle`) existía en el HTML pero nunca se
mostraba en pantallas chicas ni tenía lógica para abrir el menú: quedaba con
`display:none` fijo y sin listener de click, dejando el sidebar (que en mobile
se esconde fuera de pantalla) completamente inalcanzable. Bug preexistente,
no introducido por los cambios de GitHub Pages.

### Agregado
- `.sidebar-backdrop` en `design-system/components.css`: fondo oscuro que
  aparece detrás del menú en mobile y permite cerrarlo tocando afuera.
- `setupSidebarToggle()` en `app.js`: abre/cierra el sidebar al tocar el
  botón hamburguesa y sincroniza `aria-expanded` para accesibilidad.

### Cambiado
- El botón hamburguesa ahora se controla por CSS (`.sidebar-toggle`, visible
  solo bajo 1023px) en vez de un `style="display:none"` inline sin forma de
  revertirse.
- El cierre del menú al navegar (`interceptInternalLinks`) ahora también
  oculta el backdrop y actualiza `aria-expanded` (antes solo quitaba
  `is-open` del sidebar).
- `.app-sidebar` en mobile (`position: fixed`) ahora tiene `overflow-y: auto`:
  antes, con más de ~9 secciones en el menú, las últimas quedaban cortadas
  fuera del viewport y no había forma de scrollear para tocarlas.

## [Sin versionar] — Compatibilidad con GitHub Pages
### Agregado
- `core/basePath.js`: resuelve rutas lógicas de la app contra el subdirectorio
  real de despliegue (necesario para project sites de GitHub Pages, servidos
  bajo `/nombre-repo/` en vez de la raíz del dominio).
- `404.html`: redirige a `index.html` preservando la ruta pedida, para que
  entrar directo o refrescar en una ruta interna no rompa (GitHub Pages no
  soporta reescritura de rutas del lado del servidor).
- Sección "Publicar en GitHub Pages" en el README con los pasos de despliegue.

### Cambiado
- `core/router.js` ahora traduce el pathname real del navegador a una ruta
  lógica (vía `stripBase`) antes de hacer el matching de rutas.
- `app.js` construye los `href` de navegación con `withBase` y registra el
  service worker con una ruta relativa en vez de absoluta.
- `service-worker.js` y `manifest.json` usan rutas relativas al scope real
  en vez de rutas absolutas (`/...`), para funcionar también bajo un
  subdirectorio.
- `modules/not-found/index.js`: el link "Volver al inicio" ahora usa
  `withBase` en vez de un `href="/"` fijo.

## [0.18.0-mvp] — Búsqueda y orden en el resto de los módulos transaccionales
Completa la ronda de UX de ordenamiento/búsqueda iniciada en v0.17, ahora
sobre Ventas, Pedidos, Compras, Inventario y Caja.

### Agregado
- **Ordenamiento de columnas**: Ventas (fecha, total), Pedidos (entrega,
  total), Compras (fecha), Inventario (fecha, cantidad), Caja (hora, monto)
  — mismo mecanismo genérico (`sortRows`/`bindTableSorting`) ya construido
  en v0.17, sin código nuevo en el componente compartido.
- **Buscador**: Ventas y Pedidos por nombre de cliente, Compras e
  Inventario por nombre de ingrediente/proveedor — mismo patrón
  (`normalizeForSearch`) que ya tenían Productos, Ingredientes, Recetas,
  Clientes y Proveedores.
- Se evitó a propósito marcar como ordenables columnas calculadas que no
  son un campo directo del registro guardado (`balance` en Pedidos, `total`
  en Compras) — mismo cuidado que evitó el bug de `marginPct` en v0.17;
  ordenar por un valor derivado que no existe todavía en el dato crudo da
  un resultado sin sentido.

### Nota operativa: recuperación de un reinicio del entorno
El entorno de trabajo se reinició a mitad de esta ronda, perdiendo el
directorio de trabajo con los cambios todavía no empaquetados. Se
recuperó restaurando el último zip completo y verificado (v0.17, 135/135)
y rehaciendo los cambios de esta ronda desde el propio historial de la
conversación. Ningún cambio se perdió, pero quedó como recordatorio de por
qué cada ronda de este proyecto termina con un zip empaquetado y no solo
con archivos sueltos en el entorno de trabajo.

### Revisado
- Test de integración: 135/135 sin cambios (ronda de interacción de UI, sin
  lógica de negocio nueva que probar a nivel Service).
- Ronda completa de sintaxis, imports, violaciones renderer→Service, y DAG
  de la capa de Service — sin hallazgos.

## [0.17.0-mvp] — Ordenamiento de tablas + 2 violaciones de arquitectura reales

### Agregado
- **Ordenamiento de columnas real** en `components/dataTable.js`
  (`sortRows`, `bindTableSorting`) — el propio comentario del archivo decía
  "búsqueda, orden" desde el principio, pero el ordenamiento nunca se había
  construido. Aplicado a Productos, Ingredientes, Recetas y Proveedores
  (click en el encabezado de una columna ordenable, con flecha indicando
  dirección).
- **Buscador agregado donde faltaba**: Ingredientes, Recetas y Proveedores
  no tenían — ahora los 5 catálogos maestros (+ Clientes) lo tienen, mismo
  patrón (`normalizeForSearch`, insensible a mayúsculas y tildes).

### Corregido (bugs reales encontrados armando el ordenamiento)
- **Detección de duplicados con alcance incorrecto**: en Productos e
  Ingredientes, el chequeo de nombre duplicado comparaba contra la lista ya
  filtrada por la búsqueda, no contra la lista completa — si buscabas algo
  que no aparecía en los resultados visibles, un duplicado real podía no
  detectarse. Corregido: la detección de duplicados siempre usa la lista
  completa, sin filtrar, independientemente de qué haya quedado visible en
  pantalla.
- **Dos violaciones de arquitectura**: `product.renderer.js` e
  `ingredient.renderer.js` importaban su propio `Service` para calcular un
  valor derivado (`marginPct`, `lowStock`) dentro del renderer — lo que
  además rompía el ordenamiento por esas columnas, porque el valor no
  existía todavía en el dato crudo al momento de ordenar. Se movió el
  cálculo al Controller (antes de ordenar), y el Renderer ya no importa
  ningún Service — documentado como regla dura en `docs/ARCHITECTURE.md`.

### Revisado
- Test de integración ampliado de 129 a 135 verificaciones: `sortRows()`
  con strings, números, valores `null` (siempre al final) y confirmación de
  que no muta el array original.
- Nuevo chequeo automático agregado a la ronda de revisión: "¿algún
  renderer importa un Service?" — encontró las dos violaciones de arriba,
  y ahora corre en cada ronda futura.

## [0.16.0-mvp] — Inicio de la etapa UX: menos clics, navegación por teclado
A partir de una revisión de arquitectura de alto nivel. Se documentaron las
invariantes de negocio (pedido concreto) y se arrancó la etapa de UX que
tanto esa revisión como el propio ROADMAP marcaban como el siguiente paso.

### Agregado
- `docs/BUSINESS-RULES.md`: 16 invariantes de negocio explícitas ("esto
  nunca debe poder pasar"), cada una con dónde se garantiza en código y
  dónde se prueba — todas ya estaban implementadas, lo que faltaba era
  declararlas como reglas en un solo lugar.
- **Enter para confirmar un modal**: presionar Enter en cualquier `input` o
  `select` dentro de un modal dispara el botón principal (evita el viaje al
  mouse para confirmar formularios cortos como Cliente, Ingrediente,
  Proveedor). Nunca se intercepta dentro de un `textarea` (debe seguir
  insertando un salto de línea), ni dentro de una línea de carrito
  (Ventas/Recetas/Pedidos/Compras) — ahí confirmaría la operación completa
  a mitad de camino de cargar un ítem, que sería una regresión, no una mejora.
- **Foco automático en filas de carrito nuevas**: al tocar "Agregar
  producto/ingrediente" en Ventas, Recetas, Pedidos o Compras, el foco salta
  directo al selector de la fila recién creada — antes había que ir a
  buscarla con el mouse cada vez.

### Evaluado y no adoptado (con razón)
- Separación completa de "dato" y "evento" (event sourcing): ya existe
  parcialmente (Ingredientes/Caja tienen historial de movimientos); llevarlo
  a Productos/Recetas también es una reescritura de fondo sin un problema
  concreto que la justifique hoy — documentado en `docs/BUSINESS-RULES.md`.
- Property-based testing (miles de registros aleatorios): es una inversión
  de infraestructura de testing, y esta ronda es explícitamente sobre bajar
  el ritmo de infraestructura para pasar a UX.

### Revisado
- Test de integración: 129/129 sin cambios (esta ronda fue de interacción
  de UI, no de lógica de negocio — no había nada nuevo que probar a nivel
  Service).
- Ronda completa de sintaxis, imports y disponibilidad HTTP.

## [0.15.0-mvp] — Conversión de unidades + métricas de test por versión

### Agregado
- **Conversión de unidades** (`core/units.js`): masa (g↔kg) y volumen (ml↔l),
  diseño extensible por dimensión (agregar una unidad nueva a una dimensión
  existente es un solo número, no una matriz de conversiones cruzadas).
  Aplicada en Recetas (cada línea puede cargarse en cualquier unidad
  compatible con la del ingrediente — el ejemplo motivador: ingrediente
  stockeado en kg, receta cargada en gramos) y en Producción (factibilidad
  y consumo de ingredientes ya convertidos). Mezclar dimensiones (masa con
  volumen) se bloquea al guardar la receta, con mensaje claro.
- El selector de unidad de cada línea de receta se repuebla automáticamente
  según el ingrediente elegido (solo muestra unidades de su misma dimensión).
- `docs/METRICS.md`: registro liviano de tests por versión (verificaciones,
  módulos cubiertos, errores encontrados, tiempo de ejecución) — no un
  framework de cobertura, a propósito (ver el razonamiento en el propio
  documento). El test de integración ahora imprime su tiempo de ejecución
  al final de cada corrida.
- `docs/ROADMAP.md` ampliado con la hoja de ruta sugerida hasta v1.0.

### Revisado
- Test de integración ampliado de 119 a 129 verificaciones: el ejemplo
  exacto de la conversión de unidades (Harina 25kg → receta 180g →
  producción, verificando que el stock baje exactamente 0.18kg), más
  pruebas directas de `convertUnit()`/`areCompatibleUnits()` incluyendo el
  caso de error (no se puede convertir masa a volumen).
- Ronda completa de sintaxis, imports, y DAG de la capa de Service — sin
  ciclos nuevos (la conversión de unidades no agregó ninguna dependencia
  entre módulos, solo usa la utilidad `core/units.js`).

## [0.14.0-mvp] — Batería de QA: verificador de integridad + correcciones reales
A partir de un documento de control de calidad muy completo (16 categorías
de prueba). Se verificó cada punto contra el código real: algunos ya
funcionaban (confirmado con tests nuevos, no solo revisión), otros eran
gaps reales que se corrigieron, y el resto queda documentado en
`docs/ROADMAP.md` con la razón concreta de por qué se pospone.

### Agregado — el pedido principal del documento
- **Verificador de integridad de datos**: nueva pestaña "🩺 Integridad" en
  Reportes (`reportService.checkIntegrity()`). Recorre los 13 módulos
  buscando referencias rotas (producto→receta, receta→ingrediente,
  venta→producto, pedido→cliente, compra→proveedor, producción→receta),
  stock negativo, ids duplicados, y datos incompletos (producto sin
  categoría o con precio $0). Es de solo lectura, exportable a CSV, y
  explícitamente pensada como red de seguridad para el caso residual en que
  algo quede inconsistente pese a las guardas del Controller (por ejemplo,
  un dato tocado por fuera de la UI, o un backup importado de otra
  instalación) — ver `docs/ARCHITECTURE.md`.

### Corregido (gaps reales confirmados contra el código)
- **Búsqueda insensible a mayúsculas y tildes**: "Ázucar", "azucar" y
  "Azúcar" ahora se consideran equivalentes en Productos y Clientes
  (`normalizeForSearch()`, `core/utils.js`).
- **Nombres duplicados de Ingrediente/Producto**: "Harina", "harina" y
  "HARINA" ya no pueden crearse como registros separados por accidente —
  detección en el Controller (mismo patrón que las guardas de integridad
  referencial), no en el Service.
- **Movimiento manual de inventario que excedía el stock disponible**: antes
  se aceptaba en silencio y el stock quedaba clampeado en 0 sin avisar;
  ahora se rechaza con `InsufficientStockError`, igual que en Producción y Ventas.
- **Mismo ingrediente repetido dos veces en una receta**: ahora se rechaza,
  evita un doble conteo silencioso en el cálculo de costo.
- **Nombres sin límite de longitud**: máximo 200 caracteres en Productos,
  Ingredientes, Recetas, Clientes y Proveedores (validado y con `maxlength`
  en el input, no solo al guardar).

### Confirmado con tests nuevos (ya funcionaba, no hacía falta tocar código)
- Precios/cantidades negativas ya se rechazaban.
- El costo de una receta ya se recalcula en vivo cuando cambia el costo de
  un ingrediente (probado explícitamente: comprar Harina más cara sube el
  costo de la receta que la usa, sin tocar la receta).
- Importar el mismo backup dos veces seguidas no duplica registros
  (`restoreBackup()` siempre borra la colección completa antes de recrearla).
- El total del Dashboard coincide exactamente con la suma manual de las
  ventas del día.
- Decimales chicos (0.333 kg) no producen error de redondeo visible en el
  costo calculado.

### Deliberadamente pospuesto (documentado con razón en `docs/ROADMAP.md`)
- Conversión de unidades (kg↔g): es una feature real, no un bug puntual.
- Editar/eliminar una venta ya confirmada: append-only a propósito, mismo
  criterio que Inventario/Caja — la función correcta es "anular venta" con
  movimientos compensatorios, no un borrado silencioso.
- Validación registro-por-registro al importar un backup: el verificador de
  integridad ya cubre detectarlo después de importar.
- Precisión de montos con decimales extremos: limitación conocida de usar
  `number` de JS para dinero, no visible en uso normal.

### Revisado
- Test de integración ampliado de 99 a 119 verificaciones.
- Corregidos 2 bugs en el propio test durante esta ronda (no en la app): un
  orden de secciones que usaba `recipeService` antes de importarlo, y una
  comparación de substring en vez de nombre exacto — documentado como
  ejercicio de que revisar los propios tests con el mismo rigor importa.
- Ronda completa de sintaxis, imports, y DAG de la capa de Service —
  `reports` ahora depende de 11 módulos (todos los que existen salvo
  Configuración), sin ciclos.

## [0.13.0-mvp] — Rediseño del formulario de Ventas: vuelto en efectivo
A pedido explícito, con el ejemplo exacto usado como caso de prueba: 3
unidades a $500 c/u, pagan con $2000, vuelto $500.

### Cambiado
- Sacado el campo "Descuento ($)" del formulario de carga de ventas. Sigue
  existiendo en el modelo de datos (`discount`, fijo en `0` desde este
  formulario) por si se necesita para combos/promociones más adelante, pero
  ya no aparece ni se edita al cargar una venta.
- Cada línea del carrito ahora muestra el **subtotal en vivo** (cantidad ×
  precio unitario), no solo cantidad y precio por separado.
- Nuevo campo "¿Con cuánto paga?" (efectivo recibido), visible únicamente
  cuando el método de pago es Efectivo (se oculta para Tarjeta/Transferencia).
  Calcula el **vuelto en vivo**: verde si el monto alcanza, rojo mostrando
  cuánto falta si no alcanza.
- El Service ahora valida que el efectivo recibido cubra el total antes de
  confirmar la venta — si no alcanza, se bloquea con un mensaje claro en vez
  de guardar una venta con vuelto negativo.

### Agregado
- `calculateChange()` en `sale.model.js`: función pura, monto recibido menos
  total. `sale.amountReceived` se guarda en el registro de la venta.

### Revisado
- Test de integración ampliado de 93 a 99 verificaciones: el ejemplo exacto
  del usuario reproducido como caso de prueba, rechazo de monto insuficiente,
  y que el descuento del stock siga funcionando igual con el formulario
  rediseñado.
- `docs/module-sales.md` reescrita completa (tenía referencias a un método
  del Service ya renombrado hace 3 versiones, y a un módulo Pedidos que en
  ese momento no existía y ahora sí).
- `docs/STORAGE.md` actualizado con la forma real de la colección `sales`.

## [0.12.0-mvp] — Bug real: Producción no sumaba stock al Producto
A partir de reportes de uso real de la aplicación (no revisión de código).

### Corregido (bug crítico confirmado)
- **Producción nunca sumaba stock al Producto terminado.** `complete()`
  descontaba correctamente los ingredientes, pero jamás incrementaba el
  stock de ningún producto — aunque estuviera vinculado a la receta
  (`recipeId`). Resultado: producías, gastabas materia prima, y el producto
  seguía con el mismo stock de siempre, sin nada nuevo para vender. Ahora
  `complete()` suma `recipe.yieldQuantity × order.multiplier` unidades al
  stock de cualquier Producto vinculado a la receta, en la misma operación
  atómica que el descuento de ingredientes (todo o nada, con rollback si
  algo falla a mitad de camino). Nueva dependencia de Service
  `production -> products`, sin ciclo.
- Mensaje de confirmación de "Completar producción" corregido para describir
  ambos efectos (antes solo mencionaba el descuento de ingredientes).

### Investigado: "la caja no se puede cerrar si no coincide el monto"
Revisé el código de cierre de caja a fondo (validator, service, controller)
y **no hay ningún bloqueo por monto no coincidente** — el cierre siempre
acepta cualquier valor no negativo. Lo confirmé con un test nuevo que cierra
la caja con montos deliberadamente distintos al esperado (de menos y de
más): ambos casos cierran sin problema. La causa más probable de la
confusión: el resumen del cierre no diferenciaba visualmente un sobrante
de un faltante (ambos se veían con colores parecidos), lo que puede haber
dado la impresión de que algo estaba mal. Se corrige con el punto siguiente.

### Cambiado (mejora de UX pedida)
- Diferencia de caja ahora con color: **rojo (faltante)** cuando el monto
  contado es menor al esperado, **verde (sobrante o exacto)** cuando es
  mayor o igual — antes un sobrante se mostraba en amarillo/naranja
  ("warning"), lo cual no distinguía claramente "todo bien, sobró plata" de
  "hay un problema". Aplicado tanto en el resumen del cierre (`cashbox`)
  como en el Reporte de Caja (`reports`), que antes mostraba el número
  pelado sin ningún color.

### Revisado
- Test de integración ampliado de 85 a 93 verificaciones: cierre de caja
  con monto distinto al esperado (de menos y de más, incluyendo el color
  del badge resultante), y producción completa verificando que el stock del
  producto vinculado efectivamente sube (y que un producto sin receta
  vinculada no se ve afectado por una producción ajena).
- `docs/module-production.md` y `docs/module-cashbox.md` actualizados para
  describir el comportamiento real corregido.
- Chequeo de dependencias circulares re-confirmado tras agregar
  `production -> products`: sin ciclos.

## [0.11.1-mvp] — Logo real de marca
### Cambiado
- El logo circular oficial de Franthina (proporcionado por el usuario)
  reemplaza el ícono de cupcake genérico en: el favicon/ícono de pestaña,
  los íconos de instalación PWA (192px y 512px), y el wordmark del sidebar.
- El wordmark del sidebar ahora es un botón funcional: al hacer clic en el
  logo, navega al panel principal (mismo mecanismo que cualquier link
  interno de la app, `data-link` + `router.navigate()`), con estado hover y
  `aria-label="Ir al panel principal"` para lectores de pantalla.

### Corregido (bug real, arrastrado desde el rebrand de la v0.9.1)
- `manifest.json` y el `<meta name="theme-color">` de `index.html` seguían
  con los colores de la paleta vieja (marrón `#6B4226`) en vez de la paleta
  real de marca (`#7D2142`) — se actualizó ambos. Afectaba el color de la
  barra del sistema al instalar la app como PWA.

### Sin cambiar (a propósito)
- Los emojis 🧁 del ítem de navegación "Productos" y de la tarjeta
  correspondiente en el Dashboard se dejaron igual — son íconos temáticos
  genéricos, no representan la marca; reemplazarlos por el logo generaría
  un segundo botón "Home" confuso en la interfaz.

### Revisado
- Test de integración completo (85/85) sin cambios — esta ronda fue
  únicamente de assets e interfaz, ningún archivo de lógica de negocio
  tocado más allá de `app.js` (shell de la UI).

## [0.11.0-mvp] — Guardas de integridad referencial
A partir de una cuarta revisión externa, sobre auditoría, validaciones de
negocio y rendimiento.

### Ya existente, señalado con evidencia (no se tocó)
- "Impedir vender más stock del disponible" ya estaba resuelto desde Ventas
  v0.5 (`InsufficientStockError`).
- "Cuándo cambió" un registro ya se responde con `createdAt`/`updatedAt`
  automáticos en cada colección, desde el primer entregable.
- Rendimiento: revisado sin hallazgos — Dashboard ya paraleliza sus 8
  consultas con `Promise.all`, y no hay patrones de recorrido anidado
  sospechosos en el código existente.

### Agregado (el hallazgo real de esta ronda)
- **Guardas de integridad referencial**: no se puede eliminar una Receta
  vinculada a un Producto, ni un Ingrediente usado en una Receta. Antes de
  este cambio, borrar cualquiera de los dos dejaba una referencia rota
  silenciosa en otro módulo.
- La lógica de detección (`findProductsUsingRecipe`,
  `findRecipesUsingIngredient`) vive en el **Controller**, no en el
  `Service`, para no invertir las dependencias `products -> recipes` y
  `recipes -> ingredients` ya establecidas — documentado como patrón nuevo
  en `docs/ARCHITECTURE.md`, sección "Guardas de integridad referencial:
  Controller, no Service".
- El chequeo automático de dependencias circulares se refinó para separar
  la capa de `Service` (regla dura: debe ser un DAG) de la capa de
  `Controller`/`Renderer` (lecturas de UI, permitidas más libremente) — la
  versión anterior del chequeo marcaba como "ciclo" algo que en realidad
  era una lectura de interfaz legítima.

### Deliberadamente NO agregado (y por qué)
- Sistema de auditoría/historial de cambios (quién, qué campo, valor
  anterior): "quién" no tiene respuesta significativa sin autenticación
  real (hoy hay un único usuario implícito); construir el historial
  genérico ahora sería infraestructura especulativa, la misma que se viene
  evitando en todo el proyecto. Documentado en `docs/ROADMAP.md`.
- Optimización de rendimiento: no hay problema medido que optimizar.

### Revisado
- `docs/module-ingredients.md` reescrita (estaba desactualizada, hablaba de
  "futuros módulos" que ya están construidos hace varias versiones).
- Test de integración ampliado de 81 a 85 verificaciones: las dos guardas
  nuevas, probadas como funciones puras extraídas del Controller.
- `docs/ROADMAP.md` reescrito completo — tenía una sección "Fase 3"
  duplicada de una edición anterior.

## [0.10.0-mvp] — Consolidación de constantes + vínculo Producto↔Receta
A partir de una tercera revisión externa. Como en rondas anteriores, se
separó lo que ya existía (señalado con evidencia) de lo que era un aporte
real.

### Ya existente, señalado con evidencia (no se tocó)
- `docs/STORAGE.md` (contratos de datos) y `docs/EVENTS.md` (catálogo de
  eventos) ya existían desde hace 2 versiones.
- La preparación para IndexedDB ya existe en `core/storage/index.js` (patrón
  factory) — cambiar `APP_CONFIG.storageAdapter` alcanza, sin tocar módulos
  de negocio. No se implementó el adaptador en sí porque no hace falta
  todavía.

### Agregado
- **Vínculo Producto ↔ Receta** (el hallazgo real de esta ronda): un
  producto puede vincularse opcionalmente a una receta (`recipeId`), y
  sincronizar su `costPrice` con el costo actual de esa receta mediante
  `productService.syncCostFromRecipe()` — acción explícita del usuario
  (botón), nunca automática. Nueva dependencia legítima `products -> recipes`
  (sin ciclo: Recetas nunca conoce Productos).
- `core/constants/storageKeys.js`: consolida `COLLECTIONS` (antes en
  `collections.js`) y el nuevo `META_KEYS` (claves de valores sueltos:
  `a11yPrefs`, `schemaVersion`, antes dispersas en `config.js` y
  `migrations.js`).
- Eventos `backup:exported` y `backup:restored`, emitidos desde
  `core/backup.js`.

### Deliberadamente NO agregado (y por qué)
- `currencies.js`, `permissions.js`, `roles.js`, `dates.js`: mismo criterio
  YAGNI de siempre — no hay contenido real para poner en ellos todavía
  (una sola moneda, sin sistema de autenticación).
- Mover `ROUTES` (`core/config.js`) y `EVENTS` (`core/eventBus.js`) a
  `constants/`: ya están centralizados donde están: cada catálogo vive junto
  a la pieza que lo implementa. Moverlos hubiera tocado ~20 archivos por una
  preferencia de organización, sin resolver ninguna duplicación real.

### Revisado
- Test de integración ampliado de 78 a 81 verificaciones: sincronización de
  costo producto-receta (incluyendo el caso de error cuando no hay receta
  vinculada), y ajuste de las aserciones que asumían un solo producto.
- Verificación específica de que `products -> recipes` no introduce una
  dependencia circular — sin hallazgos, el grafo de 13 módulos sigue limpio.
- `docs/ARCHITECTURE.md`, `docs/STORAGE.md`, `docs/module-products.md`
  actualizados para reflejar la nueva dependencia y la consolidación de
  constantes.

## [0.9.1-mvp] — Identidad visual real de Franthina
A partir del flyer oficial de la marca (Feria Salamanca). Solo cambios de
diseño — ningún archivo de lógica de negocio se tocó, confirmado corriendo
el test de integración completo antes y después (78/78 sin cambios).

### Cambiado
- Paleta de colores reemplazada en `design-system/tokens.css` por la del
  flyer real: blush cremoso de fondo, rosa vivo (`#E0568C`) como acento
  principal, bordó/vino profundo (`#7D2142`) para texto de marca, dorado
  tostado como acento secundario. Como toda la interfaz ya consumía
  variables semánticas (nunca colores sueltos), el cambio de paleta no
  requirió tocar ningún componente ni módulo — solo `tokens.css`.
- Tipografía: Fredoka (títulos, tratamiento bold-redondeado como "FERIA"
  en el flyer) + Nunito (cuerpo de texto, alta legibilidad) + Mrs Saint
  Delafield (script, reservada exclusivamente al wordmark de marca en el
  sidebar — nunca en texto funcional, para no comprometer accesibilidad).
- Tema oscuro y modo alto-contraste actualizados a la nueva paleta
  vino/rosa (antes estaban calculados sobre la paleta marrón anterior).

### Agregado
- `docs/BRAND.md`: identidad de marca documentada como fuente de verdad,
  incluyendo qué elementos del flyer (banderines, ilustraciones,
  cuadrillé) deliberadamente no se trasladaron a la interfaz, y por qué.

## [0.9.0-mvp] — Reportes: cierre del ROADMAP comercial original
### Agregado
- Módulo Reportes: 5 reportes (Ventas, Producción, Inventario, Caja,
  Compras) agregados por rango de fechas, cada uno consultando el Service
  público del módulo correspondiente — nunca su storage directo. Es la
  única excepción documentada al patrón de 6 archivos por módulo: no tiene
  `model.js` ni `validator.js` porque no existe una entidad "Reporte" que
  crear o validar, solo agregación de solo lectura.
- `core/csv.js`: utilidad de exportación a CSV en JS puro, sin librerías
  externas — cubre "llevar los datos a Excel" sin agregar una dependencia.
- `docs/module-reports.md`, incluyendo la explicación honesta de qué no se
  hizo (PDF/Excel, reporte de rentabilidad dedicado) y por qué.

### Revisado
- Test de integración ampliado de 70 a 78 verificaciones: los 3 reportes
  con datos reales generados durante el propio test (ventas, producción,
  compras) dan los totales y agrupaciones correctos, y `buildCsv()` escapa
  correctamente comas y comillas.
- Ronda completa de sintaxis, imports, límite de `localStorage` y
  dependencias circulares — sin hallazgos. El grafo de dependencias de los
  13 módulos sigue sin ciclos.

Con este módulo se completa el ROADMAP comercial planteado desde la v0.1:
los 13 módulos que administran el negocio de punta a punta (Compras →
Inventario/Ingredientes → Recetas → Producción → Ventas/Pedidos → Caja →
Reportes) están construidos, conectados y probados.

## [0.8.1-mvp] — Documentación: STORAGE.md y DATA-FLOW.md
No hubo cambios de código en esta versión — solo dos documentos nuevos,
generados a partir del código real (no descriptos de memoria):
- `docs/STORAGE.md`: forma de las 13 colecciones y los 2 valores sueltos
  (`schemaVersion`, `a11yPrefs`), generado leyendo cada `*.model.js`.
- `docs/DATA-FLOW.md`: el recorrido real de una acción concreta (crear una
  venta) a través de UI → Controller → Validator → Service → Storage →
  Renderer, con archivo y responsabilidad de cada paso, más la explicación
  de por qué algunas conexiones entre módulos son llamada directa y otras
  son evento por el `eventBus` (no es inconsistencia, es una decisión
  explicada en `docs/ARCHITECTURE.md`).

## [0.8.0-mvp] — Pedidos, Proveedores y Compras: núcleo comercial completo
Con esta entrega, el ciclo de negocio completo de Franthina funciona de
punta a punta: Compras → Inventario/Ingredientes → Recetas → Producción →
Ventas/Pedidos → Caja.

### Agregado
- Módulo Pedidos: a diferencia de Ventas (pago y entrega inmediatos), admite
  seña al crear (reflejada en Caja automáticamente), saldo pendiente, fecha
  de entrega futura, y `markDelivered()` con la misma garantía todo-o-nada
  con rollback que ya tenía Ventas. Puede vincularse opcionalmente a una
  orden de Producción.
- Módulo Proveedores: CRUD simple, mismo patrón que Clientes.
- Módulo Compras: cada línea genera un movimiento de entrada en Inventario
  y actualiza el costo del ingrediente al precio pagado — todo o nada con
  rollback. Recetas recalcula su costo automáticamente con el nuevo precio,
  sin que Compras conozca a Recetas.
- `cashboxService.registerAutoMovement()`: generalización de lo que antes
  era `registerSaleMovement()` (específico de Ventas), ahora reutilizado
  también por Pedidos (seña y saldo). Sin wrapper de compatibilidad — se
  actualizó el único caller existente en vez de dejar código muerto.
- Dashboard ampliado con pedidos pendientes.
- `docs/module-orders.md`, `docs/module-suppliers.md`, `docs/module-purchases.md`.

### Corregido (bug real encontrado durante el test de integración)
- `order.service.js`: `create()` no forzaba `status: ORDER_STATUS.PENDING`
  en el registro guardado, a diferencia de como sí lo hace
  `production.service.js`. Un pedido nuevo (tanto desde el test como desde
  el formulario real, que tampoco envía `status`) quedaba con
  `status: undefined` — lo que ocultaba los botones de "Entregar"/"Cancelar"
  en la tabla, porque la condición `row.status === ORDER_STATUS.PENDING`
  nunca daba verdadero. Encontrado por el test de integración antes de
  llegar a producción, no por inspección manual del código.

### Revisado
- Test de integración ampliado de 58 a 70 verificaciones: proveedor + compra
  con verificación de que Inventario, el costo del ingrediente y el costo
  de la receta se actualizan en cadena; pedido completo con seña, entrega,
  saldo y verificación de los movimientos de Caja generados en cada paso.
- Ronda completa de sintaxis, imports, límite de `localStorage`,
  violaciones de arquitectura y dependencias circulares — el grafo de
  dependencias entre los 12 módulos sigue sin ciclos y coincide con lo
  documentado en cada uno.
- Confirmado que `core/backup.js` incluyó automáticamente las 3 colecciones
  nuevas sin ningún cambio de código — pago directo de haber centralizado
  el catálogo de colecciones en la ronda anterior.

## [0.7.0-mvp] — Ronda de fortalecimiento técnico
A partir de una segunda revisión externa, antes de continuar con Pedidos y
Compras. Se implementó lo que tenía valor concreto y se documentó
explícitamente por qué se dejó afuera lo que no (`docs/ARCHITECTURE.md`).

### Agregado
- `core/validators.js`: primitivas de validación compartidas
  (`isNonEmptyString`, `isPositiveNumber`, `isNonNegativeNumber`,
  `isValidEmail`, `isValidDateString`, `isOneOf`). Los 8 `*.validator.js` del
  proyecto se refactorizaron para usarlas en vez de repetir la misma
  comparación (`.trim().length < 2`, etc.) en cada módulo.
- `AppError` en `core/errors.js`: clase base de la que heredan
  `ValidationError`, `NotFoundError` e `InsufficientStockError`. Fija
  `this.name` automáticamente al nombre de la subclase — una subclase nueva
  ya no puede olvidarse de setearlo y quedar sin traducción amigable.
- `core/storage/atomicRun.js`: helper de "todo o nada con rollback" para
  operaciones que escriben en más de un registro. Conectado en los dos
  lugares reales que lo necesitan: `production.service.js` (al completar una
  orden) y `sale.service.js` (al confirmar una venta) — si un paso falla a
  mitad de camino, los pasos ya aplicados se revierten automáticamente
  (movimiento de inventario compensatorio, restauración del stock previo).
- `docs/EVENTS.md`: catálogo completo de eventos del `eventBus`, generado
  leyendo los `emit`/`on` reales del código (no de memoria), con quién emite
  cada uno y quién escucha.
- `docs/ARCHITECTURE.md` ampliado con el razonamiento detrás de cada
  decisión de esta ronda, incluyendo por qué se usa versionado entero
  secuencial para las migraciones en vez de SemVer.

### Deliberadamente NO agregado (y por qué)
- Un `storage.transaction()` genérico: sobre `localStorage` no puede ofrecer
  aislamiento real, y sería una promesa a medias. Se resolvió el problema de
  fondo (operaciones multi-paso sin rollback) con `atomicRun.js`, acotado a
  los dos casos reales que existen hoy.
- SemVer para las migraciones: es la convención para paquetes publicados que
  otros consumen como dependencia; no aplica a un esquema de datos interno.
  Ver el razonamiento completo en `docs/ARCHITECTURE.md`.

### Revisado
- Test de integración ampliado de 50 a 58 verificaciones: rollback atómico
  (falla simulada a mitad de una secuencia de pasos, verifica que se
  deshacen exactamente los pasos ya aplicados), `AppError`/`ValidationError`,
  y las primitivas de `core/validators.js`.
- Ronda completa de sintaxis, imports rotos, límite de `localStorage`,
  violaciones de arquitectura y disponibilidad HTTP — sin hallazgos.

## [0.6.0-mvp] — Capa de datos: migraciones, backup y correcciones de arquitectura
A partir de una revisión externa del proyecto. Se separan los aportes reales
de los pedidos de scaffolding especulativo (ver `docs/ARCHITECTURE.md`,
sección "Por qué no hay carpetas vacías para módulos futuros").

### Agregado
- `core/constants/collections.js`: catálogo único de nombres de colección.
  Cada `*.model.js` ahora re-exporta desde acá en vez de declarar el string
  localmente — elimina el riesgo de un typo silencioso en un nombre de colección.
- `core/storage/migrations.js`: runner de migraciones de esquema versionado.
  Catálogo vacío por ahora (el esquema actual es v1), pero funcional y
  documentado — se ejecuta en cada arranque antes de que cualquier módulo
  toque datos.
- `core/backup.js`: exportación e importación completa de los datos de la
  aplicación como un único JSON, recorriendo el catálogo de colecciones.
  Conectado a la UI en Configuración ("Exportar datos" / "Importar datos"),
  con confirmación explícita antes de restaurar (operación destructiva).
- `core/storage/StorageAdapter.js` y `LocalStorageAdapter.js`: nuevos métodos
  `getMeta`/`setMeta` para valores sueltos (versión de esquema, preferencias),
  sin necesidad de tocar localStorage directamente desde ningún otro archivo.
- `docs/ARCHITECTURE.md`: documenta la convención de nombres de archivo (ya
  existía en la práctica, ahora está escrita como regla) y el estado de cada
  pieza de la capa de datos transversal.
- `tests/integration/`: reorganizado bajo una subcarpeta (antes era un único
  archivo suelto en `tests/`), con `tests/README.md` explicando por qué
  `unit/` y `e2e/` todavía no existen.

### Corregido (bugs reales encontrados en esta revisión)
- **`core/logger.js`**: escribía los logs con `window.localStorage.setItem()`
  directo (sin el prefijo de la app), pero los leía con `storage.getAll()`
  (que sí aplica el prefijo) — dos claves distintas, así que los logs nunca
  persistían de verdad entre sesiones. Ahora usa exclusivamente la fachada de
  storage. Bug real, no cosmético: significaba que el sistema de auditoría
  nunca había funcionado.
- **`core/state.js`**: leía y escribía las preferencias de accesibilidad con
  `window.localStorage` directo, violando la propia regla de la arquitectura.
  Ahora usa `storage.getMeta`/`setMeta`, con una hidratación async explícita
  al arrancar (`store.hydrateA11yPrefs()`, llamada desde `app.js` antes del
  primer render).
- Ambos bugs, y las dos correcciones, quedaron como tests de regresión en
  `tests/integration/integration.test.mjs`.

### Revisado
- Nuevo chequeo automático: ningún archivo fuera de `core/storage/` puede
  tocar `localStorage` — corre en cada ronda de revisión junto con sintaxis,
  imports rotos, violaciones de arquitectura y disponibilidad HTTP.
- Test de integración ampliado de 40 a 50 verificaciones (migraciones,
  backup con roundtrip completo incluyendo integridad referencial entre
  colecciones, y las dos regresiones de este changelog).

## [0.5.1-mvp] — Prueba general de integración
### Agregado
- `tests/integration.test.mjs`: primer test de integración de extremo a
  extremo del proyecto. Ejecuta el código real de `core/` y `modules/`
  (no una reimplementación) contra un DOM simulado, encadenando los 9
  módulos como lo haría un uso real: crear ingredientes → armar una receta
  → planificar y completar producción → verificar el movimiento generado en
  Inventario → crear producto y cliente → abrir caja → vender → cerrar caja
  con arqueo → verificar que el Dashboard agregue todo correctamente.
  40 verificaciones, todas en verde.

### Encontrado y corregido durante esta prueba
- El primer intento de la prueba reportó un fallo real. Al investigarlo, el
  error estaba en la prueba (un ingrediente de test con un stock que en
  realidad no calificaba como "bajo" según sus propios datos), no en la
  aplicación — quedó documentado y corregido en el propio test, junto con un
  ingrediente dedicado para probar esa regla sin interferir con los cálculos
  de la receta que comparte.
- Se confirmó con datos reales el comportamiento "todo o nada" de Producción
  y Ventas: ninguna de las dos operaciones toca el stock si falta algo, y
  ambas informan exactamente qué falta.

## [0.5.0-mvp] — Ventas y Caja
### Agregado
- Módulo Caja: máquina de estados (cerrada → abierta → movimientos → arqueo
  → cerrada), con una única sesión abierta a la vez, movimientos manuales
  (ingreso/egreso) y automáticos (ventas), y cálculo de diferencia al cierre.
- Módulo Ventas: carrito de productos dinámico con autocompletado de precio,
  verificación de stock todo-o-nada antes de confirmar, descuento automático
  de stock de producto, y reflejo automático del ingreso en Caja si hay una
  sesión abierta (opcional: la venta se concreta igual sin caja abierta).
- Nueva clase `InsufficientStockError` reutilizada entre Producción y Ventas.
- Dashboard ampliado con ventas del día y estado de caja (abierta/cerrada).

### Revisado
- Corregido un bloque de código con `void` innecesarios en
  `cashbox.controller.js` (quedó de un primer borrador); ahora el cierre de
  caja muestra correctamente el resumen del arqueo en un modal.
- Verificación de dependencias circulares entre módulos con un chequeo
  automático del grafo de imports — sin ciclos. El grafo resultante
  (`sales → cashbox, customers, products`; `production → recipes, inventory,
  ingredients`; etc.) coincide exactamente con lo documentado en cada módulo.
- Ronda completa de sintaxis, imports rotos, violaciones de arquitectura y
  disponibilidad HTTP de todos los archivos del proyecto.

## [0.4.0-mvp] — Clientes
### Agregado
- Módulo Clientes: CRUD completo, búsqueda instantánea, validación (nombre
  obligatorio + al menos un dato de contacto), utilidad `isBirthdaySoon()`
  lista para un futuro widget de Dashboard.
- Dashboard ampliado con el conteo total de clientes.

### Revisado
- Limpieza de un `import()` dinámico redundante en `product.controller.js`
  (el módulo ya estaba importado arriba; quedó de una iteración anterior).
- Ronda completa de verificación: sintaxis de todos los `.js`, resolución de
  imports, violaciones de arquitectura entre módulos, TODOs residuales, y
  disponibilidad HTTP 200 de absolutamente todos los archivos del proyecto
  (JS, CSS, HTML, JSON) servidos localmente.

## [0.3.0-mvp] — Producción
### Agregado
- Módulo Producción: planificación de lotes a partir de una receta, con vista
  previa en vivo de factibilidad (compara lo necesario contra el stock actual
  de cada ingrediente antes de confirmar).
- Al completar una orden, descuenta stock automáticamente creando movimientos
  de salida en Inventario — operación todo-o-nada: si falta algún ingrediente,
  no se ejecuta ningún movimiento.
- Nueva clase `InsufficientStockError` en `core/errors.js` con mensaje
  amigable que detalla qué ingredientes faltan.
- Dashboard ampliado con el conteo de órdenes de producción pendientes.

### Revisado
- Sintaxis, resolución de imports y disponibilidad HTTP de los 6 archivos
  nuevos del módulo, con el mismo proceso de verificación de rondas anteriores.
- Chequeo automático de que ningún módulo importe el `renderer` o `controller`
  interno de otro módulo (solo `index.js` o el `Service` público) — sin
  violaciones encontradas.
- Limpieza de un import duplicado con alias innecesario en `production.renderer.js`.

## [0.2.0-mvp] — Recetas e Inventario
### Agregado
- Módulo Recetas: CRUD con líneas de ingredientes dinámicas, costeo automático
  en vivo (total y por unidad), versionado simple por edición.
- Módulo Inventario: registro de movimientos (entrada/salida/ajuste/merma) con
  actualización automática y consistente del stock del ingrediente afectado.
- Dashboard ampliado con el conteo de recetas cargadas.
- Service worker mejorado: ahora cachea también los módulos visitados
  dinámicamente (no solo el shell inicial), mejorando el soporte offline real.
- Documentación de la decisión de diseño sobre el stock de Ingredientes
  (`docs/module-inventory.md`).

### Revisado
- Verificación automática de sintaxis en los 46 archivos `.js` del proyecto.
- Verificación de que todos los imports relativos resuelven a archivos reales.
- Prueba de carga de todos los recursos estáticos vía servidor HTTP local (sin 404).
- Corrección de un bug en el formulario de Recetas: el selector de ingrediente
  no preseleccionaba el valor correcto al editar una receta existente.
- Limpieza de código muerto en `components/confirm.js`.

## [0.1.0-mvp] — Entrega inicial
### Agregado
- Arquitectura base: router propio, storage abstraction (localStorage),
  state management, event bus, manejo centralizado de errores, logger.
- Design System completo con paleta Franthina y sistema de accesibilidad
  (tamaño de fuente, contraste, espaciado, animaciones, tema claro/oscuro).
- Biblioteca de componentes: botón, input, modal, confirm, toast, tabla,
  badges, tabs, skeleton.
- Módulos funcionales: Dashboard, Productos, Ingredientes, Configuración.
- PWA básica: manifest.json + service worker con cache del app shell.
- Documentación de arquitectura y roadmap de módulos futuros.
