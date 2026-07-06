import './notifications.css';

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS — Shared/Ui/Notifications/notifications.js
   Alert + confirm modals for ForgeMapToolkit.

   Styling lives entirely in notifications.css (imported by index.css or
   the app shell). This file only builds DOM and resolves the accent color
   from the active tab's CSS custom property on the .forgemaptoolkit root.

   Public API (unchanged — all call sites remain compatible):
     luxuryAlert(messageOrObj, title?, type?)  → Promise<void>
     luxuryConfirm(messageOrObj, title?, confirmText?, cancelText?)  → Promise<boolean>
     replaceBrowserAlerts()
     initErrorBridge(opts?)
   ═══════════════════════════════════════════════════════════════════ */

/* ── Theme resolution ────────────────────────────────────────────────
   Reads the active tab's three accent tokens from the computed style of
   the .forgemaptoolkit root element. Falls back to --accent-primary
   (orange) when no tab is active or the element is not found.          */

function resolveAccent() {
  const root = document.querySelector('.forgemaptoolkit');
  if (!root) return null;

  const theme = root.getAttribute('data-active-theme');
  if (!theme || theme === 'home') return null;

  const cs = getComputedStyle(root);
  const color      = cs.getPropertyValue(`--${theme}-color`).trim();
  const glow       = cs.getPropertyValue(`--${theme}-glow`).trim();
  const glowStrong = cs.getPropertyValue(`--${theme}-glow-strong`).trim();

  if (!color) return null;
  return { color, glow, glowStrong };
}

/* ── DOM helpers ─────────────────────────────────────────────────── */

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function buildModal(type, titleText, messageText, footerHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'fmt-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'fmt-modal';
  modal.setAttribute('data-type', type);

  // Apply tab accent unless type override takes over (error/warning/success
  // are handled entirely in CSS via [data-type]).
  if (type === 'info') {
    const accent = resolveAccent();
    if (accent) {
      modal.style.setProperty('--modal-accent',      accent.color);
      modal.style.setProperty('--modal-glow',        accent.glow);
      modal.style.setProperty('--modal-glow-strong', accent.glowStrong);
    }
  }

  modal.innerHTML = `
    <div class="fmt-modal-accent-line" aria-hidden="true"></div>
    <div class="fmt-modal-header">
      <h2 class="fmt-modal-title">${escapeHtml(titleText)}</h2>
      <div class="fmt-modal-title-line" aria-hidden="true"></div>
    </div>
    <div class="fmt-modal-body">
      <p class="fmt-modal-message">${escapeHtml(messageText).replace(/\n/g, '<br>')}</p>
    </div>
    <div class="fmt-modal-footer">
      ${footerHtml}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return { overlay, modal };
}

function animateClose(overlay, modal, cb) {
  overlay.style.animation = 'fmt-modal-overlay-in var(--dur-fast) var(--ease-out) reverse both';
  modal.style.animation   = 'fmt-modal-in var(--dur-fast) var(--ease-out) reverse both';
  setTimeout(() => {
    overlay.remove();
    cb();
  }, 180);
}

/* ── Public API ──────────────────────────────────────────────────── */

/**
 * @param {string|{message,title?,type?}} messageOrObj
 * @param {string} [title='Notification']
 * @param {'info'|'success'|'error'|'warning'} [type='info']
 * @returns {Promise<void>}
 */
export function luxuryAlert(messageOrObj, title = 'Notification', type = 'info') {
  let message;
  if (messageOrObj && typeof messageOrObj === 'object') {
    message = messageOrObj.message ?? '';
    title   = messageOrObj.title   ?? title;
    type    = messageOrObj.type    ?? type;
  } else {
    message = messageOrObj ?? '';
  }

  return new Promise((resolve) => {
    const { overlay, modal } = buildModal(
      type, title, message,
      `<button class="fmt-modal-btn fmt-modal-btn-primary" data-action="ok">Continue</button>`
    );

    const okBtn = modal.querySelector('[data-action="ok"]');
    setTimeout(() => okBtn.focus(), 80);

    const close = () => animateClose(overlay, modal, resolve);

    okBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        document.removeEventListener('keydown', handler);
        close();
      }
    });
  });
}

/**
 * @param {string|{message,title?,type?,confirmLabel?,cancelLabel?}} messageOrObj
 * @param {string} [title='Confirm']
 * @param {string} [confirmText='Continue']
 * @param {string} [cancelText='Cancel']
 * @returns {Promise<boolean>}
 */
export function luxuryConfirm(
  messageOrObj,
  title       = 'Confirm',
  confirmText = 'Continue',
  cancelText  = 'Cancel'
) {
  let message, type = 'info';
  if (messageOrObj && typeof messageOrObj === 'object') {
    message     = messageOrObj.message      ?? '';
    title       = messageOrObj.title        ?? title;
    type        = messageOrObj.type         ?? type;
    confirmText = messageOrObj.confirmLabel ?? confirmText;
    cancelText  = messageOrObj.cancelLabel  ?? cancelText;
  } else {
    message = messageOrObj ?? '';
  }

  return new Promise((resolve) => {
    const { overlay, modal } = buildModal(
      type, title, message,
      `
        <button class="fmt-modal-btn fmt-modal-btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
        <button class="fmt-modal-btn fmt-modal-btn-primary"   data-action="confirm">${escapeHtml(confirmText)}</button>
      `
    );

    const confirmBtn = modal.querySelector('[data-action="confirm"]');
    setTimeout(() => confirmBtn.focus(), 80);

    const close = (result) => animateClose(overlay, modal, () => resolve(result));

    confirmBtn.addEventListener('click', () => close(true));
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', handler); close(false); }
      else if (e.key === 'Enter') { document.removeEventListener('keydown', handler); close(true); }
    });
  });
}

/**
 * Replace native browser dialogs with fmt modals.
 */
export function replaceBrowserAlerts() {
  window.alert   = (msg) => luxuryAlert(String(msg ?? ''), 'Notification', 'info');
  window.confirm = (msg) => luxuryConfirm(String(msg ?? ''));
}

/**
 * Initialise the global error bridge. Call once near app boot.
 * Catches window errors, unhandled rejections, and Electron IPC errors.
 */
export function initErrorBridge() {
  replaceBrowserAlerts();

  window.addEventListener('error', (e) => {
    if (e.target && e.target !== window) return;
    luxuryAlert(e.error?.message || e.message || 'Unknown error', 'Unexpected Error', 'error');
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error
      ? reason.message
      : (typeof reason === 'string' ? reason : JSON.stringify(reason));
    luxuryAlert(msg || 'Unhandled rejection', 'Unexpected Error', 'error');
  });

  if (window.electronAPI) {
    window.electronAPI.on('app-error', ({ title, message, type = 'error' } = {}) => {
      luxuryAlert(message || 'An error occurred', title || 'Error', type);
    });
  }
}
