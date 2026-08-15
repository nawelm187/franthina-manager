/**
 * report.service.js
 * Responsabilidad: agregar datos de negocio para reportes por rango de
 * fechas. Es de solo lectura — nunca escribe en storage. Consume
 * exclusivamente los Services públicos de otros módulos, el mismo patrón
 * que ya usa dashboard.service.js. No tiene model.js ni validator.js
 * porque no existe una entidad "Reporte" que crear o validar: solo
 * agregaciones calculadas al vuelo sobre datos que ya existen.
 */

import { saleService } from '../sales/sale.service.js';
import { productionService } from '../production/production.service.js';
import { ORDER_STATUS as PRODUCTION_STATUS } from '../production/production.model.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { cashboxService } from '../cashbox/cashbox.service.js';
import { purchaseService } from '../purchases/purchase.service.js';
import { recipeService } from '../recipes/recipe.service.js';
import { productService } from '../products/product.service.js';
import { ingredientService } from '../ingredients/ingredient.service.js';
import { customerService } from '../customers/customer.service.js';
import { orderService } from '../orders/order.service.js';
import { supplierService } from '../suppliers/supplier.service.js';
import { PAYMENT_METHOD_LABELS } from '../sales/sale.model.js';
import { MOVEMENT_TYPE_LABELS as INVENTORY_TYPE_LABELS } from '../inventory/inventory.model.js';

/** @param {string} isoDate @param {{from:string,to:string}} range */
function isWithinRange(isoDate, range) {
  if (!isoDate) return false;
  const date = isoDate.slice(0, 10);
  return date >= range.from && date <= range.to;
}

export const reportService = {
  /** Rango por defecto: los últimos 30 días. */
  defaultRange() {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { from, to };
  },

  async salesReport(range) {
    const sales = (await saleService.list()).filter((s) => isWithinRange(s.createdAt, range));
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const byPaymentMethod = {};
    for (const sale of sales) {
      const label = PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod;
      byPaymentMethod[label] = (byPaymentMethod[label] ?? 0) + sale.total;
    }
    return {
      sales,
      totalRevenue,
      count: sales.length,
      averageTicket: sales.length ? totalRevenue / sales.length : 0,
      byPaymentMethod,
    };
  },

  async productionReport(range) {
    const orders = (await productionService.list())
      .filter((o) => o.status === PRODUCTION_STATUS.COMPLETED && isWithinRange(o.completedAt, range));
    const recipes = await recipeService.list();
    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    return {
      orders: orders.map((o) => ({ ...o, recipeName: recipesById.get(o.recipeId)?.name ?? 'Receta eliminada' })),
      totalBatches: orders.reduce((sum, o) => sum + o.multiplier, 0),
      count: orders.length,
    };
  },

  async inventoryReport(range) {
    const movements = (await inventoryService.list()).filter((m) => isWithinRange(m.createdAt, range));
    const ingredients = await ingredientService.list();
    const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
    const byType = {};
    for (const m of movements) {
      const label = INVENTORY_TYPE_LABELS[m.type] ?? m.type;
      byType[label] = (byType[label] ?? 0) + 1;
    }
    return {
      movements: movements.map((m) => ({ ...m, ingredientName: ingredientsById.get(m.ingredientId)?.name ?? 'Ingrediente eliminado' })),
      count: movements.length,
      byType,
    };
  },

  async cashboxReport(range) {
    const sessions = (await cashboxService.listSessions())
      .filter((s) => s.closedAt && isWithinRange(s.closedAt, range));
    return {
      sessions,
      totalDifference: sessions.reduce((sum, s) => sum + (s.difference ?? 0), 0),
      count: sessions.length,
    };
  },

  async purchasesReport(range) {
    const purchases = (await purchaseService.list()).filter((p) => isWithinRange(p.createdAt, range));
    const bySupplierId = {};
    for (const purchase of purchases) {
      const total = purchase.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
      bySupplierId[purchase.supplierId] = (bySupplierId[purchase.supplierId] ?? 0) + total;
    }
    return {
      purchases,
      totalSpent: purchases.reduce((sum, p) => sum + p.items.reduce((s, it) => s + it.quantity * it.unitCost, 0), 0),
      count: purchases.length,
      bySupplierId,
    };
  },

  /**
   * Recorre todos los módulos de negocio (vía sus Services públicos, nunca
   * storage directo) buscando inconsistencias: referencias rotas, stock
   * negativo, ids duplicados, y datos incompletos. Es de solo lectura —
   * nunca corrige nada, solo informa. Las guardas de integridad referencial
   * (ver docs/ARCHITECTURE.md) viven en el Controller de cada módulo y
   * cubren el camino normal de la interfaz; este chequeo es la red de
   * seguridad que detecta el caso residual de que algo haya quedado
   * inconsistente igual (por ejemplo, un backup importado desde otra
   * instalación, o un dato tocado fuera de la UI).
   * @returns {Promise<{issues: {severity:'error'|'warning'|'info', area:string, message:string}[], checkedAt:string, totalChecked:number}>}
   */
  async checkIntegrity() {
    const [products, ingredients, recipes, sales, orders, purchases, productionOrders, movements, suppliers, customers] = await Promise.all([
      productService.list(), ingredientService.list(), recipeService.list(), saleService.list(),
      orderService.list(), purchaseService.list(), productionService.list(), inventoryService.list(),
      supplierService.list(), customerService.list(),
    ]);

    const recipeIds = new Set(recipes.map((r) => r.id));
    const ingredientIds = new Set(ingredients.map((i) => i.id));
    const productIds = new Set(products.map((p) => p.id));
    const supplierIds = new Set(suppliers.map((s) => s.id));
    const customerIds = new Set(customers.map((c) => c.id));

    const issues = [];
    const add = (severity, area, message) => issues.push({ severity, area, message });

    // ---- Productos ----
    for (const p of products) {
      if (p.recipeId && !recipeIds.has(p.recipeId)) {
        add('error', 'Productos', `"${p.name}" está vinculado a una receta que ya no existe. El costo no se va a poder sincronizar hasta que desvincules o elijas otra receta.`);
      }
      if (p.stock < 0) add('error', 'Productos', `"${p.name}" tiene stock negativo (${p.stock}). Esto no debería poder pasar — revisalo con cuidado.`);
      if (!p.category || !p.category.trim()) add('warning', 'Productos', `"${p.name}" no tiene categoría.`);
      if (p.sellPrice === 0) add('warning', 'Productos', `"${p.name}" tiene precio de venta $0.`);
    }

    // ---- Ingredientes ----
    for (const i of ingredients) {
      if (i.stock < 0) add('error', 'Ingredientes', `"${i.name}" tiene stock negativo (${i.stock}). Esto no debería poder pasar — revisalo con cuidado.`);
    }

    // ---- Recetas ----
    for (const r of recipes) {
      const missing = r.items.filter((it) => !ingredientIds.has(it.ingredientId));
      if (missing.length > 0) {
        add('error', 'Recetas', `"${r.name}" usa ${missing.length} ingrediente(s) que ya no existe(n). Su costo calculado hoy está subestimado.`);
      }
    }

    // ---- Producción ----
    const productionOrphans = productionOrders.filter((o) => !recipeIds.has(o.recipeId));
    if (productionOrphans.length > 0) {
      add('info', 'Producción', `${productionOrphans.length} orden(es) de producción referencian una receta ya eliminada (esperado si la receta se borró después).`);
    }

    // ---- Ventas ----
    const saleOrphans = sales.filter((s) => s.items.some((it) => !productIds.has(it.productId)));
    if (saleOrphans.length > 0) {
      add('info', 'Ventas', `${saleOrphans.length} venta(s) referencian un producto ya eliminado (esperado, se muestra como "Producto eliminado" en el historial).`);
    }

    // ---- Pedidos ----
    const orderCustomerOrphans = orders.filter((o) => o.customerId && !customerIds.has(o.customerId));
    if (orderCustomerOrphans.length > 0) {
      add('info', 'Pedidos', `${orderCustomerOrphans.length} pedido(s) referencian un cliente ya eliminado.`);
    }

    // ---- Compras ----
    const purchaseSupplierOrphans = purchases.filter((p) => !supplierIds.has(p.supplierId));
    if (purchaseSupplierOrphans.length > 0) {
      add('info', 'Compras', `${purchaseSupplierOrphans.length} compra(s) referencian un proveedor ya eliminado.`);
    }

    // ---- IDs duplicados (defensivo — no debería poder pasar con UUIDs, pero se verifica igual) ----
    const collectionsToCheck = [
      ['Productos', products], ['Ingredientes', ingredients], ['Recetas', recipes],
      ['Ventas', sales], ['Pedidos', orders], ['Compras', purchases],
      ['Producción', productionOrders], ['Inventario', movements],
      ['Proveedores', suppliers], ['Clientes', customers],
    ];
    for (const [area, records] of collectionsToCheck) {
      const seen = new Set();
      const dupes = new Set();
      for (const r of records) {
        if (seen.has(r.id)) dupes.add(r.id);
        seen.add(r.id);
      }
      if (dupes.size > 0) add('error', area, `${dupes.size} id(s) duplicado(s) en la colección — esto puede corromper referencias entre módulos.`);
    }

    const totalChecked = products.length + ingredients.length + recipes.length + sales.length
      + orders.length + purchases.length + productionOrders.length + movements.length
      + suppliers.length + customers.length;

    return { issues, checkedAt: new Date().toISOString(), totalChecked };
  },
};
