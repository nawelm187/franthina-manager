/**
 * purchase.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Compras.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, formatDate, escapeHtml } from '../../core/utils.js';
import { calculatePurchaseTotal } from './purchase.model.js';
import { icon } from '../../core/icons.js';

export function renderPurchasesPage(container, { purchases, suppliersById, sortState }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Compras</h1>
        <p>Registrá compras a proveedores: suma stock en Inventario y actualiza el costo de cada ingrediente.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-purchase">
        ${icon('receipt_long')} Nueva compra
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="purchase-search">Buscar por proveedor</label>
      <input class="input" type="search" id="purchase-search" placeholder="Escribí un nombre..." />
    </div>

    <div id="purchases-table-region">
      ${renderDataTable({
        sortKey: sortState?.key ?? null,
        sortDirection: sortState?.direction ?? 'asc',
        columns: [
          { key: 'createdAt', label: 'Fecha', sortable: true, render: (r) => formatDate(r.createdAt) },
          { key: 'supplierId', label: 'Proveedor', render: (r) => escapeHtml(suppliersById.get(r.supplierId)?.name ?? 'Proveedor eliminado') },
          { key: 'items', label: 'Ingredientes', render: (r) => `${r.items.length}` },
          { key: 'total', label: 'Total', render: (r) => formatCurrency(calculatePurchaseTotal(r)) },
        ],
        rows: purchases,
        emptyMessage: 'Todavía no registraste ninguna compra.',
        emptyAction: { id: 'btn-empty-new-purchase', label: 'Nueva compra' },
      })}
    </div>
  `;
}

export function purchaseFormHtml(purchase, suppliers, ingredients) {
  const supplierOptions = suppliers.map((s) => `<option value="${s.id}" ${s.id === purchase.supplierId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
  const rows = purchase.items.length ? purchase.items.map((it) => purchaseItemRowHtml(it, ingredients)) : [purchaseItemRowHtml({ ingredientId: '', quantity: 0, unitCost: 0 }, ingredients)];

  return `
    <form id="purchase-form" novalidate>
      <div class="field">
        <label class="field__label" for="pu-supplier">Proveedor <span class="required">*</span></label>
        <select class="select" id="pu-supplier" name="supplierId">
          <option value="">Seleccioná un proveedor…</option>
          ${supplierOptions}
        </select>
        <div class="field__error" data-error-for="supplierId" hidden></div>
      </div>

      <fieldset style="border:none; padding:0; margin-bottom: var(--space-4);">
        <legend class="field__label">Ingredientes comprados <span class="required">*</span></legend>
        <div id="purchase-items-list" class="stack gap-2">${rows.join('')}</div>
        <div class="field__error" data-error-for="items" hidden style="margin-top: var(--space-2);"></div>
        <button type="button" class="btn btn--secondary" id="btn-add-purchase-item" style="margin-top: var(--space-2);">
          ${icon('add')} Agregar ingrediente
        </button>
      </fieldset>

      <div class="card" style="background: var(--surface-sunken);">
        <strong>Total: <span id="purchase-live-total">$0</span></strong>
      </div>

      <div class="field" style="margin-top: var(--space-4);">
        <label class="field__label" for="pu-notes">Notas</label>
        <textarea class="textarea" id="pu-notes" name="notes">${escapeHtml(purchase.notes)}</textarea>
      </div>
    </form>
  `;
}

let itemRowCounter = 0;

function purchaseItemRowHtml(item, ingredients) {
  itemRowCounter += 1;
  const rowId = `purow-${itemRowCounter}`;
  const options = ingredients
    .map((i) => `<option value="${i.id}" data-cost="${i.cost}" ${i.id === item.ingredientId ? 'selected' : ''}>${escapeHtml(i.name)} (${escapeHtml(i.unit)})</option>`)
    .join('');
  return `
    <div class="row gap-2" data-item-row="${rowId}">
      <select class="select" data-field="ingredientId" style="flex:2;">
        <option value="">Seleccioná un ingrediente…</option>
        ${options}
      </select>
      <input class="input" type="number" min="0" step="0.01" data-field="quantity" value="${item.quantity || ''}" placeholder="Cantidad" style="flex:1;" />
      <input class="input" type="number" min="0" step="0.01" data-field="unitCost" value="${item.unitCost || ''}" placeholder="Costo unitario" style="flex:1;" />
      <button type="button" class="btn btn--ghost btn--icon-only" data-remove-item aria-label="Quitar ingrediente">${icon('delete')}</button>
    </div>`;
}

export function buildPurchaseItemRowHtml(ingredients) {
  return purchaseItemRowHtml({ ingredientId: '', quantity: 0, unitCost: 0 }, ingredients);
}
