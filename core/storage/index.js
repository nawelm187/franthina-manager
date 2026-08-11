/**
 * storage/index.js
 * Responsabilidad: única fachada de almacenamiento que el resto de la aplicación conoce.
 * Ningún módulo debe importar un adaptador concreto directamente.
 * Cambiar APP_CONFIG.storageAdapter es suficiente para migrar de tecnología
 * (localStorage -> IndexedDB -> Supabase -> REST) sin tocar los módulos de negocio.
 */

import { APP_CONFIG } from '../config.js';
import { LocalStorageAdapter } from './LocalStorageAdapter.js';
import { CloudStorageAdapter } from './CloudStorageAdapter.js';

const adapters = {
  localStorage: () => new LocalStorageAdapter(),
  supabase: () => new CloudStorageAdapter(),
  // indexedDB: () => new IndexedDBAdapter(),   // próxima fase — ver docs/module-ingredients.md
  // rest:      () => new RestApiAdapter(),     // fase multiusuario/multisucursal
};

const factory = adapters[APP_CONFIG.storageAdapter];
if (!factory) {
  throw new Error(`Adaptador de almacenamiento desconocido: "${APP_CONFIG.storageAdapter}"`);
}

/** Instancia única compartida por toda la aplicación. */
export const storage = factory();
