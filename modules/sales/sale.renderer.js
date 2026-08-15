/**
 * sale.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Ventas.
 * Nunca guarda datos ni contiene reglas de negocio.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, formatDate, escapeHtml } from '../../core/utils.js';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from './sale.model.js';
import { icon } from '../../core/icons.js';

export function renderSalesPage(container, { sales, customersById, sortState }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Ventas</h1>
        <p>Registrá ventas rápidas y llevá el control de lo vendido.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-sale">
        ${icon('shopping_cart')} Nueva venta
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="sale-search">Buscar por cliente</label>
      <input class="input" type="search" id="sale-search" placeholder="Escribí un nombre..." />
    </div>

    <div id="sales-table-region">
      ${renderDataTable({
        sortKey: sortState?.key ?? null,
        sortDirection: sortState?.direction ?? 'asc',
        columns: [
          { key: 'createdAt', label: 'Fecha', sortable: true, render: (r) => formatDate(r.createdAt) },
          { key: 'customerId', label: 'Cliente', render: (r) => escapeHtml(customersById.get(r.customerId)?.name ?? 'Consumidor final') },
          { key: 'items', label: 'Items', render: (r) => `${r.items.length}` },
          { key: 'paymentMethod', label: 'Pago', render: (r) => PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod },
          { key: 'total', label: 'Total', sortable: true, render: (r) => formatCurrency(r.total) },
        ],
        rows: sales,
        emptyMessage: 'Todavía no registraste ninguna venta.',
        emptyAction: { id: 'btn-empty-new-sale', label: 'Nueva venta' },
      })}
    </div>
  `;
}

export function saleFormHtml(sale, products, customers) {
  const customerOptions = customers.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const rows = sale.items.length ? sale.items.map((it) => saleItemRowHtml(it, products)) : [saleItemRowHtml({ productId: '', quantity: 1, unitPrice: 0 }, products)];

  const paymentOptions = Object.entries(PAYMENT_METHOD_LABELS)
    .map(([value, label]) => `<option value="${value}" ${sale.paymentMethod === value ? 'selected' : ''}>${label}</option>`)
    .join('');

  return `
    <form id="sale-form" novalidate>
      <div class="field">
        <label class="field__label" for="s-customer">Cliente (opcional)</label>
        <select class="select" id="s-customer" name="customerId">
          <option value="">Consumidor final</option>
          ${customerOptions}
        </select>
      </div>

      <fieldset style="border:none; padding:0; margin-bottom: var(--space-4);">
        <legend class="field__label">Productos <span class="required">*</span></legend>
        <div class="row gap-2" style="padding: 0 var(--space-2); margin-bottom: var(--space-1);">
          <span class="field__hint" style="flex:2;">Producto</span>
          <span class="field__hint" style="flex:1;">Unidades</span>
          <span class="field__hint" style="flex:1;">Precio c/u</span>
          <span class="field__hint" style="flex:1;">Subtotal</span>
          <span style="width:44px;"></span>
        </div>
        <div id="sale-items-list" class="stack gap-2">${rows.join('')}</div>
        <div class="field__error" data-error-for="items" hidden style="margin-top: var(--space-2);"></div>
        <button type="button" class="btn btn--secondary" id="btn-add-sale-item" style="margin-top: var(--space-2);">
          ${icon('add')} Agregar producto
        </button>
      </fieldset>

      <div class="field">
        <label class="field__label" for="s-payment">Método de pago</label>
        <select class="select" id="s-payment" name="paymentMethod">${paymentOptions}</select>
      </div>

      <div class="field" id="cash-received-field" ${sale.paymentMethod === PAYMENT_METHODS.CASH ? '' : 'hidden'}>
        <label class="field__label" for="s-amount-received">¿Con cuánto paga? (efectivo recibido)</label>
        <input class="input" type="number" min="0" step="0.01" id="s-amount-received" name="amountReceived" value="${sale.amountReceived ?? ''}" placeholder="Ej: 2000" />
        <div class="field__error" data-error-for="amountReceived" hidden></div>
      </div>

      <div class="card" style="background: var(--surface-sunken);">
        <div class="row gap-3" style="flex-wrap:wrap; justify-content:space-between;">
          <strong>Total: <span id="sale-live-total">$0</span></strong>
          <strong id="sale-live-change-wrap" hidden>Vuelto: <span id="sale-live-change" class="badge"></span></strong>
        </div>
      </div>

      <div class="field" style="margin-top: var(--space-4);">
        <label class="field__label" for="s-notes">Notas</label>
        <textarea class="textarea" id="s-notes" name="notes">${escapeHtml(sale.notes)}</textarea>
      </div>
    </form>
  `;
}

let itemRowCounter = 0;

function saleItemRowHtml(item, products) {
  itemRowCounter += 1;
  const rowId = `srow-${itemRowCounter}`;
  const options = products
    .map((p) => `<option value="${p.id}" data-price="${p.sellPrice}" ${p.id === item.productId ? 'selected' : ''}>${escapeHtml(p.name)} (stock: ${p.stock})</option>`)
    .join('');
  return `
    <div class="row gap-2" data-item-row="${rowId}">
      <select class="select" data-field="productId" style="flex:2;">
        <option value="">Seleccioná un producto…</option>
        ${options}
      </select>
      <input class="input" type="number" min="1" step="1" data-field="quantity" value="${item.quantity || 1}" placeholder="Cant." style="flex:1;" />
      <input class="input" type="number" min="0" step="0.01" data-field="unitPrice" value="${item.unitPrice || ''}" placeholder="Precio" style="flex:1;" />
      <span class="input" data-subtotal-display style="flex:1; background: var(--surface-sunken); display:flex; align-items:center; font-weight: var(--fw-semibold);">$0</span>
      <button type="button" class="btn btn--ghost btn--icon-only" data-remove-item aria-label="Quitar producto">${icon('delete')}</button>
    </div>`;
}

export function buildSaleItemRowHtml(products) {
  return saleItemRowHtml({ productId: '', quantity: 1, unitPrice: 0 }, products);
}
