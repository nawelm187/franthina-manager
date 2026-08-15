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
  pending: 'Pendiente de aprobación',
};

export const userProfiles = {
  async list() {
    if (APP_CONFIG.storageAdapter !== 'supabase') return [];
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  /** Cambia el rol de OTRO usuario. El propio backend (trigger
   *  `prevent_unauthorized_role_change`, ver franthina_schema_v030_roles.sql)
   *  ya rechaza en silencio cualquier intento de auto-promoción — esta
   *  función no depende de esa protección, pero tampoco la reemplaza. */
  async updateRole(userId, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
  },

  roleLabel(role) {
    return ROLE_LABELS[role] ?? role;
  },
};
