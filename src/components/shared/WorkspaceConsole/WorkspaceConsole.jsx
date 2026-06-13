import React, { useState, useEffect, useRef } from 'react';
import '../design-system/index.css';

/**
 * WorkspaceConsole — the Fable5 gold-standard layout shell.
 *
 * A feature-agnostic tactical workstation: a collapsing console rail,
 * a centered working column that shows one section at a time, and a
 * fixed preview panel. It owns ONLY the outer architecture and knows
 * nothing about any feature's business logic.
 *
 * Props
 *   sections:      [{ id, index, label, desc, count?, done?, locked? }]
 *   activeSection: string id
 *   onSelect(id):  section switch handler
 *   children:      content for the active section's column
 *   previewSlot:   content for the fixed preview panel body
 *   mirrorSlot:    optional controls rendered in the preview header
 *   ghostLabel:    big background word behind the column (e.g. "WRECKAGES")
 *   renderEyebrow: (section) => string  — register line above the title
 *   railStorageKey: localStorage key for the rail pin state
 *   navLabel:      aria-label for the rail nav
 *   bootMs:        rail boot extend duration (default 2200)
 *
 * Theming: set --tab-color (+ --tab-glow, --tab-glow-strong) on an
 * ancestor; the whole shell recolors with zero other edits.
 */

const ConsoleRail = ({
  sections, activeSection, onSelect, booting, pinned, onTogglePin, navLabel,
}) => (
  <nav
    className={`console-rail${(booting || pinned) ? ' console-rail--open' : ''}`}
    aria-label={navLabel}
  >
    {/* Pin toggle */}
    <button
      className="rail-item"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.055)', height: 40, paddingLeft: 19 }}
      onClick={onTogglePin}
      aria-label={pinned ? 'Collapse navigation' : 'Pin navigation open'}
    >
      <span className="rail-item-tick" style={{ height: 8, animationDelay: '0ms' }} />
      <span className="rail-item-label" style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.16)' }}>
        {pinned ? '◀ COLLAPSE' : '▶ PIN'}
      </span>
    </button>

    {/* Step items */}
    <div className="console-rail-track">
      {sections.map((s, i) => (
        <button
          key={s.id}
          className={[
            'rail-item',
            s.done   ? 'rail-item--done'   : '',
            s.locked ? 'rail-item--locked' : '',
            activeSection === s.id ? 'active' : '',
          ].filter(Boolean).join(' ')}
          style={{ '--slat-i': i }}
          onClick={() => !s.locked && onSelect(s.id)}
          aria-current={activeSection === s.id ? 'step' : undefined}
        >
          <span className="rail-item-tick" aria-hidden="true" />
          <span className="rail-item-index">{s.index}</span>
          <span className="rail-item-label">{s.label.toUpperCase()}</span>
          {s.count != null && <span className="rail-item-count">· {s.count}</span>}
        </button>
      ))}
    </div>
  </nav>
);

const SectionView = ({ section, renderEyebrow }) => (
  /* Keyed on section.id by the parent — so the carriage print restarts
     whenever the active section changes. */
  <div className="section" key={section.id}>
    <div className="section-eyebrow">{renderEyebrow(section)}</div>
    <h2 className="section-title">{section.label}</h2>
    <div className="section-trace" aria-hidden="true">
      <div className="section-trace-line" />
      <div className="section-trace-hot" />
    </div>
    <p className="section-desc">{section.desc}</p>
    <div className="section-content">{section.children}</div>
  </div>
);

const PreviewPanel = ({ children, mirrorSlot }) => (
  <aside className="preview-panel" aria-label="Preview">
    <div className="preview-panel-head">
      <span className="preview-panel-caption">PREVIEW</span>
      {mirrorSlot}
    </div>
    <div className="preview-panel-body">{children}</div>
  </aside>
);

const WorkspaceConsole = ({
  sections,
  activeSection,
  onSelect,
  children,
  previewSlot,
  mirrorSlot,
  ghostLabel = '',
  renderEyebrow = (s) => `${s.index} — ${s.label.toUpperCase()}`,
  railStorageKey = 'workspace-rail-pinned',
  navLabel = 'Workspace navigation',
  bootMs = 2200,
}) => {
  const [booting, setBooting] = useState(true);
  const [pinned,  setPinned]  = useState(() => {
    try { return localStorage.getItem(railStorageKey) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), bootMs);
    return () => clearTimeout(t);
  }, [bootMs]);

  const handleTogglePin = () => {
    setPinned(p => {
      const next = !p;
      try { localStorage.setItem(railStorageKey, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const currentSection = sections.find(s => s.id === activeSection);

  /* Ghost tracking — the "<index>  <label>" composition spans the full
     left column, measured live so it glides as the rail expands. */
  const bodyRef   = useRef(null);
  const mainRef   = useRef(null);
  const columnRef = useRef(null);
  const [ghostRect, setGhostRect] = useState(null);

  useEffect(() => {
    const update = () => {
      const mainEl = mainRef.current, columnEl = columnRef.current, bodyEl = bodyRef.current;
      if (!mainEl || !columnEl || !bodyEl) return;
      const mainBox = mainEl.getBoundingClientRect();
      const columnBox = columnEl.getBoundingClientRect();
      const bodyBox = bodyEl.getBoundingClientRect();
      setGhostRect({ left: mainBox.left - bodyBox.left, width: columnBox.right - mainBox.left });
    };
    update();
    const ro = new ResizeObserver(update);
    if (mainRef.current)   ro.observe(mainRef.current);
    if (columnRef.current) ro.observe(columnRef.current);
    if (bodyRef.current)   ro.observe(bodyRef.current);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  return (
    <div className="workspace">
      <div className="workspace-body" ref={bodyRef}>

        <ConsoleRail
          sections={sections}
          activeSection={activeSection}
          onSelect={onSelect}
          booting={booting}
          pinned={pinned}
          onTogglePin={handleTogglePin}
          navLabel={navLabel}
        />

        {currentSection && (
          <div
            className="workspace-ghost workspace-ghost--body"
            aria-hidden="true"
            style={ghostRect ? { left: `${ghostRect.left}px`, width: `${ghostRect.width}px` } : undefined}
          >
            <span className="workspace-ghost-index">{currentSection.index}</span>
            {ghostLabel && <span className="workspace-ghost-label">{ghostLabel}</span>}
          </div>
        )}

        <div className="workspace-main" ref={mainRef}>
          <div className="workspace-main-inner">
            <div className="workspace-column" ref={columnRef}>
              {currentSection && (
                <SectionView
                  key={currentSection.id}
                  section={{ ...currentSection, children }}
                  renderEyebrow={renderEyebrow}
                />
              )}
            </div>
            <PreviewPanel mirrorSlot={mirrorSlot}>{previewSlot}</PreviewPanel>
          </div>
        </div>

      </div>
      <div className="surface-grain" aria-hidden="true" />
    </div>
  );
};

export default WorkspaceConsole;
