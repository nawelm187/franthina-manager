/**
 * userProfiles.js
 * Responsabilidad: consultar los perfiles de usuario (tabla "profiles") —
 * quién tiene acceso a la administración. No pasa por el StorageAdapter
 * genérico: "profiles" no es una colección de negocio como las demás, vive
 * ligada 1 a 1 con auth.users, con columnas propias en vez de un blob JSON.
 *
 * Con localStorage (sin nube) no existen usuarios reales — list() devuelve
 * directamente un array vacío en ese caso, en vez de fallar.
 */
import { supabase } from './supabaseClient.js';
import { APP_CONFIG } from './config.js';

const ROLE_LABELS = {
  admin: 'Administrador',
  manager: 'Encargado',
  employee: 'Empleado',
};

export const userProfiles = {
  async list() {
    if (APP_CONFIG.storageAdapter !== 'supabase') return [];
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  roleLabel(role) {
    return ROLE_LABELS[role] ?? role;
  },
};
