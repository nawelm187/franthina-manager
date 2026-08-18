/**
 * theme.js
 * Responsabilidad: modo claro/oscuro para la TIENDA PÚBLICA — un
 * visitante sin sesión no tiene cuenta a la que atarle una preferencia
 * sincronizada (eso ya existe para el panel de administración, en
 * Configuración → Tema, guardado en Supabase). Acá es más simple: se
 * guarda en este dispositivo/navegador nada más, y si nunca lo tocó,
 * arranca respetando lo que ya tenga configurado el sistema operativo
 * (prefers-color-scheme) — no todos los oscuros son elegidos a mano, la
 * mayoría de los celulares hoy ya vienen en modo oscuro por defecto.
 */
const STORAGE_KEY = 'franthina:store-theme';

function readStoredOverride() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // navegación privada, cuota llena, etc. — no es motivo para romper nada
  }
}

function writeStoredOverride(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // idem — si no se puede guardar, el tema simplemente no persiste entre
    // visitas, pero la página sigue funcionando.
  }
}

/** El tema que le corresponde a un visitante de la tienda sin sesión:
 *  su elección guardada, o si nunca eligió, la del sistema operativo. */
export function initialStoreTheme() {
  const stored = readStoredOverride();
  if (stored) return stored;
  const prefersDark = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
}

/** Cambia entre claro/oscuro, lo guarda para la próxima visita, y lo
 *  aplica al toque. @returns {'light'|'dark'} el tema que quedó activo */
export function toggleStoreTheme() {
  const next = document.documentElement.classList.contains('theme-dark') ? 'light' : 'dark';
  writeStoredOverride(next);
  applyTheme(next);
  return next;
}
