/**
 * app.js
 * Responsabilidad: único punto de arranque de la aplicación.
 *
 * Desde v0.19 la app tiene dos "zonas" que comparten un único Router y un
 * único nodo <main id="main-content"> (nunca se recrea — así el Router se
 * construye una sola vez, para toda la vida de la página, y no acumula
 * listeners de popstate ni pierde referencias al cruzar entre zonas):
 *
 * - Tienda pública (ROUTES.STORE_HOME, ROUTES.STORE_CART): la ve cualquier
 *   visitante, sin login. Chrome: header + footer de tienda.
 * - Administración (todo bajo /admin): el sistema de gestión existente,
 *   intacto. Chrome: sidebar + botón de menú en mobile.
 *
 * Cuando la ruta activa cambia de zona, se reconstruye el "chrome" (la
 * cáscara visual alrededor del contenido) y se reubica el mismo nodo
 * <main> adentro — nunca contiene lógica de negocio de ningún módulo.
 */

import { ROUTES, NAV_ITEMS, APP_CONFIG } from './core/config.js';
import { can } from './core/permissions.js';
import { icon } from './core/icons.js';
import { Router } from './core/router.js';
import { withBase } from './core/basePath.js';
import { store } from './core/state.js';
import { eventBus, EVENTS } from './core/eventBus.js';
import { installGlobalErrorHandling } from './core/errors.js';
import { runMigrations } from './core/storage/migrations.js';
import { initToastListener, showToast } from './components/toast.js';
import { storeCart } from './core/storeCart.js';
import { auth } from './core/auth.js';
import { currentUser } from './core/currentUser.js';
import { initialStoreTheme, applyTheme, toggleStoreTheme } from './core/theme.js';
import { renderLogin } from './modules/login/index.js';

installGlobalErrorHandling();

const STORE_NAV_ITEMS = [
  { route: ROUTES.STORE_HOME, label: 'Inicio', icon: 'home' },
];

/** @type {HTMLElement} nodo estable, nunca se recrea — ver comentario de arriba */
let mainContentEl;
/** 'admin' | 'store' | 'login' | null — null solo antes del primer render. */
let currentZone = null;
let migrationsRan = false;

function zoneOf(pathname) {
  return pathname.startsWith('/admin') ? 'admin' : 'store';
}

/** Zona que corresponde mostrar AHORA MISMO, cruzando la ruta pedida con la
 *  sesión: una ruta de /admin sin sesión iniciada siempre resuelve a
 *  'login', sin importar qué zona sea la ruta en sí. */
function resolveZone(pathname) {
  const zone = zoneOf(pathname);
  if (zone === 'admin' && !auth.getCachedSession()) return 'login';
  return zone;
}

function slotMainContent(container) {
  const slot = container.querySelector('#main-content-slot');
  slot.replaceWith(mainContentEl);
}

/** Un módulo con datos operativos de todos los días (Ventas, Pedidos,
 *  Producción...) lo ve cualquier rol con acceso — Reportes y Configuración
 *  quedan reservados a quien puede actuar sobre lo que muestran. */
function isNavItemVisible(item) {
  if (item.route === ROUTES.REPORTS) return can('viewReports');
  if (item.route === ROUTES.SETTINGS) return can('manageSettings');
  return true;
}

/** Misma regla que isNavItemVisible(), pero contra la URL pedida —
 *  ocultar el link del menú no alcanza si alguien escribe la ruta a mano. */
function isRouteAllowedForRole(pathname) {
  if (pathname.startsWith(ROUTES.REPORTS)) return can('viewReports');
  if (pathname.startsWith(ROUTES.SETTINGS)) return can('manageSettings');
  return true;
}

function buildAdminChrome() {
  document.body.innerHTML = `
    <a class="skip-link" href="#main-content">Saltar al contenido principal</a>
    <div class="app-shell">
      <button class="btn btn--ghost sidebar-toggle" id="sidebar-toggle" aria-label="Abrir menú" aria-expanded="false">${icon('menu')}</button>
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
      <nav class="app-sidebar" id="app-sidebar" aria-label="Navegación principal">
        <a class="app-brand" href="${withBase(ROUTES.DASHBOARD)}" data-link aria-label="Ir al panel principal">
          <img src="assets/icons/logo-sidebar.png" alt="" class="app-brand__logo" width="40" height="40" />
          ${APP_CONFIG.appName}
        </a>
        ${NAV_ITEMS.filter(isNavItemVisible).map((item) => `
          <a class="nav-link" href="${withBase(item.route)}" data-link data-route="${item.route}">
            <span class="nav-link__icon">${icon(item.icon)}</span> ${item.label}
          </a>`).join('')}
        <a class="nav-link nav-link--muted" href="${withBase(ROUTES.STORE_HOME)}" data-link data-route="${ROUTES.STORE_HOME}">
          <span class="nav-link__icon">${icon('shopping_bag')}</span> Ver tienda online
        </a>
        <button type="button" class="nav-link nav-link--muted" id="btn-logout" style="width:100%; text-align:left; background:none; border:none; cursor:pointer;">
          <span class="nav-link__icon">${icon('logout')}</span> Cerrar sesión
        </button>
      </nav>
      <div id="main-content-slot"></div>
    </div>
  `;
  slotMainContent(document.querySelector('.app-shell'));
  mainContentEl.className = 'app-main';
  document.title = APP_CONFIG.appName;
  setupSidebarToggle();
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await auth.signOut();
    showToast({ type: 'success', message: 'Sesión cerrada.' });
  });
}

function buildStoreChrome() {
  document.body.innerHTML = `
    <a class="skip-link" href="#main-content">Saltar al contenido principal</a>
    <div class="store-shell">
      <header class="store-header">
        <a class="store-brand" href="${withBase(ROUTES.STORE_HOME)}" data-link aria-label="Ir al inicio de la tienda">
          <img src="assets/icons/logo-sidebar.png" alt="" class="store-brand__logo" width="44" height="44" />
          <span>
            <span class="store-brand__name">${APP_CONFIG.storeName}</span>
            <span class="store-brand__tagline">${APP_CONFIG.storeTagline}</span>
          </span>
        </a>
        <nav class="store-nav" aria-label="Navegación de la tienda">
          ${STORE_NAV_ITEMS.map((item) => `
            <a class="nav-link" href="${withBase(item.route)}" data-link data-route="${item.route}">${item.label}</a>`).join('')}
          <button type="button" class="btn btn--ghost btn--icon-only" id="btn-store-theme-toggle" aria-label="Cambiar a modo ${document.documentElement.classList.contains('theme-dark') ? 'claro' : 'oscuro'}">
            ${icon(document.documentElement.classList.contains('theme-dark') ? 'light_mode' : 'dark_mode')}
          </button>
          <a class="nav-link store-cart-link" href="${withBase(ROUTES.STORE_CART)}" data-link data-route="${ROUTES.STORE_CART}" aria-label="Ver carrito">
            ${icon('shopping_cart')} Carrito<span class="cart-badge" id="cart-badge" hidden>0</span>
          </a>
        </nav>
      </header>
      <div id="main-content-slot"></div>
      <footer class="store-footer">
        <p>${APP_CONFIG.storeName} — pedidos sujetos a disponibilidad y confirmación.</p>
        <a href="${withBase(ROUTES.DASHBOARD)}" data-link class="store-admin-link">Panel de administración</a>
      </footer>
    </div>
  `;
  document.getElementById('btn-store-theme-toggle')?.addEventListener('click', (e) => {
    const next = toggleStoreTheme();
    e.currentTarget.setAttribute('aria-label', `Cambiar a modo ${next === 'dark' ? 'claro' : 'oscuro'}`);
    e.currentTarget.innerHTML = icon(next === 'dark' ? 'light_mode' : 'dark_mode');
  });
  slotMainContent(document.querySelector('.store-shell'));
  mainContentEl.className = 'app-main';
  document.title = APP_CONFIG.storeName;
  updateCartBadge();
}

function buildLoginChrome() {
  document.body.innerHTML = `
    <a class="skip-link" href="#main-content">Saltar al contenido principal</a>
    <div class="login-shell">
      <div id="main-content-slot"></div>
    </div>
  `;
  slotMainContent(document.querySelector('.login-shell'));
  mainContentEl.className = 'login-main';
  document.title = APP_CONFIG.appName;
  renderLogin(mainContentEl);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = storeCart.getCount();
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

function applyA11yPrefs(a11y) {
  const html = document.documentElement;
  html.classList.toggle('a11y-text-lg', a11y.textSize === 'lg');
  html.classList.toggle('a11y-text-xl', a11y.textSize === 'xl');
  html.classList.toggle('a11y-contrast-high', a11y.contrast === 'high');
  html.classList.toggle('a11y-spacing-relaxed', a11y.spacing === 'relaxed');
  html.classList.toggle('a11y-reduce-motion', Boolean(a11y.reduceMotion));
  html.classList.toggle('theme-dark', a11y.theme === 'dark');
}

function highlightActiveNav(pathname) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.route === pathname);
  });
}

/**
 * Se ejecuta en cada cambio de ruta PERMITIDO (el guard de auth ya lo dejó
 * pasar — ver setGuard más abajo). Si la zona resuelta cambió, reconstruye
 * el chrome antes de que el módulo renderice — así, para cuando
 * `view.render()` corre, `mainContentEl` ya está reubicado en el lugar
 * correcto del DOM.
 */
function onRouteChanged(pathname) {
  const zone = resolveZone(pathname);
  if (zone === 'login') return; // el guard (onBlocked, ver setGuard) ya se encarga de esto
  if (zone !== currentZone) {
    currentZone = zone;
    if (zone === 'admin') buildAdminChrome(); else buildStoreChrome();
  }
  highlightActiveNav(pathname);
}

function interceptInternalLinks(router) {
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (!link) return;
    e.preventDefault();
    router.navigate(link.getAttribute('href'));
    closeSidebar();
  });
}

function closeSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('is-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('is-open');
  const toggle = document.getElementById('sidebar-toggle');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.classList.remove('is-hidden');
  document.removeEventListener('keydown', onSidebarKeydown);
}

/**
 * Mientras el menú mobile está abierto: Escape lo cierra y devuelve el foco
 * al botón de menú; Tab queda atrapado dentro del menú (igual que en los modales,
 * ver components/modal.js) para que no se escape hacia contenido oculto
 * detrás del fondo oscuro.
 */
function onSidebarKeydown(e) {
  const sidebar = document.getElementById('app-sidebar');
  if (e.key === 'Escape') {
    closeSidebar();
    document.getElementById('sidebar-toggle')?.focus();
    return;
  }
  if (e.key !== 'Tab' || !sidebar) return;
  const focusable = Array.from(sidebar.querySelectorAll('a[href], button')).filter((el) => el.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function setupSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  toggle?.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('is-open');
    backdrop.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    // El botón se esconde mientras el menú está abierto para no tapar el logo;
    // el menú se puede cerrar tocando afuera (backdrop), con Escape, o eligiendo una sección.
    toggle.classList.toggle('is-hidden', isOpen);
    if (isOpen) {
      document.addEventListener('keydown', onSidebarKeydown);
      sidebar.querySelector('a')?.focus();
    } else {
      document.removeEventListener('keydown', onSidebarKeydown);
    }
  });
  backdrop?.addEventListener('click', () => {
    closeSidebar();
    toggle?.focus();
  });
}

/** Corre las migraciones de datos UNA sola vez, y solo cuando hay sesión
 *  iniciada — con la base en Supabase, un visitante de la tienda sin sesión
 *  no tiene permiso para tocar app_meta (ver franthina_schema.sql), así que
 *  correr esto sin sesión tiraría un error de permisos sin sentido para un
 *  cliente que solo está mirando el catálogo. */
async function ensureMigrations() {
  if (migrationsRan) return;
  migrationsRan = true;
  await runMigrations();
}

async function init() {
  await store.hydrateA11yPrefs();
  await store.hydrateBusinessSettings();

  // mainContentEl se crea UNA sola vez acá; build*Chrome() solo lo reubica
  // (nunca lo recrea) cada vez que cambia la zona.
  mainContentEl = document.createElement('main');
  mainContentEl.id = 'main-content';
  mainContentEl.tabIndex = -1;

  initToastListener();
  applyA11yPrefs({
    ...store.getState().a11y,
    // Sin sesión, a11y.theme nunca es una elección real — es el valor por
    // defecto (DEFAULT_A11Y), porque hydrateA11yPrefs() no pudo leer nada.
    // Ahí es donde entra la preferencia local de la tienda en su lugar.
    theme: auth.getCachedSession() ? store.getState().a11y.theme : initialStoreTheme(),
  });
  eventBus.on(EVENTS.A11Y_PREFS_CHANGED, applyA11yPrefs);
  eventBus.on(EVENTS.CART_CHANGED, updateCartBadge);

  // Se espera a conocer el estado real de la sesión ANTES de armar el Router:
  // así su guard (sincrónico, ver core/router.js) es correcto desde la
  // primerísima resolución de ruta, sin una ventana donde no se sabe todavía.
  const initialSession = await auth.ready();
  await currentUser.refresh(initialSession);
  if (initialSession) await ensureMigrations();

  const router = new Router(mainContentEl);

  router
    // Tienda pública
    .register(ROUTES.STORE_HOME, () => import('./modules/store-catalog/index.js'))
    .register(ROUTES.STORE_CART, () => import('./modules/store-cart/index.js'))
    // Administración
    .register(ROUTES.DASHBOARD, () => import('./modules/dashboard/index.js'))
    .register(ROUTES.PRODUCTS, () => import('./modules/products/index.js'))
    .register(ROUTES.INGREDIENTS, () => import('./modules/ingredients/index.js'))
    .register(ROUTES.RECIPES, () => import('./modules/recipes/index.js'))
    .register(ROUTES.INVENTORY, () => import('./modules/inventory/index.js'))
    .register(ROUTES.PRODUCTION, () => import('./modules/production/index.js'))
    .register(ROUTES.CUSTOMERS, () => import('./modules/customers/index.js'))
    .register(ROUTES.SALES, () => import('./modules/sales/index.js'))
    .register(ROUTES.CASHBOX, () => import('./modules/cashbox/index.js'))
    .register(ROUTES.ORDERS, () => import('./modules/orders/index.js'))
    .register(ROUTES.SUPPLIERS, () => import('./modules/suppliers/index.js'))
    .register(ROUTES.PURCHASES, () => import('./modules/purchases/index.js'))
    .register(ROUTES.REPORTS, () => import('./modules/reports/index.js'))
    .register(ROUTES.SETTINGS, () => import('./modules/settings/index.js'))
    .registerNotFound(() => import('./modules/not-found/index.js'));

  // Bloquea cualquier ruta de /admin sin sesión: en vez de dejar que el
  // Router cargue el módulo protegido (que ya arrancaría a pedir datos),
  // muestra el login y no carga nada más. Con sesión pero sin permiso para
  // ESA ruta puntual (ej. un empleado escribiendo la URL de Configuración
  // a mano), no tiene sentido mostrarle el login — ya inició sesión — así
  // que lo manda al Dashboard en cambio.
  router.setGuard({
    test: (pathname) => {
      if (zoneOf(pathname) !== 'admin') return true;
      if (!auth.getCachedSession()) return false;
      return isRouteAllowedForRole(pathname);
    },
    onBlocked: (pathname) => {
      if (auth.getCachedSession()) {
        router.navigate(ROUTES.DASHBOARD);
        return;
      }
      currentZone = 'login';
      buildLoginChrome();
    },
  });

  eventBus.on(EVENTS.ROUTE_CHANGED, onRouteChanged);

  // Vuelve a resolver la ruta actual cada vez que cambia si HAY o no sesión
  // (nunca en cada evento de auth sin más: Supabase renueva el token de
  // sesión sola cada tanto, y eso dispara el mismo evento — reaccionar a
  // eso también volvería a renderizar la pantalla entera de la nada,
  // pudiendo cortar a alguien a mitad de un formulario). Un login exitoso
  // hace que la ruta de /admin que se había pedido (y bloqueado) ahora sí
  // cargue; un logout hace que la próxima acción vuelva a mostrar el login
  // en vez de dejar contenido protegido a la vista.
  let wasAuthenticated = Boolean(initialSession);
  auth.onChange(async (session) => {
    const isAuthenticated = Boolean(session);
    if (isAuthenticated === wasAuthenticated) return;
    wasAuthenticated = isAuthenticated;
    await currentUser.refresh(session);
    if (isAuthenticated) await ensureMigrations();
    router.start();
  });

  interceptInternalLinks(router);
  router.start();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {
        // El funcionamiento offline es una mejora progresiva: si falla, la app sigue funcionando online.
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    // Si algo no contemplado revienta durante el arranque, mostrar ESTO en
    // vez de dejar la página completamente en blanco y en silencio — lo que
    // pasó recién con hydrateBusinessSettings() antes del try/catch de
    // arriba es exactamente el escenario que esto cubre a futuro.
    console.error('[Franthina] Error fatal al iniciar la aplicación:', err);
    document.body.innerHTML = `
      <div style="min-height:100vh; min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px; font-family:sans-serif; text-align:center;">
        <div>
          <h1 style="margin:0 0 8px;">No pudimos cargar Franthina</h1>
          <p style="color:#666; margin:0 0 16px;">Probá recargar la página. Si el problema sigue, revisá la consola del navegador para más detalle.</p>
          <button onclick="location.reload()" style="padding:10px 20px; border-radius:8px; border:none; background:#7D2142; color:white; cursor:pointer;">Recargar</button>
        </div>
      </div>`;
  });
});
