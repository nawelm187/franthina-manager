/**
 * customer.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Clientes.
 */

import { customerService } from './customer.service.js';
import { renderCustomersPage, renderCustomersTable, customerFormHtml } from './customer.renderer.js';
import { createEmptyCustomer } from './customer.model.js';
import { openModal } from '../../components/modal.js';
import { confirmAction } from '../../components/confirm.js';
import { withButtonLoading } from '../../core/buttonLoading.js';
import { showToast } from '../../components/toast.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { logAction } from '../../core/auditLog.js';
import { debounce, normalizeForSearch } from '../../core/utils.js';
import { iconElement } from '../../core/icons.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

let searchTerm = '';

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let customers = [];
  try {
    customers = await customerService.list();
  } catch (err) {
    handleError(err, 'customers:list');
  }
  searchTerm = '';
  paint(container, customers);
}

function paint(container, customers) {
  renderCustomersPage(container, { customers, searchTerm });
  bindEvents(container, customers);
}

/**
 * Actualiza SOLO la región de la tabla — se usa mientras se escribe en el
 * buscador, para no destruir el input y hacerle perder el foco en cada tecleo.
 */
function paintTable(container, displayedCustomers, allCustomers) {
  const region = container.querySelector('#customers-table-region');
  if (region) region.innerHTML = renderCustomersTable({ customers: displayedCustomers, searchTerm });
  bindRowActions(container, displayedCustomers, allCustomers);
}

function bindEvents(container, allCustomers) {
  ['#btn-new-customer', '#btn-empty-new-customer'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openCustomerForm(container, null));
  });

  container.querySelector('#customer-search')
    ?.addEventListener('input', debounce((e) => {
      searchTerm = e.target.value.trim();
      const term = normalizeForSearch(searchTerm);
      const filtered = allCustomers.filter((c) => normalizeForSearch(c.name).includes(term));
      paintTable(container, filtered, allCustomers);
    }, 250));

  bindRowActions(container, allCustomers, allCustomers);
}

function bindRowActions(container, displayedCustomers, allCustomers) {
  container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const customer = displayedCustomers.find((c) => c.id === btn.dataset.id);
      openCustomerForm(container, customer);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const customer = displayedCustomers.find((c) => c.id === btn.dataset.id);
      const confirmed = await confirmAction({
        title: 'Eliminar cliente',
        message: `¿Seguro que querés eliminar a "${customer.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await withButtonLoading(btn, () => customerService.remove(customer.id), { loadingLabel: 'Eliminando…' });
        logAction({ action: 'Eliminó', entity: 'cliente', entityId: customer.id, details: customer.name });
        showToast({ type: 'success', message: `"${customer.name}" fue eliminado.` });
        render(null, container);
      } catch (err) {
        handleError(err, 'customers:delete');
      }
    });
  });
}

function openCustomerForm(container, customer) {
  const isEdit = Boolean(customer);
  const data = customer ? { ...customer } : createEmptyCustomer();

  openModal({
    title: isEdit ? 'Editar cliente' : 'Nuevo cliente',
    contentHtml: customerFormHtml(data),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: isEdit ? 'Guardar cambios' : 'Crear cliente',
        variant: 'primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('customer-form');
          const formData = new FormData(form);
          const payload = {
            name: formData.get('name')?.toString().trim() ?? '',
            phone: formData.get('phone')?.toString().trim() ?? '',
            email: formData.get('email')?.toString().trim() ?? '',
            address: formData.get('address')?.toString().trim() ?? '',
            birthday: formData.get('birthday')?.toString() ?? '',
            notes: formData.get('notes')?.toString() ?? '',
          };

          try {
            if (isEdit) {
              await customerService.update(customer.id, payload);
              showToast({ type: 'success', message: `"${payload.name}" fue actualizado.` });
            } else {
              await customerService.create(payload);
              showToast({ type: 'success', message: `"${payload.name}" fue creado.` });
            }
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else {
              handleError(err, 'customers:save');
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
