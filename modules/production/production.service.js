/**
 * production.service.js
 * Responsabilidad: lógica de negocio de Producción. Traduce una receta + un
 * multiplicador de lotes en necesidades de ingredientes, verifica factibilidad
 * contra el stock actual, y al completar una orden:
 *   1. Descuenta los ingredientes consumidos (vía Inventario).
 *   2. Suma el stock producido a cualquier Producto vinculado a la receta
 *      (`product.recipeId`), vía el Service público de Productos.
 * Todo en una única operación atómica — si algo falla a mitad de camino,
 * se revierte lo ya aplicado (ver core/storage/atomicRun.js).
 */

import { storage } from '../../core/storage/index.js';
import { eventBus, EVENTS } from '../../core/eventBus.js';
import { NotFoundError, InsufficientStockError } from '../../core/errors.js';
import { runAtomic } from '../../core/storage/atomicRun.js';
import { PRODUCTION_COLLECTION, ORDER_STATUS } from './production.model.js';
import { validateProductionOrder } from './production.validator.js';
import { recipeService } from '../recipes/recipe.service.js';
import { ingredientService } from '../ingredients/ingredient.service.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { MOVEMENT_TYPES } from '../inventory/inventory.model.js';
import { productService } from '../products/product.service.js';
import { convertUnit } from '../../core/units.js';

export const productionService = {
  async list() {
    const orders = await storage.getAll(PRODUCTION_COLLECTION);
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async get(id) {
    return storage.getById(PRODUCTION_COLLECTION, id);
  },

  async create(data) {
    validateProductionOrder(data);
    const order = await storage.create(PRODUCTION_COLLECTION, { ...data, status: ORDER_STATUS.PLANNED, completedAt: null });
    eventBus.emit(EVENTS.PRODUCTION_ORDER_CREATED, order);
    return order;
  },

  async cancel(id) {
    const order = await storage.update(PRODUCTION_COLLECTION, id, { status: ORDER_STATUS.CANCELLED });
    eventBus.emit(EVENTS.PRODUCTION_ORDER_CANCELLED, order);
    return order;
  },

  /** Solo se pueden eliminar órdenes planificadas: una orden completada es historial. */
  async remove(id) {
    const order = await storage.getById(PRODUCTION_COLLECTION, id);
    if (order?.status === ORDER_STATUS.COMPLETED) {
      throw new Error('No se puede eliminar una orden ya completada: forma parte del historial.');
    }
    await storage.remove(PRODUCTION_COLLECTION, id);
  },

  /**
   * Calcula cuánto de cada ingrediente requiere una orden, y compara contra
   * el stock actual. No modifica nada: es una consulta de solo lectura.
   * @returns {Promise<{recipe: object, requirements: {ingredientId:string, name:string, unit:string, required:number, available:number, enough:boolean}[], feasible: boolean}>}
   */
  async checkFeasibility(order) {
    const recipe = await recipeService.get(order.recipeId);
    if (!recipe) throw new NotFoundError('La receta de esta orden ya no existe.');

    const ingredients = await ingredientService.list();
    const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));

    const requirements = recipe.items.map((item) => {
      const ingredient = ingredientsById.get(item.ingredientId);
      const multiplier = Number(order.multiplier || 1);
      const itemUnit = item.unit || ingredient?.unit;

      let requiredInIngredientUnit = item.quantity * multiplier;
      let unitMismatch = false;
      if (ingredient && itemUnit !== ingredient.unit) {
        try {
          requiredInIngredientUnit = convertUnit(item.quantity, itemUnit, ingredient.unit) * multiplier;
        } catch {
          unitMismatch = true;
        }
      }

      const available = ingredient?.stock ?? 0;
      return {
        ingredientId: item.ingredientId,
        name: ingredient?.name ?? 'Ingrediente eliminado',
        unit: ingredient?.unit ?? '',
        required: requiredInIngredientUnit,
        available,
        unitMismatch,
        enough: ingredient && !unitMismatch ? available >= requiredInIngredientUnit : false,
      };
    });

    return { recipe, requirements, feasible: requirements.every((r) => r.enough) };
  },

  /**
   * Ejecuta la orden: valida factibilidad, descuenta stock (vía Inventario)
   * y marca la orden como completada. Si falta stock de algún ingrediente,
   * no se ejecuta ningún movimiento (todo o nada) y se informa el detalle.
   */
  async complete(id) {
    const order = await storage.getById(PRODUCTION_COLLECTION, id);
    if (!order) throw new NotFoundError('La orden de producción no existe.');
    if (order.status !== ORDER_STATUS.PLANNED) {
      throw new Error('Solo se pueden completar órdenes planificadas.');
    }

    const { requirements, feasible, recipe } = await this.checkFeasibility(order);
    if (!feasible) {
      throw new InsufficientStockError(requirements.filter((r) => !r.enough));
    }

    const yieldTotal = recipe.yieldQuantity * Number(order.multiplier || 1);
    const linkedProducts = (await productService.list()).filter((p) => p.recipeId === order.recipeId);

    let completedOrder;
    if (storage.supportsAtomicOps()) {
      // Postgres bloquea ingredientes y productos involucrados y hace todo
      // en una sola transacción — si otra producción concurrente ya
      // consumió el ingrediente entre checkFeasibility() y este paso, esto
      // falla con InsufficientStockError en vez de dejar stock negativo.
      completedOrder = await storage.completeProductionOrderAtomic({
        orderId: id,
        requirements,
        reasonText: `Producción: ${recipe.name}`,
        productIds: linkedProducts.map((p) => p.id),
        yieldTotal,
        completedAt: new Date().toISOString(),
      });
    } else {
      // Modo local (sin Supabase): mismo camino de siempre, compensando en
      // JavaScript paso a paso si algo falla a mitad de camino.
      // Todo en una sola operación atómica: si cualquier paso falla a mitad de
      // camino (consumo de ingrediente o suma de stock del producto), se
      // revierte todo lo ya aplicado (ver core/storage/atomicRun.js).
      await runAtomic([
        ...requirements.map((req) => ({
          run: () => inventoryService.create({
            ingredientId: req.ingredientId,
            type: MOVEMENT_TYPES.OUT,
            quantity: req.required,
            reason: `Producción: ${recipe.name}`,
          }),
          rollback: () => inventoryService.create({
            ingredientId: req.ingredientId,
            type: MOVEMENT_TYPES.IN,
            quantity: req.required,
            reason: `Reversión automática: producción de "${recipe.name}" no se pudo completar`,
          }),
        })),
        ...linkedProducts.map((product) => ({
          run: () => productService.update(product.id, { ...product, stock: product.stock + yieldTotal }),
          rollback: async () => {
            const current = await productService.get(product.id);
            await productService.update(product.id, { ...current, stock: current.stock - yieldTotal });
          },
        })),
      ]);

      completedOrder = await storage.update(PRODUCTION_COLLECTION, id, {
        status: ORDER_STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
      });
    }

    eventBus.emit(EVENTS.PRODUCTION_ORDER_COMPLETED, completedOrder);
    return completedOrder;
  },

  async listRecipesForForm() {
    return recipeService.list();
  },
};
