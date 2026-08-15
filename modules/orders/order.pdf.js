/**
 * order.pdf.js
 * Responsabilidad: armar el comprobante de un Pedido en PDF — el documento
 * que se le entrega al cliente. Solo arma contenido (qué texto, qué filas);
 * el dibujo en sí vive en core/pdf.js.
 */
import { createPdfWriter, downloadPdfBytes } from '../../core/pdf.js';
import { formatCurrency, formatDate } from '../../core/utils.js';
import { calculateOrderTotal, calculateOrderBalance, ORDER_STATUS_LABELS } from './order.model.js';

/**
 * @param {object} order
 * @param {object|null} customer
 * @param {Map<string, object>} productsById
 */
export async function downloadOrderReceiptPdf(order, customer, productsById) {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const writer = await createPdfWriter({
    documentTitle: `Pedido #${shortId}`,
    documentSubtitle: `Estado: ${ORDER_STATUS_LABELS[order.status] ?? order.status}`,
  });

  writer.keyValueRow('Cliente:', customer?.name ?? 'Cliente eliminado');
  if (customer?.phone) writer.keyValueRow('Teléfono:', customer.phone);
  writer.keyValueRow('Fecha de entrega:', formatDate(order.deliveryDate));
  if (order.notes) writer.keyValueRow('Notas:', order.notes);
  writer.spacer(10);
  writer.rule();
  writer.spacer(6);

  writer.table({
    columns: [
      { label: 'Producto', width: 3, align: 'left' },
      { label: 'Cant.', width: 1, align: 'right' },
      { label: 'Precio unit.', width: 1.3, align: 'right' },
      { label: 'Subtotal', width: 1.3, align: 'right' },
    ],
    rows: order.items.map((item) => {
      const product = productsById.get(item.productId);
      return [
        product?.name ?? 'Producto eliminado',
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.quantity * item.unitPrice),
      ];
    }),
  });

  writer.spacer(4);
  writer.rule();
  writer.spacer(6);

  const total = calculateOrderTotal(order);
  const balance = calculateOrderBalance(order);
  writer.text(`Total del pedido: ${formatCurrency(total)}`, { bold: true, size: 12, gap: 18 });
  if (order.depositAmount > 0) {
    writer.text(`Seña ya cobrada: ${formatCurrency(order.depositAmount)}`, { size: 10, gap: 16 });
  }
  writer.text(`Saldo pendiente al momento de entregar: ${formatCurrency(balance)}`, { bold: balance > 0, size: 11 });

  const bytes = await writer.finish();
  downloadPdfBytes(bytes, `franthina-pedido-${shortId}`);
}
