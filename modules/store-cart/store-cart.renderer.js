/**
 * store-cart.renderer.js
 * Responsabilidad: construir el HTML del carrito y el formulario de datos
 * de contacto — nunca decide totales de negocio ni maneja eventos, eso es
 * del Controller.
 */
import { escapeHtml, formatCurrency, normalizeImageUrl } from '../../core/utils.js';
import { withBase } from '../../core/basePath.js';
import { ROUTES } from '../../core/config.js';

function qtyStepperHtml(inputId, name, { min = 0, value = 1, extraAttrs = '' } = {}) {
  return `
    <div class="qty-stepper">
      <button type="button" class="qty-stepper__btn" data-step="-1" data-target="${inputId}" aria-label="Restar uno a ${escapeHtml(name)}">−</button>
      <input class="qty-stepper__input" type="number" min="${min}" value="${value}" id="${inputId}" aria-label="Cantidad de ${escapeHtml(name)}" ${extraAttrs} />
      <button type="button" class="qty-stepper__btn" data-step="1" data-target="${inputId}" aria-label="Sumar uno a ${escapeHtml(name)}">+</button>
    </div>`;
}

function emptyCartHtml() {
  return `
    <div class="state-panel">
      <span class="state-panel__icon" aria-hidden="true">🛒</span>
      <h2>Tu carrito está vacío</h2>
      <p>Agregá productos desde el catálogo para armar tu pedido.</p>
      <a class="btn btn--primary" href="${withBase(ROUTES.STORE_HOME)}" data-link>Ver catálogo</a>
    </div>`;
}

function cartLineHtml(line) {
  const subtotal = line.product.sellPrice * line.quantity;
  const inputId = `cart-qty-${line.product.id}`;
  return `
    <div class="cart-line">
      <div class="cart-line__media" aria-hidden="true">
        <span>🧁</span>
        ${line.product.imageUrl ? `<img src="${escapeHtml(normalizeImageUrl(line.product.imageUrl))}" alt="" loading="lazy" onerror="this.remove()" />` : ''}
      </div>
      <div class="cart-line__info">
        <strong>${escapeHtml(line.product.name)}</strong>
        <span class="cart-line__unit-price">${formatCurrency(line.product.sellPrice)} c/u</span>
      </div>
      ${qtyStepperHtml(inputId, line.product.name, { min: 0, value: line.quantity, extraAttrs: `data-action="qty-change" data-id="${line.product.id}"` })}
      <span class="cart-line__subtotal">${formatCurrency(subtotal)}</span>
      <button class="btn btn--ghost btn--icon-only" data-action="remove-item" data-id="${line.product.id}" aria-label="Quitar ${escapeHtml(line.product.name)} del carrito">🗑️</button>
    </div>`;
}

export function renderCartPage(container, { lines }) {
  if (lines.length === 0) {
    container.innerHTML = `<h1>Carrito</h1>${emptyCartHtml()}`;
    return;
  }

  const total = lines.reduce((sum, l) => sum + l.product.sellPrice * l.quantity, 0);
  const today = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <h1>Carrito</h1>
    <div class="cart-lines">
      ${lines.map(cartLineHtml).join('')}
    </div>
    <div class="cart-total">
      <span>Total</span>
      <strong>${formatCurrency(total)}</strong>
    </div>

    <form id="checkout-form" class="checkout-card" novalidate>
      <h2><span aria-hidden="true">📝</span> Tus datos</h2>
      <div class="field">
        <label class="field__label" for="co-name">Nombre <span class="required">*</span></label>
        <input class="input" id="co-name" name="name" required maxlength="200" />
        <div class="field__error" data-error-for="name" hidden></div>
      </div>
      <div class="row gap-3">
        <div class="field" style="flex:1;">
          <label class="field__label" for="co-phone">Teléfono</label>
          <input class="input" type="tel" id="co-phone" name="phone" placeholder="11-5555-5555" />
          <div class="field__error" data-error-for="phone" hidden></div>
        </div>
        <div class="field" style="flex:1;">
          <label class="field__label" for="co-email">Email</label>
          <input class="input" type="email" id="co-email" name="email" />
        </div>
      </div>
      <div class="field__hint" style="margin-top:calc(var(--space-2) * -1); margin-bottom: var(--space-4);">Dejanos al menos un teléfono o un email para poder confirmarte el pedido.</div>
      <div class="field">
        <label class="field__label" for="co-address">Dirección de entrega (opcional)</label>
        <input class="input" id="co-address" name="address" />
      </div>
      <div class="field">
        <label class="field__label" for="co-deliveryDate">Fecha de entrega deseada <span class="required">*</span></label>
        <input class="input" type="date" id="co-deliveryDate" name="deliveryDate" min="${today}" value="${today}" />
        <div class="field__error" data-error-for="deliveryDate" hidden></div>
      </div>
      <div class="field">
        <label class="field__label" for="co-notes">Comentarios (opcional)</label>
        <textarea class="textarea" id="co-notes" name="notes" placeholder="Ej: sin gluten, horario preferido, etc."></textarea>
      </div>
      <button type="submit" class="btn btn--primary btn--block">Confirmar pedido</button>
      <p class="field__hint" style="text-align:center; margin-top: var(--space-3);">El pedido queda pendiente de confirmación — nos contactamos para coordinar el pago y la entrega.</p>
    </form>
  `;
}

export function renderConfirmationHtml({ order, whatsappLink }) {
  return `
    <div class="state-panel">
      <span class="state-panel__icon" aria-hidden="true">🎉</span>
      <h2>¡Pedido recibido!</h2>
      <p>Tu pedido <strong>#${escapeHtml(order.id.slice(0, 8))}</strong> quedó registrado. Nos vamos a contactar para confirmar los detalles.</p>
      ${whatsappLink ? `
        <a class="btn btn--primary" href="${whatsappLink}" target="_blank" rel="noopener">💬 Enviar pedido por WhatsApp</a>
        <p class="field__hint" style="margin-top: var(--space-2);">Así nos llega al instante y podemos confirmarte más rápido.</p>
      ` : ''}
      <a class="btn btn--secondary" href="${withBase(ROUTES.STORE_HOME)}" data-link style="margin-top: var(--space-3);">Seguir viendo el catálogo</a>
    </div>`;
}
