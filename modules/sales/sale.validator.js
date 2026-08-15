/**
 * sale.validator.js
 * Responsabilidad: centralizar la validación de una Venta.
 */

import { ValidationError } from '../../core/errors.js';
import { isPositiveNumber, isNonNegativeNumber, isOneOf, mustSelectMessage, notNegativeMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';
import { PAYMENT_METHODS, calculateSaleTotal } from './sale.model.js';

export function validateSale(data) {
  const fieldErrors = {};

  if (!Array.isArray(data.items) || data.items.length === 0) {
    fieldErrors.items = 'Agregá al menos un producto a la venta.';
  } else if (data.items.some((it) => !it.productId || !isPositiveNumber(it.quantity))) {
    fieldErrors.items = 'Cada línea necesita un producto y una cantidad mayor a cero.';
  }
  if (!isOneOf(data.paymentMethod, Object.values(PAYMENT_METHODS))) {
    fieldErrors.paymentMethod = mustSelectMessage('un método de pago');
  }
  if (!isNonNegativeNumber(data.discount)) {
    fieldErrors.discount = notNegativeMessage('El descuento');
  }
  if (data.amountReceived !== null && data.amountReceived !== undefined) {
    if (!isNonNegativeNumber(data.amountReceived)) {
      fieldErrors.amountReceived = notNegativeMessage('El monto recibido');
    } else if (Array.isArray(data.items) && data.items.length > 0 && Number(data.amountReceived) < calculateSaleTotal(data)) {
      fieldErrors.amountReceived = 'El monto recibido es menor al total de la venta.';
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
