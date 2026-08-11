/**
 * qtyStepper.js
 * Responsabilidad: comportamiento de los controles "− [cantidad] +" (stepper)
 * usados en el catálogo y el carrito de la tienda. Solo ajusta el valor del
 * <input> asociado y dispara un evento 'change' nativo — qué hacer con ese
 * cambio (agregar al carrito, recalcular el total) es decisión de cada
 * Controller, nunca de este componente.
 */
export function bindQtyStepper(container) {
  container.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const step = Number(btn.dataset.step);
      const min = Number(target.min) || 0;
      const next = Math.max(min, (Number(target.value) || 0) + step);
      target.value = next;
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}
