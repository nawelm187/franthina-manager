/**
 * sale.service.js
 * Responsabilidad: lógica de negocio de Ventas. Verifica stock de productos,
 * lo descuenta al confirmar, registra la venta y — si hay una caja abierta —
 * refleja el ingreso automáticamente en Caja. Todo a través de los Services
 * públicos de Productos y Caja, nunca tocando su storage directamente.
 */

import { storage } from '../../core/storage/index.js';
import { eventBus, EVENTS } from '../../core/eventBus.js';
import { InsufficientStockError } from '../../core/errors.js';
import { runAtomic } from '../../core/storage/atomicRun.js';
import { SALE_COLLECTION, calculateSaleTotal } from './sale.model.js';
import { validateSale } from './sale.validator.js';
import { productService } from '../products/product.service.js';
import { cashboxService } from '../cashbox/cashbox.service.js';
import { MOVEMENT_TYPES } from '../cashbox/cashbox.model.js';

export const saleService = {
  async list() {
    const sales = await storage.getAll(SALE_COLLECTION);
    return sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async get(id) {
    return storage.getById(SALE_COLLECTION, id);
  },

  /**
   * Compara lo que pide la venta contra el stock actual de cada producto.
   * Consulta de solo lectura — no modifica nada.
   */
  async checkAvailability(items) {
    const products = await productService.list();
    const productsById = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => {
      const product = productsById.get(item.productId);
      const available = product?.stock ?? 0;
      return {
        productId: item.productId,
        name: product?.name ?? 'Producto eliminado',
        required: Number(item.quantity),
        available,
        enough: product ? available >= Number(item.quantity) : false,
      };
    });
  },

  /**
   * Confirma la venta: valida, verifica stock (todo o nada), descuenta stock
   * de cada producto, guarda la venta y refleja el ingreso en Caja si hay
   * una sesión abierta.
   */
  async create(data) {
    validateSale(data);

    // Este chequeo es "optimista": da el mensaje completo de qué productos
    // faltan (útil para la persona que está vendiendo), pero por sí solo NO
    // evita que dos ventas concurrentes se pisen — para eso está el paso de
    // abajo, que es el que de verdad garantiza la consistencia.
    const availability = await this.checkAvailability(data.items);
    const shortages = availability.filter((a) => !a.enough);
    if (shortages.length > 0) throw new InsufficientStockError(shortages);

    const total = calculateSaleTotal(data);
    let sale;

    if (storage.supportsAtomicOps()) {
      // Postgres bloquea las filas de producto y descuenta stock + inserta
      // la venta en una sola transacción — si otra venta concurrente ya se
      // llevó el stock entre el chequeo de arriba y este paso, esto falla
      // con InsufficientStockError igual que si lo hubiéramos detectado
      // antes, en vez de vender de más.
      sale = await storage.createSaleAtomic({ ...data, total }, data.items);
    } else {
      // Modo local (sin Supabase): no hay transacciones reales que ofrecer,
      // así que se mantiene el camino anterior — compensar en JavaScript
      // paso a paso si algo falla a mitad de camino.
      const products = await productService.list();
      const productsById = new Map(products.map((p) => [p.id, p]));

      // Cada paso descuenta stock de un producto; si alguno falla a mitad de
      // camino, su rollback restaura el stock previo de ese producto puntual.
      await runAtomic(data.items.map((item) => {
        const product = productsById.get(item.productId);
        const previousStock = product.stock;
        return {
          run: () => productService.update(product.id, { ...product, stock: previousStock - item.quantity }),
          rollback: async () => {
            const current = await productService.get(product.id);
            await productService.update(product.id, { ...current, stock: previousStock });
          },
        };
      }));

      sale = await storage.create(SALE_COLLECTION, { ...data, total });
    }

    await cashboxService.registerAutoMovement(MOVEMENT_TYPES.SALE, total, `Venta #${sale.id.slice(0, 8)}`);

    eventBus.emit(EVENTS.SALE_CREATED, sale);
    return sale;
  },

  /** Ventas del día de hoy — usado por el Dashboard. */
  async getTodayTotal() {
    const sales = await this.list();
    const today = new Date().toISOString().slice(0, 10);
    return sales
      .filter((s) => s.createdAt.slice(0, 10) === today)
      .reduce((sum, s) => sum + s.total, 0);
  },

  async listProductsForForm() {
    return productService.list();
  },
};
