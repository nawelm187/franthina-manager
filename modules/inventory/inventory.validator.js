/**
 * inventory.validator.js
 * Responsabilidad: centralizar la validación de un Movimiento de inventario.
 */

import { ValidationError } from '../../core/errors.js';
import { isPositiveNumber, isOneOf, mustBePositiveMessage, invalidValueMessage, mustSelectMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';
import { MOVEMENT_TYPES } from './inventory.model.js';

export function validateMovement(data) {
  const fieldErrors = {};

  if (!data.ingredientId) {
    fieldErrors.ingredientId = mustSelectMessage('un ingrediente');
  }
  if (!isOneOf(data.type, Object.values(MOVEMENT_TYPES))) {
    fieldErrors.type = invalidValueMessage('El tipo de movimiento');
  }
  if (!isPositiveNumber(data.quantity)) {
    fieldErrors.quantity = mustBePositiveMessage('La cantidad');
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
