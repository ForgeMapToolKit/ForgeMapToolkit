import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './PropsLibrary.css';
import buildtimeIcon from '../../../../../public/assets/icons/Library/time.js';
import TextureEditor from '../../../Tabs/Scenery/CustomProps/TextureEditor/TextureEditor';


// ── DDS preview cache + hook (mirrors CustomPropsTab) ────────────────────────
const _ddsCache = {};
function useDdsPreview(previewUrl) {
  const [resolvedSrc, setResolvedSrc] = useState(previewUrl || null);
  useEffect(() => {
    if (!previewUrl) { setResolvedSrc(null); return; }
    if (!previewUrl.toLowerCase().endsWith('.dds')) { setResolvedSrc(previewUrl); return; }
    if (_ddsCache[previewUrl]) { setResolvedSrc(_ddsCache[previewUrl]); return; }
    setResolvedSrc(null);
    const filePath = previewUrl.replace(/^file:\/+/, '').replace(/\//g, '\\');
    window.electronAPI.invoke('dds-to-dataurl', { filePath })
      .then(result => {
        const src = result?.success ? result.dataUrl : null;
        _ddsCache[previewUrl] = src;
        setResolvedSrc(src);
      })
      .catch(() => setResolvedSrc(null));
  }, [previewUrl]);
  return resolvedSrc;
}

const TYPE_ICON = {
  trees:      '',
  rocks:      '',
  vegetation: '',
  structures: '',
  wreckages:  '',
  markers:    '',
};
function getTypeIcon(t) { return TYPE_ICON[t?.toLowerCase()] || '◈'; }

function strColor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return { color: `hsl(${h},52%,62%)`, glow: `hsla(${h},52%,62%,0.45)`, bg: `hsla(${h},52%,62%,0.08)` };
}

const SORT_OPTIONS = [
  { value: 'name-asc',    label: 'Name A→Z' },
  { value: 'name-desc',   label: 'Name Z→A' },
  { value: 'mass-asc',    label: 'Mass ↑' },
  { value: 'mass-desc',   label: 'Mass ↓' },
  { value: 'energy-asc',  label: 'Energy ↑' },
  { value: 'energy-desc', label: 'Energy ↓' },
  { value: 'time-asc',    label: 'Time ↑' },
  { value: 'time-desc',   label: 'Time ↓' },
];

function sortProps(list, sortKey) {
  const s = [...list];
  switch (sortKey) {
    case 'name-asc':    return s.sort((a,b) => (a.name||a.id).localeCompare(b.name||b.id,undefined,{sensitivity:'base'}));
    case 'name-desc':   return s.sort((a,b) => (b.name||b.id).localeCompare(a.name||a.id,undefined,{sensitivity:'base'}));
    case 'mass-asc':    return s.sort((a,b) => (a.reclaimMass   ??-1)-(b.reclaimMass   ??-1));
    case 'mass-desc':   return s.sort((a,b) => (b.reclaimMass   ??-1)-(a.reclaimMass   ??-1));
    case 'energy-asc':  return s.sort((a,b) => (a.reclaimEnergy ??-1)-(b.reclaimEnergy ??-1));
    case 'energy-desc': return s.sort((a,b) => (b.reclaimEnergy ??-1)-(a.reclaimEnergy ??-1));
    case 'time-asc':    return s.sort((a,b) => (a.reclaimTime   ??-1)-(b.reclaimTime   ??-1));
    case 'time-desc':   return s.sort((a,b) => (b.reclaimTime   ??-1)-(a.reclaimTime   ??-1));
    default:            return s;
  }
}

function RangeSlider({ label, min, max, low, high, onChangeLow, onChangeHigh, disabled }) {
  const pct = v => max === min ? 0 : ((v - min) / (max - min)) * 100;
  return (
    <div className="pl-range-row">
      <div className="pl-range-label">
        <span>{label}</span>
        <span className="pl-range-vals">{disabled ? '—' : `${low} – ${high}`}</span>
      </div>
      <div className={`pl-range-track-wrap ${disabled ? 'disabled' : ''}`}>
        <div className="pl-range-track">
          <div className="pl-range-fill" style={{ left: `${pct(low)}%`, width: `${pct(high)-pct(low)}%` }} />
        </div>
        <input type="range" className="pl-range-thumb pl-range-thumb-low"
          min={min} max={max} value={low} disabled={disabled}
          onChange={e => onChangeLow(Math.min(Number(e.target.value), high))} />
        <input type="range" className="pl-range-thumb pl-range-thumb-high"
          min={min} max={max} value={high} disabled={disabled}
          onChange={e => onChangeHigh(Math.max(Number(e.target.value), low))} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function PropsLibraryOverlay({ onConfirm, onClose, mapName, mapsFolder, noTextureEditor = false, onMountReloadRef,
  accentColor = 'var(--ink-100)',
  accentGlow  = 'var(--ink-20)',
}) {
  const [rawProps, setRawProps]             = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [customProps, setCustomProps]       = useState([]);
  const [customLoading, setCustomLoading]   = useState(false);
  // '__all__' | '__custom__' | '<biome>' | '<biome>/<type>'
  const [selectedCategory, setSelectedCategory] = useState('__all__');

  // Apply defaultBiome from settings on mount
  useEffect(() => {
    window.electronAPI.invoke('settings-load').then(s => {
      if (s?.defaultBiome) setSelectedCategory(s.defaultBiome);
    }).catch(() => {});
  }, []);
  const [expandedBiomes, setExpandedBiomes]     = useState(new Set());
  const [searchQuery, setSearchQuery]   = useState('');
  const [selected, setSelected]         = useState(new Set());
  const searchRef = useRef(null);
  const [showTextureEditor, setShowTextureEditor] = useState(false);
  const [pendingProps, setPendingProps]           = useState([]);

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey,    setSortKey]    = useState('name-asc');
  const [onlyGroups, setOnlyGroups] = useState(false);
  const [massRange,   setMassRange]   = useState([0,100]);
  const [energyRange, setEnergyRange] = useState([0,100]);
  const [timeRange,   setTimeRange]   = useState([0,100]);
  const [massLow,   setMassLow]   = useState(0);
  const [massHigh,  setMassHigh]  = useState(100);
  const [energyLow, setEnergyLow] = useState(0);
  const [energyHigh,setEnergyHigh]= useState(100);
  const [timeLow,   setTimeLow]   = useState(0);
  const [timeHigh,  setTimeHigh]  = useState(100);
  const [activeTypes,    setActiveTypes]    = useState(null);
  const [soloTypes,      setSoloTypes]      = useState(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState(new Set());

  // Load game library
  useEffect(() => {
    (async () => {
      setLibraryLoading(true);
      try {
        const data = await window.electronAPI.invoke('library-load');
        if (data?.props?.length) setRawProps(data.props);
      } catch (e) { console.error(e); }
      finally { setLibraryLoading(false); }
    })();
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  // ── Global props — loaded ONCE on mount, independent of map settings ──────
  const loadGlobalProps = useCallback(async () => {
    setCustomLoading(true);
    try {
      const res = await window.electronAPI.invoke('scan-global-props').catch(e => {
        console.warn('scan-global-props failed:', e); return { props: [] };
      });
      const globalProps = (res?.props || []).map(p => ({
        ...p, source: 'custom-global',
        biome:    p.biome    || 'global',
        propType: p.propType || 'misc',
      }));
      // Merge: keep map props already loaded, add global on top
      setCustomProps(prev => {
        const mapOnly = prev.filter(p => p.source === 'map-custom');
        const seen = new Set(globalProps.map(p => p.id));
        return [...globalProps, ...mapOnly.filter(p => !seen.has(p.id))];
      });
    } catch (e) { console.error('scan-global-props:', e); }
    finally { setCustomLoading(false); }
  }, []);

  // ── Map props — reloaded whenever mapName/mapsFolder change ────────────
  const loadMapProps = useCallback(async (curMapName, curMapsFolder) => {
    if (!curMapName || !curMapsFolder) return;
    try {
      const res = await window.electronAPI.invoke('scan-map-props', { mapsFolder: curMapsFolder, mapName: curMapName })
        .catch(e => { console.warn('scan-map-props failed:', e); return { props: [] }; });
      const mapProps = (res?.props || []).map(p => ({
        ...p, source: 'map-custom',
        biome:    p.biome    || 'map',
        propType: p.propType || 'misc',
      }));
      setCustomProps(prev => {
        const globalOnly = prev.filter(p => p.source === 'custom-global');
        const seen = new Set(globalOnly.map(p => p.id));
        return [...globalOnly, ...mapProps.filter(p => !seen.has(p.id))];
      });
    } catch (e) { console.error('scan-map-props:', e); }
  }, []);

  // Load global on mount (always, regardless of mapName)
  useEffect(() => { loadGlobalProps(); }, [loadGlobalProps]);
  // Load map props whenever settings change
  useEffect(() => { loadMapProps(mapName, mapsFolder); }, [mapName, mapsFolder, loadMapProps]);

  // Called by AddCustomPropOverlay after a successful save — reload global props, don't add to selection
  const handlePropSaved = useCallback(() => {
    loadGlobalProps();
    loadMapProps(mapName, mapsFolder);
  }, [loadGlobalProps, loadMapProps, mapName, mapsFolder]);

  // Expose handlePropSaved via ref so parent component can trigger it from AddCustomPropOverlay's onSaved
  useEffect(() => {
    if (onMountReloadRef) onMountReloadRef.current = handlePropSaved;
  }, [onMountReloadRef, handlePropSaved]);

  const handleRescanCustom = () => { loadGlobalProps(); loadMapProps(mapName, mapsFolder); };

  const handleReload = async () => {
    setLibraryLoading(true);
    try {
      await window.electronAPI.invoke('library-scan');
      const data = await window.electronAPI.invoke('library-load');
      if (data?.props?.length) setRawProps(data.props);
    } catch (e) { console.error(e); }
    finally { setLibraryLoading(false); }
  };

  // allProps = game library + custom
  const allProps = useMemo(() => [...rawProps, ...customProps], [rawProps, customProps]);

  // Compute actual value ranges from loaded props
  useEffect(() => {
    if (allProps.length === 0) return;
    const masses   = allProps.map(p => p.reclaimMass   ?? 0).filter(v => v > 0);
    const energies = allProps.map(p => p.reclaimEnergy ?? 0).filter(v => v > 0);
    const times    = allProps.map(p => p.reclaimTime   ?? 0).filter(v => v > 0);
    if (masses.length)   { const mn = Math.floor(Math.min(...masses)),   mx = Math.ceil(Math.max(...masses));   setMassRange([mn,mx]);   setMassLow(mn);   setMassHigh(mx); }
    if (energies.length) { const mn = Math.floor(Math.min(...energies)), mx = Math.ceil(Math.max(...energies)); setEnergyRange([mn,mx]); setEnergyLow(mn); setEnergyHigh(mx); }
    if (times.length)    { const mn = Math.floor(Math.min(...times)),    mx = Math.ceil(Math.max(...times));    setTimeRange([mn,mx]);   setTimeLow(mn);   setTimeHigh(mx); }
  }, [allProps.length]);

  // Category tree: game props + custom props (custom with biome='global' appear as global/trees etc.)
  const categoryTree = useMemo(() => {
    const tree = {};
    for (const p of rawProps) {
      const cat = p.biome || 'unknown'; const type = p.propType || 'misc';
      if (!tree[cat]) tree[cat] = {};
      tree[cat][type] = (tree[cat][type] || 0) + 1;
    }
    // Include custom/global props in the tree so they appear as global/trees, global/rocks
    for (const p of customProps) {
      const cat = p.biome || 'custom'; const type = p.propType || 'misc';
      if (!tree[cat]) tree[cat] = {};
      tree[cat][type] = (tree[cat][type] || 0) + 1;
    }
    return tree;
  }, [rawProps, customProps]);

  const sortedBiomes = useMemo(() => Object.keys(categoryTree).sort(), [categoryTree]);

  const toggleBiome = (biome) => setExpandedBiomes(prev => {
    const next = new Set(prev); next.has(biome) ? next.delete(biome) : next.add(biome); return next;
  });

  // Types in current selection (for filter panel)
  const availableTypes = useMemo(() => {
    let base;
    if (selectedCategory === '__all__')    { base = allProps; }
    else if (selectedCategory === '__custom__') { base = customProps; }
    else if (selectedCategory.includes('/')) {
      const [biome, type] = selectedCategory.split('/');
      base = allProps.filter(p => (p.biome||'unknown') === biome && (p.propType||'misc') === type);
    } else {
      base = allProps.filter(p => (p.biome||'unknown') === selectedCategory);
    }
    return [...new Set(base.map(p => p.propType || 'misc'))].sort();
  }, [allProps, rawProps, customProps, selectedCategory]);

  // Filtering pipeline
  const baseProps = useMemo(() => {
    let list;
    if (selectedCategory === '__all__')    { list = allProps; }
    else if (selectedCategory === '__custom__') { list = customProps; }
    else if (selectedCategory.includes('/')) {
      const [biome, type] = selectedCategory.split('/');
      // Search all props (rawProps + customProps) so global/trees works
      list = allProps.filter(p => (p.biome||'unknown') === biome && (p.propType||'misc') === type);
    } else {
      // Search all props so clicking "global" shows all global custom props
      list = allProps.filter(p => (p.biome||'unknown') === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q) || p.gamePath?.toLowerCase().includes(q));
    }
    return list;
  }, [allProps, rawProps, customProps, selectedCategory, searchQuery]);

  const visibleProps = useMemo(() => {
    let list = baseProps;
    if (onlyGroups) list = list.filter(p => p.isGroup);
    if (massLow > massRange[0] || massHigh < massRange[1])
      list = list.filter(p => { const v = p.reclaimMass ?? 0; return v >= massLow && v <= massHigh; });
    if (energyLow > energyRange[0] || energyHigh < energyRange[1])
      list = list.filter(p => { const v = p.reclaimEnergy ?? 0; return v >= energyLow && v <= energyHigh; });
    if (timeLow > timeRange[0] || timeHigh < timeRange[1])
      list = list.filter(p => { const v = p.reclaimTime ?? 0; return v >= timeLow && v <= timeHigh; });
    return sortProps(list, sortKey);
  }, [baseProps, onlyGroups, massLow, massHigh, energyLow, energyHigh, timeLow, timeHigh, massRange, energyRange, timeRange, sortKey]);

  const groupedByType = useMemo(() => {
    // When a sort is active (anything except default name-asc), flatten into a single list
    if (sortKey !== 'name-asc') {
      return [['', visibleProps]];
    }
    const buckets = {};
    for (const p of visibleProps) {
      const t = p.propType || 'misc';
      if (!buckets[t]) buckets[t] = [];
      buckets[t].push(p);
    }
    let entries = Object.entries(buckets).sort(([a],[b]) => {
      if (a==='groups') return -1; if (b==='groups') return 1; return a.localeCompare(b);
    });
    if (!onlyGroups) {
      if (soloTypes.size > 0) entries = entries.filter(([t]) => soloTypes.has(t));
      else if (activeTypes !== null) entries = entries.filter(([t]) => activeTypes.has(t));
    }
    return entries;
  }, [visibleProps, activeTypes, soloTypes, onlyGroups, sortKey]);

  const toggleActiveType = (type) => {
    setSoloTypes(new Set());
    setActiveTypes(prev => {
      const current = prev ?? new Set(availableTypes);
      const next = new Set(current);
      next.has(type) ? next.delete(type) : next.add(type);
      return next.size === availableTypes.length ? null : next;
    });
  };
  const toggleSoloType  = (type) => setSoloTypes(prev => { const n=new Set(prev); n.has(type)?n.delete(type):n.add(type); return n; });
  const collapseAll     = () => setCollapsedTypes(new Set(availableTypes));
  const expandAll       = () => setCollapsedTypes(new Set());

  const resetFilters = () => {
    setSortKey('name-asc'); setOnlyGroups(false);
    setMassLow(massRange[0]); setMassHigh(massRange[1]);
    setEnergyLow(energyRange[0]); setEnergyHigh(energyRange[1]);
    setTimeLow(timeRange[0]); setTimeHigh(timeRange[1]);
    setActiveTypes(null); setSoloTypes(new Set()); setCollapsedTypes(new Set());
  };

  const filtersActive = sortKey !== 'name-asc' || onlyGroups ||
    massLow > massRange[0] || massHigh < massRange[1] ||
    energyLow > energyRange[0] || energyHigh < energyRange[1] ||
    timeLow > timeRange[0] || timeHigh < timeRange[1] ||
    activeTypes !== null || soloTypes.size > 0;

  const toggleProp = useCallback((id) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  }), []);

  const selectAll  = () => setSelected(prev => { const n=new Set(prev); visibleProps.forEach(p=>n.add(p.id)); return n; });
  const clearAll   = () => setSelected(new Set());


const clearPteSession = () => {
  try {
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith('pte:') || k.startsWith('pte-prop:') || k.startsWith('tao:'));
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch {}
};

const handleConfirm = () => {
  const sel = allProps.filter(p => selected.has(p.id));
  if (sel.length === 0) return;
  if (noTextureEditor) {
    onConfirm(sel);
    onClose();
    return;
  }
  clearPteSession();                  // wipe any leftover session from previous selection
  setPendingProps(sel);
  setShowTextureEditor(true);
};

const handleTextureEditorConfirm = (propsWithAdj) => {
  clearPteSession();
  onConfirm(propsWithAdj);
  onClose();
};

const handleTextureEditorBack = () => {
  clearPteSession();                  // back to library = new selection cycle starts fresh
  setShowTextureEditor(false);
};

  const activeColor = useMemo(() => {
    if (selectedCategory === '__custom__') return { color: 'var(--source-custom-color)', glow: 'var(--source-custom-glow)' };
    return { color: accentColor, glow: accentGlow };
  }, [selectedCategory, accentColor, accentGlow]);

  const activeLabel = selectedCategory === '__all__' ? 'All Props'
    : selectedCategory === '__custom__' ? 'Custom'
    : selectedCategory.includes('/') ? selectedCategory.split('/').join(' / ')
    : selectedCategory;

  const isCustomView = selectedCategory === '__custom__';

return (
  <>
    {showTextureEditor && (
      <PropTextureEditor
        selectedProps={pendingProps}
        onConfirm={handleTextureEditorConfirm}
        onBack={handleTextureEditorBack}
        onClose={onClose}
      />
    )}
{!showTextureEditor && (
  <>
      <div className="pl-backdrop" onClick={onClose} />
      <div className="pl-window" data-suite-overlay style={{'--tab-color': accentColor, '--tab-glow': accentGlow}}>

        {/* ── Sidebar ── */}
        <div className="pl-sidebar">
          <div className="pl-sidebar-header">
            <span className="pl-sidebar-title">Props Library</span>
          </div>
          <div className="pl-biome-list">
            {/* All */}
            <button className={`pl-biome-item ${selectedCategory==='__all__'?'active':''}`}
              onClick={() => setSelectedCategory('__all__')}
              style={{'--bc': accentColor, '--bg': accentGlow, '--bs': accentGlow}}>
              <div className="pl-biome-info">
                <span className="pl-biome-name">ALL</span>
                <span className="pl-biome-count">{allProps.length}</span>
              </div>
            </button>

            {/* Custom Map Props */}
            <button className={`pl-biome-item pl-custom-item ${selectedCategory==='__custom__'?'active':''}`}
              onClick={() => setSelectedCategory('__custom__')}
              style={{
                '--bc': 'var(--source-custom-color)',
                '--bg': 'color-mix(in srgb, var(--source-custom-color) 8%, transparent)',
                '--bs': 'color-mix(in srgb, var(--source-custom-color) 4%, transparent)',
              }}>
              <svg className="pl-custom-folder-icon" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 2.5C1 1.67 1.67 1 2.5 1H6l1.5 2H13.5C14.33 3 15 3.67 15 4.5V10.5C15 11.33 14.33 12 13.5 12H2.5C1.67 12 1 11.33 1 10.5V2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              <div className="pl-biome-info">
                <span className="pl-biome-name">CUSTOM</span>
                <span className="pl-biome-count">{customLoading ? '…' : customProps.length}</span>
              </div>
            </button>

            <div className="pl-sep" />

            {/* Biome tree */}
            {sortedBiomes.map(biome => {
              const types = categoryTree[biome];
              const biomeTotal = Object.values(types).reduce((s,n) => s+n, 0);
              const isExpanded = expandedBiomes.has(biome);
              const isBiomeActive = selectedCategory===biome || selectedCategory.startsWith(biome+'/');
              return (
                <div key={biome} className="pl-biome-group">
                  <div className="pl-biome-row">
                    <button className={`pl-biome-item pl-biome-main ${isBiomeActive?'active':''}`}
                      onClick={() => setSelectedCategory(biome)}
                      style={{'--bc': accentColor, '--bg': accentGlow, '--bs': accentGlow}}>
                      <div className="pl-biome-info">
                        <span className="pl-biome-name">{biome.toUpperCase()}</span>
                        <span className="pl-biome-count">{biomeTotal}</span>
                      </div>
                    </button>
                    <button className={`pl-expand-btn ${isExpanded ? 'open' : ''}`}
                      onClick={() => toggleBiome(biome)}
                      style={{'--bc': accentColor, '--bg': accentGlow}}>
                      <svg className="pl-expand-chevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  {isExpanded && Object.keys(types).sort().map(type => {
                    const key = `${biome}/${type}`;
                    const isTypeActive = selectedCategory===key;
                    return (
                      <button key={key} className={`pl-biome-item pl-biome-sub ${isTypeActive?'active':''}`}
                        onClick={() => setSelectedCategory(key)}
                        style={{'--bc': accentColor, '--bg': accentGlow, '--bs': accentGlow}}>
                        <div className="pl-biome-info">
                          <span className="pl-biome-name">{type.toUpperCase()}</span>
                          <span className="pl-biome-count">{types[type]}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main ── */}
        <div className="pl-main">
          <div className="pl-header" style={{'--bc':activeColor.color,'--bg':activeColor.glow}}>
            <span className="pl-header-name">{activeLabel}</span>
            <div className="pl-header-right">
              {isCustomView ? (
                <button className="pl-reload-btn" onClick={handleRescanCustom} disabled={customLoading}>
                  {customLoading ? '⟳ Scanning…' : '↺ Rescan'}
                </button>
              ) : (
                <button className="pl-reload-btn" onClick={handleReload} disabled={libraryLoading}>
                  {libraryLoading ? '⟳ Scanning…' : '↺ Rescan'}
                </button>
              )}
              <button className="pl-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="pl-toolbar">
            <div className="pl-toolbar-row">
              <div className="pl-search-wrap">
                <span className="pl-search-icon">⌕</span>
                <input ref={searchRef} className="pl-search" type="text"
                  placeholder="Search by name, ID or path…"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button className="pl-search-clear" onClick={() => setSearchQuery('')}>✕</button>}
              </div>
              <button className={`pl-filter-toggle-btn ${filterOpen?'active':''} ${filtersActive?'has-active':''}`}
                onClick={() => setFilterOpen(o => !o)}>
                Filter
              </button>
            </div>

            {/* Filter Panel */}
            {filterOpen && (
              <div className="pl-filter-panel">
                <div className="pl-fp-section">
                  <div className="pl-fp-label">Sort</div>
                  <div className="pl-fp-sort-row">
                    {SORT_OPTIONS.map(o => (
                      <button key={o.value} className={`pl-fp-sort-btn ${sortKey===o.value?'active':''}`}
                        onClick={() => setSortKey(o.value)}>{o.label}</button>
                    ))}
                  </div>
                </div>
                <div className="pl-fp-divider" />
                <div className="pl-fp-section">
                  <div className="pl-fp-label">Value Ranges</div>
                  <div className="pl-fp-ranges-wrap">
                    <RangeSlider label="Mass"   min={massRange[0]}   max={massRange[1]}   low={massLow}   high={massHigh}   onChangeLow={setMassLow}   onChangeHigh={setMassHigh}   disabled={massRange[0]===massRange[1]} />
                    <RangeSlider label="Energy" min={energyRange[0]} max={energyRange[1]} low={energyLow} high={energyHigh} onChangeLow={setEnergyLow} onChangeHigh={setEnergyHigh} disabled={energyRange[0]===energyRange[1]} />
                    <RangeSlider label="Time"   min={timeRange[0]}   max={timeRange[1]}   low={timeLow}   high={timeHigh}   onChangeLow={setTimeLow}   onChangeHigh={setTimeHigh}   disabled={timeRange[0]===timeRange[1]} />
                  </div>
                </div>
                <div className="pl-fp-divider" />
                <div className="pl-fp-section pl-fp-row-section">
                  <label className="pl-fp-checkbox" onClick={() => setOnlyGroups(o => !o)}>
                    <span className={`pl-fp-check-box ${onlyGroups?'checked':''}`}>{onlyGroups?'✓':''}</span>
                    <span>Show only Groups</span>
                  </label>
                  <div className="pl-fp-collapse-btns">
                    <button className="pl-fp-sm-btn" onClick={expandAll}>Expand all</button>
                    <button className="pl-fp-sm-btn" onClick={collapseAll}>Collapse all</button>
                  </div>
                </div>
                <div className="pl-fp-divider" />
                <div className="pl-fp-section">
                  <div className="pl-fp-label">Categories — click to toggle off</div>
                  <div className="pl-fp-type-row">
                    {availableTypes.map(type => {
                      const on = activeTypes===null || activeTypes.has(type);
                      return <button key={type} className={`pl-fp-type-btn ${on?'on':'off'}`} onClick={() => toggleActiveType(type)}>{type}</button>;
                    })}
                  </div>
                  <div className="pl-fp-label" style={{marginTop:10}}>Solo — select one or more to show only those</div>
                  <div className="pl-fp-type-row">
                    {availableTypes.map(type => (
                      <button key={type} className={`pl-fp-type-btn ${soloTypes.has(type)?'solo':'off'}`} onClick={() => toggleSoloType(type)}>{type}</button>
                    ))}
                  </div>
                </div>
                <div className="pl-fp-divider" />
                <div className="pl-fp-section pl-fp-row-section">
                  <span className="pl-fp-result-count">{visibleProps.length} props visible</span>
                  {filtersActive && <button className="pl-fp-reset-btn" onClick={resetFilters}>✕ Reset all filters</button>}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="pl-content">
            {(libraryLoading || customLoading) && visibleProps.length === 0 ? (
              <div className="pl-empty"><div className="pl-empty-icon">⟳</div><p>Loading…</p></div>
            ) : isCustomView && customProps.length === 0 && !customLoading ? (
              <div className="pl-empty">
                <div className="pl-empty-icon" style={{animation:'none'}}>📁</div>
                <p>Keine Custom Props gefunden.<br />Nutze <strong>Add Custom Prop</strong> um Props global zu speichern,<br />oder lege <code>.bp</code>-Dateien in <code>env/props/</code> im Map-Ordner ab.</p>
              </div>
            ) : !isCustomView && rawProps.length === 0 ? (
              <div className="pl-empty">
                <div className="pl-empty-icon" style={{animation:'none'}}>◈</div>
                <p>No props found.<br />Click <strong>↺ Rescan</strong> to scan your game files.</p>
              </div>
            ) : visibleProps.length === 0 ? (
              <div className="pl-empty">
                <div className="pl-empty-icon" style={{animation:'none'}}>◈</div>
                <p>No props match.</p>
              </div>
            ) : (
              <div className="pl-view">
                {groupedByType.map(([type, props]) => (
                  <TypeSection key={type} type={type} props={props}
                    selected={selected} onToggle={toggleProp}
                    showCategory={searchQuery.trim()!=='' || !selectedCategory.includes('/')}
                    collapsed={collapsedTypes.has(type)}
                    onToggleCollapse={() => setCollapsedTypes(prev => {
                      const next = new Set(prev); next.has(type)?next.delete(type):next.add(type); return next;
                    })} />
                ))}
              </div>
            )}
          </div>

          <div className="pl-footer">
            <div className="pl-footer-left">
              <button className="pl-footer-btn" onClick={selectAll} disabled={visibleProps.length===0}>
                Select All ({visibleProps.length})
              </button>
              <button className="pl-footer-btn" onClick={clearAll} disabled={selected.size===0}>Clear</button>
              {selected.size > 0 && <span className="pl-footer-count">{selected.size} selected</span>}
            </div>
            <div className="pl-footer-right">
              <button className="pl-footer-cancel" onClick={onClose}>Cancel</button>
              <button className="pl-footer-confirm" onClick={handleConfirm} disabled={selected.size===0}>
                Apply {selected.size > 0 ? `(${selected.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>    
    )}         
  </>
  );
}

function TypeSection({ type, props, selected, onToggle, showCategory, collapsed, onToggleCollapse }) {
  const selectedCount = props.filter(p => selected.has(p.id)).length;
  const showHeader = type !== '';
  return (
    <div className="pl-type-section">
      {showHeader && (
        <button className="pl-type-header" onClick={onToggleCollapse}>
          <div className="pl-type-header-left">
            <span className="pl-type-icon">{getTypeIcon(type)}</span>
            <span className="pl-type-label">{type.charAt(0).toUpperCase()+type.slice(1)}</span>
            {selectedCount > 0 && <span className="pl-type-selected-badge">{selectedCount}</span>}
          </div>
          <div className="pl-type-meta">
            <span className="pl-type-count">{props.length}</span>
          </div>
        </button>
      )}
      {(!showHeader || !collapsed) && (
        <div className="pl-props-grid">
          {props.map((prop, idx) => (
            <PropCard key={`${prop.id}-${idx}`} prop={prop}
              isSelected={selected.has(prop.id)} onToggle={onToggle} showCategory={showCategory} />
          ))}
        </div>
      )}
    </div>
  );
}

function PropCard({ prop, isSelected, onToggle, showCategory }) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedSrc = useDdsPreview(imgFailed ? null : prop.previewUrl);
  const hasMass   = prop.reclaimMass   != null && prop.reclaimMass   !== 0;
  const hasEnergy = prop.reclaimEnergy != null && prop.reclaimEnergy !== 0;
  const hasTime   = prop.reclaimTime   != null && prop.reclaimTime   !== 0;
  const isCustom  = prop.source === 'map-custom' || prop.source === 'custom-global';

  return (
    <div className={`pl-prop-card ${isSelected?'selected':''} ${prop.isGroup?'is-group':''} ${isCustom?'is-custom':''}`}
      onClick={() => onToggle(prop.id)}
      title={`${prop.name}\n${prop.gamePath||prop.id}`}>
      {prop.isGroup && <span className="pl-group-badge">Group</span>}
      {isCustom     && <span className="pl-custom-badge">Custom</span>}
      <div className={`pl-prop-check ${isSelected?'checked':''}`}>
        {isSelected && <span>✓</span>}
      </div>
      <div className="pl-prop-preview">
        {resolvedSrc
          ? <img src={resolvedSrc} alt={prop.name} onError={() => setImgFailed(true)} />
          : <div className="pl-prop-preview-fallback"><span>{getTypeIcon(prop.propType)}</span></div>
        }
      </div>
      <div className="pl-prop-info">
        <div className="pl-prop-name">{prop.name||prop.id}</div>
        <div className="pl-prop-path">{prop.gamePath||prop.id}</div>
        <div className="pl-prop-economy">
          <span className="pl-econ-col" title="Mass">
            <span className="pl-econ-icon"><img src="assets/icons/Library/mass.png" className="pl-econ-img-mass" alt="Mass" /></span>
            <span className={`pl-econ-val pl-econ-mass-val ${!hasMass?'pl-econ-empty':''}`}>{hasMass ? prop.reclaimMass : '—'}</span>
          </span>
          <span className="pl-econ-divider" />
          <span className="pl-econ-col" title="Energy">
            <span className="pl-econ-icon"><img src="assets/icons/Library/energy.png" className="pl-econ-img-energy" alt="Energy" /></span>
            <span className={`pl-econ-val pl-econ-energy-val ${!hasEnergy?'pl-econ-empty':''}`}>{hasEnergy ? prop.reclaimEnergy : '—'}</span>
          </span>
          <span className="pl-econ-divider" />
          <span className="pl-econ-col" title="Time">
            <span className="pl-econ-icon">
              <svg viewBox={buildtimeIcon.viewBox} fill={buildtimeIcon.fill}
                className="pl-econ-img-time" style={{display:'block'}}
                dangerouslySetInnerHTML={{__html: buildtimeIcon.content}} />
            </span>
            <span className={`pl-econ-val pl-econ-time-val ${!hasTime?'pl-econ-empty':''}`}>{hasTime ? prop.reclaimTime : '—'}</span>
          </span>
        </div>
        {showCategory && prop.biome && (
          <div className="pl-prop-biome-tag" style={{color:'var(--tab-color, var(--ink-50))'}}>
            {prop.biome}{prop.propType ? ` / ${prop.propType}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
