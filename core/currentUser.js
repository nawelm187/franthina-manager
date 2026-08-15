/**
 * currentUser.js
 * Responsabilidad: quién soy yo (mi propio rol), en caché sincrónica —
 * mismo patrón que auth.js usa para la sesión, y por la misma razón: la UI
 * (qué mostrar en el menú, qué botones habilitar) necesita saber el rol
 * ANTES del primer render, no después de una consulta async a mitad de
 * camino.
 *
 * No confundir con userProfiles.js: ese lee la lista de TODOS los perfiles
 * (para la pantalla de gestión de usuarios); este solo conoce el propio.
 */
import { supabase } from './supabaseClient.js';
import { APP_CONFIG } from './config.js';

let cachedProfile = null; // null = sin perfil conocido (sin sesión, modo local, o perfil no encontrado)

export const currentUser = {
  /** Lectura sincrónica del último perfil conocido. */
  getCachedProfile() {
    return cachedProfile;
  },

  /** @returns {string|null} 'admin' | 'manager' | 'employee' | 'pending' | null */
  getCachedRole() {
    return cachedProfile?.role ?? null;
  },

  /** Se llama al arrancar la app y cada vez que cambia la sesión (login,
   *  logout) — ver app.js. Sin sesión o en modo local, limpia la caché. */
  async refresh(session) {
    if (!session || APP_CONFIG.storageAdapter !== 'supabase') {
      cachedProfile = null;
      return null;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (error) {
      cachedProfile = null;
      return null;
    }
    cachedProfile = data;
    return data;
  },
};
