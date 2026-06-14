import React, { useEffect } from 'react';
import '../design-system/index.css';
import './HelpConsole.css';

/**
 * HELP CONSOLE — the reusable Fable5 help surface.
 *
 * A banner-less home screen: the monolith rail is moved to the TOP and
 * holds the help SECTIONS (flat, one level). The middle prints a smaller
 * hero with the active section's name + a traceline that sweeps in and
 * fades; the section body scrolls below. Theming is the inherited
 * --tab-color (set on the host tab root), so it recolors per tab with
 * zero edits.
 *
 * Mirrors the WorkspaceConsole contract on purpose — same mental model:
 *   sections:       [{ id, index, label }]
 *   activeSection:  string id
 *   onSelect(id):   section switch
 *   children:       the active section's content (host renders it)
 *   onClose():      Esc closes; the <HelpButton> edge-tab toggles it
 *
 * Converting a tab's help = drop its content blocks behind
 * `activeSection === id` and list the sections — nothing else.
 */
const HelpConsole = ({
  open,
  sections,
  activeSection,
  onSelect,
  onClose,
  eyebrowPrefix = 'Help Register',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const active = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="hc-overlay">
      <nav className="hc-rail" aria-label="Help sections">
        {sections.map((s, i) => (
          <button
            key={s.id}
            className={`hc-slat${active?.id === s.id ? ' active' : ''}`}
            style={{ '--i': i }}
            onClick={() => onSelect(s.id)}
            aria-current={active?.id === s.id ? 'true' : undefined}
          >
            <div className="hc-col">
              <span className="hc-idx">{s.index}</span>
              <span className="hc-lbl">{s.label}</span>
            </div>
          </button>
        ))}
      </nav>

      <div className="hc-stage">
        <div className="hc-eyebrow" key={`eb-${active?.id}`}>
          {eyebrowPrefix} — {active?.index} — {String(active?.label || '').toUpperCase()}
        </div>
        <h2 className="hc-hero" key={`hero-${active?.id}`}>{active?.label}</h2>
        <div className="hc-trace" key={`tr-${active?.id}`} aria-hidden="true">
          <div className="hc-trace-bloom" />
          <div className="hc-trace-core" />
          <div className="hc-trace-hot" />
        </div>
        <div className="hc-content" key={`ct-${active?.id}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * HELP BUTTON — the right-edge pull-tab that is the entry AND exit.
 * Label flips Help ⇄ Close with `open`. Inherits --tab-color from the
 * host tab root. Sits above the overlay so it stays clickable as Close.
 */
export const HelpButton = ({ open, onToggle, onClick }) => (
  <button
    className="help-tab"
    data-open={open ? '' : undefined}
    onClick={onToggle ?? onClick}
    aria-label={open ? 'Close help' : 'Open help'}
    title={open ? 'Close help' : 'Help'}
  >
    <span className="help-tab-label">{open ? 'Close' : 'Help'}</span>
  </button>
);

export default HelpConsole;
