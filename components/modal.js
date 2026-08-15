/**
 * modal.js
 * Responsabilidad: diálogo modal accesible y reutilizable.
 * Atrapa el foco, se cierra con Escape, y devuelve el foco al elemento que lo abrió.
 */
import { icon } from '../core/icons.js';

/**
 * @param {{ title: string, contentHtml: string, onMount?: (modalEl: HTMLElement) => void, footerButtons?: {label:string, variant?:string, onClick:(close:()=>void)=>void}[] }} options
 * @returns {() => void} función para cerrar el modal
 */
export function openModal({ title, contentHtml, onMount, footerButtons = [] }) {
  const previouslyFocused = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');

  const footerHtml = footerButtons
    .map((btn, i) => `<button type="button" class="btn btn--${btn.variant || 'secondary'}" data-btn-index="${i}">${btn.label}</button>`)
    .join('');

  modal.innerHTML = `
    <div class="modal__header">
      <h3 id="modal-title">${title}</h3>
      <button type="button" class="btn btn--ghost btn--icon-only" data-close aria-label="Cerrar">${icon('close')}</button>
    </div>
    <div class="modal__body">${contentHtml}</div>
    ${footerButtons.length ? `<div class="modal__footer">${footerHtml}</div>` : ''}
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKeydown);
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  }

  /**
   * Enter en un <input> o <select> dispara el botón principal del modal —
   * evita el viaje al mouse para confirmar un formulario corto. Nunca se
   * intercepta en un <textarea> (debe insertar un salto de línea, como
   * espera cualquier usuario) ni cuando el foco ya está en un botón (tiene
   * su propio comportamiento nativo de Enter).
   */
  function onKeydown(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') { trapFocus(e); return; }
    if (e.key !== 'Enter') return;
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') return;
    // Una línea de carrito (Ventas, Recetas, Producción, Compras, Pedidos) nunca
    // dispara el envío del formulario completo — el usuario puede seguir
    // cargando líneas sin el riesgo de confirmar la operación a mitad de camino.
    if (e.target.closest('[data-item-row]')) return;

    e.preventDefault();
    const primaryIndex = footerButtons.findIndex((b) => b.variant === 'primary');
    const targetIndex = primaryIndex !== -1 ? primaryIndex : footerButtons.length - 1;
    if (targetIndex >= 0) modal.querySelector(`[data-btn-index="${targetIndex}"]`)?.click();
  }

  /**
   * Mantiene el foco de teclado dentro del modal: con el foco en el primer
   * elemento, Shift+Tab salta al último (y viceversa con Tab desde el
   * último), en vez de escaparse hacia elementos de la página de atrás que
   * quedan ocultos detrás del fondo oscuro pero seguirían siendo alcanzables
   * por teclado sin esto.
   */
  function trapFocus(e) {
    const focusable = Array.from(
      modal.querySelectorAll('input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  modal.querySelector('[data-close]').addEventListener('click', close);
  footerButtons.forEach((btn, i) => {
    modal.querySelector(`[data-btn-index="${i}"]`).addEventListener('click', async (event) => {
      // Evita doble-envío: un doble-tap (muy común en pantallas táctiles) o un
      // Enter repetido no debe poder disparar el guardado dos veces antes de
      // que la primera llamada termine (podría crear un registro duplicado,
      // por ejemplo una venta repetida que descuenta stock dos veces).
      if (modal.dataset.submitting === 'true') return;
      modal.dataset.submitting = 'true';
      const allButtons = footerButtons.map((_, j) => modal.querySelector(`[data-btn-index="${j}"]`));
      const clickedBtn = event.currentTarget;
      const originalLabel = clickedBtn.innerHTML;
      allButtons.forEach((el) => { el.disabled = true; });
      // Solo el botón que se tocó muestra el spinner — así queda claro cuál
      // acción está en curso, en vez de que toda la fila de botones se vea
      // apagada sin explicación (el antipatrón de "clic → pantalla congelada").
      clickedBtn.innerHTML = `${icon('progress_activity', { className: 'icon-spin' })} ${btn.loadingLabel || 'Guardando…'}`;
      try {
        await btn.onClick(close);
      } finally {
        // Si onClick ya cerró el modal, el backdrop no está más en el DOM —
        // no hace falta (ni se puede) reactivar botones que ya no existen.
        if (document.body.contains(backdrop)) {
          modal.dataset.submitting = 'false';
          allButtons.forEach((el) => { el.disabled = false; });
          clickedBtn.innerHTML = originalLabel;
        }
      }
    });
  });
  document.addEventListener('keydown', onKeydown);

  onMount?.(modal);
  modal.querySelector('input, textarea, select, button')?.focus();

  return close;
}
