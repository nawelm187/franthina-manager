/**
 * state.js
 * Responsabilidad: estado global mínimo y predecible de la aplicación (UI-level state).
 * El estado de negocio (productos, ingredientes, etc.) vive en cada módulo a través de
 * su Service — este store es solo para estado transversal de interfaz: preferencias de
 * accesibilidad, tema activo, ruta actual.
 *
 * Ningún módulo modifica el estado directamente: siempre a través de setState(),
 * lo que garantiza que el store permanezca predecible y observable.
 *
 * Las preferencias de accesibilidad se persisten a través de storage.getMeta/setMeta
 * (nunca tocando localStorage directamente) — ver core/storage/LocalStorageAdapter.js.
 */

import { META_KEYS } from './constants/storageKeys.js';
import { eventBus, EVENTS } from './eventBus.js';
import { storage } from './storage/index.js';

const DEFAULT_A11Y = {
  textSize: 'md',       // 'md' | 'lg' | 'xl'
  contrast: 'normal',   // 'normal' | 'high'
  spacing: 'normal',    // 'normal' | 'relaxed'
  reduceMotion: false,
  theme: 'light',       // 'light' | 'dark'
};

const DEFAULT_BUSINESS_SETTINGS = {
  whatsappNumber: '', // número del negocio para "Enviar pedido por WhatsApp" (solo dígitos, con código de país)
};

class Store {
  #state = { currentRoute: '/', a11y: { ...DEFAULT_A11Y }, business: { ...DEFAULT_BUSINESS_SETTINGS } };
  #listeners = new Set();

  getState() {
    return this.#state;
  }

  /** @param {(state: object) => object} updater — recibe el estado actual y devuelve el parcial a mezclar */
  setState(updater) {
    const patch = typeof updater === 'function' ? updater(this.#state) : updater;
    this.#state = { ...this.#state, ...patch };
    this.#listeners.forEach((listener) => listener(this.#state));
  }

  /** @param {(state: object) => void} listener @returns {() => void} */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Carga las preferencias de accesibilidad guardadas. Se llama una única vez
   * al arrancar la app, antes del primer render (ver app.js) — el costo real
   * es solo un microtask, ya que localStorage es síncrono por debajo.
   */
  async hydrateA11yPrefs() {
    try {
      const saved = await storage.getMeta(META_KEYS.A11Y_PREFS);
      if (saved) this.setState({ a11y: { ...DEFAULT_A11Y, ...saved } });
    } catch {
      // Sin sesión (ej. visitante de la tienda): las preferencias de
      // accesibilidad son un dato de administración — se queda con los
      // valores por defecto, sin romper nada.
    }
  }

  async setA11yPref(key, value) {
    const a11y = { ...this.#state.a11y, [key]: value };
    this.setState({ a11y });
    await storage.setMeta(META_KEYS.A11Y_PREFS, a11y);
    eventBus.emit(EVENTS.A11Y_PREFS_CHANGED, a11y);
  }

  /** Se llama una única vez al arrancar la app, junto con hydrateA11yPrefs().
   *  Un visitante de la tienda (sin sesión) no puede leer la configuración
   *  administrativa completa — en ese caso cae a getPublicBusinessConfig(),
   *  que solo expone lo que la tienda necesita mostrar (hoy: WhatsApp). */
  async hydrateBusinessSettings() {
    try {
      const saved = await storage.getMeta(META_KEYS.BUSINESS_SETTINGS);
      if (saved) {
        this.setState({ business: { ...DEFAULT_BUSINESS_SETTINGS, ...saved } });
        return;
      }
    } catch {
      // Sin permiso de lectura (visitante sin sesión) — probar la vía pública.
    }
    try {
      if (typeof storage.getPublicBusinessConfig === 'function') {
        const pub = await storage.getPublicBusinessConfig();
        if (pub) this.setState({ business: { ...DEFAULT_BUSINESS_SETTINGS, ...pub } });
      }
    } catch (err) {
      // Si esto falla (ej. la función get_public_business_config() todavía
      // no existe en la base), la app sigue arrancando igual con los valores
      // por defecto — un dato de configuración que no cargó nunca debería
      // tumbar el arranque completo de la aplicación. Se loguea para que no
      // quede en silencio total, pero no se relanza.
      console.error('[Franthina] No se pudo leer la configuración pública del negocio:', err);
    }
  }

  async setBusinessSetting(key, value) {
    const business = { ...this.#state.business, [key]: value };
    this.setState({ business });
    await storage.setMeta(META_KEYS.BUSINESS_SETTINGS, business);
  }
}

export const store = new Store();
