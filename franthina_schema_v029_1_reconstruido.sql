-- ================================================================
-- RECONSTRUCCIÓN — get_public_business_config()
-- ================================================================
-- Esto NO es una copia textual del archivo original que subiste al
-- principio de la conversación (ya no lo tengo — se limpió del contexto
-- de esta sesión tan larga). Es una reconstrucción basada en:
--
--   1. Mi propio análisis de ese archivo, del principio de esta charla.
--   2. El código REAL del cliente que ya llama a esta función y espera
--      una forma de respuesta específica — esto es lo que le da
--      confianza a la reconstrucción, no la memoria sola:
--
--      core/storage/CloudStorageAdapter.js:
--        const { data, error } = await supabase.rpc('get_public_business_config');
--        const row = data?.[0];
--        return { whatsappNumber: row.whatsapp_number ?? '' };
--
--      core/storage/CloudStorageAdapter.js (getMeta/setMeta):
--        supabase.from('app_meta').select('value').eq('key', key)
--        supabase.from('app_meta').upsert({ key, value, updated_at })
--
--   Esto confirma con certeza: la función tiene que devolver una fila
--   (o cero filas) con una columna "whatsapp_number", leyendo desde
--   "app_meta" donde key = 'businessSettings' y el campo "whatsappNumber"
--   (camelCase) adentro del jsonb "value".
--
-- Corré primero franthina_diagnostico.sql — si ahí te aparece que esta
-- función YA existe, no corras esto (create or replace la pisaría igual
-- sin romper nada, pero mejor entender primero qué es lo que realmente
-- falta).
-- ================================================================

create or replace function public.get_public_business_config()
returns table (whatsapp_number text)
language sql
security definer
set search_path = ''
stable
as $$
  select (value->>'whatsappNumber')::text
  from public.app_meta
  where key = 'businessSettings';
$$;

-- revoke primero, grant después: nadie más que anon/authenticated puede
-- ejecutarla — mismo patrón idempotente del resto de las migraciones.
revoke all on function public.get_public_business_config() from public;
grant execute on function public.get_public_business_config() to anon, authenticated;

-- ================================================================
-- Verificación:
--
-- select * from get_public_business_config();
--
-- Si "Configuración del negocio" (Configuración → número de WhatsApp) ya
-- se guardó alguna vez desde la app, esto debería devolver una fila con
-- el número. Si devuelve una fila con whatsapp_number = null, o cero
-- filas, es porque nunca se guardó nada en app_meta todavía — no es un
-- error, hay que cargarlo una vez desde Configuración.
-- ================================================================
