/**
 * report.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Reportes.
 * Nunca calcula agregaciones — solo recibe datos ya resueltos por el Service.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, formatDate, formatRelativeTime, escapeHtml } from '../../core/utils.js';
import { ORDER_STATUS_LABELS as PRODUCTION_STATUS_LABELS } from '../production/production.model.js';
import { MOVEMENT_TYPE_LABELS } from '../inventory/inventory.model.js';
import { icon } from '../../core/icons.js';

export const REPORT_TABS = [
  { key: 'sales', label: 'Ventas' },
  { key: 'production', label: 'Producción' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'cashbox', label: 'Caja' },
  { key: 'purchases', label: 'Compras' },
  { key: 'integrity', label: `${icon('health_and_safety')} Integridad` },
  { key: 'audit', label: `${icon('history')} Auditoría` },
];

export function renderReportsShell(container, { range, activeTab }) {
  container.innerHTML = `
    <header style="margin-bottom: var(--space-5);">
      <h1>Reportes</h1>
      <p>Agregaciones de solo lectura sobre los datos que ya cargaste — nada se calcula dos veces ni se guarda por separado.</p>
    </header>

    <div class="card" style="margin-bottom: var(--space-5);">
      <div class="row gap-3" style="flex-wrap:wrap; align-items:flex-end;">
        <div class="field" style="margin:0;">
          <label class="field__label" for="rp-from">Desde</label>
          <input class="input" type="date" id="rp-from" value="${range.from}" />
        </div>
        <div class="field" style="margin:0;">
          <label class="field__label" for="rp-to">Hasta</label>
          <input class="input" type="date" id="rp-to" value="${range.to}" />
        </div>
        <button class="btn btn--secondary" id="btn-apply-range">Aplicar</button>
        <button class="btn btn--secondary" id="btn-export-pdf" style="margin-left:auto;">${icon('picture_as_pdf')} Exportar PDF</button>
        <button class="btn btn--secondary" id="btn-export-csv">${icon('download')} Exportar CSV</button>
      </div>
    </div>

    <div class="tabs">
      ${REPORT_TABS.map((tab) => `<button type="button" class="tab-btn ${tab.key === activeTab ? 'is-active' : ''}" data-tab="${tab.key}">${tab.label}</button>`).join('')}
    </div>

    <div id="report-content"></div>
  `;
}

export function renderSalesReport(container, report) {
  container.innerHTML = `
    <div class="grid-cards" style="margin-bottom: var(--space-5);">
      ${statCard('Facturado', formatCurrency(report.totalRevenue))}
      ${statCard('Cantidad de ventas', report.count)}
      ${statCard('Ticket promedio', formatCurrency(report.averageTicket))}
    </div>
    <h3>Por método de pago</h3>
    <ul style="list-style:none; padding:0; margin-bottom: var(--space-5);">
      ${Object.entries(report.byPaymentMethod).map(([label, total]) => `
        <li class="row gap-2" style="justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--surface-border);">
          <span>${escapeHtml(label)}</span><strong>${formatCurrency(total)}</strong>
        </li>`).join('') || '<li class="field__hint">Sin ventas en el rango elegido.</li>'}
    </ul>
    ${renderDataTable({
      columns: [
        { key: 'createdAt', label: 'Fecha', render: (r) => formatDate(r.createdAt) },
        { key: 'items', label: 'Items', render: (r) => `${r.items.length}` },
        { key: 'total', label: 'Total', render: (r) => formatCurrency(r.total) },
      ],
      rows: report.sales,
      emptyMessage: 'No hay ventas en el rango elegido.',
    })}
  `;
}

export function renderProductionReport(container, report) {
  container.innerHTML = `
    <div class="grid-cards" style="margin-bottom: var(--space-5);">
      ${statCard('Órdenes completadas', report.count)}
      ${statCard('Lotes totales producidos', report.totalBatches)}
    </div>
    ${renderDataTable({
      columns: [
        { key: 'completedAt', label: 'Completada', render: (r) => formatDate(r.completedAt) },
        { key: 'recipeName', label: 'Receta' },
        { key: 'multiplier', label: 'Lotes', render: (r) => `×${r.multiplier}` },
        { key: 'status', label: 'Estado', render: (r) => PRODUCTION_STATUS_LABELS[r.status] },
      ],
      rows: report.orders,
      emptyMessage: 'No hay producción completada en el rango elegido.',
    })}
  `;
}

export function renderInventoryReport(container, report) {
  container.innerHTML = `
    <div class="grid-cards" style="margin-bottom: var(--space-5);">
      ${statCard('Movimientos totales', report.count)}
      ${Object.entries(report.byType).map(([label, count]) => statCard(label, count)).join('')}
    </div>
    ${renderDataTable({
      columns: [
        { key: 'createdAt', label: 'Fecha', render: (r) => formatDate(r.createdAt) },
        { key: 'ingredientName', label: 'Ingrediente', render: (r) => escapeHtml(r.ingredientName) },
        { key: 'type', label: 'Tipo', render: (r) => escapeHtml(MOVEMENT_TYPE_LABELS[r.type] ?? r.type) },
        { key: 'quantity', label: 'Cantidad' },
        { key: 'reason', label: 'Motivo', render: (r) => escapeHtml(r.reason || '—') },
      ],
      rows: report.movements,
      emptyMessage: 'No hay movimientos de inventario en el rango elegido.',
    })}
  `;
}

export function renderCashboxReport(container, report) {
  container.innerHTML = `
    <div class="grid-cards" style="margin-bottom: var(--space-5);">
      ${statCard('Cajas cerradas', report.count)}
      ${statCard('Diferencia acumulada', formatCurrency(report.totalDifference))}
    </div>
    ${renderDataTable({
      columns: [
        { key: 'closedAt', label: 'Cierre', render: (r) => formatDate(r.closedAt) },
        { key: 'openingAmount', label: 'Apertura', render: (r) => formatCurrency(r.openingAmount) },
        { key: 'expectedAmount', label: 'Esperado', render: (r) => formatCurrency(r.expectedAmount) },
        { key: 'closingAmountCounted', label: 'Contado', render: (r) => formatCurrency(r.closingAmountCounted) },
        {
          key: 'difference',
          label: 'Diferencia',
          render: (r) => `<span class="badge badge--${r.difference < 0 ? 'danger' : 'success'}">${formatCurrency(r.difference)}</span>`,
        },
      ],
      rows: report.sessions,
      emptyMessage: 'No hay cajas cerradas en el rango elegido.',
    })}
  `;
}

export function renderPurchasesReport(container, report, suppliersById) {
  container.innerHTML = `
    <div class="grid-cards" style="margin-bottom: var(--space-5);">
      ${statCard('Compras registradas', report.count)}
      ${statCard('Total gastado', formatCurrency(report.totalSpent))}
    </div>
    <h3>Por proveedor</h3>
    <ul style="list-style:none; padding:0; margin-bottom: var(--space-5);">
      ${Object.entries(report.bySupplierId).map(([supplierId, total]) => `
        <li class="row gap-2" style="justify-content:space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--surface-border);">
          <span>${escapeHtml(suppliersById.get(supplierId)?.name ?? 'Proveedor eliminado')}</span><strong>${formatCurrency(total)}</strong>
        </li>`).join('') || '<li class="field__hint">Sin compras en el rango elegido.</li>'}
    </ul>
    ${renderDataTable({
      columns: [
        { key: 'createdAt', label: 'Fecha', render: (r) => formatDate(r.createdAt) },
        { key: 'supplierId', label: 'Proveedor', render: (r) => escapeHtml(suppliersById.get(r.supplierId)?.name ?? 'Proveedor eliminado') },
        { key: 'items', label: 'Ingredientes', render: (r) => `${r.items.length}` },
      ],
      rows: report.purchases,
      emptyMessage: 'No hay compras en el rango elegido.',
    })}
  `;
}

const SEVERITY_VARIANT = { error: 'danger', warning: 'warning', info: 'info' };
const SEVERITY_LABEL = { error: 'Error', warning: 'Atención', info: 'Info' };

export function renderIntegrityReport(container, result) {
  const grouped = groupBySeverity(result.issues);
  const summaryCards = ['error', 'warning', 'info']
    .map((sev) => statCard(SEVERITY_LABEL[sev], grouped[sev]?.length ?? 0))
    .join('');

  const listHtml = result.issues.length
    ? result.issues.map((issue) => `
        <li class="row gap-3" style="align-items:flex-start; padding: var(--space-3) 0; border-bottom: 1px solid var(--surface-border);">
          <span class="badge badge--${SEVERITY_VARIANT[issue.severity]}" style="flex-shrink:0;">${SEVERITY_LABEL[issue.severity]}</span>
          <span><strong>${issue.area}:</strong> ${issue.message}</span>
        </li>`).join('')
    : `<div class="state-panel">
        <span class="state-panel__icon">${icon('check_circle')}</span>
        <h3>Todo en orden</h3>
        <p>No se encontró ninguna inconsistencia en ${result.totalChecked} registros revisados.</p>
      </div>`;

  container.innerHTML = `
    <p class="field__hint" style="margin-bottom: var(--space-4);">
      Revisa referencias rotas, stock negativo, ids duplicados y datos incompletos en
      los ${result.totalChecked} registros de todos los módulos. No corrige nada —
      solo informa. Última corrida: ${new Date(result.checkedAt).toLocaleString('es-AR')}.
    </p>
    <div class="grid-cards" style="margin-bottom: var(--space-5);">${summaryCards}</div>
    <ul style="list-style:none; padding:0; margin:0;">${listHtml}</ul>
  `;
}

function groupBySeverity(issues) {
  return issues.reduce((acc, issue) => {
    (acc[issue.severity] ??= []).push(issue);
    return acc;
  }, {});
}

function statCard(label, value) {
  return `
    <div class="card">
      <p style="margin:0; font-size: var(--fs-sm);">${escapeHtml(label)}</p>
      <p style="margin:0; font-family: var(--font-display); font-size: var(--fs-xl); font-weight:700;">${value}</p>
    </div>`;
}

/** Últimas acciones registradas (ver core/auditLog.js): quién hizo qué y cuándo.
 * @param {{ logs: object[], allLogsCount: number, filters: {search:string, user:string, action:string, entity:string}, filterOptions: {users:string[], actions:string[], entities:string[]} }} data
 */
export function renderAuditReport(container, { logs, allLogsCount, filters, filterOptions }) {
  if (allLogsCount === 0) {
    container.innerHTML = `
      <div class="state-panel">
        <span class="state-panel__icon">${icon('history')}</span>
        <p>Todavía no hay ninguna acción registrada.</p>
      </div>`;
    return;
  }

  const userOptions = filterOptions.users.map((u) => `<option value="${escapeHtml(u)}" ${filters.user === u ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('');
  const actionOptions = filterOptions.actions.map((a) => `<option value="${escapeHtml(a)}" ${filters.action === a ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('');
  const entityOptions = filterOptions.entities.map((e) => `<option value="${escapeHtml(e)}" ${filters.entity === e ? 'selected' : ''}>${escapeHtml(auditEntityLabel(e))}</option>`).join('');

  const cards = logs.map((log) => {
    const visual = auditActionVisual(log.action);
    const hasArrow = (log.details || '').includes(' → ');
    return `
      <li class="audit-card audit-card--${visual.tone}">
        <span class="audit-card__icon">${icon(visual.iconName)}</span>
        <div class="audit-card__body">
          <p class="audit-card__title">${escapeHtml(log.action)} <span class="audit-card__entity">${escapeHtml(auditEntityLabel(log.entity))}</span></p>
          <p class="audit-card__meta">por ${escapeHtml(log.userEmail ?? 'desconocido')} · ${formatRelativeTime(log.createdAt)}</p>
          ${log.details ? `<p class="audit-card__details${hasArrow ? ' audit-card__details--change' : ''}">${escapeHtml(log.details)}</p>` : ''}
        </div>
      </li>`;
  }).join('');

  container.innerHTML = `
    <div class="card" style="margin-bottom: var(--space-4);">
      <div class="row gap-3" style="flex-wrap:wrap; align-items:flex-end;">
        <div class="field" style="margin:0; flex: 1 1 220px;">
          <label class="field__label" for="audit-search">${icon('search', { className: 'icon-inline' })}Buscar actividad</label>
          <input class="input" type="search" id="audit-search" placeholder="Producto, cliente, detalle..." value="${escapeHtml(filters.search)}" />
        </div>
        <div class="field" style="margin:0;">
          <label class="field__label" for="audit-filter-user">Usuario</label>
          <select class="input" id="audit-filter-user"><option value="">Todos</option>${userOptions}</select>
        </div>
        <div class="field" style="margin:0;">
          <label class="field__label" for="audit-filter-action">Acción</label>
          <select class="input" id="audit-filter-action"><option value="">Todas</option>${actionOptions}</select>
        </div>
        <div class="field" style="margin:0;">
          <label class="field__label" for="audit-filter-entity">Sobre</label>
          <select class="input" id="audit-filter-entity"><option value="">Todo</option>${entityOptions}</select>
        </div>
        ${(filters.search || filters.user || filters.action || filters.entity)
          ? `<button type="button" class="btn btn--ghost" id="audit-clear-filters">${icon('close', { className: 'icon-inline' })}Limpiar filtros</button>`
          : ''}
      </div>
    </div>

    <p class="field__hint" style="margin-bottom: var(--space-3);">
      Mostrando ${logs.length} de las últimas ${allLogsCount} acciones registradas. Esta pestaña no usa el filtro de fechas de arriba.
    </p>

    ${logs.length
      ? `<ul class="audit-feed">${cards}</ul>`
      : `<div class="state-panel"><span class="state-panel__icon">${icon('search')}</span><p>Ninguna acción coincide con estos filtros.</p></div>`}
  `;
}

/** Ícono + color según el verbo de la acción — extensible: si se agrega un
 *  logAction() con un verbo nuevo, cae en el caso "default" sin romper nada. */
function auditActionVisual(action) {
  const a = (action || '').toLowerCase();
  if (a.startsWith('eliminó') || a.startsWith('canceló')) return { tone: 'danger', iconName: a.startsWith('canceló') ? 'cancel' : 'delete' };
  if (a.startsWith('modificó') || a.startsWith('editó')) return { tone: 'warning', iconName: 'edit' };
  return { tone: 'neutral', iconName: 'history' };
}

/** "producto" -> "Producto", para que el filtro y la tarjeta se lean como
 *  título en vez de en minúscula suelta. */
function auditEntityLabel(entity) {
  if (!entity) return '—';
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}
