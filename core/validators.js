/**
 * core/validators.js
 * Responsabilidad: primitivas de validación puras y reutilizables (texto,
 * números, email). Cada *.validator.js de un módulo las compone para armar
 * su propio diccionario de fieldErrors — esta capa nunca lanza excepciones
 * ni conoce el concepto de "campo": eso es responsabilidad de cada módulo.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @param {unknown} value @param {number} [minLength] @param {number} [maxLength] */
export function isNonEmptyString(value, minLength = 1, maxLength = 200) {
  return typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;
}

/** @param {unknown} value */
export function isNonNegativeNumber(value) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return !Number.isNaN(n) && n >= 0;
}

/** @param {unknown} value */
export function isPositiveNumber(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n > 0;
}

/** @param {unknown} value */
export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value);
}

/** @param {unknown} value - se espera un string en formato de fecha ISO (yyyy-mm-dd o completo) */
export function isValidDateString(value) {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(new Date(value).getTime());
}

/** @param {unknown} value @param {string[]} allowed */
export function isOneOf(value, allowed) {
  return allowed.includes(value);
}

/**
 * ---- Mensajes de error, centralizados ----
 * Antes cada *.validator.js escribía su propio texto a mano ("El nombre
 * debe tener entre 2 y 200 caracteres.", copiado igual en 5 módulos
 * distintos). Funcionaba porque alguien fue prolijo, pero nada impedía que
 * con el tiempo un módulo nuevo dijera "Nombre requerido" y otro
 * "Completá el nombre" para el mismo error. Estas funciones son la única
 * fuente de la redacción — un validator nunca escribe el mensaje final a mano,
 * arma el label ("El nombre", "La seña") y llama a la función que corresponda.
 */

/** @param {string} label ej. 'El nombre' */
export function requiredTextMessage(label, { min = 2, max = 200 } = {}) {
  return `${label} debe tener entre ${min} y ${max} caracteres.`;
}

/** @param {string} label ej. 'El stock', 'La seña' @param {{fem?: boolean}} [opts] */
export function notNegativeMessage(label, { fem = false } = {}) {
  return `${label} no puede ser negativo${fem ? 'a' : 'o'}.`;
}

/** @param {string} label ej. 'El monto', 'La cantidad' */
export function mustBePositiveMessage(label) {
  return `${label} debe ser mayor a cero.`;
}

/** @param {string} label ej. 'El tipo de movimiento', 'La unidad' @param {{fem?: boolean}} [opts] */
export function invalidValueMessage(label, { fem = false } = {}) {
  return `${label} inválid${fem ? 'a' : 'o'}.`;
}

/** @param {string} [label] */
export function invalidEmailMessage(label = 'El email') {
  return `${label} no parece válido.`;
}

/** @param {string} label ej. 'un cliente', 'una receta' */
export function mustSelectMessage(label) {
  return `Seleccioná ${label}.`;
}

/** Mensaje raíz que acompaña a ValidationError en todos los formularios. */
export const FORM_HAS_ERRORS_MESSAGE = 'Revisá los campos marcados en el formulario.';
