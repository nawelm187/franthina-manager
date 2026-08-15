-- ============================================================
-- FRANTHINA MANAGER — v0.31.2: precio del checkout, calculado en el servidor
-- ============================================================
-- Corre esto después de franthina_schema_v031_1_production_concurrency.sql.
--
-- El problema (ver docs/ROADMAP.md): store-cart.controller.js arma el
-- pedido con el precio que el propio navegador calculó — sellPrice viene
-- de un fetch real a Supabase al cargar la página, así que la app en uso
-- normal siempre muestra el precio correcto. Pero nada impide que alguien
-- con la consola del navegador abierta llame directo a orderService.create()
-- con un unitPrice inventado antes de mandarlo. Hoy el riesgo práctico es
-- bajo (todo pedido queda "Pendiente" y un humano lo revisa antes de
-- cobrar o entregar), pero conviene cerrarlo ya, con el mismo patrón que
-- ya se usó para Ventas y Producción.
--
-- create_public_order() recibe SOLO productId + quantity por cada línea —
-- nunca un precio — y calcula el total leyendo el sellPrice real de cada
-- producto en el momento de crear el pedido.
-- ============================================================

create or replace function public.create_public_order(
  customer_id uuid,
  items jsonb,          -- [{ "productId": "...", "quantity": 2 }, ...] — SIN precio
  delivery_date text,
  notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  product_row public.products%rowtype;
  unit_price numeric;
  computed_items jsonb := '[]'::jsonb;
  computed_total numeric := 0;
  new_order public.orders%rowtype;
begin
  for item in
    select (elem->>'productId')::uuid as product_id, (elem->>'quantity')::numeric as quantity
    from jsonb_array_elements(items) as elem
  loop
    select * into product_row from public.products where id = item.product_id;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', item.product_id;
    end if;
    if coalesce((product_row.data->>'active')::boolean, true) is false then
      raise exception 'PRODUCT_NOT_AVAILABLE:%', (product_row.data->>'name');
    end if;

    unit_price := coalesce((product_row.data->>'sellPrice')::numeric, 0);
    computed_items := computed_items || jsonb_build_object(
      'productId', item.product_id, 'quantity', item.quantity, 'unitPrice', unit_price
    );
    computed_total := computed_total + unit_price * item.quantity;
  end loop;

  if jsonb_array_length(computed_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  insert into public.orders (data) values (
    jsonb_build_object(
      'customerId', customer_id,
      'items', computed_items,
      'deliveryDate', delivery_date,
      'notes', notes,
      'depositAmount', 0,
      'status', 'pending',
      'deliveredAt', null,
      'productionOrderId', null,
      'total', computed_total
    )
  ) returning * into new_order;

  return jsonb_build_object('id', new_order.id, 'created_at', new_order.created_at, 'updated_at', new_order.updated_at)
    || new_order.data;
end;
$$;

-- A diferencia de create_sale_atomic() y complete_production_order_atomic()
-- (que solo corre gente con sesión), este lo llama un visitante de la
-- tienda SIN sesión — necesita poder ejecutarlo el rol 'anon' además de
-- 'authenticated'.
grant execute on function public.create_public_order(uuid, jsonb, text, text) to anon, authenticated;

-- ============================================================
-- IMPORTANTE — esto cierra el camino fácil, no el único camino posible.
--
-- Si la tabla "orders" todavía tiene una política de INSERT que permite a
-- 'anon' insertar una fila directo (sin pasar por esta función), alguien
-- con más esfuerzo que abrir la consola del navegador (leer la API REST de
-- Supabase y mandar el POST a mano) todavía podría insertar un pedido con
-- un total inventado, sin pasar por acá. Cerrar ESE camino significa
-- restringir o quitar esa política de INSERT en "orders" para que el
-- checkout público solo pueda crear pedidos vía esta función — a
-- propósito NO se toca en esta migración: hacerlo a ciegas, sin haber
-- probado primero que create_public_order() funciona bien en producción,
-- podría dejar el checkout público roto. Confirmá que esto funciona y
-- después se cierra ese último paso.
--
-- Verificación (opcional): desde la tienda pública (sin sesión), completá
-- un pedido normal. El total en /admin/pedidos tiene que coincidir con el
-- precio real de cada producto en Configuración, incluso si en algún
-- momento se intentó forzar un precio distinto desde la consola del
-- navegador.
-- ============================================================
