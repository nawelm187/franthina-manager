/**
 * recipe.validator.js
 * Responsabilidad: centralizar la validación de una Receta.
 */

import { ValidationError } from '../../core/errors.js';
import { isNonEmptyString, isPositiveNumber, requiredTextMessage, mustBePositiveMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';

/** @param {import('./recipe.model.js').Recipe} data */
export function validateRecipe(data) {
  const fieldErrors = {};

  if (!isNonEmptyString(data.name, 2)) {
    fieldErrors.name = requiredTextMessage('El nombre');
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    fieldErrors.items = 'Agregá al menos un ingrediente a la receta.';
  } else if (data.items.some((it) => !it.ingredientId || !isPositiveNumber(it.quantity))) {
    fieldErrors.items = 'Cada ingrediente necesita cantidad mayor a cero.';
  } else {
    const ids = data.items.map((it) => it.ingredientId);
    if (new Set(ids).size !== ids.length) {
      fieldErrors.items = 'Hay un ingrediente repetido en la receta — sumá su cantidad en una sola línea en vez de agregarlo dos veces.';
    }
  }
  if (!isPositiveNumber(data.yieldQuantity)) {
    fieldErrors.yieldQuantity = mustBePositiveMessage('El rendimiento');
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
