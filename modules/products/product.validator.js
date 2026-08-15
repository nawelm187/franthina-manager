/**
 * product.validator.js
 * Responsabilidad: centralizar toda validación de un Producto.
 * Nunca se valida directamente dentro del formulario del renderer.
 */

import { ValidationError } from '../../core/errors.js';
import { isNonEmptyString, isNonNegativeNumber, requiredTextMessage, notNegativeMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';

/** @param {import('./product.model.js').Product} data @throws {ValidationError} */
export function validateProduct(data) {
  /** @type {Record<string,string>} */
  const fieldErrors = {};

  if (!isNonEmptyString(data.name, 2)) {
    fieldErrors.name = requiredTextMessage('El nombre');
  }
  if (!isNonNegativeNumber(data.costPrice)) {
    fieldErrors.costPrice = notNegativeMessage('El precio de costo');
  }
  if (!isNonNegativeNumber(data.sellPrice)) {
    fieldErrors.sellPrice = notNegativeMessage('El precio de venta');
  }
  if (data.sellPrice > 0 && data.costPrice > data.sellPrice) {
    fieldErrors.sellPrice = 'El precio de venta es menor al costo: revisá la rentabilidad.';
  }
  if (!isNonNegativeNumber(data.stock)) {
    fieldErrors.stock = notNegativeMessage('El stock');
  }
  if (data.description && data.description.length > 500) {
    fieldErrors.description = 'La descripción no puede superar los 500 caracteres.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
