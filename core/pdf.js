/**
 * pdf.js
 * Responsabilidad: generar documentos PDF (comprobantes, reportes) con un
 * encabezado y pie de página consistentes en toda la app — así cualquier
 * PDF que salga de Franthina se ve como el mismo sistema, no como un HTML
 * cualquiera convertido a PDF.
 *
 * Usa pdf-lib (MIT), cargado desde CDN igual que Supabase (ver
 * supabaseClient.js) — no agrega ninguna dependencia nueva al build, solo
 * sigue el mismo patrón que ya usa el proyecto.
 *
 * Nunca se llama directo desde un Controller: cada tipo de documento
 * (comprobante de pedido, reporte de ventas, etc.) tiene su propia función
 * en el módulo correspondiente que arma el contenido y llama a
 * createPdfWriter() acá. Este archivo no sabe nada de pedidos, ventas ni
 * ningún concepto de negocio — solo sabe dibujar texto, tablas y páginas A4.
 */
import { PDFDocument, StandardFonts, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { APP_CONFIG } from './config.js';

const PAGE_WIDTH = 595.28;  // A4 en puntos (72pt = 1 pulgada)
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const FOOTER_HEIGHT = 36;
const CONTENT_BOTTOM = MARGIN + FOOTER_HEIGHT;

const INK = rgb(0.20, 0.14, 0.11);        // texto principal — tono "chocolate"
const INK_SECONDARY = rgb(0.45, 0.40, 0.37);
const RULE = rgb(0.85, 0.80, 0.76);
const ACCENT = rgb(0.71, 0.29, 0.47);     // rosa-vino de la marca, para el nombre "FRANTHINA"

/**
 * @param {{ documentTitle: string, documentSubtitle?: string }} options
 *   documentTitle: ej. "Pedido #000125", "Reporte de ventas"
 *   documentSubtitle: línea chica debajo, ej. el rango de fechas del reporte
 */
export async function createPdfWriter({ documentTitle, documentSubtitle = '' }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Franthina — ${documentTitle}`);
  pdfDoc.setProducer('Franthina Manager');
  pdfDoc.setCreationDate(new Date());

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = null;
  let y = 0;

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawDocumentHeader();
  }

  function drawDocumentHeader() {
    page.drawText('FRANTHINA', { x: MARGIN, y, size: 20, font: fontBold, color: ACCENT });
    page.drawText('Pastelería artesanal', { x: MARGIN, y: y - 16, size: 9, font, color: INK_SECONDARY });

    const titleWidth = fontBold.widthOfTextAtSize(documentTitle, 13);
    page.drawText(documentTitle, { x: PAGE_WIDTH - MARGIN - titleWidth, y, size: 13, font: fontBold, color: INK });
    if (documentSubtitle) {
      const subWidth = font.widthOfTextAtSize(documentSubtitle, 9);
      page.drawText(documentSubtitle, { x: PAGE_WIDTH - MARGIN - subWidth, y: y - 16, size: 9, font, color: INK_SECONDARY });
    }

    y -= 34;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: RULE });
    y -= 22;
  }

  newPage();

  /** Salta de página si lo que sigue no entra en el espacio que queda.
   *  Devuelve true si tuvo que crear una página nueva. */
  function ensureSpace(neededHeight) {
    if (y - neededHeight < CONTENT_BOTTOM) { newPage(); return true; }
    return false;
  }

  function heading(text) {
    ensureSpace(22);
    page.drawText(text, { x: MARGIN, y, size: 13, font: fontBold, color: INK });
    y -= 22;
  }

  function text(str, { bold = false, size = 10, color = INK, gap = 14 } = {}) {
    ensureSpace(gap);
    page.drawText(str, { x: MARGIN, y, size, font: bold ? fontBold : font, color });
    y -= gap;
  }

  /** "Cliente:  Juan Pérez" — label fijo a la izquierda, valor alineado. */
  function keyValueRow(label, value) {
    ensureSpace(15);
    page.drawText(label, { x: MARGIN, y, size: 10, font: fontBold, color: INK_SECONDARY });
    page.drawText(String(value), { x: MARGIN + 130, y, size: 10, font, color: INK });
    y -= 15;
  }

  function spacer(amount = 10) {
    y -= amount;
  }

  function rule() {
    ensureSpace(10);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: RULE });
    y -= 10;
  }

  /**
   * Tabla simple: encabezado en negrita + filas, con salto de página
   * automático (repite el encabezado de columnas en cada página nueva).
   * @param {{ columns: {label: string, width: number, align?: 'left'|'right'}[], rows: string[][] }} table
   */
  function table({ columns, rows }) {
    const usableWidth = PAGE_WIDTH - MARGIN * 2;
    const totalWeight = columns.reduce((sum, c) => sum + c.width, 0);
    const colX = [];
    let x = MARGIN;
    for (const col of columns) {
      colX.push(x);
      x += (col.width / totalWeight) * usableWidth;
    }

    function drawTableHeader() {
      ensureSpace(20);
      columns.forEach((col, i) => {
        const colWidth = (col.width / totalWeight) * usableWidth;
        const tx = col.align === 'right' ? colX[i] + colWidth - font.widthOfTextAtSize(col.label, 9) : colX[i];
        page.drawText(col.label, { x: tx, y, size: 9, font: fontBold, color: INK_SECONDARY });
      });
      y -= 6;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: RULE });
      y -= 14;
    }

    drawTableHeader();
    for (const row of rows) {
      const brokeToNewPage = ensureSpace(16);
      // Si ensureSpace acaba de crear una página nueva, repetimos el
      // encabezado de columnas para que la tabla se siga leyendo igual.
      if (brokeToNewPage) drawTableHeader();
      columns.forEach((col, i) => {
        const cell = String(row[i] ?? '');
        const colWidth = (col.width / totalWeight) * usableWidth;
        const cellWidth = font.widthOfTextAtSize(cell, 9.5);
        const tx = col.align === 'right' ? colX[i] + colWidth - cellWidth : colX[i];
        page.drawText(cell, { x: tx, y, size: 9.5, font, color: INK });
      });
      y -= 16;
    }
    y -= 6;
  }

  /** Cierra el documento: dibuja el pie ("Franthina Manager · Generado el
   *  DD/MM/AAAA · Página X de Y") en TODAS las páginas y devuelve los bytes
   *  listos para descargar. Se llama una sola vez, al final. */
  async function finish() {
    const pages = pdfDoc.getPages();
    const generatedOn = new Intl.DateTimeFormat(APP_CONFIG.defaultLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date());

    pages.forEach((p, i) => {
      const footerText = `Franthina Manager · Generado el ${generatedOn} · Página ${i + 1} de ${pages.length}`;
      const footerWidth = font.widthOfTextAtSize(footerText, 8);
      p.drawLine({
        start: { x: MARGIN, y: MARGIN + 14 }, end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 14 },
        thickness: 0.75, color: RULE,
      });
      p.drawText(footerText, {
        x: (PAGE_WIDTH - footerWidth) / 2, y: MARGIN, size: 8, font, color: INK_SECONDARY,
      });
    });

    return pdfDoc.save();
  }

  return { heading, text, keyValueRow, spacer, rule, table, finish };
}

/** Dispara la descarga de los bytes de un PDF con el nombre de archivo dado. */
export function downloadPdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
