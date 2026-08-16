-- ================================================================
-- DIAGNÓSTICO — corré esto primero en el SQL Editor de Supabase
-- ================================================================
-- No modifica nada. Te dice qué funciones, triggers y policies de esta
-- conversación ya existen en tu base real y cuáles faltan — así
-- reconstruimos solo lo que hace falta, no todo a ciegas.
-- ================================================================

select 'función: ' || p.proname as elemento, 'existe' as estado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'handle_new_user',
    'prevent_unauthorized_role_change',
    'get_public_business_config',
    'stamp_system_log_actor',
    'is_admin',
    'is_admin_or_manager',
    'create_sale_atomic',
    'complete_production_order_atomic',
    'create_public_order'
  )
order by 1;

select 'trigger: ' || t.tgname as elemento, 'existe' as estado
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname in (
    'trg_stamp_system_log_actor'
  )
order by 1;

select 'policy en ' || tablename || ': ' || policyname as elemento, 'existe' as estado
from pg_policies
where schemaname = 'public'
order by 1;

-- Bonus: confirma que la tabla app_meta existe y tiene datos guardados
-- (si esto viene vacío, get_public_business_config() va a devolver null
-- igual aunque la función exista — hay que cargar "Configuración del
-- negocio" al menos una vez desde la app).
select 'app_meta.businessSettings' as elemento,
  case when exists (select 1 from public.app_meta where key = 'businessSettings')
    then 'existe con datos' else 'NO tiene datos guardados todavía' end as estado;
