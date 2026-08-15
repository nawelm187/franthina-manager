/**
 * cashbox.controller.js
 * Responsabilidad: coordinar Service + Renderer + eventos del DOM del módulo Caja.
 */

import { cashboxService } from './cashbox.service.js';
import {
  renderCashboxPage, openingFormHtml, movementFormHtml, closingFormHtml, sessionSummaryHtml,
} from './cashbox.renderer.js';
import { openModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { sortRows, bindTableSorting } from '../../components/dataTable.js';
import { handleError, ValidationError } from '../../core/errors.js';
import { iconElement } from '../../core/icons.js';

let sortState = { key: 'createdAt', direction: 'desc' };

export async function render(_params, container) {
  container.innerHTML = '<div class="state-panel"><div class="skeleton" style="width:100%;height:240px;"></div></div>';

  try {
    const session = await cashboxService.getActiveSession();
    const movements = session ? await cashboxService.listMovements(session.id) : [];
    const expectedAmount = session ? cashboxService.calculateExpectedAmount(session, movements) : 0;
    const sorted = sortState.key ? sortRows(movements, sortState.key, sortState.direction) : movements;

    renderCashboxPage(container, { session, movements: sorted, expectedAmount, sortState });
    bindEvents(container, session, expectedAmount);
    bindTableSorting(container, {
      currentSort: sortState,
      onSort: (key, direction) => {
        sortState = { key, direction };
        render(_params, container);
      },
    });
  } catch (err) {
    handleError(err, 'cashbox:render');
  }
}

function bindEvents(container, session, expectedAmount) {
  container.querySelector('#btn-open-cashbox')?.addEventListener('click', () => openOpeningForm(container));
  container.querySelector('#btn-add-income')?.addEventListener('click', () => openMovementForm(container, 'income'));
  container.querySelector('#btn-add-expense')?.addEventListener('click', () => openMovementForm(container, 'expense'));
  container.querySelector('#btn-close-cashbox')?.addEventListener('click', () => openClosingForm(container, session, expectedAmount));
}

function openOpeningForm(container) {
  openModal({
    title: 'Abrir caja',
    contentHtml: openingFormHtml(),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Abrir caja',
        variant: 'primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('opening-form');
          const formData = new FormData(form);
          const payload = {
            openingAmount: Number(formData.get('openingAmount')) || 0,
            notes: formData.get('notes')?.toString() ?? '',
          };
          try {
            await cashboxService.open(payload);
            showToast({ type: 'success', message: 'Caja abierta.' });
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) paintFieldErrors(err.fieldErrors);
            else { handleError(err, 'cashbox:open'); closeFn(); }
          }
        },
      },
    ],
  });
}

function openMovementForm(container, type) {
  openModal({
    title: type === 'expense' ? 'Registrar egreso' : 'Registrar ingreso',
    contentHtml: movementFormHtml(type),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Registrar',
        variant: 'primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('cashbox-movement-form');
          const formData = new FormData(form);
          const payload = {
            type,
            amount: Number(formData.get('amount')) || 0,
            reason: formData.get('reason')?.toString().trim() ?? '',
          };
          try {
            await cashboxService.addMovement(payload);
            showToast({ type: 'success', message: 'Movimiento registrado.' });
            closeFn();
            render(null, container);
          } catch (err) {
            if (err instanceof ValidationError) paintFieldErrors(err.fieldErrors);
            else { handleError(err, 'cashbox:movement'); closeFn(); }
          }
        },
      },
    ],
  });
}

function openClosingForm(container, session, expectedAmount) {
  openModal({
    title: 'Cerrar caja',
    contentHtml: closingFormHtml(expectedAmount),
    footerButtons: [
      { label: 'Cancelar', variant: 'secondary', onClick: (closeFn) => closeFn() },
      {
        label: 'Cerrar caja',
        variant: 'danger',
        onClick: async (closeFn) => {
          const form = document.getElementById('closing-form');
          const formData = new FormData(form);
          const payload = {
            closingAmountCounted: Number(formData.get('closingAmountCounted')),
            notes: formData.get('notes')?.toString() ?? '',
          };
          try {
            const closedSession = await cashboxService.close(session.id, payload);
            closeFn();
            showClosingSummary(container, closedSession);
          } catch (err) {
            if (err instanceof ValidationError) paintFieldErrors(err.fieldErrors);
            else { handleError(err, 'cashbox:close'); closeFn(); }
          }
        },
      },
    ],
  });
}

/** Muestra el resumen del arqueo (esperado vs. contado) tras cerrar la caja. */
function showClosingSummary(container, closedSession) {
  openModal({
    title: 'Resumen del cierre',
    contentHtml: sessionSummaryHtml(closedSession),
    footerButtons: [
      {
        label: 'Entendido',
        variant: 'primary',
        onClick: (closeFn) => { closeFn(); render(null, container); },
      },
    ],
  });
}

function paintFieldErrors(fieldErrors) {
  document.querySelectorAll('[data-error-for]').forEach((el) => { el.hidden = true; el.textContent = ''; });
  document.querySelectorAll('.field.has-error').forEach((el) => el.classList.remove('has-error'));
  document.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const el = document.querySelector(`[data-error-for="${field}"]`);
    const input = document.getElementById(`f-${field}`);
    if (el) {
      el.hidden = false;
      el.textContent = '';
      el.append(iconElement('warning', { className: 'icon-inline' }), document.createTextNode(message));
      if (!el.id) el.id = `error-${field}`;
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (el) input.setAttribute('aria-describedby', el.id);
      input.closest('.field')?.classList.add('has-error');
    }
  });
}
