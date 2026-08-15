/**
 * order.validator.js
 * Responsabilidad: centralizar la validación de un Pedido.
 */

import { ValidationError } from '../../core/errors.js';
import { isPositiveNumber, isNonNegativeNumber, isValidDateString, notNegativeMessage, mustSelectMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';
import { calculateOrderTotal } from './order.model.js';

export function validateOrder(data) {
  const fieldErrors = {};

  if (!data.customerId) {
    fieldErrors.customerId = mustSelectMessage('un cliente');
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    fieldErrors.items = 'Agregá al menos un producto al pedido.';
  } else if (data.items.some((it) => !it.productId || !isPositiveNumber(it.quantity))) {
    fieldErrors.items = 'Cada línea necesita un producto y una cantidad mayor a cero.';
  }
  if (!isValidDateString(data.deliveryDate)) {
    fieldErrors.deliveryDate = 'Indicá una fecha de entrega.';
  }
  if (!isNonNegativeNumber(data.depositAmount)) {
    fieldErrors.depositAmount = notNegativeMessage('La seña', { fem: true });
  } else if (Array.isArray(data.items) && data.items.length > 0 && Number(data.depositAmount) > calculateOrderTotal(data)) {
    fieldErrors.depositAmount = 'La seña no puede ser mayor al total del pedido.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
