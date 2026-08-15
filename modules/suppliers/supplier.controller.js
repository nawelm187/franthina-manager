/**
 * supplier.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Proveedores.
 */

import { supplierService } from './supplier.service.js';
import { renderSuppliersPage, renderSuppliersTable, supplierFormHtml } from './supplier.renderer.js';
import { createEmptySupplier } from './supplier.model.js';
import { openModal } from '../../components/modal.js';
import { confirmAction } from '../../components/confirm.js';
import { withButtonLoading } from '../../core/buttonLoading.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { logAction } from '../../core/auditLog.js';
import { debounce, normalizeForSearch } from '../../core/utils.js';
import { iconElement } from '../../core/icons.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

let sortState = { key: null, direction: 'asc' };
let searchTerm = '';

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let allSuppliers = [];
  try {
    allSuppliers = await supplierService.list();
  } catch (err) {
    handleError(err, 'suppliers:list');
  }
  searchTerm = '';
  paint(container, allSuppliers, allSuppliers);
}

function paint(container, displayedSuppliers, allSuppliers) {
  const sorted = sortState.key ? sortRows(displayedSuppliers, sortState.key, sortState.direction) : displayedSuppliers;
  renderSuppliersPage(container, { suppliers: sorted, sortState, searchTerm });
  bindEvents(container, displayedSuppliers, allSuppliers);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedSuppliers, allSuppliers);
    },
  });
}

/**
 * Actualiza SOLO la región de la tabla — se usa mientras se escribe en el
 * buscador, para no destruir el input y hacerle perder el foco en cada tecleo.
 */
function paintTable(container, displayedSuppliers, allSuppliers) {
  const sorted = sortState.key ? sortRows(displayedSuppliers, sortState.key, sortState.direction) : displayedSuppliers;
  const region = container.querySelector('#suppliers-table-region');
  if (region) region.innerHTML = renderSuppliersTable({ suppliers: sorted, sortState, searchTerm });
  bindRowActions(container, displayedSuppliers, allSuppliers);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedSuppliers, allSuppliers);
    },
  });
}

function bindEvents(container, suppliers, allSuppliers) {
  ['#btn-new-supplier', '#btn-empty-new-supplier'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openSupplierForm(container, null));
  });

  container.querySelector('#supplier-search')
    ?.addEventListener('input', debounce((e) => {
      searchTerm = e.target.value.trim();
      const term = normalizeForSearch(searchTerm);
      const filtered = allSuppliers.filter((s) => normalizeForSearch(s.name).includes(term));
      paintTable(container, filtered, allSuppliers);
    }, 250));

  bindRowActions(container, suppliers, allSuppliers);
}

function bindRowActions(container, suppliers, allSuppliers) {
  container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const supplier = suppliers.find((s) => s.id === btn.dataset.id);
      openSupplierForm(container, supplier);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const supplier = suppliers.find((s) => s.id === btn.dataset.id);
      const confirmed = await confirmAction({
        title: 'Eliminar proveedor',
        message: `¿Seguro que querés eliminar a "${supplier.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await withButtonLoading(btn, () => supplierService.remove(supplier.id), { loadingLabel: 'Eliminando…' });
        logAction({ action: 'Eliminó', entity: 'proveedor', entityId: supplier.id, details: supplier.name });
        showToast({ type: 'success', message: `"${supplier.name}" fue eliminado.` });
        render(null, container);
      } catch (err) {
        handleError(err, 'suppliers:delete');
      }
    });
  });
}

function openSupplierForm(container, supplier) {
  const isEdit = Boolean(supplier);
  const data = supplier ? { ...supplier } : createEmptySupplier();

  openModal({
    title: isEdit ? 'Editar proveedor' : 'Nuevo proveedor',
    contentHtml: supplierFormHtml(data),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: isEdit ? 'Guardar cambios' : 'Crear proveedor',
        variant: 'primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('supplier-form');
          const formData = new FormData(form);
          const payload = {
            name: formData.get('name')?.toString().trim() ?? '',
            contactName: formData.get('contactName')?.toString().trim() ?? '',
            phone: formData.get('phone')?.toString().trim() ?? '',
            email: formData.get('email')?.toString().trim() ?? '',
            leadTimeDays: Number(formData.get('leadTimeDays')) || 0,
            notes: formData.get('notes')?.toString() ?? '',
          };

          try {
            if (isEdit) {
              await supplierService.update(supplier.id, payload);
              showToast({ type: 'success', message: `"${payload.name}" fue actualizado.` });
            } else {
              await supplierService.create(payload);
              showToast({ type: 'success', message: `"${payload.name}" fue creado.` });
            }
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else {
              handleError(err, 'suppliers:save');
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
