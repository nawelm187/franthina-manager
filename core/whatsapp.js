/**
 * whatsapp.js
 * Responsabilidad: armar links de WhatsApp Click-to-Chat (wa.me). No usa
 * ninguna API ni backend — el navegador abre WhatsApp (la app si está
 * instalada, o WhatsApp Web) con el número y el mensaje ya cargados; la
 * persona solo tiene que tocar "Enviar". Por eso mismo, esto NUNCA envía
 * un mensaje automáticamente: siempre requiere que alguien confirme y
 * mande el mensaje a mano desde WhatsApp.
 */

/** Deja solo dígitos — wa.me no acepta espacios, guiones ni el signo "+". */
function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * @param {string} phone - número con o sin formato (ej. "11-5555-5555", "+54 9 11 5555-5555")
 * @param {string} message - texto plano; se codifica automáticamente para la URL
 * @returns {string|null} link wa.me listo para usar en un href, o null si no quedó ningún dígito
 */
export function buildWhatsAppLink(phone, message) {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
