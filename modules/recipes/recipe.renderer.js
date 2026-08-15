/**
 * recipe.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Recetas.
 * Nunca guarda datos ni contiene reglas de negocio — recibe costos ya calculados.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, escapeHtml, emptyStateMessage } from '../../core/utils.js';
import { compatibleUnitsFor } from '../../core/units.js';
import { icon } from '../../core/icons.js';
import { can } from '../../core/permissions.js';

/** Renderiza solo la tabla — se reusa al buscar, para refrescar nada más
 *  que esta región y no pisar (ni hacerle perder el foco a) el buscador. */
export function renderRecipesTable({ recipes: rows, costsById, sortState, searchTerm = '' }) {
  return renderDataTable({
    sortKey: sortState?.key ?? null,
    sortDirection: sortState?.direction ?? 'asc',
    columns: [
      { key: 'name', label: 'Nombre', sortable: true },
      { key: 'items', label: 'Ingredientes', render: (r) => `${r.items.length}` },
      { key: 'yield', label: 'Rendimiento', render: (r) => `${r.yieldQuantity} ${escapeHtml(r.yieldUnit)}` },
      { key: 'totalCost', label: 'Costo total', render: (r) => formatCurrency(costsById.get(r.id)?.totalCost ?? 0) },
      { key: 'costPerUnit', label: 'Costo/unidad', render: (r) => formatCurrency(costsById.get(r.id)?.costPerUnit ?? 0) },
      { key: 'version', label: 'Versión', render: (r) => `v${r.version}` },
    ],
    rows,
    emptyMessage: emptyStateMessage(searchTerm, 'Todavía no cargaste ninguna receta.'),
    emptyAction: searchTerm ? null : { id: 'btn-empty-new-recipe', label: 'Nueva receta' },
    rowActionsHtml: (row) => `
      <div class="row gap-2">
        <button class="btn btn--ghost btn--icon-only" data-action="edit" data-id="${row.id}" aria-label="Editar ${escapeHtml(row.name)}">${icon('edit')}</button>
        ${can('delete') ? `<button class="btn btn--ghost btn--icon-only" data-action="delete" data-id="${row.id}" aria-label="Eliminar ${escapeHtml(row.name)}">${icon('delete')}</button>` : ''}
      </div>`,
  });
}

export function renderRecipesPage(container, { recipes, costsById, sortState, searchTerm = '' }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Recetas</h1>
        <p>Costo calculado automáticamente a partir del precio actual de cada ingrediente.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-recipe">
        ${icon('add')} Nueva receta
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="recipe-search">Buscar receta</label>
      <input class="input" type="search" id="recipe-search" placeholder="Escribí un nombre..." value="${escapeHtml(searchTerm)}" />
    </div>

    <div id="recipes-table-region">
      ${renderRecipesTable({ recipes, costsById, sortState, searchTerm })}
    </div>
  `;
}

/**
 * @param {import('./recipe.model.js').Recipe} recipe
 * @param {import('../ingredients/ingredient.model.js').Ingredient[]} ingredients
 */
export function recipeFormHtml(recipe, ingredients) {
  const rows = recipe.items.length
    ? recipe.items.map((item) => recipeItemRowHtml(item, ingredients))
    : [recipeItemRowHtml({ ingredientId: '', quantity: 0, unit: null }, ingredients)];

  return `
    <form id="recipe-form" novalidate>
      <div class="field">
        <label class="field__label" for="r-name">Nombre <span class="required">*</span></label>
        <input class="input" id="r-name" name="name" value="${escapeHtml(recipe.name)}" required maxlength="200" />
        <div class="field__error" data-error-for="name" hidden></div>
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="r-yield-qty">Rendimiento</label>
          <input class="input" type="number" min="0" step="0.01" id="r-yield-qty" name="yieldQuantity" value="${recipe.yieldQuantity}" />
          <div class="field__error" data-error-for="yieldQuantity" hidden></div>
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="r-yield-unit">Unidad de rendimiento</label>
          <input class="input" id="r-yield-unit" name="yieldUnit" value="${escapeHtml(recipe.yieldUnit)}" />
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="r-prep-time">Tiempo de preparación (min)</label>
          <input class="input" type="number" min="0" id="r-prep-time" name="prepTimeMinutes" value="${recipe.prepTimeMinutes}" />
        </div>
      </div>

      <fieldset style="border:none; padding:0; margin-bottom: var(--space-4);">
        <legend class="field__label">Ingredientes <span class="required">*</span></legend>
        <div id="recipe-items-list" class="stack gap-2">${rows.join('')}</div>
        <div class="field__error" data-error-for="items" hidden style="margin-top: var(--space-2);"></div>
        <button type="button" class="btn btn--secondary" id="btn-add-item" style="margin-top: var(--space-2);">
          ${icon('add')} Agregar ingrediente
        </button>
      </fieldset>

      <div class="card" style="background: var(--surface-sunken);">
        <strong>Costo estimado en vivo:</strong>
        <span id="recipe-live-cost">calculando…</span>
      </div>

      <div class="field" style="margin-top: var(--space-4);">
        <label class="field__label" for="r-notes">Notas</label>
        <textarea class="textarea" id="r-notes" name="notes">${escapeHtml(recipe.notes)}</textarea>
      </div>
    </form>
  `;
}

let itemRowCounter = 0;

function recipeItemRowHtml(item, ingredients) {
  itemRowCounter += 1;
  const rowId = `row-${itemRowCounter}`;
  const options = ingredients
    .map((i) => `<option value="${i.id}" data-unit="${i.unit}" ${i.id === item.ingredientId ? 'selected' : ''}>${escapeHtml(i.name)} (${escapeHtml(i.unit)})</option>`)
    .join('');
  const selectedIngredient = ingredients.find((i) => i.id === item.ingredientId);
  const unitOptionsHtml = unitOptionsFor(item.unit || selectedIngredient?.unit || 'g', item.unit || selectedIngredient?.unit);
  return `
    <div class="row gap-2" data-item-row="${rowId}">
      <select class="select" data-field="ingredientId" style="flex:2;">
        <option value="">Seleccioná un ingrediente…</option>
        ${options}
      </select>
      <input class="input" type="number" min="0" step="0.01" data-field="quantity" value="${item.quantity || ''}" placeholder="Cantidad" style="flex:1;" />
      <select class="select" data-field="unit" style="flex:1;">${unitOptionsHtml}</select>
      <button type="button" class="btn btn--ghost btn--icon-only" data-remove-item aria-label="Quitar ingrediente">${icon('delete')}</button>
    </div>`;
}

/** Genera las <option> de unidades compatibles con `baseUnit`, marcando `selected` como elegida. */
function unitOptionsFor(baseUnit, selected) {
  return compatibleUnitsFor(baseUnit)
    .map((u) => `<option value="${u}" ${u === selected ? 'selected' : ''}>${u}</option>`)
    .join('');
}

export function buildItemRowHtml(ingredients) {
  return recipeItemRowHtml({ ingredientId: '', quantity: 0, unit: null }, ingredients);
}
