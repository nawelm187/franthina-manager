/**
 * store-catalog.controller.js
 * Responsabilidad: orquestar el catálogo público — pide los productos activos
 * al Service de Productos (nunca toca su storage directamente), arma el
 * filtro de categorías, y maneja "agregar al carrito".
 */
import { productService } from '../products/product.service.js';
import { renderCatalogPage } from './store-catalog.renderer.js';
import { storeCart } from '../../core/storeCart.js';
import { showToast } from '../../components/toast.js';
import { handleError } from '../../core/errors.js';
import { bindQtyStepper } from '../../components/qtyStepper.js';
import { skeletonTableHtml } from '../../components/skeletonTable.js';

let activeCategory = 'Todas';
let categoriesExpanded = false;

export async function render(_params, container) {
  container.innerHTML = skeletonTableHtml();

  let activeProducts = [];
  try {
    // listPublic() nunca expone costPrice ni notes — ver product.service.js.
    activeProducts = await productService.listPublic();
  } catch (err) {
    handleError(err, 'store-catalog:list');
  }

  activeCategory = 'Todas';
  categoriesExpanded = false;
  paint(container, activeProducts);
}

function paint(container, allProducts) {
  const categories = ['Todas', ...new Set(allProducts.map((p) => p.category).filter(Boolean))];
  const filtered = activeCategory === 'Todas'
    ? allProducts
    : allProducts.filter((p) => p.category === activeCategory);
  renderCatalogPage(container, { products: filtered, categories, activeCategory, categoriesExpanded });
  bindEvents(container, allProducts);
}

function bindEvents(container, allProducts) {
  bindQtyStepper(container);

  container.querySelector('#category-toggle')?.addEventListener('click', () => {
    categoriesExpanded = true;
    paint(container, allProducts);
  });

  container.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      // Vuelve a mostrar solo la categoría elegida, en vez de dejar la
      // lista completa desplegada permanentemente.
      categoriesExpanded = false;
      paint(container, allProducts);
    });
  });

  container.querySelectorAll('[data-action="add-to-cart"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const product = allProducts.find((p) => p.id === id);
      if (!product) return;
      const qtyInput = container.querySelector(`#qty-${id}`);
      const qty = Math.max(1, Math.floor(Number(qtyInput?.value)) || 1);
      storeCart.addItem(id, qty);
      showToast({ type: 'success', message: `"${product.name}" se agregó al carrito.` });
    });
  });
}
