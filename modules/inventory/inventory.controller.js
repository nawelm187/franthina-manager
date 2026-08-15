/**
 * inventory.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Inventario.
 */

import { inventoryService } from './inventory.service.js';
import { ingredientService } from '../ingredients/ingredient.service.js';
import { renderInventoryPage, movementFormHtml } from './inventory.renderer.js';
import { createEmptyMovement } from './inventory.model.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError, InsufficientStockError } from '../../core/errors.js';
import { debounce, normalizeForSearch } from '../../core/utils.js';
import { iconElement } from '../../core/icons.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

let sortState = { key: 'createdAt', direction: 'desc' };

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let allMovements = [];
  let ingredients = [];
  try {
    [allMovements, ingredients] = await Promise.all([
      inventoryService.list(),
      ingredientService.list(),
    ]);
  } catch (err) {
    handleError(err, 'inventory:list');
    return;
  }

  paint(container, allMovements, ingredients, allMovements);
}

function paint(container, displayedMovements, ingredients, allMovements) {
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
  const sorted = sortState.key ? sortRows(displayedMovements, sortState.key, sortState.direction) : displayedMovements;
  renderInventoryPage(container, { movements: sorted, ingredientsById, sortState });
  bindEvents(container, ingredients, allMovements, ingredientsById);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedMovements, ingredients, allMovements);
    },
  });
}

function bindEvents(container, ingredients, allMovements, ingredientsById) {
  container.querySelector('#movement-search')
    ?.addEventListener('input', debounce((e) => {
      const term = normalizeForSearch(e.target.value.trim());
      const filtered = allMovements.filter((m) => {
        const ingredientName = ingredientsById.get(m.ingredientId)?.name ?? 'Ingrediente eliminado';
        return normalizeForSearch(ingredientName).includes(term);
      });
      paint(container, filtered, ingredients, allMovements);
    }, 250));

  ['#btn-new-movement', '#btn-empty-new-movement'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openMovementForm(container, ingredients));
  });
}

function openMovementForm(container, ingredients) {
  if (!ingredients.length) {
    showToast({ type: 'warning', message: 'Cargá al menos un ingrediente antes de registrar movimientos.' });
    return;
  }

  const data = createEmptyMovement();

  openModal({
    title: 'Registrar movimiento de inventario',
    contentHtml: movementFormHtml(data, ingredients),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Registrar',
        variant: 'primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('movement-form');
          const formData = new FormData(form);
          const payload = {
            ingredientId: formData.get('ingredientId')?.toString() ?? '',
            type: formData.get('type')?.toString() ?? 'in',
            quantity: Number(formData.get('quantity')) || 0,
            reason: formData.get('reason')?.toString().trim() ?? '',
          };

          try {
            await inventoryService.create(payload);
            showToast({ type: 'success', message: 'Movimiento registrado y stock actualizado.' });
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else if (err instanceof InsufficientStockError) {
              showToast({ type: 'danger', message: err.message });
            } else {
              handleError(err, 'inventory:save');
              closeFn();
            }
          }
        },
      },
    ],
  });
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
