/**
 * production.validator.js
 * Responsabilidad: centralizar la validación de una Orden de producción.
 */

import { ValidationError } from '../../core/errors.js';
import { isPositiveNumber, isValidDateString, mustBePositiveMessage, mustSelectMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';

export function validateProductionOrder(data) {
  const fieldErrors = {};

  if (!data.recipeId) {
    fieldErrors.recipeId = mustSelectMessage('una receta');
  }
  if (!isPositiveNumber(data.multiplier)) {
    fieldErrors.multiplier = mustBePositiveMessage('La cantidad de lotes');
  }
  if (!isValidDateString(data.plannedDate)) {
    fieldErrors.plannedDate = 'Indicá una fecha planificada.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
