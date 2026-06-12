/* =====================================================
   NOTIFICATIONS — LUXURY MODAL SYSTEM
   Themed alerts & confirms for ForgeMapToolkit
   Matches ForgeMapToolkit.css design language
   ===================================================== */

/* ── Injected styles (once) ─────────────────────────── */
function injectModalStyles() {
  if (document.getElementById('luxury-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'luxury-modal-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Poppins:wght@300;400;600&display=swap');

    /* ── Overlay ── */
    .luxury-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(6px);
      animation: luxOverlayIn 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }

    @keyframes luxOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Modal shell ── */
    .luxury-modal {
      position: relative;
      width: 520px;
      max-width: calc(100vw - 40px);
      font-family: 'Poppins', sans-serif;
      color: #ffffff;
      overflow: hidden;

      /* Glassmorphic card — mirrors homepage-tool-card */
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.05) 0%,
        rgba(255, 255, 255, 0.01) 50%,
        rgba(0, 0, 0, 0.25) 100%
      );
      border: 1px solid rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(20px) saturate(180%);
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.7),
        0 0 60px var(--modal-accent-glow, rgba(255,140,0,0.25)),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);

      animation: luxModalIn 0.35s cubic-bezier(0.23, 1, 0.32, 1) forwards;
      transition:
        box-shadow 0.4s cubic-bezier(0.23, 1, 0.32, 1),
        border-color 0.4s ease,
        background 0.4s ease;
    }

    @keyframes luxModalIn {
      from {
        opacity: 0;
        transform: translateY(24px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .luxury-modal:hover {
      border-color: rgba(255, 255, 255, 0.13);
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.09) 0%,
        rgba(255, 255, 255, 0.02) 50%,
        rgba(0, 0, 0, 0.3) 100%
      );
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.7),
        0 0 70px var(--modal-accent-glow, rgba(255,140,0,0.35)),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    /* ── Top accent line — mirrors header-gradient-line ── */
    .luxury-modal-accent-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--modal-accent-color, #ff8c00) 50%,
        transparent 100%
      );
      box-shadow: 0 0 24px var(--modal-accent-glow-strong, rgba(255,140,0,0.6));
      transition: box-shadow 0.4s ease;
    }

    /* ── Error / Warning / Success type overrides ── */
    .luxury-modal[data-type="error"]   { --modal-accent-color: #ff4d4d; --modal-accent-glow: rgba(255,77,77,0.3); --modal-accent-glow-strong: rgba(255,77,77,0.6); }
    .luxury-modal[data-type="warning"] { --modal-accent-color: #ffb300; --modal-accent-glow: rgba(255,179,0,0.3); --modal-accent-glow-strong: rgba(255,179,0,0.6); }
    .luxury-modal[data-type="success"] { --modal-accent-color: #34d399; --modal-accent-glow: rgba(52,211,153,0.3); --modal-accent-glow-strong: rgba(52,211,153,0.6); }

    /* ── Header ── */
    .luxury-modal-header {
      padding: 32px 32px 0;
    }

    .luxury-modal-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--modal-accent-color, #ff8c00);
      text-shadow: 0 0 20px var(--modal-accent-glow, rgba(255,140,0,0.4));
      margin: 0;
      transition: text-shadow 0.4s ease;
    }

    /* Underline beneath title — mirrors header-underline */
    .luxury-modal-title-underline {
      width: 100%;
      height: 1px;
      margin-top: 0;
      background: linear-gradient(
        90deg,
        var(--modal-accent-color, #ff8c00) 0%,
        transparent 100%
      );
      opacity: 0.45;
    }

    /* ── Body ── */
    .luxury-modal-body {
      padding: 22px 32px 28px;
    }

    .luxury-modal-message {
      font-size: 0.97rem;
      font-weight: 300;
      line-height: 1.75;
      letter-spacing: 0.02em;
      color: #c8c8c8;
      margin: 0;
    }

    /* ── Footer ── */
    .luxury-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 0 32px 32px;
    }

    /* ── Buttons ── */
    .luxury-modal-btn {
      position: relative;
      font-family: 'Poppins', sans-serif;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 12px 28px;
      border: 1px solid transparent;
      cursor: pointer;
      overflow: hidden;
      transition: all 0.35s cubic-bezier(0.23, 1, 0.32, 1);
      outline: none;
    }

    /* Primary — filled accent */
    .luxury-modal-btn-primary {
      background: var(--modal-accent-color, #ff8c00);
      border-color: var(--modal-accent-color, #ff8c00);
      color: #0a0a0a;
      box-shadow: 0 0 18px var(--modal-accent-glow, rgba(255,140,0,0.3));
    }

    .luxury-modal-btn-primary:hover {
      filter: brightness(1.15);
      box-shadow:
        0 0 30px var(--modal-accent-glow-strong, rgba(255,140,0,0.6)),
        0 4px 14px rgba(0, 0, 0, 0.4);
      transform: translateY(-1px);
    }

    .luxury-modal-btn-primary:focus-visible {
      outline: 2px solid var(--modal-accent-color, #ff8c00);
      outline-offset: 3px;
    }

    /* Secondary — ghost */
    .luxury-modal-btn-secondary {
      background: transparent;
      border-color: rgba(255, 255, 255, 0.12);
      color: #666666;
    }

    .luxury-modal-btn-secondary:hover {
      border-color: rgba(255, 255, 255, 0.3);
      color: #b0b0b0;
      background: rgba(255, 255, 255, 0.04);
      transform: translateY(-1px);
    }

    .luxury-modal-btn-secondary:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.3);
      outline-offset: 3px;
    }
  `;

  document.head.appendChild(style);
}

/* ── Theme color map (mirrors ForgeMapToolkit.css) ───── */
const THEME_COLORS = {
  emitter:           { color: '#00DDFF',  glow: 'rgba(0,221,255,0.3)',     glowStrong: 'rgba(0,221,255,0.6)'    },
  wreckages:         { color: '#FE1818',  glow: 'rgba(254,24,24,0.3)',     glowStrong: 'rgba(254,24,24,0.6)'    },
  props:             { color: '#538A33',  glow: 'rgba(83,138,51,0.3)',     glowStrong: 'rgba(83,138,51,0.6)'    },
  customprops:       { color: '#3EA387',  glow: 'rgba(62,163,135,0.3)',    glowStrong: 'rgba(62,163,135,0.6)'   },
  treemap:           { color: '#18C748',  glow: 'rgba(24,199,72,0.3)',     glowStrong: 'rgba(24,199,72,0.6)'    },
  rockerosion:       { color: '#FFAF00',  glow: 'rgba(255,175,0,0.3)',     glowStrong: 'rgba(255,175,0,0.6)'    },
  stars:             { color: '#8A12BD',  glow: 'rgba(138,18,189,0.3)',    glowStrong: 'rgba(138,18,189,0.6)'   },
  'skybox-generator':{ color: '#3B76FF',  glow: 'rgba(59,118,255,0.3)',    glowStrong: 'rgba(59,118,255,0.6)'   },
  scmaptool:         { color: '#FFFA00',  glow: 'rgba(255,250,0,0.3)',     glowStrong: 'rgba(255,250,0,0.6)'    },
  adaptivemaphelper: { color: '#ff8c00',  glow: 'rgba(255,140,0,0.3)',     glowStrong: 'rgba(255,140,0,0.6)'    },
  history:           { color: '#FF8AFF',  glow: 'rgba(255,138,255,0.3)',   glowStrong: 'rgba(255,138,255,0.6)'  },
  mapresizer:        { color: '#00DDFF',  glow: 'rgba(0,221,255,0.3)',     glowStrong: 'rgba(0,221,255,0.6)'    },
  previewimage:      { color: '#FF007A',  glow: 'rgba(255,0,122,0.3)',     glowStrong: 'rgba(255,0,122,0.6)'    },
  contributions:     { color: '#A5E801',  glow: 'rgba(165,232,1,0.3)',     glowStrong: 'rgba(165,232,1,0.6)'    },
  settings:          { color: '#FFFFFF',  glow: 'rgba(255,255,255,0.15)',  glowStrong: 'rgba(255,255,255,0.3)'  },
  default:           { color: '#ff8c00',  glow: 'rgba(255,140,0,0.3)',     glowStrong: 'rgba(255,140,0,0.6)'    },
};

/* ── Helpers ─────────────────────────────────────────── */
function detectActiveTheme() {
  const el = document.querySelector('.map-tool-suite');
  return el?.getAttribute('data-active-theme') || 'default';
}

function applyThemeVars(modal, theme, typeOverride) {
  // type-specific colors take precedence (error/warning/success handled via CSS attr)
  if (typeOverride && typeOverride !== 'info') return;

  const t = THEME_COLORS[theme] || THEME_COLORS.default;
  modal.style.setProperty('--modal-accent-color',       t.color);
  modal.style.setProperty('--modal-accent-glow',        t.glow);
  modal.style.setProperty('--modal-accent-glow-strong', t.glowStrong);
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function buildModal(type, theme, titleText, messageText, footerHtml) {
  injectModalStyles();

  const overlay = document.createElement('div');
  overlay.className = 'luxury-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'luxury-modal';
  modal.setAttribute('data-type', type);
  modal.setAttribute('data-theme', theme);
  applyThemeVars(modal, theme, type);

  modal.innerHTML = `
    <div class="luxury-modal-accent-line"></div>
    <div class="luxury-modal-header">
      <h2 class="luxury-modal-title">${escapeHtml(titleText)}</h2>
      <div class="luxury-modal-title-underline"></div>
    </div>
    <div class="luxury-modal-body">
      <p class="luxury-modal-message">${escapeHtml(messageText).replace(/\n/g, '<br>')}</p>
    </div>
    <div class="luxury-modal-footer">
      ${footerHtml}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return { overlay, modal };
}

function animateClose(overlay, modal, cb) {
  overlay.style.animation = 'luxOverlayIn 0.2s cubic-bezier(0.23,1,0.32,1) reverse forwards';
  modal.style.animation   = 'luxModalIn 0.2s cubic-bezier(0.23,1,0.32,1) reverse forwards';
  setTimeout(() => {
    document.body.removeChild(overlay);
    cb();
  }, 200);
}

/* ── Public API ──────────────────────────────────────── */

/**
 * Luxury alert modal
 * @param {string} message
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
    const theme = detectActiveTheme();
    const { overlay, modal } = buildModal(
      type, theme, title, message,
      `<button class="luxury-modal-btn luxury-modal-btn-primary" data-action="ok">Continue</button>`
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
 * Luxury confirm modal
 * @param {string|object} messageOrObj  — message string, or { message, title, type, confirmLabel, cancelLabel }
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
    const theme = detectActiveTheme();
    const { overlay, modal } = buildModal(
      type, theme, title, message,
      `
        <button class="luxury-modal-btn luxury-modal-btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
        <button class="luxury-modal-btn luxury-modal-btn-primary"   data-action="confirm">${escapeHtml(confirmText)}</button>
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
 * Replace native browser dialogs with luxury versions
 */
export function replaceBrowserAlerts() {
  window.alert   = (msg) => luxuryAlert(String(msg ?? ''), 'Notification', 'info');
  window.confirm = (msg) => luxuryConfirm(String(msg ?? ''));
}

/**
 * Initialise the global error bridge.
 *
 * Call this ONCE near app boot (e.g. in your root React component's
 * useEffect or in a top-level index.js).
 *
 * Catches:
 *  - window.onerror          — synchronous JS errors
 *  - unhandledrejection      — unhandled Promise rejections
 *  - electronAPI 'app-error' — errors forwarded from main process
 *
 * @param {object} [opts]
 */
export function initErrorBridge(opts = {}) {
  // Replace native dialogs first
  replaceBrowserAlerts();

  // ── Synchronous errors ─────────────────────────────────────────────
  window.addEventListener('error', (e) => {
    // Ignore network/resource errors (img, script src 404s etc.)
    if (e.target && e.target !== window) return;
    const msg = e.error?.message || e.message || 'Unknown error';
    luxuryAlert(msg, 'Unexpected Error', 'error');
  });

  // ── Unhandled Promise rejections ───────────────────────────────────
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error
      ? reason.message
      : (typeof reason === 'string' ? reason : JSON.stringify(reason));
    luxuryAlert(msg || 'Unhandled rejection', 'Unexpected Error', 'error');
  });

  // ── Errors forwarded from main process via IPC ─────────────────────
  if (window.electronAPI) {
    window.electronAPI.on('app-error', ({ title, message, type = 'error' } = {}) => {
      luxuryAlert(message || 'An error occurred', title || 'Error', type);
    });
  }
}