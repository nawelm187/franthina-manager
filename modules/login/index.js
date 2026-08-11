/**
 * modules/login/index.js
 * Responsabilidad: pantalla de acceso a la administración.
 * No es una ruta del Router — la invoca app.js directamente cuando el
 * guard de acceso (ver core/router.js, setGuard) bloquea una ruta de
 * /admin porque no hay sesión iniciada.
 */
import { auth } from '../../core/auth.js';
import { escapeHtml } from '../../core/utils.js';
import { APP_CONFIG } from '../../core/config.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-card">
      <img src="assets/icons/logo-sidebar.png" alt="" class="login-card__logo" width="64" height="64" />
      <h1>${escapeHtml(APP_CONFIG.appName)}</h1>
      <p class="field__hint">Acceso restringido — iniciá sesión para administrar.</p>
      <form id="login-form" novalidate>
        <div class="field">
          <label class="field__label" for="login-email">Email</label>
          <input class="input" type="email" id="login-email" name="email" autocomplete="username" required />
        </div>
        <div class="field">
          <label class="field__label" for="login-password">Contraseña</label>
          <div class="row gap-2" style="flex-wrap:nowrap;">
            <input class="input" type="password" id="login-password" name="password" autocomplete="current-password" required style="flex:1;" />
            <button type="button" class="btn btn--ghost btn--icon-only" id="btn-toggle-password" aria-label="Mostrar contraseña" aria-pressed="false">👁️</button>
          </div>
        </div>
        <div class="field__error" id="login-error" hidden></div>
        <button type="submit" class="btn btn--primary btn--block" id="btn-login-submit">Iniciar sesión</button>
      </form>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const errorEl = container.querySelector('#login-error');
  const toggleBtn = container.querySelector('#btn-toggle-password');
  const passwordInput = container.querySelector('#login-password');
  const submitBtn = container.querySelector('#btn-login-submit');

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(isPassword));
    toggleBtn.textContent = isPassword ? '🙈' : '👁️';
    toggleBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    try {
      await auth.signIn(form.email.value.trim(), form.password.value);
      // No hace falta hacer nada más acá: core/auth.js avisa el cambio de
      // sesión, y app.js vuelve a resolver la ruta pedida originalmente.
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = `⚠ ${friendlyAuthError(err)}`;
      submitBtn.disabled = false;
    }
  });
}

/** Traduce los mensajes de error de Supabase Auth (en inglés, técnicos) a
 *  algo que se entienda sin saber inglés ni de programación. */
function friendlyAuthError(err) {
  const msg = String(err?.message ?? '');
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Todavía no se confirmó el email de esta cuenta.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos — esperá un minuto y probá de nuevo.';
  return 'No se pudo iniciar sesión. Probá de nuevo en un momento.';
}
