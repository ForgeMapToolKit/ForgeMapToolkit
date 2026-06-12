import React from "react";

// ── WreckageHelpModal ─────────────────────────────────────────────────────────

const RotationSlideshow =({ label, images, captions }) => {
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), 2500);
    return () => clearInterval(t);
  }, [images.length]);

  const src = `./assets/help/${images[idx]}.png`;

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem', color: '#fff' }}>{label}</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          {images.map((_, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'background 0.2s' }} />
          ))}
        </div>
      </div>
      <img
        src={src}
        alt={captions[images[idx]]}
        style={{ width: '100%', display: 'block', aspectRatio: '4/3', objectFit: 'cover' }}
      />
      <div style={{ padding: '8px 14px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', minHeight: '32px' }}>
        {captions[images[idx]]}
      </div>
    </div>
  );
};

function WreckageHelpModal({ onClose, activeHelpTab, setActiveHelpTab, helpGuideSelected, setHelpGuideSelected, activeAdvancedSubTab, setActiveAdvancedSubTab }) {
  return (
<>
  <div 
    className="help-modal-overlay"
    onClick={() => onClose()}
  />

  <div className="help-modal" style={{ '--tab-color': 'var(--wreckages-color)', '--tab-glow': 'var(--wreckages-glow)', '--tab-glow-strong': 'var(--wreckages-glow-strong)' }} onClick={(e) => e.stopPropagation()}>
    <div className="help-modal-header">
      <h2 className="help-modal-title">Wreckage Generator — Help Guide</h2>
      <button
    className="help-modal-close"
    onClick={() => onClose()}
  >×</button>
    </div>

    <div className="help-modal-tabs">
      <button
        className={`help-modal-tab ${activeHelpTab === 'help-guide' ? 'active' : ''}`}
        onClick={() => { setActiveHelpTab('help-guide'); setHelpGuideSelected(null); }}
      >
        Help Guide
      </button>
      <button
        className={`help-modal-tab ${activeHelpTab === 'advanced' ? 'active' : ''}`}
        onClick={() => setActiveHelpTab('advanced')}
      >
        Advanced Guide
      </button>
    </div>

                <div className="help-modal-content">

{/* ═══════════════════════════════════════════════════════════
    HELP GUIDE TAB — 1:1 UI replica with click explanations
    ═══════════════════════════════════════════════════════════ */}
{activeHelpTab === 'help-guide' && (
  <div style={{ display: 'flex', gap: '40px', height: '100%' }}>

    <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>

<div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem' }}>↗</span> Click any element to learn about it
</div>

<div className="tab-grid" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 'none', margin: 0 }}>

{/* ═══ CONFIG COLUMN ═══ */}
<div className="tab-col-config">

  {/* CONFIGURATION card */}
  <div className="section-card" style={{ marginBottom: '16px' }}>
    <h2 className="section-title">CONFIGURATION</h2>

    <div className="form-group" onClick={() => setHelpGuideSelected('mapname')} style={{ cursor: 'pointer' }}>
      <label className="form-label">Map Name</label>
      <input readOnly onChange={() => {}} className="form-input" value="" placeholder="e.g. Hades_Dust.v0002"
        style={{ outline: helpGuideSelected === 'mapname' ? '2px solid rgba(255,255,255,0.7)' : 'none' }} />
    </div>

    <div className="form-group" onClick={() => setHelpGuideSelected('mapsize')} style={{ cursor: 'pointer', outline: helpGuideSelected === 'mapsize' ? '2px solid rgba(255,255,255,0.7)' : 'none', padding: '4px', borderRadius: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
        <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>MAP</span>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>1024 × 1024</span>
        <span style={{ color: 'rgba(255,255,255,0.22)' }}>·</span>
        <span>20 km</span>
        <span style={{ color: 'rgba(254, 24, 24, 0.35)', fontSize: '0.6rem', marginLeft: '4px' }}>← auto-detected</span>
      </div>
    </div>

    <div className="form-group">
      <label className="form-label">Emitters</label>
      <div className="input-row" onClick={() => setHelpGuideSelected('emitterrow')} style={{ cursor: 'pointer', marginBottom: '8px' }}>
        <input readOnly onChange={() => {}} className="form-input" value="" placeholder="/maps/mapname.v0001/.../smoke.bp"
          style={{ outline: helpGuideSelected === 'emitterrow' ? '2px solid rgba(255,255,255,0.7)' : 'none' }} />
        <button className="btn-delete-sm">×</button>
      </div>
      <button className="btn-secondary" onClick={() => setHelpGuideSelected('addemitter')} style={{ width: '100%', marginBottom: '8px', outline: helpGuideSelected === 'addemitter' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>+ Add Emitter</button>
      <button className="btn-library" onClick={() => setHelpGuideSelected('emitterlibrary')} style={{ width: '100%', outline: helpGuideSelected === 'emitterlibrary' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>Library</button>
    </div>
  </div>

  {/* UNITS card */}
  <div className="section-card" style={{ marginBottom: '16px' }}>
    <h2 className="section-title">UNITS</h2>
    <div className="wreckage-units-grid">

      {/* Unit card */}
      <div className="wreckage-unit-card selected" style={{ cursor: 'default' }}>
        <div className="wreckage-unit-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div className="wreckage-color-indicator" onClick={() => setHelpGuideSelected('unitcolor')} style={{ backgroundColor: '#00DDFF', cursor: 'pointer', outline: helpGuideSelected === 'unitcolor' ? '2px solid rgba(255,255,255,0.7)' : 'none', borderRadius: '50%' }} />
            <span className="wreckage-unit-card-title">XSA0402</span>
          </div>
          <button className="btn-delete-sm" onClick={() => setHelpGuideSelected('deleteunit')}
            style={{ outline: helpGuideSelected === 'deleteunit' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>×</button>
        </div>
        <div className="wreckage-unit-card-content">
          <div className="input-row">
            <input readOnly onChange={() => {}} className="form-input" value="" placeholder="UEL0203"
              onClick={() => setHelpGuideSelected('unitid')} style={{ textTransform: 'uppercase', width: '100%', cursor: 'pointer', outline: helpGuideSelected === 'unitid' ? '2px solid rgba(255,255,255,0.7)' : 'none' }} />
            <button className="btn-library" onClick={() => setHelpGuideSelected('unitlibrary')}
              style={{ outline: helpGuideSelected === 'unitlibrary' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>Library</button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{ marginTop: '4px' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: '500', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: '8px' }}>Unit Categories (optional)</label>
        <div className="input-row" onClick={() => setHelpGuideSelected('category-row')} style={{ cursor: 'pointer', marginBottom: '8px' }}>
          <input readOnly onChange={() => {}} className="form-input" value="Land" placeholder="Category"
            style={{ outline: helpGuideSelected === 'category-row' ? '2px solid rgba(255,255,255,0.7)' : 'none' }} />
          <button className="btn-delete-sm">×</button>
        </div>
        <button className="btn-secondary" onClick={() => setHelpGuideSelected('addcategory')}
          style={{ width: '100%', fontSize: '0.85rem', padding: '10px', marginBottom: '8px', outline: helpGuideSelected === 'addcategory' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>+ Add Category</button>
      </div>

      <div className="wreckage-add-unit-card" onClick={() => setHelpGuideSelected('addunit')} style={{ marginTop: '8px', cursor: 'pointer', outline: helpGuideSelected === 'addunit' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>
        <div className="wreckage-add-unit-icon"><span style={{ fontSize: '2rem' }}>+</span></div>
        <span className="wreckage-add-unit-text">ADD UNIT TYPE</span>
      </div>
    </div>
  </div>

  {/* EMITTER MATCHING */}
  <div className="section-card" style={{ marginBottom: '16px' }}>
    <label className="form-label" style={{ marginBottom: '15px', display: 'block' }}>
      Emitter Matching Mode
    </label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
      {[
        { id: 'matching-smart',   label: 'Smart Combination (3-Tier)', sub: 'Perfect Match → Partial Match → Fallback' },
        { id: 'matching-simple',  label: 'Simple Union',               sub: 'ALL emitters active for ANY category' },
        { id: 'matching-lastcat', label: 'Last Category Only',         sub: 'Only the LAST category tag is used' },
      ].map(mode => (
        <div key={mode.id}
          onClick={() => setHelpGuideSelected(mode.id)}
          style={{
            cursor: 'pointer',
            padding: '14px 18px',
            background: helpGuideSelected === mode.id
              ? 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)'
              : 'rgba(255,255,255,0.04)',
            border: `2px solid ${helpGuideSelected === mode.id ? 'var(--wreckages-color)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '6px',
            transition: 'all 0.3s ease',
            boxShadow: helpGuideSelected === mode.id ? '0 0 16px var(--wreckages-glow)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${helpGuideSelected === mode.id ? 'var(--wreckages-color)' : 'rgba(255,255,255,0.4)'}`,
              background: helpGuideSelected === mode.id ? 'var(--wreckages-color)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {helpGuideSelected === mode.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#000' }} />}
            </div>
            <strong style={{ fontSize: '0.92rem', color: helpGuideSelected === mode.id ? 'var(--wreckages-color)' : '#fff', fontWeight: 600 }}>
              {mode.label}
            </strong>
          </div>
          <p style={{ margin: '0 0 0 30px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{mode.sub}</p>
        </div>
      ))}
    </div>
    <button className="btn-secondary"
      onClick={() => setHelpGuideSelected('configurecategory')}
      style={{ width: '100%', padding: '16px', fontSize: '0.92rem', outline: helpGuideSelected === 'configurecategory' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>
      Configure Emitter-Category Assignment
    </button>
  </div>

  <div className="section-card" style={{ marginBottom: '0' }}>
    <label className="checkbox-label" style={{ marginBottom: '16px', cursor: 'default', opacity: 0.6 }}>
      <div className="checkbox checked">
        <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="checkbox-text">Generate README file</span>
    </label>
    <button className="btn-primary btn-lg" onClick={() => setHelpGuideSelected('generate')}
      style={{ width: '100%', outline: helpGuideSelected === 'generate' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>
      GENERATE FILES
    </button>
  </div>
</div>

{/* ═══ PREVIEW COLUMN ═══ */}
<div className="wreckage-preview-column">
  <div className="section-card preview-card">
    <div className="wreckage-preview-header">
      <h2 className="section-title" style={{ margin: 0 }}>PREVIEW</h2>
      <div style={{ display: 'flex', gap: '10px' }}>
        <select className="btn-toggle"
          onClick={e => { e.stopPropagation(); setHelpGuideSelected('mirrormode'); }}
          onChange={() => {}}
          value="diagonal"
          style={{ outline: helpGuideSelected === 'mirrormode' ? '2px solid rgba(255,255,255,0.7)' : 'none', cursor: 'pointer' }}>
          <option value="none">No Mirror</option>
          <option value="diagonal">Diagonal</option>
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
        <button className="btn-delete-text" onClick={() => setHelpGuideSelected('deletepreview')}
          style={{ outline: helpGuideSelected === 'deletepreview' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>Delete Preview</button>
      </div>
    </div>

    <div className="wreckage-upload-area" onClick={() => setHelpGuideSelected('uploadmap')} style={{ cursor: 'pointer', marginBottom: '8px', outline: helpGuideSelected === 'uploadmap' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>
      <span className="wreckage-upload-icon"></span>
      <span>Click to upload map image manually</span>
    </div>

    <div className="wreckage-canvas-container" onClick={() => setHelpGuideSelected('canvas')} style={{ position: 'relative', width: '700px', height: '700px', cursor: 'pointer', marginBottom: '8px', outline: helpGuideSelected === 'canvas' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>
      <canvas width={1024} height={1024} style={{ width: '100%', height: '100%', display: 'block' }}
        ref={el => {
          if (!el) return;
          const ctx = el.getContext('2d');
          const W = 1024, H = 1024;
          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = 'rgba(255,255,255,0.07)';
          ctx.lineWidth = 1;
          for (let i = 0; i <= 8; i++) {
            ctx.beginPath(); ctx.moveTo(i * W / 8, 0); ctx.lineTo(i * W / 8, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * H / 8); ctx.lineTo(W, i * H / 8); ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([12, 8]);
          ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
          ctx.setLineDash([]);
        }}
      />
      {[[30,28,'#00DDFF'],[70,72,'#00DDFF'],[28,72,'#A5E801'],[72,28,'#A5E801']].map(([x,y,c],i) => (
        <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: '12px', height: '12px', borderRadius: '50%', background: c, boxShadow: `0 0 15px ${c}`, border: '2px solid rgba(255,255,255,0.8)' }} />
      ))}
    </div>

    <div className="wreckage-legend" onClick={() => setHelpGuideSelected('legend')} style={{ cursor: 'pointer', marginBottom: '8px', outline: helpGuideSelected === 'legend' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>
      <div className="wreckage-legend-title">UNIT LEGEND</div>
      <div className="wreckage-legend-items">
        {[['#00DDFF','XSA0402','2'],['#A5E801','UEL0203','2']].map(([c,n,cnt]) => (
          <div key={n} className="wreckage-legend-item">
            <div className="wreckage-legend-color" style={{ backgroundColor: c }} />
            <span>{n}</span><span className="wreckage-coord-count">{cnt} pts</span>
          </div>
        ))}
      </div>
    </div>

    <div className="wreckage-hint-box" onClick={() => setHelpGuideSelected('hintbox')} style={{ cursor: 'pointer', outline: helpGuideSelected === 'hintbox' ? '2px solid rgba(255,255,255,0.7)' : 'none' }}>
      Diagonal mirroring active — 1 click = 2 coordinates
    </div>
  </div>
</div>
</div>
    </div>

    {/* ── RIGHT: Explanation panel ── */}
    <div style={{ flex: '1', paddingLeft: '0', overflowY: 'auto', maxHeight: '80vh' }}>
{!helpGuideSelected ? (
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
  <div style={{ fontSize: '3rem', opacity: 0.5 }}>↖</div>
  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>Select an element</div>
  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)', maxWidth: '240px', lineHeight: 1.7 }}>Click any field, button, or section on the left to learn what it does.</div>
</div>
) : (() => {
const INFO = {
  mapname: { icon: '', title: 'Map Name', desc: 'The exact name of your map folder inside /maps. Used to construct every output file path.', details: [['Format','MapName.vXXXX — e.g. Hades_Dust.v0002'],['Auto-version','Omitting .v0001 appends it automatically'],['Case-sensitive','FA is strict — match the folder name exactly'],['Impact','Wrong name = broken file paths = wreckages invisible in-game']], tip: 'Copy the folder name directly from File Explorer to avoid typos.' },
  mapsize: { icon: '', title: 'Map Size', desc: 'Width/height of the playable area in world units — read automatically from save.lua when a valid Map Name is entered. Controls how canvas clicks translate to world-space coordinates.', details: [['Auto-detected','Read from save.lua — no manual input required'],['Standard sizes','256 = 5×5 km · 512 = 10×10 km · 1024 = 20×20 km'],['Non-power-of-2','Maps like 768 (15×15 km) are supported — exact playable size is used'],['Info display','Total map size and km shown below the Map Name field once detected'],['Impact','Wrong Map Name or missing save.lua = fallback to 1024, wreckages offset']], tip: 'Make sure Map Name is correct and the map folder exists — size is detected automatically.' },
  mapsfolder: { icon: '', title: 'Select Maps Folder', desc: 'Absolute path to your SC /maps directory. All generated files are written into subdirectories here.', details: [['Required','Generation fails without this'],['Path','Documents\\My Games\\...\\Supreme Commander Forged Alliance\\maps'],['Persist','Set once in Settings — survives app restarts']], tip: 'Configure in Settings once so you never need to reselect it.' },
  emitterfolder: { icon: '', title: 'Select Emitter.bp Folder', desc: 'Source folder for emitter .bp files. These get copied into the map during generation.', details: [['Optional','Wreckages still generate — but without visual effects'],['Source','Usually the /emitter.bp folder in your ForgeMapToolkit root'],['Copies to','map/env/props/emitter/wreckages/']], tip: 'Without this, wreckages generate but produce no smoke or fire.' },
  emitterrow: { icon: '', title: 'Emitter Path Row', desc: 'In-game path to one emitter .bp file. One row is randomly picked per wreckage at runtime.', details: [['Format','/maps/MapName.v0001/env/props/emitter/wreckages/smoke.bp'],['Randomness','Multiple rows = random effect per wreckage for visual variety'],['Delete','Click × on the right to remove this row']], tip: 'Use the Library button — typing paths manually is error-prone.' },
  addemitter: { icon: '+', title: 'Add Emitter', desc: 'Adds a new empty emitter path row.', details: [['Use','One row per distinct effect file'],['Variety','More rows = more visual diversity via random selection']], tip: 'Pair with the Library button to fill paths quickly.' },
  emitterlibrary: { icon: '', title: 'Emitter Library', desc: 'Opens the library overlay to browse and select from your scanned emitter files.', details: [['Prerequisite','Run a library scan in Settings first'],['Multi-select','Select many at once — all get added as rows'],['Auto-path','Paths auto-formatted with current map name']], tip: 'Much faster than typing paths manually.' },
  unitcard: { icon: '', title: 'Unit Card', desc: 'Represents one unit type and all its wreckage coordinates.', details: [['Selection','Only the selected card receives new canvas coordinates'],['Contents','Unit ID, color dot, categories, coordinate list']], tip: 'Add one card per unique unit type on your map.' },
  unitcolor: { icon: '', title: 'Unit Color Dot', desc: 'The canvas marker color for this unit. Click to change it.', details: [['Purpose','Distinguishes units on the canvas and legend'],['No effect','Does not affect generated files']], tip: 'Use distinct colors when placing multiple unit types.' },
  deleteunit: { icon: '×', title: 'Delete Unit Card', desc: 'Removes this unit card and all its placed coordinates permanently.', details: [['Irreversible','All coordinates for this unit are deleted'],['Last unit','Resets to an empty card instead of deleting']], tip: 'Double-check coordinates before deleting.' },
  unitid: { icon: '', title: 'Unit ID', desc: 'The blueprint ID of the unit. Format: 2-letter faction + 1 type letter + 4-digit code.', details: [['Factions','UE = UEF · UA = Aeon · UR = Cybran · XS = Seraphim'],['Type letter','L = Land · A = Air · S = Sea · B = Building'],['Example','UEL0203 = UEF Land unit #0203 (T1 Engineer)'],['Library','Use Library to search by name instead of memorizing IDs']], tip: 'Use the Library — searching by name is far easier.' },
  unitlibrary: { icon: '', title: 'Unit Library', desc: 'Opens the unit library to search units by name, faction, or tech level.', details: [['Search','Filter by name, faction, tech level, type'],['Auto-fill','Clicking a unit fills the ID field automatically'],['Source','Loaded from game files — run a scan in Settings first']], tip: 'Essential for finding IDs quickly. Always use this over typing.' },
  'category-row': { icon: '', title: 'Category Tag', desc: 'An optional label that groups this unit for smart emitter matching.', details: [['Examples','Land · Air · Naval · T1 · T2 · T3 · Experimental'],['Matching','Drives emitter selection — see Advanced Guide → Emitter Assignment'],['Order','In "Last Category Only" mode the last tag wins']], tip: 'Keep naming consistent across units — case matters.' },
  addcategory: { icon: '+', title: 'Add Category', desc: 'Adds a new category tag row to this unit.', details: [['Naming','Consistent capitalisation across all units is important'],['Order','Put most specific tag last for Last Category Only mode']], tip: 'Typical: type first (Land/Air), then tech level (T2), then special (Experimental).' },
  addunit: { icon: '+', title: 'Add Unit Type', desc: 'Creates a new unit card for an additional wreckage type.', details: [['Independent','Each card has its own coordinates, color, and categories'],['Typical','2–6 unit types per map']], tip: 'Add all unit types before placing coordinates.' },
  'matching-smart': { icon: '', title: 'Smart Combination (3-Tier)', desc: 'Checks emitter assignments in three priority tiers for the most precise match.', details: [['Tier 1','Emitters active for ALL unit categories'],['Tier 2','Emitters active for ANY category (if Tier 1 empty)'],['Tier 3','All configured emitters (safety fallback)'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'Best for production setups with precise per-category tuning.' },
  'matching-simple': { icon: '', title: 'Simple Union', desc: 'Uses all emitters active for ANY of the unit\'s categories combined.', details: [['Logic','OR-based: ["Land","T3"] gets all Land + all T3 emitters merged'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'Simpler mental model. Good starting point.' },
  'matching-lastcat': { icon: '', title: 'Last Category Only', desc: 'Only the LAST tag in the category list is used for matching.', details: [['Example','["Land","T3","Heavy"] → only "Heavy" used'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'Ideal when categories go general→specific.' },
  configurecategory: { icon: '', title: 'Configure Emitter-Category Assignment', desc: 'Opens the overlay where you control which emitters are active per category.', details: [['Layout','Each category = one row; each emitter has a toggle'],['White = active','Emitter included for this category'],['Gray = inactive','Emitter excluded for this category'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'See Advanced Guide → Emitter Assignment for full examples.' },
  generate: { icon: '', title: 'GENERATE FILES', desc: 'Validates your configuration, writes all unit prop/script files, injects a props.lua into your .scmap via the built-in parser, and repacks — all in one click.', details: [['Creates','One _prop.bp + one _script.lua per placed coordinate per unit'],['SCMAP','Unpacks .scmap → injects props.lua chunk → repacks back in place'],['README','Optional .txt file documenting all settings at generation time'],['Re-run safe','Each run adds a new numbered props.lua chunk — nothing is overwritten']], tip: 'The .scmap must exist in the map folder before generating — run the FA editor first if starting fresh.' },
  mirrormode: { icon: '', title: 'Mirror Mode', desc: 'Sets whether a canvas click creates one coordinate or an automatic mirror pair.', details: [['No Mirror','1 click = 1 coordinate'],['Diagonal','1 click = 2 coordinates — mirror at (mapSize−X, mapSize−Z)'],['Horizontal','1 click = 2 coordinates — mirror at same X, mapSize−Z'],['Vertical','1 click = 2 coordinates — mirror at mapSize−X, same Z'],['See also','→ Advanced Guide: Mirror Modes']], tip: 'Diagonal saves 50% placement work on symmetrical maps.' },
  deletepreview: { icon: '', title: 'Delete Preview', desc: 'Removes the current map preview image and resets the canvas background.', details: [['Effect','Clears image — auto-load will run again next time the map name triggers a reload'],['Coordinates','Remain untouched — only the background is removed'],['Override','After deleting you can upload a custom image manually']], tip: 'Upload a new custom image after deleting if you want a different reference image.' },
  uploadmap: { icon: '', title: 'Upload Map Image', desc: 'Override the auto-loaded preview with a custom image. When a Map Name is set, the preview is read directly from the .scmap — manual upload is for overriding or when no .scmap is available yet.', details: [['Auto-load','Preview is read automatically from the .scmap when Map Name is entered'],['Manual override','Clicking here lets you upload any image (PNG, JPG, WEBP) to replace it'],['Formats','PNG, JPG, WEBP'],['Source','Auto: from .scmap · Manual: FA map editor export or screenshot']], tip: 'In most cases the preview loads automatically — you only need to click here to override it.' },
  canvas: { icon: '', title: 'Map Preview Canvas', desc: 'The interactive area where you place and delete coordinates by clicking.', details: [['Click empty','Adds a coordinate for the selected unit'],['Click marker','Deletes that coordinate and its mirror pair'],['Colors','Each unit uses its card color dot'],['Scale','Positions calculated from auto-detected Map Size (from save.lua)']], tip: 'Select the unit card first — only selected units receive new coordinates.' },
  legend: { icon: '', title: 'Unit Legend', desc: 'Shows all unit types with their canvas colors and coordinate counts.', details: [['Content','Color + unit ID + coordinate count per unit'],['Purpose','Track how many points each unit has'],['Read-only','Purely informational']], tip: 'Check counts here before generating.' },
  hintbox: { icon: '', title: 'Canvas Hint', desc: 'Dynamic text showing the currently active mirror mode.', details: [['Updates','Changes as you switch mirror modes']], tip: 'Glance here before clicking to confirm the correct mirror mode.' },
};
const sel = INFO[helpGuideSelected];
if (!sel) return <div style={{ padding: '32px', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>No info for "{helpGuideSelected}"</div>;
return (
  <div className="help-adv-layout" style={{ padding: 0 }}>
    <div className="help-adv-hero" style={{ marginBottom: '24px' }}>
      <div className="help-adv-hero-content">
        <h2 className="help-adv-hero-title">
          <span className="help-adv-card-icon">{sel.icon}</span>
          {sel.title}
        </h2>
        <p className="help-adv-hero-desc">{sel.desc}</p>
      </div>
    </div>
    <div className="help-adv-structure">
      <h3 className="help-adv-section-header">
        <span className="help-adv-section-num">01</span>
        Details
      </h3>
      <div className="help-adv-card-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="help-adv-card">
          <div className="help-adv-card-body">
            <ul className="help-adv-card-features">
              {sel.details.map(([label, value], i) => (
                <li key={i}><strong>{label}:</strong> {value}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div className="help-adv-note" style={{ marginTop: '16px' }}>
      <strong>Tip: </strong>{sel.tip}
    </div>
  </div>
);
})()}
    </div>
  </div>
)}

{/* ═══════════════════════════════════════════════════════════
    ADVANCED GUIDE TAB
    ═══════════════════════════════════════════════════════════ */}
{activeHelpTab === 'advanced' && (
  <div className="help-adv-layout">

    {/* Sub-Tab Switcher */}
    <div style={{ display: 'flex', gap: '8px', marginBottom: '36px', flexWrap: 'wrap', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
{[
{ id: 'workflow',  label: 'Workflow' },
{ id: 'config',    label: 'Configuration' },
{ id: 'units-adv', label: 'Units' },
{ id: 'preview',   label: 'Preview & Canvas' },
{ id: 'coords',    label: 'Coordinates & Rotation' },
{ id: 'mirror',    label: 'Mirror Modes' },
{ id: 'emitter',   label: 'Emitter Assignment' },
{ id: 'generate',  label: 'Generate Files' },
].map(t => (
<button key={t.id} onClick={() => setActiveAdvancedSubTab(t.id)} style={{
  flex: '1 1 auto', padding: '11px 14px', borderRadius: '8px', cursor: 'pointer',
  fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase',
  transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: activeAdvancedSubTab === t.id ? 'var(--wreckages-color)' : 'rgba(255,255,255,0.05)',
  color: activeAdvancedSubTab === t.id ? '#000' : 'rgba(255,255,255,0.6)',
  border: `2px solid ${activeAdvancedSubTab === t.id ? 'var(--wreckages-color)' : 'transparent'}`,
  boxShadow: activeAdvancedSubTab === t.id ? '0 0 16px var(--wreckages-glow)' : 'none',
}}
  onMouseEnter={e => { if (activeAdvancedSubTab !== t.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}}
  onMouseLeave={e => { if (activeAdvancedSubTab !== t.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}}
>{t.label}</button>
))}
    </div>

    {/* ─── WORKFLOW ─── */}
    {activeAdvancedSubTab === 'workflow' && (<>
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title"><span className="help-adv-card-icon"></span>Full Workflow Overview</h2>
  <p className="help-adv-hero-desc">Follow these steps from start to finish to generate wreckages. Each step builds on the last — don't skip steps on your first run.</p>
</div>
</div>
<div className="help-adv-process">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Core Process</h3>
<div className="help-adv-timeline">
  {[
    { n: '01', title: 'Configure Map Settings', desc: 'Enter Map Name (e.g. Hades_Dust.v0002). Map Size is detected automatically from save.lua — no manual input needed.', subs: ['Map name must exactly match the folder in /maps — FA is case-sensitive','Omitting .v0001 is fine — it is appended automatically','Maps folder and Emitter folder are set in Settings/Game Paths'] },
    { n: '02', title: 'Add Emitters & Unit Types', desc: 'Add emitter via the Library, then create a Unit Card per wreckage type and fill in the blueprint ID via the Library or manual.', subs: ['Use Library buttons — typing paths and IDs manually is error-prone','Multiple emitter rows = random variety across wreckages','Each unit card is independent — different colors, IDs, and coordinate sets'] },
    { n: '03', title: 'Place Coordinates on Canvas', desc: 'The map preview loads automatically from the .scmap when the Map Name is set. Set a mirror mode, select a unit card, then click the canvas to place wreckage positions.', subs: ['Preview image auto-extracted from .scmap — no manual upload needed in most cases','Override with a custom image by clicking the upload area','Only the selected unit card receives new coordinates from canvas clicks','Click an existing marker to delete it and its mirror pair','Mirror modes auto-create symmetric pairs — see Mirror Modes tab'] },
    { n: '04', title: 'Generate Files', desc: 'Click GENERATE FILES. The tool writes all wreckage prop/script files, injects a props.lua chunk into your .scmap via the built-in parser, and repacks automatically.', subs: ['One _prop.bp + one _script.lua per coordinate per unit','SCMAP parser runs automatically — no BrewMapTool needed','README optionally documents all settings at generation time','Re-run freely — each run adds a new numbered props.lua chunk'] },
  ].map(s => (
    <div key={s.n} className="help-adv-step">
      <div className="help-adv-step-num">{s.n}</div>
      <div className="help-adv-step-content">
        <h4>{s.title}</h4>
        <p>{s.desc}</p>
        <ul style={{ margin: '10px 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {s.subs.map((sub,i) => <li key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.6 }}>{sub}</li>)}
        </ul>
      </div>
    </div>
  ))}
</div>
</div>
<div className="help-adv-ts-grid">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
{[
  ['No .scmap found error','The tool needs an existing .scmap in the map folder. Generate the base map in the FA editor first, then run the wreckage generator.'],
  ['Wreckages at wrong positions','Map size is auto-read from save.lua. Verify that Map Name is correct and that the map folder with save.lua exists — without it the size falls back to 1024.'],
  ['Wreckages missing after map load','Confirm the repack succeeded (check the success alert). Wreckages can only appear ingame.'],
  ['Wreckage has no smoke/fire effect','The Emitter cant be seen in the Fog of War.'],
].map(([q,a]) => (
  <div key={q} className="help-adv-ts-item">
    <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
    <div className="help-adv-ts-a"><p>{a}</p></div>
  </div>
))}
</div>
<div className="help-adv-bp-section">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
<div className="help-adv-practice-grid">
  {[
    ['','Verify Map Name First. Map Size is auto-detected from save.lua — if the name is wrong or the folder is missing, the size falls back to 1024 and all coordinates will be offset.'],
    ['','Upload Map Image First','Place your map image before placing coordinates so you can see the intended positions.'],
    ['','Test Small First','Start with 1–2 units and 2–4 coordinates to verify your folder setup before doing a full map.'],
  ].map(([icon,title,desc]) => (
    <div key={title} className="help-adv-practice-card">
      <div className="help-adv-practice-icon">{icon}</div>
      <h4>{title}</h4><p>{desc}</p>
    </div>
  ))}
</div>
</div>
    </>)}

    {/* ─── CONFIGURATION ─── */}
    {activeAdvancedSubTab === 'config' && (<>
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title"><span className="help-adv-card-icon"></span>Configuration Deep Dive</h2>
  <p className="help-adv-hero-desc">These global settings affect every unit and every generated file. Setting them correctly once prevents all downstream errors.</p>
</div>
<div className="help-adv-button-showcase">
  <div className="help-adv-fake-button" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Maps Folder + Map Name</div>
  <div className="help-adv-button-hint">Map Size is auto-detected — these two form the foundation</div>
</div>
</div>
<div className="help-adv-technical">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Field Reference</h3>
<div className="help-adv-card-grid">
  {[
    { icon: '️', title: 'Map Name', desc: 'The exact name of your map folder inside /maps. Used to construct ALL output file paths.', features: ['Must match folder name exactly — FA is case-sensitive','Format: MapName.vXXXX (e.g. Hades_Dust.v0002)','Omitting .v0001 is fine — auto-appended','Wrong name = all generated paths are broken'] },
    { icon: '', title: 'Map Size', desc: 'Width/height of the playable area in world units. Auto-detected from save.lua when a valid Map Name is entered — no manual input required.', features: ['Auto-read from save.lua — shown below the Map Name field','Standard: 256 = 5×5 km · 512 = 10×10 km · 1024 = 20×20 km','Non-power-of-2 maps (e.g. 768 = 15×15 km) fully supported','Fallback is 1024 if Map Name is wrong or save.lua is missing'] },
    { icon: '', title: 'Maps Folder', desc: 'Absolute path to your /maps directory. All generated files are written here.', features: ['Required — generation fails without it','Set once in Settings/Game Paths — persists across sessions','Cleared with the × button in Configuration'] },
    { icon: '', title: 'Emitter Folder', desc: 'Source folder for emitter files. Copied into map during generation.', features: ['Optional — wreckages generate but produce no visual effect without it','Usually public/emitter in your ForgeMapToolkit root','Files copied to: map/env/props/emitter/wreckages/','Cleared with the × button in Configuration'] },
    { icon: '', title: 'Emitter Path Rows', desc: 'In-game .bp paths assigned randomly to wreckages at runtime.', features: ['Format: /maps/MapName.v0001/env/props/emitter/wreckages/effect.bp','Multiple rows = one randomly picked per wreckage','Use Library button to auto-fill paths','Combined with Unit Categories for smart per-type assignment'] },
  ].map(item => (
    <div key={item.title} className="help-adv-card">
      <div className="help-adv-card-header">
        <span className="help-adv-card-icon">{item.icon}</span>
        <h4>{item.title}</h4>
      </div>
      <div className="help-adv-card-body">
        <p className="help-adv-card-desc">{item.desc}</p>
        <ul className="help-adv-card-features">
          {item.features.map((f,i) => <li key={i}>{f}</li>)}
        </ul>
      </div>
    </div>
  ))}
</div>
</div>
<div className="help-adv-ts-grid">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
{[
  ['Files dont appear in the correct Folder','Check if you have set the map name and the version of the map correctly.'],
  ['Emitters don\'t get copied','Make sure that you have set the correct Emitter Folder Path in Settings.'],
  ['Maps folder is not being saved between sessions','Persistent folder settings require configuration in Settings — not just set here in the tab.'],
].map(([q,a]) => (
  <div key={q} className="help-adv-ts-item">
    <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
    <div className="help-adv-ts-a"><p>{a}</p></div>
  </div>
))}
</div>
<div className="help-adv-bp-section">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
<div className="help-adv-practice-grid">
  {[
    ['','Copy Folder Names','Copy your map folder name directly from File Explorer to guarantee correct capitalisation.'],
    ['','Use Settings','Set Maps Folder and Emitter Folder in Settings once. Otherwise nothing will work.'],
    ['','Verify Map Name First','Map Size is auto-detected from save.lua — double-check the Map Name so the correct size is detected before placing any coordinates.'],
  ].map(([icon,title,desc]) => (
    <div key={title} className="help-adv-practice-card">
      <div className="help-adv-practice-icon">{icon}</div>
      <h4>{title}</h4><p>{desc}</p>
    </div>
  ))}
</div>
</div>
    </>)}

    {/* ─── UNITS ─── */}
    {activeAdvancedSubTab === 'units-adv' && (<>
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title"><span className="help-adv-card-icon"></span>Units — Full Reference</h2>
  <p className="help-adv-hero-desc">Each Unit Card represents one unique wreckage type with its own coordinates, color, and optional category tags. Multiple cards let you place different unit wreckages on the same map.</p>
</div>
<div className="help-adv-button-showcase">
  <div className="help-adv-fake-button" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>UEL0203</div>
  <div className="help-adv-button-hint">2-letter faction + type letter + 4-digit code</div>
</div>
</div>
<div className="help-adv-technical">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Field Reference</h3>
<div className="help-adv-card-grid">
  {[
    { icon: '', title: 'Unit ID', desc: 'The blueprint ID. Format: 2-letter faction + 1 type letter + 4-digit code.', features: ['Factions: UE = UEF · UA = Aeon · UR = Cybran · XS = Seraphim','Type: L = Land · A = Air · S = Naval · B = Building', 'Tech: 01/11 = Tech1 · 02 = Tech2 · 03 = Tech3 · B = Building · 04 = Experimental', 'Index: Shows the order of the units', , 'Example: UEL0203 = UEF, Land, Tech2, Third Unit = Riptide','Wrong ID = game can\'t find blueprint = no wreckage'] },
    { icon: '', title: 'Color Dot', desc: 'Canvas marker color. Click to change. Purely visual — no effect on generated files.', features: ['Use distinct colors when working with multiple unit types','Available as preset swatches or custom hex/hsl input','Color appears in canvas markers and the Unit Legend'] },
    { icon: '', title: 'Unit Categories', desc: 'Optional labels that group this unit for the Emitter Matching system.', features: ['Examples: Land · Air · Naval · T1 · T2 · T3 · Experimental','Must match names used in Emitter-Category Assignment overlay exactly','Order matters in "Last Category Only" mode — last tag wins','Without categories: unit uses entire emitter pool (no filtering)'] },
    { icon: '', title: 'Coordinates', desc: 'The placed wreckage positions for this unit. Managed via the canvas.', features: ['X and Z set by canvas clicks — editable in the coordinate list','Y (height) defaults to 26 — adjust if wreckages sink or float on uneven terrain','Heading/Pitch/Roll in radians — defaults are correct for all standard wreckages','Click × on a row to delete one coordinate; Delete All removes all at once'] },
  ].map(item => (
    <div key={item.title} className="help-adv-card">
      <div className="help-adv-card-header">
        <span className="help-adv-card-icon">{item.icon}</span>
        <h4>{item.title}</h4>
      </div>
      <div className="help-adv-card-body">
        <p className="help-adv-card-desc">{item.desc}</p>
        <ul className="help-adv-card-features">
          {item.features.map((f,i) => <li key={i}>{f}</li>)}
        </ul>
      </div>
    </div>
  ))}
</div>
</div>
<div className="help-adv-ts-grid">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
{[
  ['Unit library search returns no results','Run a library scan in Settings first — without a scan the library is empty.'],
  ['Wrong wreckage appears in-game despite correct ID','Verify the ID in the unit card exactly matches the blueprint.'],
].map(([q,a]) => (
  <div key={q} className="help-adv-ts-item">
    <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
    <div className="help-adv-ts-a"><p>{a}</p></div>
  </div>
))}
</div>
    </>)}

    {/* ─── PREVIEW & CANVAS ─── */}
    {activeAdvancedSubTab === 'preview' && (<>
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title"><span className="help-adv-card-icon"></span>Preview &amp; Canvas</h2>
  <p className="help-adv-hero-desc">The Preview section is your visual placement workspace. Upload a map image for reference, set a mirror mode, select a unit, then click to place coordinates.</p>
</div>
<div className="help-adv-button-showcase">
  <svg viewBox="0 0 130 130" width="110" style={{display:'block',margin:'0 auto'}}>
    <rect width="130" height="130" fill="rgba(0,0,0,0.5)" rx="4"/>
    <line x1="65" y1="0" x2="65" y2="130" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
    <line x1="0" y1="65" x2="130" y2="65" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
    {[[39,36],[91,94]].map(([x,y],i) => (
      <g key={i}><circle cx={x} cy={y} r="6" fill="#FFFFFF" opacity="0.85"/><circle cx={x} cy={y} r="11" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/></g>
    ))}
    <line x1="39" y1="36" x2="91" y2="94" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,3"/>
  </svg>
  <div className="help-adv-button-hint">Diagonal: 1 click → 2 mirrored points</div>
</div>
</div>
<div className="help-adv-technical">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Element Reference</h3>
<div className="help-adv-card-grid">
  {[
    { icon: '', title: 'Map Preview Image', desc: 'Background image for visual reference while placing coordinates. Loaded automatically from the .scmap when a Map Name is entered — manual upload is only needed as an override or when no .scmap exists yet.', features: ['Auto-loaded from .scmap — no manual action needed when Map Name is set','Loading spinner shown while extracting preview from .scmap','Manual override: click the upload area to replace with any PNG, JPG or WEBP','Remove with Delete Preview button — auto-load runs again on the next map change'] },
    { icon: '', title: 'Mirror Mode', desc: 'Controls how many coordinates one canvas click creates. See Mirror Modes tab for full math.', features: ['No Mirror: 1 click = 1 coordinate','Diagonal: 1 click = 2 coords — mirror at (mapSize−X, mapSize−Z)','Horizontal: 1 click = 2 coords — mirror at same X, mapSize−Z','Vertical: 1 click = 2 coords — mirror at mapSize−X, same Z'] },
    { icon: '', title: 'Canvas Interaction', desc: 'The interactive area for placing and deleting coordinates.', features: ['Click empty space → adds coordinate for selected unit card','Click existing marker → deletes that coordinate and its mirror pair','Only the selected unit card receives new coordinates','Canvas internal resolution: 1024×1024, scaled to container'] },
    { icon: '', title: 'Unit Legend', desc: 'Shows all unit types with their colors and coordinate counts.', features: ['Color dot + unit ID + coordinate count per row','Purely informational — no interactive function'] },
  ].map(item => (
    <div key={item.title} className="help-adv-card">
      <div className="help-adv-card-header">
        <span className="help-adv-card-icon">{item.icon}</span>
        <h4>{item.title}</h4>
      </div>
      <div className="help-adv-card-body">
        <p className="help-adv-card-desc">{item.desc}</p>
        <ul className="help-adv-card-features">
          {item.features.map((f,i) => <li key={i}>{f}</li>)}
        </ul>
      </div>
    </div>
  ))}
</div>
</div>
<div className="help-adv-ts-grid">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
{[
  ['Preview image not loading automatically','The .scmap must exist in the map folder and the Map Name must match the folder exactly. If the .scmap is missing (map not yet generated in FA editor), upload the image manually instead.'],
  ['Manually uploaded image not appearing','Only PNG, JPG, and WEBP are supported. Very large images may be slow to load.'],
  ['Deleting a coordinate also removes another one','Expected — clicking a coordinate deletes it and its mirror pair together. If you don\t want that - Set the Mirror Mode to "No Mirror" '],
].map(([q,a]) => (
  <div key={q} className="help-adv-ts-item">
    <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
    <div className="help-adv-ts-a"><p>{a}</p></div>
  </div>
))}
</div>
<div className="help-adv-bp-section">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
<div className="help-adv-practice-grid">
  {[
    ['','Preview is Auto-Loaded','The preview image is read directly from the .scmap when the Map Name is set — no manual upload step needed. It refreshes automatically when the map name changes.'],
    ['','Manual Override Available','If the .scmap doesn\'t exist yet (new map) or you want a different image, click the upload area to override the auto-loaded preview with any PNG, JPG or WEBP.'],
    ['','Check Hint Box','Glance at the hint box before each placement session to confirm the correct mirror mode.'],
    ['','Select Unit Explicitly','Select the unit card explicitly before each session — it\'s easy to accidentally add coordinates to the wrong unit.'],
  ].map(([icon,title,desc]) => (
    <div key={title} className="help-adv-practice-card">
      <div className="help-adv-practice-icon">{icon}</div>
      <h4>{title}</h4><p>{desc}</p>
    </div>
  ))}
</div>
</div>
    </>)}

    {/* ─── COORDINATES & ROTATION ─── */}
    {activeAdvancedSubTab === 'coords' && (<>
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title"><span className="help-adv-card-icon"></span>Coordinate System &amp; Rotation</h2>
  <p className="help-adv-hero-desc">Supreme Commander uses a <strong>left-handed coordinate system</strong>. X runs West→East, Z runs North→South. All rotation values are in radians. Y height is always set automatically by the game — it is not stored or configurable.</p>
</div>
<div className="help-adv-button-showcase">
  <svg viewBox="0 0 150 150" width="130" style={{display:'block',margin:'0 auto'}}>
    <rect width="150" height="150" fill="rgba(0,0,0,0.6)" rx="4"/>
    {[37,75,112].map(v=><g key={v}><line x1={v} y1="8" x2={v} y2="142" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/><line x1="8" y1={v} x2="142" y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/></g>)}
    <line x1="12" y1="75" x2="140" y2="75" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5"/>
    <line x1="75" y1="12" x2="75" y2="140" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5"/>
    <polygon points="140,71 148,75 140,79" fill="rgba(255,255,255,0.4)"/>
    <polygon points="71,140 75,148 79,140" fill="rgba(255,255,255,0.4)"/>
    <text x="142" y="73" fill="rgba(255,255,255,0.55)" fontSize="10" fontFamily="monospace">X</text>
    <text x="78" y="148" fill="rgba(255,255,255,0.55)" fontSize="10" fontFamily="monospace">Z</text>
    <circle cx="112" cy="43" r="7" fill="#FFFFFF" opacity="0.85"/>
    <line x1="75" y1="43" x2="112" y2="43" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4,3"/>
    <line x1="112" y1="75" x2="112" y2="43" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4,3"/>
    <text x="10" y="14" fill="rgba(255,255,255,0.15)" fontSize="8">(0,0)</text>
  </svg>
  <div className="help-adv-button-hint">Origin (0,0) = NW corner of map</div>
</div>
</div>
<div className="help-adv-structure">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Position: X and Z</h3>
<div className="help-adv-card-grid">
  {[
    { title: 'X Axis', desc: 'Horizontal East-West. 0 = western edge. Increases going East.', features: ['Set by horizontal position of canvas click','Scale: (canvas click % × mapSize)','0 = west edge · mapSize = east edge'] },
    { title: 'Z Axis', desc: 'Horizontal North-South. 0 = northern edge. Increases going South.', features: ['Set by vertical position of canvas click','Scale: (canvas click % × mapSize)','0 = north edge · mapSize = south edge'] },
  ].map(item => (
    <div key={item.title} className="help-adv-card">
      <div className="help-adv-card-header">
        <span className="help-adv-card-icon" style={{fontFamily:'monospace',fontWeight:700,fontSize:'1.4rem'}}>{item.icon}</span>
        <h4>{item.title}</h4>
      </div>
      <div className="help-adv-card-body">
        <p className="help-adv-card-desc">{item.desc}</p>
        <ul className="help-adv-card-features">
          {item.features.map((f,i) => <li key={i}>{f}</li>)}
        </ul>
      </div>
    </div>
  ))}
</div>
<div className="help-adv-note" style={{ marginTop: '20px' }}>
  <strong>Y Axis (Height)</strong> — set per coordinate in the coordinate list. The default is 26, which works for standard flat terrain. Unlike emitters, wreckages require an explicit Y value passed to CreateUnitHPR. Adjust if wreckages sink or float on uneven terrain.
</div>
</div>
<div className="help-adv-process">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Rotation: Heading, Pitch, Roll</h3>
<div className="help-adv-timeline">
  {[
    { n: 'H', title: 'Heading', def: 'math.pi (180°)', desc: 'Yaw — horizontal facing direction around the vertical Y axis. math.pi = facing south, which is the standard wreckage orientation.', formula: '0 = North · math.pi/2 ≈ East · math.pi = South · -math.pi/2 ≈ West' },
    { n: 'P', title: 'Pitch', def: '0.0 (0°)', desc: 'Forward/backward tilt around the X axis. 0.0 = flat on the ground.', formula: '0.0 = flat · positive = nose down · negative = nose up' },
    { n: 'R', title: 'Roll', def: 'math.pi (180°)', desc: 'Side tilt around the Z axis. math.pi - the correct resting orientation for units.', formula: '0 = upside-down · math.pi = upright' },
  ].map(r => (
    <div key={r.title} className="help-adv-step">
      <div className="help-adv-step-num" style={{ fontFamily: 'monospace' }}>{r.n}</div>
      <div className="help-adv-step-content">
        <h4>{r.title} <code style={{ fontSize: '0.78rem', opacity: 0.6, fontWeight: 400 }}>default: {r.def}</code></h4>
        <p>{r.desc}</p>
        <div className="help-adv-code-block" style={{ marginTop: '10px' }}>
          <code>{r.formula}</code>
        </div>
      </div>
    </div>
  ))}
</div>
</div>

{/* ── ROTATION IMAGE SLIDESHOW ── */}
{(() => {
const SLIDES = [
  { key: 'H', label: 'Heading', images: ['H1','H2','H3'] },
  { key: 'P', label: 'Pitch',   images: ['P1','P2','P3'] },
  { key: 'R', label: 'Roll',    images: ['R1','R2','R3'] },
];
const captions = {
  H1: 'Heading math.pi — facing South (default wreckage)',
  H2: 'Heading math.pi/2 — facing East (right)',
  H3: 'Heading 0 — facing North (back)',
  P1: 'Pitch 0.0 — facing South, flat on ground (default)',
  P2: 'Pitch positive — nose tilted 45° downward',
  P3: 'Pitch positive max — nose tilted 90° downward',
  R1: 'Roll math.pi — facing South, upright view (default)',
  R2: 'Roll math.pi/2 — rolled 45° to the left',
  R3: 'Roll 0.0 — rolled 90° to the left',
};
return (
  <div style={{ marginBottom: '35px' }}>
    <h3 className="help-adv-section-header" style={{ marginBottom: '20px' }}>
      <span className="help-adv-section-num">02b</span>
      Rotation — Visual Reference
    </h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
      {SLIDES.map(({ key, label, images }) => (
        <RotationSlideshow key={key} label={label} images={images} captions={captions} />
      ))}
    </div>
  </div>
);
})()}

<div className="help-adv-structure">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Radian Quick Reference</h3>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
  {[
    ['0.0',        '0.000',  '0°',    'North / Flat'],
    ['math.pi/2',  '1.571',  '90°',   'East'],
    ['math.pi',    '3.142',  '180°',  'South'],
    ['3*math.pi/2','4.712',  '270°',  'West'],
  ].map(([rad, num, deg, dir]) => (
    <div key={rad} className="help-adv-note" style={{ flexDirection: 'column', gap: '0', textAlign: 'center', padding: '16px 12px' }}>
      <code style={{ fontFamily: 'monospace', fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>{rad}</code>
      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.42)', fontFamily: 'monospace', display: 'block', marginBottom: '8px' }}>≈ {num}</span>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)', fontWeight: '600', display: 'block' }}>{deg}</span>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginTop: '2px', fontStyle: 'italic' }}>{dir}</span>
      </div>
    </div>
  ))}
</div>
</div>
<div className="help-adv-ts-grid">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Troubleshooting</h3>
{[
  ['Wreckage at wrong position','Verify Map Size matches the actual map — a wrong size scales all X/Z coordinates incorrectly.'],
  ['Wreckage facing wrong direction','Adjust Heading in the coordinate row. math.pi = south, 0.0 = north, math.pi/2 ≈ east.'],
  ['Wreckage appears right-side up','Roll should be math.pi for upside-down orientation — check it was reset to 0.0.'],
].map(([q,a]) => (
  <div key={q} className="help-adv-ts-item">
    <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
    <div className="help-adv-ts-a"><p>{a}</p></div>
  </div>
))}
</div>
<div className="help-adv-bp-section">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>Best Practices</h3>
<div className="help-adv-practice-grid">
  {[
    ['','Keep Defaults','Never change Heading/Pitch/Roll defaults unless you have a specific visual need — they are correct for all standard and mirrored wreckages.'],
    ['','Verify Map Name First','Map Size is auto-detected from save.lua — confirm Map Name is correct before placing coordinates so the correct scale is used.'],
    ['','Use the Canvas','Place X/Z via canvas clicks rather than typing — faster and prevents out-of-bounds values.'],
  ].map(([icon,title,desc]) => (
    <div key={title} className="help-adv-practice-card">
      <div className="help-adv-practice-icon">{icon}</div>
      <h4>{title}</h4><p>{desc}</p>
    </div>
  ))}
</div>
</div>
    </>)}

    {/* ─── MIRROR MODES ─── */}
    {activeAdvancedSubTab === 'mirror' && (<>
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title"><span className="help-adv-card-icon"></span>Mirror Modes — Full Reference</h2>
  <p className="help-adv-hero-desc">Mirror modes automatically create a second mirrored coordinate when you click the canvas. Position and rotation are mathematically adjusted for each mirrored point — no manual calculation needed.</p>
</div>
</div>

<div className="help-adv-process">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Mode Reference</h3>
<div className="help-adv-card-grid">
  {[
    { icon: '○', title: 'No Mirror', desc: '1 click = 1 coordinate. Freeform placement with no automatic mirroring.', features: ['Use for asymmetric maps or unique single placements','Full manual control over every position','No coordinate pairs — each click is independent'] },
    { icon: '⤡', title: 'Diagonal Mirror', desc: '1 click = 2 coordinates. Second point mirrors at (mapSize−X, mapSize−Z).', features: ['Use for maps with rotational 180° symmetry','Most common mode for standard competitive maps','Saves 50% of placement work on symmetric maps'] },
    { icon: '↕', title: 'Horizontal Mirror', desc: '1 click = 2 coordinates. Second point mirrors at the same X, but mapSize−Z.', features: ['Use for maps with North/South symmetry','X coordinate is identical — only Z is mirrored'] },
    { icon: '↔', title: 'Vertical Mirror', desc: '1 click = 2 coordinates. Second point mirrors at mapSize−X, same Z.', features: ['Use for maps with East/West symmetry','Z coordinate is identical — only X is mirrored'] },
  ].map(item => (
    <div key={item.title} className="help-adv-card">
      <div className="help-adv-card-header">
        <span className="help-adv-card-icon" style={{fontFamily:'monospace',fontWeight:700,fontSize:'1.3rem'}}>{item.icon}</span>
        <h4>{item.title}</h4>
      </div>
      <div className="help-adv-card-body">
        <p className="help-adv-card-desc">{item.desc}</p>
        <ul className="help-adv-card-features">
          {item.features.map((f,i) => <li key={i}>{f}</li>)}
        </ul>
      </div>
    </div>
  ))}
</div>
</div>

<div className="help-adv-ts-grid">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
{[
  ['Mirror pair at wrong position', 'Verify your Map Size setting — mirror positions are calculated as mapSize−X and/or mapSize−Z. Wrong size = wrong mirror positions.'],
  ['Deleting a coordinate also removes its pair', 'Correct behavior — mirror pairs are always deleted together to keep the map symmetric.'],
  ['Mirror mode active but only one coordinate appeared', 'This happens when the mirrored position would overlap an existing coordinate — no duplicates are created.'],
  ['Switching mirror mode mid-session', 'Coordinates placed before the switch keep their original mirror state. Only new clicks use the updated mode.'],
].map(([q, a]) => (
  <div key={q} className="help-adv-ts-item">
    <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
    <div className="help-adv-ts-a"><p>{a}</p></div>
  </div>
))}
</div>

<div className="help-adv-bp-section">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
<div className="help-adv-practice-grid">
  {[
    ['ℹ', 'Check the Hint Box',      'Verify the hint box shows the correct mode before starting a placement session.'],
    ['', 'Edit Originals Only',      'When repositioning a mirrored coordinate, edit the original — its mirror updates automatically.'],
    ['', 'Mind Mode Switches',       'When switching from a mirrored to no-mirror mode mid-session, verify no orphaned mirror coordinates remain.'],
    ['', 'Set Map Size First',        'Mirror math depends entirely on Map Size — set it before placing any coordinates or mirrors land in wrong positions.'],
  ].map(([icon, title, desc]) => (
    <div key={title} className="help-adv-practice-card">
      <div className="help-adv-practice-icon">{icon}</div>
      <h4>{title}</h4><p>{desc}</p>
    </div>
  ))}
</div>
</div>
    </>)}

    {/* ─── EMITTER ASSIGNMENT ─── */}
    {activeAdvancedSubTab === 'emitter' && (<>
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title">Emitter-Category Assignment</h2>
  <p className="help-adv-hero-desc">
    Fine-tune which emitter effects are used for specific card categories.
    This system lets you create visual distinction between different placement types.
    Three matching modes give you full control over how emitters are selected per card.
  </p>
</div>
<div className="help-adv-button-showcase">
  <div className="help-adv-fake-button" style={{ background: 'var(--wreckages-color)', color: '#000', border: 'none', boxShadow: '0 0 20px var(--wreckages-glow)' }}>
    CONFIGURE ASSIGNMENT
  </div>
  <div className="help-adv-button-hint">Opens the category assignment overlay</div>
</div>
</div>

<div className="help-adv-technical">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Core Concept</h3>
<div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: '4px solid var(--wreckages-color)', padding: '22px 28px', borderRadius: '4px', marginBottom: '28px' }}>
  <h4 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#fff', fontWeight: 600 }}>What this solves</h4>
  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.92rem', marginBottom: '16px' }}>
    By default, all emitter paths are used for all cards. With category assignment you can:
  </p>
  <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.9, paddingLeft: '22px', fontSize: '0.92rem' }}>
    <li><strong style={{ color: '#fff' }}>Visual variety:</strong> Different card types use different effects</li>
    <li><strong style={{ color: '#fff' }}>Thematic consistency:</strong> Lava zones get fire emitters, snow zones get frost</li>
    <li><strong style={{ color: '#fff' }}>Exclusion control:</strong> Prevent certain effects from appearing in specific areas</li>
    <li><strong style={{ color: '#fff' }}>Organised output:</strong> Category tags also appear in the generated README</li>
  </ul>
</div>

<div className="help-adv-timeline">
  {[
    { n: '1', title: 'Add categories to cards', desc: 'Open an emitter card and click "+ Add Category". Use names like "Lava", "Snow", "T3", "Experimental".', code: 'Card: DustCloud\nCategories: ["Fog", "Dense"]' },
    { n: '2', title: 'Configure the assignment', desc: 'Click "Configure Emitter-Category Assignment". Each category row shows toggle buttons for every emitter path.', note: 'red = active  ·  Gray = excluded' },
    { n: '3', title: 'Choose a matching mode', desc: 'Smart mode uses 3-tier logic for the most precise match. Simple Union collects all relevant emitters. Last Category Only uses only the most specific tag.' },
  ].map(s => (
    <div key={s.n} className="help-adv-step">
      <div className="help-adv-step-num">{s.n}</div>
      <div className="help-adv-step-content">
        <h4>{s.title}</h4>
        <p>{s.desc}</p>
        {s.code && <div className="help-adv-code-block" style={{ marginTop: '10px' }}><pre><code>{s.code}</code></pre></div>}
        {s.note && <div className="help-adv-note" style={{ marginTop: '10px' }}>{s.note}</div>}
      </div>
    </div>
  ))}
</div>
</div>

    
<div className="help-adv-technical">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Matching Modes</h3>
</div>

{/* Sub-Tabs für Emitter Categories */}
    <div style={{
display: 'flex',
gap: '12px',
marginBottom: '30px',
padding: '8px',
background: 'rgba(255, 255, 255, 0.03)',
borderRadius: '12px',
border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
<button
onClick={() => setActiveEmitterHelpSubTab('smart')}
style={{
flex: 1,
padding: '15px 25px',
background: activeEmitterHelpSubTab === 'smart' ? 'var(--wreckages-color)' : 'rgba(255, 255, 255, 0.05)',
color: activeEmitterHelpSubTab === 'smart' ? '#000' : 'rgba(255, 255, 255, 0.6)',
border: `2px solid ${activeEmitterHelpSubTab === 'smart' ? 'var(--wreckages-color)' : 'transparent'}`,
borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
boxShadow: activeEmitterHelpSubTab === 'smart' ? '0 0 16px var(--wreckages-glow)' : 'none',
}}
onMouseEnter={(e) => { if (activeEmitterHelpSubTab !== 'smart') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; } }}
onMouseLeave={(e) => { if (activeEmitterHelpSubTab !== 'smart') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; } }}
>
<span></span> Smart Combination (3-Tier)
</button>

<button
onClick={() => setActiveEmitterHelpSubTab('simple')}
style={{
flex: 1,
padding: '15px 25px',
background: activeEmitterHelpSubTab === 'simple' ? 'var(--wreckages-color)' : 'rgba(255, 255, 255, 0.05)',
color: activeEmitterHelpSubTab === 'simple' ? '#000' : 'rgba(255, 255, 255, 0.6)',
border: `2px solid ${activeEmitterHelpSubTab === 'simple' ? 'var(--wreckages-color)' : 'transparent'}`,
borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
boxShadow: activeEmitterHelpSubTab === 'simple' ? '0 0 16px var(--wreckages-glow)' : 'none',
}}
onMouseEnter={(e) => { if (activeEmitterHelpSubTab !== 'simple') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; } }}
onMouseLeave={(e) => { if (activeEmitterHelpSubTab !== 'simple') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; } }}
>
<span></span> Simple Union
</button>

<button
onClick={() => setActiveEmitterHelpSubTab('lastCategory')}
style={{
flex: 1,
padding: '15px 25px',
background: activeEmitterHelpSubTab === 'lastCategory' ? 'var(--wreckages-color)' : 'rgba(255, 255, 255, 0.05)',
color: activeEmitterHelpSubTab === 'lastCategory' ? '#000' : 'rgba(255, 255, 255, 0.6)',
border: `2px solid ${activeEmitterHelpSubTab === 'lastCategory' ? 'var(--wreckages-color)' : 'transparent'}`,
borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
boxShadow: activeEmitterHelpSubTab === 'lastCategory' ? '0 0 16px var(--wreckages-glow)' : 'none',
}}
onMouseEnter={(e) => { if (activeEmitterHelpSubTab !== 'lastCategory') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; } }}
onMouseLeave={(e) => { if (activeEmitterHelpSubTab !== 'lastCategory') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; } }}
>
<span></span> Last Category Only
</button>
    </div>

    {/* SMART MODE CONTENT */}
    {activeEmitterHelpSubTab === 'smart' && (
<>
{/* Hero Section */}
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title">
    <span className="help-adv-card-icon"></span>
    Emitter-Category Assignment (Smart Mode)
  </h2>
  <p className="help-adv-hero-desc">
    Fine-tune which emitter effects are assigned to specific unit categories.
    This system lets you create visual variety by assigning different effects to different unit types.
    For example: Land units can use ground smoke, while Naval units get water splash effects.
    The system uses intelligent 3-tier matching logic to always find the best emitter for each unit.
  </p>
</div>
</div>

{/* How It Works - Core Concept */}
<div className="help-adv-process">
<h3 className="help-adv-section-header">
  <span className="help-adv-section-num">02A</span>
  Core Concept
</h3>

<div style={{ 
  background: 'rgba(255, 255, 255, 0.05)', 
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderLeft: '4px solid #FFFFFF',
  padding: '25px 30px',
  borderRadius: '8px',
  marginBottom: '30px'
}}>
  <h4 style={{ 
    fontSize: '1.2rem', 
    marginBottom: '15px', 
    color: '#FFFFFF',
    fontWeight: '600' 
  }}>
    The Problem This Solves
  </h4>
  <p style={{ 
    color: 'var(--text-secondary)', 
    lineHeight: '1.8', 
    fontSize: '0.95rem',
    marginBottom: '20px'
  }}>
    By default, all emitters are randomly assigned to all cards. But you might want:
  </p>
  <ul style={{ 
    color: 'var(--text-secondary)', 
    lineHeight: '1.9', 
    paddingLeft: '25px',
    fontSize: '0.95rem'
  }}>
    <li><strong style={{ color: '#ffffff' }}>Visual Variety:</strong> Different zone types should look different (Desert vs Coastal)</li>
    <li><strong style={{ color: '#ffffff' }}>Thematic Consistency:</strong> Volcanic zones might need fire effects, valleys need haze</li>
    <li><strong style={{ color: '#ffffff' }}>Scale Appropriateness:</strong> Industrial areas need heavier, more dramatic plumes</li>
    <li><strong style={{ color: '#ffffff' }}>Exclusion Control:</strong> Prevent certain effects from appearing on specific zone types</li>
  </ul>
</div>

<div className="help-adv-timeline">
  <div className="help-adv-step">
    <div className="help-adv-step-num">1</div>
    <div className="help-adv-step-content">
<h4>Define Card Categories</h4>
<p>Add categories to your Emitter Card (e.g., "Desert", "Coastal")</p>
<div className="help-adv-code-block" style={{ marginTop: '12px' }}>
<code>Card: Dust_Cloud<br/>Categories: ["Desert", "Dry", "Lowland"]</code>
</div>
    </div>
  </div>

  <div className="help-adv-step-num">→</div>

  <div className="help-adv-step">
    <div className="help-adv-step-num">2</div>
    <div className="help-adv-step-content">
<h4>Configure Emitter Assignments</h4>
<p>Toggle which emitters should be used for each category</p>
<div className="help-adv-note" style={{ marginTop: '12px' }}>
<strong>Cyan = Active</strong> (emitter assigned to this category)<br/>
<strong>Gray = Inactive</strong> (emitter excluded)
</div>
    </div>
  </div>

  <div className="help-adv-step-num">→</div>

  <div className="help-adv-step">
    <div className="help-adv-step-num">3</div>
    <div className="help-adv-step-content">
<h4>Smart Matching</h4>
<p>System automatically selects best emitters for each card during generation</p>
<div className="help-adv-note" style={{ marginTop: '12px' }}>
<strong>3-Tier</strong> matching logic
</div>
    </div>
  </div>
</div>
</div>

{/* 3-Tier Matching Logic */}
<div className="help-adv-technical">
<h3 className="help-adv-section-header">
  <span className="help-adv-section-num">02B</span>
  3-Tier Matching Logic (Smart Combination)
</h3>

<div style={{ 
  background: 'rgba(255, 255, 255, 0.03)', 
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  padding: '25px',
  marginBottom: '30px'
}}>
  <p style={{ 
    color: 'var(--text-secondary)', 
    lineHeight: '1.8', 
    fontSize: '0.95rem',
    marginBottom: '0'
  }}>
    When generating files, the system intelligently selects emitters for each Card using a <strong style={{ color: '#FFFFFF' }}>3-tier priority system</strong>. 
    This ensures every Card gets the most fitting emitter, with graceful fallbacks when perfect matches aren't available.
  </p>
</div>

{/* Logic Flow Visualization */}
<div style={{ 
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
  border: '2px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  padding: '30px',
  marginBottom: '35px'
}}>
  <h4 style={{ 
    fontSize: '1.25rem', 
    marginBottom: '20px', 
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.1em'
  }}>
    The Decision Process
  </h4>

  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '20px',
    maxWidth: '900px',
    margin: '0 auto'
  }}>
    {/* Step 1 */}
    <div style={{
display: 'flex',
alignItems: 'center',
gap: '20px',
padding: '20px',
background: 'rgba(76, 175, 80, 0.1)',
border: '2px solid rgba(76, 175, 80, 0.3)',
borderRadius: '8px'
    }}>
<div style={{
minWidth: '40px',
height: '40px',
borderRadius: '50%',
background: '#4CAF50',
color: '#000',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
fontSize: '1.2rem',
fontWeight: '700'
}}>1</div>
<div style={{ flex: 1 }}>
<strong style={{ color: '#4CAF50', fontSize: '1.05rem' }}>Perfect Match?</strong>
<p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
  Are there emitters active for <strong style={{ color: '#FFFFFF' }}>ALL</strong> of the card's categories?
</p>
</div>
<div style={{ fontSize: '1.5rem' }}>→</div>
    </div>

    {/* Step 2 */}
    <div style={{
display: 'flex',
alignItems: 'center',
gap: '20px',
padding: '20px',
background: 'rgba(33, 150, 243, 0.1)',
border: '2px solid rgba(33, 150, 243, 0.3)',
borderRadius: '8px'
    }}>
<div style={{
minWidth: '40px',
height: '40px',
borderRadius: '50%',
background: '#2196F3',
color: '#000',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
fontSize: '1.2rem',
fontWeight: '700'
}}>2</div>
<div style={{ flex: 1 }}>
<strong style={{ color: '#2196F3', fontSize: '1.05rem' }}>Partial Match?</strong>
<p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
  If no perfect match, are there emitters active for <strong style={{ color: '#FFFFFF' }}>AT LEAST ONE</strong> of the card's categories?
</p>
</div>
<div style={{ fontSize: '1.5rem' }}>→</div>
    </div>

    {/* Step 3 */}
    <div style={{
display: 'flex',
alignItems: 'center',
gap: '20px',
padding: '20px',
background: 'rgba(255, 152, 0, 0.1)',
border: '2px solid rgba(255, 152, 0, 0.3)',
borderRadius: '8px'
    }}>
<div style={{
minWidth: '40px',
height: '40px',
borderRadius: '50%',
background: '#FF9800',
color: '#000',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
fontSize: '1.2rem',
fontWeight: '700'
}}>3</div>
<div style={{ flex: 1 }}>
<strong style={{ color: '#FF9800', fontSize: '1.05rem' }}>Fallback</strong>
<p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
  If nothing matches, use <strong style={{ color: '#FFFFFF' }}>ALL</strong> configured emitters as a safety net
</p>
</div>
<div style={{ fontSize: '1.5rem' }}>✓</div>
    </div>
  </div>

  <div style={{
    marginTop: '25px',
    padding: '18px 25px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    borderLeft: '4px solid #FFFFFF'
  }}>
    <strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>Key Principle:</strong>
    <p style={{ 
margin: '8px 0 0', 
color: 'var(--text-secondary)', 
fontSize: '0.9rem',
lineHeight: '1.7'
    }}>
Use the <strong style={{ color: '#FFFFFF' }}>most specific</strong> emitters that match. 
If nothing is specific enough, use what <strong style={{ color: '#FFFFFF' }}>partially matches</strong>. 
If nothing matches at all, use <strong style={{ color: '#FFFFFF' }}>everything</strong> as a safety net.
    </p>
  </div>
</div>

{/* Practical Logic Examples */}
<div style={{ 
  marginBottom: '35px'
}}>
  <h4 style={{ 
    fontSize: '1.2rem', 
    marginBottom: '20px', 
    color: '#FFFFFF',
    fontWeight: '600'
  }}>
    Logic Examples - See It In Action
  </h4>

  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    {/* Example 1: Perfect Match */}
    <div style={{
background: 'rgba(255, 255, 255, 0.03)',
border: '1px solid rgba(76, 175, 80, 0.3)',
borderLeft: '4px solid #4CAF50',
borderRadius: '8px',
padding: '20px'
    }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
<span style={{ fontSize: '1.5rem' }}></span>
<strong style={{ color: '#4CAF50', fontSize: '1rem' }}>Scenario 1: Perfect Match</strong>
</div>
<div className="help-adv-code-sample">
<pre><code>{`Card Categories: ["Smoke", "Dense"]

Configuration:
 SMOKE:  Emitter_X `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Y `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Z `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
 DENSE: Emitter_X `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Y `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Z `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

Result: Uses only X and Y
Why: Both X and Y are active for BOTH categories (perfect match)`}</code></pre>
</div>
    </div>

    {/* Example 2: Partial Match */}
    <div style={{
background: 'rgba(255, 255, 255, 0.03)',
border: '1px solid rgba(33, 150, 243, 0.3)',
borderLeft: '4px solid #2196F3',
borderRadius: '8px',
padding: '20px'
    }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
<span style={{ fontSize: '1.5rem' }}></span>
<strong style={{ color: '#2196F3', fontSize: '1rem' }}>Scenario 2: Partial Match</strong>
</div>
<div className="help-adv-code-sample">
<pre><code>{`Card Categories: ["Smoke", "Dense"]

Configuration:
 SMOKE:  Emitter_X `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Y `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Z `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
 DENSE: Emitter_X `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Y `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  |  Emitter_Z `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

Result: Uses X and Y
Why: X matches both (partial), Y matches Smoke (partial)
No perfect match exists, so partial matches are used`}</code></pre>
</div>
    </div>

    {/* Example 3: Fallback */}
    <div style={{
background: 'rgba(255, 255, 255, 0.03)',
border: '1px solid rgba(255, 152, 0, 0.3)',
borderLeft: '4px solid #FF9800',
borderRadius: '8px',
padding: '20px'
    }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
<span style={{ fontSize: '1.5rem' }}></span>
<strong style={{ color: '#FF9800', fontSize: '1rem' }}>Scenario 3: Fallback (Everything Disabled)</strong>
</div>
<div className="help-adv-code-sample">
<pre><code>{`Card Categories: ["Water"]

Configuration:
 DESERT:  Emitter_X `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Y `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  |  Emitter_Z `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
 COASTAL: Emitter_X `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  |  Emitter_Y `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_Z `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
 WATER: Emitter_X `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  |  Emitter_Y `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  |  Emitter_Z `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  ← All disabled!

Result: Uses X, Y, and Z (ALL emitters)
Why: Nothing is active for Water, so fallback activates
This prevents cards from having no emitters at all`}</code></pre>
</div>
    </div>

    {/* Example 4: Cross-Category */}
    <div style={{
background: 'rgba(255, 255, 255, 0.03)',
border: '1px solid rgba(156, 39, 176, 0.3)',
borderLeft: '4px solid #9C27B0',
borderRadius: '8px',
padding: '20px'
    }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
<span style={{ fontSize: '1.5rem' }}></span>
<strong style={{ color: '#9C27B0', fontSize: '1rem' }}>Scenario 4: Cross-Zone Configuration</strong>
</div>
<div className="help-adv-code-sample">
<pre><code>{`Three separate cards evaluated individually:

Card A: ["Desert"]  vs   DESERT:  X`}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Y`}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Z`}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`   → Gets X (perfect)
Card B: ["Coastal"] vs   COASTAL: X`}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Y`}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Z`}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  → Gets Y (perfect)
Card C: ["Water"]   vs   WATER:   X`}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Y`}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Z`}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  → Gets X,Y,Z (fallback)

Important: Each card is evaluated independently!
Card C doesn't get X or Y just because they're active somewhere else`}</code></pre>
</div>
    </div>
  </div>
</div>

{/* Critical Understanding Box */}
<div style={{
  background: 'rgba(255, 193, 7, 0.1)',
  border: '2px solid rgba(255, 193, 7, 0.4)',
  borderRadius: '8px',
  padding: '25px',
  marginBottom: '35px'
}}>
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
    <span style={{ fontSize: '2rem', marginTop: '5px' }}></span>
    <div>
<h4 style={{ 
color: '#FFC107', 
fontSize: '1.1rem', 
marginBottom: '12px',
fontWeight: '600'
}}>
Critical Understanding: The Fallback is a Safety Net
</h4>
<p style={{ 
color: 'var(--text-secondary)', 
lineHeight: '1.8',
fontSize: '0.95rem',
margin: 0
}}>
The Tier 3 fallback exists to prevent Cards from having <strong style={{ color: '#FFFFFF' }}>zero emitters</strong>.
If you disable all emitters for a category, the system falls back to all emitters.
This ensures every placed Card always has at least one effect.
</p>
<p style={{ 
color: 'var(--text-secondary)', 
lineHeight: '1.8',
fontSize: '0.95rem',
marginTop: '12px',
marginBottom: 0
}}>
<strong style={{ color: '#FFFFFF' }}>Example:</strong> If you set the "Coastal" category to have NO active emitters,
Coastal cards will receive ALL emitters as a fallback — not zero.
</p>
    </div>
  </div>
</div>

{/* Three Technical Cards */}
<div className="help-adv-card-grid">
  <div className="help-adv-card">
    <div className="help-adv-card-header">
<span className="help-adv-card-icon"></span>
<h4>Tier 1: Perfect Match</h4>
    </div>
    <div className="help-adv-card-body">
<p className="help-adv-card-desc">
Emitters that are active for <strong>ALL</strong> categories.
</p>

<div className="help-adv-code-sample">
<div className="help-adv-code-label">Example:</div>
<pre><code>{`Card: Fog_Marker
Categories: ["Smoke", "Dense"]

Emitter Status:
- Heavy_Smoke:  `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Smoke, `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Dense  ← PERFECT MATCH!
- Light_Smoke:  `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Smoke, `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Dense
- Fire_Effect:  `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Smoke, `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Dense

Selected: Heavy_Smoke only`}</code></pre>
</div>

<ul className="help-adv-card-features">
<li><strong>Highest Priority:</strong> These are your custom-configured emitters</li>
<li><strong>Most Specific:</strong> Designed exactly for this category combination</li>
<li><strong>Best Control:</strong> Full artistic control over exact combinations</li>
</ul>
    </div>
  </div>

  <div className="help-adv-card">
    <div className="help-adv-card-header">
<span className="help-adv-card-icon"></span>
<h4>Tier 2: Partial Match</h4>
    </div>
    <div className="help-adv-card-body">
<p className="help-adv-card-desc">
Emitters active for <strong>at least ONE</strong> category (used if no perfect match exists).
</p>

<div className="help-adv-code-sample">
<div className="help-adv-code-label">Example:</div>
<pre><code>{`Card Categories: ["Smoke", "Dense"]

Emitter Status:
- Light_Smoke:  `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Smoke, `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Dense  ← Partial (Smoke)
- Fire_Effect:  `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Smoke, `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{` Dense  ← Partial (Dense)
- Sand_Drift:   `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Smoke, `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Dense

Selected: Light_Smoke + Fire_Effect`}</code></pre>
</div>

<ul className="help-adv-card-features">
<li><strong>Fallback Layer:</strong> Used when perfect matches don't exist</li>
<li><strong>Broader Pool:</strong> More emitters to choose from</li>
<li><strong>Still Relevant:</strong> At least one category matches the card</li>
</ul>
    </div>
  </div>

  <div className="help-adv-card">
    <div className="help-adv-card-header">
<span className="help-adv-card-icon"></span>
<h4>Tier 3: Universal Fallback</h4>
    </div>
    <div className="help-adv-card-body">
<p className="help-adv-card-desc">
All configured emitters (used if no matches at all).
</p>

<div className="help-adv-code-sample">
<div className="help-adv-code-label">Example:</div>
<pre><code>{`Card Categories: ["Water", "Coastal"]

Emitter Status:
- Dust_Cloud:   `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Water, `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Coastal
- Sand_Drift:   `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Water, `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Coastal
- Steam_Vent:   `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Water, `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{` Coastal

Selected: All three emitters (fallback)`}</code></pre>
</div>

<ul className="help-adv-card-features">
<li><strong>Safety Net:</strong> Guarantees every card gets an emitter</li>
<li><strong>No Configuration Required:</strong> Works even without category setup</li>
<li><strong>Graceful Degradation:</strong> System never fails</li>
</ul>
    </div>
  </div>
</div>
</div>

{/* Practical Examples */}
<div className="help-adv-structure">
<h3 className="help-adv-section-header">
  <span className="help-adv-section-num">02C</span>
  Practical Configuration Examples
</h3>

<div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
  {/* Example 1 */}
  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '25px', borderLeft: '4px solid #4CAF50' }}>
    <h4 style={{ fontSize: '1.15rem', marginBottom: '15px', color: '#4CAF50', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
<span></span> Example 1: Zone-Based Intensity
    </h4>
    <div style={{ marginBottom: '20px' }}>
<strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>Goal:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
Different smoke density depending on the placement zone
</p>
    </div>
    <div className="help-adv-code-sample">
<div className="help-adv-code-label">Configuration:</div>
<pre><code>{`Categories in Overlay:

 Valley
  Light_Haze `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Dense_Smoke `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Heavy_Plume `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

 Midground
  Light_Haze `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Dense_Smoke `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Heavy_Plume `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

 Industrial
  Light_Haze `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Dense_Smoke `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Heavy_Plume `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span></code></pre>
    </div>
    <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#4CAF50', fontSize: '0.9rem' }}>Result:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>
Valley cards get light haze, midground gets dense smoke, industrial zones get heavy plumes. Perfect visual layering!
</p>
    </div>
  </div>

  {/* Example 2 */}
  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '25px', borderLeft: '4px solid #2196F3' }}>
    <h4 style={{ fontSize: '1.15rem', marginBottom: '15px', color: '#2196F3', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
<span></span> Example 2: Terrain Type Theming
    </h4>
    <div style={{ marginBottom: '20px' }}>
<strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>Goal:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
Different effects for different terrain types on the same map
</p>
    </div>
    <div className="help-adv-code-sample">
<div className="help-adv-code-label">Configuration:</div>
<pre><code>{`Categories in Overlay:

 Desert
  Sand_Drift `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Steam_Vent `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Dust_Cloud `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`

 Volcanic
  Sand_Drift `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Steam_Vent `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Dust_Cloud `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

 Coastal
  Sand_Drift `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Steam_Vent `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Dust_Cloud `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span></code></pre>
    </div>
    <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#2196F3', fontSize: '0.9rem' }}>Result:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>
Desert cards blow sand, volcanic zones emit steam, coastal areas mix steam and dust. Each zone feels unique!
</p>
    </div>
  </div>

  {/* Example 3 */}
  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '25px', borderLeft: '4px solid #FF9800' }}>
    <h4 style={{ fontSize: '1.15rem', marginBottom: '15px', color: '#FF9800', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
<span></span> Example 3: Combined Categories (Smart Matching!)
    </h4>
    <div style={{ marginBottom: '20px' }}>
<strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>Goal:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
Special effects for specific zone combinations (e.g., "Volcanic + Dense")
</p>
    </div>
    <div className="help-adv-code-sample">
<div className="help-adv-code-label">Configuration:</div>
<pre><code>{`Card: Caldera Vents
Categories: ["Volcanic", "Dense", "Center"]

Categories in Overlay:

 Volcanic
  Lava_Glow `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Mega_Plume `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

 Dense
  Lava_Glow `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Mega_Plume `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

 Center
  Lava_Glow `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Mega_Plume `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span></code></pre>
    </div>
    <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#FF9800', fontSize: '0.9rem' }}>Smart Matching Result:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>
<strong style={{ color: '#FFFFFF' }}>Perfect Match:</strong> Only Lava_Glow (active for all 3 categories)<br/>
Enable Mega_Plume for Volcanic + Dense too and both emitters become available for center placements!
</p>
    </div>
  </div>
</div>
</div>
</>
    )}

    {/* SIMPLE MODE CONTENT */}
    {activeEmitterHelpSubTab === 'simple' && (
<>
{/* Hero Section */}
<div className="help-adv-hero">
<div className="help-adv-hero-content">
  <h2 className="help-adv-hero-title">
    <span className="help-adv-card-icon"></span>
    Emitter-Category Assignment (Simple Union Mode)
  </h2>
  <p className="help-adv-hero-desc">
    Simple Union mode offers a straightforward approach: any card with a matching category gets ALL emitters
    that are active for that category. No complex matching logic — just collect all relevant emitters.
    Perfect for broad zone categorization without needing perfect/partial match distinctions.
  </p>
</div>
</div>

{/* How Simple Mode Works */}
<div className="help-adv-process">
<h3 className="help-adv-section-header">
  <span className="help-adv-section-num">02A</span>
  How Simple Union Works
</h3>

<div style={{ 
  background: 'rgba(255, 255, 255, 0.05)', 
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderLeft: '4px solid #FFFFFF',
  padding: '25px 30px',
  borderRadius: '8px',
  marginBottom: '30px'
}}>
  <h4 style={{ 
    fontSize: '1.2rem', 
    marginBottom: '15px', 
    color: '#FFFFFF',
    fontWeight: '600' 
  }}>
    The Core Logic
  </h4>
  <p style={{ 
    color: 'var(--text-secondary)', 
    lineHeight: '1.8', 
    fontSize: '0.95rem',
    marginBottom: '20px'
  }}>
    Unlike Smart Combination which uses 3-tier matching, Simple Union follows one rule:
  </p>
  <div style={{
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    border: '2px solid rgba(255, 255, 255, 0.2)'
  }}>
    <strong style={{ color: '#FFFFFF', fontSize: '1.1rem' }}>
"Use ALL emitters that are active for ANY of the card's categories"
    </strong>
  </div>
</div>

<div className="help-adv-timeline">
  <div className="help-adv-step">
    <div className="help-adv-step-num">1</div>
    <div className="help-adv-step-content">
<h4>Define Card Categories</h4>
<p>Same as Smart Mode: Add categories like "Desert", "Coastal", "Volcanic"</p>
<div className="help-adv-code-block" style={{ marginTop: '12px' }}>
<code>Card: Dust_Cloud<br/>Categories: ["Desert", "Dry"]</code>
</div>
    </div>
  </div>

  <div className="help-adv-step-num">→</div>

  <div className="help-adv-step">
    <div className="help-adv-step-num">2</div>
    <div className="help-adv-step-content">
<h4>Configure Emitters</h4>
<p>Toggle emitters for each category (cyan = active)</p>
<div className="help-adv-note" style={{ marginTop: '12px' }}>
Configuration is the same, but matching logic differs
</div>
    </div>
  </div>

  <div className="help-adv-step-num">→</div>

  <div className="help-adv-step">
    <div className="help-adv-step-num">3</div>
    <div className="help-adv-step-content">
<h4>Union Matching</h4>
<p>Collect ALL emitters active for ANY category</p>
<div className="help-adv-note" style={{ marginTop: '12px' }}>
<strong>OR</strong> logic, not AND
</div>
    </div>
  </div>
</div>
</div>

{/* Comparison with Smart Mode */}
<div className="help-adv-technical">
<h3 className="help-adv-section-header">
  <span className="help-adv-section-num">02B</span>
  Simple vs Smart: The Key Difference
</h3>

<div style={{ 
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  marginBottom: '35px'
}}>
  {/* Smart Mode Card */}
  <div style={{
    background: 'rgba(76, 175, 80, 0.1)',
    border: '2px solid rgba(76, 175, 80, 0.3)',
    borderRadius: '8px',
    padding: '25px'
  }}>
    <h4 style={{ color: '#4CAF50', fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
<span></span> Smart Combination
    </h4>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.7', marginBottom: '15px' }}>
Tries to find the MOST SPECIFIC match:
    </p>
    <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', paddingLeft: '20px' }}>
<li>Tier 1: Perfect Match (ALL categories)</li>
<li>Tier 2: Partial Match (ANY category)</li>
<li>Tier 3: Fallback (everything)</li>
    </ul>
    <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#4CAF50', fontSize: '0.85rem' }}>Best for:</strong>
<p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '5px 0 0', lineHeight: '1.5' }}>
Precise control, special combinations, tight emitter sets
</p>
    </div>
  </div>

  {/* Simple Mode Card */}
  <div style={{
    background: 'rgba(33, 150, 243, 0.1)',
    border: '2px solid rgba(33, 150, 243, 0.3)',
    borderRadius: '8px',
    padding: '25px'
  }}>
    <h4 style={{ color: '#2196F3', fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
<span></span> Simple Union
    </h4>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.7', marginBottom: '15px' }}>
Collects ALL matching emitters:
    </p>
    <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', paddingLeft: '20px' }}>
<li>If ANY category matches → add emitter</li>
<li>Result: Union of all matches</li>
<li>No priority tiers</li>
    </ul>
    <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#2196F3', fontSize: '0.85rem' }}>Best for:</strong>
<p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '5px 0 0', lineHeight: '1.5' }}>
Broad categorization, maximum variety, simpler logic
</p>
    </div>
  </div>
</div>

{/* Side-by-Side Example */}
<div style={{ 
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
  border: '2px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  padding: '30px',
  marginBottom: '35px'
}}>
  <h4 style={{ 
    fontSize: '1.25rem', 
    marginBottom: '20px', 
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.1em'
  }}>
    Same Configuration, Different Results
  </h4>

  <div className="help-adv-code-sample">
    <pre><code>{`Card Categories: ["Smoke", "Dense"]

Configuration:
 SMOKE: Emitter_A `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_B `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_C `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
 DENSE: Emitter_A `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`  |  Emitter_B `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`  |  Emitter_C `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`

 Smart Combination Result:
   → Perfect Match: Only Emitter_A (active for BOTH Smoke AND Dense)
   → Emitter_B and C are excluded (not perfect matches)

 Simple Union Result:
   → Union of matches: Emitter_A, B, C (all active for at least ONE category)
   → A: ✓Smoke ✓Dense  |  B: ✓Smoke  |  C: ✓Dense`}</code></pre>
  </div>

  <div style={{
    marginTop: '20px',
    padding: '18px 25px',
    background: 'rgba(255, 193, 7, 0.1)',
    borderRadius: '8px',
    borderLeft: '4px solid #FFC107'
  }}>
    <strong style={{ color: '#FFC107', fontSize: '0.95rem' }}>Key Takeaway:</strong>
    <p style={{ 
margin: '8px 0 0', 
color: 'var(--text-secondary)', 
fontSize: '0.9rem',
lineHeight: '1.7'
    }}>
Smart Mode gives you <strong style={{ color: '#FFFFFF' }}>one emitter</strong> (the perfect match).
Simple Mode gives you <strong style={{ color: '#FFFFFF' }}>three emitters</strong> (the union of all category matches).
    </p>
  </div>
</div>
</div>

{/* Practical Examples */}
<div className="help-adv-structure">
<h3 className="help-adv-section-header">
  <span className="help-adv-section-num">02C</span>
  Simple Union Examples
</h3>

<div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
  {/* Example 1 */}
  <div style={{
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '25px',
    borderLeft: '4px solid #2196F3'
  }}>
    <h4 style={{ 
fontSize: '1.15rem', 
marginBottom: '15px', 
color: '#2196F3',
fontWeight: '600',
display: 'flex',
alignItems: 'center',
gap: '10px'
    }}>
<span></span> Example 1: Broad Categorization
    </h4>
    
    <div style={{ marginBottom: '20px' }}>
<strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>Scenario:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
You want Desert cards to use "any emitter suitable for desert OR dry zones"
</p>
    </div>

    <div className="help-adv-code-sample">
<div className="help-adv-code-label">Configuration:</div>
<pre><code>{`Card: Dune_Marker
Categories: ["Desert", "Dry"]

 DESERT
  Sand_Drift `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`
  Dust_Cloud `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

 DRY
  Sand_Drift `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
  Dust_Cloud `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`

Simple Union Result:
  → Gets: Sand_Drift + Dust_Cloud
  → Why: Sand_Drift active for Desert, Dust_Cloud active for Dry`}</code></pre>
    </div>

    <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#2196F3', fontSize: '0.9rem' }}>Perfect for:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>
When you want maximum variety without worrying about perfect combinations
</p>
    </div>
  </div>

  {/* Example 2 */}
  <div style={{
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '25px',
    borderLeft: '4px solid #FF9800'
  }}>
    <h4 style={{ 
fontSize: '1.15rem', 
marginBottom: '15px', 
color: '#FF9800',
fontWeight: '600',
display: 'flex',
alignItems: 'center',
gap: '10px'
    }}>
<span></span> Example 2: Multiple Categories
    </h4>
    
    <div style={{ marginBottom: '20px' }}>
<strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>Scenario:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
Card with many categories collects emitters from all of them
</p>
    </div>

    <div className="help-adv-code-sample">
<div className="help-adv-code-label">Configuration:</div>
<pre><code>{`Card: Caldera_Vents
Categories: ["Volcanic", "Dense", "Center"]

 VOLCANIC
  Lava_Glow `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`

 DENSE
  Heavy_Plume `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`

 CENTER
  Steam_Vent `}<span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>{`

Simple Union Result:
  → Gets: Lava_Glow + Heavy_Plume + Steam_Vent
  → Union of all three categories!`}</code></pre>
    </div>

    <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#FF9800', fontSize: '0.9rem' }}>Result:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>
Maximum visual variety by combining effects from all categories
</p>
    </div>
  </div>

  {/* Example 3: Fallback */}
  <div style={{
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    borderRadius: '8px',
    padding: '25px',
    borderLeft: '4px solid #FFC107'
  }}>
    <h4 style={{ 
fontSize: '1.15rem', 
marginBottom: '15px', 
color: '#FFC107',
fontWeight: '600',
display: 'flex',
alignItems: 'center',
gap: '10px'
    }}>
<span></span> Example 3: Fallback Behavior
    </h4>
    
    <div style={{ marginBottom: '20px' }}>
<strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>Scenario:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>
What happens when ALL emitters are disabled for all card categories?
</p>
    </div>

    <div className="help-adv-code-sample">
<div className="help-adv-code-label">Configuration:</div>
<pre><code>{`Card: Shore_Marker
Categories: ["Coastal", "Water"]

 COASTAL: All emitters `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`
 WATER:   All emitters `}<span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>{`

Simple Union Result:
  → No matches found in ANY category
  → Fallback: Uses ALL configured emitters
  → Same safety net as Smart Mode!`}</code></pre>
    </div>

    <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '6px' }}>
<strong style={{ color: '#FFC107', fontSize: '0.9rem' }}>Important:</strong>
<p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>
Both modes share the same fallback: if nothing matches, use everything. This guarantees cards always have effects.
</p>
    </div>
  </div>
</div>
</div>
</>
    )}

    {/* LAST CATEGORY MODE CONTENT */}
{activeEmitterHelpSubTab === 'lastCategory' && (
  <>
    {/* Hero Section */}
    <div className="help-adv-hero">
<div className="help-adv-hero-content">
<h2 className="help-adv-hero-title">
<span className="help-adv-card-icon"></span>
Emitter-Category Assignment (Last Category Only)
</h2>
<p className="help-adv-hero-desc">
Last Category Only mode uses a hierarchical approach: only the LAST category
in a card's category list matters. This is perfect for zone-based organization
where categories become increasingly specific (e.g., "Terrain" → "Volcanic" → "Active").
The system ignores all earlier categories and matches only the most specific one.
</p>
</div>
    </div>

    {/* How It Works */}
    <div className="help-adv-process">
<h3 className="help-adv-section-header">
<span className="help-adv-section-num">02A</span>
How Last Category Only Works
</h3>

<div style={{ 
background: 'rgba(255, 255, 255, 0.05)', 
border: '1px solid rgba(255, 255, 255, 0.15)',
borderLeft: '4px solid #FFFFFF',
padding: '25px 30px',
borderRadius: '8px',
marginBottom: '30px'
}}>
<h4 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#FFFFFF', fontWeight: '600' }}>
The Core Logic
</h4>
<p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '20px' }}>
This mode follows one simple rule:
</p>
<div style={{
padding: '20px',
background: 'rgba(255, 255, 255, 0.08)',
borderRadius: '8px',
border: '2px solid rgba(255, 255, 255, 0.2)'
}}>
<strong style={{ color: '#FFFFFF', fontSize: '1.1rem' }}>
  "Use only emitters active for the LAST category in the card's list"
</strong>
</div>
</div>

{/* Examples */}
<div className="help-adv-code-sample">
<div className="help-adv-code-label">Example:</div>
<pre><code>{`Card Categories: ["Terrain", "Volcanic", "Active"]

Configuration:
 TERRAIN:  Emitter_A ✓  |  Emitter_B ✓  |  Emitter_C ✗
 VOLCANIC: Emitter_A ✗  |  Emitter_B ✓  |  Emitter_C ✓
 ACTIVE:   Emitter_A ✗  |  Emitter_B ✗  |  Emitter_C ✓

Result: Only Emitter_C
Why: "Active" is the last category, only C is active for it`}</code></pre>
</div>
    </div>
  </>
)}

<div className="help-adv-ts-grid">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
{[
  ['All emitters still used after configuring', 'If every emitter for a category is deactivated, the system falls back to all emitters to prevent empty output. Keep at least one active per category.'],
  ['Configure button opens an empty overlay', 'The overlay requires at least one card with a non-empty category AND at least one emitter path. Add both before opening.'],
].map(([q, a]) => (
  <div key={q} className="help-adv-ts-item">
    <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
    <div className="help-adv-ts-a"><p>{a}</p></div>
  </div>
))}
</div>

<div className="help-adv-bp-section">
<h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Best Practices</h3>
<div className="help-adv-practice-grid">
  {[
    ['Start with broad categories', 'Begin with 2–3 general categories like "Land", "T3", "Navy" before adding specificity.'],
    ['Smart mode for precision', 'If you need the tightest control over which emitters appear where, Smart mode\'s 3-tier logic gives the most predictable results.'],
    ['Check the Live Preview', 'The Live Preview sidebar in the assignment overlay shows in real time which emitters each card will receive — use it to verify before generating.'],
  ].map(([title, desc]) => (
    <div key={title} className="help-adv-practice-card">
      <div className="help-adv-practice-icon"></div>
      <h4>{title}</h4><p>{desc}</p>
    </div>
  ))}
</div>
</div>
    </>)}

    {/* ─── GENERATE FILES (full original) ─── */}
    {activeAdvancedSubTab === 'generate' && (
<div className="help-adv-layout">
<>
  <div className="help-adv-hero">
    <div className="help-adv-hero-content">
      <h2 className="help-adv-hero-title"><span className="help-adv-card-icon"></span>Generate Files</h2>
      <p className="help-adv-hero-desc">All unit cards and coordinates are written to per-instance prop + script files, then automatically injected into your .scmap via the built-in parser and repacked — no external tools needed.</p>
    </div>
    <div className="help-adv-button-showcase">
      <div className="help-adv-fake-button" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.9)' }}>GENERATE FILES</div>
      <div className="help-adv-button-hint">SCMAP parser — fully automatic</div>
    </div>
  </div>
  <div className="help-adv-technical">
    <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>What Happens on Generate</h3>
    <div className="help-adv-card-grid">
      {[
        {icon:'',title:'Wreckage + Script Files',desc:'For every coordinate on every unit card, a unique _prop.bp and _script.lua pair is written. The script spawns the unit, creates its wreckage prop, and attaches an emitter via CreateEmitterAtBone.',features:['One file pair per coordinate per unit','Files placed under env/props/emitter/wreckages/[category subfolders if set]/[unitid]/[instance]/','Emitter .bp files copied from your configured source folder to env/props/emitter/ subfolder','Y height (default 26), heading, pitch, roll written per coordinate']},
        {icon:'',title:'SCMAP Injection',desc:'The tool locates the .scmap in your map folder, unpacks it, writes a new numbered props.lua chunk, and repacks it back in place.',features:['No BrewMapTool or external software needed','New props.lua gets a unique index — never overwrites previous chunks','Repacked .scmap overwrites the original automatically','Visible in FA map editor after the next map load']},
        {icon:'',title:'README (optional)',desc:'A plain-text .txt file written to the map root summarising every setting, unit card, coordinate count, emitter paths, and category assignments used at generation time.',features:['Toggle on/off with the checkbox below GENERATE FILES','Includes: map name, size, mirror mode, SCMAP filename, props.lua chunk name, total placements, emitter copy results','Lists every unit: type ID, coordinate count, categories, Y offset, heading','Written to: maps/MapName.v0001/Wreckage_Generation_README.txt']},
      ].map(item=>(
        <div key={item.title} className="help-adv-card">
          <div className="help-adv-card-header">
            <span className="help-adv-card-icon">{item.icon}</span>
            <h4>{item.title}</h4>
          </div>
          <div className="help-adv-card-body">
            <p className="help-adv-card-desc">{item.desc}</p>
            <ul className="help-adv-card-features">
              {item.features.map((f,i)=><li key={i}>{f}</li>)}
            </ul>
          </div>
        </div>
      ))}
    </div>
  </div>
  <div className="help-adv-ts-grid">
    <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Troubleshooting</h3>
    {[
      ['No .scmap found error','The tool needs an existing .scmap in the map folder. Generate the base map in the FA editor first, then run the wreckage generator.'],
      ['Wreckages at wrong positions','Map size is auto-read from save.lua. Verify that Map Name is correct and the map folder with save.lua exists — without it the size falls back to 1024.'],
      ['Wreckages missing after map load','Confirm the repack succeeded (check the success alert). If the .scmap was open in the FA editor during generation, close and reopen it.'],
      ['Wreckage has no smoke/fire','Check the Emitter.bp Folder is set and contains .bp files matching your emitter path rows. Missing folder = emitters not copied.'],
      ["Props.lua index conflict","Each run writes props.lua, props1.lua, props2.lua etc. to avoid collisions. If you see duplicates, check the unpacked folder for existing chunks."],
    ].map(([q,a])=>(
      <div key={q} className="help-adv-ts-item">
        <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
        <div className="help-adv-ts-a"><p>{a}</p></div>
      </div>
    ))}
  </div>
  <div className="help-adv-bp-section">
    <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
    <div className="help-adv-practice-grid">
      {[
        ['Keep the .scmap backed up','Before a large generation run, copy the .scmap somewhere safe. Repack is non-destructive but a backup costs nothing.'],
        ['Enable README','The README documents all settings at generation time — invaluable when returning to a map weeks later.'],
        ['Re-generate Freely','Each run adds a new numbered props.lua chunk — nothing is overwritten. Adjust coordinates and regenerate as many times as needed.'],
        ['Set Y Offset Carefully','Y=26 is typical for flat terrain. Adjust per unit if wreckages sink or float — use Preview to estimate.'],
      ].map(([title,desc])=>(
        <div key={title} className="help-adv-practice-card">
          <div className="help-adv-practice-icon"></div>
          <h4>{title}</h4><p>{desc}</p>
        </div>
      ))}
    </div>
  </div>
  <div className="help-adv-structure">
    <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Generated File Structure</h3>
    <div className="help-adv-file-tree">
      <div className="help-adv-file-tree-header">maps/MyMap.v0001/</div>
      <div className="help-adv-file-item file highlight"><span></span><span>MyMap.v0001.scmap</span><span className="help-adv-file-badge">repacked in place</span></div>
      <div className="help-adv-file-item file "><span></span><span>Wreckage_Generation_README.txt</span><span className="help-adv-file-size">if toggle enabled</span></div>
      <div className="help-adv-file-item folder " style={{paddingTop:'8px'}}><span></span><span>env/props/emitter/wreckages/</span></div>
      <div className="help-adv-file-item file " style={{paddingLeft:'36px'}}><span></span><span>wreck_smoke_01_emit.bp</span><span className="help-adv-file-size">copied emitter</span></div>
      <div className="help-adv-file-item folder " style={{paddingLeft:'36px'}}><span></span><span>Land/T2/</span><span className="help-adv-file-size">category subfolders (if set)</span></div>
      <div className="help-adv-file-item folder " style={{paddingLeft:'60px'}}><span></span><span>UEL0203/</span><span className="help-adv-file-size">unit ID folder</span></div>
      <div className="help-adv-file-item folder " style={{paddingLeft:'84px'}}><span></span><span>uel0203_01/</span></div>
      <div className="help-adv-file-item file " style={{paddingLeft:'108px'}}><span></span><span>uel0203_01_prop.bp</span></div>
      <div className="help-adv-file-item file " style={{paddingLeft:'108px'}}><span></span><span>uel0203_01_script.lua</span></div>
      <div className="help-adv-file-item file " style={{paddingLeft:'108px',opacity:0.5}}><span></span><span>uel0203_02 … _NN</span></div>
    </div>
  </div>
  <div className="help-adv-structure" style={{marginTop:'40px'}}>
    <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>File Contents</h3>
    <div className="help-adv-card-grid">
      {[
        {title:'Wreckage Script (_script.lua)',desc:'Each instance spawns the unit, creates its wreckage prop, attaches an emitter, and destroys the marker.',code:`local Prop = import('/lua/sim/Prop.lua').Prop\n\nuel0203_01 = Class(Prop) {\n  _onCreateExecuted = false,\n  OnCreate = function(self)\n    Prop.OnCreate(self)\n    if uel0203_01._onCreateExecuted then\n      self:Destroy(); return\n    end\n    uel0203_01._onCreateExecuted = true\n    local unit = CreateUnitHPR('uel0203', 'ARMY_17',\n      128.0, 26, 256.0, math.pi, 0.0, math.pi)\n    if unit and unit.DoNotCreateWreckage then\n      unit:DoNotCreateWreckage(true)\n    end\n    local wreck = unit:CreateWreckageProp(0)\n    unit:Destroy()\n    if wreck and wreck.Trash then\n      wreck.Trash:Add(CreateEmitterAtBone(\n        wreck, 0, -1,\n        '/maps/MyMap.v0001/env/props/emitter/wreckages/wreck_smoke.bp'))\n    end\n    self:Destroy()\n  end,\n}\nTypeClass = uel0203_01`},
        {title:'README File (optional)',desc:'A plain-text summary written to the map root when the README toggle is enabled.',code:`╔════════════════════════════════════════╗\n║  WRECKAGE GENERATION — README          ║\n╚════════════════════════════════════════╝\n\n  Generated  : 10/03/2026 at 14:22\n  Tool       : ForgeMapToolkit — Wreckage Tab\n\n  MAP SETTINGS\n  Map Name   : MyMap.v0001\n  Map Size   : 1024 × 1024\n  Mirror Mode: diagonal\n\n  OUTPUT SUMMARY\n  SCMAP file : MyMap.v0001.scmap  ← repacked\n  Props chunk: props1.lua\n  Total placements: 20\n  Emitters copied: 3\n\n  UNIT CARDS\n  [01] UEL0203\n       Coordinates : 10\n       Categories  : uef, tank\n       Y offset    : 26\n       Heading     : math.pi`},
      ].map(item=>(
        <div key={item.title} className="help-adv-card">
          <div className="help-adv-card-header"><h4>{item.title}</h4></div>
          <div className="help-adv-card-body">
            <p className="help-adv-card-desc">{item.desc}</p>
            <div className="help-adv-code-sample" style={{marginTop:'12px'}}>
              <div className="help-adv-code-label">Example output:</div>
              <pre><code>{item.code}</code></pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</>
</div>
    )}

  </div>
)}

    </div>
  </div>
</>

  );
}

export default WreckageHelpModal;
