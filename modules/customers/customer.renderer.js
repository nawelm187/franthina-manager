/**
 * customer.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Clientes.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { escapeHtml, formatDate, emptyStateMessage } from '../../core/utils.js';
import { icon } from '../../core/icons.js';
import { can } from '../../core/permissions.js';

/** Renderiza solo la tabla — se reusa al buscar, para refrescar nada más
 *  que esta región y no pisar (ni hacerle perder el foco a) el buscador. */
export function renderCustomersTable({ customers: rows, searchTerm = '' }) {
  return renderDataTable({
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'phone', label: 'Teléfono', render: (r) => escapeHtml(r.phone || '—') },
      { key: 'email', label: 'Email', render: (r) => escapeHtml(r.email || '—') },
      { key: 'birthday', label: 'Cumpleaños', render: (r) => r.birthday ? formatDate(r.birthday) : '—' },
    ],
    rows,
    emptyMessage: emptyStateMessage(searchTerm, 'Todavía no cargaste ningún cliente.'),
    emptyAction: searchTerm ? null : { id: 'btn-empty-new-customer', label: 'Nuevo cliente' },
    rowActionsHtml: (row) => `
      <div class="row gap-2">
        <button class="btn btn--ghost btn--icon-only" data-action="edit" data-id="${row.id}" aria-label="Editar ${escapeHtml(row.name)}">${icon('edit')}</button>
        ${can('delete') ? `<button class="btn btn--ghost btn--icon-only" data-action="delete" data-id="${row.id}" aria-label="Eliminar ${escapeHtml(row.name)}">${icon('delete')}</button>` : ''}
      </div>`,
  });
}

export function renderCustomersPage(container, { customers, searchTerm = '' }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Clientes</h1>
        <p>Datos de contacto de tus clientes para pedidos y seguimiento.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-customer">
        ${icon('add')} Nuevo cliente
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="customer-search">Buscar cliente</label>
      <input class="input" type="search" id="customer-search" placeholder="Escribí un nombre..." value="${escapeHtml(searchTerm)}" />
    </div>

    <div id="customers-table-region">
      ${renderCustomersTable({ customers, searchTerm })}
    </div>
  `;
}

export function customerFormHtml(customer) {
  return `
    <form id="customer-form" novalidate>
      <div class="field">
        <label class="field__label" for="c-name">Nombre <span class="required">*</span></label>
        <input class="input" id="c-name" name="name" value="${escapeHtml(customer.name)}" required maxlength="200" />
        <div class="field__error" data-error-for="name" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="c-phone">Teléfono</label>
        <input class="input" type="tel" id="c-phone" name="phone" value="${escapeHtml(customer.phone)}" />
        <div class="field__error" data-error-for="phone" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="c-email">Email</label>
        <input class="input" type="email" id="c-email" name="email" value="${escapeHtml(customer.email)}" />
        <div class="field__error" data-error-for="email" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="c-address">Dirección</label>
        <input class="input" id="c-address" name="address" value="${escapeHtml(customer.address)}" />
      </div>
      <div class="field">
        <label class="field__label" for="c-birthday">Cumpleaños</label>
        <input class="input" type="date" id="c-birthday" name="birthday" value="${escapeHtml(customer.birthday)}" />
      </div>
      <div class="field">
        <label class="field__label" for="c-notes">Notas</label>
        <textarea class="textarea" id="c-notes" name="notes">${escapeHtml(customer.notes)}</textarea>
      </div>
    </form>
  `;
}
