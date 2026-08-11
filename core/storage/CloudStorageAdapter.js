/**
 * CloudStorageAdapter.js
 * Responsabilidad: misma interfaz que LocalStorageAdapter (ver StorageAdapter.js),
 * pero contra Supabase en vez de localStorage. Ningún Service necesita saber
 * cuál de los dos está activo — por eso ningún *.service.js de la app tuvo
 * que cambiar para pasar a la nube.
 *
 * Cada colección es una tabla de Postgres con la forma
 * (id, created_at, updated_at, data jsonb) — "data" guarda el resto de los
 * campos del registro, igual que ya vivían en localStorage. Ver
 * franthina_schema.sql para el esquema completo y las políticas de
 * seguridad (RLS): todo requiere sesión iniciada, salvo la creación de
 * clientes/pedidos desde la tienda pública (checkout de invitado) y la
 * lectura de productos públicos vía get_public_products().
 */
import { StorageAdapter } from './StorageAdapter.js';
import { supabase } from '../supabaseClient.js';
import { StorageError } from '../errors.js';

/** Traduce una fila de Postgres a la forma plana que ya esperan los Services. */
function fromRow(row) {
  return { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, ...row.data };
}

/** Inverso de fromRow: separa id/createdAt/updatedAt (son columnas propias)
 *  del resto de los campos (van adentro de la columna "data"). */
function toData(record) {
  const { id, createdAt, updatedAt, ...data } = record;
  return data;
}

export class CloudStorageAdapter extends StorageAdapter {
  async getAll(collection) {
    const { data, error } = await supabase.from(collection).select('*').order('created_at', { ascending: true });
    if (error) throw new StorageError(`No se pudieron leer los datos: ${error.message}`);
    return data.map(fromRow);
  }

  async getById(collection, id) {
    const { data, error } = await supabase.from(collection).select('*').eq('id', id).maybeSingle();
    if (error) throw new StorageError(`No se pudo leer el registro: ${error.message}`);
    return data ? fromRow(data) : null;
  }

  async create(collection, record) {
    const { data, error } = await supabase.from(collection).insert({ data: toData(record) }).select().single();
    if (error) throw new StorageError(`No se pudo guardar: ${error.message}`);
    return fromRow(data);
  }

  async update(collection, id, patch) {
    const current = await this.getById(collection, id);
    if (!current) throw new Error(`Registro "${id}" no encontrado en "${collection}"`);
    const merged = { ...current, ...patch };
    const { data, error } = await supabase.from(collection).update({ data: toData(merged) }).eq('id', id).select().single();
    if (error) throw new StorageError(`No se pudo actualizar: ${error.message}`);
    return fromRow(data);
  }

  async remove(collection, id) {
    const { error } = await supabase.from(collection).delete().eq('id', id);
    if (error) throw new StorageError(`No se pudo eliminar: ${error.message}`);
  }

  async getMeta(key) {
    const { data, error } = await supabase.from('app_meta').select('value').eq('key', key).maybeSingle();
    if (error) return null; // sin sesión (ej. visitante de la tienda): tratar como "sin valor guardado"
    return data ? data.value : null;
  }

  async setMeta(key, value) {
    const { error } = await supabase.from('app_meta').upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw new StorageError(`No se pudo guardar la configuración: ${error.message}`);
  }

  /**
   * Productos para la tienda pública (sin sesión iniciada): usa la función
   * get_public_products() en vez de leer la tabla real, para que un
   * visitante nunca pueda recibir costPrice, notes, ni el stock exacto
   * (ver franthina_schema_fix.sql). Devuelve la misma forma que getAll(),
   * con "stock" sintetizado a 0/1 solo para que el badge de disponibilidad
   * del catálogo (que chequea stock > 0) siga funcionando sin cambios.
   */
  async getPublicProducts() {
    const { data, error } = await supabase.rpc('get_public_products');
    if (error) throw new StorageError(`No se pudieron leer los productos: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      imageUrl: r.image_url,
      sellPrice: r.sell_price,
      stock: r.available ? 1 : 0,
      active: true,
    }));
  }
}
