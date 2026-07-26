import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIES, getToolsByCategory, getTool } from '../Home/Data/toolRegistry.js';
import NavbarPanel from './NavbarPanel/NavbarPanel.jsx';
import NavbarAtmosphereLayer from './Atmosphere/NavbarAtmosphereLayer.jsx';
import './Navbar.css';

/**
 * Navbar — the navigation register of the suite.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 * A flat instrument strip (--surface-deep, dot grid) ruled by hairlines top
 * and bottom. Top items are quiet captions (--ink-28); the active group
 * carries a phosphor underline in the ACTIVE TOOL'S --tab-color.
 *
 * NavbarPanel renders via createPortal into document.body with position:fixed,
 * so it spans the full viewport width independent of parent stacking contexts.
 * `panelTop` is read from barRef.getBoundingClientRect().bottom immediately
 * when the panel opens (synchronous read, no async state lag).
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *  activeSection  string | null  — current tool id
 *  onNavigate     (id|null)=>void
 */

// ── NAV_CONFIG ────────────────────────────────────────────────────────────────

const panelTab = (id, categoryKey) => {
  const cat = CATEGORIES.find(c => c.key === categoryKey);
  return {
    id,
    label:       cat.navLabel,
    type:        'panel',
    categoryKey,
    items:       getToolsByCategory(categoryKey),
    defaultDesc: cat.navDefaultDesc,
  };
};

/**
 * Settings no longer has its own top-level "Config" tab: it moved into the
 * System panel next to History and the CLI, which is where it belongs once
 * categories are defined by the object they act on. That keeps this bar at nine
 * items despite gaining two categories — Config was the one entry whose only
 * job was to reach a single tool.
 */
const NAV_CONFIG = [
  { id: 'ni-home',   label: 'Home',      type: 'direct', sectionId: null },
  panelTab('ni-em',  'emitter'),
  panelTab('ni-gen', 'generator'),
  panelTab('ni-sky', 'skybox'),
  panelTab('ni-tex', 'textures'),
  panelTab('ni-mt',  'maptools'),
  panelTab('ni-sys', 'system'),
  { id: 'ni-com',    label: 'Community', type: 'direct', sectionId: 'contributions' },
  { id: 'ni-guides', label: 'Guides',    type: 'direct', sectionId: 'guides' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveRgb(colorVar) {
  if (!colorVar) return null;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(colorVar).trim();
  if (!raw) return null;
  const h6 = raw.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (h6) return `${parseInt(h6[1],16)},${parseInt(h6[2],16)},${parseInt(h6[3],16)}`;
  const h3 = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (h3) return `${parseInt(h3[1]+h3[1],16)},${parseInt(h3[2]+h3[2],16)},${parseInt(h3[3]+h3[3],16)}`;
  const m = raw.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `${m[1]},${m[2]},${m[3]}`;
  return null;
}

const isComingSoon = (cfg) =>
  cfg.type === 'direct' && getTool(cfg.sectionId)?.status === 'coming-soon';

const getTopActive = (cfg, activeSection) => {
  if (cfg.type === 'direct') return cfg.sectionId === activeSection;
  if (cfg.type === 'panel')  return cfg.items.some(i => i.id === activeSection);
  return false;
};

// ── useNavbarProximity ────────────────────────────────────────────────────────

function useNavbarProximity({ barRef, traceRef, rgbRef, panelOpen, onPanelClose }) {
  const rafRef              = useRef(null);
  const proximityCloseTimer = useRef(null);

  const clearProximityStyles = useCallback(() => {
    const bar   = barRef.current;
    const trace = traceRef.current;
    if (bar) {
      bar.style.background        = '';
      bar.style.borderBottomColor = '';
      bar.style.boxShadow         = '';
    }
    if (trace) {
      trace.style.background = '';
      trace.style.boxShadow  = '';
    }
  }, [barRef, traceRef]);

  const onMouseMove = useCallback((e) => {
    const bar = barRef.current;
    if (!bar) return;

    if (panelOpen) {
      const rect = bar.getBoundingClientRect();
      if (e.clientY < rect.top) {
        if (!proximityCloseTimer.current) {
          proximityCloseTimer.current = setTimeout(() => {
            onPanelClose();
            proximityCloseTimer.current = null;
          }, 380);
        }
      } else {
        if (proximityCloseTimer.current) {
          clearTimeout(proximityCloseTimer.current);
          proximityCloseTimer.current = null;
        }
      }
      return;
    }

    const trace = traceRef.current;
    const rect  = bar.getBoundingClientRect();
    const dist  = Math.max(0, e.clientY - rect.bottom);
    const proximity = Math.max(0, Math.min(1, 1 - dist / 140));
    const rgb   = rgbRef.current;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!rgb || proximity === 0) { clearProximityStyles(); return; }

      const washBot = (0.012 + proximity * 0.08).toFixed(3);
      const washMid = (0.004 + proximity * 0.025).toFixed(3);
      bar.style.background = [
        `linear-gradient(0deg,`,
        `  rgba(${rgb},${washBot}) 0%,`,
        `  rgba(${rgb},${washMid}) 45%,`,
        `  rgba(${rgb},0) 100%`,
        `), var(--surface-deep)`,
      ].join(' ');
      bar.style.borderBottomColor =
        `rgba(${rgb},${(0.05 + proximity * 0.55).toFixed(2)})`;
      bar.style.boxShadow =
        `0 ${Math.round(proximity * 12)}px ${Math.round(proximity * 24)}px -12px var(--shade-70),` +
        ` 0 0 ${Math.round(proximity * 24)}px -4px rgba(${rgb},${(proximity * 0.15).toFixed(2)})`;

      if (trace) {
        trace.style.background =
          `rgba(${rgb},${(0.05 + proximity * 0.65).toFixed(2)})`;
        trace.style.boxShadow = proximity > 0.05
          ? `0 0 ${Math.round(proximity * 16)}px ${Math.round(proximity * 5)}px rgba(${rgb},${(proximity * 0.45).toFixed(2)})`
          : 'none';
      }
    });
  }, [panelOpen, barRef, traceRef, rgbRef, onPanelClose, clearProximityStyles]);

  const onMouseLeave = useCallback(() => {
    if (proximityCloseTimer.current) {
      clearTimeout(proximityCloseTimer.current);
      proximityCloseTimer.current = null;
    }
    if (panelOpen) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    clearProximityStyles();
  }, [panelOpen, clearProximityStyles]);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (proximityCloseTimer.current) clearTimeout(proximityCloseTimer.current);
    };
  }, [onMouseMove, onMouseLeave]);

  useEffect(() => {
    if (panelOpen) clearProximityStyles();
  }, [panelOpen, clearProximityStyles]);

  return { clearProximityStyles };
}

// ── Navbar ────────────────────────────────────────────────────────────────────

const Navbar = ({ activeSection, onNavigate }) => {
  const [openId,          setOpenId]          = useState(null);
  const [hoveredTabColor, setHoveredTabColor] = useState(null);
  // panelTop: bar bottom in viewport px. Stored as ref (not state) so reads
  // are synchronous and don't cause an extra render cycle when the panel opens.
  const panelTopRef   = useRef(72);
  // panelHeight: actual rendered panel height in px, measured by a
  // ResizeObserver on the panel DOM node and stored as state so the
  // atmosphere layer re-renders whenever the panel grows/shrinks.
  const [panelHeight, setPanelHeight] = useState(null);
  const panelRef      = useRef(null);

  const hoverDelayRef = useRef(null);
  const barRef        = useRef(null);
  const traceRef      = useRef(null);
  const rgbRef        = useRef(null);

  const activeTool = getTool(activeSection);
  rgbRef.current   = resolveRgb(activeTool?.colorVar ?? null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (activeTool?.colorVar) {
      bar.style.setProperty('--tab-color', `var(${activeTool.colorVar})`);
    } else {
      bar.style.removeProperty('--tab-color');
    }
  }, [activeTool?.colorVar]);

  // Keep panelTopRef in sync with the bar's actual bottom edge on resize.
  useEffect(() => {
    const update = () => {
      const bar = barRef.current;
      if (bar) panelTopRef.current = bar.getBoundingClientRect().bottom;
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const closePanel = useCallback(() => {
    setOpenId(null);
    setHoveredTabColor(null);
    setPanelHeight(null);
  }, []);

  // Measure the panel height whenever it mounts or resizes.
  // panelRef is attached to NavbarPanel via a forwarded ref wrapper below.
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !openId) { setPanelHeight(null); return; }
    const ro = new ResizeObserver(([entry]) => {
      setPanelHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [openId]);

  useNavbarProximity({
    barRef,
    traceRef,
    rgbRef,
    panelOpen: openId !== null,
    onPanelClose: closePanel,
  });

  // ── Open panel — read bar position synchronously before setState ──────────
  const openPanel = useCallback((cfg, categorySwitch = false) => {
    // Synchronous read: the bar is in the DOM, rect is current.
    const bar = barRef.current;
    if (bar) panelTopRef.current = bar.getBoundingClientRect().bottom;

    const colorVar = cfg.items?.[0]?.colorVar ?? null;
    const firstColor = colorVar ? `var(${colorVar})` : null;

    if (categorySwitch) {
      // Switching between categories: snap to the new category's accent so
      // the haze immediately reflects the active tab, not the old one.
      setHoveredTabColor(firstColor);
    } else {
      // First open: fall back to the first item's color only if nothing is
      // hovered yet (avoids a redundant set when already showing a color).
      setHoveredTabColor(prev => prev ?? firstColor);
    }
    setOpenId(cfg.id);
  }, []);

  const handleTabMouseEnter = useCallback((cfg) => {
    if (openId !== null) {
      // Already open — switch instantly, read position again.
      clearTimeout(hoverDelayRef.current);
      openPanel(cfg, openId !== cfg.id);
      return;
    }
    clearTimeout(hoverDelayRef.current);
    hoverDelayRef.current = setTimeout(() => openPanel(cfg, false), 60);
  }, [openId, openPanel]);

  const handleTabMouseLeave = useCallback(() => {
    clearTimeout(hoverDelayRef.current);
  }, []);

  const handleDirectNav = useCallback((sectionId) => {
    onNavigate(sectionId);
    setOpenId(null);
    setHoveredTabColor(null);
  }, [onNavigate]);

  const handleItemNav = useCallback((id) => {
    onNavigate(id);
    setOpenId(null);
    setHoveredTabColor(null);
  }, [onNavigate]);

  const openCfg = openId ? NAV_CONFIG.find(c => c.id === openId) : null;

  useEffect(() => {
    return () => clearTimeout(hoverDelayRef.current);
  }, []);

  // panelTop as a stable number for this render — read from ref.
  const panelTop = panelTopRef.current;

  return (
    <>
      {/* Atmosphere layer — singleton WebGL haze, visible when panel is open.
          Portaled into document.body (same as NavbarPanel below): rendering
          it in-place inside .forgemaptoolkit-chrome would trap its z-index
          inside that wrapper's own stacking context (position:relative +
          z-index:2), capping it there no matter how high zIndex is set
          internally — it would never be able to paint above the
          body-portaled panel. Portaling puts both in the same stacking
          context so the z-index comparison actually applies. */}
      {createPortal(
        <NavbarAtmosphereLayer
          hoveredTabColor={hoveredTabColor}
          visible={openId !== null}
          panelTop={panelTop}
          panelHeight={panelHeight}
        />,
        document.body
      )}

      {/* Panel + backdrop — portal into document.body, position:fixed */}
      {openCfg && createPortal(
        <NavbarPanel
          cfg={openCfg}
          activeSection={activeSection}
          onNavigate={handleItemNav}
          onClose={closePanel}
          onHoveredColorChange={setHoveredTabColor}
          panelTop={panelTop}
          instant={false}
          measureRef={panelRef}
        />,
        document.body
      )}

      {/* Bar */}
      <nav
        ref={barRef}
        className="nb-bar"
        onClick={e => e.stopPropagation()}
      >
        <div ref={traceRef} className="nb-trace" aria-hidden="true" />

        <div className="nb-track">
          {NAV_CONFIG.map(cfg => {
            const soon     = isComingSoon(cfg);
            const isActive = getTopActive(cfg, activeSection);
            const isOpen   = openId === cfg.id;

            return (
              <div
                key={cfg.id}
                className={[
                  'nb-item',
                  isActive ? 'nb-item--active' : '',
                  isOpen   ? 'nb-item--open'   : '',
                ].filter(Boolean).join(' ')}
                onMouseEnter={cfg.type === 'panel'
                  ? () => handleTabMouseEnter(cfg)
                  : undefined}
                onMouseLeave={cfg.type === 'panel'
                  ? handleTabMouseLeave
                  : undefined}
              >
                <button
                  className={['nb-label', soon ? 'nb-label--soon' : ''].filter(Boolean).join(' ')}
                  disabled={soon}
                  onClick={cfg.type === 'direct'
                    ? () => handleDirectNav(cfg.sectionId)
                    : undefined}
                  onFocus={cfg.type === 'panel'
                    ? () => handleTabMouseEnter(cfg)
                    : undefined}
                  onBlur={cfg.type === 'panel'
                    ? handleTabMouseLeave
                    : undefined}
                >
                  <span className="nb-label-text">{cfg.label}</span>
                  {soon && <span className="nb-label-soon">SOON</span>}
                </button>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
