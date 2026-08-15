/**
 * report.pdf.js
 * Responsabilidad: armar el "Reporte de ventas" en PDF — pensado para el
 * negocio (imprimir, archivar, mandar al contador), no para el cliente.
 * A diferencia del comprobante de pedido, acá SÍ tiene sentido mostrar el
 * desglose por método de pago; lo que no entra es cualquier id interno o
 * UUID — nada de eso le sirve a la persona que lo va a leer.
 */
import { createPdfWriter, downloadPdfBytes } from '../../core/pdf.js';
import { formatCurrency, formatDate } from '../../core/utils.js';
import { PAYMENT_METHOD_LABELS } from '../sales/sale.model.js';
import { ORDER_STATUS_LABELS as PRODUCTION_STATUS_LABELS } from '../production/production.model.js';
import { MOVEMENT_TYPE_LABELS } from '../inventory/inventory.model.js';

/**
 * @param {{ sales: object[], totalRevenue: number, count: number, averageTicket: number, byPaymentMethod: Record<string, number> }} report
 * @param {{ from: string, to: string }} range
 */
export async function downloadSalesReportPdf(report, range) {
  const writer = await createPdfWriter({
    documentTitle: 'Reporte de ventas',
    documentSubtitle: `Del ${formatDate(range.from)} al ${formatDate(range.to)}`,
  });

  writer.keyValueRow('Facturado en el período:', formatCurrency(report.totalRevenue));
  writer.keyValueRow('Cantidad de ventas:', String(report.count));
  writer.keyValueRow('Ticket promedio:', formatCurrency(report.averageTicket));
  writer.spacer(12);

  if (Object.keys(report.byPaymentMethod).length) {
    writer.heading('Por método de pago');
    writer.table({
      columns: [
        { label: 'Método', width: 2, align: 'left' },
        { label: 'Total', width: 1, align: 'right' },
      ],
      rows: Object.entries(report.byPaymentMethod).map(([label, total]) => [label, formatCurrency(total)]),
    });
    writer.spacer(12);
  }

  writer.heading('Detalle de ventas');
  writer.table({
    columns: [
      { label: 'Fecha', width: 1.1, align: 'left' },
      { label: 'Items', width: 0.7, align: 'right' },
      { label: 'Método de pago', width: 1.6, align: 'left' },
      { label: 'Descuento', width: 1, align: 'right' },
      { label: 'Total', width: 1, align: 'right' },
    ],
    rows: report.sales.map((s) => [
      formatDate(s.createdAt),
      String(s.items.length),
      s.paymentMethodLabel ?? PAYMENT_METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod,
      s.discount ? formatCurrency(s.discount) : '—',
      formatCurrency(s.total),
    ]),
  });

  const bytes = await writer.finish();
  downloadPdfBytes(bytes, `franthina-reporte-ventas-${range.from}_${range.to}`);
}

/**
 * @param {{ orders: object[], totalBatches: number, count: number }} report
 * @param {{ from: string, to: string }} range
 */
export async function downloadProductionReportPdf(report, range) {
  const writer = await createPdfWriter({
    documentTitle: 'Orden de producción — resumen',
    documentSubtitle: `Del ${formatDate(range.from)} al ${formatDate(range.to)}`,
  });

  writer.keyValueRow('Órdenes completadas:', String(report.count));
  writer.keyValueRow('Lotes totales producidos:', String(report.totalBatches));
  writer.spacer(12);

  writer.heading('Detalle');
  writer.table({
    columns: [
      { label: 'Completada', width: 1.1, align: 'left' },
      { label: 'Receta', width: 2.2, align: 'left' },
      { label: 'Lotes', width: 0.7, align: 'right' },
      { label: 'Estado', width: 1.2, align: 'left' },
    ],
    rows: report.orders.map((o) => [
      formatDate(o.completedAt),
      o.recipeName,
      `×${o.multiplier}`,
      PRODUCTION_STATUS_LABELS[o.status] ?? o.status,
    ]),
  });

  const bytes = await writer.finish();
  downloadPdfBytes(bytes, `franthina-reporte-produccion-${range.from}_${range.to}`);
}

/**
 * @param {{ movements: object[], count: number, byType: Record<string, number> }} report
 * @param {{ from: string, to: string }} range
 */
export async function downloadInventoryReportPdf(report, range) {
  const writer = await createPdfWriter({
    documentTitle: 'Reporte de inventario',
    documentSubtitle: `Del ${formatDate(range.from)} al ${formatDate(range.to)}`,
  });

  writer.keyValueRow('Movimientos totales:', String(report.count));
  writer.spacer(6);
  Object.entries(report.byType).forEach(([label, count]) => writer.keyValueRow(`${label}:`, String(count)));
  writer.spacer(12);

  writer.heading('Detalle de movimientos');
  writer.table({
    columns: [
      { label: 'Fecha', width: 1, align: 'left' },
      { label: 'Ingrediente', width: 1.8, align: 'left' },
      { label: 'Tipo', width: 1, align: 'left' },
      { label: 'Cantidad', width: 0.8, align: 'right' },
      { label: 'Motivo', width: 1.8, align: 'left' },
    ],
    rows: report.movements.map((m) => [
      formatDate(m.createdAt),
      m.ingredientName,
      MOVEMENT_TYPE_LABELS[m.type] ?? m.type,
      String(m.quantity),
      m.reason || '—',
    ]),
  });

  const bytes = await writer.finish();
  downloadPdfBytes(bytes, `franthina-reporte-inventario-${range.from}_${range.to}`);
}
