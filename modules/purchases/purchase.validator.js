/**
 * purchase.validator.js
 * Responsabilidad: centralizar la validación de una Compra.
 */

import { ValidationError } from '../../core/errors.js';
import { isPositiveNumber, isNonNegativeNumber, mustSelectMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';

export function validatePurchase(data) {
  const fieldErrors = {};

  if (!data.supplierId) {
    fieldErrors.supplierId = mustSelectMessage('un proveedor');
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    fieldErrors.items = 'Agregá al menos un ingrediente a la compra.';
  } else if (data.items.some((it) => !it.ingredientId || !isPositiveNumber(it.quantity) || !isNonNegativeNumber(it.unitCost))) {
    fieldErrors.items = 'Cada línea necesita un ingrediente, cantidad mayor a cero y un costo válido.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
