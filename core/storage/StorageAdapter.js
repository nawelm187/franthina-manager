/**
 * StorageAdapter.js
 * Responsabilidad: definir el contrato que todo adaptador de almacenamiento debe cumplir.
 * Ningún módulo de negocio debe conocer la tecnología real de almacenamiento:
 * solo conocen esta interfaz. Cambiar la fuente de datos (localStorage -> IndexedDB ->
 * Supabase -> REST API) nunca debe requerir modificar los módulos de negocio.
 */

export class StorageAdapter {
  /** @param {string} _collection @returns {Promise<any[]>} */
  async getAll(_collection) { throw new Error('getAll() no implementado'); }

  /** @param {string} _collection @param {string} _id @returns {Promise<any|null>} */
  async getById(_collection, _id) { throw new Error('getById() no implementado'); }

  /** @param {string} _collection @param {any} _record @returns {Promise<any>} */
  async create(_collection, _record) { throw new Error('create() no implementado'); }

  /** @param {string} _collection @param {string} _id @param {any} _patch @returns {Promise<any>} */
  async update(_collection, _id, _patch) { throw new Error('update() no implementado'); }

  /** @param {string} _collection @param {string} _id @returns {Promise<void>} */
  async remove(_collection, _id) { throw new Error('remove() no implementado'); }

  /**
   * Almacenamiento de valores sueltos (no colecciones) — usado hoy para la
   * versión de esquema de datos (ver core/storage/migrations.js) y disponible
   * para futuras banderas a nivel aplicación.
   * @param {string} _key @returns {Promise<any>}
   */
  async getMeta(_key) { throw new Error('getMeta() no implementado'); }

  /** @param {string} _key @param {any} _value @returns {Promise<void>} */
  async setMeta(_key, _value) { throw new Error('setMeta() no implementado'); }

  /**
   * Operaciones que necesitan una transacción real (bloqueo de filas +
   * escritura atómica), no solo un patrón leer-calcular-guardar en
   * JavaScript. Solo CloudStorageAdapter las implementa — Postgres tiene
   * transacciones reales; localStorage no tiene con qué ofrecer la misma
   * garantía (ver core/storage/atomicRun.js para el porqué del fallback en
   * modo local). Cada Service que la necesita primero pregunta
   * supportsAtomicOps() y si es false, sigue usando runAtomic() como hasta
   * ahora.
   * @returns {boolean}
   */
  supportsAtomicOps() { return false; }

  /** @param {object} _saleData @param {{productId: string, quantity: number}[]} _items @returns {Promise<any>} */
  async createSaleAtomic(_saleData, _items) { throw new Error('createSaleAtomic() no implementado'); }

  /** @param {{orderId:string, requirements:object[], reasonText:string, productIds:string[], yieldTotal:number, completedAt:string}} _args @returns {Promise<any>} */
  async completeProductionOrderAtomic(_args) { throw new Error('completeProductionOrderAtomic() no implementado'); }

  /** @param {{customerId:string, items:{productId:string, quantity:number}[], deliveryDate:string, notes:string}} _args @returns {Promise<any>} */
  async createPublicOrderAtomic(_args) { throw new Error('createPublicOrderAtomic() no implementado'); }

  /** @returns {boolean} true si este adapter puede subir archivos de verdad a un backend (no solo guardar una URL de texto). */
  supportsFileUploads() { return false; }

  /** @param {File} _file @returns {Promise<string>} URL pública del archivo subido */
  async uploadProductImage(_file) { throw new Error('uploadProductImage() no implementado'); }
}
