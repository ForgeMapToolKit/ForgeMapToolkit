import React from "react";

// ── PropsHelpModal ────────────────────────────────────────────────────────────

function PropsHelpModal({ onClose, activeHelpTab, setActiveHelpTab, helpGuideSelected, setHelpGuideSelected, activeAdvancedSubTab, setActiveAdvancedSubTab, mirrorMode }) {
  return (
<>
  <div className="help-modal-overlay" onClick={() => onClose()} />
  <div className="help-modal" style={{ '--tab-color': 'var(--props-color)', '--tab-glow': 'var(--props-glow)', '--tab-glow-strong': 'var(--props-glow-strong)' }} onClick={(e) => e.stopPropagation()}>

    <div className="help-modal-header">
      <h2 className="help-modal-title">Props Tab — Help Guide</h2>
      <button className="help-modal-close" onClick={() => onClose()}>×</button>
    </div>

    <div className="help-modal-tabs">
      {[
        { id: 'help-guide', label: 'Help Guide' },
        { id: 'advanced',   label: 'Advanced Guide' },
      ].map(t => (
        <button key={t.id}
          className={`help-modal-tab ${activeHelpTab === t.id ? 'active' : ''}`}
          onClick={() => { setActiveHelpTab(t.id); if (t.id === 'help-guide') setHelpGuideSelected(null); }}
        >{t.label}</button>
      ))}
    </div>

    <div className="help-modal-content">

{activeHelpTab === 'help-guide' && (
<div style={{ display: 'flex', gap: '40px', height: '100%' }}>

      <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(165,232,1,0.08)' }}>
    <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: 'rgba(165,232,1,0.5)', fontSize: '1rem' }}>↗</span> Click any element to learn about it
    </div>

    <div className="tab-grid" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 'none', margin: 0 }}>

              <div className="tab-col-config">

                  <div className="section-card" style={{ marginBottom: '16px' }}>
          <h2 className="section-title">CONFIGURATION</h2>

          <div className="form-group" onClick={() => setHelpGuideSelected('mapname')} style={{ cursor: 'pointer' }}>
            <label className="form-label">Map Name</label>
            <input readOnly onChange={() => {}} className="form-input" value="" placeholder="Hades_Dust.v0002"
              style={{ outline: helpGuideSelected === 'mapname' ? '2px solid var(--props-color)' : 'none' }} />
          </div>

          <div className="form-group" onClick={() => setHelpGuideSelected('mapsize')} style={{ cursor: 'pointer', outline: helpGuideSelected === 'mapsize' ? '2px solid var(--props-color)' : 'none', padding: '4px', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
              <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>MAP</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>1024 × 1024</span>
              <span style={{ color: 'rgba(255,255,255,0.22)' }}>·</span>
              <span>20 km</span>
              <span style={{ color: 'rgba(165,232,1,0.45)', fontSize: '0.6rem', marginLeft: '4px' }}>← auto-detected</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Emitters</label>
            <div className="input-row" onClick={() => setHelpGuideSelected('emitterrow')} style={{ cursor: 'pointer', marginBottom: '8px' }}>
              <input readOnly onChange={() => {}} className="form-input" value="" placeholder="/maps/mapname.v0001/env/emitters/..."
                style={{ outline: helpGuideSelected === 'emitterrow' ? '2px solid var(--props-color)' : 'none' }} />
              <button className="btn-delete-sm">×</button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setHelpGuideSelected('addemitter')} style={{ flex: 1, outline: helpGuideSelected === 'addemitter' ? '2px solid var(--props-color)' : 'none' }}>+ ADD EMITTER</button>
              <button className="btn-library" onClick={() => setHelpGuideSelected('emitterlibrary')} style={{ outline: helpGuideSelected === 'emitterlibrary' ? '2px solid var(--props-color)' : 'none' }}>Library</button>
            </div>
          </div>
        </div>

                  <div className="section-card" style={{ marginBottom: '16px' }}>
          <h2 className="section-title">PROPS</h2>
          <div className="props-props-grid">

                          <div className="props-prop-card selected" style={{ cursor: 'default' }}>
              <div className="props-prop-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div className="props-color-indicator" onClick={() => setHelpGuideSelected('propcolor')}
                    style={{ backgroundColor: '#A5E801', cursor: 'pointer', outline: helpGuideSelected === 'propcolor' ? '2px solid var(--props-color)' : 'none', borderRadius: '50%' }} />
                  <span className="props-prop-card-title">Prop 1</span>
                </div>
                <button className="btn-delete-sm" onClick={() => setHelpGuideSelected('deleteprop')}
                  style={{ outline: helpGuideSelected === 'deleteprop' ? '2px solid var(--props-color)' : 'none' }}>×</button>
              </div>

                              <div className="props-prop-details">
                <div className="form-group" onClick={() => setHelpGuideSelected('propname')} style={{ cursor: 'pointer' }}>
                  <label>Prop Name</label>
                  <input readOnly onChange={() => {}} className="form-input" value="" placeholder="e.g. lava_tree01"
                    style={{ outline: helpGuideSelected === 'propname' ? '2px solid var(--props-color)' : 'none' }} />
                </div>

                <div className="form-group">
                  <label>Categories</label>
                  <div className="input-row" onClick={() => setHelpGuideSelected('categoryrow')} style={{ cursor: 'pointer', marginBottom: '8px' }}>
                    <input readOnly onChange={() => {}} className="form-input" value="Forest" style={{ outline: helpGuideSelected === 'categoryrow' ? '2px solid var(--props-color)' : 'none' }} />
                    <button className="btn-delete-sm">×</button>
                  </div>
                  <button className="btn-secondary" onClick={() => setHelpGuideSelected('addcategory')}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '10px', outline: helpGuideSelected === 'addcategory' ? '2px solid var(--props-color)' : 'none' }}>+ Add Category</button>
                </div>

                <div className="form-group">
                  <label>Blueprint Paths</label>
                  <div className="input-row" onClick={() => setHelpGuideSelected('blueprintrow')} style={{ cursor: 'pointer', marginBottom: '8px' }}>
                    <input readOnly onChange={() => {}} className="form-input" value="" placeholder="/env/Lava/props/Trees/..."
                      style={{ outline: helpGuideSelected === 'blueprintrow' ? '2px solid var(--props-color)' : 'none' }} />
                    <button className="btn-delete-sm">×</button>
                  </div>
                  <button className="btn-library" onClick={() => setHelpGuideSelected('blueprintlibrary')}
                    style={{ width: '100%', outline: helpGuideSelected === 'blueprintlibrary' ? '2px solid var(--props-color)' : 'none' }}>Library</button>
                </div>
              </div>
            </div>

                          <div className="props-add-prop-card" onClick={() => setHelpGuideSelected('addprop')} style={{ outline: helpGuideSelected === 'addprop' ? '2px solid var(--props-color)' : 'none' }}>
              <div className="props-add-prop-icon"><span style={{ fontSize: '2rem' }}>+</span></div>
              <span className="props-add-prop-text">ADD PROP TYPE</span>
            </div>
          </div>
        </div>

                  <div style={{ marginBottom: '16px', padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FFF', display: 'block', marginBottom: '15px' }}>Emitter Matching Mode</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            {[
              { id: 'matching-smart',   label: 'Smart Combination (3-Tier)', sub: 'Perfect Match → Partial Match → Fallback' },
              { id: 'matching-simple',  label: 'Simple Union',               sub: 'ALL emitters active for ANY category' },
              { id: 'matching-lastcat', label: 'Last Category Only',         sub: 'Only the LAST category tag is used' },
            ].map(mode => (
              <div key={mode.id} onClick={() => setHelpGuideSelected(mode.id)} style={{ cursor: 'pointer', padding: '12px 15px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: '8px', outline: helpGuideSelected === mode.id ? '2px solid var(--props-color)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #FFF', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.9rem', color: '#FFF' }}>{mode.label}</strong>
                </div>
                <p style={{ margin: '0 0 0 26px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{mode.sub}</p>
              </div>
            ))}
          </div>
          <button className="btn-secondary" onClick={() => setHelpGuideSelected('configurecategory')}
            style={{ width: '100%', padding: '18px 40px', fontSize: '0.95rem', outline: helpGuideSelected === 'configurecategory' ? '2px solid var(--props-color)' : 'none' }}>
            Configure Emitter-Category Assignment
          </button>
        </div>

        <button className="btn-primary btn-lg" onClick={() => setHelpGuideSelected('generate')}
          style={{ width: '100%', outline: helpGuideSelected === 'generate' ? '2px solid var(--props-color)' : 'none' }}>
          GENERATE FILES
        </button>
      </div>

              <div className="props-preview-column">
        <div className="section-card preview-card">
          <div className="props-preview-header">
            <h2 className="section-title" style={{ margin: 0 }}>PREVIEW</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="props-mirror-dropdown" onClick={() => setHelpGuideSelected('mirrormode')}
                style={{ cursor: 'pointer', userSelect: 'none', outline: helpGuideSelected === 'mirrormode' ? '2px solid var(--props-color)' : 'none' }}>
                Diagonal
              </div>
              <button className="btn-delete-text" onClick={() => setHelpGuideSelected('deletepreview')}
                style={{ outline: helpGuideSelected === 'deletepreview' ? '2px solid var(--props-color)' : 'none' }}>Delete Preview</button>
            </div>
          </div>

          <div className="props-upload-area" onClick={() => setHelpGuideSelected('uploadmap')}
            style={{ cursor: 'pointer', marginBottom: '8px', outline: helpGuideSelected === 'uploadmap' ? '2px solid var(--props-color)' : 'none' }}>
            <span className="props-upload-icon"></span>
            <span>Click to upload map image</span>
          </div>

          <div className="props-canvas-container" onClick={() => setHelpGuideSelected('canvas')}
            style={{ position: 'relative', width: '700px', height: '700px', cursor: 'pointer', marginBottom: '8px', outline: helpGuideSelected === 'canvas' ? '2px solid var(--props-color)' : 'none' }}>
            <canvas width={1024} height={1024} style={{ width: '100%', height: '100%', display: 'block', background: '#0a0a0a' }} />
            {[[25,30,'#A5E801'],[75,70,'#A5E801'],[60,20,'#00DDFF'],[40,80,'#00DDFF']].map(([x,y,c],i) => (
              <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: '12px', height: '12px', borderRadius: '50%', background: c, boxShadow: `0 0 15px ${c}`, border: '2px solid rgba(255,255,255,0.8)', pointerEvents: 'none' }} />
            ))}
          </div>

          <div className="props-legend" onClick={() => setHelpGuideSelected('legend')}
            style={{ cursor: 'pointer', marginBottom: '8px', outline: helpGuideSelected === 'legend' ? '2px solid var(--props-color)' : 'none' }}>
            <div className="props-legend-title">PROP LEGEND</div>
            <div className="props-legend-items">
              {[['#A5E801','Lava Tree','2'],['#00DDFF','Forest Rock','2']].map(([c,n,cnt]) => (
                <div key={n} className="props-legend-item">
                  <div className="props-legend-color" style={{ backgroundColor: c }} />
                  <span>{n}</span><span className="props-coord-count">{cnt} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="props-hint-box" onClick={() => setHelpGuideSelected('hintbox')}
            style={{ cursor: 'pointer', outline: helpGuideSelected === 'hintbox' ? '2px solid var(--props-color)' : 'none' }}>
            Click on the canvas to place props — diagonal mirroring active
          </div>
        </div>
      </div>

    </div>
  </div>

      <div style={{ flex: '1', overflowY: 'auto', maxHeight: '80vh' }}>
    {!helpGuideSelected ? (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', opacity: 0.4, color: 'var(--props-color)' }}>↖</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>Select an element</div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)', maxWidth: '240px', lineHeight: 1.7 }}>Click any field, button, or section on the left to learn what it does.</div>
      </div>
    ) : (() => {
      const INFO = {
        mapname:           { title: 'Map Name',          desc: 'The exact name of your map folder inside /maps. Used to auto-construct all emitter output paths.', details: [['Format','MapName.vXXXX — e.g. Hades_Dust.v0002'],['Auto-version','.v0001 is appended automatically if omitted'],['Case-sensitive','FA is strict — must match folder name exactly'],['Impact','Wrong name = broken file paths = props invisible in-game']], tip: 'Copy the folder name directly from File Explorer.' },
        mapsize:           { title: 'Map Size',          desc: 'The playable width/height of the map in game units. Controls how canvas clicks translate to world coordinates. Set automatically when a valid Map Name and Maps Folder are configured — no manual input needed.', details: [['Auto-detect','Reads playable area from save.lua when Map Name is set'],['256','5×5 km'],['512','10×10 km'],['1024','20×20 km (default if no map found)'],['Impact','Wrong size = props placed at wrong world positions']], tip: 'Set your Map Name and Maps Folder first — Map Size fills in automatically from the map\'s save.lua.' },
        emitterrow:        { title: 'Emitter Path Row',  desc: 'Blueprint path to one emitter effect file. One row is randomly selected per prop placement at generation time.', details: [['Format (local)','/maps/MapName.v0001/env/props/emitter/forest_mist_emit.bp'],['Format (game)','/effects/emitters/some_effect_emit.bp'],['Auto-prefix','Local .bp filenames are auto-prefixed with /maps/MapName/env/props/emitter/'],['Randomness','Multiple rows = random effect per prop for visual variety'],['Delete','Click × to remove this row']], tip: 'Use the Library button — typing paths manually is error-prone.' },
        addemitter:        { title: 'Add Emitter',       desc: 'Adds a new empty emitter path row to the list.', details: [['Use','One row per distinct emitter effect file'],['Variety','More rows = more visual diversity']], tip: 'Pair with Library to fill paths quickly.' },
        emitterlibrary:    { title: 'Emitter Library',   desc: 'Opens the library overlay to browse and select emitters from your scanned emitter.bp folder.', details: [['Prerequisite','Select the emitter.bp folder in Configuration first'],['Multi-select','Select several at once — all get added as rows'],['Auto-path','Paths formatted automatically']], tip: 'Much faster than typing paths manually.' },
        propname:          { title: 'Prop Name',         desc: 'A free-text label for your own reference. Shown in the canvas legend and written into the README file — not used as a filename. Generated filenames are derived from the blueprint path, not this name.', details: [['Purpose','Helps you identify prop types on the canvas legend'],['README','Written to Props_Generation_README.txt when README is enabled'],['Not a filename','File/folder names come from the blueprint path (e.g. Dead01_Group1_prop)']], tip: 'Name it after what it is — "Lava Tree", "Forest Rock", etc.' },
        propcolor:         { title: 'Prop Color Dot',    desc: 'The marker color for this prop type on the canvas. Click to open the color picker.', details: [['Purpose','Distinguishes prop types on canvas and legend'],['No effect','Does not affect generated files']], tip: 'Use distinct colors when working with multiple prop types.' },
        deleteprop:        { title: 'Delete Prop Card',  desc: 'Removes this prop card and all its coordinates permanently.', details: [['Irreversible','All coordinates for this prop are deleted'],['Last card','Resets to empty instead of fully deleting']], tip: 'Double-check coordinates before deleting.' },
        categoryrow:       { title: 'Category Tag',      desc: 'An optional label that groups this prop for smart emitter matching.', details: [['Examples','Forest · Lava · Rock · Desert · T1 · T2'],['Matching','Drives emitter selection — see Advanced Guide → Emitter Assignment'],['Order','In "Last Category Only" mode the last tag wins']], tip: 'Keep naming consistent across props — case matters.' },
        addcategory:       { title: 'Add Category',      desc: 'Adds a new category tag to this prop type.', details: [['Naming','Be consistent across all prop types'],['Order','Put the most specific tag last for "Last Category Only" mode']], tip: 'Typical pattern: biome first (Forest), then detail (Dense).' },
        blueprintrow:      { title: 'Blueprint Path',    desc: 'The in-game .bp path to a prop blueprint. One row is randomly picked per coordinate at generation.', details: [['Format','/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp'],['Randomness','Multiple paths = random prop per placement'],['Library','Use the Library button to browse available props']], tip: 'Multiple blueprint paths create visual variety at a single location.' },
        blueprintlibrary:  { title: 'Blueprint Library', desc: 'Opens the props library to search and select prop blueprints. Supports texture adjustments for custom variants.', details: [['Search','Filter by biome, type, and name'],['Texture adj.','Custom colour/brightness changes generate a unique modified .bp'],['Auto-fill','Selected paths are added automatically']], tip: 'The fastest way to find correct blueprint paths.' },
        addprop:           { title: 'Add Prop Type',     desc: 'Creates a new prop card for an additional type of prop placement.', details: [['Independent','Each card has its own blueprint paths, coordinates, color, and categories'],['Typical','2–5 prop types per map']], tip: 'Add all prop types before placing coordinates.' },
        'matching-smart':  { title: 'Smart Combination (3-Tier)', desc: 'Checks emitter assignments in three priority tiers for the most precise match.', details: [['Tier 1','Emitters active for ALL prop categories'],['Tier 2','Emitters active for ANY category (if Tier 1 empty)'],['Tier 3','All configured emitters (safety fallback)'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'Best for production setups with precise per-category tuning.' },
        'matching-simple': { title: 'Simple Union',     desc: 'Uses all emitters active for ANY of the prop\'s categories combined.', details: [['Logic','OR-based: ["Forest","Dense"] gets all Forest + all Dense emitters merged'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'Simpler mental model. Good starting point.' },
        'matching-lastcat':{ title: 'Last Category Only', desc: 'Only the LAST tag in the category list is used for matching.', details: [['Example','["Forest","Dense","Old"] → only "Old" used'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'Ideal when categories go general→specific.' },
        configurecategory: { title: 'Configure Emitter-Category Assignment', desc: 'Opens the overlay where you control which emitters are active per category.', details: [['Layout','Each category = one row; each emitter has a toggle'],['White = active','Emitter included for this category'],['Gray = inactive','Emitter excluded for this category'],['See also','→ Advanced Guide: Emitter Assignment']], tip: 'See Advanced Guide → Emitter Assignment for full examples.' },
        generate:          { title: 'GENERATE FILES',   desc: 'Validates your setup, writes all prop/script files, injects a props.lua into your .scmap via the built-in parser, and repacks — all in one click.', details: [['Creates','_prop.bp + _script.lua per coordinate per blueprint path'],['SCMAP','Unpacks .scmap → injects props.lua chunk → repacks back in place'],['README','Optional .txt file documenting all settings at generation time'],['Re-run safe','Each run adds a new numbered props.lua chunk — nothing is overwritten']], tip: 'The .scmap must exist in the map folder before generating — run the FA editor first if starting fresh.' },
        mirrormode:        { title: 'Mirror Mode',      desc: 'Sets whether a canvas click creates one coordinate or an automatic mirror pair.', details: [['No Mirror','1 click = 1 coordinate'],['Diagonal','1 click = 2 coordinates — mirror at (mapSize−X, mapSize−Z)'],['Horizontal','1 click = 2 coordinates — mirror at same X, mapSize−Z'],['Vertical','1 click = 2 coordinates — mirror at mapSize−X, same Z'],['See also','→ Advanced Guide: Mirror Modes']], tip: 'Diagonal saves 50% placement work on symmetrical maps.' },
        deletepreview:     { title: 'Delete Preview',   desc: 'Removes the uploaded map background image from the canvas.', details: [['Effect','Clears image from localStorage'],['Coordinates','Remain untouched — only the background is removed']], tip: 'Upload a new image after deleting when switching maps.' },
        uploadmap:         { title: 'Upload Map Image', desc: 'Sets a top-down map image as the canvas background for visual reference while placing props.', details: [['Formats','PNG, JPG, WEBP'],['Storage','Saved in localStorage — persists between sessions'],['Source','Export from FA map editor or in-game screenshot']], tip: 'Makes placement far more accurate — you can see terrain features.' },
        canvas:            { title: 'Map Preview Canvas', desc: 'The interactive area where you place and delete prop coordinates by clicking.', details: [['Click empty','Adds a coordinate for the selected prop type'],['Click marker','Deletes that coordinate and its mirror pair'],['Scale','Positions calculated from Map Size setting']], tip: 'Select the prop card first — only the selected prop receives new coordinates.' },
        legend:            { title: 'Prop Legend',      desc: 'Shows all prop types with their canvas colors and coordinate counts.', details: [['Content','Color + prop name + coordinate count per row'],['Selected','Selected prop name is highlighted in theme color'],['Read-only','Purely informational']], tip: 'Check counts here before generating to catch missing coordinates.' },
        hintbox:           { title: 'Canvas Hint Box',  desc: 'Dynamic text showing the currently active mirror mode.', details: [['Updates','Changes as you switch mirror modes']], tip: 'Glance here before each placement session to confirm the mirror mode.' },
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

{activeHelpTab === 'advanced' && (
<div className="help-adv-layout">

      <div style={{ display: 'flex', gap: '8px', marginBottom: '36px', flexWrap: 'wrap', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
    {[
      { id: 'workflow',   label: 'Workflow' },
      { id: 'config',     label: 'Configuration' },
      { id: 'props-adv',  label: 'Props' },
      { id: 'preview',    label: 'Preview & Canvas' },
      { id: 'mirror',     label: 'Mirror Modes' },
      { id: 'emitter',    label: 'Emitter Assignment' },
      { id: 'generate',   label: 'Generate Files' },
    ].map(t => (
      <button key={t.id} onClick={() => setActiveAdvancedSubTab(t.id)} style={{
        flex: '1 1 auto', padding: '11px 14px', borderRadius: '8px', cursor: 'pointer',
        fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase',
        transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: activeAdvancedSubTab === t.id ? 'var(--props-color)' : 'rgba(255,255,255,0.05)',
        color: activeAdvancedSubTab === t.id ? '#000' : 'rgba(255,255,255,0.6)',
        border: `2px solid ${activeAdvancedSubTab === t.id ? 'var(--props-color)' : 'transparent'}`,
        boxShadow: activeAdvancedSubTab === t.id ? '0 0 16px var(--props-glow)' : 'none',
      }}
        onMouseEnter={e => { if (activeAdvancedSubTab !== t.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}}
        onMouseLeave={e => { if (activeAdvancedSubTab !== t.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}}
      >{t.label}</button>
    ))}
  </div>

      {activeAdvancedSubTab === 'workflow' && (<>
    <div className="help-adv-hero">
      <div className="help-adv-hero-content">
        <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Full Workflow Overview</h2>
        <p className="help-adv-hero-desc">Follow these steps from start to finish to generate props. Each step builds on the last — don't skip steps on your first run.</p>
      </div>
    </div>
    <div className="help-adv-process">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Core Process</h3>
      <div className="help-adv-timeline">
        {[
          { n: '01', title: 'Configure Map Settings', desc: 'Enter Map Name (e.g. Hades_Dust), Map Size, select your /maps folder, and optionally the emitter source folder.', subs: ['Map name must exactly match the folder in /maps — FA is case-sensitive','Omitting .v0001 is fine — it is appended automatically','Maps folder can be pre-set in Settings'] },
          { n: '02', title: 'Add Emitters & Prop Types', desc: 'Add emitter paths via the Library, then create a Prop Card per prop type and fill in blueprint paths via the Library.', subs: ['Use Library buttons — typing paths manually is error-prone','Multiple emitter rows = random variety across placed props','Each prop card is independent — different colors, blueprints, and coordinate sets'] },
          { n: '03', title: 'Place Coordinates on Canvas', desc: 'Optionally upload a map image for reference, select a mirror mode, select a prop card, then click the canvas to place positions.', subs: ['Only the selected prop card receives new coordinates from canvas clicks','Click an existing marker to delete it and its mirror pair','Mirror modes auto-create symmetric pairs — see Mirror Modes tab'] },
          { n: '04', title: 'Generate Files', desc: 'Click GENERATE FILES. The tool writes all prop/script files, injects a props.lua chunk into your .scmap via the built-in parser, and repacks automatically.', subs: ['One _prop.bp + one _script.lua per coordinate per blueprint path','SCMAP parser runs automatically — no BrewMapTool needed','README optionally documents all settings at generation time','Re-run freely — each run adds a new numbered props.lua chunk'] },
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
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>Troubleshooting</h3>
      {[
        ['No .scmap found error','The tool needs an existing .scmap in the map folder. Generate the base map in the FA editor first, then run the props generator.'],
        ['Props at wrong positions','Map Size mismatch — the size must match the actual .scmap dimensions. Check your _scenario.lua PlayableRect.'],
        ['Props missing after map load','Confirm the repack succeeded (check the success alert) or look in the History. Emitters can only be seen in-game.'],
        ['Props have no emitter effect','Check that you configured emitter rows in Configuration and that the emitter files got copied - If not the Emitter Folder path might be wrong.'],
        ['Files generate to wrong location','Verify your Maps Folder path points to the /maps directory, not a subfolder of a specific map.'],
      ].map(([q,a]) => (
        <div key={q} className="help-adv-ts-item">
          <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
          <div className="help-adv-ts-a"><p>{a}</p></div>
        </div>
      ))}
    </div>
    <div className="help-adv-practice-grid-wrapper">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">06</span>Best Practices</h3>
      <div className="help-adv-practice-grid">
        {[
          ['','Run Library Scans First','Run a library scan in Settings before starting — browsing by name is far faster than typing paths.'],
          ['','Add Props Before Placing','Add all prop type cards first, then place coordinates — the legend stays readable while you work.'],
          ['','Upload Map Image First','Place your map image before placing coordinates so you can pick the intended positions.'],
          ['','Test Small First','Start with 1–2 prop types and 2–4 coordinates to verify your folder setup before doing a full map.'],
        ].map(([icon,title,desc]) => (
          <div key={title} className="help-adv-practice-card">
            <div className="help-adv-practice-icon">{icon}</div>
            <h4>{title}</h4><p>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </>)}

      {activeAdvancedSubTab === 'config' && (<>
    <div className="help-adv-hero">
      <div className="help-adv-hero-content">
        <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Configuration Deep Dive</h2>
        <p className="help-adv-hero-desc">These global settings affect every prop type and every generated file. Setting them correctly once prevents all downstream errors.</p>
      </div>
      <div className="help-adv-button-showcase">
        <div className="help-adv-fake-button" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Maps Folder + Map Name + Size</div>
        <div className="help-adv-button-hint">These three form the foundation of all file paths</div>
      </div>
    </div>
    <div className="help-adv-technical">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Field Reference</h3>
      <div className="help-adv-card-grid">
        {[
          { icon: '️', title: 'Map Name', desc: 'The exact name of your map folder inside /maps. Used to construct ALL output emitter file paths.', features: ['Must match folder name exactly — FA is case-sensitive','Format: MapName.vXXXX (e.g. Hades_Dust.v0002)','Omitting .v0001 is fine — auto-appended','Wrong name = all emitter paths broken'] },
          { icon: '', title: 'Map Size', desc: 'Playable width/height in game units. Filled in automatically from the map\'s save.lua when Map Name and Maps Folder are set. Controls coordinate scale on the canvas.', features: ['Auto-detected from save.lua — no manual input needed','256 = 5×5 km · 512 = 10×10 km · 1024 = 20×20 km','Wrong value = props offset from placed canvas positions','Falls back to 1024 if save.lua cannot be read'] },
          { icon: '', title: 'Maps Folder', desc: 'Absolute path to your /maps directory. All generated files are written here.', features: ['Set once in Settings — persists across sessions','Cleared with the × button in Configuration'] },
          { icon: '', title: 'Emitter Path Rows', desc: 'In-game emitter paths assigned randomly to props at generation time for visual effects.', features: ['Format (local .bp): /maps/MapName.v0001/env/props/emitter/forest_mist.bp','Format (game-wide): /effects/emitters/some_effect_emit.bp','Local filenames are auto-prefixed with /maps/MapName/env/props/emitter/','Multiple rows = one randomly picked per prop coordinate','Use Library button to auto-fill paths','Combined with Prop Categories for smart per-type assignment'] },
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
        ['Files appear in wrong subfolder','Check for leading/trailing spaces in the map name — they are included in the path.'],
        ['Library shows no blueprint entries','Run a library scan in Settings first — without a scan the library is empty.'],
      ].map(([q,a]) => (
        <div key={q} className="help-adv-ts-item">
          <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
          <div className="help-adv-ts-a"><p>{a}</p></div>
        </div>
      ))}
    </div>
    <div className="help-adv-practice-grid-wrapper">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
      <div className="help-adv-practice-grid">
        {[
          ['','Copy Folder Names','Copy your map folder name directly from File Explorer to guarantee correct capitalisation.'],
          ['','Set Size First','Verify Map Size before placing any coordinates — changing it afterwards shifts all existing canvas positions.'],
        ].map(([icon,title,desc]) => (
          <div key={title} className="help-adv-practice-card">
            <div className="help-adv-practice-icon">{icon}</div>
            <h4>{title}</h4><p>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </>)}

      {activeAdvancedSubTab === 'props-adv' && (<>
    <div className="help-adv-hero">
      <div className="help-adv-hero-content">
        <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Props — Full Reference</h2>
        <p className="help-adv-hero-desc">Each Prop Card represents one unique prop type with its own blueprint paths, coordinates, color, and optional category tags. Multiple cards let you place different prop types on the same map.</p>
      </div>
      <div className="help-adv-button-showcase">
        <div className="help-adv-fake-button" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>lava_tree01</div>
        <div className="help-adv-button-hint">A free-text name for your reference — not written to files</div>
      </div>
    </div>
    <div className="help-adv-technical">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Field Reference</h3>
      <div className="help-adv-card-grid">
        {[
          { icon: '', title: 'Prop Name', desc: 'A free-text label for your reference. Shown in canvas legend and written to the README file — not used as a filename. Generated file and folder names come from the blueprint path.', features: ['Use descriptive names: "Lava Tree", "Forest Rock", "Desert Cactus"','Appears in the canvas legend for easy identification','Written to README when README generation is enabled','Purely for your own organisation — not part of any .bp or .lua filename'] },
          { icon: '', title: 'Color Dot', desc: 'Canvas marker color. Click to change. Purely visual — no effect on generated files.', features: ['Use distinct colors when working with multiple prop types','Available as preset swatches or custom hex/hsl input','Color appears in canvas markers and the Prop Legend'] },
          { icon: '', title: 'Blueprint Paths', desc: 'One or more in-game prop.bp paths. A random path is selected per coordinate at generation, creating visual variety.', features: ['Format: /env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp','Multiple paths = different models appear at different coordinates','Texture adjustments in Library create modified custom .bp copies','Use Library button — browsing is far easier than typing paths'] },
          { icon: '', title: 'Prop Categories', desc: 'Optional labels that group this prop type for the Emitter Matching system.', features: ['Examples: Forest · Lava · Rock · Desert · Evergreen','Must match names used in Emitter-Category Assignment overlay exactly','Order matters in "Last Category Only" mode — last tag wins','Without categories: prop uses entire emitter pool (no filtering)'] },
          { icon: '', title: 'Coordinates', desc: 'The placed X/Z world positions where this prop type is generated.', features: ['X and Z set by canvas clicks — Y is always 2 (auto-placed by game)','Mirror mode coordinates are linked — deleting one removes the pair','Click a marker on canvas to delete that coordinate','Expand a prop card to see and manage the coordinate list'] },
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
        ['Library search returns no blueprint results','Run a library scan in Settings first — without a scan the library is empty.'],
        ['Wrong prop appears in-game despite correct path','Verify the blueprint path exactly matches the game file — check for extra slashes or wrong capitalisation.'],
      ].map(([q,a]) => (
        <div key={q} className="help-adv-ts-item">
          <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
          <div className="help-adv-ts-a"><p>{a}</p></div>
        </div>
      ))}
    </div>
    <div className="help-adv-practice-grid-wrapper">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
      <div className="help-adv-practice-grid">
        {[
          ['','Use the Library','Always use the Blueprint Library to fill paths — searching by name prevents silent typos that break props.'],
          ['','Multiple Blueprints = Variety','Add 3–5 blueprint paths per prop card for visual variety — a random one is picked per coordinate.'],
        ].map(([icon,title,desc]) => (
          <div key={title} className="help-adv-practice-card">
            <div className="help-adv-practice-icon">{icon}</div>
            <h4>{title}</h4><p>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </>)}

      {activeAdvancedSubTab === 'preview' && (<>
    <div className="help-adv-hero">
      <div className="help-adv-hero-content">
        <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Preview &amp; Canvas</h2>
        <p className="help-adv-hero-desc">The Preview section is your visual placement workspace. Upload a map image for reference, set a mirror mode, select a prop card, then click to place coordinates.</p>
      </div>
    </div>
    <div className="help-adv-technical">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Element Reference</h3>
      <div className="help-adv-card-grid">
        {[
          { icon: '', title: 'Map Preview Image', desc: 'Optional background image for visual reference while placing coordinates.', features: ['Formats: PNG, JPG, WEBP','Export from FA map editor or take an in-game screenshot','Saved in localStorage — persists between sessions','Remove with Delete Preview button'] },
          { icon: '', title: 'Mirror Mode', desc: 'Controls how many coordinates one canvas click creates. See Mirror Modes tab for full math.', features: ['No Mirror: 1 click = 1 coordinate','Diagonal: 1 click = 2 coords — mirror at (mapSize−X, mapSize−Z)','Horizontal: 1 click = 2 coords — mirror at same X, mapSize−Z','Vertical: 1 click = 2 coords — mirror at mapSize−X, same Z'] },
          { icon: '', title: 'Canvas Interaction', desc: 'The interactive area for placing and deleting coordinates.', features: ['Click empty space → adds coordinate for selected prop card','Click existing marker → deletes that coordinate and its mirror pair','Only the selected prop card receives new coordinates','Canvas internal resolution: 1024×1024, scaled to container'] },
          { icon: '', title: 'Prop Legend', desc: 'Shows all prop types with their colors and coordinate counts.', features: ['Color dot + prop name + coordinate count per row','Selected prop name highlighted in theme color','Purely informational — no interactive function'] },
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
        ['Uploaded image not appearing','Only PNG, JPG, and WEBP are supported. Very large images may be slow to load.'],
        ['Deleting a coordinate also removes another one','Expected — clicking a coordinate deletes it and its mirror pair together.'],
      ].map(([q,a]) => (
        <div key={q} className="help-adv-ts-item">
          <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
          <div className="help-adv-ts-a"><p>{a}</p></div>
        </div>
      ))}
    </div>
    <div className="help-adv-practice-grid-wrapper">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
      <div className="help-adv-practice-grid">
        {[
          ['','Upload Map First','Upload your map image before placing coordinates — terrain visibility makes placement much more accurate.'],
          ['','Check Hint Box','Glance at the hint box before each placement session to confirm the correct mirror mode.'],
        ].map(([icon,title,desc]) => (
          <div key={title} className="help-adv-practice-card">
            <div className="help-adv-practice-icon">{icon}</div>
            <h4>{title}</h4><p>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </>)}

      {activeAdvancedSubTab === 'mirror' && (<>
    <div className="help-adv-hero">
      <div className="help-adv-hero-content">
        <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Mirror Modes</h2>
        <p className="help-adv-hero-desc">Mirror modes let you place symmetric coordinate pairs with a single canvas click. Choose the mode that matches your map's symmetry type.</p>
      </div>
      <div className="help-adv-button-showcase">
        <svg viewBox="0 0 150 150" width="130" style={{display:'block',margin:'0 auto'}}>
          <rect width="150" height="150" fill="rgba(0,0,0,0.6)" rx="4"/>
          {[37,75,112].map(v=><g key={v}><line x1={v} y1="8" x2={v} y2="142" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/><line x1="8" y1={v} x2="142" y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/></g>)}
          <line x1="12" y1="75" x2="140" y2="75" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
          <line x1="75" y1="12" x2="75" y2="140" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
          <line x1="12" y1="12" x2="140" y2="140" stroke="rgba(165,232,1,0.25)" strokeWidth="1" strokeDasharray="4,3"/>
          {[[40,38],[112,112]].map(([x,y],i) => (
            <g key={i}><circle cx={x} cy={y} r="7" fill="#A5E801" opacity="0.85"/><circle cx={x} cy={y} r="12" fill="none" stroke="rgba(165,232,1,0.3)" strokeWidth="1"/></g>
          ))}
        </svg>
        <div className="help-adv-button-hint">Diagonal: click top-left → auto-mirrors to bottom-right</div>
      </div>
    </div>
    <div className="help-adv-technical">
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
    <div className="help-adv-process">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Mirror Math</h3>
      <div className="help-adv-timeline">
        {[
          { n: '-',  title: 'None',       count: 1, formula: '(X, Z) → (X, Z)',                           desc: 'No mirroring. Each click adds exactly one coordinate to the selected prop card.' },
          { n: '⤡', title: 'Diagonal',   count: 2, formula: '(X, Z) → (X, Z) + (S−X, S−Z)',             desc: 'Mirrors across both axes simultaneously. Best for symmetric maps — the mirror point appears at the diagonally opposite corner.' },
          { n: '↕', title: 'Horizontal', count: 2, formula: '(X, Z) → (X, Z) + (X, S−Z)',               desc: 'Mirrors top ↔ bottom across the horizontal center line. X coordinate stays the same; Z is flipped.' },
          { n: '↔', title: 'Vertical',   count: 2, formula: '(X, Z) → (X, Z) + (S−X, Z)',               desc: 'Mirrors left ↔ right across the vertical center line. Z coordinate stays the same; X is flipped.' },
        ].map(r => (
          <div key={r.title} className="help-adv-step">
            <div className="help-adv-step-num" style={{ fontSize: '1.2rem' }}>{r.n}</div>
            <div className="help-adv-step-content">
              <h4>{r.title} <span style={{ fontSize: '0.8rem', opacity: 0.5, fontWeight: 400 }}>→ {r.count} coordinate{r.count > 1 ? 's' : ''} per click</span></h4>
              <p>{r.desc}</p>
              <div className="help-adv-code-block" style={{ marginTop: '10px' }}>
                <code>{r.formula}</code>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="help-adv-note" style={{ marginTop: '20px' }}>
        <strong>S = Map Size</strong> — e.g. for a 512-map, a click at (200, 300) in Diagonal mode creates a second point at (312, 212).
      </div>
    </div>
    <div className="help-adv-ts-grid">
      <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
      {[
        ['Mirror point appears at wrong position','Verify Map Size is correct — wrong size shifts the mirror math for all coordinates.'],
        ['Deleting a coordinate removes two','Expected behavior — mirror pairs are always deleted together.'],
        ['Want to place a single point on a symmetric map','Switch to "No Mirror" temporarily, place the point, then switch back.'],
      ].map(([q,a]) => (
        <div key={q} className="help-adv-ts-item">
          <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
          <div className="help-adv-ts-a"><p>{a}</p></div>
        </div>
      ))}
    </div>
  </>)}

      {activeAdvancedSubTab === 'emitter' && (
    <>
              <div style={{
        display: 'flex', gap: '12px', marginBottom: '30px', padding: '8px',
        background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <button
          onClick={() => setActiveEmitterHelpSubTab('smart')}
          style={{
            flex: 1, padding: '15px 25px',
            background: activeEmitterHelpSubTab === 'smart' ? 'var(--props-color)' : 'rgba(255, 255, 255, 0.05)',
            color: activeEmitterHelpSubTab === 'smart' ? '#000' : 'rgba(255, 255, 255, 0.6)',
            border: `2px solid ${activeEmitterHelpSubTab === 'smart' ? 'var(--props-color)' : 'transparent'}`,
            borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
            letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: activeEmitterHelpSubTab === 'smart' ? '0 0 16px var(--props-glow)' : 'none',
          }}
          onMouseEnter={(e) => { if (activeEmitterHelpSubTab !== 'smart') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; } }}
          onMouseLeave={(e) => { if (activeEmitterHelpSubTab !== 'smart') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; } }}
        >
          <span></span> Smart Combination (3-Tier)
        </button>

        <button
          onClick={() => setActiveEmitterHelpSubTab('simple')}
          style={{
            flex: 1, padding: '15px 25px',
            background: activeEmitterHelpSubTab === 'simple' ? 'var(--props-color)' : 'rgba(255, 255, 255, 0.05)',
            color: activeEmitterHelpSubTab === 'simple' ? '#000' : 'rgba(255, 255, 255, 0.6)',
            border: `2px solid ${activeEmitterHelpSubTab === 'simple' ? 'var(--props-color)' : 'transparent'}`,
            borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
            letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: activeEmitterHelpSubTab === 'simple' ? '0 0 16px var(--props-glow)' : 'none',
          }}
          onMouseEnter={(e) => { if (activeEmitterHelpSubTab !== 'simple') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; } }}
          onMouseLeave={(e) => { if (activeEmitterHelpSubTab !== 'simple') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; } }}
        >
          <span></span> Simple Union
        </button>

        <button
          onClick={() => setActiveEmitterHelpSubTab('lastCategory')}
          style={{
            flex: 1, padding: '15px 25px',
            background: activeEmitterHelpSubTab === 'lastCategory' ? 'var(--props-color)' : 'rgba(255, 255, 255, 0.05)',
            color: activeEmitterHelpSubTab === 'lastCategory' ? '#000' : 'rgba(255, 255, 255, 0.6)',
            border: `2px solid ${activeEmitterHelpSubTab === 'lastCategory' ? 'var(--props-color)' : 'transparent'}`,
            borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
            letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: activeEmitterHelpSubTab === 'lastCategory' ? '0 0 16px var(--props-glow)' : 'none',
          }}
          onMouseEnter={(e) => { if (activeEmitterHelpSubTab !== 'lastCategory') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; } }}
          onMouseLeave={(e) => { if (activeEmitterHelpSubTab !== 'lastCategory') { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; } }}
        >
          <span></span> Last Category Only
        </button>
      </div>

              {activeEmitterHelpSubTab === 'smart' && (<>
        <div className="help-adv-hero">
          <div className="help-adv-hero-content">
            <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Emitter-Category Assignment (Smart Mode)</h2>
            <p className="help-adv-hero-desc">Fine-tune which emitter effects are used for specific prop categories. This powerful system allows you to create variety and visual distinction between different prop types. For example: Forest props can use a subtle mist emitter, while Lava props get fire and heat shimmer effects. The system uses intelligent 3-tier matching logic to always find the best emitter for each prop.</p>
          </div>
          <div className="help-adv-button-showcase">
            <div className="help-adv-fake-button" style={{ background: 'linear-gradient(135deg, var(--props-color) 0%, rgba(165,232,1,0.9) 100%)', color: '#000' }}>CONFIGURE ASSIGNMENT</div>
            <div className="help-adv-button-hint">Click this button to open the configuration modal</div>
          </div>
        </div>
        <div className="help-adv-process">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Core Concept</h3>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderLeft: '4px solid var(--props-color)', padding: '25px 30px', borderRadius: '8px', marginBottom: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#FFF', fontWeight: '600' }}>The Problem This Solves</h4>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '20px' }}>By default, all emitters are randomly assigned to all props. But you might want:</p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.9', paddingLeft: '25px', fontSize: '0.95rem' }}>
              <li><strong style={{ color: '#FFF' }}>Visual Variety:</strong> Different prop types should look different (Forest vs Lava)</li>
              <li><strong style={{ color: '#FFF' }}>Thematic Consistency:</strong> Lava props should have fire effects, not forest mist</li>
              <li><strong style={{ color: '#FFF' }}>Biome Accuracy:</strong> Each biome gets effects appropriate to its environment</li>
              <li><strong style={{ color: '#FFF' }}>Exclusion Control:</strong> Prevent certain effects from appearing on specific prop types</li>
            </ul>
          </div>
          <div className="help-adv-timeline">
            <div className="help-adv-step">
              <div className="help-adv-step-num">1</div>
              <div className="help-adv-step-content">
                <h4>Define Prop Categories</h4>
                <p>Add categories to your props (e.g., "Forest", "Lava", "Dense", "Rock")</p>
                <div className="help-adv-code-block" style={{ marginTop: '12px' }}><code>Prop: Lava Tree<br/>Categories: ["Lava", "T3", "Tall"]</code></div>
              </div>
            </div>
            <div className="help-adv-step-arrow">→</div>
            <div className="help-adv-step">
              <div className="help-adv-step-num">2</div>
              <div className="help-adv-step-content">
                <h4>Configure Emitter Assignments</h4>
                <p>Toggle which emitters should be used for each category</p>
                <div className="help-adv-note" style={{ marginTop: '12px' }}><strong>Green = Active</strong> (emitter will be used)<br/><strong>Gray = Inactive</strong> (emitter excluded)</div>
              </div>
            </div>
            <div className="help-adv-step-arrow">→</div>
            <div className="help-adv-step">
              <div className="help-adv-step-num">3</div>
              <div className="help-adv-step-content">
                <h4>Smart Matching</h4>
                <p>System automatically selects best emitters during file generation</p>
<div className="help-adv-note" style={{ marginTop: '12px' }}><strong>3-Tier</strong> matching logic</div>
              </div>
            </div>
          </div>
        </div>
        <div className="help-adv-technical">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>3-Tier Matching Logic (Smart Combination)</h3>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '25px', marginBottom: '30px' }}>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '0' }}>When generating files, the system intelligently matches emitters to props using a <strong style={{ color: '#FFF' }}>3-tier priority system</strong>. This ensures you always get the best possible emitter for each prop, with graceful fallbacks if perfect matches aren't available.</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(165,232,1,0.08) 0%, rgba(165,232,1,0.03) 100%)', border: '2px solid rgba(165,232,1,0.2)', borderRadius: '12px', padding: '30px', marginBottom: '35px' }}>
            <h4 style={{ fontSize: '1.25rem', marginBottom: '20px', color: '#FFF', fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>The Decision Process</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px', margin: '0 auto' }}>
              {[
                { color: '#4CAF50', bg: 'rgba(76,175,80,0.1)', border: 'rgba(76,175,80,0.3)', n: '1', title: 'Perfect Match?', desc: <>Are there emitters active for <strong style={{color:'#FFF'}}>ALL</strong> of the prop's categories?</> },
                { color: '#2196F3', bg: 'rgba(33,150,243,0.1)', border: 'rgba(33,150,243,0.3)', n: '2', title: 'Partial Match?', desc: <>Any emitters active for <strong style={{color:'#FFF'}}>AT LEAST ONE</strong> category?</> },
                { color: '#FF9800', bg: 'rgba(255,152,0,0.1)', border: 'rgba(255,152,0,0.3)', n: '3', title: 'Universal Fallback', desc: <>If nothing matches at all, use <strong style={{color:'#FFF'}}>everything</strong> as a safety net.</> },
              ].map(tier => (
                <div key={tier.n} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: tier.bg, border: `2px solid ${tier.border}`, borderRadius: '8px' }}>
                  <div style={{ minWidth: '40px', height: '40px', borderRadius: '50%', background: tier.color, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '700' }}>{tier.n}</div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: tier.color, fontSize: '1.05rem' }}>{tier.title}</strong>
                    <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{tier.desc}</p>
                  </div>
                  <div style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.3)' }}>→</div>
                </div>
              ))}
            </div>
          </div>
          <div className="help-adv-card-grid">
            {[
              { color: '#4CAF50', icon: '', title: 'Tier 1: Perfect Match', desc: 'Emitters that are active for ALL categories of the prop.', code: `Prop Categories: ["Forest", "Dense"]\n\nEmitter Status:\n- Forest_Mist:  ✓ Forest, ✓ Dense  ← PERFECT!\n- Fire_Glow:    ✓ Forest, ✗ Dense\n- Steam:        ✗ Forest, ✗ Dense\n\nSelected: Forest_Mist only`, features: ['Highest Priority: Your custom-configured emitters','Most Specific: Designed exactly for this combination','Best Control: Full artistic control over exact combinations'] },
              { color: '#2196F3', icon: '', title: 'Tier 2: Partial Match', desc: 'Emitters active for at least ONE category (used if no perfect match exists).', code: `Prop Categories: ["Forest", "Dense"]\n\nEmitter Status:\n- Forest_Mist:  ✓ Forest, ✗ Dense  ← Partial\n- Vine_Bloom:   ✗ Forest, ✓ Dense  ← Partial\n- Fire_Glow:    ✗ Forest, ✗ Dense\n\nSelected: Forest_Mist + Vine_Bloom`, features: ['Fallback Layer: Used when perfect matches don\'t exist','Broader Pool: More emitters to choose from','Still Relevant: At least one category matches'] },
              { color: '#FF9800', icon: '', title: 'Tier 3: Universal Fallback', desc: 'All configured emitters (used if no matches at all).', code: `Prop Categories: ["Desert"]\n\nEmitter Status:\n- Forest_Mist:  ✗ Desert\n- Lava_Heat:    ✗ Desert\n- Steam:        ✗ Desert\n\nSelected: All three (fallback)`, features: ['Safety Net: Guarantees every prop gets an emitter','No Configuration Required: Works even without category setup','Graceful Degradation: System never fails'] },
            ].map(item => (
              <div key={item.title} className="help-adv-card">
                <div className="help-adv-card-header"><span className="help-adv-card-icon">{item.icon}</span><h4>{item.title}</h4></div>
                <div className="help-adv-card-body">
                  <p className="help-adv-card-desc">{item.desc}</p>
                  <div className="help-adv-code-sample"><div className="help-adv-code-label">Example:</div><pre><code>{item.code}</code></pre></div>
                  <ul className="help-adv-card-features">{item.features.map((f,i) => <li key={i}>{f}</li>)}</ul>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="help-adv-structure">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Practical Configuration Examples</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {[
              { color: '#4CAF50', bg: 'rgba(76,175,80,0.1)', emoji: '', title: 'Example 1: Biome Distinction', goal: 'Different emitter effects per biome', code: `Categories in Overlay:\n\n FOREST\n  Forest_Mist ✓\n  Lava_Heat   ✗\n  Steam       ✗\n\n LAVA\n  Forest_Mist ✗\n  Lava_Heat   ✓\n  Steam       ✓\n\n DESERT\n  Forest_Mist ✗\n  Lava_Heat   ✗\n  Steam       ✓`, result: 'Forest props get mist, Lava props get heat and steam. Each biome feels unique!' },
              { color: '#2196F3', bg: 'rgba(33,150,243,0.1)', emoji: '', title: 'Example 2: Density Scaling', goal: 'Dense areas get more dramatic effects than sparse ones', code: `Categories in Overlay:\n\n SPARSE\n  Light_Breeze ✓\n  Heavy_Mist   ✗\n\n DENSE\n  Light_Breeze ✗\n  Heavy_Mist   ✓`, result: 'Sparse placements look subtle, dense areas feel atmospheric. Visual density matches prop density!' },
              { color: '#FF9800', bg: 'rgba(255,152,0,0.1)', emoji: '', title: 'Example 3: Combined Categories (Smart Matching)', goal: 'Special effects for specific combinations (e.g. "Lava + Tall")', code: `Prop: Giant Lava Spire\nCategories: ["Lava", "Tall", "Landmark"]\n\n LAVA\n  Standard_Heat ✓\n  Giant_Fire    ✗\n\n TALL\n  Standard_Heat ✓\n  Giant_Fire    ✗\n\n LANDMARK\n  Standard_Heat ✓\n  Giant_Fire    ✓`, result: 'Perfect Match: Standard_Heat only (active for all 3). Enable Giant_Fire for Lava + Tall too to unlock it!' },
            ].map(ex => (
              <div key={ex.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '25px', borderLeft: `4px solid ${ex.color}` }}>
                <h4 style={{ fontSize: '1.15rem', marginBottom: '15px', color: ex.color, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}><span>{ex.emoji}</span>{ex.title}</h4>
                <div style={{ marginBottom: '20px' }}><strong style={{ color: '#FFF', fontSize: '0.95rem' }}>Goal:</strong><p style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.7' }}>{ex.goal}</p></div>
                <div className="help-adv-code-sample"><div className="help-adv-code-label">Configuration:</div><pre><code>{ex.code}</code></pre></div>
                <div style={{ marginTop: '15px', padding: '15px', background: ex.bg, borderRadius: '6px' }}><strong style={{ color: ex.color, fontSize: '0.9rem' }}>Result:</strong><p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>{ex.result}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="help-adv-practice-grid-wrapper">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Step-by-Step Workflow</h3>
          <div className="help-adv-practice-grid">
            {[
              ['1. Add Categories to Props','In the PROPS section, click "+ Add Category" and enter meaningful names like "Forest", "Lava", "Dense", etc.'],
              ['2. Add Your Emitters','In Configuration, add all emitter paths you want to use. These are the effects you\'ll assign to categories.'],
              ['3. Open Assignment Modal','Click "Configure Emitter-Category Assignment". You\'ll see all categories with emitter toggle buttons.'],
              ['4. Toggle Emitters','For each category, click emitter buttons to toggle on (green) or off (gray).'],
              ['5. Test & Iterate','Generate a few test files, check them in-game, then refine your configuration.'],
              ['6. Generate Final Files','Once satisfied, generate all your prop files. Each gets the best matching emitter automatically!'],
            ].map(([title,desc]) => (
              <div key={title} className="help-adv-practice-card"><h4>{title}</h4><p>{desc}</p></div>
            ))}
          </div>
        </div>
        <div className="help-adv-ts-grid">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>Common Questions</h3>
          {[
            ['What happens if all emitters are disabled for a category?','The system uses Tier 3 fallback: all configured emitters will be available. This prevents props from having no emitters at all.'],
            ['Do I need to configure categories for every prop?','No! Props without categories will use all emitters (Tier 3 fallback). Categories are optional and only needed when you want fine control.'],
            ['Can I use the same category name across different props?','Yes! That\'s the whole point. Multiple props can share categories like "Forest" or "Dense". They\'ll all respect the same emitter configuration for that category.'],
            ['What if a prop has multiple categories but I only configure one?','Smart matching handles this! If the prop has ["Forest","Dense"] but you only disabled emitters for "Dense", the system will use Partial Match (Tier 2) and include emitters that work for "Forest".'],
          ].map(([q,a]) => (
            <div key={q} className="help-adv-ts-item">
              <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
              <div className="help-adv-ts-a"><p>{a}</p></div>
            </div>
          ))}
        </div>
        <div className="help-adv-practice-grid-wrapper">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">06</span>Pro Tips</h3>
          <div className="help-adv-practice-grid">
            {[
              ['','Start Broad, Then Specialize','Begin with general categories like "Forest", "Lava", "Rock". Add specific ones like "Dense", "Sparse" later for fine-tuning.'],
              ['','Use Descriptive Emitter Names','Name your emitters clearly (e.g., "Forest_Mist_Heavy" not "emit_03"). Makes configuration much easier.'],
              ['','Test with One Prop First','Configure one prop completely, generate and test it in-game, then apply the same category structure to other props.'],
              ['','Leverage Perfect Matches','For special props (like landmarks), enable specific emitters for ALL their categories to guarantee perfect matches.'],
              ['','Trust the Smart Matching','Don\'t overthink it! The 3-tier system ensures good results even if your configuration isn\'t perfect.'],
            ].map(([icon,title,desc]) => (
              <div key={title} className="help-adv-practice-card"><div className="help-adv-practice-icon">{icon}</div><h4>{title}</h4><p>{desc}</p></div>
            ))}
          </div>
        </div>
        <div className="help-adv-cta">
        </div>
      </>)}

              {activeEmitterHelpSubTab === 'simple' && (<>
        <div className="help-adv-hero">
          <div className="help-adv-hero-content">
            <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Emitter-Category Assignment (Simple Union Mode)</h2>
            <p className="help-adv-hero-desc">Simple Union mode offers a straightforward approach: any prop with a category gets ALL emitters that are active for that category. No complex matching logic — just collect all relevant emitters. Perfect for when you want broad categorization without needing perfect/partial match distinctions.</p>
          </div>
          <div className="help-adv-button-showcase">
            <div className="help-adv-fake-button" style={{ background: 'linear-gradient(135deg, var(--props-color) 0%, rgba(165,232,1,0.9) 100%)', color: '#000' }}>CONFIGURE ASSIGNMENT</div>
            <div className="help-adv-button-hint">Click this button to open the configuration modal</div>
          </div>
        </div>
        <div className="help-adv-process">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>How Simple Union Works</h3>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderLeft: '4px solid var(--props-color)', padding: '25px 30px', borderRadius: '8px', marginBottom: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#FFF', fontWeight: '600' }}>The Core Logic</h4>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '20px' }}>Unlike Smart Combination which uses 3-tier matching, Simple Union follows one rule:</p>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.2)' }}>
              <strong style={{ color: '#FFF', fontSize: '1.1rem' }}>"Use ALL emitters that are active for ANY of the prop's categories"</strong>
            </div>
          </div>
          <div className="help-adv-timeline">
            {[
              { n: '1', title: 'Define Prop Categories', body: 'Same as Smart Mode: Add categories like "Forest", "Dense", "Lava"', extra: <div className="help-adv-code-block" style={{ marginTop: '12px' }}><code>Prop: Forest Tree{'\n'}Categories: ["Forest", "Dense"]</code></div> },
              { n: '2', title: 'Configure Emitters', body: 'Toggle emitters for each category (green = active)', extra: <div className="help-adv-note" style={{ marginTop: '12px' }}>Configuration is the same, but matching logic differs</div> },
              { n: '3', title: 'Union Matching', body: 'Collect ALL emitters active for ANY category', extra: <div className="help-adv-file-badge" style={{ marginTop: '12px' }}><span className="help-adv-section-num">OR</span><span className="help-adv-badge-text">logic, not AND</span></div> },
            ].map(s => (
              <div key={s.n} className="help-adv-step">
                <div className="help-adv-step-num">{s.n}</div>
                <div className="help-adv-step-content"><h4>{s.title}</h4><p>{s.body}</p>{s.extra}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="help-adv-technical">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Simple vs Smart: The Key Difference</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px' }}>
            <div style={{ background: 'rgba(76,175,80,0.1)', border: '2px solid rgba(76,175,80,0.3)', borderRadius: '8px', padding: '25px' }}>
              <h4 style={{ color: '#4CAF50', fontSize: '1.1rem', marginBottom: '15px' }}> Smart Combination</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.7', marginBottom: '15px' }}>Tries to find the MOST SPECIFIC match:</p>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', paddingLeft: '20px' }}>
                <li>Tier 1: Perfect Match (ALL categories)</li>
                <li>Tier 2: Partial Match (ANY category)</li>
                <li>Tier 3: Fallback (everything)</li>
              </ul>
              <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(76,175,80,0.1)', borderRadius: '6px' }}>
                <strong style={{ color: '#4CAF50', fontSize: '0.85rem' }}>Best for:</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '5px 0 0' }}>Precise control, special combinations, tight emitter sets</p>
              </div>
            </div>
            <div style={{ background: 'rgba(33,150,243,0.1)', border: '2px solid rgba(33,150,243,0.3)', borderRadius: '8px', padding: '25px' }}>
              <h4 style={{ color: '#2196F3', fontSize: '1.1rem', marginBottom: '15px' }}> Simple Union</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.7', marginBottom: '15px' }}>Collects ALL matching emitters:</p>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', paddingLeft: '20px' }}>
                <li>If ANY category matches → add emitter</li>
                <li>Result: Union of all matches</li>
                <li>No priority tiers</li>
              </ul>
              <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(33,150,243,0.1)', borderRadius: '6px' }}>
                <strong style={{ color: '#2196F3', fontSize: '0.85rem' }}>Best for:</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '5px 0 0' }}>Broad categorization, maximum variety, simpler logic</p>
              </div>
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '30px', marginBottom: '35px' }}>
            <h4 style={{ fontSize: '1.25rem', marginBottom: '20px', color: '#FFF', fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Same Configuration, Different Results</h4>
            <div className="help-adv-code-sample">
              <pre><code>{`Prop Categories: ["Forest", "Dense"]

Configuration:
 FOREST:  Emitter_A ✓  |  Emitter_B ✓  |  Emitter_C ✗
 DENSE:   Emitter_A ✓  |  Emitter_B ✗  |  Emitter_C ✓

 Smart Combination Result:
 → Perfect Match: Only Emitter_A (active for BOTH Forest AND Dense)
 → Emitter_B and C are excluded (not perfect matches)

 Simple Union Result:
 → Union of matches: Emitter_A, B, C (all active for at least ONE category)
 → A: ✓Forest ✓Dense  |  B: ✓Forest  |  C: ✓Dense`}</code></pre>
            </div>
            <div style={{ marginTop: '20px', padding: '18px 25px', background: 'rgba(255,193,7,0.1)', borderRadius: '8px', borderLeft: '4px solid #FFC107' }}>
              <strong style={{ color: '#FFC107', fontSize: '0.95rem' }}>Key Takeaway:</strong>
              <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.7' }}>Smart Mode gives you <strong style={{ color: '#FFF' }}>one emitter</strong> (the perfect match). Simple Mode gives you <strong style={{ color: '#FFF' }}>three emitters</strong> (the union of all matches).</p>
            </div>
          </div>
        </div>
        <div className="help-adv-practice-grid-wrapper">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>When to Use Simple Union</h3>
          <div className="help-adv-practice-grid">
            {[
              ['Maximum Variety','You want each prop to have access to as many emitter options as possible, drawing from all relevant categories.'],
              ['Simpler Mental Model','You prefer straightforward OR logic over tiered matching. "Any match = include it" is easier to reason about.'],
              ['Broad Categorization','Your categories are meant as loose groupings rather than precise filters. You want "Forest-ish" effects, not exactly "Forest AND Dense".'],
              ['Testing & Exploration','You\'re experimenting with different emitter combinations and want to see more options per prop.'],
              ['Don\'t Use If...','You need tight control over specific combinations — use Smart Mode for "Lava AND Tall" to ONLY use emitters for both tags.'],
              ['Don\'t Use If...','You want minimal, curated emitter sets per prop. Simple Union tends to give more emitters, which increases randomness.'],
            ].map(([title,desc]) => (
              <div key={title} className="help-adv-practice-card"><h4>{title}</h4><p>{desc}</p></div>
            ))}
          </div>
        </div>
        <div className="help-adv-cta">
          <div className="help-adv-cta-content">
            <h3>Simple Union in a Nutshell</h3>
            <p>If your prop has categories ["A", "B"], it gets ALL emitters active for A plus ALL emitters active for B. No priority tiers, just collect everything.</p>
            <div className="help-adv-cta-checklist">
              <div className="help-adv-cta-check">✓ Easier to understand</div>
              <div className="help-adv-cta-check">✓ More emitters per prop</div>
              <div className="help-adv-cta-check">✓ Perfect for broad categorization</div>
              <div className="help-adv-cta-check">✓ Same fallback safety net</div>
            </div>
          </div>
        </div>
      </>)}

              {activeEmitterHelpSubTab === 'lastCategory' && (<>
        <div className="help-adv-hero">
          <div className="help-adv-hero-content">
            <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Emitter-Category Assignment (Last Category Only)</h2>
            <p className="help-adv-hero-desc">Last Category Only mode uses a hierarchical approach: only the LAST category in a prop's category list matters for emitter matching. This is perfect for hierarchical organization where categories become increasingly specific (e.g., "Forest" → "Dense" → "Old"). The system ignores all previous categories and matches only the most specific one.</p>
          </div>
        </div>
        <div className="help-adv-process">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>How Last Category Only Works</h3>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderLeft: '4px solid var(--props-color)', padding: '25px 30px', borderRadius: '8px', marginBottom: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#FFF', fontWeight: '600' }}>The Core Logic</h4>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '20px' }}>This mode follows one simple rule:</p>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.2)' }}>
              <strong style={{ color: '#FFF', fontSize: '1.1rem' }}>"Use only emitters active for the LAST category in the list"</strong>
            </div>
          </div>
          <div className="help-adv-code-sample">
            <div className="help-adv-code-label">Example:</div>
            <pre><code>{`Prop Categories: ["Forest", "Dense", "Old"]

Configuration:
 FOREST:  Emitter_A ✓  |  Emitter_B ✓  |  Emitter_C ✗
 DENSE:   Emitter_A ✗  |  Emitter_B ✓  |  Emitter_C ✓
 OLD:     Emitter_A ✗  |  Emitter_B ✗  |  Emitter_C ✓

Result: Only Emitter_C
Why: "Old" is the last category, only C is active for it`}</code></pre>
          </div>
        </div>
        <div className="help-adv-practice-grid-wrapper">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>When to Use Last Category Only</h3>
          <div className="help-adv-practice-grid">
            {[
              [' Hierarchical Organization','You structure categories from general to specific (e.g., "Forest" → "Dense" → "Old")'],
              [' Maximum Specificity','You want the most specific category to override all others. Earlier categories are just for folder organization.'],
              ['️ Clean Classification Paths','Perfect for creating deep classification structures where each category narrows down the prop type.'],
            ].map(([title,desc]) => (
              <div key={title} className="help-adv-practice-card"><h4>{title}</h4><p>{desc}</p></div>
            ))}
          </div>
        </div>
      </>)}
    </>
  )}

      {activeAdvancedSubTab === 'generate' && (
    <div className="help-adv-layout">
      <>
        <div className="help-adv-hero">
          <div className="help-adv-hero-content">
            <h2 className="help-adv-hero-title"><span className="help-adv-hero-icon"></span>Generate Files</h2>
            <p className="help-adv-hero-desc">All prop cards and coordinates are written to per-instance prop + script files, then automatically injected into your .scmap via the built-in parser and repacked — no external tools needed.</p>
          </div>
          <div className="help-adv-button-showcase">
            <div className="help-adv-fake-button" style={{ background: 'linear-gradient(135deg, var(--props-color) 0%, rgba(165,232,1,0.9) 100%)', color: '#000' }}>GENERATE FILES</div>
            <div className="help-adv-button-hint">SCMAP parser — fully automatic</div>
          </div>
        </div>
        <div className="help-adv-technical">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>What Happens on Generate</h3>
          <div className="help-adv-card-grid">
            {[
              {icon:'',title:'Prop + Script Files',desc:'For every coordinate on every card, a unique _prop.bp and _script.lua pair is written. The script spawns the prop blueprint at the given position and attaches an emitter via CreateEmitterAtBone.',features:['One file pair per coordinate per blueprint path','Files placed under env/props/emitter/props/[bpname]/[instance]/','Emitter .bp files copied from your configured source folder','Blueprint path picked at generation — supports texture ops']},
              {icon:'',title:'SCMAP Injection',desc:'The tool locates the .scmap in your map folder, unpacks it, writes a new numbered props.lua chunk, and repacks it back in place.',features:['No BrewMapTool or external software needed','New props.lua gets a unique index — never overwrites previous chunks','Repacked .scmap overwrites the original automatically','Visible in FA map editor after the next map load']},
              {icon:'',title:'README (optional)',desc:'A plain-text .txt file written to the map root summarising every setting, card, coordinate count, emitter matching mode, and blueprint path used at generation time.',features:['Toggle on/off with the checkbox below GENERATE FILES','Includes: map name, size, mirror mode, SCMAP filename, props.lua chunk name, total placements','Lists every prop card: name, coordinate count, blueprint paths, categories','Written to: maps/MapName.v0001/Props_Generation_README.txt']},
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
            ['No .scmap found error','The tool needs an existing .scmap in the map folder. Generate the base map in the FA editor first, then run the props generator.'],
            ['Props at wrong positions','Map Size mismatch — the size must match the actual .scmap dimensions. Check your _scenario.lua PlayableRect.'],
            ['Props missing after map load','Confirm the repack succeeded (check the success alert). If the .scmap was open in the FA editor during generation, close and reopen it.'],
            ['Props have no emitter effect','Check that emitter rows are configured, the emitter folder is set, and that emitter categories match the prop.'],
            ["Props.lua index conflict","Each run writes props.lua, props1.lua, props2.lua etc. to avoid collisions. If you see duplicates, check the unpacked folder for existing chunks."],
          ].map(([q,a])=>(
            <div key={q} className="help-adv-ts-item">
              <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
              <div className="help-adv-ts-a"><p>{a}</p></div>
            </div>
          ))}
        </div>
        <div className="help-adv-practice-grid-wrapper">
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Best Practices</h3>
          <div className="help-adv-practice-grid">
            {[
              ['Keep the .scmap backed up','Before a large generation run, copy the .scmap somewhere safe. Repack is non-destructive but a backup costs nothing.'],
              ['Enable README','The README documents all settings at generation time — invaluable when returning to a map weeks later.'],
              ['Re-generate Freely','Each run adds a new numbered props.lua chunk — nothing is overwritten. Adjust coordinates and regenerate as many times as needed.'],
              ['Multiple Blueprints','Add 3–5 blueprint paths per prop card for visual variety — a random one is picked per coordinate at generation.'],
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
            <div className="help-adv-file-item help-adv-file-item file help-adv-file-item highlight"><span></span><span>MyMap.v0001.scmap</span><span className="help-adv-file-badge">repacked in place</span></div>
            <div className="help-adv-file-item help-adv-file-item file emitter-help-tree-indent-1"><span></span><span>Props_Generation_README.txt</span><span className="help-adv-file-size">if toggle enabled</span></div>
            <div className="help-adv-file-item help-adv-file-item folder emitter-help-tree-indent-1" style={{paddingTop:'8px'}}><span></span><span>env/props/emitter/</span></div>
            <div className="help-adv-file-item help-adv-file-item file emitter-help-tree-indent-1" style={{paddingLeft:'36px'}}><span></span><span>forest_mist_emit.bp</span><span className="help-adv-file-size">copied emitter</span></div>
            <div className="help-adv-file-item help-adv-file-item folder emitter-help-tree-indent-1" style={{paddingLeft:'36px'}}><span></span><span>props/</span></div>
            <div className="help-adv-file-item help-adv-file-item folder emitter-help-tree-indent-1" style={{paddingLeft:'60px'}}><span></span><span>Dead01_Group1_prop/</span><span className="help-adv-file-size">per blueprint</span></div>
            <div className="help-adv-file-item help-adv-file-item folder emitter-help-tree-indent-1" style={{paddingLeft:'84px'}}><span></span><span>Dead01_Group1_prop_01/</span></div>
            <div className="help-adv-file-item help-adv-file-item file emitter-help-tree-indent-1" style={{paddingLeft:'108px'}}><span></span><span>Dead01_Group1_prop_01_prop.bp</span></div>
            <div className="help-adv-file-item help-adv-file-item file emitter-help-tree-indent-1" style={{paddingLeft:'108px'}}><span></span><span>Dead01_Group1_prop_01_script.lua</span></div>
            <div className="help-adv-file-item help-adv-file-item file emitter-help-tree-indent-1" style={{paddingLeft:'108px',opacity:0.5}}><span></span><span>Dead01_Group1_prop_02 … _NN</span></div>
          </div>
        </div>
        <div className="help-adv-structure" style={{marginTop:'40px'}}>
          <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>File Contents</h3>
          <div className="help-adv-card-grid">
            {[
              {title:'Prop Script (_script.lua)',desc:'Each instance gets its own script that spawns the prop blueprint at its coordinate and attaches an emitter.',code:`local Prop = import('/lua/sim/Prop.lua').Prop\n\nDead01_Group1_prop_01 = Class(Prop) {\n  _onCreateExecuted = false,\n  OnCreate = function(self)\n    Prop.OnCreate(self)\n    if Dead01_Group1_prop_01._onCreateExecuted then\n      self:Destroy(); return\n    end\n    Dead01_Group1_prop_01._onCreateExecuted = true\n    local treeGroup = CreateProp(Vector(128.0, 2.0, 256.0),\n      '/env/Lava/props/trees/Dead01_Group1_prop.bp')\n    if treeGroup and treeGroup.Trash then\n      treeGroup.Trash:Add(CreateEmitterAtBone(\n        treeGroup, -1, -1,\n        '/maps/MyMap.v0001/env/props/emitter/heat_emit.bp'))\n    end\n    self:Destroy()\n  end,\n}\nTypeClass = Dead01_Group1_prop_01`},
              {title:'README File (optional)',desc:'A plain-text summary written to the map root when the README toggle is enabled. Documents every setting, card, and path used at generation time.',code:`╔════════════════════════════════════╗\n║  PROPS GENERATION — README         ║\n╚════════════════════════════════════╝\n\n  Generated  : 10/03/2026 at 14:22\n  Tool       : ForgeMapToolkit — Props Tab\n\n  MAP SETTINGS\n  Map Name   : MyMap.v0001\n  Map Size   : 1024 × 1024\n  Mirror Mode: diagonal\n\n  OUTPUT SUMMARY\n  SCMAP file : MyMap.v0001.scmap  ← repacked\n  Props chunk: props1.lua\n  Total placements: 32\n\n  PROP CARDS\n  [01] Lava Trees\n       Coordinates : 16\n       Blueprint paths (2):\n         • /env/Lava/props/trees/Dead01_prop.bp\n         • /env/Lava/props/trees/Dead02_prop.bp\n       Categories  : lava, tree`},
            ].map(item=>(
              <div key={item.title} className="help-adv-card">
                <div className="help-adv-card-header"><h4>{item.title}</h4></div>
                <div className="help-adv-card-body">
                  <p className="help-adv-card-desc">{item.desc}</p>
                  <div className="emitter-help-adv-code-sample" style={{marginTop:'12px'}}>
                    <div className="emitter-help-adv-code-label">Example output:</div>
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

export default PropsHelpModal;
