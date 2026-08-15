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
import { StorageError, InsufficientStockError, NotFoundError } from '../errors.js';

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
    if (error) throw new StorageError(`No se pudo leer la configuración: ${error.message}`);
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

  /**
   * Configuración pública del negocio (sin sesión iniciada) — usa la función
   * get_public_business_config() en vez de leer app_meta directo, que
   * requiere sesión (ver franthina_schema_v029_1_security.sql). Por ahora
   * solo expone el número de WhatsApp; devuelve null si no hay nada
   * configurado.
   */
  async getPublicBusinessConfig() {
    const { data, error } = await supabase.rpc('get_public_business_config');
    if (error) throw new StorageError(`No se pudo leer la configuración del negocio: ${error.message}`);
    const row = data?.[0];
    if (!row) return null;
    return { whatsappNumber: row.whatsapp_number ?? '' };
  }

  supportsAtomicOps() { return true; }

  /**
   * Descuenta stock de cada producto y crea la venta en una sola
   * transacción de Postgres (ver franthina_schema_v031_sale_concurrency.sql)
   * — a diferencia de runAtomic() en JS, esto sí evita que dos ventas
   * concurrentes del mismo producto se pisen el stock.
   */
  async createSaleAtomic(saleData, items) {
    const { data, error } = await supabase.rpc('create_sale_atomic', {
      sale_data: toData(saleData),
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
    if (error) throw parseAtomicSaleError(error);
    const { id, created_at, updated_at, ...rest } = data;
    return { id, createdAt: created_at, updatedAt: updated_at, ...rest };
  }

  /**
   * Descuenta stock de ingredientes, registra los movimientos de
   * inventario, suma stock a los productos vinculados, y marca la orden
   * como completada — todo en una sola transacción de Postgres (ver
   * franthina_schema_v031_1_production_concurrency.sql).
   */
  async completeProductionOrderAtomic({ orderId, requirements, reasonText, productIds, yieldTotal, completedAt }) {
    const { data, error } = await supabase.rpc('complete_production_order_atomic', {
      order_id: orderId,
      requirements: requirements.map((r) => ({ ingredientId: r.ingredientId, quantity: r.required })),
      reason_text: reasonText,
      product_ids: productIds,
      yield_total: yieldTotal,
      completed_at: completedAt,
    });
    if (error) throw parseAtomicProductionError(error);
    const { id, created_at, updated_at, ...rest } = data;
    return { id, createdAt: created_at, updatedAt: updated_at, ...rest };
  }

  /**
   * Crea un pedido desde la tienda pública con el precio recalculado del
   * lado del servidor — el cliente solo manda productId + quantity, nunca
   * un precio (ver franthina_schema_v031_2_public_order_price.sql).
   */
  async createPublicOrderAtomic({ customerId, items, deliveryDate, notes }) {
    const { data, error } = await supabase.rpc('create_public_order', {
      customer_id: customerId,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      delivery_date: deliveryDate,
      notes,
    });
    if (error) throw parseAtomicPublicOrderError(error);
    const { id, created_at, updated_at, ...rest } = data;
    return { id, createdAt: created_at, updatedAt: updated_at, ...rest };
  }
}

/** Traduce los errores custom que levanta create_sale_atomic() (ver el
 *  .sql) a las mismas clases de error que ya usa el resto de la app —
 *  así sale.service.js no necesita saber si el error vino de Postgres o
 *  de una verificación hecha en JavaScript. */
function parseAtomicSaleError(error) {
  const msg = error.message || '';
  if (msg.includes('INSUFFICIENT_STOCK')) {
    const [, productId, name, available, required] = msg.split(':');
    return new InsufficientStockError([{
      productId, name: name || 'Producto', available: Number(available) || 0, required: Number(required) || 0,
    }]);
  }
  if (msg.includes('PRODUCT_NOT_FOUND')) {
    return new StorageError('Uno de los productos de la venta ya no existe. Actualizá la página e intentá de nuevo.');
  }
  return new StorageError(`No se pudo confirmar la venta: ${error.message}`);
}

/** Igual idea que parseAtomicSaleError(), para complete_production_order_atomic(). */
function parseAtomicProductionError(error) {
  const msg = error.message || '';
  if (msg.includes('INSUFFICIENT_STOCK')) {
    const [, ingredientId, name, available, required, unit] = msg.split(':');
    return new InsufficientStockError([{
      ingredientId, name: name || 'Ingrediente', available: Number(available) || 0, required: Number(required) || 0, unit: unit || '',
    }]);
  }
  if (msg.includes('ORDER_NOT_PLANNED')) {
    return new Error('Solo se pueden completar órdenes planificadas.');
  }
  if (msg.includes('ORDER_NOT_FOUND')) {
    return new NotFoundError('La orden de producción no existe.');
  }
  if (msg.includes('INGREDIENT_NOT_FOUND')) {
    return new StorageError('Uno de los ingredientes de la receta ya no existe. Actualizá la página e intentá de nuevo.');
  }
  return new StorageError(`No se pudo completar la producción: ${error.message}`);
}

/** Igual idea que las anteriores, para create_public_order(). */
function parseAtomicPublicOrderError(error) {
  const msg = error.message || '';
  if (msg.includes('PRODUCT_NOT_AVAILABLE')) {
    const [, name] = msg.split(':');
    return new StorageError(`"${name || 'Uno de los productos'}" ya no está disponible. Actualizá la página e intentá de nuevo.`);
  }
  if (msg.includes('PRODUCT_NOT_FOUND')) {
    return new StorageError('Uno de los productos del carrito ya no existe. Actualizá la página e intentá de nuevo.');
  }
  if (msg.includes('EMPTY_ORDER')) {
    return new StorageError('El carrito está vacío.');
  }
  return new StorageError(`No se pudo confirmar el pedido: ${error.message}`);
}
