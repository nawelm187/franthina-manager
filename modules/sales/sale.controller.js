/**
 * sale.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Ventas.
 * Incluye la lógica del carrito dinámico: agregar/quitar líneas, autocompletar
 * precio al elegir un producto, mostrar el subtotal de cada línea en vivo,
 * mostrar/ocultar el campo de efectivo recibido según el método de pago, y
 * calcular el vuelto en vivo.
 */

import { saleService } from './sale.service.js';
import { renderSalesPage, saleFormHtml, buildSaleItemRowHtml } from './sale.renderer.js';
import { createEmptySale, calculateSaleTotal, calculateChange, PAYMENT_METHODS } from './sale.model.js';
import { customerService } from '../customers/customer.service.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError, InsufficientStockError } from '../../core/errors.js';
import { formatCurrency, focusNewRow, debounce, normalizeForSearch } from '../../core/utils.js';

let sortState = { key: 'createdAt', direction: 'desc' };

export async function render(_params, container) {
  container.innerHTML = '<div class="state-panel"><div class="skeleton" style="width:100%;height:240px;"></div></div>';

  let allSales = [];
  let products = [];
  let customers = [];
  try {
    [allSales, products, customers] = await Promise.all([
      saleService.list(),
      saleService.listProductsForForm(),
      customerService.list(),
    ]);
  } catch (err) {
    handleError(err, 'sales:list');
    return;
  }

  paint(container, allSales, products, customers, allSales);
}

/**
 * @param {object[]} displayedSales - lo que se muestra (puede estar filtrado por búsqueda)
 * @param {object[]} allSales - la lista completa, para poder volver a filtrar sin perder datos
 */
function paint(container, displayedSales, products, customers, allSales) {
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const sorted = sortState.key ? sortRows(displayedSales, sortState.key, sortState.direction) : displayedSales;
  renderSalesPage(container, { sales: sorted, customersById, sortState });
  bindEvents(container, products, customers, allSales, customersById);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedSales, products, customers, allSales);
    },
  });
}

function bindEvents(container, products, customers, allSales, customersById) {
  container.querySelector('#btn-new-sale')
    ?.addEventListener('click', () => openSaleForm(container, products, customers));

  container.querySelector('#sale-search')
    ?.addEventListener('input', debounce((e) => {
      const term = normalizeForSearch(e.target.value.trim());
      const filtered = allSales.filter((s) => {
        const customerName = customersById.get(s.customerId)?.name ?? 'Consumidor final';
        return normalizeForSearch(customerName).includes(term);
      });
      paint(container, filtered, products, customers, allSales);
    }, 250));
}

function openSaleForm(container, products, customers) {
  if (!products.length) {
    showToast({ type: 'warning', message: 'Cargá al menos un producto antes de registrar una venta.' });
    return;
  }

  const data = createEmptySale();

  openModal({
    title: 'Nueva venta',
    contentHtml: saleFormHtml(data, products, customers),
    onMount: (modalEl) => setupCartBehavior(modalEl, products),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Confirmar venta',
        variant: 'primary',
        onClick: async (closeFn) => {
          const payload = readSaleForm(document.getElementById('sale-form'));
          try {
            await saleService.create(payload);
            showToast({ type: 'success', message: 'Venta registrada.' });
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof InsufficientStockError) {
              showToast({ type: 'danger', message: err.message });
            } else if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else {
              handleError(err, 'sales:save');
              closeFn();
            }
          }
        },
      },
    ],
  });
}

function setupCartBehavior(modalEl, products) {
  const list = modalEl.querySelector('#sale-items-list');
  const addBtn = modalEl.querySelector('#btn-add-sale-item');
  const paymentSelect = modalEl.querySelector('#s-payment');
  const amountReceivedField = modalEl.querySelector('#cash-received-field');

  addBtn.addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', buildSaleItemRowHtml(products));
    updateLiveTotals(modalEl);
    focusNewRow(list);
  });

  // Delegación de eventos: cubre filas presentes y futuras sin registrar N listeners.
  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-item]');
    if (!removeBtn) return;
    const rows = list.querySelectorAll('[data-item-row]');
    if (rows.length <= 1) {
      showToast({ type: 'warning', message: 'La venta necesita al menos un producto.' });
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
  list.addEventListener('input', (e) => {
    updateRowSubtotal(e.target.closest('[data-item-row]'));
    updateLiveTotals(modalEl);
  });

  // El campo de efectivo recibido solo tiene sentido para pagos en efectivo.
  paymentSelect?.addEventListener('change', () => {
    const isCash = paymentSelect.value === PAYMENT_METHODS.CASH;
    amountReceivedField.hidden = !isCash;
    if (!isCash) modalEl.querySelector('#s-amount-received').value = '';
    updateLiveTotals(modalEl);
  });

  modalEl.querySelector('#s-amount-received')?.addEventListener('input', () => updateLiveTotals(modalEl));

  list.querySelectorAll('[data-item-row]').forEach(updateRowSubtotal);
  updateLiveTotals(modalEl);
}

/** Autocompleta el precio unitario con el precio de venta del producto elegido.
 *  Siempre pisa el valor anterior: si no lo hiciera, cambiar de producto después
 *  de haber elegido uno primero dejaría el precio del producto viejo pegado
 *  al nuevo, mostrando un total incorrecto sin que se note por qué. */
function autofillPrice(selectEl) {
  const row = selectEl.closest('[data-item-row]');
  const priceInput = row.querySelector('[data-field="unitPrice"]');
  const selectedOption = selectEl.selectedOptions[0];
  const suggestedPrice = selectedOption?.dataset.price;
  if (suggestedPrice) {
    priceInput.value = suggestedPrice;
  }
  updateRowSubtotal(row);
}

/** Actualiza el subtotal (cantidad × precio) mostrado en una línea puntual del carrito. */
function updateRowSubtotal(row) {
  if (!row) return;
  const quantity = Number(row.querySelector('[data-field="quantity"]').value) || 0;
  const unitPrice = Number(row.querySelector('[data-field="unitPrice"]').value) || 0;
  const display = row.querySelector('[data-subtotal-display]');
  if (display) display.textContent = formatCurrency(quantity * unitPrice);
}

function updateLiveTotals(modalEl) {
  const items = readItemsFromForm(modalEl);
  const amountReceivedRaw = modalEl.querySelector('#s-amount-received')?.value;
  const amountReceived = amountReceivedRaw === '' || amountReceivedRaw === undefined ? null : Number(amountReceivedRaw);

  const total = calculateSaleTotal({ items, discount: 0 });
  modalEl.querySelector('#sale-live-total').textContent = formatCurrency(total);

  const changeWrap = modalEl.querySelector('#sale-live-change-wrap');
  const changeEl = modalEl.querySelector('#sale-live-change');
  const change = calculateChange({ items, discount: 0, amountReceived });

  if (change === null) {
    changeWrap.hidden = true;
    return;
  }
  changeWrap.hidden = false;
  const insufficient = change < 0;
  changeEl.textContent = insufficient ? `Falta ${formatCurrency(Math.abs(change))}` : formatCurrency(change);
  changeEl.className = `badge badge--${insufficient ? 'danger' : 'success'}`;
}

function readItemsFromForm(scopeEl) {
  return [...scopeEl.querySelectorAll('[data-item-row]')].map((row) => ({
    productId: row.querySelector('[data-field="productId"]').value,
    quantity: Number(row.querySelector('[data-field="quantity"]').value) || 0,
    unitPrice: Number(row.querySelector('[data-field="unitPrice"]').value) || 0,
  })).filter((it) => it.productId);
}

function readSaleForm(form) {
  const formData = new FormData(form);
  const paymentMethod = formData.get('paymentMethod')?.toString() ?? PAYMENT_METHODS.CASH;
  const amountReceivedRaw = formData.get('amountReceived')?.toString();
  return {
    customerId: formData.get('customerId')?.toString() || null,
    items: readItemsFromForm(form),
    paymentMethod,
    discount: 0, // el descuento ya no se carga desde este formulario — ver sale.model.js
    amountReceived: paymentMethod === PAYMENT_METHODS.CASH && amountReceivedRaw ? Number(amountReceivedRaw) : null,
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
