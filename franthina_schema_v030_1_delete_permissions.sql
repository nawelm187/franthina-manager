-- ============================================================
-- FRANTHINA MANAGER — v0.30.1: DELETE restringido a admin/manager
-- ============================================================
-- Corre esto después de franthina_schema_v030_roles.sql.
--
-- Por qué esto SÍ se puede escribir sin ver el .sql completo de cada
-- tabla: CloudStorageAdapter.js muestra que todas las tablas de negocio
-- tienen la misma forma exacta — (id, created_at, updated_at, data jsonb).
-- No hay columnas propias de negocio que adivinar. Lo único que no se
-- conoce es el nombre de las políticas de DELETE que ya existan hoy (que
-- según el comentario del propio adaptador y el ROADMAP, hoy es
-- simplemente "cualquier cuenta con sesión, todo permitido").
--
-- En vez de pelear con eso, esta migración usa políticas RESTRICTIVAS
-- (`as restrictive`), que en Postgres se combinan con AND sobre cualquier
-- política permisiva ya existente — no hace falta saber su nombre ni
-- tocarla. El resultado: aunque exista una policy vieja que diga "todo
-- autenticado puede borrar", esta la acota a "todo autenticado QUE
-- ADEMÁS sea admin o manager puede borrar". SELECT/INSERT/UPDATE no se
-- tocan — la política es `for delete` únicamente.
-- ============================================================

create or replace function public.is_admin_or_manager()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager')
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'ingredients', 'recipes', 'inventory_movements',
    'production_orders', 'customers', 'sales', 'cashbox_sessions',
    'cashbox_movements', 'orders', 'suppliers', 'purchases'
  ]
  loop
    execute format('drop policy if exists "restrict_delete_to_admin_manager" on public.%I;', t);
    execute format(
      'create policy "restrict_delete_to_admin_manager" on public.%I
         as restrictive for delete to authenticated
         using (public.is_admin_or_manager());',
      t
    );
  end loop;
end $$;

-- system_logs queda afuera a propósito: ya es de solo agregar (ni un admin
-- puede borrar un registro de auditoría, ver franthina_schema_v029_1_security.sql).

-- ============================================================
-- Verificación (opcional):
--
-- Con una cuenta 'employee', intentá eliminar cualquier fila (un producto,
-- un ingrediente) desde la UI o directo en el SQL Editor simulando ese
-- rol. Debería fallar con un error de RLS. Con 'admin' o 'manager', el
-- mismo borrado tiene que seguir funcionando igual que hasta ahora.
--
-- Si algo que antes se podía borrar deja de poder borrarse incluso con
-- rol admin/manager, es señal de que ya había otra política RESTRICTIVE
-- en esa tabla con una condición que esta migración no contempla — en ese
-- caso hace falta ver esa policy puntual.
-- ============================================================
