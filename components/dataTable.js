/**
 * dataTable.js
 * Responsabilidad: renderizar una tabla de datos reutilizable, con
 * ordenamiento por columna (`sortRows`, `bindTableSorting`) y modo
 * responsive tipo tarjeta. No conoce ninguna regla de negocio: solo recibe
 * columnas y filas ya preparadas por el módulo que lo usa.
 *
 * La búsqueda NO vive acá — cada Controller la implementa filtrando sus
 * propios datos antes de pasarlos como `rows` (ver `normalizeForSearch()`
 * en `core/utils.js`, usado de forma consistente en Productos, Ingredientes,
 * Recetas, Clientes y Proveedores). Separado a propósito: la búsqueda suele
 * necesitar lógica específica del módulo (por ejemplo, en qué campos
 * buscar), mientras que ordenar una columna es genérico para cualquier tabla.
 */

import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';

/**
 * @typedef {Object} ColumnDef
 * @property {string} key
 * @property {string} label
 * @property {boolean} [sortable] - si es true, el encabezado se puede clickear para ordenar
 * @property {(row: object) => string} [render] - HTML ya escapado si corresponde
 */

/**
 * @param {{ columns: ColumnDef[], rows: object[], emptyMessage?: string, emptyAction?: {id: string, label: string}|null, rowActionsHtml?: (row: object) => string, sortKey?: string|null, sortDirection?: 'asc'|'desc' }} options
 * @returns {string} HTML de la tabla
 */
export function renderDataTable({ columns, rows, emptyMessage = 'No hay datos para mostrar todavía.', emptyAction = null, rowActionsHtml, sortKey = null, sortDirection = 'asc' }) {
  if (!rows.length) {
    // emptyAction solo tiene sentido cuando la tabla está vacía "de verdad"
    // (no hay ningún registro todavía) — el controller decide eso, acá solo
    // se dibuja si se lo pasan. Si el vacío es por una búsqueda sin
    // resultados, el controller simplemente no manda emptyAction.
    const cta = emptyAction
      ? `<button type="button" class="btn btn--primary" id="${escapeHtml(emptyAction.id)}">${icon('add')} ${escapeHtml(emptyAction.label)}</button>`
      : '';
    return `
      <div class="state-panel">
        <span class="state-panel__icon">${icon('inbox')}</span>
        <p>${escapeHtml(emptyMessage)}</p>
        ${cta}
      </div>`;
  }

  const head = columns.map((col) => {
    if (!col.sortable) return `<th scope="col">${escapeHtml(col.label)}</th>`;
    const isActive = col.key === sortKey;
    const arrow = isActive ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
    const ariaSort = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
    const ariaLabel = isActive
      ? `Ordenado por ${escapeHtml(col.label)}, ${sortDirection === 'asc' ? 'ascendente' : 'descendente'}. Activar para invertir el orden.`
      : `Ordenar por ${escapeHtml(col.label)}`;
    return `<th scope="col" aria-sort="${ariaSort}"><button type="button" class="table-sort-btn" data-sort-key="${col.key}" aria-label="${ariaLabel}">${escapeHtml(col.label)}${arrow}</button></th>`;
  }).join('') + (rowActionsHtml ? '<th scope="col"><span class="sr-only">Acciones</span></th>' : '');

  const body = rows.map((row) => {
    const cells = columns.map((col) => {
      const content = col.render ? col.render(row) : escapeHtml(row[col.key] ?? '—');
      return `<td data-label="${escapeHtml(col.label)}">${content}</td>`;
    }).join('');
    const actions = rowActionsHtml ? `<td data-label="Acciones">${rowActionsHtml(row)}</td>` : '';
    return `<tr>${cells}${actions}</tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="table table--responsive">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

/**
 * Ordena filas por una clave — genérico para strings, números y fechas ISO
 * (que ordenan bien como string). Función pura, sin dependencia del DOM.
 * `null`/`undefined` siempre quedan al final, sea cual sea la dirección.
 * @param {object[]} rows @param {string} key @param {'asc'|'desc'} [direction]
 */
export function sortRows(rows, key, direction = 'asc') {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
    return String(va).localeCompare(String(vb), 'es', { numeric: true }) * sign;
  });
}

/**
 * Conecta los encabezados ordenables de una tabla ya insertada en el DOM.
 * El Controller que la usa mantiene el estado de orden (`currentSort`) y
 * decide qué hacer en `onSort` (típicamente: recalcular y volver a pintar).
 * @param {HTMLElement} container @param {{ currentSort: {key:string|null, direction:'asc'|'desc'}, onSort: (key:string, direction:'asc'|'desc') => void }} options
 */
export function bindTableSorting(container, { currentSort, onSort }) {
  container.querySelectorAll('[data-sort-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sortKey;
      const direction = currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
      onSort(key, direction);
    });
  });
}
