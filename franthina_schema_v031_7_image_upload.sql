-- ================================================================
-- FRANTHINA MANAGER — v0.31.7: subir imágenes de producto desde el dispositivo
-- ================================================================
-- Corre esto después de las migraciones anteriores.
--
-- A diferencia de las migraciones previas (que tocaban tablas propias del
-- proyecto, con nombres y estructura que solo conocía por el código
-- cliente), esto usa "storage.buckets" y "storage.objects" — infraestructura
-- ESTÁNDAR de Supabase, igual en cualquier proyecto, no algo específico de
-- Franthina que hubiera que adivinar. Por eso se puede escribir con mucha
-- más confianza que las anteriores.
--
-- Crea un bucket público llamado "product-images": cualquiera puede VER
-- las imágenes que ahí se suban (son fotos de productos para la tienda,
-- se supone que son públicas), pero solo una cuenta con sesión iniciada
-- puede subir una nueva, y solo admin/manager puede borrar una.
-- ================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_insert_authenticated" on storage.objects;
create policy "product_images_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_delete_admin_manager" on storage.objects;
create policy "product_images_delete_admin_manager"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin_or_manager());

-- Nota: no hace falta una política de SELECT — al ser un bucket público,
-- Supabase sirve las imágenes por su URL pública sin pasar por RLS. Y no
-- hay política de UPDATE porque la app nunca "reemplaza" un archivo: cada
-- imagen que se sube queda con un nombre único, así que no hace falta.
--
-- Requiere que ya hayas corrido franthina_schema_v030_1_delete_permissions.sql
-- (de ahí sale la función is_admin_or_manager() que usa la policy de
-- borrado de acá arriba).
--
-- Verificación (opcional): subí una imagen desde el formulario de un
-- producto. Tiene que aparecer en Supabase → Storage → product-images.
-- Con una cuenta 'employee', el botón de eliminar una imagen no debería
-- funcionar (si en algún momento se agrega esa opción a la UI).
-- ================================================================
