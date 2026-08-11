/**
 * product.service.js
 * Responsabilidad: lógica de negocio de Productos. Se comunica con storage y
 * emite eventos de dominio. Nunca modifica el DOM.
 *
 * Depende de recipeService (Service público de otro módulo) únicamente para
 * sincronizar costo desde una receta vinculada — misma regla que en todo el
 * proyecto: solo se consume la interfaz pública de otro módulo, nunca su
 * storage ni sus archivos internos. products -> recipes -> ingredients no
 * genera dependencia circular (ver docs/ARCHITECTURE.md, grafo de módulos).
 */

import { storage } from '../../core/storage/index.js';
import { eventBus, EVENTS } from '../../core/eventBus.js';
import { NotFoundError, ValidationError } from '../../core/errors.js';
import { PRODUCT_COLLECTION } from './product.model.js';
import { validateProduct } from './product.validator.js';
import { calcMargin } from '../../core/utils.js';
import { recipeService } from '../recipes/recipe.service.js';

export const productService = {
  async list() {
    const products = await storage.getAll(PRODUCT_COLLECTION);
    return products.sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Productos para la tienda pública, sin sesión de administración iniciada.
   * Con el adapter de Supabase, storage.getPublicProducts() usa una función seguray
   * de la base que solo expone nombre/foto/descripción/precio/disponibilidad
   * (nunca costPrice ni notes) — ver CloudStorageAdapter.js. Con
   * localStorage (sin nube todavía) no existe esa distinción real, así que
   * simplemente devuelve los productos activos de siempre.
   */
  async listPublic() {
    if (typeof storage.getPublicProducts === 'function') {
      return storage.getPublicProducts();
    }
    const products = await storage.getAll(PRODUCT_COLLECTION);
    return products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id) {
    return storage.getById(PRODUCT_COLLECTION, id);
  },

  async create(data) {
    validateProduct(data);
    const product = await storage.create(PRODUCT_COLLECTION, data);
    eventBus.emit(EVENTS.PRODUCT_CREATED, product);
    return product;
  },

  async update(id, data) {
    validateProduct(data);
    const product = await storage.update(PRODUCT_COLLECTION, id, data);
    eventBus.emit(EVENTS.PRODUCT_UPDATED, product);
    return product;
  },

  async remove(id) {
    await storage.remove(PRODUCT_COLLECTION, id);
    eventBus.emit(EVENTS.PRODUCT_DELETED, { id });
  },

  /** Métrica derivada — nunca se guarda, siempre se calcula al vuelo. */
  margin(product) {
    return calcMargin(product.costPrice, product.sellPrice);
  },

  /**
   * Recalcula el costo del producto a partir del costo actual de la receta
   * vinculada (`product.recipeId`), y lo guarda. Es una acción explícita del
   * usuario (nunca automática) — así el producto puede tener un costo
   * manual distinto al de la receta si hace falta, sin que se pise solo.
   * @param {string} productId
   * @returns {Promise<{product: import('./product.model.js').Product, costPerUnit: number}>}
   */
  async syncCostFromRecipe(productId) {
    const product = await this.get(productId);
    if (!product) throw new NotFoundError('El producto no existe.');
    if (!product.recipeId) throw new ValidationError('Este producto no tiene una receta vinculada.');

    const recipe = await recipeService.get(product.recipeId);
    if (!recipe) throw new NotFoundError('La receta vinculada ya no existe.');

    const ingredients = await recipeService.listIngredientsForCosting();
    const { costPerUnit } = recipeService.calculateCost(recipe, ingredients);

    const updated = await this.update(productId, { ...product, costPrice: Math.round(costPerUnit * 100) / 100 });
    return { product: updated, costPerUnit };
  },

  async listRecipesForForm() {
    return recipeService.list();
  },
};
