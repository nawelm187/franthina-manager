/**
 * core/constants/storageKeys.js
 * Responsabilidad: única fuente de verdad para TODAS las claves de storage
 * de la aplicación — tanto las colecciones (registros con id) como los
 * valores sueltos (storage.getMeta/setMeta). Ningún módulo debe escribir
 * una clave de storage como string suelto — siempre se importa desde acá.
 *
 * COLLECTIONS es lo que le permite a core/backup.js hacer un export/import
 * completo de los datos de la aplicación sin conocer cada módulo de negocio
 * individualmente: solo recorre este catálogo.
 */

export const COLLECTIONS = Object.freeze({
  PRODUCTS: 'products',
  INGREDIENTS: 'ingredients',
  RECIPES: 'recipes',
  INVENTORY_MOVEMENTS: 'inventory_movements',
  PRODUCTION_ORDERS: 'production_orders',
  CUSTOMERS: 'customers',
  SALES: 'sales',
  CASHBOX_SESSIONS: 'cashbox_sessions',
  CASHBOX_MOVEMENTS: 'cashbox_movements',
  ORDERS: 'orders',
  SUPPLIERS: 'suppliers',
  PURCHASES: 'purchases',
  SYSTEM_LOGS: 'system_logs',
});

/** Claves de valores sueltos, guardadas vía storage.getMeta()/setMeta(). */
export const META_KEYS = Object.freeze({
  A11Y_PREFS: 'a11yPrefs',
  SCHEMA_VERSION: 'schemaVersion',
  BUSINESS_SETTINGS: 'businessSettings',
});
