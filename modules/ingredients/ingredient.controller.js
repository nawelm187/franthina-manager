/**
 * ingredient.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Ingredientes.
 */

import { ingredientService } from './ingredient.service.js';
import { renderIngredientsPage, renderIngredientsTable, ingredientFormHtml } from './ingredient.renderer.js';
import { createEmptyIngredient } from './ingredient.model.js';
import { openModal } from '../../components/modal.js';
import { confirmAction } from '../../components/confirm.js';
import { withButtonLoading } from '../../core/buttonLoading.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { logAction } from '../../core/auditLog.js';
import { recipeService } from '../recipes/recipe.service.js';
import { debounce, normalizeForSearch } from '../../core/utils.js';
import { iconElement } from '../../core/icons.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

let sortState = { key: null, direction: 'asc' };
let searchTerm = '';

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let allItems = [];
  try {
    allItems = await ingredientService.list();
  } catch (err) {
    handleError(err, 'ingredients:list');
  }
  searchTerm = '';
  paint(container, allItems, allItems);
}

function withLowStockFlag(items) {
  // El estado de "stock bajo" es un valor derivado (no existe como campo en el
  // registro guardado) — se calcula acá, en el Controller, para que el
  // Renderer nunca tenga que conocer ingredientService (ver docs/ARCHITECTURE.md).
  return items.map((i) => ({ ...i, lowStock: ingredientService.isLowStock(i) }));
}

/**
 * @param {HTMLElement} container
 * @param {object[]} displayedItems - lo que se muestra en la tabla (puede estar filtrado por búsqueda)
 * @param {object[]} allItems - la lista completa, SIN filtrar — se usa para la detección de
 *   duplicados al crear/editar, para que no dependa de qué haya quedado visible tras una búsqueda
 */
function paint(container, displayedItems, allItems) {
  const sortedItems = sortState.key ? sortRows(displayedItems, sortState.key, sortState.direction) : displayedItems;
  renderIngredientsPage(container, { ingredients: withLowStockFlag(sortedItems), sortState, searchTerm });
  bindEvents(container, displayedItems, allItems);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedItems, allItems);
    },
  });
}

/**
 * Actualiza SOLO la región de la tabla — se usa mientras se escribe en el
 * buscador, para no destruir el input y hacerle perder el foco en cada tecleo.
 */
function paintTable(container, displayedItems, allItems) {
  const sortedItems = sortState.key ? sortRows(displayedItems, sortState.key, sortState.direction) : displayedItems;
  const region = container.querySelector('#ingredients-table-region');
  if (region) region.innerHTML = renderIngredientsTable({ ingredients: withLowStockFlag(sortedItems), sortState, searchTerm });
  bindRowActions(container, displayedItems, allItems);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedItems, allItems);
    },
  });
}

/**
 * Devuelve las recetas que usan este ingrediente — función pura, extraída
 * para poder probarla sin simular un click real en el DOM.
 * @param {object[]} recipes @param {string} ingredientId
 */
export function findRecipesUsingIngredient(recipes, ingredientId) {
  return recipes.filter((r) => r.items.some((it) => it.ingredientId === ingredientId));
}

/**
 * Busca un ingrediente existente con el mismo nombre, ignorando mayúsculas
 * y acentos ("Harina" / "harina" / "HARINA" se consideran el mismo).
 * Excluye `excludeId` para permitir editar un ingrediente sin que se
 * detecte a sí mismo como duplicado. Función pura, extraída para poder
 * probarla sin simular un click real en el DOM.
 * @param {object[]} items @param {string} name @param {string|null} [excludeId]
 */
export function findDuplicateIngredientName(items, name, excludeId = null) {
  const target = normalizeForSearch(name);
  return items.find((i) => i.id !== excludeId && normalizeForSearch(i.name) === target) ?? null;
}

function bindEvents(container, displayedItems, allItems) {
  ['#btn-new-ingredient', '#btn-empty-new-ingredient'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openIngredientForm(container, null, allItems));
  });

  container.querySelector('#ingredient-search')
    ?.addEventListener('input', debounce((e) => {
      searchTerm = e.target.value.trim();
      const term = normalizeForSearch(searchTerm);
      const filtered = allItems.filter((i) => normalizeForSearch(i.name).includes(term));
      paintTable(container, filtered, allItems);
    }, 250));

  bindRowActions(container, displayedItems, allItems);
}

function bindRowActions(container, displayedItems, allItems) {
  container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = displayedItems.find((i) => i.id === btn.dataset.id);
      openIngredientForm(container, item, allItems);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = displayedItems.find((i) => i.id === btn.dataset.id);

      // Guarda de integridad referencial: vive acá (Controller), no en
      // ingredient.service.js, para no invertir la dependencia
      // recipes -> ingredients ya establecida (ver docs/ARCHITECTURE.md).
      const recipesUsingIngredient = findRecipesUsingIngredient(await recipeService.list(), item.id);
      if (recipesUsingIngredient.length > 0) {
        const names = recipesUsingIngredient.map((r) => r.name).join(', ');
        showToast({ type: 'danger', message: `No se puede eliminar: lo usa la receta "${names}". Quitalo de la receta primero.` });
        return;
      }

      const confirmed = await confirmAction({
        title: 'Eliminar ingrediente',
        message: `¿Seguro que querés eliminar "${item.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await withButtonLoading(btn, () => ingredientService.remove(item.id), { loadingLabel: 'Eliminando…' });
        logAction({ action: 'Eliminó', entity: 'ingrediente', entityId: item.id, details: item.name });
        showToast({ type: 'success', message: `"${item.name}" fue eliminado.` });
        render(null, container);
      } catch (err) {
        handleError(err, 'ingredients:delete');
      }
    });
  });
}

function openIngredientForm(container, item, allItems) {
  const isEdit = Boolean(item);
  const data = item ? { ...item } : createEmptyIngredient();

  openModal({
    title: isEdit ? 'Editar ingrediente' : 'Nuevo ingrediente',
    contentHtml: ingredientFormHtml(data),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: isEdit ? 'Guardar cambios' : 'Crear ingrediente',
        variant: 'primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('ingredient-form');
          const formData = new FormData(form);
          const payload = {
            name: formData.get('name')?.toString().trim() ?? '',
            unit: formData.get('unit')?.toString() ?? 'g',
            cost: Number(formData.get('cost')) || 0,
            stock: Number(formData.get('stock')) || 0,
            minStock: Number(formData.get('minStock')) || 0,
            supplier: formData.get('supplier')?.toString().trim() ?? '',
            notes: formData.get('notes')?.toString() ?? '',
          };

          const duplicate = findDuplicateIngredientName(allItems, payload.name, isEdit ? item.id : null);
          if (duplicate) {
            paintFieldErrors({ name: `Ya existe un ingrediente llamado "${duplicate.name}". Usá ese en vez de crear uno nuevo, o elegí otro nombre.` });
            return;
          }

          try {
            if (isEdit) {
              await ingredientService.update(item.id, payload);
              showToast({ type: 'success', message: `"${payload.name}" fue actualizado.` });
            } else {
              await ingredientService.create(payload);
              showToast({ type: 'success', message: `"${payload.name}" fue creado.` });
            }
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else {
              handleError(err, 'ingredients:save');
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
