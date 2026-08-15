/**
 * customer.validator.js
 * Responsabilidad: centralizar la validación de un Cliente.
 */

import { ValidationError } from '../../core/errors.js';
import { isNonEmptyString, isValidEmail, requiredTextMessage, invalidEmailMessage, FORM_HAS_ERRORS_MESSAGE } from '../../core/validators.js';

export function validateCustomer(data) {
  const fieldErrors = {};

  if (!isNonEmptyString(data.name, 2)) {
    fieldErrors.name = requiredTextMessage('El nombre');
  }
  if (data.email && !isValidEmail(data.email)) {
    fieldErrors.email = invalidEmailMessage();
  }
  if (!data.phone && !data.email) {
    fieldErrors.phone = 'Cargá al menos un teléfono o un email de contacto.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(FORM_HAS_ERRORS_MESSAGE, fieldErrors);
  }
}
