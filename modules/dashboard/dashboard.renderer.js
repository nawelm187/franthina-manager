/**
 * dashboard.renderer.js
 * Responsabilidad: dibujar el panel principal a partir del resumen ya calculado.
 */

import { escapeHtml, formatCurrency } from '../../core/utils.js';
import { icon } from '../../core/icons.js';

function statCard(iconName, label, value, variant = '') {
  return `
    <div class="card">
      <div class="row gap-3" style="align-items:flex-start;">
        <span style="font-size: var(--fs-2xl);">${icon(iconName)}</span>
        <div>
          <p style="margin:0; font-size: var(--fs-sm);">${escapeHtml(label)}</p>
          <p style="margin:0; font-family: var(--font-display); font-size: var(--fs-2xl); font-weight:700; color: var(--text-primary);" class="${variant}">${value}</p>
        </div>
      </div>
    </div>`;
}

export function renderDashboard(container, summary) {
  const lowStockRows = summary.lowStockIngredients.slice(0, 6).map((i) => `
    <li class="row gap-2" style="justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--surface-border);">
      <span>${escapeHtml(i.name)}</span>
      <span class="badge badge--danger">${i.stock} ${escapeHtml(i.unit)} (mín. ${i.minStock})</span>
    </li>`).join('') || `<li class="state-panel"><p>Ningún ingrediente con stock bajo. ${icon('celebration')}</p></li>`;

  container.innerHTML = `
    <header style="margin-bottom: var(--space-5);">
      <h1>Panel principal</h1>
      <p>Un vistazo rápido al estado actual de Franthina.</p>
    </header>

    <div class="grid-cards" style="margin-bottom: var(--space-6);">
      ${statCard('payments', 'Ventas de hoy', formatCurrency(summary.todaySalesTotal))}
      ${statCard('lock_open', 'Caja', summary.cashboxOpen ? 'Abierta' : 'Cerrada', summary.cashboxOpen ? 'badge badge--success' : 'badge badge--warning')}
      ${statCard('bakery_dining', 'Productos activos', `${summary.activeProducts} / ${summary.totalProducts}`)}
      ${statCard('grass', 'Ingredientes registrados', summary.totalIngredients)}
      ${statCard('menu_book', 'Recetas cargadas', summary.totalRecipes)}
      ${statCard('factory', 'Producción pendiente', summary.pendingProduction)}
      ${statCard('edit_note', 'Pedidos pendientes', summary.pendingOrders)}
      ${statCard('group', 'Clientes', summary.totalCustomers)}
      ${statCard('trending_up', 'Margen promedio', `${summary.avgMargin}%`)}
      ${statCard('warning', 'Alertas de stock bajo', summary.lowStockIngredients.length, summary.lowStockIngredients.length > 0 ? 'badge badge--danger' : '')}
    </div>

    <div class="card">
      <div class="card__header"><h3 style="margin:0;">Ingredientes con stock bajo</h3></div>
      <ul style="list-style:none; margin:0; padding:0;">${lowStockRows}</ul>
    </div>
  `;
}
