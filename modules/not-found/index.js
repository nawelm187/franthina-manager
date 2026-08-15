/**
 * modules/not-found/index.js
 * Vista mostrada cuando ninguna ruta registrada coincide con la URL actual.
 */
import { withBase, stripBase } from '../../core/basePath.js';
import { ROUTES } from '../../core/config.js';
import { icon } from '../../core/icons.js';

export function render(_params, container) {
  const pathname = stripBase(window.location.pathname || '/') || '/';
  const isAdmin = pathname.startsWith('/admin');
  const homeRoute = isAdmin ? ROUTES.DASHBOARD : ROUTES.STORE_HOME;
  const homeLabel = isAdmin ? 'Volver al panel principal' : 'Volver al inicio';

  container.innerHTML = `
    <div class="state-panel">
      <span class="state-panel__icon">${icon('search')}</span>
      <h2>No encontramos esta página</h2>
      <p>Revisá la dirección o volvé al ${isAdmin ? 'panel principal' : 'inicio'}.</p>
      <a class="btn btn--primary" href="${withBase(homeRoute)}" data-link>${homeLabel}</a>
    </div>`;
}
