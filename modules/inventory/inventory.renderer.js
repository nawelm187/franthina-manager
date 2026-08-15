/**
 * inventory.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Inventario (historial de movimientos).
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatDate, escapeHtml } from '../../core/utils.js';
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPES } from './inventory.model.js';
import { icon } from '../../core/icons.js';

const TYPE_BADGE_VARIANT = {
  [MOVEMENT_TYPES.IN]: 'success',
  [MOVEMENT_TYPES.OUT]: 'info',
  [MOVEMENT_TYPES.ADJUST]: 'warning',
  [MOVEMENT_TYPES.WASTE]: 'danger',
};

export function renderInventoryPage(container, { movements, ingredientsById, sortState }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Inventario</h1>
        <p>Historial de entradas, salidas, ajustes y mermas de ingredientes.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-movement">
        ${icon('add')} Registrar movimiento
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="movement-search">Buscar por ingrediente</label>
      <input class="input" type="search" id="movement-search" placeholder="Escribí un nombre..." />
    </div>

    <div id="movements-table-region">
      ${renderDataTable({
        sortKey: sortState?.key ?? null,
        sortDirection: sortState?.direction ?? 'asc',
        columns: [
          { key: 'createdAt', label: 'Fecha', sortable: true, render: (r) => formatDate(r.createdAt) },
          { key: 'ingredientId', label: 'Ingrediente', render: (r) => escapeHtml(ingredientsById.get(r.ingredientId)?.name ?? 'Ingrediente eliminado') },
          { key: 'type', label: 'Tipo', render: (r) => `<span class="badge badge--${TYPE_BADGE_VARIANT[r.type]}">${MOVEMENT_TYPE_LABELS[r.type]}</span>` },
          { key: 'quantity', label: 'Cantidad', sortable: true },
          { key: 'reason', label: 'Motivo', render: (r) => escapeHtml(r.reason || '—') },
        ],
        rows: movements,
        emptyMessage: 'Todavía no hay movimientos registrados.',
        emptyAction: { id: 'btn-empty-new-movement', label: 'Registrar movimiento' },
      })}
    </div>
  `;
}

export function movementFormHtml(movement, ingredients) {
  const options = ingredients.map((i) => `<option value="${i.id}" ${i.id === movement.ingredientId ? 'selected' : ''}>${escapeHtml(i.name)} (stock: ${i.stock} ${escapeHtml(i.unit)})</option>`).join('');
  const typeOptions = Object.entries(MOVEMENT_TYPE_LABELS)
    .map(([value, label]) => `<option value="${value}" ${movement.type === value ? 'selected' : ''}>${label}</option>`)
    .join('');

  return `
    <form id="movement-form" novalidate>
      <div class="field">
        <label class="field__label" for="m-ingredient">Ingrediente <span class="required">*</span></label>
        <select class="select" id="m-ingredient" name="ingredientId">
          <option value="">Seleccioná un ingrediente…</option>
          ${options}
        </select>
        <div class="field__error" data-error-for="ingredientId" hidden></div>
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="m-type">Tipo de movimiento</label>
          <select class="select" id="m-type" name="type">${typeOptions}</select>
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="m-quantity">Cantidad</label>
          <input class="input" type="number" min="0" step="0.01" id="m-quantity" name="quantity" value="${movement.quantity || ''}" />
          <div class="field__error" data-error-for="quantity" hidden></div>
        </div>
      </div>
      <div class="field__hint" style="margin-bottom: var(--space-4);">
        "Ajuste" fija el stock exactamente en el valor ingresado. Los demás tipos suman o restan sobre el stock actual.
      </div>
      <div class="field">
        <label class="field__label" for="m-reason">Motivo</label>
        <input class="input" id="m-reason" name="reason" value="${escapeHtml(movement.reason)}" placeholder="Ej: compra a proveedor, producción del día, rotura..." />
      </div>
    </form>
  `;
}
