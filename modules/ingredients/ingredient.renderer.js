/**
 * ingredient.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Ingredientes.
 * Nunca guarda datos ni contiene reglas de negocio.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, escapeHtml, emptyStateMessage } from '../../core/utils.js';
import { UNITS } from './ingredient.model.js';
import { icon } from '../../core/icons.js';
import { can } from '../../core/permissions.js';

/** Renderiza solo la tabla — se reusa al buscar, para refrescar nada más
 *  que esta región y no pisar (ni hacerle perder el foco a) el buscador. */
export function renderIngredientsTable({ ingredients: rows, sortState, searchTerm = '' }) {
  return renderDataTable({
    sortKey: sortState?.key ?? null,
    sortDirection: sortState?.direction ?? 'asc',
    columns: [
      { key: 'name', label: 'Nombre', sortable: true },
      { key: 'unit', label: 'Unidad' },
      { key: 'stock', label: 'Stock', sortable: true },
      { key: 'cost', label: 'Costo', sortable: true, render: (r) => formatCurrency(r.cost) },
      {
        key: 'status',
        label: 'Estado',
        render: (r) => r.lowStock
          ? `<span class="badge badge--danger">${icon('warning')} Stock bajo</span>`
          : `<span class="badge badge--success">${icon('check')} OK</span>`,
      },
    ],
    rows,
    emptyMessage: emptyStateMessage(searchTerm, 'Todavía no cargaste ningún ingrediente.'),
    emptyAction: searchTerm ? null : { id: 'btn-empty-new-ingredient', label: 'Nuevo ingrediente' },
    rowActionsHtml: (row) => `
      <div class="row gap-2">
        <button class="btn btn--ghost btn--icon-only" data-action="edit" data-id="${row.id}" aria-label="Editar ${escapeHtml(row.name)}">${icon('edit')}</button>
        ${can('delete') ? `<button class="btn btn--ghost btn--icon-only" data-action="delete" data-id="${row.id}" aria-label="Eliminar ${escapeHtml(row.name)}">${icon('delete')}</button>` : ''}
      </div>`,
  });
}

export function renderIngredientsPage(container, { ingredients, sortState, searchTerm = '' }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Ingredientes</h1>
        <p>Controlá el stock y costo de cada ingrediente usado en las recetas de Franthina.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-ingredient">
        ${icon('add')} Nuevo ingrediente
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="ingredient-search">Buscar ingrediente</label>
      <input class="input" type="search" id="ingredient-search" placeholder="Escribí un nombre..." value="${escapeHtml(searchTerm)}" />
    </div>

    <div id="ingredients-table-region">
      ${renderIngredientsTable({ ingredients, sortState, searchTerm })}
    </div>
  `;
}

export function ingredientFormHtml(item) {
  const unitOptions = UNITS.map((u) => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('');
  return `
    <form id="ingredient-form" novalidate>
      <div class="field">
        <label class="field__label" for="i-name">Nombre <span class="required">*</span></label>
        <input class="input" id="i-name" name="name" value="${escapeHtml(item.name)}" required maxlength="200" />
        <div class="field__error" data-error-for="name" hidden></div>
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="i-unit">Unidad</label>
          <select class="select" id="i-unit" name="unit">${unitOptions}</select>
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="i-cost">Costo por unidad</label>
          <input class="input" type="number" min="0" step="0.01" id="i-cost" name="cost" value="${item.cost}" />
        </div>
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="i-stock">Stock actual</label>
          <input class="input" type="number" min="0" step="0.01" id="i-stock" name="stock" value="${item.stock}" />
          <div class="field__error" data-error-for="stock" hidden></div>
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="i-minstock">Stock mínimo</label>
          <input class="input" type="number" min="0" step="0.01" id="i-minstock" name="minStock" value="${item.minStock}" />
          <div class="field__hint">Se mostrará una alerta cuando el stock llegue a este valor.</div>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="i-supplier">Proveedor</label>
        <input class="input" id="i-supplier" name="supplier" value="${escapeHtml(item.supplier)}" />
      </div>
      <div class="field">
        <label class="field__label" for="i-notes">Notas</label>
        <textarea class="textarea" id="i-notes" name="notes">${escapeHtml(item.notes)}</textarea>
      </div>
    </form>
  `;
}
