/**
 * legacyLocalMigration.js
 * Responsabilidad: leer los datos que hayan quedado en localStorage de antes
 * de pasar a Supabase, para poder migrarlos.
 *
 * A diferencia de core/backup.js (que solo usa la fachada de storage, nunca
 * un adaptador concreto), ESTE archivo sí lee localStorage directo — es la
 * única excepción a esa regla en todo el proyecto, y es intencional: existe
 * justamente para leer datos que el adapter activo ahora (Supabase) no
 * puede ver, porque viven en un lugar distinto.
 *
 * Arma el resultado con la MISMA forma que exportBackup() de core/backup.js,
 * así se puede reusar restoreBackup() tal cual para escribirlos en la nube
 * — sin duplicar la lógica de restauración en dos lugares.
 */
import { APP_CONFIG } from './config.js';
import { COLLECTIONS } from './constants/storageKeys.js';
import { CURRENT_SCHEMA_VERSION } from './storage/migrations.js';

const EXCLUDED = new Set([COLLECTIONS.SYSTEM_LOGS]);
const MIGRATABLE_COLLECTIONS = Object.values(COLLECTIONS).filter((c) => !EXCLUDED.has(c));

function legacyKey(collection) {
  return `${APP_CONFIG.storagePrefix}${collection}`;
}

function readLegacyCollection(collection) {
  try {
    const raw = window.localStorage.getItem(legacyKey(collection));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** @returns {number} cantidad total de registros encontrados en localStorage (0 si no hay nada para migrar) */
export function countLegacyLocalRecords() {
  return MIGRATABLE_COLLECTIONS.reduce((sum, collection) => sum + readLegacyCollection(collection).length, 0);
}

/** Arma un objeto de backup a partir de lo que haya en localStorage. */
export function readLegacyLocalBackup() {
  const data = {};
  for (const collection of MIGRATABLE_COLLECTIONS) {
    data[collection] = readLegacyCollection(collection);
  }
  return {
    appName: APP_CONFIG.appName,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}
