/**
 * router.js
 * Responsabilidad: Router propio de la SPA. Soporta rutas dinámicas, 404,
 * historial del navegador (sin recargar), y carga perezosa (lazy loading) por módulo.
 * Ningún módulo registra rutas con "if" o "switch": todo se registra declarativamente.
 */

import { store } from './state.js';
import { eventBus, EVENTS } from './eventBus.js';
import { handleError } from './errors.js';
import { stripBase } from './basePath.js';

/**
 * @typedef {Object} RouteDefinition
 * @property {string} path - patrón de ruta, admite segmentos dinámicos ":id"
 * @property {() => Promise<{ render: (params: object, container: HTMLElement) => Promise<void>|void }>} loader - import() dinámico del módulo (lazy loading)
 */

export class Router {
  /** @param {HTMLElement} outlet - contenedor donde se renderiza la vista activa */
  constructor(outlet) {
    this.outlet = outlet;
    /** @type {RouteDefinition[]} */
    this.routes = [];
    this.notFoundLoader = null;
    this.guard = null;

    window.addEventListener('popstate', () => this.#resolve());
  }

  /** @param {string} path @param {RouteDefinition['loader']} loader */
  register(path, loader) {
    this.routes.push({ path, loader, regex: this.#toRegex(path) });
    return this;
  }

  registerNotFound(loader) {
    this.notFoundLoader = loader;
    return this;
  }

  /**
   * Protección de acceso opcional, evaluada ANTES de cargar y renderizar
   * cualquier ruta — evita que una pantalla protegida llegue a pedir datos,
   * aunque sea por un instante, mientras se decide si hay que bloquearla.
   * `test` debe ser SINCRÓNICO (por eso core/auth.js mantiene una copia en
   * memoria de la sesión): si fuera async, el bloqueo llegaría tarde,
   * después de que la carga de la ruta ya arrancó.
   * @param {{ test: (pathname: string) => boolean, onBlocked: (pathname: string) => void }} guard
   */
  setGuard(guard) {
    this.guard = guard;
    return this;
  }

  #toRegex(path) {
    const pattern = path
      .replace(/:[^/]+/g, '([^/]+)')
      .replace(/\//g, '\\/');
    const paramNames = [...path.matchAll(/:([^/]+)/g)].map((m) => m[1]);
    return { regex: new RegExp(`^${pattern}$`), paramNames };
  }

  #match(pathname) {
    for (const route of this.routes) {
      const result = route.regex.regex.exec(pathname);
      if (result) {
        const params = {};
        route.regex.paramNames.forEach((name, i) => { params[name] = result[i + 1]; });
        return { route, params };
      }
    }
    return null;
  }

  /** Navega a una nueva ruta actualizando la URL sin recargar la página. */
  navigate(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    this.#resolve();
  }

  /** Punto de entrada: resuelve la ruta actual del navegador. */
  start() {
    this.#resolve();
  }

  async #resolve() {
    // pathname lógico de la app (ej. "/productos"), independiente del subdirectorio
    // real de despliegue (ej. "/repo/productos" en un GitHub Pages project site).
    const pathname = stripBase(window.location.pathname || '/') || '/';
    const matched = this.#match(pathname);

    store.setState({ currentRoute: pathname });
    eventBus.emit(EVENTS.ROUTE_CHANGED, pathname);

    if (this.guard && !this.guard.test(pathname)) {
      this.guard.onBlocked(pathname);
      return;
    }

    try {
      if (!matched) {
        if (this.notFoundLoader) {
          const view = await this.notFoundLoader();
          return view.render({}, this.outlet);
        }
        this.outlet.innerHTML = '<div class="state-panel"><h2>Página no encontrada</h2></div>';
        return;
      }
      const view = await matched.route.loader();
      await view.render(matched.params, this.outlet);
    } catch (err) {
      handleError(err, `router:${pathname}`);
    }
  }
}
