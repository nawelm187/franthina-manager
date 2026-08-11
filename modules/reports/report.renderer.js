/**
 * report.renderer.js
 * Responsabilidad: dibujar la interfaz del módulo Reportes.
 * Nunca calcula agregaciones — solo recibe datos ya resueltos por el Service.
 */

import { renderDataTable } from '../../components/dataTable.js';
import { formatCurrency, formatDate, escapeHtml } from '../../core/utils.js';
import { ORDER_STATUS_LABELS as PRODUCTION_STATUS_LABELS } from '../production/production.model.js';

export const REPORT_TABS = [
  { key: 'sales', label: 'Ventas' },
  { key: 'production', label: 'Producción' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'cashbox', label: 'Caja' },
  { key: 'purchases', label: 'Compras' },
  { key: 'integrity', label: '🩺 Integridad' },
  { key: 'audit', label: '📋 Auditoría' },
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
        <button class="btn btn--secondary" id="btn-export-csv" style="margin-left:auto;">⬇️ Exportar CSV</button>
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
        { key: 'type', label: 'Tipo' },
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
        <span class="state-panel__icon" aria-hidden="true">✅</span>
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

/** Últimas acciones registradas (ver core/auditLog.js): quién hizo qué y cuándo. */
export function renderAuditReport(container, logs) {
  container.innerHTML = `
    <p class="field__hint" style="margin-bottom: var(--space-4);">
      Últimas ${logs.length} acciones registradas (eliminaciones, cambios de precio,
      cancelaciones). Esta pestaña no usa el filtro de fechas de arriba.
    </p>
    ${renderDataTable({
      columns: [
        { key: 'createdAt', label: 'Fecha', render: (r) => new Date(r.createdAt).toLocaleString('es-AR') },
        { key: 'userEmail', label: 'Usuario', render: (r) => escapeHtml(r.userEmail ?? '—') },
        { key: 'action', label: 'Acción', render: (r) => escapeHtml(r.action) },
        { key: 'entity', label: 'Sobre', render: (r) => escapeHtml(r.entity) },
        { key: 'details', label: 'Detalle', render: (r) => escapeHtml(r.details || '—') },
      ],
      rows: logs,
      emptyMessage: 'Todavía no hay ninguna acción registrada.',
    })}
  `;
}
