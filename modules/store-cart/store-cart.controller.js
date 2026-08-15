/**
 * store-cart.controller.js
 * Responsabilidad: orquestar el carrito y el checkout. Al confirmar,
 * busca-o-crea un Cliente (por teléfono/email) y crea un Pedido real a
 * través de orderService — el mismo Pedido que administración ve en
 * /admin/pedidos. Nunca toca el storage de Productos/Clientes/Pedidos
 * directamente, solo sus Services públicos.
 */
import { renderCartPage, renderConfirmationHtml } from './store-cart.renderer.js';
import { storeCart } from '../../core/storeCart.js';
import { productService } from '../products/product.service.js';
import { customerService } from '../customers/customer.service.js';
import { orderService } from '../orders/order.service.js';
import { normalizeForSearch, formatCurrency, formatDate } from '../../core/utils.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { store } from '../../core/state.js';
import { buildWhatsAppLink } from '../../core/whatsapp.js';
import { APP_CONFIG } from '../../core/config.js';
import { bindQtyStepper } from '../../components/qtyStepper.js';
import { iconElement } from '../../core/icons.js';

export async function render(_params, container) {
  container.innerHTML = '<div class="state-panel"><div class="skeleton" style="width:100%;height:240px;"></div></div>';

  let products = [];
  try {
    // listPublic() nunca expone costPrice ni notes — ver product.service.js.
    // El carrito es parte de la tienda pública: nunca hay sesión de admin acá.
    products = await productService.listPublic();
  } catch (err) {
    handleError(err, 'store-cart:list');
  }

  paint(container, products);
}

/** Cruza lo que hay en el carrito (solo {productId, quantity}) contra los
 *  productos reales, así el precio y nombre mostrados son siempre los
 *  actuales — nunca los que había en el momento de agregar al carrito. */
function resolveCartLines(products) {
  const productsById = new Map(products.map((p) => [p.id, p]));
  return storeCart.getItems()
    .map((item) => {
      const product = productsById.get(item.productId);
      return product ? { quantity: item.quantity, product } : null;
    })
    .filter(Boolean);
}

function paint(container, products) {
  const lines = resolveCartLines(products);
  renderCartPage(container, { lines });
  bindEvents(container, products);
}

function bindEvents(container, products) {
  bindQtyStepper(container);

  container.querySelectorAll('[data-action="qty-change"]').forEach((input) => {
    input.addEventListener('change', () => {
      const qty = Math.max(0, Math.floor(Number(input.value)) || 0);
      storeCart.setQuantity(input.dataset.id, qty);
      paint(container, products);
    });
  });

  container.querySelectorAll('[data-action="remove-item"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      storeCart.removeItem(btn.dataset.id);
      paint(container, products);
    });
  });

  const form = container.querySelector('#checkout-form');
  form?.addEventListener('submit', (e) => onSubmitCheckout(e, container, products));
}

async function onSubmitCheckout(e, container, products) {
  e.preventDefault();
  const form = e.target;
  const lines = resolveCartLines(products);
  if (lines.length === 0) return;

  const formData = new FormData(form);
  const name = formData.get('name')?.toString().trim() ?? '';
  const phone = formData.get('phone')?.toString().trim() ?? '';
  const email = formData.get('email')?.toString().trim() ?? '';
  const address = formData.get('address')?.toString().trim() ?? '';
  const deliveryDate = formData.get('deliveryDate')?.toString() ?? '';
  const notes = formData.get('notes')?.toString().trim() ?? '';

  paintFieldErrors({});
  const fieldErrors = {};
  if (name.length < 2) fieldErrors.name = 'Ingresá tu nombre.';
  if (!phone && !email) fieldErrors.phone = 'Dejanos un teléfono o un email de contacto.';
  if (!deliveryDate) fieldErrors.deliveryDate = 'Elegí una fecha de entrega.';
  if (Object.keys(fieldErrors).length > 0) {
    paintFieldErrors(fieldErrors);
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const customer = await findOrCreateCustomer({ name, phone, email, address });
    const order = await orderService.createFromPublicStore({
      customerId: customer.id,
      lines,
      deliveryDate,
      notes: notes ? `Pedido desde la tienda online. ${notes}` : 'Pedido desde la tienda online.',
    });

    storeCart.clear();
    const whatsappLink = buildOrderWhatsAppLink({ lines, order, customerName: name });
    container.innerHTML = `<h1>Carrito</h1>${renderConfirmationHtml({ order, whatsappLink })}`;
  } catch (err) {
    if (err instanceof ValidationError) {
      paintFieldErrors(err.fieldErrors);
    } else {
      handleError(err, 'store-cart:checkout');
    }
  } finally {
    if (document.body.contains(submitBtn)) submitBtn.disabled = false;
  }
}

/** Arma el link de WhatsApp con el resumen del pedido, listo para que el
 *  cliente lo mande al negocio con un toque — si no hay número configurado
 *  en Configuración, devuelve null y el botón simplemente no se muestra. */
function buildOrderWhatsAppLink({ lines, order, customerName }) {
  const { whatsappNumber } = store.getState().business;
  if (!whatsappNumber) return null;

  const itemLines = lines.map((l) => `${l.quantity}x ${l.product.name}`).join('\n');
  const total = lines.reduce((sum, l) => sum + l.product.sellPrice * l.quantity, 0);
  const message = [
    `¡Hola! Quiero confirmar mi pedido en ${APP_CONFIG.appName}:`,
    '',
    itemLines,
    '',
    `Total: ${formatCurrency(total)}`,
    `Entrega deseada: ${formatDate(order.deliveryDate)}`,
    `Nombre: ${customerName}`,
    '',
    `Pedido #${order.id.slice(0, 8)}`,
  ].join('\n');

  return buildWhatsAppLink(whatsappNumber, message);
}

/** Busca un cliente ya cargado con el mismo teléfono o email (evita crear un
 *  registro duplicado en cada pedido del mismo comprador); si no existe, lo crea.
 *  Un visitante de la tienda (sin sesión de administración) no tiene permiso
 *  para LEER la lista de clientes — solo para crear uno (ver
 *  franthina_schema.sql) — así que en ese caso directamente se crea uno
 *  nuevo, sin poder chequear duplicados de antemano. */
async function findOrCreateCustomer({ name, phone, email, address }) {
  try {
    const allCustomers = await customerService.list();
    const match = phone
      ? allCustomers.find((c) => c.phone && normalizeForSearch(c.phone) === normalizeForSearch(phone))
      : allCustomers.find((c) => c.email && normalizeForSearch(c.email) === normalizeForSearch(email));
    if (match) return match;
  } catch {
    // Sin permiso de lectura (visitante sin sesión) — seguir y crear uno nuevo.
  }
  return customerService.create({ name, phone, email, address, birthday: '', notes: '' });
}

function paintFieldErrors(fieldErrors) {
  document.querySelectorAll('[data-error-for]').forEach((el) => { el.hidden = true; el.textContent = ''; });
  document.querySelectorAll('.field.has-error').forEach((el) => el.classList.remove('has-error'));
  document.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const el = document.querySelector(`[data-error-for="${field}"]`);
    const input = document.getElementById(`co-${field}`);
    if (el) {
      el.hidden = false;
      el.textContent = '';
      el.append(iconElement('warning', { className: 'icon-inline' }), document.createTextNode(message));
      if (!el.id) el.id = `error-${field}`;
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (el) input.setAttribute('aria-describedby', el.id);
      input.closest('.field')?.classList.add('has-error');
    }
  });
}
