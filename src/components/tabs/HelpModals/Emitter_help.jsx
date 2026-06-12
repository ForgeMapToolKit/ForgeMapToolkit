import React from "react";

// ── EmitterHelpModal ──────────────────────────────────────────────────────────

function EmitterHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab }) {

  const [activeEmitterHelpSubTab, setActiveEmitterHelpSubTab] = React.useState('smart');

  const TABS = [
    { id: 'emittertab', label: 'Emitter Tab' },
    { id: 'advanced',   label: 'Advanced Guide' },
  ];

  const EMITTER_INFO = {
    mapname: {
      title: 'Map Name',
      desc: 'The exact folder name of your map in the /maps directory. Must match case-perfectly — FA is strict.',
      details: [
        ['Format', 'MapName.vXXXX — e.g. Hades_Dust.v0002'],
        ['Auto-version', 'If you dont enter a version it will add .v0001 automatically'],
        ['Case-sensitive', 'FA is strict — match the folder exactly'],
        ['Impact', 'Wrong name = emitter paths resolve to nothing in-game'],
      ],
      tip: 'Copy the folder name directly from File Explorer to avoid typos.',
    },
    mapsize: {
      title: 'Map Size',
      desc: 'The playable area width/height in world units — read automatically from your map\'s save.lua when a valid Map Name is entered. All canvas coordinates and grid generation are scaled relative to this value.',
      details: [
        ['Auto-detected', 'Read from save.lua via the map folder — no manual input needed'],
        ['Standard sizes', '256 = 5×5 km · 512 = 10×10 km · 1024 = 20×20 km'],
        ['Non-power-of-2', 'Maps like 768 (15×15 km) are supported — the exact playable size is used'],
        ['Info display', 'Total map size and km are shown below the Map Name field once detected'],
        ['Impact', 'Wrong Map Name or missing map folder = size cannot be detected'],
      ],
      tip: 'Make sure Map Name is correct and the map folder exists — the size is filled in automatically.',
    },

    globalrandomness: {
      title: 'Global Randomness',
      desc: 'Applies Poisson Disk Sampling scatter to all grid-generated coordinates. The Poisson Min. Distance ensures no two points are placed closer than the given value — producing organic, natural-looking distributions without clustering.',
      details: [
        ['Poisson Min. Distance', 'Minimum world-unit gap between any two placed grid points'],
        ['0 = pure grid', 'No scatter at all — points placed exactly on the regular grid'],
        ['Suggested range', '10–40 units for a natural look while preserving grid structure'],
        ['Per-card override', 'Set per-card Poisson radius > 0 to override the global value for that card'],
        ['Manual clicks', 'Not affected — only applies to grid generation'],
      ],
      tip: 'Set Poisson Min. Distance to roughly half your grid step for a relaxed, organic scatter without gaps.',
    },
    areamask: {
      title: 'Area Mask',
      desc: 'A grayscale image that controls where emitters are allowed to spawn during grid generation. White pixels (>127) are valid; black pixels are blocked.',
      details: [
        ['Slide Right', 'Blocked point scans rightward until a white pixel is found'],
        ['Slide Left',  'Blocked point scans leftward until a white pixel is found'],
        ['Ignore',      'Blocked point is simply skipped — leaves gaps in the grid'],
        ['Manual clicks', 'NOT filtered by mask — always places regardless'],
      ],
      tip: 'Generate your Mask always in Gaea to have a mask which fits perfectly your Map. Use the Abs-node to simulate what the ForgeMapToolkit is doing and see the exact outcome.',
    },
    emittercard: {
      title: 'Emitter Card',
      desc: 'One card = one emitter type. Each card holds its own blueprint path(s), grid step values, randomness override, and coordinate list.',
      details: [
        ['Multiple paths', 'Add multiple .bp paths per card for random variety per position'],
        ['Color dot', 'Click the color dot to change the marker color on the preview canvas'],
        ['Label', 'Used in README output and canvas legend — purely cosmetic'],
        ['Selected card', 'Canvas clicks place coordinates into the currently selected card'],
      ],
      tip: 'Keep separate cards for different effect types (smoke, fog, wind) for easy editing.',
    },
    emitterpath: {
      title: 'Emitter Path',
      desc: 'The in-game path to the emitter blueprint file. One path is randomly selected per coordinate when files are generated.',
      details: [
        ['Game paths', '/env/, /effects/, /textures/ paths are used as-is'],
        ['Map paths', 'Relative paths get /maps/{mapName}/ prepended automatically'],
        ['Multiple paths', 'If you dont configure an Emitter Matching Mode. One Emitter will be randomly chosen per coordinate at generation'],
        ['Delete', 'Click the x button on the right to remove this path row'],
      ],
      tip: 'Use the Library button to browse available emitter assets — typing paths manually is error-prone. Custom Emitters must be either in the Mapfolder or in public/emitter/{category}',
    },
    gridstep: {
      title: 'Grid Step X / Z',
      desc: 'World-unit spacing between grid points. Smaller values = denser coverage. Click Generate Grid to apply.',
      details: [
        ['X Step', 'Horizontal spacing between points (world units)'],
        ['Z Step', 'Vertical spacing between points (world units)'],
        ['Coverage', 'Covers the entire map size — e.g. 1024×1024 with 64 step = 256 points'],
        ['Area Mask', 'Filtered before adding — mask-blocked points are adjusted or skipped'],
      ],
      tip: 'Start coarse (256×256), verify in-game, then decrease for denser effects.',
    },
    cardrandomness: {
      title: 'Card Randomness Override',
      desc: 'Per-card Poisson Min. Distance that overrides the global value when set > 0. Useful when different emitter types need different scatter densities.',
      details: [
        ['Poisson Radius > 0', 'Overrides the global Poisson Min. Distance for this card only'],
        ['Set to 0', 'Falls back to the global Poisson Min. Distance'],
        ['Independence', 'Each card can have its own scatter — e.g. dense fog vs sparse dust'],
      ],
      tip: 'Leave at 0 unless this card needs a different scatter behaviour than others.',
    },
    coordinates: {
      title: 'Coordinates List',
      desc: 'The list of world-space (X, Z) positions where emitters will be placed. Populated by canvas clicks or Grid generation.',
      details: [
        ['Canvas click', 'Places a point at the clicked world coordinate'],
        ['Click existing dot', 'Deletes the dot (and its mirror pair if mirroring is active)'],
        ['Mirror pair', 'Mirrored points are shown with a corner bracket indicator'],
        ['Manual entry', 'X/Z values can be typed directly in the coordinate list'],
      ],
      tip: 'Use the canvas for coarse placement, then fine-tune X/Z values in the list.',
    },
    generatebtn: {
      title: 'Generate Files',
      desc: 'Validates configuration, writes per-emitter prop + script files, injects a props.lua into your .scmap via the built-in parser, and repacks — all in one click.',
      details: [
        ['Creates', 'Per-coordinate _prop.bp + _script.lua under env/props/emitter/plain/'],
        ['SCMAP', 'Unpacks .scmap → injects props.lua → repacks back in place automatically'],
        ['README', 'Optional text file documenting all settings at generation time'],
        ['Requirements', 'Maps Folder set · Map Name filled · .scmap present in map folder · ≥1 card with path + coordinates'],
      ],
      tip: 'The .scmap must already exist in the map folder.',
    },
    generationmode: {
      title: 'Generate README',
      desc: 'Generates a README File with all informations about the configuration and used emitters as well as Credits',
      details: [
        ['Content', 'lists all Map Settings, Output Summary, Emitter Cards, Credits at generation time'],
        ['Use-Case', 'Useful when you want to inform other people about the Folder Structure or helps to orientate yourself'],
      ],
      tip: 'The file size will be minimal and it helps other people and yourself to orientate yourself. especially when you end up with hundreds of subfolders',
    },
    mirrormode: {
      title: 'Mirror Mode',
      desc: 'Automatically places a mirrored copy of every canvas-placed coordinate. Useful for symmetric map layouts.',
      details: [
        ['None', 'No mirroring — each click places one point'],
        ['Diagonal', '(Mapsize - x) and (Mapsize - z) so that it is mirrored along both axis'],
        ['Horizontal', 'Mirrors across the horizontal (Z) axis only'],
        ['Vertical', 'Mirrors across the vertical (X) axis only'],
      ],
      tip: 'Click on an existing dot to delete both the point and its mirror pair simultaneously.',
    },
    preview: {
      title: 'Preview Section',
      desc: 'The Preview section. When a valid Map Name is set, the canvas background is loaded automatically from the .scmap file. You can still upload a custom image manually at any time.',
      details: [
        ['Auto-load', 'Preview image is read directly from your .scmap whenever the Map Name changes — no manual upload needed'],
        ['Manual override', 'Click the upload area to load any PNG/JPG as canvas background instead — useful if the .scmap image is outdated'],
        ['Loading indicator', '"Loading preview from .scmap…" appears while the image is being unpacked'],
        ['Delete Preview', 'The "Delete Preview" button clears the current background image'],
      ],
      tip: 'Make sure the Map Name is correct and the .scmap exists in the map folder — the preview will then load automatically.',
    },
    canvas: {
      title: 'Map Canvas',
      desc: 'The interactive canvas representing the full map area. Click anywhere to place an emitter coordinate for the selected card.',
      details: [
        ['Click to place', 'Converts pixel position to world (X, Z) coordinate for the selected card'],
        ['Click dot',      'Clicking an existing dot deletes it and its mirror pair if mirroring is active'],
        ['Background',     'Upload a heightmap or screenshot for visual placement reference'],
        ['Mirror lines',   'Dashed lines show the active symmetry axis — visual reference only'],
      ],
      tip: 'Use the canvas for coarse placement, then fine-tune X/Z values in the coordinate list on the card if necessary.',
    },
    deletepreview: {
      title: 'Delete Dot',
      desc: 'Clicking an existing emitter dot removes it. If mirror mode is active, both the clicked dot and its mirrored counterpart are deleted in one click.',
      details: [
        ['Single delete', 'Click dot → removes that coordinate from the card list'],
        ['Mirror delete',  'Mirror mode active → clicked dot and its pair both removed'],
        ['No undo',        'There is no undo — re-add via canvas click or manual entry'],
      ],
      tip: 'Use the coordinate list on the emitter card to remove specific coordinates without using the canvas.',
    },
    uploadmap: {
      title: 'Upload Map Image (Manual)',
      desc: 'Manually upload a top-down map image as the canvas background. Useful when the .scmap preview is outdated or you want to use a custom render.',
      details: [
        ['Auto-load first', 'The preview is normally loaded automatically from the .scmap — use manual upload only as an override'],
        ['Formats',   'PNG, JPG, WEBP supported'],
        ['Purpose',   'Background reference only — does not affect coordinates or output'],
        ['Persist',   'Saved in memory during the session'],
        ['Source',    'Export from FA map editor, Gaea render, or in-game screenshot'],
      ],
      tip: 'For best accuracy, let the tool load the preview automatically from the .scmap. Only upload manually if you have a better reference image.',
    },
    mapsfolder: {
      title: 'Maps Folder',
      desc: 'The absolute path to your /maps directory. All generated output files are written into subdirectories here.',
      details: [
        ['Required',  'Generation fails without a maps folder selected'],
        ['Path',      'Typical: Documents\\My Games\\...\\Supreme Commander Forged Alliance\\maps'],
        ['Persist',   'Set once in Settings — survives app restarts and shared across tabs'],
        ['Shared',    'All tool tabs (Emitter, Wreckage) read from the same settings value'],
      ],
      tip: 'Configure in Settings once so you never need to reselect it.',
    },
    addcard: {
      title: 'Add Emitter Card',
      desc: 'Creates a new emitter card for an additional emitter effect type. Each card is fully independent with its own paths, coordinates, and settings.',
      details: [
        ['Independent', 'Each card has its own blueprint paths, grid steps, coordinate list and categories'],
        ['Color',       'New cards get a random color — click the dot to change it'],
        ['Variety',     'Together with the Emitter-Category Assignement you can create all Emitters with their different Emitters in one session.'],
      ],
      tip: 'Assign a fitting color to each Emitter to also have a visual order',
    },
    generategrid: {
      title: 'Generate Grid',
      desc: 'Fills the entire map with evenly-spaced coordinates based on the Grid Step X and Z values. Area Mask is applied before points are added.',
      details: [
        ['Replaces',   'Clears existing coordinates for this card and generates a fresh grid'],
        ['Area Mask',  'Mask-filtered points are adjusted (slide) or skipped (ignore)'],
        ['Randomness', 'Global and per-card randomness is applied to each grid point'],
        ['Symmetry',   'Mirror mode auto-creates pairs for every grid point'],
      ],
      tip: 'Start coarse (Grid Step 256) to verify setup, then reduce for final density.',
    },
    legend: {
      title: 'Emitter Legend',
      desc: 'Shows all emitter cards with their color indicator and live coordinate count. The active card is highlighted. Click a legend entry to switch which card receives canvas clicks.',
      details: [
        ['Active card', 'Highlighted row = the card currently receiving canvas clicks'],
        ['Color dot',   'Matches the indicator on the card — click it to change the color'],
        ['Point count', 'Live count of coordinates stored in that card list'],
        ['Multi-card',  'All cards dots visible simultaneously on the canvas in their respective colors'],
      ],
      tip: 'Use distinct colors per card type to easily distinguish placements on the canvas.',
    },
    matchingmode: {
      title: 'Emitter Matching Mode',
      desc: 'Controls how emitter paths are selected per card when categories are active. Three modes give you different levels of precision — from strict intersection to broad union.',
      details: [
        ['Smart Combination (3-Tier)', 'Tier 1: searches for a perfect match of all categories → Tier 2: if Tier 1 not available - does any emitter fit a certain category  → Tier 3: if Tier 2 not available - Select all emitters as a fallback'],
        ['Simple Union',   'Collects all emitters active for any of the card\'s categories — no priority tiers'],
        ['Last Category',  'Only the last category in the card\'s list is used for matching'],
        ['No categories',  'When a card has no categories defined, all emitter paths are used regardless of mode'],
      ],
      tip: 'Smart Combination allows the highest form of precision while Simple Union allows the highest form of variety. Last Category allows precision while also having variety',
    },
    categoryassign: {
      title: 'Configure Emitter-Category Assignment',
      desc: 'Opens the assignment overlay where you toggle which emitter paths are active for each card category. Cyan = active, gray = excluded. All emitters are active by default.',
      details: [
        ['Per-category',   'Each category defined on any card gets its own row in the overlay'],
        ['Toggle buttons', 'Click a button to activate or deactivate that emitter for the category'],
        ['Live Preview',   'The sidebar shows in real time which emitters each card will use'],
        ['Fallback',       'If all emitters for a category are deactivated, all emitters are used as a safety fallback'],
      ],
      tip: 'Check the Live Preview sidebar before generating to verify each card gets the correct emitters.',
    },
  };

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div className="help-modal" style={{ '--tab-color': 'var(--emitter-color)', '--tab-glow': 'var(--emitter-glow)', '--tab-glow-strong': 'var(--emitter-glow-strong)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">Emitter Generator — Help Guide</h2>
          <button
            onClick={onClose}
            className="help-modal-close"
          >×</button>
        </div>

        {/* Tabs */}
        <div className="help-modal-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`help-modal-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >{t.label}</button>
          ))}
        </div>

        <div className="help-modal-content">

          {/*  EMITTER TAB — 1:1 Replica  */}
          {activeTab === 'emittertab' && (
            <div style={{ display: 'flex', gap: '48px', height: '100%', minHeight: 0 }}>

              {/* Left: 1:1 replica of the actual EmitterTab */}
              <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: '28px', borderRight: '1px solid rgba(0,221,255,0.1)' }}>
                <div style={{ padding: '0 0 16px', fontSize: '0.72rem', color: 'rgba(0,221,255,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase', borderBottom: '1px solid rgba(0,221,255,0.08)', marginBottom: '20px' }}>
                  ← Click any element to learn about it
                </div>

                {/* Two-column layout matching real tab — tab-content wraps at 1400px */}
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div className="tab-grid tab-grid--help">

                  {/*  LEFT: Config + Emitters + Generate  */}
                  <div className="tab-col-config">

                    {/* CONFIGURATION card */}
                    <div className="section-card">
                      <h2 className="section-title" style={{ marginBottom: '16px' }}>CONFIGURATION</h2>

                      <div className="form-group" onClick={() => setHelpSelected('mapname')}
                        style={{ cursor: 'pointer', outline: helpSelected === 'mapname' ? '2px solid rgba(0,221,255,0.8)' : 'none', marginBottom: '12px' }}>
                        <label className="form-label">Map Name</label>
                        <input readOnly onChange={() => {}} className="form-input" placeholder="e.g. Hades_Dust.v0002" />
                      </div>

                      <div className="form-group" onClick={() => setHelpSelected('mapsize')}
                        style={{ cursor: 'pointer', outline: helpSelected === 'mapsize' ? '2px solid rgba(0,221,255,0.8)' : 'none', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>MAP</span>
                          <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>1024 × 1024</span>
                          <span style={{ color: 'rgba(255,255,255,0.22)' }}>·</span>
                          <span>20 km</span>
                          <span style={{ color: 'rgba(0,221,255,0.5)', fontSize: '0.6rem', marginLeft: '4px' }}>← auto-detected</span>
                        </div>
                      </div>

                      <div onClick={() => setHelpSelected('globalrandomness')}
                        style={{ cursor: 'pointer', outline: helpSelected === 'globalrandomness' ? '2px solid rgba(0,221,255,0.8)' : 'none', padding: '8px', marginBottom: '4px' }}>
                        <div className="subsection-title" style={{ marginTop: 0 }}>Global Randomness</div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Poisson Min. Distance (units)</label>
                          <input readOnly onChange={() => {}} className="form-input" placeholder="0" />
                        </div>
                      </div>

                      <div onClick={() => setHelpSelected('areamask')}
                        style={{ cursor: 'pointer', outline: helpSelected === 'areamask' ? '2px solid rgba(0,221,255,0.8)' : 'none', padding: '8px', marginBottom: '4px' }}>
                        <div className="subsection-title" style={{ marginTop: 0 }}>Area Mask</div>
                        <div className="emitter-upload-area" style={{ padding: '12px', fontSize: '0.82rem', pointerEvents: 'none', marginBottom: '8px' }}>
                          <span>Click to upload mask image (B/W)</span>
                        </div>
                        <select className="form-input" style={{ pointerEvents: 'none' }}>
                          <option>Slide Right — shift emitter rightward to next white pixel</option>
                        </select>
                      </div>
                    </div>

                    {/* EMITTERS card */}
                    <div className="section-card">
                      <h2 className="section-title" style={{ marginBottom: '16px' }}>EMITTERS</h2>

                      {/* Emitter card replica — selected state */}
                      <div className="emitter-unit-card selected" onClick={() => setHelpSelected('emittercard')}
                        style={{ cursor: 'pointer', outline: helpSelected === 'emittercard' ? '2px solid rgba(0,221,255,0.8)' : 'none', marginBottom: '8px' }}>
                        <div className="emitter-unit-card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <div className="emitter-color-indicator" style={{ backgroundColor: '#00DDFF', pointerEvents: 'none' }} />
                            <span className="emitter-unit-card-title">DustCloud</span>
                          </div>
                          <button className="btn-delete-sm" style={{ pointerEvents: 'none' }}>×</button>
                        </div>
                        <div className="emitter-unit-card-content" onClick={e => e.stopPropagation()}>
                          <input readOnly onChange={() => {}} className="form-input" placeholder="Label (e.g. Fire Emitters)..." style={{ marginBottom: '10px' }} />

                          <label className="form-label" style={{ marginBottom: '4px', display: 'block' }}>Emitter Paths (emit.bp)</label>
                          <div className="emitter-input-with-button" onClick={() => setHelpSelected('emitterpath')}
                            style={{ cursor: 'pointer', outline: helpSelected === 'emitterpath' ? '2px solid rgba(0,221,255,0.8)' : 'none' }}>
                            <input readOnly onChange={() => {}} className="form-input" placeholder="/env/Desert/Props/Emitters/DesertBlowingSand02_prop.bp" style={{ fontFamily: 'monospace', fontSize: '0.78rem', pointerEvents: 'none' }} />
                            <button className="btn-delete-sm" style={{ pointerEvents: 'none' }}>×</button>
                          </div>

                          <button className="btn-secondary" style={{ width: '100%', marginBottom: '6px', pointerEvents: 'none', fontSize: '0.78rem' }}>+ Add Emitter Path</button>
                          <button className="btn-library" style={{ width: '100%', pointerEvents: 'none' }}>Library</button>

                          {/* Grid placement — expanded since selected */}
                          <div style={{ marginTop: '14px' }}>
                            <div className="subsection-title" style={{ marginTop: 0 }}>Grid Placement</div>
                            <div
                              onClick={e => { e.stopPropagation(); setHelpSelected('gridstep'); }}
                              style={{ cursor: 'pointer', outline: helpSelected === 'gridstep' ? '2px solid rgba(0,221,255,0.8)' : 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>X Step</label>
                                <input readOnly onChange={() => {}} className="form-input" placeholder="64" style={{ pointerEvents: 'none' }} />
                              </div>
                              <div>
                                <label className="form-label" style={{ fontSize: '0.7rem' }}>Z Step</label>
                                <input readOnly onChange={() => {}} className="form-input" placeholder="64" style={{ pointerEvents: 'none' }} />
                              </div>
                            </div>
                            <button className="btn-secondary" style={{ width: '100%', marginBottom: '12px', pointerEvents: 'none', fontSize: '0.78rem' }}
                              onClick={e=>{e.stopPropagation();setHelpSelected('generategrid');}}>Generate Grid</button>

                            <div className="subsection-title" style={{ marginTop: 0 }}>Card Randomness Override</div>
                            <div
                              onClick={e => { e.stopPropagation(); setHelpSelected('cardrandomness'); }}
                              style={{ cursor: 'pointer', outline: helpSelected === 'cardrandomness' ? '2px solid rgba(0,221,255,0.8)' : 'none', marginBottom: '8px' }}>
                              <label className="form-label" style={{ fontSize: '0.7rem' }}>Poisson Min. Distance (units)</label>
                              <input readOnly onChange={() => {}} className="form-input" placeholder="0" style={{ pointerEvents: 'none' }} />
                            </div>

                            <div className="subsection-title" style={{ cursor: 'pointer' }}
                              onClick={e => { e.stopPropagation(); setHelpSelected('coordinates'); }}>
                              Coordinates (3)
                              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Add emitter card button */}
                      <button className="btn-secondary" onClick={()=>setHelpSelected('addcard')} style={{ width: '100%', fontSize: '0.8rem', outline:helpSelected==='addcard'?'2px solid rgba(0,221,255,0.8)':'none' }}>+ Add Emitter Card</button>
                    </div>

                    {/* EMITTER MATCHING MODE + CATEGORY ASSIGNMENT card */}
                    <div className="section-card">
                      <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>
                        Emitter Matching Mode
                      </label>

                      {/* Matching mode radio options — clickable as a group */}
                      <div
                        onClick={() => setHelpSelected('matchingmode')}
                        style={{ cursor: 'pointer', outline: helpSelected === 'matchingmode' ? '2px solid rgba(0,221,255,0.8)' : 'none', marginBottom: '14px', padding: '2px' }}
                      >
                        {[
                          { key: 'smart',        label: 'Smart Combination (3-Tier)', desc: 'Perfect Match → Partial Match → Fallback' },
                          { key: 'simple',       label: 'Simple Union',               desc: 'Use ALL emitters active for ANY category' },
                          { key: 'lastCategory', label: 'Last Category Only',         desc: 'Match only the last category in the list' },
                        ].map(({ key, label, desc }, idx) => (
                          <div key={key}
                            style={{
                              padding: '10px 14px',
                              marginBottom: idx < 2 ? '6px' : 0,
                              background: idx === 0 ? 'linear-gradient(135deg, rgba(0,221,255,0.12) 0%, rgba(0,221,255,0.05) 100%)' : 'rgba(255,255,255,0.04)',
                              border: `2px solid ${idx === 0 ? 'var(--emitter-color)' : 'rgba(255,255,255,0.12)'}`,
                              borderRadius: '6px',
                              pointerEvents: 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
                              <div style={{
                                width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${idx === 0 ? 'var(--emitter-color)' : 'rgba(255,255,255,0.4)'}`,
                                background: idx === 0 ? 'var(--emitter-color)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {idx === 0 && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#000' }} />}
                              </div>
                              <strong style={{ fontSize: '0.85rem', color: idx === 0 ? 'var(--emitter-color)' : '#fff', fontWeight: 600 }}>{label}</strong>
                            </div>
                            <p style={{ margin: '0 0 0 26px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{desc}</p>
                          </div>
                        ))}
                      </div>

                      {/* Configure button */}
                      <button
                        className="btn-secondary"
                        style={{ width: '100%', padding: '12px', fontSize: '0.85rem', outline: helpSelected === 'categoryassign' ? '2px solid rgba(0,221,255,0.8)' : 'none' }}
                        onClick={() => setHelpSelected('categoryassign')}
                      >
                        Configure Emitter-Category Assignment
                      </button>
                    </div>

                    {/* GENERATE card — exact replica of real tab */}
                    <div className="section-card">
                      {/* README checkbox */}
                      <div onClick={() => setHelpSelected('generationmode')}
                        style={{ cursor: 'pointer', outline: helpSelected === 'generationmode' ? '2px solid rgba(0,221,255,0.8)' : 'none', marginBottom: '20px', padding: '4px' }}>
                        <label className="checkbox-label" style={{ pointerEvents: 'none' }}>
                          <div className="checkbox checked">
                            <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <span className="checkbox-text" style={{ color: 'var(--emitter-color)' }}>Generate README file</span>
                        </label>
                      </div>
                      {/* Generate button */}
                      <button className="btn-primary btn-lg" onClick={() => setHelpSelected('generatebtn')}
                        style={{ width: '100%', outline: helpSelected === 'generatebtn' ? '2px solid rgba(0,221,255,0.8)' : 'none', pointerEvents: 'auto' }}>
                        GENERATE FILES
                      </button>
                    </div>
                  </div>

                  {/*  RIGHT: Preview — exact replica of real tab  */}
                  <div className="tab-col-detail">
                    <div className="section-card">

                      {/* Preview header — PREVIEW title + mirror dropdown */}
                      <div className="emitter-preview-header" style={{ marginBottom: '16px' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>PREVIEW</h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div onClick={e=>{e.stopPropagation();setHelpSelected('mirrormode');}}
                            style={{ cursor: 'pointer', outline: helpSelected==='mirrormode' ? '2px solid rgba(0,221,255,0.8)' : 'none' }}>
                            <select className="btn-toggle" style={{ pointerEvents: 'none' }}>
                              <option>Diagonal</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Upload area — own click */}
                      <div onClick={e=>{e.stopPropagation();setHelpSelected('uploadmap');}}
                        style={{ cursor:'pointer', outline:helpSelected==='uploadmap'?'2px solid rgba(0,221,255,0.8)':'none', marginBottom:'16px' }}>
                        <div className="emitter-upload-area" style={{ pointerEvents:'none' }}>
                          <span>Click to upload map image</span>
                        </div>
                      </div>

                      {/* Canvas — own click, black background */}
                      <div
                        onClick={e=>{e.stopPropagation();setHelpSelected('canvas');}}
                        style={{ cursor:'pointer', outline:helpSelected==='canvas'?'2px solid rgba(0,221,255,0.8)':'none',
                          width:'100%', aspectRatio:'1/1', background:'#0a0a0a',
                          border:'1px solid rgba(255,255,255,0.08)', position:'relative', marginBottom:'10px', overflow:'hidden' }}>
                        <svg width="100%" height="100%" viewBox="0 0 700 700" style={{position:'absolute',inset:0}}>
                          <defs><filter id="cg2"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                          {[1,2,3,4,5,6,7].map(i=>(
                            <g key={i}>
                              <line x1={i*87.5} y1="0" x2={i*87.5} y2="700" stroke="white" strokeWidth="0.5" opacity="0.07"/>
                              <line x1="0" y1={i*87.5} x2="700" y2={i*87.5} stroke="white" strokeWidth="0.5" opacity="0.07"/>
                            </g>
                          ))}
                          <line x1="350" y1="0" x2="350" y2="700" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="12 8"/>
                          <line x1="0" y1="350" x2="700" y2="350" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="12 8"/>
                          {[[140,115],[560,585],[254,161],[446,539],[92,320],[608,380]].map(([cx,cy],i)=>(
                            <circle key={i} cx={cx} cy={cy} r="8" fill="#00DDFF" filter="url(#cg2)" stroke="white" strokeWidth="2.5"/>
                          ))}
                          {[[300,90],[400,610],[400,300],[300,400]].map(([cx,cy],i)=>(
                            <circle key={i} cx={cx} cy={cy} r="6" fill="#FF8844" filter="url(#cg2)"/>
                          ))}
                        </svg>
                      </div>

                      {/* Legend — own click */}
                      <div onClick={e=>{e.stopPropagation();setHelpSelected('legend');}}
                        style={{cursor:'pointer',outline:helpSelected==='legend'?'2px solid rgba(0,221,255,0.8)':'none', marginBottom:'10px'}}>
                        <div className="emitter-legend" style={{pointerEvents:'none', marginTop:0}}>
                          <div className="emitter-legend-title">EMITTER LEGEND</div>
                          <div className="emitter-legend-items">
                            <div className="emitter-legend-item active">
                              <div className="emitter-legend-color" style={{backgroundColor:'#00DDFF'}}/><span>DustCloud</span><span className="emitter-coord-count">6 pts</span>
                            </div>
                            <div className="emitter-legend-item" style={{opacity:0.5}}>
                              <div className="emitter-legend-color" style={{backgroundColor:'#FF8844'}}/><span>SteamVent</span><span className="emitter-coord-count">2 pts</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hint box — own click */}
                      <div onClick={e=>{e.stopPropagation();setHelpSelected('mirrormode');}}
                        style={{cursor:'pointer',outline:helpSelected==='mirrormode'?'2px solid rgba(0,221,255,0.8)':'none'}}>
                        <div className="emitter-hint-box" style={{pointerEvents:'none',margin:0}}>
                          Click canvas to place · Click dot to delete · diagonal mirroring active
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
                </div>
              </div>

              {/* Right: explanation panel */}
              <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', opacity: 0.25, color: 'var(--emitter-color)', fontWeight: 300 }}>←</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Select an element</div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.15)', maxWidth: '240px', lineHeight: 1.7 }}>Click any field, button, section, or control on the left to learn what it does.</div>
                  </div>
                ) : (() => {
                  const sel = EMITTER_INFO[helpSelected];
                  if (!sel) return null;
                  return <EmitterHelpInfoPanel sel={sel} />;
                })()}
              </div>
            </div>
          )}

          {/*  ADVANCED GUIDE  */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout">

              {/* Sub-tab switcher — shared style */}
              <div className="help-adv-subtabs">
                {[
                  {id:'workflow',label:'Workflow'},{id:'configuration',label:'Configuration'},
                  {id:'emittercards',label:'Emitter Cards'},{id:'canvas',label:'Preview & Canvas'},
                  {id:'mask',label:'Area Mask'}, {id:'emitter',label:'Emitter Assignment'}, {id:'generate',label:'Generate & Output'},
                ].map(t=>(
                  <button key={t.id} onClick={()=>setActiveAdvSubTab(t.id)}
                    className={`help-adv-subtab${activeAdvSubTab===t.id?' active':''}`}
                  >{t.label}</button>
                ))}
              </div>

              {/*  WORKFLOW  */}
              {activeAdvSubTab==='workflow' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Full Workflow Overview</h2>
                    <p className="help-adv-hero-desc">From map config to in-game particle effects — follow these steps in order on your first run.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button" style={{background:'linear-gradient(135deg,var(--emitter-color) 0%,rgba(0,221,255,0.8) 100%)',color:'#000',border:'none',boxShadow:'0 0 20px var(--emitter-glow)'}}>GENERATE FILES</div>
                    <div className="help-adv-button-hint">4 steps to working emitters — no external tools</div>
                  </div>
                </div>

                <div className="help-adv-process">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Core Process</h3>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginTop:'24px'}}>
                    {[
                      {n:'01',title:'Configure Map Settings',desc:'Enter your Map Name. The tool automatically reads the map size from your save.lua — no manual input needed. The detected size affects every coordinate in the output.',subs:['Map Name must exactly match the SC folder name (case-sensitive)','Map Size is auto-detected from save.lua — shown below the Map Name field','Set Maps Folder in Settings once — all tabs share it']},
                      {n:'02',title:'Create Emitter Cards',  desc:'One card per emitter effect type. Add blueprint paths via Library or manual input.',subs:['Library: browse available emitter .bp assets','Multiple paths per card = random variety of emitter per position','Per-card randomness overrides global when set > 0']},
                      {n:'03',title:'Place Coordinates',     desc:'Click canvas for manual placement, or configure Grid Step X/Z and click Generate Grid.',subs:['Canvas click = place at exact world coordinate','Grid fills the entire map with evenly-spaced points','Area Mask filters grid placement before adding coordinates']},
                      {n:'04',title:'Generate',desc:'Click GENERATE FILES. The tool writes per-emitter prop/script files, injects a props.lua into your .scmap, and repacks automatically.',subs:['No external tools needed — SCMAP parser is built in','README optionally documents all settings at generation time','Re-run any time — new props.lua chunk is added without touching existing ones']},
                    ].map(s=>(
                      <div key={s.n} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'20px 18px'}}>
                        <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'linear-gradient(135deg,var(--emitter-color) 0%,rgba(0,221,255,0.8) 100%)',color:'#000',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.78rem',marginBottom:'14px'}}>{s.n}</div>
                        <h4 style={{margin:'0 0 10px',fontSize:'0.82rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'#fff'}}>{s.title}</h4>
                        <p style={{margin:'0 0 12px',fontSize:'0.82rem',color:'rgba(255,255,255,0.55)',lineHeight:1.6}}>{s.desc}</p>
                        <ul style={{margin:0,paddingLeft:'14px',display:'flex',flexDirection:'column',gap:'4px'}}>
                          {s.subs.map((sub,i)=><li key={i} style={{color:'rgba(255,255,255,0.35)',fontSize:'0.78rem',lineHeight:1.6}}>{sub}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Troubleshooting</h3>
                  {[
                    ['Generate button does nothing',         'Maps Folder not set, Map Name empty, no .scmap found in the map folder, or no card has a valid blueprint path + at least one coordinate.'],
                    ['Emitters not visible after generation', <>Verify the .scmap was repacked successfully — check the success alert for the output path. Look in the History Tab at the modifications. Emitters are only visible ingame. If nothing works — join the <a href="#" onClick={e=>{e.preventDefault();window.electronAPI.invoke('open-external', 'https://discord.gg/vvMBTncG3p');}} style={{color:'var(--emitter-color)',textDecoration:'underline'}}>FAF Discord</a> and ask for help in the <a href="#" onClick={e=>{e.preventDefault();window.electronAPI.invoke('open-external', 'https://discord.com/channels/197033481883222026/364688036224827392');}} style={{color:'var(--emitter-color)',textDecoration:'underline'}}>#mapping-general</a> channel.</>],
                    ['Mirror mode duplicating unexpectedly',  'Each click automatically places a mirrored pair. Click an existing dot to delete both.'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>

                <div className="help-adv-bp-section">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['Use Grid + Mask',        'Generate a full-map grid first, then upload a B/W mask to restrict placement to valid zones. Much faster than clicking manually.'],
                      ['One Card Per Effect',    'Separate cards for dust, sand, water spray. Independent lists — edit one without touching others.'],
                      ['Test Coarse First',      'Start at a large grid step (256), verify in-game, then reduce for denser coverage.'],
                      ['Keep README Enabled',    'The README logs all settings at generation time. Invaluable when returning to a map weeks later or sharing it with other Mappers.'],
                    ].map(([title,desc])=>(
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon"></div>
                        <h4>{title}</h4><p>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/*  CONFIGURATION  */}
              {activeAdvSubTab==='configuration' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Configuration Deep Dive</h2>
                    <p className="help-adv-hero-desc">These global settings affect every emitter card and every generated file. Setting them correctly once prevents all downstream errors.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button" style={{background:'rgba(0,221,255,0.08)',border:'1px solid rgba(0,221,255,0.3)',color:'var(--emitter-color)',fontSize:'0.8rem'}}>Map Name + Size + Folder</div>
                    <div className="help-adv-button-hint">These three form the foundation of all file paths</div>
                  </div>
                </div>
                <div className="help-adv-technical">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Field Reference</h3>
                  <div className="help-adv-card-grid">
                    {[
                      {icon:'',title:'Map Name',desc:'The exact folder name of your map in the /maps directory. Used in all generated file paths.',features:['Must match folder name exactly — FA is case-sensitive','Format: MapName.vXXXX (e.g. Hades_Dust.v0002)','Omitting .v0001 is fine — auto-appended','Wrong name = all generated emitter paths resolve to nothing']},
                      {icon:'',title:'Map Size',desc:'Width/height of the playable area in world units. Auto-detected from save.lua when a valid Map Name is entered. All canvas coordinates are scaled relative to this.',features:['Auto-read from save.lua — no manual input required','Standard: 256 = 5×5 km · 512 = 10×10 km · 1024 = 20×20 km','Non-power-of-2 maps (e.g. 768 = 15×15 km) are fully supported','Shown below the Map Name field after detection']},
                      {icon:'',title:'Maps Folder',desc:'Absolute path to your /maps directory. All generated output is written here.',features:['Required — generation fails without it','Set once in Settings — persists across sessions and tabs','Typical: C:/Users/{User_Name}/Documents/My Games/Gas Powered Games/Supreme Commander Forged Alliance/maps']},
                      {icon:'',title:'Global Randomness',desc:'Applies Poisson Disk Sampling scatter to all grid-generated coordinates. No two points will be placed closer than the configured minimum distance — producing organic, natural distributions.',features:['Poisson Min. Distance: minimum gap in world units between any two placed points','0 = pure regular grid — no scatter at all','Suggested: 10–40 units for natural scatter without visible gaps','Per-card override: set > 0 on a card to replace the global value for that card only','Manual canvas clicks are not affected']},
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
                    ['Files appear in wrong subfolder','Check for leading/trailing spaces and correct uppercases/downcases in the map name — they are included in the path.'],
                    ['Emitter dont spawn at the expected Location','The map size is auto-detected from save.lua — verify your Map Name is correct and that the map folder with save.lua exists.'],
                    ['The wrong Emitter spawn','Check your settings in the Emitter-Category Assignement'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
              </>)}

              {/*  EMITTER CARDS  */}
              {activeAdvSubTab==='emittercards' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Emitter Cards — Full Reference</h2>
                    <p className="help-adv-hero-desc">Each Emitter Card should represents one visual effect type. Cards are independent — different paths, coordinates, grid steps, and randomness settings. Add one card per effect type on your map.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button" style={{background:'rgba(0,221,255,0.08)',border:'1px solid rgba(0,221,255,0.3)',color:'var(--emitter-color)',fontSize:'0.78rem'}}>+ ADD EMITTER CARD</div>
                    <div className="help-adv-button-hint">One card per visual effect type</div>
                  </div>
                </div>
                <div className="help-adv-technical">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Card Fields Reference</h3>
                  <div className="help-adv-card-grid">
                    {[
                      {icon:'',title:'Label',desc:'Optional display name for this card. Used in the canvas legend and the subfolders in your MapFolder.',features:['Purely cosmetic — has no effect on generated files','Helps identify cards when you have many effect types','Shown in the Emitter Legend on the canvas']},
                      {icon:'',title:'Emitter Paths (.bp)',desc:'The in-game path(s) to the emitter blueprint file. One path is randomly selected per coordinate at generation.',features:['Multiple paths = random variety per position','Use Library button to browse available assets — manual entry is error-prone','Game-native paths (/env/, /effects/) used as-is','Map-relative paths get /maps/{mapName}/ prepended automatically']},
                      {icon:'⊞',title:'Grid Step X / Z',desc:'World-unit spacing between grid points. Covers the entire map. Click Generate Grid to apply.',features:['X Step: horizontal spacing · Z Step: vertical spacing (world units)','1024 map at 64 step = 256 grid points along each axis','Area Mask applied before coordinates are added','Smaller step = denser coverage — test coarse first']},
                      {icon:'',title:'Card Randomness Override',desc:'Per-card Poisson Min. Distance that replaces the global value when set > 0. Useful when different effects need different scatter densities.',features:['Poisson Radius > 0 overrides the global value for this card only','Set to 0 to fall back to global Poisson Min. Distance','Example: dense fog at radius 5, sparse dust at radius 30','Leave at 0 unless this card needs different scatter behavior']},
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
                <div className="help-adv-bp-section">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['Separate Cards by Effect','Keep Fog, Wind and Smoke on different cards. Independent coordinate lists — edit one without touching others.'],
                      ['Use Library Always','Always use the Library button for emitter paths — typing .bp paths manually is error-prone and slow.'],
                      ['Name Your Cards','Setting a label makes the canvas legend readable when you have 3+ cards active simultaneously. Its also better for the overview in the Map folder.'],
                    ].map(([title,desc])=>(
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon"></div>
                        <h4>{title}</h4><p>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/*  CANVAS  */}
              {activeAdvSubTab==='canvas' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Preview &amp; Canvas</h2>
                    <p className="help-adv-hero-desc">The interactive canvas where you click to place emitter coordinates. Upload a map image as reference, select mirror mode, then click — or use Grid generation for full coverage.</p>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Canvas Interaction</h3>
                  <div className="help-adv-card-grid">
                    {[
                      {icon:'',title:'Click to Place',desc:'Click anywhere on the canvas to add a coordinate at that world position for the currently selected emitter card.',features:['Selected card receives the new coordinate','If mirror mode is active — 1 click creates 2 coordinates','Position calculated from Map Size: (click% × mapSize)','Dots displayed in the card\'s color']},
                      {icon:'',title:'Click Dot to Delete',desc:'Clicking an existing dot removes it. With mirror mode active, the mirrored partner is also removed.',features:['No undo — re-add via canvas click or manual entry','Mirror pair always deleted together','Use the coordinate list inside the card to delete individually']},
                      {icon:'',title:'Upload Map Image',desc:'Upload a PNG/JPG/WEBP for use as background reference. Dots float above the image.',features:['Reference layer only — does not affect coordinates or output','Stored in memory for the session','Export from FA map editor or in-game screenshot','Upload before placing for much more accurate positioning']},
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
                <div className="help-adv-process">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Mirror Modes</h3>
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
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Troubleshooting</h3>
                  {[
                    ['Uploaded image not appearing','Only PNG, JPG, and WEBP are supported. Very large images may be slow to process.'],
                    ['Mirror creating too many coordinates','Expected — each click with mirroring active places 2 points. Click an existing dot to delete both at once.'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
              </>)}

              {/*  AREA MASK  */}
              {activeAdvSubTab==='mask' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Area Mask</h2>
                    <p className="help-adv-hero-desc">A grayscale image that controls where emitters spawn during grid generation. White pixels (brightness &gt; 127) allow placement; black pixels block it. After uploading the mask image, set the Dark Pixel Behaviour dropdown to control what happens to blocked grid points.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button" style={{background:'color-mix(in srgb,var(--tab-color) 8%,transparent)',border:'1px solid color-mix(in srgb,var(--tab-color) 30%,transparent)',color:'var(--tab-color)',fontSize:'0.8rem',boxShadow:'none',animation:'none'}}>Upload B/W Mask</div>
                    <div className="help-adv-button-hint">Upload first → then choose behaviour</div>
                  </div>
                </div>

                <div className="help-adv-process">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>How the Mask Works</h3>
                  <div className="help-adv-timeline">
                    {[
                      {n:'1',title:'Upload a B/W image',desc:'Click the upload area in the Configuration section. Any greyscale PNG/JPG/WEBP works. White (brightness > 127) = valid zone. Black (≤ 127) = blocked. After upload, a preview and pixel dimensions are shown. The mask is also overlaid at 30% opacity on the map canvas.'},
                      {n:'2',title:'Choose Dark Pixel Behaviour',desc:'The dropdown beneath the upload area sets what happens to a grid point that lands on a dark (blocked) pixel. Three modes are available: Slide Right, Slide Left, and Ignore. This setting only affects grid generation — manual canvas clicks are never filtered.'},
                      {n:'3',title:'Generate Grid',desc:'Grid generation reads the mask pixel-by-pixel at each candidate coordinate. Depending on the chosen mode the point is shifted or discarded. The mask is sampled at the world-coordinate scale, so a 512×512 mask covers a 1024-unit map at 0.5 px/unit resolution.'},
                      {n:'4',title:'Manual clicks bypass the mask',desc:'The mask is exclusively a grid-generation filter. Any dot placed by clicking the canvas is accepted unconditionally, regardless of what the mask pixel says at that location.'},
                    ].map(s=>(
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content"><h4>{s.title}</h4><p>{s.desc}</p></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="help-adv-technical">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">02</span>Dark Pixel Behaviour — Scan Modes</h3>
                  <div className="help-adv-card-grid">
                    {[
                      {icon:'→',title:'Slide Right',desc:'A grid point that lands on a dark pixel scans rightward (increasing X) one pixel at a time until it finds a white pixel or reaches the map edge. If the map edge is reached without finding white, the point is discarded entirely.',features:[
                        'Points near a zone edge cluster slightly rightward along the valid edge',
                        'Natural distribution — keeps grid density near zone boundaries',
                        'Discard at map edge: if no white pixel found before X = Map Size, point is dropped',
                        'Does not affect Z (vertical) — only scans horizontally',
                      ]},
                      {icon:'←',title:'Slide Left',desc:'Mirror of Slide Right. Blocked points scan leftward (decreasing X) until a white pixel is found or X reaches 0. Use when your valid zone faces left from the mask boundary.',features:[
                        'Mirror of Slide Right — identical logic in the opposite direction',
                        'Discard at map edge: if no white pixel found before X = 0, point is dropped',
                        'Same Z-pass-through as Slide Right',
                        'Produces a left-leaning cluster at zone edges',
                      ]},
                      {icon:'✕',title:'Ignore',desc:'No scanning. A grid point on a dark pixel is simply discarded and leaves a gap in the output. The mask shape is preserved exactly in the coordinate set.',features:[
                        'Cleanest mask fidelity — output gap shape exactly matches black mask regions',
                        'Best for hard-edged masks with clearly separated valid/invalid zones',
                        'Use when you do not want emitters sliding to unexpected positions',
                        'Produces lower total coordinate counts than Slide modes on the same mask',
                      ]},
                    ].map(item=>(
                      <div key={item.title} className="help-adv-card">
                        <div className="help-adv-card-header">
                          <span className="help-adv-card-icon" style={{fontFamily:'monospace',fontWeight:700,fontSize:'1.2rem'}}>{item.icon}</span>
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

                <div className="help-adv-technical">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">03</span>Mask Image Guidelines</h3>
                  <div className="help-adv-card-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))'}}>
                    {[
                      {title:'Resolution',desc:'Any resolution works. The mask is sampled by mapping world coordinates proportionally onto image pixels. A 512×512 mask on a 1024×1024 map = 0.5 px per world unit. Higher resolution = more precise zone boundaries.',features:['512×512 is sufficient for most maps','1024×1024 matches the world unit 1:1 for a 1024 map','Very high res (4096+) has no practical benefit over 1024']},
                      {title:'Color format',desc:'Pure black and white gives the sharpest results. Greyscale also works — the threshold is brightness 127. Values > 127 are treated as white (valid). Values ≤ 127 are treated as black (blocked).',features:['Pure B/W: sharpest possible zone edges','Greyscale: soft fade-in at zone boundaries (some points pass, some blocked, depending on exact threshold)','Color images also work — brightness (R+G+B)/3 is used as the metric']},
                      {title:'Where to source masks',desc:'Export a greyscale heightmap directly from the FA map editor. Paint black/white manually in any image editor. Use a noise generator for organic patterns. Export the FA terrain texture and threshold it.',features:['FA map editor: export height as image → threshold to B/W in Photoshop/GIMP','Manual paint: exact control over zones','Procedural noise: organic natural-looking distributions','Tip: invert the mask to exclude specific zones instead of including them']},
                    ].map(item=>(
                      <div key={item.title} className="help-adv-card">
                        <div className="help-adv-card-header"><h4>{item.title}</h4></div>
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
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">04</span>Troubleshooting</h3>
                  {[
                    ['Mask preview not showing on canvas','Ensure the image loaded successfully — the configuration panel shows pixel dimensions when a valid mask is loaded. Reload if dimensions show 0×0.'],
                    ['Grid generates fewer points than expected','Slide modes discard points that reach the map edge without finding white. Use Ignore mode for a predictable output count, or enlarge the valid zone in your mask.'],
                    ['Wrong zone excluded','The mask threshold is brightness > 127 = valid. If your mask colours seem inverted, invert the image in an editor before uploading.'],
                    ['Canvas clicks going into wrong zone','Canvas clicks are never filtered by the mask — the mask only applies to grid generation. This is intentional.'],
                    ['Slide Right producing unexpected clusters','Near zone boundaries Slide Right can pack many points at the valid edge. Switch to Ignore mode if you want gaps instead of edge clustering.'],
                  ].map(([q,a])=>(
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q"><span className="help-adv-ts-icon"></span><strong>{q}</strong></div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>

                <div className="help-adv-note">
                  <strong>Workflow tip:</strong> For complex terrain, use Ignore with a precise Mask created in Gaea for exact zone control.
                </div>
              </>)}

              {/* ── EMITTER ASSIGNMENT ── */}
              {activeAdvSubTab === 'emitter' && (<>
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
                    <div className="help-adv-fake-button" style={{ background: 'linear-gradient(135deg, var(--emitter-color) 0%, rgba(0,221,255,0.8) 100%)', color: '#000', border: 'none', boxShadow: '0 0 20px var(--emitter-glow)' }}>
                      CONFIGURE ASSIGNMENT
                    </div>
                    <div className="help-adv-button-hint">Opens the category assignment overlay</div>
                  </div>
                </div>

                <div className="help-adv-technical">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>Core Concept</h3>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: '4px solid var(--emitter-color)', padding: '22px 28px', borderRadius: '4px', marginBottom: '28px' }}>
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
                      { n: '2', title: 'Configure the assignment', desc: 'Click "Configure Emitter-Category Assignment". Each category row shows toggle buttons for every emitter path.', note: 'Cyan = active  ·  Gray = excluded' },
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
          background: activeEmitterHelpSubTab === 'smart' ? 'linear-gradient(135deg, var(--emitter-color) 0%, rgba(0,221,255,0.8) 100%)' : 'rgba(255, 255, 255, 0.05)',
          color: activeEmitterHelpSubTab === 'smart' ? '#000' : 'rgba(255, 255, 255, 0.6)',
          border: `2px solid ${activeEmitterHelpSubTab === 'smart' ? 'var(--emitter-color)' : 'transparent'}`,
          borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
          letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          boxShadow: activeEmitterHelpSubTab === 'smart' ? '0 0 16px var(--emitter-glow)' : 'none',
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
          background: activeEmitterHelpSubTab === 'simple' ? 'linear-gradient(135deg, var(--emitter-color) 0%, rgba(0,221,255,0.8) 100%)' : 'rgba(255, 255, 255, 0.05)',
          color: activeEmitterHelpSubTab === 'simple' ? '#000' : 'rgba(255, 255, 255, 0.6)',
          border: `2px solid ${activeEmitterHelpSubTab === 'simple' ? 'var(--emitter-color)' : 'transparent'}`,
          borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
          letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          boxShadow: activeEmitterHelpSubTab === 'simple' ? '0 0 16px var(--emitter-glow)' : 'none',
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
          background: activeEmitterHelpSubTab === 'lastCategory' ? 'linear-gradient(135deg, var(--emitter-color) 0%, rgba(0,221,255,0.8) 100%)' : 'rgba(255, 255, 255, 0.05)',
          color: activeEmitterHelpSubTab === 'lastCategory' ? '#000' : 'rgba(255, 255, 255, 0.6)',
          border: `2px solid ${activeEmitterHelpSubTab === 'lastCategory' ? 'var(--emitter-color)' : 'transparent'}`,
          borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600',
          letterSpacing: '0.05em', transition: 'all 0.3s ease', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          boxShadow: activeEmitterHelpSubTab === 'lastCategory' ? '0 0 16px var(--emitter-glow)' : 'none',
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
              Fine-tune which emitter effects are assigned to specific emitter card categories.
              This powerful system allows you to create visual variety by assigning different effects to different zone types.
              For example: Desert cards can use dust effects, while Coastal cards get mist and steam.
              The system uses intelligent 3-tier matching logic to always find the best emitter for each card.
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
              <li><strong style={{ color: 'var(--emitter-color)' }}>Visual Variety:</strong> Different zone types should look different (Desert vs Coastal)</li>
              <li><strong style={{ color: 'var(--emitter-color)' }}>Thematic Consistency:</strong> Volcanic zones might need fire effects, valleys need haze</li>
              <li><strong style={{ color: 'var(--emitter-color)' }}>Scale Appropriateness:</strong> Industrial areas need heavier, more dramatic plumes</li>
              <li><strong style={{ color: 'var(--emitter-color)' }}>Exclusion Control:</strong> Prevent certain effects from appearing on specific zone types</li>
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
                      ['Start with broad categories', 'Begin with 2–3 general categories like "Ground", "Elevated", "Water" before adding specificity.'],
                      ['Smart mode for precision', 'If you need the tightest control over which emitters appear where, Smart mode\'s 3-tier logic gives the most predictable results.'],
                      ['Check the Live Preview', 'The Live Preview sidebar in the assignment overlay shows in real time which emitters each card will receive — use it to verify before generating.'],
                    ].map(([title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon">✓</div>
                        <h4>{title}</h4><p>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/*  GENERATE FILES  */}
              {activeAdvSubTab==='generate' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Generate Files</h2>
                    <p className="help-adv-hero-desc">All emitter cards and coordinates are written to per-instance prop + script files, then automatically injected into your .scmap via the built-in parser and repacked — no external tools needed.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button" style={{background:'linear-gradient(135deg,var(--emitter-color) 0%,rgba(0,221,255,0.8) 100%)',color:'#000',border:'none',boxShadow:'0 0 20px var(--emitter-glow)'}}>GENERATE FILES</div>
                    <div className="help-adv-button-hint">SCMAP parser — fully automatic</div>
                  </div>
                </div>
                <div className="help-adv-technical">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">01</span>What Happens on Generate</h3>
                  <div className="help-adv-card-grid">
                    {[
                      {icon:'',title:'Prop + Script Files',desc:'For every coordinate on every card, a unique _prop.bp and _script.lua pair is written to env/props/emitter/plain/.',features:['One file pair per coordinate','Blueprint references the emitter path via CreateEmitterAtBone','Files placed under a per-card subfolder for clean organisation','Emitter .bp files copied from your configured source folder']},
                      {icon:'',title:'SCMAP Injection',desc:'The tool locates the .scmap in your map folder, unpacks it, writes a new numbered props.lua chunk, and repacks it back in place.',features:['No BrewMapTool or external software needed','New props.lua gets a unique index — never overwrites previous chunks','Repacked .scmap overwrites the original automatically','Visible in FA map editor after the next map load']},
                      {icon:'',title:'README (optional)',desc:'A plain-text .txt file written to the map root summarising every setting, card, coordinate count, and emitter path used at generation time.',features:['Toggle on/off with the checkbox in the generate section','Includes: map name, size, mirror mode, mask mode, SCMAP filename, props.lua chunk name, total placements','Lists every card: label, coordinate count, emitter paths, randomness settings','Written to: maps/MapName.v0001/Emitter_Generation_README.txt','Invaluable when returning to a map weeks later']},
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
                    ['No .scmap found error',          'The tool needs an existing .scmap in the map folder. Generate the base map in the FA editor first, then run the emitter generator.'],
                    ['Emitters at wrong positions',    'Map size mismatch — the size is auto-read from save.lua. If the Map Name is wrong or save.lua is missing, the fallback is 1024. Verify the Map Name matches the folder exactly.'],
                    ['Emitters missing after map load','Confirm the repack succeeded (check the success alert). If the .scmap was open in the FA editor during generation, close and reopen it.'],
                    ['Props.lua index conflict',       'Each run writes props1.lua, props2.lua etc. to avoid collisions. If you see gaps, check the unpacked folder for existing chunks.'],
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
                      ['Test With Small Grid First','Use a coarse grid (256 step) with 1–2 cards and verify in-game before going to full density.'],
                      ['Keep the .scmap backed up','Before a large generation run, copy the .scmap somewhere safe. Repack is non-destructive but a backup costs nothing.'],
                      ['Keep README Enabled','The README documents all settings at generation time — invaluable when returning to a map weeks later.'],
                      ['Re-generate Freely','Each run adds a new numbered props.lua chunk — nothing is overwritten. Adjust coordinates and regenerate as many times as needed.'],
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
                    <div className="help-adv-file-item file "><span></span><span>Emitter_Generation_README.txt</span><span className="help-adv-file-size">if toggle enabled</span></div>
                    <div className="help-adv-file-item folder " style={{paddingTop:'8px'}}><span></span><span>env/props/emitter/plain/</span></div>
                    <div className="help-adv-file-item folder " style={{paddingLeft:'36px'}}><span></span><span>DustCloud/</span><span className="help-adv-file-size">per card label</span></div>
                    <div className="help-adv-file-item file " style={{paddingLeft:'60px'}}><span></span><span>DustCloud_01_prop.bp</span></div>
                    <div className="help-adv-file-item file " style={{paddingLeft:'60px'}}><span></span><span>DustCloud_01_script.lua</span></div>
                    <div className="help-adv-file-item file " style={{paddingLeft:'60px',opacity:0.5}}><span></span><span>DustCloud_02 … DustCloud_NN</span></div>
                  </div>
                </div>

                <div className="help-adv-structure" style={{marginTop:'40px'}}>
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">05</span>File Contents</h3>
                  <div className="help-adv-card-grid">
                    {[
                      {title:'Prop Script (_script.lua)',desc:'Each instance gets its own script that calls CreateEmitterAtBone on creation.',code:`local Prop = import('/lua/sim/Prop.lua').Prop\n\nDustCloud_01 = Class(Prop) {\n  OnCreate = function(self)\n    Prop.OnCreate(self)\n    CreateEmitterAtBone(self,-2,-1,\n      '/env/Desert/props/...')\n  end,\n}\n\nTypeClass = DustCloud_01`},
                      {title:'README File (optional)',desc:'A plain-text summary written to the map root when the README toggle is enabled. Documents every setting, card, and path used at generation time.',code:`╔════════════════════════════════════════╗\n║  EMITTER GENERATION — README           ║\n╚════════════════════════════════════════╝\n\n  Generated  : 10/03/2026 at 14:22\n  Tool       : ForgeMapToolkit — Emitter Tab\n\n  MAP SETTINGS\n  Map Name   : MyMap.v0001\n  Map Size   : 1024 × 1024\n  Mirror Mode: diagonal\n  Mask Mode  : right\n\n  OUTPUT SUMMARY\n  SCMAP file : MyMap.v0001.scmap  ← repacked\n  Props chunk: props1.lua\n  Total placements: 48\n\n  EMITTER CARDS\n  [01] DustCloud\n       Coordinates: 12\n       Emitter paths (2):\n         • /env/Aeon/FX/dust_01_emit.bp\n         • /env/Aeon/FX/dust_02_emit.bp`},
                    ].map(item=>(
                      <div key={item.title} className="help-adv-card">
                        <div className="help-adv-card-header">
                          <h4>{item.title}</h4>
                        </div>
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
              </>)}

            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ── EmitterHelpInfoPanel ─────────────────────────────────────────────────────

function EmitterHelpInfoPanel({ sel }) {
  return (
    <div className="help-info-panel">
      <div style={{marginBottom:'32px'}}>
        <h2 className="help-info-title">{sel.title}</h2>
        <p className="help-info-desc">{sel.desc}</p>
      </div>
      <h3 className="help-adv-section-header">
        <span className="help-adv-section-num">01</span>Details
      </h3>
      <div className="help-info-details-box">
        <ul className="help-info-details-list">
          {sel.details.map(([label,value],i)=>(
            <li key={i}>
              <strong>{label}:</strong>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="help-info-note">
        <strong>Tip: </strong>{sel.tip}
      </div>
    </div>
  );
}
export default EmitterHelpModal;
