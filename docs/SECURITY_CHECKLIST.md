# Checklist de seguridad — verificación manual contra Supabase real

Esto existe porque `docs/ROADMAP.md` señala que faltan "tests de seguridad
(RLS) y end-to-end" automáticos. Construir esa infraestructura (un
entorno de test con credenciales de varios roles simulados contra
Supabase, o un navegador real tipo Playwright) es una obra en sí misma —
y el propio ROADMAP dice explícitamente que no conviene levantar
infraestructura transversal sin un caso de uso concreto delante. Mientras
tanto, esto es lo pragmático: cada `.sql` de esta sesión ya trae su propia
sección "Verificación (opcional)" comentada — este archivo las junta todas
en un solo lugar, en orden, para correrlas a mano contra tu proyecto real
de Supabase después de aplicar las migraciones. Tildá cada una.

Cómo usarlo: para las pruebas "con cuenta de rol X", necesitás una cuenta
de prueba real con ese rol asignado (Configuración → Usuarios con acceso,
desde v0.30). Para las que dicen "SQL Editor", usá el editor de Supabase
con `set role authenticated; set request.jwt.claim.sub = '<uuid>';` o
simplemente logueado como esa cuenta desde la app.

---

## v0.29.2 — Auditoría a prueba de suplantación
`franthina_schema_v029_2_audit_fix.sql`

- [ ] Con una cuenta que no sea la tuya, insertá un log de auditoría con un
      `userEmail` inventado en el campo `data`. Confirmá que la fila
      guardada tiene tu email real, no el inventado.

## v0.30 — Gestión de roles
`franthina_schema_v030_roles.sql`

- [ ] Con una cuenta `admin`, cambiá el rol de otra cuenta desde
      Configuración → Usuarios con acceso. Tiene que guardar sin error.
- [ ] Con una cuenta `employee` o `manager`, confirmá que Configuración ni
      siquiera aparece en el menú.
- [ ] Con esa misma cuenta, andá directo a `/admin/configuracion` escribiendo
      la URL a mano. Tiene que redirigir al Dashboard, no mostrar la pantalla.
- [ ] Con una cuenta `employee`, intentá cambiar tu propio rol manipulando
      el `<select>` desde la consola del navegador (si llegaras a verlo).
      El trigger del lado del servidor tiene que rechazarlo igual.

## v0.30.1 — DELETE restringido a admin/manager
`franthina_schema_v030_1_delete_permissions.sql`

- [ ] Con una cuenta `employee`, confirmá que el botón "Eliminar" no
      aparece en Productos, Ingredientes, Recetas, Clientes, Proveedores
      ni Producción.
- [ ] Con esa misma cuenta, intentá borrar un producto llamando a
      `supabase.from('products').delete().eq('id', '<uuid>')` directo
      desde la consola del navegador. Tiene que fallar por RLS.
- [ ] Con una cuenta `admin` o `manager`, el mismo borrado tiene que seguir
      funcionando normal — confirmá que no se rompió nada para los roles
      que sí deberían poder.

## v0.31.0 — Venta atómica
`franthina_schema_v031_sale_concurrency.sql`

- [ ] Con un producto de stock = 1, abrí dos pestañas con dos cuentas
      distintas. Empezá una venta de esa unidad en ambas casi al mismo
      tiempo. Solo una tiene que confirmarse; la otra tiene que fallar con
      "Sin stock suficiente" — nunca las dos, ni un stock final negativo.

## v0.31.1 — Producción atómica
`franthina_schema_v031_1_production_concurrency.sql`

- [ ] Mismo escenario que arriba, pero con dos órdenes de producción
      planificadas que comparten un ingrediente con stock justo para una.
- [ ] Completá la MISMA orden dos veces seguidas, rápido (doble clic). La
      segunda tiene que fallar (la orden ya no está "planned"), no
      duplicar el consumo de ingredientes.

## v0.31.2 — Precio del checkout calculado en el servidor
`franthina_schema_v031_2_public_order_price.sql`

- [ ] Desde la tienda pública (sin sesión), completá un pedido normal. El
      total en `/admin/pedidos` tiene que coincidir con el precio real de
      cada producto.
- [ ] Con la consola del navegador abierta durante el checkout, intentá
      llamar a `orderService.create()` a mano con un `unitPrice` inventado
      antes del envío normal. Confirmá que el pedido real que llega a
      administración usa el precio del servidor, no el inventado.
- [ ] **Pendiente de cerrar del todo** (ver la nota al final del propio
      `.sql`): probá si todavía se puede insertar un pedido con precio
      arbitrario llamando directo a
      `supabase.from('orders').insert({...})` sin pasar por
      `create_public_order()`. Si funciona, hay que restringir esa
      política de INSERT — recién ahí este punto queda 100% cerrado.

---

Si alguno de estos falla, es información valiosa en sí misma — decíme cuál
y seguimos desde ahí, en vez de asumir que todo lo de esta sesión quedó
perfecto a la primera sin haberlo visto correr contra un Supabase real.
