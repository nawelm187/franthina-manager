/**
 * auth.js
 * Responsabilidad: única puerta de entrada a la sesión de administración.
 * Ningún otro archivo debe llamar a supabase.auth directamente.
 *
 * Mantiene una copia en memoria de la sesión (`cachedSession`), actualizada
 * reactivamente vía onAuthStateChange. Esto existe para que el Router pueda
 * decidir de forma SINCRÓNICA si una ruta de /admin está permitida, sin
 * tener que esperar una consulta async en medio de la navegación (eso
 * dejaría una ventana de tiempo donde una pantalla protegida empieza a
 * pedir datos antes de saber si hay sesión). Por eso `ready()` existe:
 * se espera una única vez, al arrancar la app, antes de montar el Router.
 */
import { supabase } from './supabaseClient.js';

let cachedSession = undefined; // undefined = todavía no se sabe; null = sin sesión
const listeners = new Set();

supabase.auth.onAuthStateChange((_event, session) => {
  cachedSession = session;
  listeners.forEach((fn) => fn(session));
});

export const auth = {
  /** Lectura sincrónica del último estado conocido. Puede ser `undefined`
   *  muy brevemente al arrancar — usar ready() antes de confiar en esto. */
  getCachedSession() {
    return cachedSession;
  },

  /** Se resuelve una única vez, quando Supabase informa el estado real de
   *  la sesión guardada (haya o no sesión activa). */
  ready() {
    if (cachedSession !== undefined) return Promise.resolve(cachedSession);
    return new Promise((resolve) => {
      const unsubscribe = auth.onChange((session) => {
        unsubscribe();
        resolve(session);
      });
    });
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  /** @param {(session: object|null) => void} callback @returns {() => void} para dejar de escuchar */
  onChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
