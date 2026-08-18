/**
 * config.js
 * Responsabilidad: única fuente de configuración global de la aplicación.
 * Nunca duplicar constantes fuera de este archivo.
 */

export const APP_CONFIG = Object.freeze({
  appName: 'Franthina Manager',
  // Nombre y bajada que ve el cliente en la tienda pública — separados de
  // "appName" (que es el nombre de la herramienta interna, no de la marca).
  storeName: 'Franthina Repostería',
  storeTagline: 'Repostería artesanal, hecha a pedido',
  version: '0.31.10',
  storageAdapter: 'supabase', // 'localStorage' | 'supabase'
  storagePrefix: 'franthina:',
  defaultCurrency: 'ARS',
  defaultLocale: 'es-AR',
});

/**
 * Credenciales del proyecto de Supabase. La "publishableKey" está pensada
 * para ir en código que corre en el navegador — no es secreta, y por eso es
 * segura de tener acá; la protección real de los datos la hacen las
 * políticas de seguridad (RLS) configuradas en la base, no esta clave.
 * Nunca poner acá la "service_role key" — esa sí es secreta y nunca debe
 * viajar al navegador del cliente.
 */
export const SUPABASE_CONFIG = Object.freeze({
  url: 'https://ppsnncwbfrrqbjprrsyx.supabase.co',
  publishableKey: 'sb_publishable_FRAypbImChUVWriGurVljA_wMYOUgtI',
});

export const ROUTES = Object.freeze({
  // Tienda pública — la ve cualquier visitante, sin login.
  STORE_HOME: '/',
  STORE_CART: '/carrito',

  // Administración — todo el sistema de gestión, detrás de /admin y
  // protegido por login real (Supabase Auth) desde v0.25 — ver core/auth.js
  // y el guard de core/router.js. Los roles/permisos por tipo de usuario
  // (admin/encargado/empleado) todavía no se aplican: hoy cualquier cuenta
  // con sesión tiene acceso completo — ver docs/ROADMAP.md.
  DASHBOARD: '/admin',
  PRODUCTS: '/admin/productos',
  PRODUCT_DETAIL: '/admin/productos/:id',
  INGREDIENTS: '/admin/ingredientes',
  INGREDIENT_DETAIL: '/admin/ingredientes/:id',
  RECIPES: '/admin/recetas',
  INVENTORY: '/admin/inventario',
  PRODUCTION: '/admin/produccion',
  CUSTOMERS: '/admin/clientes',
  SALES: '/admin/ventas',
  CASHBOX: '/admin/caja',
  ORDERS: '/admin/pedidos',
  SUPPLIERS: '/admin/proveedores',
  PURCHASES: '/admin/compras',
  REPORTS: '/admin/reportes',
  SETTINGS: '/admin/configuracion',
});

// Nombres de Material Symbols (Google Fonts) — ver core/icons.js. No son
// emojis: son el nombre del ícono que icon() busca en la fuente.
export const NAV_ITEMS = Object.freeze([
  { route: ROUTES.DASHBOARD, label: 'Panel principal', icon: 'home' },
  { route: ROUTES.SALES, label: 'Ventas', icon: 'shopping_cart' },
  { route: ROUTES.ORDERS, label: 'Pedidos', icon: 'edit_note' },
  { route: ROUTES.CASHBOX, label: 'Caja', icon: 'payments' },
  { route: ROUTES.PRODUCTS, label: 'Productos', icon: 'bakery_dining' },
  { route: ROUTES.INGREDIENTS, label: 'Ingredientes', icon: 'grass' },
  { route: ROUTES.RECIPES, label: 'Recetas', icon: 'menu_book' },
  { route: ROUTES.PRODUCTION, label: 'Producción', icon: 'factory' },
  { route: ROUTES.INVENTORY, label: 'Inventario', icon: 'inventory_2' },
  { route: ROUTES.PURCHASES, label: 'Compras', icon: 'receipt_long' },
  { route: ROUTES.SUPPLIERS, label: 'Proveedores', icon: 'local_shipping' },
  { route: ROUTES.CUSTOMERS, label: 'Clientes', icon: 'group' },
  { route: ROUTES.REPORTS, label: 'Reportes', icon: 'bar_chart' },
  { route: ROUTES.SETTINGS, label: 'Configuración', icon: 'settings' },
]);


