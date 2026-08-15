# ROADMAP — Franthina Manager

Este documento sigue el mismo proceso que pide el brief original: antes de
implementar, se analiza el problema, se piensa la arquitectura y recién
después se programa.

## Ya construido
- ✅ Arquitectura base: router, storage abstraction (con migraciones y
  backup), state, eventBus, errors tipados, logger
- ✅ Design System con la identidad visual real de Franthina (paleta,
  tipografía) + accesibilidad (tamaño de fuente, contraste, tema claro/oscuro)
- ✅ Biblioteca de componentes: botón, input, modal, toast, confirm, tabla, badges
- ✅ 13 módulos de negocio: Dashboard, Productos (vinculable a Recetas),
  Ingredientes, Recetas, Inventario, Producción, Clientes, Ventas, Caja,
  Pedidos, Proveedores, Compras, Reportes
- ✅ Guardas de integridad referencial: no se puede borrar una receta usada
  por un producto, ni un ingrediente usado en una receta
- ✅ Verificador de integridad de datos ("🩺 Integridad" en Reportes):
  referencias rotas, stock negativo, ids duplicados, datos incompletos
- ✅ Detección de nombres duplicados (Ingredientes, Productos) y búsqueda
  insensible a mayúsculas/acentos, en toda la app
- ✅ Conversión de unidades (masa g/kg, volumen ml/l) en Recetas y
  Producción — costo y consumo se convierten automáticamente
- ✅ Registro liviano de métricas de test por versión (`docs/METRICS.md`)
- ✅ PWA básica (manifest + service worker con cache del shell y de módulos visitados)
- ✅ Test de integración de extremo a extremo (119 verificaciones) contra el
  código real del proyecto
- ✅ Publicación en GitHub Pages, con soporte de subdirectorio (project site),
  modo offline network-first, y un pase de responsividad mobile en toda la app
- ✅ **v0.19 — Tienda pública**, separada de la Administración: `/` es ahora
  un catálogo público (categoría, foto, descripción, precio, disponibilidad
  — nunca costo ni stock exacto) con carrito y checkout, y todo el sistema
  de gestión existente se movió intacto detrás de `/admin`. El checkout crea
  un Pedido real (mismo `orderService` que usa el admin), así que un pedido
  de la tienda aparece automáticamente en `/admin/pedidos`. En ese momento
  todavía sin login (llegó en v0.25, ver más abajo). Esto reemplazó al plan
  original de "v0.19 — Simulador de costos y precios" (ver más abajo), que
  se corrió a una versión futura por decisión de producto.
- ✅ **v0.22 — WhatsApp** (`core/whatsapp.js`, links `wa.me` — sin API ni
  backend, cada envío lo confirma una persona a mano desde WhatsApp): al
  confirmar una compra, la tienda le ofrece al cliente un botón para
  mandarle el resumen del pedido al negocio; desde `/admin/pedidos`, cada
  fila tiene un botón para escribirle al cliente con el resumen y estado de
  su pedido. El número de WhatsApp del negocio se configura una vez en
  Configuración (`core/state.js`, `business.whatsappNumber`).
- ✅ **v0.23 — Auditoría UX**: se midió el flujo real de las acciones más
  frecuentes (Ventas, Pedidos, Compras, Producción) contra el ideal
  "elegir + confirmar, sin pasos de más". Se corrigió un bug de precio que
  no se actualizaba al cambiar de producto/ingrediente elegido, y se agregó
  un alta rápida de cliente sin salir del formulario de Pedidos.
- ✅ **v0.25 — Base de datos en la nube + login real** (Supabase): los datos
  pasaron de localStorage a una base real, con `/admin` protegido por sesión
  (`core/auth.js`, `core/router.js` — guard de rutas). `CloudStorageAdapter`
  implementa la misma interfaz que `LocalStorageAdapter`, así que ningún
  Service tuvo que cambiar. Seguridad a nivel de fila (RLS): todo requiere
  sesión, salvo crear un pedido/cliente desde la tienda (checkout de
  invitado) y leer el catálogo público — nunca costo, notas, ni stock exacto.
- ✅ **v0.26 — Migración**: herramienta en Configuración para subir a la nube
  los datos que hayan quedado en el celular de antes de conectar Supabase.
- ✅ **v0.27 — Usuarios, primer paso**: tabla `profiles` (un perfil por
  usuario, con un rol) y una tarjeta en Configuración que lista quién tiene
  acceso. A propósito **sin** aplicar restricciones por rol todavía — eso
  sigue siendo trabajo pendiente (ver "Prioridad inmediata" más abajo).
- ✅ **v0.29 — Auditoría**: registro de acciones importantes (eliminar,
  cambiar precio, cancelar pedido) en `system_logs`, visible en
  Reportes → Auditoría. De solo agregar: ni un admin puede editar o borrar
  un registro una vez creado.
- ✅ **v0.29.1 — Correcciones de seguridad**, tras una revisión: los
  usuarios nuevos ya no son administradores por defecto (quedan "pending"
  hasta que un admin les asigne un rol a mano), nadie puede otorgarse un rol
  a sí mismo, y la configuración pública del negocio (hoy: WhatsApp) se
  separó de la configuración administrativa completa, con el mismo patrón
  de función pública que ya usaba el catálogo.
- ✅ **v0.30 — Roles y permisos, primer paso**: UI para asignar rol desde
  Configuración (antes solo se podía a mano en SQL), y un modelo de
  permisos por rol (`core/permissions.js`) que sí tiene efecto — oculta
  Reportes/Configuración y "Eliminar" según corresponda, con el Router
  bloqueando esas rutas del lado del cliente aunque se pidan a mano. Sigue
  siendo una capa de experiencia, no la barrera real — ver "Roles con
  restricciones reales" en "Próximo enfoque recomendado" para lo que falta.

## El núcleo comercial completo ya está cubierto

Compras alimenta Inventario e Ingredientes → Recetas calcula su costo con
esos ingredientes → Productos puede sincronizar su costo con la receta →
Producción fabrica consumiendo Inventario → Ventas/Pedidos venden lo
producido → Caja registra cada movimiento de dinero → Reportes agrega todo.
Ningún módulo de este ciclo conoce los detalles internos de otro.

## Fase 3 — Robustez del núcleo (evaluado, no todo se hace ahora)

- ✅ **Validaciones de negocio más allá de campos vacíos**: ya resuelto —
  stock insuficiente bloquea Ventas/Producción/Pedidos
  (`InsufficientStockError`), y borrar una Receta/Ingrediente en uso está
  bloqueado (ver `docs/ARCHITECTURE.md`, "Guardas de integridad referencial").
- 🟡 **Auditoría**: hoy cada registro ya tiene `createdAt`/`updatedAt`
  automáticos (responde "cuándo"), y Recetas tiene un contador de versión
  simple. Lo que falta — "qué cambió exactamente" (diff de campos) y "quién"
  — se deja para cuando exista un sistema de usuarios real: sin
  autenticación, "quién" no tiene una respuesta significativa (hoy hay un
  único usuario implícito), y construir un historial de cambios genérico
  ahora sería la misma infraestructura especulativa que se viene evitando
  a propósito en todo el proyecto.
- ✅ **Rendimiento**: revisado, sin hallazgos por ahora — el Dashboard ya
  consulta sus 8 fuentes en paralelo (`Promise.all`), y las búsquedas usan
  `Map` en vez de recorridos anidados. No se optimiza sin un problema medido.

## Fase 4 — Lo que sigue (menor prioridad, sin urgencia)

- **Conversión de unidades extendida a Compras/Inventario**: hoy la
  conversión (`core/units.js`) alcanza a Recetas y Producción — el caso que
  motivó la feature. Compras e Inventario todavía asumen que toda cantidad
  ya está en la unidad del ingrediente. Extenderla ahí es la misma
  utilidad, aplicada al mismo patrón de formulario (selector de unidad +
  conversión antes de guardar) — se hace cuando aparezca la necesidad real
  de cargar una compra en una unidad distinta a la de stock.
- **Editar/eliminar una venta ya confirmada** (¿la caja se actualiza? ¿vuelve
  el stock?): hoy no existe, a propósito — ventas, movimientos de Inventario
  y de Caja son append-only, mismo criterio que un movimiento contable real
  (una corrección se hace con un movimiento nuevo, nunca reescribiendo el
  pasado). Si hace falta "deshacer" una venta, la función correcta a
  construir es un flujo explícito de "anular venta" que genere los
  movimientos compensatorios (reponer stock, registrar el retiro en Caja),
  no un borrado silencioso — más parecido a cómo `runAtomic()` ya revierte
  Producción/Compras a mitad de camino.
- **Validación de cada registro al importar un backup**: `restoreBackup()`
  hoy valida la forma general del archivo (que sea JSON, que tenga
  `schemaVersion`, que las colecciones sean conocidas) pero no vuelve a
  correr `validateProduct`/`validateIngredient`/etc. registro por registro
  — un backup corrupto o de otra instalación podría insertar datos que la
  UI nunca hubiera dejado cargar. El verificador de integridad
  (`reportService.checkIntegrity()`) es la red de seguridad para detectar
  esto después de importar; validar antes de insertar sería más seguro
  pero es una pieza más grande de trabajo, pospuesta hasta que haya un caso
  real de un backup corrupto.
- **Precisión de montos con muchos decimales o valores extremos**: los
  precios se guardan como `number` de JavaScript (punto flotante), no como
  enteros en centavos — es el enfoque más simple y ya wired en toda la app,
  pero tiene el límite de precisión típico de floats. No es un problema
  visible con montos de uso normal (se confirmó con un test específico:
  0.333kg × $300 no muestra error de redondeo), pero sería una
  consideración real si el negocio empezara a manejar montos muy grandes o
  con muchos decimales de precisión.
- **Multiusuario / roles / SaaS**: requiere autenticación real, que hoy no existe.
- **Sincronización en la nube**: requiere un `RestApiAdapter` sobre la
  interfaz `StorageAdapter` ya existente — no requiere cambiar ningún módulo
  de negocio.
- **IndexedDB**: la interfaz `StorageAdapter` ya está lista para un
  `IndexedDBAdapter` — se implementa cuando el volumen de datos lo justifique.
- **Integraciones externas** (Mercado Pago, WhatsApp, impresoras térmicas,
  AFIP/ARCA): sin diseñar en detalle hasta que haya una necesidad concreta.
- **Reporte de rentabilidad real**, **exportación a PDF**: ver
  `docs/module-reports.md`.
- Papelera de reciclaje, undo/redo, comandos rápidos (Ctrl+K), plantillas de
  recetas/producción, modo kiosco para ferias, calculadora integrada, y las
  funciones de IA mencionadas en el brief original.

## Próximo enfoque recomendado

Antes de sumar más funcionalidades, hay una lista corta y concreta de
seguridad/robustez que quedó pendiente de una revisión (parte ya corregida
en v0.29.1, ver "Ya construido"):

- ✅ **Concurrencia real**: resuelto para Ventas en **v0.31.0** y para
  Producción en **v0.31.1** — ver `franthina_schema_v031_sale_concurrency.sql`
  y `franthina_schema_v031_1_production_concurrency.sql`. El resto de las
  operaciones (Compras sumando stock, apertura/cierre de Caja) siguen sin
  este tratamiento; se resuelven si aparece evidencia real de que hacen
  falta — con un solo negocio y pocas personas operando a la vez, el
  riesgo práctico hoy es bajo.
- 🟡 **Precio y stock del checkout, calculados en el servidor**: resuelto
  a medias en **v0.31.2**. `create_public_order()` ya recalcula el precio
  real del lado del servidor — el checkout público ya no confía en lo que
  mandó el navegador. Falta el último paso: restringir la política de
  INSERT directo en `orders` para que `anon` no pueda insertar una fila a
  mano sin pasar por esa función (alguien hablándole a la API REST de
  Supabase directamente, no a través de la app). No se hizo a ciegas en la
  misma pasada — se cierra en cuanto esté confirmado que el checkout
  público funciona bien en producción con el cambio nuevo.
- ✅ **Roles con restricciones reales**: resuelto en **v0.30** (UI +
  permisos de cliente) y **v0.30.1** (la barrera real: políticas RLS
  restrictivas de `delete` en las 11 tablas de negocio, sin tocar ninguna
  política existente — ver `franthina_schema_v030_1_delete_permissions.sql`).
- 🟡 **Tests de seguridad (RLS) y end-to-end**: los tests actuales (ver
  `tests/`) cubren muy bien la lógica de negocio pura, pero no verifican
  automáticamente que un visitante sin sesión no pueda leer lo que no debe,
  o que el flujo completo tienda→pedido funcione de punta a punta en un
  navegador real. Como paso intermedio (v0.31.3), `docs/SECURITY_CHECKLIST.md`
  junta todas las verificaciones manuales de RLS de esta ronda de trabajo
  (v0.29.2 a v0.31.2) en un solo lugar para correrlas a mano contra un
  Supabase real. No reemplaza tests automatizados — es la versión
  pragmática mientras no haya un caso de uso concreto que justifique
  levantar infraestructura de test contra RLS/e2e con navegador real,
  que es justamente lo que dice el punto de abajo que no conviene hacer
  todavía.

Fuera de esa lista, lo que más valor agrega es lo de siempre: probar los
flujos a mano, sumar funcionalidades que resuelvan problemas concretos del
día a día, y ampliar tests a medida que aparecen — no construir
infraestructura transversal sin un caso de uso concreto delante.

## Hoja de ruta sugerida (v0.16 en adelante)

Orden propuesto, sujeto a revisarse versión a versión según lo que la UX
real termine mostrando que hace falta primero:

- **v0.16 — UX**: menos clics para registrar una venta, formularios más
  rápidos, mejor navegación. Es la etapa donde más vale probar la app a
  mano (no solo con tests) — un test de integración no detecta "esto tarda
  4 clics que debería tardar 2".
- **v0.17 — Producción inteligente**: avisos de faltantes conectados a
  `productionService.checkFeasibility()` (que ya existe), consumo estimado.
- **v0.18 — Reportes avanzados**: estadísticas de costos y rentabilidad
  real (cruzando Ventas con el costo de receta de lo vendido — ver
  `docs/module-reports.md`).
- **v0.19 — Simulador de costos y precios** *(plan original, superado —
  ver "Ya construido": v0.19 terminó siendo la Tienda pública)*: variar el
  precio de un ingrediente o el precio de venta y ver el impacto antes de
  aplicarlo de verdad. Sigue siendo una buena idea para una versión futura
  — es una extensión natural de `recipeService.calculateCost()`, que ya es
  una función pura.
- **v1.0 — Estabilización**: corrección de errores, rendimiento,
  documentación final. Con `docs/METRICS.md` ya llevando el conteo de
  tests por versión, esta etapa tiene una forma objetiva de medir si
  "estabilización" realmente significa menos bugs encontrados por ronda.

## Decisión pendiente de aprobación: TypeScript
El brief original reconsidera usar TypeScript en lugar de JavaScript puro.
Es una decisión válida (detección temprana de errores, refactors más
seguros), pero requiere un paso de compilación que hoy este proyecto no
tiene — es 100% estático, sin build. Recomendación: quedarse con JSDoc
(ya usado en todo el código para tipar sin compilar) mientras el proyecto
sea de un solo desarrollador, y migrar cuando se sume un equipo o el
proyecto crezca lo suficiente como para que el costo del build se justifique.
