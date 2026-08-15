/**
 * utils.js
 * Responsabilidad: funciones puras y reutilizables, sin estado y sin efectos secundarios en el DOM.
 * Nunca duplicar estas funciones dentro de un módulo.
 */

import { APP_CONFIG } from './config.js';

/** Genera un identificador único (UUID v4 si el navegador lo soporta, fallback simple). */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Formatea un número como moneda según la configuración regional de la app. */
export function formatCurrency(value) {
  return new Intl.NumberFormat(APP_CONFIG.defaultLocale, {
    style: 'currency',
    currency: APP_CONFIG.defaultCurrency,
  }).format(Number(value) || 0);
}

/** Formatea una fecha ISO a formato legible corto. */
export function formatDate(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat(APP_CONFIG.defaultLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(isoString));
}

/**
 * "hace 12 minutos" / "hace 3 horas" / fecha corta si ya pasó más de una semana
 * (a partir de ahí "hace X días" deja de ser información útil). Usado en el
 * feed de Auditoría — mucho más fácil de escanear que una fecha/hora exacta
 * cuando lo que importa es "¿esto fue reciente?".
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '—';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'hace instantes';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} minuto${diffMin === 1 ? '' : 's'}`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} hora${diffHour === 1 ? '' : 's'}`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `hace ${diffDay} día${diffDay === 1 ? '' : 's'}`;
  return formatDate(isoString);
}

/** Retrasa la ejecución de una función hasta que dejen de llegar llamadas durante `wait` ms. */
export function debounce(fn, wait = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
}

/** Escapa texto antes de insertarlo como HTML — previene inyección de HTML/XSS. */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

/** Calcula el margen de ganancia porcentual entre costo y precio de venta. */
export function calcMargin(cost, price) {
  const c = Number(cost) || 0;
  const p = Number(price) || 0;
  if (p === 0) return 0;
  return Math.round(((p - c) / p) * 100);
}

/** Trunca un texto agregando puntos suspensivos si excede el largo máximo. */
export function truncate(text, max = 60) {
  const str = String(text ?? '');
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/**
 * Enfoca el primer campo de la última fila de un carrito dinámico (Ventas,
 * Recetas, Pedidos, Compras) — se llama justo después de agregar una fila
 * nueva, así el usuario puede seguir cargando sin ir a buscarla con el mouse.
 */
export function focusNewRow(container) {
  const rows = container.querySelectorAll('[data-item-row]');
  const lastRow = rows[rows.length - 1];
  lastRow?.querySelector('select, input')?.focus();
}

/**
 * Normaliza texto para comparar en búsquedas: minúsculas + sin acentos
 * (usa NFD para separar la letra de su marca diacrítica y descarta la
 * marca). Así "Ázucar", "azucar" y "Azúcar" se consideran equivalentes.
 */
export function normalizeForSearch(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Mensaje de estado vacío para listas con buscador: distingue "todavía no
 * hay datos cargados" de "la búsqueda no encontró nada", para no mostrar el
 * mismo texto (y la misma sugerencia de "cargá el primero") en los dos casos.
 * @param {string} term - término tal como lo escribió el usuario (sin normalizar), ya trimeado
 * @param {string} baseMessage - mensaje a usar cuando no hay búsqueda activa
 */
export function emptyStateMessage(term, baseMessage) {
  return term ? `No encontramos resultados para "${term}".` : baseMessage;
}

/**
 * Corrige automáticamente el link "Compartir" de Google Drive (que apunta a
 * una página de vista previa, no a la imagen en sí) al formato que sí sirve
 * como <img src>. Cualquier otro link se deja tal cual.
 */
export function normalizeImageUrl(url) {
  const driveMatch = String(url ?? '').match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  return url;
}
