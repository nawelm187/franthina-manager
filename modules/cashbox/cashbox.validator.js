/**
 * cashbox.validator.js
 * Responsabilidad: centralizar la validación de aperturas, cierres y movimientos de caja.
 */

import { ValidationError } from '../../core/errors.js';
import { isNonEmptyString, isPositiveNumber, isNonNegativeNumber, isOneOf, notNegativeMessage, mustBePositiveMessage, invalidValueMessage, requiredTextMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';
import { MOVEMENT_TYPES } from './cashbox.model.js';

export function validateOpening(data) {
  const fieldErrors = {};
  if (!isNonNegativeNumber(data.openingAmount)) fieldErrors.openingAmount = notNegativeMessage('El monto de apertura');
  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}

export function validateClosing(data) {
  const fieldErrors = {};
  if (!isNonNegativeNumber(data.closingAmountCounted)) {
    fieldErrors.closingAmountCounted = 'Contá el efectivo en caja e ingresá el monto.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}

export function validateMovement(data) {
  const fieldErrors = {};
  if (!isOneOf(data.type, Object.values(MOVEMENT_TYPES))) fieldErrors.type = invalidValueMessage('El tipo de movimiento');
  if (!isPositiveNumber(data.amount)) fieldErrors.amount = mustBePositiveMessage('El monto');
  if (!isNonEmptyString(data.reason, 2)) fieldErrors.reason = requiredTextMessage('El motivo', { min: 2, max: 200 });
  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
