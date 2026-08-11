/**
 * order.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Pedidos.
 */

import { orderService } from './order.service.js';
import { renderOrdersPage, orderFormHtml, buildOrderItemRowHtml } from './order.renderer.js';
import { createEmptyOrder, calculateOrderTotal, calculateOrderBalance } from './order.model.js';
import { customerService } from '../customers/customer.service.js';
import { openModal } from '../../components/modal.js';
import { confirmAction } from '../../components/confirm.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError, InsufficientStockError } from '../../core/errors.js';
import { formatCurrency, focusNewRow, debounce, normalizeForSearch } from '../../core/utils.js';

let sortState = { key: 'deliveryDate', direction: 'asc' };

export async function render(_params, container) {
  container.innerHTML = '<div class="state-panel"><div class="skeleton" style="width:100%;height:240px;"></div></div>';

  let allOrders = [];
  let products = [];
  let customers = [];
  try {
    [allOrders, products, customers] = await Promise.all([
      orderService.list(),
      orderService.listProductsForForm(),
      customerService.list(),
    ]);
  } catch (err) {
    handleError(err, 'orders:list');
    return;
  }

  paint(container, allOrders, products, customers, allOrders);
}

function paint(container, displayedOrders, products, customers, allOrders) {
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const productsById = new Map(products.map((p) => [p.id, p]));
  const sorted = sortState.key ? sortRows(displayedOrders, sortState.key, sortState.direction) : displayedOrders;
  renderOrdersPage(container, { orders: sorted, customersById, productsById, sortState });
  bindEvents(container, displayedOrders, products, customers, allOrders, customersById);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedOrders, products, customers, allOrders);
    },
  });
}

function bindEvents(container, orders, products, customers, allOrders, customersById) {
  container.querySelector('#btn-new-order')
    ?.addEventListener('click', () => openOrderForm(container, products, customers));

  container.querySelector('#order-search')
    ?.addEventListener('input', debounce((e) => {
      const term = normalizeForSearch(e.target.value.trim());
      const filtered = allOrders.filter((o) => {
        const customerName = customersById.get(o.customerId)?.name ?? 'Cliente eliminado';
        return normalizeForSearch(customerName).includes(term);
      });
      paint(container, filtered, products, customers, allOrders);
    }, 250));

  container.querySelectorAll('[data-action="deliver"]').forEach((btn) => {
    btn.addEventListener('click', () => handleDeliver(container, orders, btn.dataset.id));
  });

  container.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmAction({
        title: 'Cancelar pedido',
        message: 'El pedido quedará marcado como cancelado. La seña ya cobrada no se revierte automáticamente en Caja.',
        confirmLabel: 'Cancelar pedido',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await orderService.cancel(btn.dataset.id);
        showToast({ type: 'success', message: 'Pedido cancelado.' });
        render(null, container);
      } catch (err) {
        handleError(err, 'orders:cancel');
      }
    });
  });
}

async function handleDeliver(container, orders, orderId) {
  const order = orders.find((o) => o.id === orderId);
  const balance = calculateOrderBalance(order);
  const confirmed = await confirmAction({
    title: 'Entregar pedido',
    message: `Esto va a descontar stock de los productos y registrar el saldo pendiente (${formatCurrency(balance)}) en Caja. ¿Confirmás?`,
    confirmLabel: 'Entregar',
  });
  if (!confirmed) return;

  try {
    await orderService.markDelivered(order.id);
    showToast({ type: 'success', message: 'Pedido entregado. Stock actualizado.' });
    render(null, container);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      showToast({ type: 'danger', message: err.message });
    } else {
      handleError(err, 'orders:deliver');
    }
  }
}

function openOrderForm(container, products, customers) {
  if (!products.length) {
    showToast({ type: 'warning', message: 'Cargá al menos un producto antes de crear un pedido.' });
    return;
  }

  const data = createEmptyOrder();

  openModal({
    title: 'Nuevo pedido',
    contentHtml: orderFormHtml(data, products, customers),
    onMount: (modalEl) => {
      setupCartBehavior(modalEl, products);
      setupQuickAddCustomer(modalEl, customers);
    },
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Crear pedido',
        variant: 'primary',
        onClick: async (closeFn) => {
          const payload = readOrderForm(document.getElementById('order-form'));
          try {
            await orderService.create(payload);
            showToast({ type: 'success', message: 'Pedido creado.' });
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) paintFieldErrors(err.fieldErrors);
            else { handleError(err, 'orders:save'); closeFn(); }
          }
        },
      },
    ],
  });
}

/**
 * Alta rápida de cliente sin salir del formulario de pedido: en Pedidos el
 * cliente es obligatorio (a diferencia de Ventas), así que si todavía no
 * está cargado, antes había que cancelar, ir a Clientes, crearlo, y volver
 * a abrir el pedido desde cero. Acá se crea con lo mínimo (nombre +
 * teléfono) y queda seleccionado al toque, sin perder lo ya cargado en el
 * pedido (productos, fecha, etc.).
 */
function setupQuickAddCustomer(modalEl, customers) {
  modalEl.querySelector('#btn-quick-customer')?.addEventListener('click', () => {
    openModal({
      title: 'Nuevo cliente',
      contentHtml: `
        <form id="quick-customer-form" novalidate>
          <div class="field">
            <label class="field__label" for="qc-name">Nombre <span class="required">*</span></label>
            <input class="input" id="qc-name" name="name" />
            <div class="field__error" data-error-for="name" hidden></div>
          </div>
          <div class="field">
            <label class="field__label" for="qc-phone">Teléfono</label>
            <input class="input" type="tel" id="qc-phone" name="phone" placeholder="11-5555-5555" />
            <div class="field__error" data-error-for="phone" hidden></div>
          </div>
          <p class="field__hint">Podés completar el resto de los datos después, desde Clientes.</p>
        </form>
      `,
      onMount: (quickModalEl) => quickModalEl.querySelector('#qc-name')?.focus(),
      footerButtons: [
        { label: 'Cancelar', variant: 'secondary', onClick: (closeInner) => closeInner() },
        {
          label: 'Crear cliente',
          variant: 'primary',
          onClick: async (closeInner) => {
            const form = document.getElementById('quick-customer-form');
            const formData = new FormData(form);
            const payload = {
              name: formData.get('name')?.toString().trim() ?? '',
              phone: formData.get('phone')?.toString().trim() ?? '',
              email: '', address: '', birthday: '', notes: '',
            };
            try {
              const created = await customerService.create(payload);
              customers.push(created);
              const select = modalEl.querySelector('#o-customer');
              const option = document.createElement('option');
              option.value = created.id;
              option.textContent = created.name;
              option.selected = true;
              select.appendChild(option);
              showToast({ type: 'success', message: `"${created.name}" fue creado y seleccionado.` });
              closeInner();
            } catch (err) {
              if (err instanceof ValidationError) {
                Object.entries(err.fieldErrors).forEach(([field, message]) => {
                  const el = form.querySelector(`[data-error-for="${field}"]`);
                  if (el) { el.hidden = false; el.textContent = `⚠ ${message}`; }
                });
              } else {
                handleError(err, 'orders:quick-add-customer');
                closeInner();
              }
            }
          },
        },
      ],
    });
  });
}

function setupCartBehavior(modalEl, products) {
  const list = modalEl.querySelector('#order-items-list');
  const addBtn = modalEl.querySelector('#btn-add-order-item');

  addBtn.addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', buildOrderItemRowHtml(products));
    updateLiveTotals(modalEl);
    focusNewRow(list);
  });

  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-item]');
    if (!removeBtn) return;
    const rows = list.querySelectorAll('[data-item-row]');
    if (rows.length <= 1) {
      showToast({ type: 'warning', message: 'El pedido necesita al menos un producto.' });
      return;
    }
    removeBtn.closest('[data-item-row]').remove();
    updateLiveTotals(modalEl);
  });

  list.addEventListener('change', (e) => {
    const select = e.target.closest('[data-field="productId"]');
    if (select) autofillPrice(select);
    updateLiveTotals(modalEl);
  });
  list.addEventListener('input', () => updateLiveTotals(modalEl));
  modalEl.querySelector('#o-deposit')?.addEventListener('input', () => updateLiveTotals(modalEl));

  updateLiveTotals(modalEl);
}

/** Autocompleta el precio unitario con el precio de venta del producto elegido.
 *  Siempre pisa el valor anterior — ver el mismo fix en sale.controller.js. */
function autofillPrice(selectEl) {
  const row = selectEl.closest('[data-item-row]');
  const priceInput = row.querySelector('[data-field="unitPrice"]');
  const suggestedPrice = selectEl.selectedOptions[0]?.dataset.price;
  if (suggestedPrice) priceInput.value = suggestedPrice;
}

function updateLiveTotals(modalEl) {
  const items = readItemsFromForm(modalEl);
  const depositAmount = Number(modalEl.querySelector('#o-deposit')?.value) || 0;
  const total = calculateOrderTotal({ items });
  const balance = calculateOrderBalance({ items, depositAmount });
  modalEl.querySelector('#order-live-total').textContent = formatCurrency(total);
  modalEl.querySelector('#order-live-balance').textContent = formatCurrency(balance);
}

function readItemsFromForm(scopeEl) {
  return [...scopeEl.querySelectorAll('[data-item-row]')].map((row) => ({
    productId: row.querySelector('[data-field="productId"]').value,
    quantity: Number(row.querySelector('[data-field="quantity"]').value) || 0,
    unitPrice: Number(row.querySelector('[data-field="unitPrice"]').value) || 0,
  })).filter((it) => it.productId);
}

function readOrderForm(form) {
  const formData = new FormData(form);
  return {
    customerId: formData.get('customerId')?.toString() ?? '',
    items: readItemsFromForm(form),
    deliveryDate: formData.get('deliveryDate')?.toString() ?? '',
    depositAmount: Number(formData.get('depositAmount')) || 0,
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
      el.textContent = `⚠ ${message}`;
      if (!el.id) el.id = `error-${field}`;
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (el) input.setAttribute('aria-describedby', el.id);
      input.closest('.field')?.classList.add('has-error');
    }
  });
}
