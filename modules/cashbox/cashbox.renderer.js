/**
 * cashbox.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Caja.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, formatDate, escapeHtml } from '../../core/utils.js';
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPES } from './cashbox.model.js';
import { icon } from '../../core/icons.js';

const TYPE_BADGE_VARIANT = {
  [MOVEMENT_TYPES.INCOME]: 'success',
  [MOVEMENT_TYPES.EXPENSE]: 'danger',
  [MOVEMENT_TYPES.SALE]: 'info',
};

export function renderCashboxPage(container, { session, movements, expectedAmount, sortState }) {
  container.innerHTML = `
    <header style="margin-bottom: var(--space-5);">
      <h1>Caja</h1>
      <p>Controlá la apertura, los movimientos y el cierre de caja del día.</p>
    </header>

    ${session ? renderOpenSession(session, movements, expectedAmount, sortState) : renderNoSession()}
  `;
}

function renderNoSession() {
  return `
    <div class="card state-panel">
      <span class="state-panel__icon">${icon('point_of_sale')}</span>
      <h3>No hay una caja abierta</h3>
      <p>Abrí la caja para empezar a registrar ventas y movimientos del día.</p>
      <button class="btn btn--primary" id="btn-open-cashbox">Abrir caja</button>
    </div>`;
}

function renderOpenSession(session, movements, expectedAmount, sortState) {
  return `
    <div class="grid-cards" style="margin-bottom: var(--space-5);">
      <div class="card">
        <p style="margin:0; font-size: var(--fs-sm);">Monto de apertura</p>
        <p style="margin:0; font-family: var(--font-display); font-size: var(--fs-2xl); font-weight:700;">${formatCurrency(session.openingAmount)}</p>
      </div>
      <div class="card">
        <p style="margin:0; font-size: var(--fs-sm);">Total esperado ahora</p>
        <p style="margin:0; font-family: var(--font-display); font-size: var(--fs-2xl); font-weight:700;">${formatCurrency(expectedAmount)}</p>
      </div>
    </div>

    <div class="row gap-3" style="margin-bottom: var(--space-5); flex-wrap:wrap;">
      <button class="btn btn--secondary" id="btn-add-income">${icon('add')} Registrar ingreso</button>
      <button class="btn btn--secondary" id="btn-add-expense">${icon('remove')} Registrar egreso</button>
      <button class="btn btn--danger" id="btn-close-cashbox" style="margin-left:auto;">${icon('lock')} Cerrar caja</button>
    </div>

    <h3>Movimientos de esta sesión</h3>
    <div id="movements-table-region">
      ${renderDataTable({
        sortKey: sortState?.key ?? null,
        sortDirection: sortState?.direction ?? 'asc',
        columns: [
          { key: 'createdAt', label: 'Hora', sortable: true, render: (r) => new Date(r.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) },
          { key: 'type', label: 'Tipo', render: (r) => `<span class="badge badge--${TYPE_BADGE_VARIANT[r.type]}">${MOVEMENT_TYPE_LABELS[r.type]}</span>` },
          { key: 'amount', label: 'Monto', sortable: true, render: (r) => formatCurrency(r.type === 'expense' ? -r.amount : r.amount) },
          { key: 'reason', label: 'Motivo', render: (r) => escapeHtml(r.reason) },
        ],
        rows: movements,
        emptyMessage: 'Todavía no hay movimientos en esta sesión.',
      })}
    </div>
  `;
}

export function openingFormHtml() {
  return `
    <form id="opening-form" novalidate>
      <div class="field">
        <label class="field__label" for="op-amount">Monto de apertura</label>
        <input class="input" type="number" min="0" step="0.01" id="op-amount" name="openingAmount" value="0" />
        <div class="field__error" data-error-for="openingAmount" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="op-notes">Notas</label>
        <textarea class="textarea" id="op-notes" name="notes"></textarea>
      </div>
    </form>`;
}

export function movementFormHtml(type) {
  return `
    <form id="cashbox-movement-form" novalidate>
      <div class="field">
        <label class="field__label" for="mv-amount">Monto</label>
        <input class="input" type="number" min="0" step="0.01" id="mv-amount" name="amount" />
        <div class="field__error" data-error-for="amount" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="mv-reason">Motivo</label>
        <input class="input" id="mv-reason" name="reason" placeholder="${type === 'expense' ? 'Ej: compra de insumos, flete...' : 'Ej: aporte extra, cobro de deuda...'}" />
        <div class="field__error" data-error-for="reason" hidden></div>
      </div>
    </form>`;
}

export function closingFormHtml(expectedAmount) {
  return `
    <form id="closing-form" novalidate>
      <p class="field__hint">Total esperado según los movimientos registrados: <strong>${formatCurrency(expectedAmount)}</strong></p>
      <div class="field">
        <label class="field__label" for="cl-amount">Efectivo contado en caja</label>
        <input class="input" type="number" min="0" step="0.01" id="cl-amount" name="closingAmountCounted" />
        <div class="field__error" data-error-for="closingAmountCounted" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="cl-notes">Notas del cierre</label>
        <textarea class="textarea" id="cl-notes" name="notes"></textarea>
      </div>
    </form>`;
}

export function sessionSummaryHtml(session) {
  const diffVariant = session.difference < 0 ? 'danger' : 'success';
  const diffLabel = session.difference === 0 ? 'Caja exacta' : session.difference > 0 ? 'Sobrante' : 'Faltante';
  return `
    <p>Caja cerrada el ${formatDate(session.closedAt)}.</p>
    <ul style="list-style:none; padding:0; margin:0;">
      <li>Apertura: ${formatCurrency(session.openingAmount)}</li>
      <li>Esperado: ${formatCurrency(session.expectedAmount)}</li>
      <li>Contado: ${formatCurrency(session.closingAmountCounted)}</li>
      <li><span class="badge badge--${diffVariant}">${diffLabel}: ${formatCurrency(Math.abs(session.difference))}</span></li>
    </ul>`;
}
