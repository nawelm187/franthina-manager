/**
 * buttonLoading.js
 * Responsabilidad: dar feedback visual (spinner + disabled) a un botón
 * mientras corre una operación async, y evitar doble-clic mientras tanto.
 *
 * modal.js ya resuelve esto para los botones DENTRO de un modal. Este
 * helper es para el resto de los casos: una acción de fila en una tabla
 * (Entregar pedido, Completar producción, Cerrar caja) que se confirma con
 * confirmAction() y después hace su trabajo real fuera de cualquier modal
 * — ahí el usuario no tenía ninguna señal de que la app estaba procesando,
 * y nada le impedía tocar el botón de nuevo antes de que terminara.
 */
import { icon } from './icons.js';

/**
 * @param {HTMLButtonElement} button
 * @param {() => Promise<any>} task
 * @param {{ loadingLabel?: string }} [options]
 */
export async function withButtonLoading(button, task, { loadingLabel = 'Procesando…' } = {}) {
  if (!(button instanceof HTMLElement) || button.disabled) return task();
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${icon('progress_activity', { className: 'icon-spin' })} ${loadingLabel}`;
  try {
    return await task();
  } finally {
    // Si el trabajo terminó en un re-render (lo normal acá), este botón ya
    // no está en el documento — tocar sus propiedades no hace nada visible
    // ni rompe nada, así que no hace falta chequear si sigue montado.
    button.disabled = false;
    button.innerHTML = original;
  }
}
