/**
 * product.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Productos.
 * Nunca guarda datos, nunca contiene reglas de negocio: solo recibe datos y devuelve HTML,
 * o pinta directamente en un contenedor dado por el Controller.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, escapeHtml, emptyStateMessage } from '../../core/utils.js';
import { icon } from '../../core/icons.js';
import { can } from '../../core/permissions.js';

/** Renderiza solo la tabla (sin el resto de la página) — se reusa al buscar,
 *  para poder refrescar nada más que esta región y no pisar el buscador. */
export function renderProductsTable({ products: rows, recipesById, sortState, searchTerm = '' }) {
  return renderDataTable({
    sortKey: sortState?.key ?? null,
    sortDirection: sortState?.direction ?? 'asc',
    columns: [
      { key: 'name', label: 'Nombre', sortable: true },
      { key: 'category', label: 'Categoría', sortable: true },
      {
        key: 'recipeId',
        label: 'Receta',
        render: (r) => r.recipeId
          ? `<span class="badge badge--info">${icon('menu_book')} ${escapeHtml(recipesById.get(r.recipeId)?.name ?? 'Receta eliminada')}</span>`
          : '<span class="field__hint">Sin vincular</span>',
      },
      { key: 'costPrice', label: 'Costo', sortable: true, render: (r) => formatCurrency(r.costPrice) },
      { key: 'sellPrice', label: 'Venta', sortable: true, render: (r) => formatCurrency(r.sellPrice) },
      {
        key: 'marginPct',
        label: 'Margen',
        sortable: true,
        render: (r) => {
          const variant = r.marginPct >= 40 ? 'success' : r.marginPct >= 15 ? 'warning' : 'danger';
          return `<span class="badge badge--${variant}">${r.marginPct}%</span>`;
        },
      },
      { key: 'stock', label: 'Stock', sortable: true },
      {
        key: 'active',
        label: 'Estado',
        render: (r) => r.active
          ? `<span class="badge badge--success">${icon('check')} Activo</span>`
          : `<span class="badge badge--danger">${icon('close')} Inactivo</span>`,
      },
    ],
    rows,
    emptyMessage: emptyStateMessage(searchTerm, 'Todavía no cargaste ningún producto. Creá el primero con el botón "Nuevo producto".'),
    emptyAction: searchTerm ? null : { id: 'btn-empty-new-product', label: 'Nuevo producto' },
    rowActionsHtml: (row) => `
      <div class="row gap-2">
        <button class="btn btn--ghost btn--icon-only" data-action="edit" data-id="${row.id}" aria-label="Editar ${escapeHtml(row.name)}">${icon('edit')}</button>
        ${can('delete') ? `<button class="btn btn--ghost btn--icon-only" data-action="delete" data-id="${row.id}" aria-label="Eliminar ${escapeHtml(row.name)}">${icon('delete')}</button>` : ''}
      </div>`,
  });
}

export function renderProductsPage(container, { products, recipesById, sortState, searchTerm = '' }) {
  container.innerHTML = `
    <header class="row" style="justify-content:space-between; margin-bottom: var(--space-5); flex-wrap:wrap; gap: var(--space-3);">
      <div>
        <h1>Productos</h1>
        <p>Gestioná el catálogo de productos de Franthina: precios, costos y stock.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-product">
        ${icon('add')} Nuevo producto
      </button>
    </header>

    <div class="field" style="max-width: 360px;">
      <label class="field__label" for="product-search">Buscar producto</label>
      <input class="input" type="search" id="product-search" placeholder="Escribí un nombre..." value="${escapeHtml(searchTerm)}" />
    </div>

    <div id="products-table-region">
      ${renderProductsTable({ products, recipesById, sortState, searchTerm })}
    </div>
  `;
}

/** Formulario de alta/edición usado dentro del modal. */
export function productFormHtml(product, recipes) {
  const recipeOptions = recipes
    .map((r) => `<option value="${r.id}" ${r.id === product.recipeId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`)
    .join('');

  return `
    <form id="product-form" novalidate>
      <div class="field">
        <label class="field__label" for="f-name">Nombre <span class="required">*</span></label>
        <input class="input" id="f-name" name="name" value="${escapeHtml(product.name)}" required maxlength="200" />
        <div class="field__error" data-error-for="name" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="f-category">Categoría</label>
        <input class="input" id="f-category" name="category" value="${escapeHtml(product.category)}" />
      </div>
      <div class="field">
        <label class="field__label" for="f-recipe">Receta vinculada (opcional)</label>
        <select class="select" id="f-recipe" name="recipeId">
          <option value="">Sin vincular</option>
          ${recipeOptions}
        </select>
        <div class="field__hint">Si vinculás una receta, podés sincronizar el costo con un botón, en vez de calcularlo a mano.</div>
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="f-cost">Precio de costo</label>
          <input class="input" type="number" min="0" step="0.01" id="f-cost" name="costPrice" value="${product.costPrice}" />
          <div class="field__error" data-error-for="costPrice" hidden></div>
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="f-sell">Precio de venta</label>
          <input class="input" type="number" min="0" step="0.01" id="f-sell" name="sellPrice" value="${product.sellPrice}" />
          <div class="field__error" data-error-for="sellPrice" hidden></div>
        </div>
      </div>
      <button type="button" class="btn btn--secondary" id="btn-sync-recipe-cost" style="margin-bottom: var(--space-4);" ${product.recipeId ? '' : 'disabled'}>
        ${icon('sync')} Sincronizar costo con la receta
      </button>
      <div class="field">
        <label class="field__label" for="f-stock">Stock actual</label>
        <input class="input" type="number" min="0" id="f-stock" name="stock" value="${product.stock}" />
        <div class="field__error" data-error-for="stock" hidden></div>
      </div>
      <div class="checkbox-row field">
        <input type="checkbox" id="f-active" name="active" ${product.active ? 'checked' : ''} />
        <label for="f-active">Producto activo (visible para la venta y en la tienda online)</label>
      </div>
      <div class="field">
        <label class="field__label" for="f-description">Descripción para la tienda online</label>
        <textarea class="textarea" id="f-description" name="description" maxlength="500" placeholder="Ej: Bizcochuelo de chocolate relleno con dulce de leche y cobertura de ganache.">${escapeHtml(product.description)}</textarea>
        <div class="field__hint">Esto lo ve cualquier visitante de la tienda — nunca el costo ni el stock exacto.</div>
      </div>
      <div class="field">
        <label class="field__label" for="f-image">Foto del producto (opcional)</label>
        <div id="image-dropzone" class="image-dropzone" tabindex="0" role="button" aria-label="Subir una foto desde este dispositivo">
          <input type="file" id="image-file-input" accept="image/*" hidden />
          ${icon('upload', { className: 'icon-lg' })}
          <p class="image-dropzone__text"><strong>Arrastrá una foto acá</strong> o tocá para elegirla</p>
          <p class="field__hint" style="margin:0;">JPG, PNG o WEBP. Se comprime y se guarda automáticamente al elegirla.</p>
        </div>
        <div class="field__hint" style="margin-top: var(--space-2);">
          ¿Preferís pegar un link en vez de subir el archivo? Funciona con Imgur
          o cualquier link que termine en <code>.jpg</code>/<code>.png</code>.
          Un link de Google Drive "Compartir" normal <strong>no funciona</strong>
          directo — necesitás el link "para ver" (click derecho en el archivo →
          Compartir → Copiar enlace, con acceso "Cualquier usuario con el enlace").
        </div>
        <input class="input" type="url" id="f-image" name="imageUrl" value="${escapeHtml(product.imageUrl)}" placeholder="https://..." style="margin-top: var(--space-2);" />
        <div id="image-preview-wrap" ${product.imageUrl ? '' : 'hidden'} style="margin-top: var(--space-3);">
          <img id="image-preview" src="${escapeHtml(product.imageUrl)}" alt="" style="max-width: 160px; max-height: 160px; border-radius: var(--radius-md); border: var(--border-width) solid var(--surface-border); object-fit: cover; display: block;" />
          <div id="image-preview-error" class="field__error" hidden>${icon('warning', { className: 'icon-inline' })}Esta URL no cargó una imagen válida — probá con otro link (ver la ayuda de arriba).</div>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="f-notes">Notas internas</label>
        <textarea class="textarea" id="f-notes" name="notes">${escapeHtml(product.notes)}</textarea>
        <div class="field__hint">Solo las ve el equipo — nunca aparecen en la tienda online.</div>
      </div>
    </form>
  `;
}
