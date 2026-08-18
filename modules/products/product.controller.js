/**
 * product.controller.js
 * Responsabilidad: coordinar la Vista (renderer), el Service, eventos y validaciones
 * del módulo Productos. Es el único archivo del módulo que conoce tanto al Service
 * como al Renderer.
 */

import { productService } from './product.service.js';
import { renderProductsPage, renderProductsTable, productFormHtml } from './product.renderer.js';
import { createEmptyProduct } from './product.model.js';
import { openModal } from '../../components/modal.js';
import { confirmAction } from '../../components/confirm.js';
import { withButtonLoading } from '../../core/buttonLoading.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { debounce, formatCurrency, normalizeForSearch, normalizeImageUrl } from '../../core/utils.js';
import { logAction } from '../../core/auditLog.js';
import { iconElement } from '../../core/icons.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';
import { uploadProductImage } from '../../core/imageUpload.js';

let sortState = { key: null, direction: 'asc' };
let searchTerm = '';

/** @param {object} params @param {HTMLElement} container */
export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let allProducts = [];
  let recipes = [];
  try {
    [allProducts, recipes] = await Promise.all([
      productService.list(),
      productService.listRecipesForForm(),
    ]);
  } catch (err) {
    handleError(err, 'products:list');
  }

  searchTerm = '';
  paint(container, allProducts, recipes, allProducts);
}

function withMargin(products) {
  // El margen es un valor derivado (no existe como campo en el registro guardado) —
  // se calcula acá, antes de ordenar, para que ordenar por "Margen" funcione
  // sobre el valor real y no sobre un campo inexistente en el dato crudo.
  return products.map((p) => ({ ...p, marginPct: productService.margin(p) }));
}

/**
 * @param {HTMLElement} container
 * @param {object[]} displayedProducts - lo que se muestra en la tabla (puede estar filtrado por búsqueda)
 * @param {object[]} recipes
 * @param {object[]} allProducts - la lista completa, SIN filtrar — se usa para la detección de
 *   duplicados al crear/editar, para que no dependa de qué haya quedado visible tras una búsqueda
 */
function paint(container, displayedProducts, recipes, allProducts) {
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const sortedProducts = sortState.key ? sortRows(withMargin(displayedProducts), sortState.key, sortState.direction) : withMargin(displayedProducts);
  renderProductsPage(container, { products: sortedProducts, recipesById, sortState, searchTerm });
  bindEvents(container, displayedProducts, recipes, allProducts);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedProducts, recipes, allProducts);
    },
  });
}

/**
 * Actualiza SOLO la región de la tabla (no el buscador ni el resto de la
 * página) — se usa mientras se escribe en el buscador, para no destruir el
 * input y hacerle perder el foco en cada tecleo (ver dataTable.js).
 */
function paintTable(container, displayedProducts, recipes, allProducts) {
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const sortedProducts = sortState.key ? sortRows(withMargin(displayedProducts), sortState.key, sortState.direction) : withMargin(displayedProducts);
  const region = container.querySelector('#products-table-region');
  if (region) region.innerHTML = renderProductsTable({ products: sortedProducts, recipesById, sortState, searchTerm });
  bindRowActions(container, displayedProducts, recipes, allProducts);
  bindTableSorting(container, {
    currentSort: sortState,
    onSort: (key, direction) => {
      sortState = { key, direction };
      paint(container, displayedProducts, recipes, allProducts);
    },
  });
}

/**
 * Busca un producto existente con el mismo nombre, ignorando mayúsculas y
 * acentos. Excluye `excludeId` para permitir editar sin auto-detectarse.
 * Función pura, extraída para poder probarla sin simular un click en el DOM.
 * @param {object[]} products @param {string} name @param {string|null} [excludeId]
 */
export function findDuplicateProductName(products, name, excludeId = null) {
  const target = normalizeForSearch(name);
  return products.find((p) => p.id !== excludeId && normalizeForSearch(p.name) === target) ?? null;
}

function bindEvents(container, currentProducts, recipes, allProducts) {
  ['#btn-new-product', '#btn-empty-new-product'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('click', () => openProductForm(container, null, recipes, allProducts));
  });

  container.querySelector('#product-search')
    ?.addEventListener('input', debounce((e) => {
      searchTerm = e.target.value.trim();
      const term = normalizeForSearch(searchTerm);
      const filtered = allProducts.filter((p) => normalizeForSearch(p.name).includes(term));
      paintTable(container, filtered, recipes, allProducts);
    }, 250));

  bindRowActions(container, currentProducts, recipes, allProducts);
}

function bindRowActions(container, currentProducts, recipes, allProducts) {
  container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = currentProducts.find((p) => p.id === btn.dataset.id);
      openProductForm(container, product, recipes, allProducts);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const product = currentProducts.find((p) => p.id === btn.dataset.id);
      const confirmed = await confirmAction({
        title: 'Eliminar producto',
        message: `¿Seguro que querés eliminar "${product.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await withButtonLoading(btn, () => productService.remove(product.id), { loadingLabel: 'Eliminando…' });
        logAction({ action: 'Eliminó', entity: 'producto', entityId: product.id, details: product.name });
        showToast({ type: 'success', message: `"${product.name}" fue eliminado.` });
        render(null, container);
      } catch (err) {
        handleError(err, 'products:delete');
      }
    });
  });
}

function openProductForm(container, product, recipes, allProducts) {
  const isEdit = Boolean(product);
  const data = product ? { ...product } : createEmptyProduct();

  openModal({
    title: isEdit ? 'Editar producto' : 'Nuevo producto',
    contentHtml: productFormHtml(data, recipes),
    onMount: (modalEl) => {
      setupRecipeSync(modalEl, isEdit ? product.id : null);
      setupImagePreview(modalEl);
      setupImageUpload(modalEl);
    },
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: isEdit ? 'Guardar cambios' : 'Crear producto',
        variant: 'primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('product-form');
          const formData = new FormData(form);
          const payload = {
            name: formData.get('name')?.toString().trim() ?? '',
            category: formData.get('category')?.toString().trim() || 'General',
            recipeId: formData.get('recipeId')?.toString() || null,
            costPrice: Number(formData.get('costPrice')) || 0,
            sellPrice: Number(formData.get('sellPrice')) || 0,
            stock: Number(formData.get('stock')) || 0,
            active: formData.get('active') === 'on',
            notes: formData.get('notes')?.toString() ?? '',
            description: formData.get('description')?.toString().trim() ?? '',
            imageUrl: normalizeImageUrl(formData.get('imageUrl')?.toString().trim() ?? ''),
          };

          const duplicate = findDuplicateProductName(allProducts, payload.name, isEdit ? product.id : null);
          if (duplicate) {
            paintFieldErrors({ name: `Ya existe un producto llamado "${duplicate.name}". Usá ese en vez de crear uno nuevo, o elegí otro nombre.` });
            return;
          }

          try {
            if (isEdit) {
              await productService.update(product.id, payload);
              if (product.sellPrice !== payload.sellPrice) {
                logAction({
                  action: 'Modificó precio',
                  entity: 'producto',
                  entityId: product.id,
                  details: `${payload.name}: ${formatCurrency(product.sellPrice)} → ${formatCurrency(payload.sellPrice)}`,
                });
              }
              showToast({ type: 'success', message: `"${payload.name}" fue actualizado.` });
            } else {
              await productService.create(payload);
              showToast({ type: 'success', message: `"${payload.name}" fue creado.` });
            }
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) {
              paintFieldErrors(err.fieldErrors);
            } else {
              handleError(err, 'products:save');
              closeFn();
            }
          }
        },
      },
    ],
  });
}

/**
 * Conecta el selector de receta con el botón de sincronizar costo: se
 * habilita/deshabilita según haya o no una receta elegida, y al presionarlo
 * llama al Service (nunca calcula el costo acá — eso es lógica de negocio).
 */
/**
 * Vista previa en vivo de la URL de foto: apenas se escribe/pega un link,
 * se intenta cargar y se avisa si no es una imagen válida — así no hay que
 * guardar el producto y después ir a la tienda para descubrir que el link
 * no funcionaba.
 */
function setupImagePreview(modalEl) {
  const input = modalEl.querySelector('#f-image');
  const wrap = modalEl.querySelector('#image-preview-wrap');
  const img = modalEl.querySelector('#image-preview');
  const errorEl = modalEl.querySelector('#image-preview-error');
  if (!input || !wrap || !img || !errorEl) return;

  function update() {
    const raw = input.value.trim();
    if (!raw) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    errorEl.hidden = true;
    img.hidden = false;
    img.src = normalizeImageUrl(raw);
  }

  img.addEventListener('error', () => {
    if (!input.value.trim()) return;
    img.hidden = true;
    errorEl.hidden = false;
  });
  img.addEventListener('load', () => {
    errorEl.hidden = true;
    img.hidden = false;
  });
  input.addEventListener('input', update);
}

/**
 * Zona de arrastrar-y-soltar (o tocar para elegir archivo) que sube la
 * imagen y completa el campo de URL sola — dispara el mismo evento
 * 'input' que setupImagePreview() ya escucha, así la vista previa se
 * actualiza sin duplicar esa lógica acá.
 */
function setupImageUpload(modalEl) {
  const dropzone = modalEl.querySelector('#image-dropzone');
  const fileInput = modalEl.querySelector('#image-file-input');
  const urlInput = modalEl.querySelector('#f-image');
  if (!dropzone || !fileInput || !urlInput) return;

  async function handleFile(file) {
    if (!file) return;
    const originalText = dropzone.querySelector('.image-dropzone__text').innerHTML;
    dropzone.classList.add('is-uploading');
    dropzone.querySelector('.image-dropzone__text').innerHTML = '<strong>Subiendo…</strong>';
    try {
      const url = await uploadProductImage(file);
      urlInput.value = url;
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      handleError(err, 'products:image-upload');
    } finally {
      dropzone.classList.remove('is-uploading');
      dropzone.querySelector('.image-dropzone__text').innerHTML = originalText;
      fileInput.value = ''; // permite volver a elegir el mismo archivo si hace falta reintentar
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('is-dragover'); });
  });
  dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer?.files?.[0]));
}

function setupRecipeSync(modalEl, existingProductId) {
  const recipeSelect = modalEl.querySelector('#f-recipe');
  const syncBtn = modalEl.querySelector('#btn-sync-recipe-cost');
  const costInput = modalEl.querySelector('#f-cost');

  recipeSelect?.addEventListener('change', () => {
    syncBtn.disabled = !recipeSelect.value;
  });

  syncBtn?.addEventListener('click', async () => {
    if (!existingProductId) {
      showToast({ type: 'warning', message: 'Guardá el producto primero para poder sincronizar el costo con la receta.' });
      return;
    }
    try {
      const { costPerUnit } = await productService.syncCostFromRecipe(existingProductId);
      costInput.value = costPerUnit.toFixed(2);
      showToast({ type: 'success', message: `Costo actualizado a ${formatCurrency(costPerUnit)} según la receta.` });
    } catch (err) {
      handleError(err, 'products:sync-recipe-cost');
    }
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
    const input = document.getElementById(`f-${field === 'costPrice' ? 'cost' : field === 'sellPrice' ? 'sell' : field}`);
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
