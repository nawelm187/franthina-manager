-- ============================================================
-- FRANTHINA MANAGER — v0.30: gestión de roles desde la UI
-- ============================================================
-- Corre esto después de franthina_schema_v029_2_audit_fix.sql.
--
-- Hasta ahora no había forma de sacar a alguien de 'pending' sin entrar a
-- mano al SQL Editor de Supabase. La UI nueva en Configuración > "Usuarios
-- con acceso" deja que un admin le cambie el rol a cualquier otro usuario
-- desde un <select> — pero esa UI necesita que RLS efectivamente permita
-- ese UPDATE, y no tenemos certeza de qué política de UPDATE existe hoy
-- en "profiles" (viene de un script anterior a esta conversación). Esta
-- migración agrega el permiso que falta sin tocar lo que ya haya: en
-- Postgres, cuando hay varias políticas para el mismo comando, se
-- combinan con OR — agregar esta policy solo AMPLÍA quién puede hacer
-- UPDATE, nunca le saca permiso a nada que ya funcionaba.
--
-- La protección real contra que alguien se auto-promueva sigue siendo el
-- trigger prevent_unauthorized_role_change de la migración anterior — esto
-- de acá solo habilita que la fila se pueda tocar en absoluto; el trigger
-- decide si el cambio de rol específico es válido.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ============================================================
-- Verificación (opcional):
--
-- Con una cuenta admin, cambiá el rol de otra cuenta desde
-- Configuración > Usuarios con acceso. Si en vez de guardar aparece un
-- error de permisos, revisá si ya existía OTRA policy de UPDATE en
-- "profiles" con "with check" más restrictivo que bloquee el intento antes
-- de llegar a esta — en ese caso hace falta ver esa policy puntual.
-- ============================================================
