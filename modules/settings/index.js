/**
 * modules/settings/index.js
 * Responsabilidad: pantalla de Configuración — controles de accesibilidad
 * (tamaño de fuente, contraste, espaciado, animaciones, tema) y respaldo de
 * datos (exportar/importar). El resto de la configuración (moneda, usuarios,
 * roles) queda documentado en el ROADMAP.
 */

import { store } from '../../core/state.js';
import { downloadBackup, readBackupFile, restoreBackup } from '../../core/backup.js';
import { countLegacyLocalRecords, readLegacyLocalBackup } from '../../core/legacyLocalMigration.js';
import { userProfiles } from '../../core/userProfiles.js';
import { APP_CONFIG } from '../../core/config.js';
import { confirmAction } from '../../components/confirm.js';
import { showToast } from '../../components/toast.js';
import { handleError } from '../../core/errors.js';
import { escapeHtml } from '../../core/utils.js';

function optionRow({ legend, name, options, current }) {
  const buttons = options.map(({ value, label }) => `
    <button type="button" class="btn ${current === value ? 'btn--primary' : 'btn--secondary'}" data-pref="${name}" data-value="${value}">
      ${label}
    </button>`).join('');
  return `
    <fieldset class="field" style="border:none; padding:0;">
      <legend class="field__label">${legend}</legend>
      <div class="row gap-2" style="flex-wrap:wrap;">${buttons}</div>
    </fieldset>`;
}

export function render(_params, container) {
  const { a11y, business } = store.getState();

  container.innerHTML = `
    <header style="margin-bottom: var(--space-5);">
      <h1>Configuración</h1>
      <p>Ajustá la aplicación para que sea cómoda de usar. Estos cambios se guardan automáticamente.</p>
    </header>

    <div class="card stack gap-3" style="margin-bottom: var(--space-5);">
      <h3 style="margin:0;">Datos del negocio</h3>
      <div class="field">
        <label class="field__label" for="f-whatsapp">Número de WhatsApp del negocio</label>
        <input class="input" type="tel" id="f-whatsapp" value="${business.whatsappNumber}" placeholder="Ej: 5491155555555" style="max-width: 320px;" />
        <div class="field__hint">
          Con código de país y sin espacios ni el signo "+" (ej: <code>5491155555555</code> para
          Argentina, 11 5555-5555). Se usa para el botón "Enviar pedido por WhatsApp" que ven tus
          clientes al confirmar una compra en la tienda.
        </div>
      </div>
    </div>

    <div class="card stack gap-4" style="margin-bottom: var(--space-5);">
      ${optionRow({
        legend: 'Tamaño de letra',
        name: 'textSize',
        current: a11y.textSize,
        options: [{ value: 'md', label: 'Normal' }, { value: 'lg', label: 'Grande' }, { value: 'xl', label: 'Muy grande' }],
      })}
      ${optionRow({
        legend: 'Contraste',
        name: 'contrast',
        current: a11y.contrast,
        options: [{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alto contraste' }],
      })}
      ${optionRow({
        legend: 'Espaciado',
        name: 'spacing',
        current: a11y.spacing,
        options: [{ value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Amplio' }],
      })}
      ${optionRow({
        legend: 'Animaciones',
        name: 'reduceMotion',
        current: a11y.reduceMotion,
        options: [{ value: false, label: 'Activadas' }, { value: true, label: 'Reducidas' }],
      })}
      ${optionRow({
        legend: 'Tema',
        name: 'theme',
        current: a11y.theme,
        options: [{ value: 'light', label: '☀️ Claro' }, { value: 'dark', label: '🌙 Oscuro' }],
      })}
    </div>

    <div class="card stack gap-3">
      <h3 style="margin:0;">Respaldo de datos</h3>
      <p class="field__hint" style="margin:0;">
        Exportá todos tus datos (productos, ingredientes, recetas, ventas, etc.) a un
        archivo que podés guardar como copia de seguridad, o importar un archivo
        previamente exportado para restaurarlo.
      </p>
      <div class="row gap-3" style="flex-wrap:wrap;">
        <button class="btn btn--secondary" id="btn-export-backup">⬇️ Exportar datos</button>
        <button class="btn btn--secondary" id="btn-import-backup">⬆️ Importar datos</button>
        <input type="file" id="import-file-input" accept="application/json" hidden />
      </div>
    </div>

    ${legacyMigrationCardHtml()}
    ${usersCardPlaceholderHtml()}
  `;

  container.querySelector('#f-whatsapp')?.addEventListener('change', (e) => {
    store.setBusinessSetting('whatsappNumber', e.target.value.trim());
    showToast({ type: 'success', message: 'Número de WhatsApp guardado.' });
  });

  container.querySelectorAll('[data-pref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { pref, value } = btn.dataset;
      const parsedValue = value === 'true' ? true : value === 'false' ? false : value;
      store.setA11yPref(pref, parsedValue);
      render(_params, container); // re-pinta para reflejar el botón activo
    });
  });

  bindBackupActions(container);
  bindLegacyMigration(container, _params);
  loadUsersCard(container);
}

/**
 * Tarjeta de usuarios: placeholder sincrónico (para no atrasar el resto de
 * la pantalla, que es todo instantáneo) — el contenido real se carga aparte
 * en loadUsersCard(), porque consultar Supabase es async. Sin nube (todavía
 * usando localStorage) no hay usuarios reales, así que ni aparece.
 */
function usersCardPlaceholderHtml() {
  if (APP_CONFIG.storageAdapter !== 'supabase') return '';
  return `
    <div class="card stack gap-3" id="users-card" style="margin-top: var(--space-5);">
      <h3 style="margin:0;">👥 Usuarios con acceso</h3>
      <p class="field__hint" style="margin:0;">Cargando…</p>
    </div>`;
}

async function loadUsersCard(container) {
  const card = container.querySelector('#users-card');
  if (!card) return;
  try {
    const users = await userProfiles.list();
    card.innerHTML = `
      <h3 style="margin:0;">👥 Usuarios con acceso</h3>
      ${users.length === 0 ? '<p class="field__hint" style="margin:0;">No se encontró ningún usuario.</p>' : `
        <div class="stack gap-2">
          ${users.map((u) => `
            <div class="row" style="justify-content:space-between; padding: var(--space-2) 0; border-bottom: var(--border-width) solid var(--surface-border);">
              <span>${escapeHtml(u.email ?? 'Sin email')}</span>
              <span class="badge badge--info">${escapeHtml(userProfiles.roleLabel(u.role))}</span>
            </div>`).join('')}
        </div>`}
      <p class="field__hint" style="margin:0;">Por ahora todos los usuarios tienen acceso completo — los permisos por rol (qué puede ver o hacer cada uno) llegan en una próxima versión.</p>
    `;
  } catch {
    card.innerHTML = `
      <h3 style="margin:0;">👥 Usuarios con acceso</h3>
      <p class="field__hint" style="margin:0;">No se pudo cargar la lista de usuarios.</p>`;
  }
}

/**
 * Tarjeta de migración: solo aparece si (a) la app está usando Supabase
 * ahora y (b) hay datos de una instalación anterior en localStorage —
 * evita mostrar un botón sin sentido a alguien que nunca usó la app antes
 * de conectar la nube, o que ya migró y no le queda nada pendiente.
 */
function legacyMigrationCardHtml() {
  if (APP_CONFIG.storageAdapter !== 'supabase') return '';
  const count = countLegacyLocalRecords();
  if (count === 0) return '';

  return `
    <div class="card stack gap-3" style="margin-top: var(--space-5); border-color: var(--color-warning);">
      <h3 style="margin:0;">☁️ Migrar datos de este celular a la nube</h3>
      <p class="field__hint" style="margin:0;">
        Encontramos <strong>${count}</strong> registro(s) guardados en este dispositivo desde
        antes de conectar la nube (productos, ventas, etc. cargados para probar). Podés
        subirlos ahora a la base de datos en la nube.
      </p>
      <div>
        <button class="btn btn--secondary" id="btn-migrate-legacy">☁️ Migrar ${count} registro(s) a la nube</button>
      </div>
    </div>`;
}

function bindLegacyMigration(container, params) {
  container.querySelector('#btn-migrate-legacy')?.addEventListener('click', async () => {
    const count = countLegacyLocalRecords();
    const confirmed = await confirmAction({
      title: 'Migrar datos a la nube',
      message: `Se van a subir ${count} registro(s) de este celular a la base de datos en la nube. Si ya hay datos cargados EN LA NUBE (por ejemplo, si probaste crear algo directamente en /admin después de conectar Supabase), esos datos en la nube se van a reemplazar por los de este celular. Esta acción no se puede deshacer.`,
      confirmLabel: 'Migrar y reemplazar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      const legacyBackup = readLegacyLocalBackup();
      await restoreBackup(legacyBackup);
      showToast({ type: 'success', message: `${count} registro(s) migrados a la nube correctamente.` });
      render(params, container); // re-pinta: la tarjeta de migración ya no debería aparecer más
    } catch (err) {
      handleError(err, 'settings:migrate-legacy');
    }
  });
}

function bindBackupActions(container) {
  container.querySelector('#btn-export-backup')?.addEventListener('click', async () => {
    try {
      const filename = await downloadBackup();
      showToast({ type: 'success', message: `Backup descargado: ${filename}` });
    } catch (err) {
      handleError(err, 'settings:export-backup');
    }
  });

  const fileInput = container.querySelector('#import-file-input');
  container.querySelector('#btn-import-backup')?.addEventListener('click', () => fileInput.click());

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // permite volver a elegir el mismo archivo si hace falta reintentar
    if (!file) return;

    const confirmed = await confirmAction({
      title: 'Importar datos',
      message: 'Esto va a REEMPLAZAR todos los datos actuales de la aplicación con los del archivo elegido. Esta acción no se puede deshacer.',
      confirmLabel: 'Importar y reemplazar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      const backup = await readBackupFile(file);
      await restoreBackup(backup);
      showToast({ type: 'success', message: 'Datos restaurados correctamente.' });
    } catch (err) {
      handleError(err, 'settings:import-backup');
    }
  });
}
