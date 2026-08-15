/**
 * purchase.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Compras.
 */

import { purchaseService } from './purchase.service.js';
import { renderPurchasesPage, purchaseFormHtml, buildPurchaseItemRowHtml } from './purchase.renderer.js';
import { createEmptyPurchase, calculatePurchaseTotal } from './purchase.model.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { formatCurrency, focusNewRow, debounce, normalizeForSearch } from '../../core/utils.js';
import { iconElement } from '../../core/icons.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

let sortState = { key: 'createdAt', direction: 'desc' };

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let allPurchases = [];
  let suppliers = [];
  let ingredients = [];
  try {
    [allPurchases, suppliers, ingredients] = await Promise.all([
      purchaseService.list(),
      purchaseService.listSuppliersForForm(),
      purchaseService.listIngredientsForForm(),
    ]);
  } catch (err) {
    handleError(err, 'purchases:list');
    return;
  }

  paint(container, allPurchases, suppliers, ingredients, allPurchases);
}

function paint(container, displayedPurchases, suppliers, ingredients, allPurchases) {
  const suppliersById = new Map(suppliers.map((s) => [s.id, s]));
  const sorted = sortState.key ? sortRows(displayedPurchases, sortState.key, sortState.direction) : displayedPurchases;
  renderPurchasesPage(container, { purchases: sorted, suppliersById, sortState });
  bindEvents(container, suppliers, ingredients, allPurchases, suppliersById);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedPurchases, suppliers, ingredients, allPurchases);
    },
  });
}

function bindEvents(container, suppliers, ingredients, allPurchases, suppliersById) {
  ['#btn-new-purchase', '#btn-empty-new-purchase'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openPurchaseForm(container, suppliers, ingredients));
  });

  container.querySelector('#purchase-search')
    ?.addEventListener('input', debounce((e) => {
      const term = normalizeForSearch(e.target.value.trim());
      const filtered = allPurchases.filter((p) => {
        const supplierName = suppliersById.get(p.supplierId)?.name ?? 'Proveedor eliminado';
        return normalizeForSearch(supplierName).includes(term);
      });
      paint(container, filtered, suppliers, ingredients, allPurchases);
    }, 250));
}

function openPurchaseForm(container, suppliers, ingredients) {
  if (!suppliers.length) {
    showToast({ type: 'warning', message: 'Cargá al menos un proveedor antes de registrar una compra.' });
    return;
  }
  if (!ingredients.length) {
    showToast({ type: 'warning', message: 'Cargá al menos un ingrediente antes de registrar una compra.' });
    return;
  }

  const data = createEmptyPurchase();

  openModal({
    title: 'Nueva compra',
    contentHtml: purchaseFormHtml(data, suppliers, ingredients),
    onMount: (modalEl) => setupCartBehavior(modalEl, ingredients),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Registrar compra',
        variant: 'primary',
        onClick: async (closeFn) => {
          const payload = readPurchaseForm(document.getElementById('purchase-form'));
          try {
            await purchaseService.create(payload);
            showToast({ type: 'success', message: 'Compra registrada. Stock y costos actualizados.' });
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) paintFieldErrors(err.fieldErrors);
            else { handleError(err, 'purchases:save'); closeFn(); }
          }
        },
      },
    ],
  });
}

function setupCartBehavior(modalEl, ingredients) {
  const list = modalEl.querySelector('#purchase-items-list');
  const addBtn = modalEl.querySelector('#btn-add-purchase-item');

  addBtn.addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', buildPurchaseItemRowHtml(ingredients));
    updateLiveTotal(modalEl);
    focusNewRow(list);
  });

  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-item]');
    if (!removeBtn) return;
    const rows = list.querySelectorAll('[data-item-row]');
    if (rows.length <= 1) {
      showToast({ type: 'warning', message: 'La compra necesita al menos un ingrediente.' });
      return;
    }
    removeBtn.closest('[data-item-row]').remove();
    updateLiveTotal(modalEl);
  });

  list.addEventListener('change', (e) => {
    const select = e.target.closest('[data-field="ingredientId"]');
    if (select) autofillCost(select);
    updateLiveTotal(modalEl);
  });
  list.addEventListener('input', () => updateLiveTotal(modalEl));

  updateLiveTotal(modalEl);
}

/** Autocompleta el costo unitario con el último costo cargado del ingrediente.
 *  Siempre pisa el valor anterior — ver el mismo fix en sale.controller.js. */
function autofillCost(selectEl) {
  const row = selectEl.closest('[data-item-row]');
  const costInput = row.querySelector('[data-field="unitCost"]');
  const suggestedCost = selectEl.selectedOptions[0]?.dataset.cost;
  if (suggestedCost) costInput.value = suggestedCost;
}

function updateLiveTotal(modalEl) {
  const items = readItemsFromForm(modalEl);
  const total = calculatePurchaseTotal({ items });
  modalEl.querySelector('#purchase-live-total').textContent = formatCurrency(total);
}

function readItemsFromForm(scopeEl) {
  return [...scopeEl.querySelectorAll('[data-item-row]')].map((row) => ({
    ingredientId: row.querySelector('[data-field="ingredientId"]').value,
    quantity: Number(row.querySelector('[data-field="quantity"]').value) || 0,
    unitCost: Number(row.querySelector('[data-field="unitCost"]').value) || 0,
  })).filter((it) => it.ingredientId);
}

function readPurchaseForm(form) {
  const formData = new FormData(form);
  return {
    supplierId: formData.get('supplierId')?.toString() ?? '',
    items: readItemsFromForm(form),
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
