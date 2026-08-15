-- ============================================================
-- FRANTHINA MANAGER — v0.31.1: producción atómica (mismo problema que
-- Ventas, versión más compleja)
-- ============================================================
-- Corre esto después de franthina_schema_v031_sale_concurrency.sql.
--
-- Mismo problema que resolvió create_sale_atomic(), pero con más
-- superficie: completar una orden de producción toca TRES tablas — resta
-- stock de cada ingrediente usado, registra un movimiento de inventario
-- por cada uno, y suma stock a cualquier producto vinculado a la receta —
-- todo tiene que ser una sola transacción o dos producciones concurrentes
-- de la misma receta pueden pisarse el stock de ingredientes igual que
-- podía pasar con las ventas.
--
-- Bonus: de paso, bloquear la fila de la orden con `for update` también
-- evita completar la MISMA orden dos veces por un doble clic — algo que
-- ni siquiera el camino anterior en JavaScript prevenía.
-- ============================================================

create or replace function public.complete_production_order_atomic(
  order_id uuid,
  requirements jsonb,   -- [{ "ingredientId": "...", "quantity": 12.5 }, ...] ya en la unidad del ingrediente
  reason_text text,     -- "Producción: <nombre de la receta>"
  product_ids jsonb,    -- ["uuid1", "uuid2", ...] — productos vinculados a la receta
  yield_total numeric,  -- cuánto stock sumarle a cada producto vinculado
  completed_at text     -- ISO string ya generado en el cliente (mismo formato que el resto de la app)
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.production_orders%rowtype;
  req record;
  ingredient_row public.ingredients%rowtype;
  current_stock numeric;
  pid uuid;
  product_row public.products%rowtype;
  product_stock numeric;
begin
  select * into order_row from public.production_orders where id = order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND:%', order_id;
  end if;
  if (order_row.data->>'status') is distinct from 'planned' then
    raise exception 'ORDER_NOT_PLANNED:%', (order_row.data->>'status');
  end if;

  -- Mismo motivo que en create_sale_atomic(): orden fijo por id para no
  -- arriesgarse a un deadlock entre dos producciones que comparten
  -- ingredientes pero en distinto orden.
  for req in
    select (elem->>'ingredientId')::uuid as ingredient_id, (elem->>'quantity')::numeric as quantity
    from jsonb_array_elements(requirements) as elem
    order by (elem->>'ingredientId')::uuid
  loop
    select * into ingredient_row from public.ingredients where id = req.ingredient_id for update;
    if not found then
      raise exception 'INGREDIENT_NOT_FOUND:%', req.ingredient_id;
    end if;

    current_stock := coalesce((ingredient_row.data->>'stock')::numeric, 0);
    if current_stock < req.quantity then
      raise exception 'INSUFFICIENT_STOCK:%:%:%:%:%', req.ingredient_id, (ingredient_row.data->>'name'), current_stock, req.quantity, coalesce(ingredient_row.data->>'unit', '');
    end if;

    -- greatest(0, ...) replica el Math.max(0, ...) que ya usaba
    -- inventory.service.js — nunca queda un stock negativo por redondeo.
    update public.ingredients
      set data = jsonb_set(data, '{stock}', to_jsonb(greatest(0, current_stock - req.quantity)))
      where id = req.ingredient_id;

    insert into public.inventory_movements (data) values (
      jsonb_build_object('ingredientId', req.ingredient_id, 'type', 'out', 'quantity', req.quantity, 'reason', reason_text)
    );
  end loop;

  for pid in
    select (elem)::uuid from jsonb_array_elements_text(product_ids) as elem order by 1
  loop
    select * into product_row from public.products where id = pid for update;
    if not found then
      -- Un producto vinculado a la receta pudo haberse borrado mientras
      -- tanto — no es motivo para frenar el resto de la producción.
      continue;
    end if;
    product_stock := coalesce((product_row.data->>'stock')::numeric, 0);
    update public.products
      set data = jsonb_set(data, '{stock}', to_jsonb(product_stock + yield_total))
      where id = pid;
  end loop;

  update public.production_orders
    set data = jsonb_set(jsonb_set(data, '{status}', '"completed"'), '{completedAt}', to_jsonb(completed_at))
    where id = order_id
    returning * into order_row;

  return jsonb_build_object('id', order_row.id, 'created_at', order_row.created_at, 'updated_at', order_row.updated_at)
    || order_row.data;
end;
$$;

grant execute on function public.complete_production_order_atomic(uuid, jsonb, text, jsonb, numeric, text) to authenticated;

-- ============================================================
-- Verificación (opcional):
--
-- Con dos órdenes de producción planificadas que usan la misma receta (y
-- por lo tanto el mismo ingrediente, con stock justo para UNA sola),
-- completalas casi al mismo tiempo desde dos pestañas. La segunda tiene
-- que fallar con "Stock insuficiente", no dejar el ingrediente en
-- negativo.
--
-- Probá también completar la MISMA orden dos veces seguidas rápido (doble
-- clic) — la segunda tiene que fallar porque la orden ya no está
-- "planned", no duplicar el consumo de ingredientes.
-- ============================================================
