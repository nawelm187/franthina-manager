/**
 * recipe.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Recetas.
 * Incluye la lógica de líneas de ingredientes dinámicas y el cálculo de costo en vivo
 * dentro del formulario — esta orquestación de UI vive acá, no en el renderer.
 */

import { recipeService } from './recipe.service.js';
import { renderRecipesPage, renderRecipesTable, recipeFormHtml, buildItemRowHtml } from './recipe.renderer.js';
import { createEmptyRecipe } from './recipe.model.js';
import { openModal } from '../../components/modal.js';
import { confirmAction } from '../../components/confirm.js';
import { withButtonLoading } from '../../core/buttonLoading.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { logAction } from '../../core/auditLog.js';
import { debounce, formatCurrency, focusNewRow, normalizeForSearch } from '../../core/utils.js';
import { productService } from '../products/product.service.js';
import { compatibleUnitsFor, areCompatibleUnits } from '../../core/units.js';
import { iconElement } from '../../core/icons.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

let sortState = { key: null, direction: 'asc' };
let searchTerm = '';

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let allRecipes = [];
  let ingredients = [];
  try {
    [allRecipes, ingredients] = await Promise.all([
      recipeService.list(),
      recipeService.listIngredientsForCosting(),
    ]);
  } catch (err) {
    handleError(err, 'recipes:list');
    return;
  }

  const costsById = new Map(
    allRecipes.map((r) => [r.id, recipeService.calculateCost(r, ingredients)])
  );

  searchTerm = '';
  paint(container, allRecipes, ingredients, costsById, allRecipes);
}

function paint(container, displayedRecipes, ingredients, costsById, allRecipes) {
  const sortedRecipes = sortState.key ? sortRows(displayedRecipes, sortState.key, sortState.direction) : displayedRecipes;
  renderRecipesPage(container, { recipes: sortedRecipes, costsById, sortState, searchTerm });
  bindEvents(container, displayedRecipes, ingredients, allRecipes, costsById);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedRecipes, ingredients, costsById, allRecipes);
    },
  });
}

/**
 * Actualiza SOLO la región de la tabla — se usa mientras se escribe en el
 * buscador, para no destruir el input y hacerle perder el foco en cada tecleo.
 */
function paintTable(container, displayedRecipes, ingredients, costsById, allRecipes) {
  const sortedRecipes = sortState.key ? sortRows(displayedRecipes, sortState.key, sortState.direction) : displayedRecipes;
  const region = container.querySelector('#recipes-table-region');
  if (region) region.innerHTML = renderRecipesTable({ recipes: sortedRecipes, costsById, sortState, searchTerm });
  bindRowActions(container, displayedRecipes, ingredients, allRecipes, costsById);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedRecipes, ingredients, costsById, allRecipes);
    },
  });
}

/**
 * Devuelve los productos que tienen esta receta vinculada — función pura,
 * extraída para poder probarla sin simular un click real en el DOM.
 * @param {object[]} products @param {string} recipeId
 */
export function findProductsUsingRecipe(products, recipeId) {
  return products.filter((p) => p.recipeId === recipeId);
}

function bindEvents(container, recipes, ingredients, allRecipes, costsById) {
  ['#btn-new-recipe', '#btn-empty-new-recipe'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openRecipeForm(container, null, ingredients));
  });

  container.querySelector('#recipe-search')
    ?.addEventListener('input', debounce((e) => {
      searchTerm = e.target.value.trim();
      const term = normalizeForSearch(searchTerm);
      const filtered = allRecipes.filter((r) => normalizeForSearch(r.name).includes(term));
      paintTable(container, filtered, ingredients, costsById, allRecipes);
    }, 250));

  bindRowActions(container, recipes, ingredients, allRecipes, costsById);
}

function bindRowActions(container, recipes, ingredients, allRecipes, costsById) {
  container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const recipe = recipes.find((r) => r.id === btn.dataset.id);
      openRecipeForm(container, recipe, ingredients);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const recipe = recipes.find((r) => r.id === btn.dataset.id);

      // Guarda de integridad referencial: vive acá (Controller), no en
      // recipe.service.js, para no invertir la dependencia products -> recipes
      // ya establecida (ver docs/ARCHITECTURE.md). Es una lectura, no una
      // escritura, así que no participa del grafo de dependencias de negocio.
      const productsUsingRecipe = findProductsUsingRecipe(await productService.list(), recipe.id);
      if (productsUsingRecipe.length > 0) {
        const names = productsUsingRecipe.map((p) => p.name).join(', ');
        showToast({ type: 'danger', message: `No se puede eliminar: la usa el producto "${names}". Desvinculala primero.` });
        return;
      }

      const confirmed = await confirmAction({
        title: 'Eliminar receta',
        message: `¿Seguro que querés eliminar "${recipe.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await withButtonLoading(btn, () => recipeService.remove(recipe.id), { loadingLabel: 'Eliminando…' });
        logAction({ action: 'Eliminó', entity: 'receta', entityId: recipe.id, details: recipe.name });
        showToast({ type: 'success', message: `"${recipe.name}" fue eliminada.` });
        render(null, container);
      } catch (err) {
        handleError(err, 'recipes:delete');
      }
    });
  });
}

function openRecipeForm(container, recipe, ingredients) {
  if (!ingredients.length) {
    showToast({ type: 'warning', message: 'Cargá al menos un ingrediente antes de crear una receta.' });
    return;
  }

  const isEdit = Boolean(recipe);
  const data = recipe ? { ...recipe, items: recipe.items.map((it) => ({ ...it })) } : createEmptyRecipe();

  openModal({
    title: isEdit ? 'Editar receta' : 'Nueva receta',
    contentHtml: recipeFormHtml(data, ingredients),
    onMount: (modalEl) => setupFormBehavior(modalEl, ingredients),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: isEdit ? 'Guardar cambios' : 'Crear receta',
        variant: 'primary',
        onClick: async (closeFn) => {
          const payload = readRecipeForm(document.getElementById('recipe-form'));

          const incompatible = payload.items.find((it) => {
            const ing = ingredients.find((i) => i.id === it.ingredientId);
            return ing && it.unit && !areCompatibleUnits(it.unit, ing.unit);
          });
          if (incompatible) {
            paintFieldErrors({ items: 'Hay una línea con una unidad que no se puede convertir a la del ingrediente elegido (por ejemplo, mezclar masa con volumen). Revisá el selector de unidad de esa línea.' });
            return;
          }

          try {
            if (isEdit) {
              await recipeService.update(recipe.id, payload);
              showToast({ type: 'success', message: `"${payload.name}" fue actualizada.` });
            } else {
              await recipeService.create(payload);
              showToast({ type: 'success', message: `"${payload.name}" fue creada.` });
            }
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else {
              handleError(err, 'recipes:save');
              closeFn();
            }
          }
        },
      },
    ],
  });
}

function setupFormBehavior(modalEl, ingredients) {
  const list = modalEl.querySelector('#recipe-items-list');
  const addBtn = modalEl.querySelector('#btn-add-item');

  addBtn.addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', buildItemRowHtml(ingredients));
    updateLiveCost(modalEl, ingredients);
    focusNewRow(list);
  });

  // Delegación de eventos: cubre filas presentes y futuras sin registrar N listeners.
  list.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-item]');
    if (!removeBtn) return;
    const rows = list.querySelectorAll('[data-item-row]');
    if (rows.length <= 1) {
      showToast({ type: 'warning', message: 'La receta necesita al menos un ingrediente.' });
      return;
    }
    removeBtn.closest('[data-item-row]').remove();
    updateLiveCost(modalEl, ingredients);
  });

  list.addEventListener('input', () => updateLiveCost(modalEl, ingredients));
  list.addEventListener('change', (e) => {
    const ingredientSelect = e.target.closest('[data-field="ingredientId"]');
    if (ingredientSelect) updateUnitOptionsForRow(ingredientSelect, ingredients);
    updateLiveCost(modalEl, ingredients);
  });
  modalEl.querySelector('#r-yield-qty')?.addEventListener('input', () => updateLiveCost(modalEl, ingredients));

  updateLiveCost(modalEl, ingredients);
}

/**
 * Cuando se elige un ingrediente distinto en una línea, el selector de
 * unidad de esa línea se repuebla con las unidades compatibles con ese
 * ingrediente (misma dimensión: masa, volumen o unidad) y vuelve a su
 * unidad por defecto — evita dejar seleccionada una unidad de una
 * dimensión distinta a la del nuevo ingrediente.
 */
function updateUnitOptionsForRow(ingredientSelect, ingredients) {
  const row = ingredientSelect.closest('[data-item-row]');
  const unitSelect = row.querySelector('[data-field="unit"]');
  const ingredient = ingredients.find((i) => i.id === ingredientSelect.value);
  if (!ingredient || !unitSelect) return;
  unitSelect.innerHTML = compatibleUnitsFor(ingredient.unit)
    .map((u) => `<option value="${u}" ${u === ingredient.unit ? 'selected' : ''}>${u}</option>`)
    .join('');
}

function updateLiveCost(modalEl, ingredients) {
  const items = readItemsFromForm(modalEl);
  const yieldQuantity = Number(modalEl.querySelector('#r-yield-qty')?.value) || 1;
  const { totalCost, costPerUnit, missing, incompatibleUnits } = recipeService.calculateCost({ items, yieldQuantity }, ingredients);

  const el = modalEl.querySelector('#recipe-live-cost');
  if (!el) return;
  el.textContent = `Total: ${formatCurrency(totalCost)} · Por unidad: ${formatCurrency(costPerUnit)}`;
  if (missing.length) el.textContent += ' (hay ingredientes sin seleccionar)';
  if (incompatibleUnits.length) el.textContent += ' (hay una unidad que no se puede convertir para ese ingrediente)';
}

function readItemsFromForm(scopeEl) {
  return [...scopeEl.querySelectorAll('[data-item-row]')].map((row) => ({
    ingredientId: row.querySelector('[data-field="ingredientId"]').value,
    quantity: Number(row.querySelector('[data-field="quantity"]').value) || 0,
    unit: row.querySelector('[data-field="unit"]')?.value || null,
  })).filter((it) => it.ingredientId);
}

function readRecipeForm(form) {
  const formData = new FormData(form);
  return {
    name: formData.get('name')?.toString().trim() ?? '',
    items: readItemsFromForm(form),
    yieldQuantity: Number(formData.get('yieldQuantity')) || 0,
    yieldUnit: formData.get('yieldUnit')?.toString().trim() || 'unidad',
    prepTimeMinutes: Number(formData.get('prepTimeMinutes')) || 0,
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
