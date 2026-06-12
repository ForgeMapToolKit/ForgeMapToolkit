import React, { useState, useEffect, useRef } from 'react';
import { CATEGORIES, getToolsByCategory, getTool } from '../home/data/toolRegistry.js';
import './MegaNavbar.css';

/**
 * MegaNavbar — the navigation register of the suite.
 *
 * The same machine as banner and home screen, one register down: a flat
 * instrument strip (#070708, dot grid) ruled by hairlines. Top items are
 * quiet captions; the active group carries a phosphor underline in the
 * ACTIVE TOOL'S hue (--nav-accent) — navbar and banner trace respond to
 * the same signal.
 *
 * Mega panels are flat plates that print downward (clip-path, no blur,
 * no glass). Items are slat rows — registry index + phosphor tick that
 * ignites in the tool's hue; the label steps to white, never to color:
 * color belongs to the tick (restraint contract).
 *
 * The right field is a small projection stage: eyebrow, title printed
 * by a carriage pass, trace filament in the item's hue, ghost index.
 * Keyed remount per hovered item restarts the pass.
 *
 * All tool metadata (label, index, hue, description, status) comes from
 * toolRegistry.js — only the nav layout (which groups are mega vs.
 * direct) is defined here. Coming-soon entries derive from the registry.
 *
 * Props:
 *  - activeSection: current tool id or null (home)
 *  - onNavigate(id|null)
 */

const megaGroup = (id, categoryKey) => {
  const cat = CATEGORIES.find(c => c.key === categoryKey);
  return {
    id,
    label: cat.navLabel,
    type: 'mega',
    items: getToolsByCategory(categoryKey),
    defaultDesc: cat.navDefaultDesc,
  };
};

const NAV_CONFIG = [
  { id: 'ni-home',   label: 'Home',      type: 'direct', sectionId: null },
  megaGroup('ni-em',  'emitter'),
  megaGroup('ni-gen', 'generator'),
  megaGroup('ni-sky', 'skybox'),
  megaGroup('ni-tl',  'tools'),
  { id: 'ni-com',    label: 'Community', type: 'direct', sectionId: 'contributions' },
  { id: 'ni-guides', label: 'Guides',    type: 'direct', sectionId: 'guides' },
  { id: 'ni-cfg',    label: 'Config',    type: 'direct', sectionId: 'settings' },
];

// A direct entry is "coming soon" when its registry tool says so.
const isComingSoon = (cfg) =>
  cfg.type === 'direct' && getTool(cfg.sectionId)?.status === 'coming-soon';

/* ── Description field — a small projection stage, reprinted per item ── */

const DescPanel = ({ group, item }) => (
  <div
    className="mnb-desc"
    key={item?.id ?? 'group-default'}
    style={item ? {
      '--item-color':       item.color,
      '--item-glow-strong': item.glowStrong,
    } : undefined}
  >
    <span className="mnb-desc-ghost" aria-hidden="true">{item?.index ?? '··'}</span>
    <div className="mnb-desc-eyebrow">
      {group.label.toUpperCase()}{item ? ` — REGISTER ${item.index}` : ''}
    </div>
    <div className="mnb-desc-title">{(item?.label ?? group.label).toUpperCase()}</div>
    <div className="mnb-desc-trace" aria-hidden="true" />
    <p className="mnb-desc-body">{item?.navDescription ?? group.defaultDesc}</p>
  </div>
);

/* ── Navbar ──────────────────────────────────────────────────────────── */

const MegaNavbar = ({ activeSection, onNavigate }) => {
  const [openId, setOpenId]   = useState(null);
  // per-dropdown: which sub-item is currently hovered for the desc panel
  const [hovered, setHovered] = useState({});
  const hoverTimerRef = useRef(null);

  const handleMouseEnterNav = (id) => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setOpenId(id), 80);
  };

  const handleMouseLeaveNav = () => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setOpenId(null), 120);
  };

  const pickItem = (itemId) => {
    onNavigate(itemId);
    setOpenId(null);
  };

  const directNav = (sectionId) => {
    onNavigate(sectionId);
    setOpenId(null);
  };

  // Close on outside click
  useEffect(() => {
    const close = () => setOpenId(null);
    document.addEventListener('click', close);
    return () => {
      document.removeEventListener('click', close);
      clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const getTopActive = (cfg) => {
    if (cfg.type === 'direct') return cfg.sectionId === activeSection;
    if (cfg.type === 'mega')   return cfg.items.some(i => i.id === activeSection);
    return false;
  };

  // The register answers to the active tool's hue — same signal as the
  // banner trace.
  const activeTool = getTool(activeSection);

  return (
    <nav
      className="mnb-navbar"
      style={{
        '--nav-accent':      activeTool?.color      ?? 'var(--accent-primary, #ff8c00)',
        '--nav-glow-strong': activeTool?.glowStrong ?? 'var(--accent-glow-strong, rgba(255,140,0,0.6))',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="mnb-track">
        {NAV_CONFIG.map(cfg => {
          const soon     = isComingSoon(cfg);
          const isOpen   = openId === cfg.id;
          const isActive = getTopActive(cfg);
          const niClass  = `mnb-ni${isActive ? ' mnb-active' : ''}${isOpen ? ' mnb-open' : ''}`;

          return (
            <div
              key={cfg.id}
              className={niClass}
              onMouseEnter={cfg.type === 'mega' ? () => handleMouseEnterNav(cfg.id) : undefined}
              onMouseLeave={cfg.type === 'mega' ? handleMouseLeaveNav : undefined}
            >
              <button
                className={`mnb-lbl${soon ? ' mnb-soon-lbl' : ''}`}
                disabled={soon}
                onClick={cfg.type === 'direct'
                  ? () => directNav(cfg.sectionId)
                  : (e) => { e.stopPropagation(); setOpenId(prev => (prev === cfg.id ? null : cfg.id)); }}
              >
                <span className="mnb-lbl-text">{cfg.label}</span>
                {soon && <span className="mnb-soon-tag">SOON</span>}
              </button>

              {cfg.type === 'mega' && (
                <div className="mnb-mega" onClick={e => e.stopPropagation()}>

                  <div className="mnb-mega-col">
                    <div className="mnb-mega-caption">{cfg.label.toUpperCase()}</div>
                    {cfg.items.map(item => (
                      <button
                        key={item.id}
                        className={`mnb-sub${activeSection === item.id ? ' mnb-on' : ''}`}
                        style={{
                          '--item-color':       item.color,
                          '--item-glow-strong': item.glowStrong,
                        }}
                        onClick={() => pickItem(item.id)}
                        onMouseEnter={() => setHovered(prev => ({ ...prev, [cfg.id]: item }))}
                        onMouseLeave={() => setHovered(prev => ({ ...prev, [cfg.id]: null }))}
                      >
                        <span className="mnb-sub-tick" aria-hidden="true" />
                        <span className="mnb-sub-index">{item.index}</span>
                        <span className="mnb-sub-label">{item.label.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>

                  <DescPanel
                    group={cfg}
                    item={hovered[cfg.id] ?? cfg.items.find(i => i.id === activeSection) ?? null}
                  />

                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default MegaNavbar;
