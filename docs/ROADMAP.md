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
  de la tienda aparece automáticamente en `/admin/pedidos`. Sin login
  todavía — `/admin` es una URL más, no un área protegida de verdad; eso es
  la v0.24 del roadmap original (ver más abajo). Esto reemplazó al plan
  original de "v0.19 — Simulador de costos y precios" (ver más abajo), que
  se corrió a una versión futura por decisión de producto.
- ✅ **v0.22 — WhatsApp** (`core/whatsapp.js`, links `wa.me` — sin API ni
  backend, cada envío lo confirma una persona a mano desde WhatsApp): al
  confirmar una compra, la tienda le ofrece al cliente un botón para
  mandarle el resumen del pedido al negocio; desde `/admin/pedidos`, cada
  fila tiene un botón para escribirle al cliente con el resumen y estado de
  su pedido. El número de WhatsApp del negocio se configura una vez en
  Configuración (`core/state.js`, `business.whatsappNumber`).

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

Con el núcleo comercial y sus guardas de integridad ya cubiertos, lo que
más valor agrega ahora es: mejorar experiencia de uso real (probar los
formularios y flujos a mano, no solo la lógica), sumar funcionalidades que
resuelvan problemas concretos del día a día de la pastelería, y ampliar la
cobertura de tests a medida que aparezcan esas funcionalidades — no seguir
construyendo infraestructura transversal sin un caso de uso concreto
delante.

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
