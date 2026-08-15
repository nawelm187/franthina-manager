/**
 * production.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Producción.
 */

import { productionService } from './production.service.js';
import { renderProductionPage, orderFormHtml, feasibilityHtml } from './production.renderer.js';
import { createEmptyProductionOrder } from './production.model.js';
import { openModal } from '../../components/modal.js';
import { confirmAction } from '../../components/confirm.js';
import { showToast } from '../../components/toast.js';
import { handleError, ValidationError, InsufficientStockError } from '../../core/errors.js';
import { iconElement } from '../../core/icons.js';
import { withButtonLoading } from '../../core/buttonLoading.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let orders = [];
  let recipes = [];
  try {
    [orders, recipes] = await Promise.all([
      productionService.list(),
      productionService.listRecipesForForm(),
    ]);
  } catch (err) {
    handleError(err, 'production:list');
    return;
  }

  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  renderProductionPage(container, { orders, recipesById });
  bindEvents(container, orders, recipes);
}

function bindEvents(container, orders, recipes) {
  ['#btn-new-order', '#btn-empty-new-production'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openOrderForm(container, recipes));
  });

  container.querySelectorAll('[data-action="complete"]').forEach((btn) => {
    btn.addEventListener('click', () => handleComplete(container, orders, btn.dataset.id, btn));
  });

  container.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmAction({
        title: 'Cancelar orden de producción',
        message: 'La orden quedará marcada como cancelada y no descontará stock.',
        confirmLabel: 'Cancelar orden',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await withButtonLoading(btn, () => productionService.cancel(btn.dataset.id), { loadingLabel: 'Cancelando…' });
        showToast({ type: 'success', message: 'Orden cancelada.' });
        render(null, container);
      } catch (err) {
        handleError(err, 'production:cancel');
      }
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmAction({
        title: 'Eliminar orden de producción',
        message: '¿Seguro que querés eliminar esta orden planificada? Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await withButtonLoading(btn, () => productionService.remove(btn.dataset.id), { loadingLabel: 'Eliminando…' });
        showToast({ type: 'success', message: 'Orden eliminada.' });
        render(null, container);
      } catch (err) {
        handleError(err, 'production:delete');
      }
    });
  });
}

async function handleComplete(container, orders, orderId, btn) {
  const order = orders.find((o) => o.id === orderId);
  const confirmed = await confirmAction({
    title: 'Completar producción',
    message: 'Esto va a descontar el stock de los ingredientes usados y sumar las unidades producidas al stock del producto vinculado (si hay uno). ¿Confirmás?',
    confirmLabel: 'Completar producción',
  });
  if (!confirmed) return;

  try {
    await withButtonLoading(btn, () => productionService.complete(order.id), { loadingLabel: 'Completando…' });
    showToast({ type: 'success', message: 'Producción completada. Stock actualizado.' });
    render(null, container);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      showToast({ type: 'danger', message: err.message });
    } else {
      handleError(err, 'production:complete');
    }
  }
}

function openOrderForm(container, recipes) {
  if (!recipes.length) {
    showToast({ type: 'warning', message: 'Cargá al menos una receta antes de planificar producción.' });
    return;
  }

  const data = createEmptyProductionOrder();

  openModal({
    title: 'Planificar producción',
    contentHtml: orderFormHtml(data, recipes),
    onMount: (modalEl) => setupFeasibilityPreview(modalEl),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Planificar',
        variant: 'primary',
        onClick: async (closeFn) => {
          const payload = readOrderForm(document.getElementById('order-form'));
          try {
            await productionService.create(payload);
            showToast({ type: 'success', message: 'Producción planificada.' });
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else {
              handleError(err, 'production:save');
              closeFn();
            }
          }
        },
      },
    ],
  });
}

function setupFeasibilityPreview(modalEl) {
  const recipeSelect = modalEl.querySelector('#o-recipe');
  const multiplierInput = modalEl.querySelector('#o-multiplier');
  const previewEl = modalEl.querySelector('#order-feasibility');

  const update = async () => {
    const recipeId = recipeSelect.value;
    const multiplier = Number(multiplierInput.value) || 1;
    if (!recipeId) {
      previewEl.innerHTML = feasibilityHtml(null);
      return;
    }
    previewEl.textContent = 'Calculando…';
    try {
      const feasibility = await productionService.checkFeasibility({ recipeId, multiplier });
      previewEl.innerHTML = feasibilityHtml(feasibility);
    } catch (err) {
      previewEl.textContent = 'No se pudo calcular la disponibilidad de stock.';
      handleError(err, 'production:feasibility-preview');
    }
  };

  recipeSelect.addEventListener('change', update);
  multiplierInput.addEventListener('input', update);
  update();
}

function readOrderForm(form) {
  const formData = new FormData(form);
  return {
    recipeId: formData.get('recipeId')?.toString() ?? '',
    multiplier: Number(formData.get('multiplier')) || 0,
    plannedDate: formData.get('plannedDate')?.toString() ?? '',
    notes: formData.get('notes')?.toString() ?? '',
  };
}

function paintFieldErrors(fieldErrors) {
  document.querySelectorAll('[data-error-for]').forEach((el) => { el.hidden = true; el.textContent = ''; });
  document.querySelectorAll('.field.has-error').forEach((el) => el.classList.remove('has-error'));
  document.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const el = document.querySelector(`[data-error-for="${field}"]`);
    const input = document.getElementById(`f-${field}`);
    if (el) {
      el.hidden = false;
      el.textContent = '';
      el.append(iconElement('warning', { className: 'icon-inline' }), document.createTextNode(message));
      if (!el.id) el.id = `error-${field}`;
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (el) input.setAttribute('aria-describedby', el.id);
      input.closest('.field')?.classList.add('has-error');
    }
  });
}
