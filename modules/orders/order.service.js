/**
 * order.service.js
 * Responsabilidad: lógica de negocio de Pedidos. A diferencia de Ventas, un
 * pedido no descuenta stock al crearse — recién lo hace al marcarse como
 * entregado. La seña (si la hay) se refleja en Caja al crear el pedido; el
 * saldo restante se refleja al entregar.
 */

import { storage } from '../../core/storage/index.js';
import { eventBus, EVENTS } from '../../core/eventBus.js';
import { InsufficientStockError, NotFoundError, ValidationError } from '../../core/errors.js';
import { runAtomic } from '../../core/storage/atomicRun.js';
import { ORDER_COLLECTION, ORDER_STATUS, calculateOrderTotal, calculateOrderBalance } from './order.model.js';
import { validateOrder } from './order.validator.js';
import { productService } from '../products/product.service.js';
import { cashboxService } from '../cashbox/cashbox.service.js';
import { MOVEMENT_TYPES } from '../cashbox/cashbox.model.js';
import { productionService } from '../production/production.service.js';

export const orderService = {
  async list() {
    const orders = await storage.getAll(ORDER_COLLECTION);
    return orders.sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate));
  },

  async get(id) {
    return storage.getById(ORDER_COLLECTION, id);
  },

  async create(data) {
    validateOrder(data);
    const total = calculateOrderTotal(data);
    const order = await storage.create(ORDER_COLLECTION, { ...data, status: ORDER_STATUS.PENDING, deliveredAt: null, productionOrderId: null, total });

    if (order.depositAmount > 0) {
      await cashboxService.registerAutoMovement(MOVEMENT_TYPES.INCOME, order.depositAmount, `Seña pedido #${order.id.slice(0, 8)}`);
    }

    eventBus.emit(EVENTS.ORDER_CREATED, order);
    return order;
  },

  /**
   * Crea un pedido desde el checkout público (sin sesión). A diferencia de
   * create(), nunca confía en un precio que venga del navegador: en modo
   * Supabase, el precio se recalcula del lado del servidor dentro de
   * create_public_order() (ver franthina_schema_v031_2_public_order_price.sql)
   * — acá solo se manda productId + quantity por línea, nunca unitPrice.
   * @param {{customerId:string, lines:{quantity:number, product:object}[], deliveryDate:string, notes:string}} data
   */
  async createFromPublicStore({ customerId, lines, deliveryDate, notes }) {
    if (storage.supportsAtomicOps()) {
      const items = lines.map((l) => ({ productId: l.product.id, quantity: l.quantity }));
      const order = await storage.createPublicOrderAtomic({ customerId, items, deliveryDate, notes });
      eventBus.emit(EVENTS.ORDER_CREATED, order);
      return order;
    }
    // Modo local (sin Supabase): no hay función de servidor que ofrecer —
    // se arma el pedido con el precio que ya trae el catálogo cargado en
    // el navegador, mismo comportamiento que existía antes de esta versión.
    const items = lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: l.product.sellPrice }));
    return this.create({ customerId, items, deliveryDate, depositAmount: 0, notes });
  },

  async cancel(id) {
    const order = await storage.getById(ORDER_COLLECTION, id);
    if (!order) throw new NotFoundError('El pedido no existe.');
    if (order.status !== ORDER_STATUS.PENDING) throw new ValidationError('Solo se pueden cancelar pedidos pendientes.');

    const cancelledOrder = await storage.update(ORDER_COLLECTION, id, { status: ORDER_STATUS.CANCELLED });
    eventBus.emit(EVENTS.ORDER_CANCELLED, cancelledOrder);
    return cancelledOrder;
  },

  /** Compara lo que pide el pedido contra el stock actual de cada producto. Solo lectura. */
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
   * Marca el pedido como entregado: descuenta stock (todo o nada, con
   * rollback si falla a mitad de camino) y refleja el saldo pendiente en
   * Caja si hay una sesión abierta.
   */
  async markDelivered(id) {
    const order = await storage.getById(ORDER_COLLECTION, id);
    if (!order) throw new NotFoundError('El pedido no existe.');
    if (order.status !== ORDER_STATUS.PENDING) throw new ValidationError('Solo se pueden entregar pedidos pendientes.');

    const availability = await this.checkAvailability(order.items);
    const shortages = availability.filter((a) => !a.enough);
    if (shortages.length > 0) throw new InsufficientStockError(shortages);

    const products = await productService.list();
    const productsById = new Map(products.map((p) => [p.id, p]));

    await runAtomic(order.items.map((item) => {
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

    const balance = calculateOrderBalance(order);
    if (balance > 0) {
      await cashboxService.registerAutoMovement(MOVEMENT_TYPES.SALE, balance, `Saldo pedido #${order.id.slice(0, 8)}`);
    }

    const deliveredOrder = await storage.update(ORDER_COLLECTION, id, {
      status: ORDER_STATUS.DELIVERED,
      deliveredAt: new Date().toISOString(),
    });
    eventBus.emit(EVENTS.ORDER_DELIVERED, deliveredOrder);
    return deliveredOrder;
  },

  /**
   * Genera una orden de producción vinculada a este pedido, a través del
   * Service público de Producción — nunca crea la orden directamente.
   */
  async linkProduction(orderId, { recipeId, multiplier, plannedDate }) {
    const order = await storage.getById(ORDER_COLLECTION, orderId);
    if (!order) throw new NotFoundError('El pedido no existe.');

    const productionOrder = await productionService.create({ recipeId, multiplier, plannedDate, notes: `Generada desde pedido #${order.id.slice(0, 8)}` });
    await storage.update(ORDER_COLLECTION, orderId, { productionOrderId: productionOrder.id });
    return productionOrder;
  },

  async listProductsForForm() {
    return productService.list();
  },
};
