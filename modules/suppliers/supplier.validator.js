/**
 * supplier.validator.js
 * Responsabilidad: centralizar la validación de un Proveedor.
 */

import { ValidationError } from '../../core/errors.js';
import { isNonEmptyString, isValidEmail, isNonNegativeNumber, requiredTextMessage, invalidEmailMessage, notNegativeMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';

export function validateSupplier(data) {
  const fieldErrors = {};

  if (!isNonEmptyString(data.name, 2)) {
    fieldErrors.name = requiredTextMessage('El nombre');
  }
  if (data.email && !isValidEmail(data.email)) {
    fieldErrors.email = invalidEmailMessage();
  }
  if (!isNonNegativeNumber(data.leadTimeDays)) {
    fieldErrors.leadTimeDays = notNegativeMessage('El tiempo de entrega');
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
