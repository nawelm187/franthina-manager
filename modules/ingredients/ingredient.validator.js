/**
 * ingredient.validator.js
 * Responsabilidad: centralizar la validación de un Ingrediente.
 */

import { ValidationError } from '../../core/errors.js';
import { isNonEmptyString, isNonNegativeNumber, isOneOf, requiredTextMessage, notNegativeMessage, invalidValueMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';
import { UNITS } from './ingredient.model.js';

export function validateIngredient(data) {
  const fieldErrors = {};

  if (!isNonEmptyString(data.name, 2)) {
    fieldErrors.name = requiredTextMessage('El nombre');
  }
  if (!isOneOf(data.unit, UNITS)) {
    fieldErrors.unit = invalidValueMessage('La unidad', { fem: true });
  }
  if (!isNonNegativeNumber(data.stock)) fieldErrors.stock = notNegativeMessage('El stock');
  if (!isNonNegativeNumber(data.minStock)) fieldErrors.minStock = notNegativeMessage('El stock mínimo');
  if (!isNonNegativeNumber(data.cost)) fieldErrors.cost = notNegativeMessage('El costo');

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
