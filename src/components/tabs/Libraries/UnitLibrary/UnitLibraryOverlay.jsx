import React, { useState, useMemo, useRef, useEffect } from 'react';
import './UnitLibraryOverlay.css';

// ─── Faction Config ───────────────────────────────────────────────────────────
const FACTION_ORDER = ['aeon', 'cybran', 'uef', 'seraphim', 'nomads'];

const FACTION_CONFIG = {
  aeon: {
    label: 'Aeon',
    color: '#4caf50',
    glow: 'rgba(76, 175, 80, 0.55)',
    glowStrong: 'rgba(76, 175, 80, 0.12)',
    hue: '100deg',   // green
  },
  cybran: {
    label: 'Cybran',
    color: '#f44336',
    glow: 'rgba(244, 67, 54, 0.55)',
    glowStrong: 'rgba(244, 67, 54, 0.12)',
    hue: '320deg',   // red
  },
  uef: {
    label: 'UEF',
    color: '#2196f3',
    glow: 'rgba(33, 150, 243, 0.55)',
    glowStrong: 'rgba(33, 150, 243, 0.12)',
    hue: '195deg',   // blue
  },
  seraphim: {
    label: 'Seraphim',
    color: '#ffc107',
    glow: 'rgba(255, 193, 7, 0.55)',
    glowStrong: 'rgba(255, 193, 7, 0.12)',
    hue: '35deg',    // yellow/gold
  },
  nomads: {
    label: 'Nomads',
    color: '#ff8c00',
    glow: 'rgba(255, 140, 0, 0.55)',
    glowStrong: 'rgba(255, 140, 0, 0.12)',
    hue: '20deg',    // orange — fallback symbol used, no SVG
  },
  operations: {
    label: 'Operations',
    color: '#e0857a',
    glow: 'rgba(224, 133, 122, 0.45)',
    glowStrong: 'rgba(224, 133, 122, 0.1)',
    hue: '340deg',
  },
  civilian: {
    label: 'Civilian',
    color: '#9e9e9e',
    glow: 'rgba(158, 158, 158, 0.4)',
    glowStrong: 'rgba(158, 158, 158, 0.08)',
    hue: '0deg',
  },
  dev: {
    label: 'Dev',
    color: '#555555',
    glow: 'rgba(85, 85, 85, 0.35)',
    glowStrong: 'rgba(85, 85, 85, 0.07)',
    hue: '0deg',
  },
};

// ─── Subcategory Config ───────────────────────────────────────────────────────
// Groups: type first; within each group units are sorted by tier (T1→T2→T3→EXP),
// then by override idx (override units first), then by auto-parsed idx.
const TYPE_GROUPS = [
  'Land',
  'Air',
  'Naval',
  'Structures - Weapons',
  'Structures - Intelligence',
  'Structures - Economy',
  'Structures - Factories',
  'Structures - Support',
  'Economy',
  'Civilian',
];

// Keep TYPE_SUBCATEGORIES as alias so filter buttons still work
const TYPE_SUBCATEGORIES = TYPE_GROUPS;

// Returns the single type-group this unit belongs to.
function getUnitTypeGroup(unit, overrides) {
  // Allow full group override via unit_overrides.json: { "group": "Naval" }
  const ov = overrides?.[unit?.id?.toUpperCase()];
  if (ov?.group) return ov.group;

  const cats = (unit.bpCategories || []).map(c => c.toUpperCase());
  const classification = (unit.classification || '').toUpperCase();

  // Fallback: if bpCategories failed to parse, use layer derived from unit ID
  // FACTORY alone is not enough — mobile carriers/experimentals can have FACTORY too.
  // A unit is only a structure if it explicitly has STRUCTURE, or layer='structure'.
  const isStructure = cats.includes('STRUCTURE')
                   || (unit.layer === 'structure');

  if (isStructure) {
    // Primary: classification-based (works even when bpCategories is empty)
    if (classification.includes('RULEUC_WEAPON'))                              return 'Structures - Weapons';
    if (classification.includes('RULEUC_RESOURCE') ||
        classification.includes('RULEUC_MASSEXTRACTION') ||
        classification.includes('RULEUC_ENERGY'))                              return 'Structures - Economy';
    if (classification.includes('RULEUC_SENSOR'))                              return 'Structures - Intelligence';
    if (classification.includes('RULEUC_FACTORY'))                             return 'Structures - Factories';

    // Secondary: bpCategories-based (more granular when available)
    if (cats.includes('ECONOMIC') || cats.includes('MASSEXTRACTION') ||
        cats.includes('ENERGYPRODUCTION') || cats.includes('MASSFABRICATION')) return 'Structures - Economy';
    if (cats.includes('INTELLIGENCE'))                                         return 'Structures - Intelligence';
    if (cats.includes('CONSTRUCTION') || cats.includes('FACTORY'))             return 'Structures - Factories';
    return 'Structures - Support';
  }

  if (cats.includes('LAND'))  return 'Land';
  if (cats.includes('AIR'))   return 'Air';
  if (cats.includes('NAVAL')) return 'Naval';

  if (cats.includes('ECONOMIC') || cats.includes('MASSEXTRACTION') ||
      cats.includes('ENERGYPRODUCTION') || cats.includes('MASSFABRICATION')) return 'Economy';
  if (cats.includes('CIVILIAN')) return 'Civilian';

  // Fallback via layer
  const layer = (unit.layer || '').toLowerCase();
  if (layer === 'land' || layer === 'amphibious' || layer === 'amphib') return 'Land';
  if (layer === 'air')                                                   return 'Air';
  if (layer === 'naval' || layer === 'water' || layer === 'seabed')     return 'Naval';
  return 'Structures - Support';
}

// ─── Sort overrides — loaded from /data/unit-sort-overrides.json via IPC ────
// Returns a cleaned map: { "UAL0201": { tier: 1, idx: 1 }, ... }
async function fetchSortOverrides() {
  try {
    const ipc = getIpcRenderer();
    if (!ipc) return {};
    const res = await ipc.invoke('read-data-file', { name: 'unit_overrides.json' });
    if (!res?.success || !res.data) return {};
    const cleaned = {};
    for (const [k, v] of Object.entries(res.data)) {
      if (!k.startsWith('_') && (v?.tier !== undefined || v?.group !== undefined)) {
        cleaned[k.toUpperCase()] = v;
      }
    }
    return cleaned;
  } catch (e) {
    return {};
  }
}

async function fetchBlacklist() {
  try {
    const ipc = getIpcRenderer();
    if (!ipc) { console.warn('[Blacklist] no IPC'); return new Set(); }
    const res = await ipc.invoke('read-data-file', { name: 'unit_blacklist.json' });
    console.log('[Blacklist] res:', JSON.stringify(res));
    if (!res?.success || !Array.isArray(res.data)) return new Set();
    const bl = new Set(res.data.map(id => id.toUpperCase()));
    console.log('[Blacklist] loaded:', [...bl]);
    return bl;
  } catch (e) {
    console.error('[Blacklist] error:', e.message);
    return new Set();
  }
}

// Parse unit ID into sortable {tier, idx}.
// Override lookup takes priority over auto-parse.
// Auto-parse: e.g. UEL0203 → techRaw="02", idx=3, tier = 2nd digit = 2.
// Tier: 1=T1, 2=T2, 3=T3, 4=Experimental. 99=unknown/fallback.
// Parse unit into sortable {tier, idx}.
// Priority: 1) override, 2) bpCategories TECH tags, 3) ID-based auto-parse fallback.
// Non-override units get idx 1000+ so override-units always sort first within same tier.
function parseUnitId(id, overrides, unit) {
  if (!id) return { tier: 99, idx: 9999 };

  // 1) Override takes full priority
  const ov = overrides?.[id.toUpperCase()];
  if (ov) return { tier: ov.tier ?? 99, idx: ov.idx !== undefined ? ov.idx : 9999 };

  // 2) Tier from bpCategories (reliable for all units)
  const cats = (unit?.bpCategories || []).map(c => c.toUpperCase());
  let tier = 99;
  if (cats.includes('EXPERIMENTAL')) tier = 4;
  else if (cats.includes('TECH3'))   tier = 3;
  else if (cats.includes('TECH2'))   tier = 2;
  else if (cats.includes('TECH1'))   tier = 1;
  else {
    // 3) Fallback: ID-based auto-parse
    const m = id.match(/^[A-Za-z]*(\d{2})(\d{2})/);
    if (m) tier = parseInt(m[1][1], 10);
  }

  // idx from last digits of ID — offset by 1000 so non-override units sort after override units
  const m2 = id.match(/(\d{2,4})$/);
  const idx = m2 ? 1000 + parseInt(m2[1], 10) : 9999;
  return { tier, idx };
}

// Sort within a type-group: tier first (override tier wins), then idx (override idx first)
function sortByIdScheme(units, overrides) {
  return units.slice().sort((a, b) => {
    const pa = parseUnitId(a.id, overrides, a), pb = parseUnitId(b.id, overrides, b);
    if (pa.tier !== pb.tier) return pa.tier - pb.tier;
    if (pa.idx  !== pb.idx)  return pa.idx  - pb.idx;
    return (a.id || '').localeCompare(b.id || '');
  });
}

function groupUnitsBySubcat(units, activeFilters, sortOverrides) {
  const buckets = {};
  for (const grp of TYPE_GROUPS) buckets[grp] = [];
  for (const unit of units) {
    const grp = getUnitTypeGroup(unit, sortOverrides);
    if (buckets[grp]) buckets[grp].push(unit);
  }
  return TYPE_GROUPS
    .filter(grp => activeFilters.has(grp) && buckets[grp].length > 0)
    .map(grp => ({
      label: grp,
      units: sortByIdScheme(buckets[grp], sortOverrides),
    }));
}

function resolveFactionId(catName) {
  return Object.keys(FACTION_CONFIG).find(
    k => FACTION_CONFIG[k].label.toLowerCase() === catName.toLowerCase() ||
         k === catName.toLowerCase()
  ) || catName.toLowerCase();
}

// ─── Icon cache — loaded via IPC to work in file:// (production) ─────────────
const iconCache = {};

function getIpcRenderer() {
  return window.electronAPI;
}

async function loadFactionIcon(factionId) {
  if (!factionId) return null;
  const key = factionId.toLowerCase();
  if (iconCache[key] !== undefined) return iconCache[key];
  iconCache[key] = null; // prevent parallel fetches
  try {
    const ipc = getIpcRenderer();
    if (!ipc) return null;
    const res = await ipc.invoke('load-faction-icon', { name: key });
    if (res?.success) iconCache[key] = res.dataUrl;
  } catch (e) {
    // silently ignore — fallback icon will show
  }
  return iconCache[key];
}

// ─── FactionLogo ──────────────────────────────────────────────────────────────
// SVGs are black — we use CSS filter to invert+colorize them with the faction color.
// selected=true applies a stronger glow for the active faction button.
function FactionLogo({ faction, size = 26, selected = false }) {
  const cfg = FACTION_CONFIG[faction?.toLowerCase()] || FACTION_CONFIG.dev;
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadFactionIcon(faction).then(url => {
      if (!cancelled && url) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [faction]);

  if (src) {
    // Glow via drop-shadow only — logo itself stays unchanged
    const glowSize  = selected ? Math.round(size * 1.0) : Math.round(size * 0.5);
    const glowSize2 = selected ? Math.round(size * 2.2) : Math.round(size * 1.2);
    const glowColor = selected ? cfg.color : cfg.glow;
    const imgFilter = `drop-shadow(0 0 ${glowSize}px ${glowColor})
      drop-shadow(0 0 ${glowSize2}px ${glowColor})`;
    return (
      <img
        src={src} alt={cfg.label} width={size} height={size}
        style={{ objectFit: 'contain', filter: imgFilter }}
      />
    );
  }
  // Fallback: colored symbol (used for Nomads and unknown factions)
  const glowStr = selected
    ? `brightness(2.5) drop-shadow(0 0 6px ${cfg.color}) drop-shadow(0 0 14px ${cfg.color})`
    : `drop-shadow(0 0 4px ${cfg.glow}) drop-shadow(0 0 10px ${cfg.glow})`;
  return (
    <span style={{ fontSize: size * 0.65 + 'px', color: cfg.color,
      filter: glowStr, lineHeight: 1 }}>◆</span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UnitLibraryOverlay({ unitLibrary, onSelect, onClose, onReload, libraryLoading }) {
  const [selectedFaction, setSelectedFaction] = useState('__all__');
  const [activeFilters, setActiveFilters] = useState(new Set(TYPE_SUBCATEGORIES));
  const [soloFilters,   setSoloFilters]   = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOverrides, setSortOverrides] = useState({});
  const [blacklist, setBlacklist] = useState(new Set());
  const [assetBaseUrl, setAssetBaseUrl] = useState('');
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Load sort overrides from /data/unit-sort-overrides.json on mount
  useEffect(() => {
    fetchSortOverrides().then(ov => setSortOverrides(ov));
    fetchBlacklist().then(bl => setBlacklist(bl));
    try { const ipc = getIpcRenderer(); if (ipc) ipc.invoke('get-asset-base-url').then(r => { if (r?.baseUrl) setAssetBaseUrl(r.baseUrl); }); } catch(_) {}
  }, []);

  const factions = useMemo(() => {
    const cats = unitLibrary?.categories || [];
    const mapped = cats.map(cat => ({
      id: resolveFactionId(cat.name),
      label: cat.name,
      count: cat.units?.length || 0,
      raw: cat,
    }));
    return mapped
      .filter(f => FACTION_CONFIG[f.id])  // dismiss unknown factions
      .sort((a, b) => {
        const ai = FACTION_ORDER.indexOf(a.id), bi = FACTION_ORDER.indexOf(b.id);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [unitLibrary]);

  const allUnits = useMemo(() =>
    (unitLibrary?.categories || []).flatMap(cat => {
      const factionId = resolveFactionId(cat.name);
      // Dismiss unknown factions entirely
      if (!FACTION_CONFIG[factionId]) return [];
      return (cat.units || []).map(u => ({ ...u, factionName: cat.name, factionId }));
    }).filter(u => !blacklist.has((u.id || '').toUpperCase())),
    [unitLibrary, blacklist]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allUnits.filter(u => u.name?.toLowerCase().includes(q) || u.id?.toLowerCase().includes(q));
  }, [searchQuery, allUnits]);

  const toggleFilter = (sub) => {
    setSoloFilters(new Set()); // clear solo when using toggle-off mode
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(sub) ? next.delete(sub) : next.add(sub);
      if (next.size === 0) return new Set(TYPE_SUBCATEGORIES); // prevent all-off
      return next;
    });
  };

  const toggleSoloFilter = (sub) => {
    setActiveFilters(new Set(TYPE_SUBCATEGORIES)); // reset toggle-off when using solo
    setSoloFilters(prev => {
      const next = new Set(prev);
      next.has(sub) ? next.delete(sub) : next.add(sub);
      return next;
    });
  };

  const resetFilters = () => {
    setActiveFilters(new Set(TYPE_SUBCATEGORIES));
    setSoloFilters(new Set());
  };

  // Effective filter: solo takes priority over activeFilters
  const effectiveFilters = soloFilters.size > 0 ? soloFilters : activeFilters;

  const currentFactionData = useMemo(() =>
    factions.find(f => f.id === selectedFaction) || null,
    [selectedFaction, factions]
  );

  const groupedUnits = useMemo(() => {
    if (!currentFactionData) return [];
    const enriched = (currentFactionData.raw?.units || [])
      .filter(u => !blacklist.has((u.id || '').toUpperCase()))
      .map(u => ({
        ...u,
        factionId: currentFactionData.id,
        factionName: currentFactionData.label,
      }));
    return groupUnitsBySubcat(enriched, effectiveFilters, sortOverrides);
  }, [currentFactionData, activeFilters, sortOverrides, blacklist]);

  const cfg = FACTION_CONFIG[selectedFaction] || {};
  const isAll = selectedFaction === '__all__';

  return (
    <>
      <div className="ul-backdrop" onClick={onClose} />
      <div className="ul-window">

        {/* ── Sidebar ── */}
        <div className="ul-sidebar">
          <div className="ul-sidebar-header">
            <span className="ul-sidebar-title">Unit Library</span>
          </div>

          <div className="ul-faction-list">
            <button
              className={`ul-faction-item ${isAll ? 'active' : ''}`}
              onClick={() => setSelectedFaction('__all__')}
              style={{ '--fc': '#fff', '--fg': 'rgba(255,255,255,0.45)', '--fs': 'rgba(255,255,255,0.06)' }}
            >
              
              <div className="ul-faction-info">
                <span className="ul-faction-name">All Factions</span>
                <span className="ul-faction-count">{allUnits.length} units</span>
              </div>
              {isAll && <div className="ul-faction-active-dot" />}
            </button>

            <div className="ul-faction-sep" />

            {factions.map(f => {
              const fc = FACTION_CONFIG[f.id] || { color: '#888', glow: 'rgba(136,136,136,0.4)', glowStrong: 'rgba(136,136,136,0.08)' };
              const active = selectedFaction === f.id;
              return (
                <button
                  key={f.id}
                  className={`ul-faction-item ${active ? 'active' : ''}`}
                  onClick={() => setSelectedFaction(f.id)}
                  style={{ '--fc': fc.color, '--fg': fc.glow, '--fs': fc.glowStrong }}
                >
                  <div className="ul-faction-logo"><FactionLogo faction={f.id} size={32} selected={active} /></div>
                  <div className="ul-faction-info">
                    <span className="ul-faction-name">{f.label}</span>
                    <span className="ul-faction-count">{f.count} units</span>
                  </div>
                  {active && <div className="ul-faction-active-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main ── */}
        <div className="ul-main">

          {/* Header */}
          <div
            className="ul-header"
            style={{ '--fc': isAll ? '#fff' : (cfg.color || '#fff'), '--fg': isAll ? 'rgba(255,255,255,0.3)' : (cfg.glow || 'rgba(255,255,255,0.3)') }}
          >
            <div className="ul-header-left">
              {isAll ? (
                <div className="ul-header-badge">
                  <span className="ul-header-name" style={{ color: '#fff', textShadow: '0 0 24px rgba(255,255,255,0.2)' }}>All Factions</span>
                </div>
              ) : (
                <div className="ul-header-badge">
                  <FactionLogo faction={selectedFaction} size={40} selected={true} />
                  <span className="ul-header-name">{cfg.label || selectedFaction}</span>
                </div>
              )}
            </div>
            <div className="ul-header-right">
              <button className="ul-reload-btn" onClick={onReload}>↺ Reload</button>
              <button className="ul-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="ul-toolbar">
            <div className="ul-search-wrap">
              <span className="ul-search-icon">⌕</span>
              <input
                ref={searchRef} className="ul-search" type="text"
                placeholder="Search units by name or ID…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && <button className="ul-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
            </div>
            <div className="ul-filters" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div className="ul-filter-row">
                {TYPE_SUBCATEGORIES.map(sub => (
                  <button
                    key={sub}
                    className={`ul-filter-btn ${soloFilters.size === 0 && activeFilters.has(sub) ? 'active' : soloFilters.size > 0 ? 'inactive' : ''}`}
                    onClick={() => toggleFilter(sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              <div className="ul-filter-row" style={{ marginTop: '4px' }}>
                {TYPE_SUBCATEGORIES.map(sub => (
                  <button
                    key={sub}
                    className={`ul-filter-btn ul-filter-solo ${soloFilters.has(sub) ? 'active' : ''}`}
                    onClick={() => toggleSoloFilter(sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              {soloFilters.size > 0 && (
                <button className="ul-filter-reset" onClick={resetFilters} style={{ marginTop: '4px', fontSize: '11px', opacity: 0.7 }}>
                  ✕ Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="ul-content">
            {libraryLoading ? (
              <div className="ul-empty"><div className="ul-empty-icon">⟳</div><p>Loading unit library…</p></div>
            ) : searchQuery.trim() ? (
              <SearchResultsView results={searchResults || []} query={searchQuery} onSelect={onSelect} sortOverrides={sortOverrides} />
            ) : isAll ? (
              <AllSubcatView allUnits={allUnits} activeFilters={effectiveFilters} onSelect={onSelect} sortOverrides={sortOverrides} />
            ) : (
              <FactionView factionColor={cfg.color} groups={groupedUnits} onSelect={onSelect} sortOverrides={sortOverrides} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────
function FactionView({ factionColor, groups, onSelect, sortOverrides }) {
  if (!groups.length) return (
    <div className="ul-empty">
      <div className="ul-empty-icon" style={{ animation: 'none' }}>◈</div>
      <p>No units match the active filters.</p>
    </div>
  );
  return (
    <div className="ul-faction-view">
      {groups.map(g => (
        <SubcategorySection key={g.label} label={g.label} units={g.units} accentColor={factionColor} onSelect={onSelect} sortOverrides={sortOverrides} />
      ))}
    </div>
  );
}

function AllSubcatView({ allUnits, activeFilters, onSelect, sortOverrides }) {
  const groups = useMemo(() => {
    const buckets = {};
    for (const grp of TYPE_GROUPS) buckets[grp] = [];
    for (const unit of allUnits) {
      const grp = getUnitTypeGroup(unit, sortOverrides);
      if (buckets[grp]) buckets[grp].push(unit);
    }
    return TYPE_GROUPS
      .filter(grp => activeFilters.has(grp) && buckets[grp].length > 0)
      .map(grp => ({
        label: grp,
        units: sortByIdScheme(buckets[grp], sortOverrides),
      }));
  }, [allUnits, activeFilters, sortOverrides]);

  if (!groups.length) return (
    <div className="ul-empty">
      <div className="ul-empty-icon" style={{ animation: 'none' }}>◈</div>
      <p>No units match the active filters.</p>
    </div>
  );
  return (
    <div className="ul-faction-view">
      {groups.map(g => (
        <SubcategorySection key={g.label} label={g.label} units={g.units}
          accentColor="rgba(255,255,255,0.45)" onSelect={onSelect} showFaction sortOverrides={sortOverrides} />
      ))}
    </div>
  );
}

function SearchResultsView({ results, query, onSelect, sortOverrides }) {
  if (!results.length) return (
    <div className="ul-empty">
      <div className="ul-empty-icon" style={{ animation: 'none' }}>◈</div>
      <p>No units found for "{query}"</p>
    </div>
  );
  return (
    <div className="ul-faction-view">
      <SubcategorySection label={`${results.length} Results`} units={sortByIdScheme(results, sortOverrides)}
        accentColor="rgba(255,255,255,0.4)" onSelect={onSelect} showFaction />
    </div>
  );
}

// ─── Subcategory Section ──────────────────────────────────────────────────────
function SubcategorySection({ label, units, accentColor, onSelect, showFaction, compact, sortOverrides = {} }) {
  const [collapsed, setCollapsed] = useState(false);

  // Mark each unit with whether it starts a new tier row (for grid-column reset)
  const unitsWithBreaks = useMemo(() => {
    let lastTier = null;
    return units.map(unit => {
      const { tier } = parseUnitId(unit.id, sortOverrides, unit);
      const isNewTier = lastTier !== null && tier !== lastTier;
      lastTier = tier;
      return { unit, isNewTier };
    });
  }, [units, sortOverrides]);

  return (
    <div className="ul-subcat-section">
      <button className="ul-subcat-header" onClick={() => setCollapsed(c => !c)} style={{ '--ac': accentColor }}>
        <span className="ul-subcat-label">{label}</span>
        <div className="ul-subcat-meta">
          <span className="ul-subcat-count">{units.length}</span>
        </div>
      </button>
      {!collapsed && (
        <div className={`ul-unit-grid ${compact ? 'compact' : ''}`} style={{ gridTemplateColumns: 'repeat(auto-fill, 370px)' }}>
          {unitsWithBreaks.map(({ unit, isNewTier }, idx) => (
            <UnitCard
              key={`${unit.id}-${idx}`}
              unit={unit}
              onSelect={onSelect}
              showFaction={showFaction}
              isNewTier={isNewTier}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Unit Card ────────────────────────────────────────────────────────────────
// Maps factionId to the capitalized name used in strategic icon filenames
const STRATEGIC_FACTION = {
  aeon: 'Aeon', uef: 'UEF', cybran: 'Cybran', seraphim: 'Seraphim',
  nomads: 'Nomads', operations: 'UEF', civilian: 'UEF', dev: 'UEF',
};

// Module-level asset base URL — set once on first load
let _assetBaseUrl = '';
(async () => {
  try {
    const ipc = getIpcRenderer();
    if (ipc) {
      const r = await ipc.invoke('get-asset-base-url');
      if (r?.baseUrl) _assetBaseUrl = r.baseUrl;
    }
  } catch(_) {}
})();

function UnitCard({ unit, onSelect, showFaction, isNewTier }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!unit.id) return;
    navigator.clipboard.writeText(unit.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const previewUrl = unit.preview ||
    `https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/units/${(unit.id || '').toUpperCase()}.png`;
  const factionCfg = unit.factionId ? FACTION_CONFIG[unit.factionId] : null;

  return (
    <div
      className="ul-unit-card"
      onClick={() => onSelect(unit)}
      onContextMenu={handleContextMenu}
      title={copied ? `Copied: ${unit.id}` : `${unit.name}\n${unit.id}\nRight-click to copy ID`}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px',
        width: '350px',
        ...(factionCfg ? { '--hc': factionCfg.color, '--hg': factionCfg.glow } : {}),
        ...(isNewTier ? { gridColumn: '1' } : {}),
      }}
    >
      <div className="ul-unit-preview" style={{ flexShrink: 0, width: '56px', height: '56px' }}>
        {!imgFailed
          ? <img src={previewUrl} alt={unit.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setImgFailed(true)} />
          : <div className="ul-unit-preview-fallback"><span>{(unit.id || 'U').slice(0, 4).toUpperCase()}</span></div>
        }
      </div>
      <div className="ul-unit-info" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="ul-unit-name" style={{ fontSize: '15px' }}>{unit.name || unit.id}</div>
        <div className="ul-unit-id" style={{ fontSize: '12px' }}>{unit.id}</div>
        {showFaction && unit.factionName && (
          <div className="ul-unit-faction-tag" style={factionCfg ? { color: factionCfg.color, opacity: 0.75 } : {}}>
            {unit.factionName}
          </div>
        )}
      </div>
      {unit.strategicIcon && STRATEGIC_FACTION[unit.factionId] && (
        <img
          src={`${_assetBaseUrl}/assets/strategic/${STRATEGIC_FACTION[unit.factionId]}_${unit.strategicIcon}.png`}
          alt={unit.strategicIcon}
          width={34} height={34}
          style={{
            flexShrink: 0,
            imageRendering: 'pixelated',
          }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
    </div>
  );
}