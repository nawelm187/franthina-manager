/**
 * supplier.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Proveedores.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { escapeHtml, emptyStateMessage } from '../../core/utils.js';
import { icon } from '../../core/icons.js';
import { can } from '../../core/permissions.js';

/** Renderiza solo la tabla — se reusa al buscar, para refrescar nada más
 *  que esta región y no pisar (ni hacerle perder el foco a) el buscador. */
export function renderSuppliersTable({ suppliers: rows, sortState, searchTerm = '' }) {
  return renderDataTable({
    sortKey: sortState?.key ?? null,
    sortDirection: sortState?.direction ?? 'asc',
    columns: [
      { key: 'name', label: 'Nombre', sortable: true },
      { key: 'contactName', label: 'Contacto', render: (r) => escapeHtml(r.contactName || '—') },
      { key: 'phone', label: 'Teléfono', render: (r) => escapeHtml(r.phone || '—') },
      { key: 'leadTimeDays', label: 'Entrega', sortable: true, render: (r) => `${r.leadTimeDays} días` },
    ],
    rows,
    emptyMessage: emptyStateMessage(searchTerm, 'Todavía no cargaste ningún proveedor.'),
    emptyAction: searchTerm ? null : { id: 'btn-empty-new-supplier', label: 'Nuevo proveedor' },
    rowActionsHtml: (row) => `
      <div class="row gap-2">
        <button class="btn btn--ghost btn--icon-only" data-action="edit" data-id="${row.id}" aria-label="Editar ${escapeHtml(row.name)}">${icon('edit')}</button>
        ${can('delete') ? `<button class="btn btn--ghost btn--icon-only" data-action="delete" data-id="${row.id}" aria-label="Eliminar ${escapeHtml(row.name)}">${icon('delete')}</button>` : ''}
      </div>`,
  });
}

export function renderSuppliersPage(container, { suppliers, sortState, searchTerm = '' }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Proveedores</h1>
        <p>Datos de contacto y tiempos de entrega de tus proveedores.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-supplier">
        ${icon('add')} Nuevo proveedor
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="supplier-search">Buscar proveedor</label>
      <input class="input" type="search" id="supplier-search" placeholder="Escribí un nombre..." value="${escapeHtml(searchTerm)}" />
    </div>

    <div id="suppliers-table-region">
      ${renderSuppliersTable({ suppliers, sortState, searchTerm })}
    </div>
  `;
}

export function supplierFormHtml(supplier) {
  return `
    <form id="supplier-form" novalidate>
      <div class="field">
        <label class="field__label" for="sp-name">Nombre <span class="required">*</span></label>
        <input class="input" id="sp-name" name="name" value="${escapeHtml(supplier.name)}" required maxlength="200" />
        <div class="field__error" data-error-for="name" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="sp-contact">Persona de contacto</label>
        <input class="input" id="sp-contact" name="contactName" value="${escapeHtml(supplier.contactName)}" />
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="sp-phone">Teléfono</label>
          <input class="input" type="tel" id="sp-phone" name="phone" value="${escapeHtml(supplier.phone)}" />
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="sp-email">Email</label>
          <input class="input" type="email" id="sp-email" name="email" value="${escapeHtml(supplier.email)}" />
          <div class="field__error" data-error-for="email" hidden></div>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="sp-leadtime">Tiempo de entrega (días)</label>
        <input class="input" type="number" min="0" id="sp-leadtime" name="leadTimeDays" value="${supplier.leadTimeDays}" />
        <div class="field__error" data-error-for="leadTimeDays" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="sp-notes">Notas</label>
        <textarea class="textarea" id="sp-notes" name="notes">${escapeHtml(supplier.notes)}</textarea>
      </div>
    </form>
  `;
}
