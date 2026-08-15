/**
 * icons.js
 * Responsabilidad: único punto de la app que sabe cómo dibujar un ícono.
 * Usa Material Symbols (Google Fonts) en vez de emojis — mismo estilo en
 * todos los sistemas operativos y navegadores, en vez de depender del set
 * de emojis que cada plataforma decida renderizar.
 *
 * Uso: icon('delete') dentro de un template string que ya va a innerHTML.
 * Nunca usar con textContent — es HTML.
 */
export function icon(name, { className = '', label = '' } = {}) {
  const cls = `icon${className ? ` ${className}` : ''}`;
  const hidden = label ? '' : ' aria-hidden="true"';
  const text = label ? `<span class="sr-only">${label}</span>` : '';
  return `<span class="material-symbols-outlined ${cls}"${hidden} translate="no">${name}</span>${text}`;
}

/**
 * Igual que icon(), pero devuelve un Element de verdad en vez de HTML en texto.
 * Usar acá en vez de meter icon() con template strings cuando el contenido
 * de al lado viene de una variable dinámica (ej. un mensaje de error) — así
 * nunca hace falta escapar nada a mano ni arriesgarse a inyectar HTML.
 */
export function iconElement(name, { className = '' } = {}) {
  const span = document.createElement('span');
  span.className = `material-symbols-outlined icon${className ? ` ${className}` : ''}`;
  span.setAttribute('aria-hidden', 'true');
  span.setAttribute('translate', 'no');
  span.textContent = name;
  return span;
}
