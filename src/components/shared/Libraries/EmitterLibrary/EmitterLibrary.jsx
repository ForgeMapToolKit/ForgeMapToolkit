import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './EmitterLibrary.css';

const SORT_OPTIONS = [
  { value: 'name-asc',  label: 'Name A→Z' },
  { value: 'name-desc', label: 'Name Z→A' },
];

function sortEmitters(list, sortKey) {
  const s = [...list];
  if (sortKey === 'name-desc') return s.sort((a,b) => (b.name||b.id).localeCompare(a.name||a.id,undefined,{sensitivity:'base'}));
  return s.sort((a,b) => (a.name||a.id).localeCompare(b.name||b.id,undefined,{sensitivity:'base'}));
}

// Strip the versioned suffix from a map folder name to get a clean display name.
// e.g. "MyMap.v0001" → "MyMap"
function cleanMapName(name) {
  if (!name) return name;
  return name.replace(/\.v\d+$/, '');
}

// ════════════════════════════════════════════════════════════════════════════
export default function EmitterLibraryOverlay({
  onConfirm, onClose, mapName, mapsFolder,
  accentColor = '#ffffff',
  accentGlow  = 'rgba(255,255,255,0.2)',
}) {
  const [gameEmitters,   setGameEmitters]   = useState([]);
  const [customEmitters, setCustomEmitters] = useState([]);
  const [gameLoading,    setGameLoading]    = useState(false);
  const [customLoading,  setCustomLoading]  = useState(false);
  // '__all__' | '__custom__' | '<tag>'
  const [selectedCategory, setSelectedCategory] = useState('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected,    setSelected]    = useState(new Set());
  const [filterOpen,  setFilterOpen]  = useState(false);
  const [sortKey,     setSortKey]     = useState('name-asc');
  const [soloCategories,   setSoloCategories]   = useState(new Set());
  const [activeCategories, setActiveCategories] = useState(null); // null = all
  const searchRef = useRef(null);

  // Load game library emitters
  useEffect(() => {
    (async () => {
      setGameLoading(true);
      try {
        const data = await window.electronAPI.invoke('library-load');
        if (data?.emitters?.length) setGameEmitters(data.emitters);
      } catch (e) { console.error(e); }
      finally { setGameLoading(false); }
    })();
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  // Scan custom emitters on every mount (= every time the overlay is opened).
  useEffect(() => {
    (async () => {
      setCustomLoading(true);
      try {
        const res = await window.electronAPI.invoke('scan-map-emitters', { mapsFolder, mapName });
        setCustomEmitters(res?.emitters || []);
      } catch (e) { console.error('scan-map-emitters:', e); setCustomEmitters([]); }
      finally { setCustomLoading(false); }
    })();
  }, []); // empty deps → runs once on mount

  const handleReload = async () => {
    setGameLoading(true);
    try {
      await window.electronAPI.invoke('library-scan');
      const data = await window.electronAPI.invoke('library-load');
      if (data?.emitters?.length) setGameEmitters(data.emitters);
    } catch (e) { console.error(e); }
    finally { setGameLoading(false); }
  };

  const handleRescanCustom = async () => {
    setCustomLoading(true);
    try {
      const res = await window.electronAPI.invoke('scan-map-emitters', { mapsFolder, mapName });
      setCustomEmitters(res?.emitters || []);
    } catch (e) { console.error(e); }
    finally { setCustomLoading(false); }
  };

  const allEmitters = useMemo(() => [...gameEmitters, ...customEmitters], [gameEmitters, customEmitters]);

  // Category list from game emitter tags
  const categoryList = useMemo(() => {
    const cats = new Set();
    for (const e of gameEmitters) {
      if (e.tags) e.tags.forEach(t => { if (t !== 'custom' && t !== 'misc') cats.add(t); });
    }
    return [...cats].sort();
  }, [gameEmitters]);

  // Custom emitter categories — use mapName as the display label for map-custom source.
  // If an emitter's category matches the raw mapName (possibly with version suffix),
  // we substitute cleanMapName(mapName) so "MyMap.v0001" shows as "MyMap".
  const customCategoryList = useMemo(() => {
    const cats = new Set(customEmitters.map(e => {
      const raw = e.category || 'misc';
      // Normalise: if the category IS the map folder name, strip the version suffix
      if (mapName && raw === mapName) return cleanMapName(mapName);
      return raw;
    }));
    return [...cats].sort();
  }, [customEmitters, mapName]);

  // Filtering
  const baseEmitters = useMemo(() => {
    let list;
    if (selectedCategory === '__all__')         { list = allEmitters; }
    else if (selectedCategory === '__custom__') { list = customEmitters; }
    else { list = gameEmitters.filter(e => e.tags?.includes(selectedCategory)); }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.id?.toLowerCase().includes(q) ||
        e.gamePath?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allEmitters, gameEmitters, customEmitters, selectedCategory, searchQuery]);

  const visibleEmitters = useMemo(() => sortEmitters(baseEmitters, sortKey), [baseEmitters, sortKey]);

  // Grouped by category for display.
  const groupedByCategory = useMemo(() => {
    if (selectedCategory !== '__all__' && selectedCategory !== '__custom__') {
      // Single game tag — flat list under that tag name
      return [[selectedCategory, visibleEmitters]];
    }

    if (selectedCategory === '__all__') {
      // Group game emitters by their first tag; custom emitters each get their own bucket.
      // Map-custom → bucket key = cleanMapName(mapName) || 'map'
      // Toolkit    → bucket key = their category || 'toolkit'
      // Game       → bucket key = first non-misc/non-custom tag || 'misc'
      const buckets = {};
      const push = (key, e) => {
        if (!buckets[key]) buckets[key] = [];
        if (!buckets[key].find(x => x.id === e.id)) buckets[key].push(e);
      };
      for (const e of visibleEmitters) {
        if (e.source === 'map-custom') {
          push(cleanMapName(mapName) || 'map', e);
        } else if (e.source === 'toolkit') {
          push(e.category || 'toolkit', e);
        } else {
          const tag = e.tags?.find(t => t !== 'custom' && t !== 'misc') || 'misc';
          push(tag, e);
        }
      }
      return Object.entries(buckets).sort(([a],[b]) => a.localeCompare(b));
    }

    // __custom__ view: toolkit emitters grouped by their category,
    // map-custom emitters grouped under cleanMapName(mapName)
    const buckets = {};
    const push = (key, e) => {
      if (!buckets[key]) buckets[key] = [];
      if (!buckets[key].find(x => x.id === e.id)) buckets[key].push(e);
    };
    for (const e of visibleEmitters) {
      if (e.source === 'map-custom') {
        push(cleanMapName(mapName) || 'map', e);
      } else {
        push(e.category || 'toolkit', e);
      }
    }
    let entries = Object.entries(buckets).sort(([a],[b]) => a.localeCompare(b));
    if (soloCategories.size > 0)       entries = entries.filter(([c]) => soloCategories.has(c));
    else if (activeCategories !== null) entries = entries.filter(([c]) => activeCategories.has(c));
    return entries;
  }, [visibleEmitters, selectedCategory, soloCategories, activeCategories, mapName]);

  const availableCats = selectedCategory === '__custom__' ? customCategoryList : categoryList;

  const toggleActiveCategory = (cat) => {
    setSoloCategories(new Set());
    setActiveCategories(prev => {
      const cur = prev ?? new Set(availableCats);
      const next = new Set(cur);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next.size === availableCats.length ? null : next;
    });
  };
  const toggleSoloCategory = (cat) => setSoloCategories(prev => {
    const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n;
  });

  const filtersActive = sortKey !== 'name-asc' || activeCategories !== null || soloCategories.size > 0;
  const resetFilters = () => { setSortKey('name-asc'); setActiveCategories(null); setSoloCategories(new Set()); };

  const toggleEmitter = useCallback((id) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  }), []);

  const selectAll = () => setSelected(prev => { const n = new Set(prev); visibleEmitters.forEach(e => n.add(e.id)); return n; });
  const clearAll  = () => setSelected(new Set());

  const handleConfirm = () => {
    const sel = allEmitters.filter(e => selected.has(e.id));
    if (sel.length > 0) onConfirm(sel);
    onClose();
  };

  const isCustomView = selectedCategory === '__custom__';
  const headerColor = isCustomView ? '#f0a040' : accentColor;
  const headerGlow  = isCustomView ? 'rgba(240,160,64,0.3)' : accentGlow;

  const activeLabel = selectedCategory === '__all__'
    ? 'All Emitters'
    : selectedCategory === '__custom__'
      ? `Custom — ${cleanMapName(mapName) || 'no map'}`
      : selectedCategory;

  return (
    <>
      <div className="el-backdrop" onClick={onClose} />
      <div className="el-window">

        {/* ── Sidebar ── */}
        <div className="el-sidebar">
          <div className="el-sidebar-header">
            <span className="el-sidebar-title">Emitter Library</span>
          </div>

          <div className="el-category-list">
            {/* All */}
            <button
              className={`el-cat-item ${selectedCategory === '__all__' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('__all__')}
              style={{'--bc': accentColor, '--bg': accentGlow}}>
              <div className="el-cat-info">
                <span className="el-cat-name">ALL</span>
                <span className="el-cat-count">{allEmitters.length}</span>
              </div>
              {selectedCategory === '__all__' && <div className="el-active-dot" />}
            </button>

            {/* Custom — always orange, independent of tab */}
            <button
              className={`el-cat-item el-custom-item ${selectedCategory === '__custom__' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('__custom__')}
              style={{'--bc': '#f0a040', '--bg': 'rgba(240,160,64,0.08)'}}>
              <svg className="el-custom-folder-icon" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 2.5C1 1.67 1.67 1 2.5 1H6l1.5 2H13.5C14.33 3 15 3.67 15 4.5V10.5C15 11.33 14.33 12 13.5 12H2.5C1.67 12 1 11.33 1 10.5V2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              <div className="el-cat-info">
                <span className="el-cat-name">CUSTOM</span>
                <span className="el-cat-count">{customLoading ? '…' : customEmitters.length}</span>
              </div>
              {selectedCategory === '__custom__' && <div className="el-active-dot" />}
            </button>

            <div className="el-sep" />

            {/* Game tag categories */}
            {categoryList.map(cat => {
              const count = gameEmitters.filter(e => e.tags?.includes(cat)).length;
              const isActive = selectedCategory === cat;
              return (
                <button key={cat}
                  className={`el-cat-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{'--bc': accentColor, '--bg': accentGlow}}>
                  <div className="el-cat-info">
                    <span className="el-cat-name">{cat.toUpperCase()}</span>
                    <span className="el-cat-count">{count}</span>
                  </div>
                  {isActive && <div className="el-active-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main ── */}
        <div className="el-main">

          {/* Header */}
          <div className="el-header" style={{'--bc': headerColor, '--bg': headerGlow}}>
            <div className="el-header-badge">
              <span className="el-header-name">{activeLabel}</span>
            </div>
            <div className="el-header-right">
              {isCustomView ? (
                <button className="el-reload-btn" onClick={handleRescanCustom} disabled={customLoading}>
                  {customLoading ? '⟳ Scanning…' : '↺ Rescan'}
                </button>
              ) : (
                <button className="el-reload-btn" onClick={handleReload} disabled={gameLoading}>
                  {gameLoading ? '⟳ Scanning…' : '↺ Rescan'}
                </button>
              )}
              <button className="el-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="el-toolbar">
            <div className="el-toolbar-search-row">
              <div className="el-search-wrap">
                <span className="el-search-icon">⌕</span>
                <input ref={searchRef} className="el-search" type="text"
                  placeholder="Search emitters…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button className="el-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
              </div>
            </div>
            <div className="el-toolbar-filter-row">
              <button
                className={`el-filter-toggle-btn ${filterOpen ? 'active' : ''} ${filtersActive ? 'has-active' : ''}`}
                onClick={() => setFilterOpen(o => !o)}>
                Filter{filtersActive && <span className="el-filter-dot" />}
              </button>
            </div>

            {filterOpen && (
              <div className="el-filter-panel">
                <div className="el-fp-section">
                  <div className="el-fp-label">Sort</div>
                  <div className="el-fp-sort-row">
                    {SORT_OPTIONS.map(o => (
                      <button key={o.value}
                        className={`el-fp-sort-btn ${sortKey === o.value ? 'active' : ''}`}
                        onClick={() => setSortKey(o.value)}>{o.label}</button>
                    ))}
                  </div>
                </div>
                {availableCats.length > 1 && (
                  <>
                    <div className="el-fp-divider" />
                    <div className="el-fp-section">
                      <div className="el-fp-label">Categories — click to toggle off</div>
                      <div className="el-fp-type-row">
                        {availableCats.map(cat => {
                          const on = activeCategories === null || activeCategories.has(cat);
                          return (
                            <button key={cat}
                              className={`el-fp-type-btn ${on ? 'on' : 'off'}`}
                              onClick={() => toggleActiveCategory(cat)}>{cat}</button>
                          );
                        })}
                      </div>
                      <div className="el-fp-label" style={{marginTop: 10}}>Solo — select one or more</div>
                      <div className="el-fp-type-row">
                        {availableCats.map(cat => (
                          <button key={cat}
                            className={`el-fp-type-btn ${soloCategories.has(cat) ? 'solo' : 'off'}`}
                            onClick={() => toggleSoloCategory(cat)}>{cat}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="el-fp-divider" />
                <div className="el-fp-section el-fp-row-section">
                  <span className="el-fp-result-count">{visibleEmitters.length} emitters visible</span>
                  {filtersActive && <button className="el-fp-reset-btn" onClick={resetFilters}>✕ Reset</button>}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="el-content">
            {(gameLoading || customLoading) && visibleEmitters.length === 0 ? (
              <div className="el-empty">
                <div className="el-empty-icon">⟳</div>
                <p>Loading…</p>
              </div>
            ) : isCustomView && customEmitters.length === 0 && !customLoading ? (
              <div className="el-empty">
                <div className="el-empty-icon" style={{animation:'none'}}>📁</div>
                <p>No custom emitters found.</p>
                <p style={{fontSize:'0.82rem', opacity:0.6}}>
                  Add <code>*.bp</code> files to <code>public/emitter/&lt;Category&gt;/</code>
                  {(!mapName || !mapsFolder) && <><br />or set Map Name + Folder to scan map emitters.</>}
                </p>
              </div>
            ) : visibleEmitters.length === 0 ? (
              <div className="el-empty">
                <div className="el-empty-icon" style={{animation:'none'}}></div>
                <p>No emitters match.</p>
              </div>
            ) : (
              <div className="el-view">
                {groupedByCategory.map(([cat, emitters]) => {
                  const isCustomSection = isCustomView ||
                    emitters.every(e => e.source === 'map-custom' || e.source === 'toolkit');
                  return (
                    <EmitterSection key={cat} category={cat} emitters={emitters}
                      selected={selected} onToggle={toggleEmitter}
                      accentColor={accentColor} accentGlow={accentGlow}
                      isCustomSection={isCustomSection} />
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="el-footer">
            <div className="el-footer-left">
              <button className="el-footer-btn" onClick={selectAll} disabled={visibleEmitters.length === 0}>
                Select All ({visibleEmitters.length})
              </button>
              <button className="el-footer-btn" onClick={clearAll} disabled={selected.size === 0}>Clear</button>
              {selected.size > 0 && <span className="el-footer-count">{selected.size} selected</span>}
            </div>
            <div className="el-footer-right">
              <button className="el-footer-cancel" onClick={onClose}>Cancel</button>
              <button className="el-footer-confirm" onClick={handleConfirm} disabled={selected.size === 0}>
                Apply {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── EmitterSection ────────────────────────────────────────────────────────────
function EmitterSection({ category, emitters, selected, onToggle, accentColor, accentGlow, isCustomSection }) {
  const [collapsed, setCollapsed] = useState(false);
  const selectedCount = emitters.filter(e => selected.has(e.id)).length;
  // Custom sections use orange, others use the tab accent
  const sectionColor = isCustomSection ? '#f0a040' : accentColor;
  const sectionGlow  = isCustomSection ? 'rgba(240,160,64,0.3)' : accentGlow;
  return (
    <div className="el-section">
      <button className="el-section-header" onClick={() => setCollapsed(v => !v)}>
        <div className="el-section-left">
          <span className="el-section-label">{category.toUpperCase()}</span>
          {selectedCount > 0 && <span className="el-section-badge">{selectedCount}</span>}
        </div>
        <div className="el-section-meta">
          <span className="el-section-count">{emitters.length}</span>
          <span className={`el-section-toggle ${collapsed ? 'collapsed' : ''}`}>▾</span>
        </div>
      </button>
      {!collapsed && (
        <div className="el-emitter-list">
          {emitters.map((emitter, idx) => (
            <EmitterCard key={`${emitter.id}-${idx}`} emitter={emitter}
              isSelected={selected.has(emitter.id)} onToggle={onToggle}
              accentColor={sectionColor} accentGlow={sectionGlow} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── EmitterCard ───────────────────────────────────────────────────────────────
function EmitterCard({ emitter, isSelected, onToggle, accentColor, accentGlow }) {
  const isMapCustom = emitter.source === 'map-custom';
  const isToolkit   = emitter.source === 'toolkit';
  const isCustom    = isMapCustom || isToolkit;
  const hg = accentColor ? `${accentColor}14` : 'rgba(255,255,255,0.06)';
  return (
    <div
      className={`el-emitter-card ${isSelected ? 'selected' : ''} ${isCustom ? 'is-custom' : ''}`}
      onClick={() => onToggle(emitter.id)}
      title={emitter.gamePath || emitter.id}
      style={{'--hc': accentColor, '--hg': hg}}>
      <div className={`el-emitter-check ${isSelected ? 'checked' : ''}`}>
        {isSelected && <span>✓</span>}
      </div>
      <div className="el-emitter-info">
        <div className="el-emitter-name">{emitter.name || emitter.id}</div>
        <div className="el-emitter-path">{emitter.gamePath || emitter.id}</div>
        {isMapCustom && (
          <span className="el-custom-tag" style={{color: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)`, borderColor: `color-mix(in srgb, ${accentColor} 25%, transparent)`}}>map</span>
        )}
        {isToolkit && (
          <span className="el-custom-tag el-custom-tag--toolkit">toolkit</span>
        )}
      </div>
    </div>
  );
}
