import React, { useState, useEffect, useRef } from 'react';
import '../../DesignSystem/index.css';

/**
 * TabLayout — universal layout shell for all FMT tabs.
 *
 * Implements the four layout types from FMT_LAYOUT_SYSTEM.md:
 *
 *   X — Controls + Aside (canvas, preview, map, diff viewer)
 *   Y — Controls + Standby Field (form-only sections)
 *   Z — Full Width + Internal Grid (two equal groups)
 *   W — Full Width + Top Bar (dominant canvas or output)
 *
 * ─── Core Props ───────────────────────────────────────────────────────────
 *
 *   sections        [{ id, index, label, desc, count?, done?, locked? }]
 *   activeSection   string id of the currently active section
 *   onSelect(id)    section switch handler
 *   children        content for the active section's controls column
 *
 * ─── Layout ───────────────────────────────────────────────────────────────
 *
 *   layoutMode      'x' | 'y' | 'z' | 'w'   (default: 'x')
 *
 *   Layout X props:
 *     controlsWidth  'fixed' | 'half'         (default: 'fixed')
 *     asideSlot      content for the right column
 *     asideCaption   label in the aside header  (default: 'PREVIEW')
 *     asideMirror    controls in the aside header
 *
 *   Layout Y props:
 *     ghostLabel     large background word      (e.g. 'STARS')
 *     readout        string[]  live parameter readout lines
 *
 *   Layout Z props:
 *     groupMode      'parallel' | 'exclusive'   (default: 'parallel')
 *     secondRail     [{ id, label }]  optional secondary rail (Z·exclusive)
 *     activeGroup    string id of active group (Z·exclusive)
 *     onGroupSelect  (id) => void              (Z·exclusive)
 *     groupSlotB     content for Group B column
 *
 *   Layout W props:
 *     canvasToolbar  true | false               (default: false)
 *     topBar         content rendered in the top bar band
 *     toolbar        content rendered in the canvas toolbar band (W·canvas)
 *
 * ─── Shell Props ──────────────────────────────────────────────────────────
 *
 *   toolbarSlot     global content above the rail/column split
 *   renderEyebrow   (section) => string
 *   railStorageKey  localStorage key for pin state
 *   navLabel        aria-label for the rail nav
 *   bootMs          rail boot extend duration  (default: 2200)
 *
 * ─── Theming ──────────────────────────────────────────────────────────────
 *
 *   Set --tab-color (+ --tab-glow, --tab-glow-strong) on an ancestor;
 *   the whole shell recolors automatically.
 */

// ─── Sub-components ───────────────────────────────────────────────────────────

const ConsoleRail = ({
  sections, activeSection, onSelect, booting, pinned, onTogglePin, navLabel,
}) => (
  <nav
    className={`console-rail${(booting || pinned) ? ' console-rail--open' : ''}`}
    aria-label={navLabel}
  >
    <button
      className="rail-item"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.055)', height: 40, paddingLeft: 19 }}
      onClick={onTogglePin}
      aria-label={pinned ? 'Collapse navigation' : 'Pin navigation open'}
    >
      <span className="rail-item-tick" style={{ height: 8, animationDelay: '0ms' }} />
      <span className="rail-item-label" style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.16)' }}>
        {pinned ? 'COLLAPSE' : 'PIN'}
      </span>
    </button>

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

const SectionHeader = ({ section, renderEyebrow }) => {
  const eyebrow = renderEyebrow?.(section);
  return (
  <div className="section-header">
    {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
    <h2 className="section-title">{section.label}</h2>
    <div className="section-trace" aria-hidden="true">
      <div className="section-trace-line" />
      <div className="section-trace-hot" />
    </div>
    <p className="section-desc">{section.desc}</p>
  </div>
  );
};

const AsidePanel = ({ children, mirrorSlot, caption = 'PREVIEW', widthClass = '' }) => (
  <aside
    className={['preview-panel', widthClass].filter(Boolean).join(' ')}
    aria-label={caption}
  >
    {(caption || mirrorSlot) && (
      <div className="preview-panel-head">
        {caption && <span className="preview-panel-caption">{caption}</span>}
        {mirrorSlot}
      </div>
    )}
    <div className="preview-panel-body">{children}</div>
  </aside>
);

const StandbyField = ({ ghostLabel = '', readout = [], cursorVisible = true }) => (
  <div className="standby-field" aria-hidden="true">
    {ghostLabel && (
      <span className="standby-ghost">{ghostLabel}</span>
    )}
    {readout.length > 0 && (
      <div className="standby-readout">
        {readout.map((line, i) => (
          <span key={i} className="standby-readout-line">{line}</span>
        ))}
      </div>
    )}
    {cursorVisible && <span className="standby-cursor" />}
  </div>
);

// ─── Layout renderers ─────────────────────────────────────────────────────────

/**
 * X — Controls left, visual content right.
 * controlsWidth: 'fixed' (~360px) | 'half' (50%)
 */
const LayoutX = ({
  section, children, renderEyebrow,
  controlsWidth, asideSlot, asideCaption, asideMirror,
  columnRef,
}) => {
  const widthClass = controlsWidth === 'half'
    ? 'workspace-main-inner--half'
    : 'workspace-main-inner--fixed';

  return (
    <div className={`workspace-main-inner layout-x ${widthClass}`}>
      <div className="workspace-column" ref={columnRef}>
        <SectionHeader section={section} renderEyebrow={renderEyebrow} />
        <div className="section-content">{children}</div>
      </div>
      <AsidePanel
        caption={asideCaption}
        mirrorSlot={asideMirror}
        widthClass={controlsWidth === 'half' ? 'preview-panel--half' : 'preview-panel--balanced'}
      >
        {asideSlot}
      </AsidePanel>
    </div>
  );
};

/**
 * Y — Controls left, deliberate standby field right.
 * No canvas — form-only sections.
 */
const LayoutY = ({
  section, children, renderEyebrow,
  ghostLabel, readout,
  columnRef,
}) => (
  <div className="workspace-main-inner layout-y workspace-main-inner--fixed">
    <div className="workspace-column" ref={columnRef}>
      <SectionHeader section={section} renderEyebrow={renderEyebrow} />
      <div className="section-content">{children}</div>
    </div>
    <StandbyField ghostLabel={ghostLabel} readout={readout} />
  </div>
);

/**
 * Z — Full width, two equal columns.
 * groupMode: 'parallel' | 'exclusive'
 */
const LayoutZ = ({
  section, children, renderEyebrow,
  groupMode, groupSlotB,
  secondRail, activeGroup, onGroupSelect,
  columnRef,
}) => (
  <div className={`workspace-main-inner layout-z layout-z--${groupMode}`}>
    <div className="layout-z-header">
      <SectionHeader section={section} renderEyebrow={renderEyebrow} />
      {groupMode === 'exclusive' && secondRail?.length > 0 && (
        <nav className="layout-z-second-rail" aria-label="Group selection">
          {secondRail.map(g => (
            <button
              key={g.id}
              className={`layout-z-rail-item${activeGroup === g.id ? ' active' : ''}`}
              onClick={() => onGroupSelect?.(g.id)}
            >
              {g.label}
            </button>
          ))}
        </nav>
      )}
    </div>
    <div className="layout-z-grid">
      <div
        className={[
          'layout-z-group layout-z-group--a',
          groupMode === 'exclusive' && activeGroup && activeGroup !== 'a' ? 'layout-z-group--dim' : '',
        ].filter(Boolean).join(' ')}
        ref={columnRef}
      >
        {children}
      </div>
      <div
        className={[
          'layout-z-group layout-z-group--b',
          groupMode === 'exclusive' && activeGroup && activeGroup !== 'b' ? 'layout-z-group--dim' : '',
        ].filter(Boolean).join(' ')}
      >
        {groupSlotB}
      </div>
    </div>
  </div>
);

/**
 * W — Full width + top bar. Dominant canvas or output.
 * canvasToolbar: true = W·canvas (two bands), false = W·output (one band)
 */
const LayoutW = ({
  section, children, renderEyebrow,
  canvasToolbar, topBar, toolbar,
}) => (
  <div className="workspace-main-inner layout-w">
    <div className="layout-w-top-bar">
      {topBar ?? (
        <>
          <div className="section-eyebrow">{renderEyebrow(section)}</div>
          <h2 className="section-title layout-w-title">{section.label}</h2>
        </>
      )}
    </div>
    {canvasToolbar && toolbar && (
      <div className="layout-w-toolbar">{toolbar}</div>
    )}
    <div className="layout-w-content">{children}</div>
  </div>
);

// ─── Ghost tracker ────────────────────────────────────────────────────────────

function useGhostRect(bodyRef, mainRef, columnRef) {
  const [ghostRect, setGhostRect] = useState(null);

  useEffect(() => {
    const update = () => {
      const main   = mainRef.current;
      const column = columnRef.current;
      const body   = bodyRef.current;
      if (!main || !column || !body) return;
      const mainBox   = main.getBoundingClientRect();
      const columnBox = column.getBoundingClientRect();
      const bodyBox   = body.getBoundingClientRect();
      setGhostRect({
        left:  mainBox.left - bodyBox.left,
        width: columnBox.right - mainBox.left,
      });
    };

    update();
    const ro = new ResizeObserver(update);
    [mainRef, columnRef, bodyRef].forEach(r => r.current && ro.observe(r.current));
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [bodyRef, mainRef, columnRef]);

  return ghostRect;
}

// ─── TabLayout ────────────────────────────────────────────────────────────────

const TabLayout = ({
  // Core
  sections,
  activeSection,
  onSelect,
  children,

  // Layout
  layoutMode     = 'x',

  // Layout X
  controlsWidth  = 'half',
  asideSlot,
  asideCaption   = 'PREVIEW',
  asideMirror,

  // Layout Y
  ghostLabel     = '',
  readout        = [],

  // Layout Z
  groupMode      = 'parallel',
  secondRail,
  activeGroup,
  onGroupSelect,
  groupSlotB,

  // Layout W
  canvasToolbar  = false,
  topBar,
  toolbar,

  // Shell
  toolbarSlot,
  renderEyebrow  = null,
  railStorageKey = 'workspace-rail-pinned',
  navLabel       = 'Tab navigation',
  bootMs         = 2200,
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
      try { localStorage.setItem(railStorageKey, next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  const currentSection = sections.find(s => s.id === activeSection);

  const bodyRef   = useRef(null);
  const mainRef   = useRef(null);
  const columnRef = useRef(null);
  const ghostRect = useGhostRect(bodyRef, mainRef, columnRef);

  const renderLayout = () => {
    if (!currentSection) return null;

    const shared = {
      section:       currentSection,
      children,
      renderEyebrow,
      columnRef,
    };

    switch (layoutMode) {
      case 'y':
        return <LayoutY {...shared} ghostLabel={ghostLabel} readout={readout} />;

      case 'z':
        return (
          <LayoutZ
            {...shared}
            groupMode={groupMode}
            groupSlotB={groupSlotB}
            secondRail={secondRail}
            activeGroup={activeGroup}
            onGroupSelect={onGroupSelect}
          />
        );

      case 'w':
        return (
          <LayoutW
            {...shared}
            canvasToolbar={canvasToolbar}
            topBar={topBar}
            toolbar={toolbar}
          />
        );

      case 'x':
      default:
        return (
          <LayoutX
            {...shared}
            controlsWidth={controlsWidth}
            asideSlot={asideSlot}
            asideCaption={asideCaption}
            asideMirror={asideMirror}
          />
        );
    }
  };

  return (
    <div className="workspace">
      {toolbarSlot && (
        <div className="workspace-toolbar">{toolbarSlot}</div>
      )}
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


        <div className="workspace-main" ref={mainRef}>
          {renderLayout()}
        </div>

      </div>
      <div className="surface-grain" aria-hidden="true" />
    </div>
  );
};

export default TabLayout;
