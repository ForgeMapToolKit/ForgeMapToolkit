import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SlatRow from '../SlatRow/SlatRow.jsx';
import Register from '../Register/Register.jsx';
import './NavbarPanel.css';

/**
 * NavbarPanel — the drop-down panel for a single nav tab.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 * Rendered via createPortal in Navbar.jsx → sits in document.body, positioned
 * via `panelTop` (bar's bottom edge in viewport px) so it spans full width
 * independent of any parent stacking context.
 *
 * Two-column layout (60 / 40). Left zone: SlatRow list. Right zone: Register.
 * No vertical divider — separation through proportion + haze.
 *
 * Entry: horizontal traceline sweeps left→right in --tab-color (clip-path,
 * 320ms). `instant` prop skips this for tab-to-tab switches.
 *
 * Backdrop: full-screen div behind the panel, dims workspace, click → onClose.
 *
 * Props:
 *  cfg                    — NAV_CONFIG entry
 *  activeSection          — current active tool id
 *  onNavigate(id)         — sub-item clicked
 *  onClose                — backdrop clicked or proximity-close
 *  onHoveredColorChange   — called with CSS color string on sub-item hover
 *  panelTop               — number: bar bottom in viewport px (for positioning)
 *  instant                — true = no entry animation (tab-to-tab switch)
 */

const NavbarPanel = ({
  cfg,
  activeSection,
  onNavigate,
  onClose,
  onHoveredColorChange,
  panelTop = 72,
  instant = false,
  measureRef = null,
}) => {
  const [registerKey, setRegisterKey] = useState(0);
  const [hoveredItem, setHoveredItem] = useState(null);

  // The bg layer has no children of its own (see render below), so it
  // can't naturally grow to match the content layer's height — without
  // this it sits stuck at min-height while content grows up to
  // max-height, leaving a visible seam/box where the opaque surface
  // stops short. Measure the content layer and mirror its height exactly.
  const contentRef = useRef(null);
  const [bgHeight, setBgHeight] = useState(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setBgHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // hoveredItem is now sticky within a category (see handleItemLeave below),
  // but NavbarPanel isn't remounted on tab switch (no `key` in Navbar.jsx —
  // that's what gives tab-to-tab switches their instant feel). Without this,
  // a sticky hover from the previous category would leak into the next one.
  useEffect(() => {
    setHoveredItem(null);
  }, [cfg.id]);

  const handleItemHover = useCallback((item) => {
    setHoveredItem(item);
    setRegisterKey(k => k + 1);
    // Recolor the atmosphere haze.
    const color = item.colorVar ? `var(${item.colorVar})` : null;
    onHoveredColorChange?.(color);
  }, [onHoveredColorChange]);

  const handleItemLeave = useCallback(() => {
    // Sticky: keep showing the last-hovered item instead of resetting to
    // null. Resetting caused the register (and, via activeItem's fallback
    // below, the displayed tab) to snap back to the category's first item
    // every time the cursor passed between sub-items — exactly the bug
    // being fixed here. The haze was already left on the last color (see
    // below); now the register text matches that same "leave it as-is"
    // behaviour.
  }, []);

  // The big name is ALWAYS a sub-item label — never the category name.
  // With nothing hovered, default to the first item in the category so the
  // register still shows a concrete tool, not the category itself.
  const activeItem   = hoveredItem ?? cfg.items?.[0] ?? null;
  const displayIndex = activeItem?.index ?? '··';
  const displayName  = activeItem?.label ?? '';
  const displayDesc  = activeItem?.navDescription ?? cfg.defaultDesc ?? '';
  const accentColor  = activeItem?.colorVar
    ? `var(${activeItem.colorVar})`
    : 'var(--tab-color)';

  return (
    <>
      {/* Backdrop — starts at the bar's bottom edge so the bar stays hoverable
          (see .nbp-backdrop in CSS), enabling fluid tab-to-tab switching. */}
      <div
        className="nbp-backdrop"
        style={{ top: panelTop }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel background — sits BELOW the atmosphere haze layer. Split out
          from the content below because both are portaled siblings under
          document.body: a single element can't have part of its own
          subtree paint below an external sibling (the haze) and another
          part paint above it, since z-index only resolves between whole
          stacking contexts, not within one. */}
      <div
        className={['nbp-panel-bg', instant ? 'nbp-panel-bg--instant' : ''].filter(Boolean).join(' ')}
        style={{ top: panelTop, height: bgHeight ?? undefined, '--nbp-top': `${panelTop}px` }}
        aria-hidden="true"
      />

      {/* Panel content — sits ABOVE the atmosphere haze layer, so text stays
          legible over it. Transparent itself; the opaque surface lives in
          nbp-panel-bg right behind it. */}
      <div
        ref={el => { contentRef.current = el; if (measureRef) measureRef.current = el; }}
        className={['nbp-panel', instant ? 'nbp-panel--instant' : ''].filter(Boolean).join(' ')}
        style={{ top: panelTop, '--nbp-top': `${panelTop}px` }}
        role="dialog"
        aria-label={`${cfg.label} navigation panel`}
      >
        {/* Traceline sweep — entry animation */}
        {!instant && (
          <div className="nbp-traceline-sweep" aria-hidden="true" />
        )}

        <div className="nbp-inner">

          {/* Left zone — SlatRow list (60%) */}
          <div className="nbp-left">
            <ul className="nbp-slat-list" role="list">
              {cfg.items.map((item) => (
                <SlatRow
                  key={item.id}
                  item={item}
                  isActive={item.id === activeSection}
                  onHover={handleItemHover}
                  onLeave={handleItemLeave}
                  onSelect={onNavigate}
                />
              ))}
            </ul>
          </div>

          {/* Right zone — Register (40%) */}
          <div className="nbp-right">
            <Register
              key={registerKey}
              index={displayIndex}
              categoryLabel={cfg.label}
              tabName={displayName}
              description={displayDesc}
              accentColor={accentColor}
              animate={!instant}
            />
          </div>

        </div>
      </div>
    </>
  );
};

export default NavbarPanel;
