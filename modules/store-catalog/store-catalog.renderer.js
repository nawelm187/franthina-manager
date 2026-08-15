/**
 * store-catalog.renderer.js
 * Responsabilidad: construir el HTML del catálogo público — nunca decide
 * qué productos mostrar ni maneja eventos, eso es del Controller.
 *
 * Regla de seguridad de datos (ver product.model.js): acá solo se leen
 * name, description, imageUrl, sellPrice, category y stock (para el badge
 * de disponibilidad) — NUNCA costPrice, notes, ni el número exacto de stock.
 */
import { escapeHtml, formatCurrency, truncate, normalizeImageUrl } from '../../core/utils.js';
import { APP_CONFIG } from '../../core/config.js';
import { icon } from '../../core/icons.js';

function qtyStepperHtml(inputId, name, { min = 1, value = 1 } = {}) {
  return `
    <div class="qty-stepper">
      <button type="button" class="qty-stepper__btn" data-step="-1" data-target="${inputId}" aria-label="Restar uno a ${escapeHtml(name)}">−</button>
      <input class="qty-stepper__input" type="number" min="${min}" value="${value}" id="${inputId}" aria-label="Cantidad de ${escapeHtml(name)}" />
      <button type="button" class="qty-stepper__btn" data-step="1" data-target="${inputId}" aria-label="Sumar uno a ${escapeHtml(name)}">+</button>
    </div>`;
}

function productCardHtml(product) {
  const available = product.stock > 0;
  return `
    <article class="product-card">
      <div class="product-card__media">
        <span class="product-card__media-icon">${icon('bakery_dining')}</span>
        ${product.imageUrl ? `<img src="${escapeHtml(normalizeImageUrl(product.imageUrl))}" alt="" loading="lazy" onerror="this.remove()" />` : ''}
        <span class="product-card__category">${escapeHtml(product.category)}</span>
      </div>
      <div class="product-card__body">
        <h3>${escapeHtml(product.name)}</h3>
        ${product.description ? `<p class="product-card__description">${escapeHtml(truncate(product.description, 140))}</p>` : ''}
        <div class="product-card__footer">
          <span class="product-card__price">${formatCurrency(product.sellPrice)}</span>
          ${available
            ? '<span class="badge badge--success">Disponible</span>'
            : '<span class="badge badge--danger">Agotado</span>'}
        </div>
        ${available ? `
          <div class="row gap-2 product-card__actions">
            ${qtyStepperHtml(`qty-${product.id}`, product.name)}
            <button class="btn btn--primary" data-action="add-to-cart" data-id="${product.id}">${icon('shopping_cart')} Agregar</button>
          </div>` : ''}
      </div>
    </article>`;
}

export function renderCatalogPage(container, { products, categories, activeCategory, categoriesExpanded }) {
  container.innerHTML = `
    <section class="store-hero">
      <span class="store-hero__eyebrow">Franthina</span>
      <h1>${escapeHtml(APP_CONFIG.storeTagline)}</h1>
      <p>Elegí tus productos favoritos y armá tu pedido en minutos — coordinamos el resto por WhatsApp.</p>
    </section>
    <div class="scallop-divider" aria-hidden="true"></div>

    <div class="store-main-content">
      ${categories.length > 1 ? `
        <div class="category-filter">
          ${categoriesExpanded ? `
            <div class="category-chips" role="group" aria-label="Filtrar por categoría">
              ${categories.map((cat) => `
                <button type="button" class="chip ${cat === activeCategory ? 'chip--active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
              `).join('')}
            </div>` : `
            <button type="button" class="chip chip--active chip--toggle" id="category-toggle" aria-expanded="false" aria-label="Categoría actual: ${escapeHtml(activeCategory)}. Tocar para elegir otra.">
              ${escapeHtml(activeCategory)} <span aria-hidden="true">▾</span>
            </button>`}
        </div>` : ''}

      ${products.length === 0
        ? `<div class="state-panel">
            <span class="state-panel__icon">${icon('bakery_dining')}</span>
            <h2>Todavía no hay productos disponibles</h2>
            <p>Volvé a visitarnos pronto.</p>
          </div>`
        : `<div class="product-grid">${products.map(productCardHtml).join('')}</div>`}
    </div>
  `;
}
