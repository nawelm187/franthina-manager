/**
 * report.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Reportes.
 */

import { reportService } from './report.service.js';
import {
  renderReportsShell, renderSalesReport, renderProductionReport,
  renderInventoryReport, renderCashboxReport, renderPurchasesReport, renderIntegrityReport,
  renderAuditReport,
} from './report.renderer.js';
import { supplierService } from '../suppliers/supplier.service.js';
import { listRecentLogs } from '../../core/auditLog.js';
import { downloadCsv } from '../../core/csv.js';
import { handleError } from '../../core/errors.js';
import { withButtonLoading } from '../../core/buttonLoading.js';
import { showToast } from '../../components/toast.js';
import { formatCurrency, formatDate, debounce } from '../../core/utils.js';

let currentRange = null;
let currentTab = 'sales';
let auditLogsCache = null;
let auditFilters = { search: '', user: '', action: '', entity: '' };

export async function render(_params, container) {
  currentRange = currentRange ?? reportService.defaultRange();
  renderReportsShell(container, { range: currentRange, activeTab: currentTab });
  bindShellEvents(container);
  toggleRangePicker(container);
  await renderActiveTab(container);
}

function toggleRangePicker(container) {
  // Las pestañas de Integridad y Auditoría no filtran por rango de fechas.
  const isIntegrity = currentTab === 'integrity' || currentTab === 'audit';
  ['#rp-from', '#rp-to', '#btn-apply-range'].forEach((sel) => {
    const el = container.querySelector(sel);
    if (el) el.disabled = isIntegrity;
  });
  // El PDF con diseño de documento comercial hoy existe para Ventas,
  // Producción e Inventario — el resto sigue teniendo CSV. Si se agrega un
  // PDF nuevo (Compras, Caja), esta lista es el único lugar que hay que tocar.
  const pdfBtn = container.querySelector('#btn-export-pdf');
  if (pdfBtn) pdfBtn.hidden = !['sales', 'production', 'inventory'].includes(currentTab);
}

function bindShellEvents(container) {
  container.querySelector('#btn-apply-range')?.addEventListener('click', async () => {
    const from = container.querySelector('#rp-from').value;
    const to = container.querySelector('#rp-to').value;
    if (!from || !to || from > to) {
      showToast({ type: 'warning', message: 'Elegí un rango de fechas válido.' });
      return;
    }
    currentRange = { from, to };
    await renderActiveTab(container);
  });

  container.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      currentTab = btn.dataset.tab;
      // Recargar auditoría siempre que se entra a esa pestaña — es la única
      // que se mantiene cacheada en memoria (para poder filtrar sin volver a
      // pedirle a Supabase en cada letra), así que si no la refrescamos acá
      // nunca se enteraría de una acción nueva sin recargar toda la página.
      if (currentTab === 'audit') auditLogsCache = null;
      container.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
      toggleRangePicker(container);
      await renderActiveTab(container);
    });
  });

  container.querySelector('#btn-export-csv')?.addEventListener('click', () => exportCurrentTab());

  container.querySelector('#btn-export-pdf')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await withButtonLoading(btn, async () => {
        if (currentTab === 'sales') {
          const report = await reportService.salesReport(currentRange);
          const { downloadSalesReportPdf } = await import('./report.pdf.js');
          await downloadSalesReportPdf(report, currentRange);
        } else if (currentTab === 'production') {
          const report = await reportService.productionReport(currentRange);
          const { downloadProductionReportPdf } = await import('./report.pdf.js');
          await downloadProductionReportPdf(report, currentRange);
        } else if (currentTab === 'inventory') {
          const report = await reportService.inventoryReport(currentRange);
          const { downloadInventoryReportPdf } = await import('./report.pdf.js');
          await downloadInventoryReportPdf(report, currentRange);
        }
      }, { loadingLabel: 'Generando…' });
    } catch (err) {
      handleError(err, `reports:pdf:${currentTab}`);
    }
  });
}

async function renderActiveTab(container) {
  const content = container.querySelector('#report-content');
  content.innerHTML = '<div class="skeleton" style="width:100%;height:200px;"></div>';

  try {
    if (currentTab === 'sales') {
      const report = await reportService.salesReport(currentRange);
      renderSalesReport(content, report);
    } else if (currentTab === 'production') {
      const report = await reportService.productionReport(currentRange);
      renderProductionReport(content, report);
    } else if (currentTab === 'inventory') {
      const report = await reportService.inventoryReport(currentRange);
      renderInventoryReport(content, report);
    } else if (currentTab === 'cashbox') {
      const report = await reportService.cashboxReport(currentRange);
      renderCashboxReport(content, report);
    } else if (currentTab === 'purchases') {
      const report = await reportService.purchasesReport(currentRange);
      const suppliers = await supplierService.list();
      renderPurchasesReport(content, report, new Map(suppliers.map((s) => [s.id, s])));
    } else if (currentTab === 'integrity') {
      const result = await reportService.checkIntegrity();
      renderIntegrityReport(content, result);
    } else if (currentTab === 'audit') {
      if (!auditLogsCache) auditLogsCache = await listRecentLogs();
      renderAuditTab(content);
    }
  } catch (err) {
    handleError(err, `reports:${currentTab}`);
  }
}

function renderAuditTab(content, { preserveSearchFocus = false } = {}) {
  const filtered = filterAuditLogs(auditLogsCache, auditFilters);
  renderAuditReport(content, {
    logs: filtered,
    allLogsCount: auditLogsCache.length,
    filters: auditFilters,
    filterOptions: auditFilterOptions(auditLogsCache),
  });
  bindAuditFilterEvents(content);
  if (preserveSearchFocus) {
    // El re-render reemplaza todo el HTML de la pestaña (incluido el input
    // de búsqueda) — sin esto, el cursor se "cae" del campo cada vez que el
    // debounce dispara mientras la persona todavía está escribiendo.
    const input = content.querySelector('#audit-search');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

function filterAuditLogs(logs, filters) {
  const term = filters.search.trim().toLowerCase();
  return logs.filter((log) => {
    if (filters.user && log.userEmail !== filters.user) return false;
    if (filters.action && log.action !== filters.action) return false;
    if (filters.entity && log.entity !== filters.entity) return false;
    if (term) {
      const haystack = `${log.action} ${log.entity} ${log.details ?? ''} ${log.userEmail ?? ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function auditFilterOptions(logs) {
  const uniq = (arr) => [...new Set(arr)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  return {
    users: uniq(logs.map((l) => l.userEmail)),
    actions: uniq(logs.map((l) => l.action)),
    entities: uniq(logs.map((l) => l.entity)),
  };
}

function bindAuditFilterEvents(content) {
  content.querySelector('#audit-search')?.addEventListener('input', debounce((e) => {
    auditFilters = { ...auditFilters, search: e.target.value };
    renderAuditTab(content, { preserveSearchFocus: true });
  }, 250));

  content.querySelector('#audit-filter-user')?.addEventListener('change', (e) => {
    auditFilters = { ...auditFilters, user: e.target.value };
    renderAuditTab(content);
  });
  content.querySelector('#audit-filter-action')?.addEventListener('change', (e) => {
    auditFilters = { ...auditFilters, action: e.target.value };
    renderAuditTab(content);
  });
  content.querySelector('#audit-filter-entity')?.addEventListener('change', (e) => {
    auditFilters = { ...auditFilters, entity: e.target.value };
    renderAuditTab(content);
  });
  content.querySelector('#audit-clear-filters')?.addEventListener('click', () => {
    auditFilters = { search: '', user: '', action: '', entity: '' };
    renderAuditTab(content);
  });
}

async function exportCurrentTab() {
  try {
    const table = await buildCsvTableForCurrentTab();
    if (!table.rows.length) {
      showToast({ type: 'warning', message: 'No hay datos para exportar.' });
      return;
    }
    const suffix = (currentTab === 'integrity' || currentTab === 'audit') ? new Date().toISOString().slice(0, 10) : `${currentRange.from}_${currentRange.to}`;
    downloadCsv(`franthina-reporte-${currentTab}-${suffix}`, table);
  } catch (err) {
    handleError(err, `reports:export:${currentTab}`);
  }
}

async function buildCsvTableForCurrentTab() {
  if (currentTab === 'sales') {
    const report = await reportService.salesReport(currentRange);
    return {
      headers: ['Fecha', 'Items', 'Método de pago', 'Descuento', 'Total'],
      rows: report.sales.map((s) => [formatDate(s.createdAt), s.items.length, s.paymentMethod, s.discount, s.total]),
    };
  }
  if (currentTab === 'production') {
    const report = await reportService.productionReport(currentRange);
    return {
      headers: ['Completada', 'Receta', 'Lotes'],
      rows: report.orders.map((o) => [formatDate(o.completedAt), o.recipeName, o.multiplier]),
    };
  }
  if (currentTab === 'inventory') {
    const report = await reportService.inventoryReport(currentRange);
    return {
      headers: ['Fecha', 'Tipo', 'Cantidad', 'Motivo'],
      rows: report.movements.map((m) => [formatDate(m.createdAt), m.type, m.quantity, m.reason]),
    };
  }
  if (currentTab === 'cashbox') {
    const report = await reportService.cashboxReport(currentRange);
    return {
      headers: ['Cierre', 'Apertura', 'Esperado', 'Contado', 'Diferencia'],
      rows: report.sessions.map((s) => [formatDate(s.closedAt), s.openingAmount, s.expectedAmount, s.closingAmountCounted, s.difference]),
    };
  }
  if (currentTab === 'integrity') {
    const result = await reportService.checkIntegrity();
    return {
      headers: ['Severidad', 'Área', 'Mensaje'],
      rows: result.issues.map((i) => [i.severity, i.area, i.message]),
    };
  }
  if (currentTab === 'audit') {
    const logs = filterAuditLogs(auditLogsCache ?? [], auditFilters);
    return {
      headers: ['Fecha', 'Usuario', 'Acción', 'Sobre', 'Detalle'],
      rows: logs.map((l) => [formatDate(l.createdAt), l.userEmail ?? '', l.action, l.entity, l.details ?? '']),
    };
  }
  // purchases
  const report = await reportService.purchasesReport(currentRange);
  const suppliers = await supplierService.list();
  const suppliersById = new Map(suppliers.map((s) => [s.id, s]));
  return {
    headers: ['Fecha', 'Proveedor', 'Ingredientes', 'Total'],
    rows: report.purchases.map((p) => [
      formatDate(p.createdAt),
      suppliersById.get(p.supplierId)?.name ?? 'Proveedor eliminado',
      p.items.length,
      formatCurrency(p.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0)),
    ]),
  };
}
