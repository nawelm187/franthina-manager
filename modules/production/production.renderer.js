/**
 * production.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Producción.
 * Nunca guarda datos ni contiene reglas de negocio.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatDate, escapeHtml } from '../../core/utils.js';
import { ORDER_STATUS, ORDER_STATUS_LABELS } from './production.model.js';
import { icon } from '../../core/icons.js';
import { can } from '../../core/permissions.js';

const STATUS_BADGE_VARIANT = {
  [ORDER_STATUS.PLANNED]: 'info',
  [ORDER_STATUS.COMPLETED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'danger',
};

export function renderProductionPage(container, { orders, recipesById }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Producción</h1>
        <p>Planificá lotes de producción a partir de tus recetas y descontá stock automáticamente al completarlos.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-order">
        ${icon('add')} Planificar producción
      </button>
    </header>

    <div id="orders-table-region">
      ${renderDataTable({
        columns: [
          { key: 'plannedDate', label: 'Fecha planificada', render: (r) => formatDate(r.plannedDate) },
          { key: 'recipeId', label: 'Receta', render: (r) => escapeHtml(recipesById.get(r.recipeId)?.name ?? 'Receta eliminada') },
          { key: 'multiplier', label: 'Lotes', render: (r) => `×${r.multiplier}` },
          { key: 'status', label: 'Estado', render: (r) => `<span class="badge badge--${STATUS_BADGE_VARIANT[r.status]}">${ORDER_STATUS_LABELS[r.status]}</span>` },
        ],
        rows: orders,
        emptyMessage: 'Todavía no planificaste ninguna producción.',
        emptyAction: { id: 'btn-empty-new-production', label: 'Planificar producción' },
        rowActionsHtml: (row) => row.status === ORDER_STATUS.PLANNED
          ? `
            <div class="row gap-2">
              <button class="btn btn--secondary" data-action="complete" data-id="${row.id}">${icon('check')} Completar</button>
              <button class="btn btn--ghost btn--icon-only" data-action="cancel" data-id="${row.id}" aria-label="Cancelar">${icon('close')}</button>
              ${can('delete') ? `<button class="btn btn--ghost btn--icon-only" data-action="delete" data-id="${row.id}" aria-label="Eliminar">${icon('delete')}</button>` : ''}
            </div>`
          : '<span class="field__hint">Sin acciones disponibles</span>',
      })}
    </div>
  `;
}

export function orderFormHtml(order, recipes) {
  const options = recipes.map((r) => `<option value="${r.id}" ${r.id === order.recipeId ? 'selected' : ''}>${escapeHtml(r.name)} (rinde ${r.yieldQuantity} ${escapeHtml(r.yieldUnit)})</option>`).join('');

  return `
    <form id="order-form" novalidate>
      <div class="field">
        <label class="field__label" for="o-recipe">Receta <span class="required">*</span></label>
        <select class="select" id="o-recipe" name="recipeId">
          <option value="">Seleccioná una receta…</option>
          ${options}
        </select>
        <div class="field__error" data-error-for="recipeId" hidden></div>
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="o-multiplier">Cantidad de lotes</label>
          <input class="input" type="number" min="1" step="1" id="o-multiplier" name="multiplier" value="${order.multiplier}" />
          <div class="field__error" data-error-for="multiplier" hidden></div>
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="o-date">Fecha planificada</label>
          <input class="input" type="date" id="o-date" name="plannedDate" value="${order.plannedDate}" />
          <div class="field__error" data-error-for="plannedDate" hidden></div>
        </div>
      </div>
      <div id="order-feasibility" class="card" style="background: var(--surface-sunken);">
        Seleccioná una receta para ver los ingredientes necesarios.
      </div>
      <div class="field" style="margin-top: var(--space-4);">
        <label class="field__label" for="o-notes">Notas</label>
        <textarea class="textarea" id="o-notes" name="notes">${escapeHtml(order.notes)}</textarea>
      </div>
    </form>
  `;
}

/** @param {{recipe:object, requirements:object[], feasible:boolean}} feasibility */
export function feasibilityHtml(feasibility) {
  if (!feasibility) return 'Seleccioná una receta para ver los ingredientes necesarios.';

  const rows = feasibility.requirements.map((r) => `
    <li class="row gap-2" style="justify-content:space-between; padding: var(--space-1) 0;">
      <span>${escapeHtml(r.name)}</span>
      <span class="badge badge--${r.enough ? 'success' : 'danger'}">
        ${r.required.toFixed(2)} ${escapeHtml(r.unit)} ${r.enough ? icon('check') : `(disponible: ${r.available.toFixed(2)})`}
      </span>
    </li>`).join('');

  return `
    <strong>${feasibility.feasible ? `${icon('check')} Stock suficiente` : `${icon('warning')} Falta stock para completar esta producción`}</strong>
    <ul style="list-style:none; margin: var(--space-2) 0 0; padding:0;">${rows}</ul>
  `;
}
