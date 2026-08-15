-- ============================================================
-- FRANTHINA MANAGER — v0.31.0: venta atómica (concurrencia real)
-- ============================================================
-- Corre esto después de franthina_schema_v030_1_delete_permissions.sql.
--
-- El problema (documentado en docs/ROADMAP.md): sale.service.js confirma
-- una venta con un patrón leer → calcular en JavaScript → guardar
-- (core/storage/atomicRun.js ya lo señala explícitamente en sus propios
-- comentarios). Con un solo cajero nunca fue un problema. Con dos
-- vendiendo el mismo producto al mismo tiempo, ambos pueden leer el mismo
-- stock, calcular el mismo descuento, y el segundo UPDATE pisa al primero
-- silenciosamente — se vende de más sin que nadie se entere.
--
-- La solución: una función de Postgres que hace TODO adentro de una sola
-- transacción — bloquear las filas de producto involucradas
-- (`for update`), verificar stock, descontar, e insertar la venta — así
-- Postgres serializa las dos ventas concurrentes en vez de dejarlas
-- pisarse. `security definer` porque necesita poder escribir en
-- "products" y "sales" sin depender de qué políticas RLS granulares
-- tenga el caller para cada una — la función es el punto de control único.
-- ============================================================

create or replace function public.create_sale_atomic(sale_data jsonb, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  product_row public.products%rowtype;
  current_stock numeric;
  new_sale public.sales%rowtype;
begin
  -- Recorre los productos en orden por id (no en el orden en que vinieron
  -- en la venta) — si dos ventas concurrentes comparten dos productos pero
  -- en distinto orden, bloquear siempre en el mismo orden evita que se
  -- esperen mutuamente en círculo (deadlock).
  for item in
    select (elem->>'productId')::uuid as product_id, (elem->>'quantity')::numeric as quantity
    from jsonb_array_elements(items) as elem
    order by (elem->>'productId')::uuid
  loop
    -- "for update" bloquea esta fila hasta que termine la transacción: si
    -- otra venta concurrente pidió el mismo producto, espera acá en vez de
    -- leer un stock que está a punto de cambiar.
    select * into product_row from public.products where id = item.product_id for update;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', item.product_id;
    end if;

    current_stock := coalesce((product_row.data->>'stock')::numeric, 0);
    if current_stock < item.quantity then
      raise exception 'INSUFFICIENT_STOCK:%:%:%:%', item.product_id, (product_row.data->>'name'), current_stock, item.quantity;
    end if;

    update public.products
      set data = jsonb_set(data, '{stock}', to_jsonb(current_stock - item.quantity))
      where id = item.product_id;
  end loop;

  insert into public.sales (data) values (sale_data) returning * into new_sale;

  return jsonb_build_object('id', new_sale.id, 'created_at', new_sale.created_at, 'updated_at', new_sale.updated_at)
    || new_sale.data;
end;
$$;

grant execute on function public.create_sale_atomic(jsonb, jsonb) to authenticated;

-- ============================================================
-- Verificación (opcional):
--
-- Desde dos pestañas logueadas como distintos usuarios, con un producto
-- de stock = 1: en una, empezá una venta de 1 unidad y frená antes de
-- confirmar (o simulá una demora). Desde la otra, confirmá una venta de
-- esa misma unidad. La segunda tiene que fallar con "Sin stock
-- suficiente", no completarse dejando el stock en -1 o en un valor
-- inconsistente.
--
-- Nota: esta función NO reemplaza a create_sale_atomic para el modo local
-- (sin Supabase) — ahí sigue usándose el camino anterior en JavaScript,
-- porque localStorage no tiene transacciones ni bloqueos que ofrecer.
-- ============================================================
