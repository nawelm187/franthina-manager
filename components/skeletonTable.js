/**
 * skeletonTable.js
 * Responsabilidad: placeholder de carga con la silueta de una tabla —
 * un título + N filas de barras — en vez de un único rectángulo genérico.
 * Da la sensación de que la app ya sabe lo que va a mostrar, no que está
 * "pensando" (ver la nota de UX sobre skeleton loading vs. "Cargando...").
 */
export function skeletonTableHtml({ rows = 6 } = {}) {
  const row = `
    <div class="skeleton-row">
      <span class="skeleton" style="width:30%;"></span>
      <span class="skeleton" style="width:16%;"></span>
      <span class="skeleton" style="width:20%;"></span>
      <span class="skeleton" style="width:12%;"></span>
    </div>`;
  return `
    <div class="state-panel skeleton-table" aria-hidden="true">
      <div class="skeleton" style="width:38%; height:1.5rem; margin-bottom: var(--space-4);"></div>
      ${row.repeat(rows)}
    </div>`;
}
