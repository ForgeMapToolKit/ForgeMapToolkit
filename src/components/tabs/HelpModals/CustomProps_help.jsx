import React from "react";

function CustomPropsHelpModal({ onClose, activeTab, setActiveTab, helpSelected, setHelpSelected, activeAdvSubTab, setActiveAdvSubTab }) {

  const TABS = [
    { id: 'main',    label: 'Custom Props' },
    { id: 'addprop', label: 'Add Custom Prop' },
    { id: 'advanced', label: 'Advanced Guide' },
  ];

  // ── MAIN tab info data ───────────────────────────────────────────────────
  const MAIN_INFO = {
    mapname: {
      title: 'Map Name',
      desc: 'The exact folder name of your map in the /maps directory. All generated files are placed under this map.',
      details: [
        ['Format', 'MapName.vXXXX — e.g. Hades_Dust.v0002'],
        ['Auto-version', 'Omitting .v0001 appends it automatically'],
        ['Case-sensitive', 'FA is strict — match the folder exactly'],
        ['Impact', 'Wrong name = props invisible in-game'],
      ],
      tip: 'Copy the folder name directly from File Explorer to avoid typos.',
    },
    addfrombp: {
      title: 'Add Custom Prop',
      desc: 'Opens the Add Custom Prop overlay — for adding props with custom mesh files (.scm, .dds) that are not in the standard library.',
      details: [
        ['Use case', 'Props you created or exported externally'],
        ['Requires', 'At least a _prop.bp blueprint file'],
        ['Supports', 'Manual entry or folder drop of a complete prop directory'],
      ],
      tip: 'Use this for modded or externally authored props. Use Library for game-native props.',
    },
    propcard: {
      title: 'Prop Card',
      desc: 'Represents one prop entry in your list. Each card can have independent texture adjustments, a custom output name, and link group membership.',
      details: [
        ['Select', 'Click once to select and show details in the right panel'],
        ['Edit texture', 'Double-click to open the Texture Editor'],
        ['Rename', 'Type in the name field — also renames output files'],
        ['Dot indicator', 'Teal dot = has texture adjustments applied'],
      ],
      tip: 'Double-click to jump directly to the Texture Editor for that prop.',
    },
    propname: {
      title: 'Prop Name Field',
      desc: 'An editable name for this prop entry. If the prop has texture adjustments, this name also becomes the output folder and file name.',
      details: [
        ['With adjustments', 'Name becomes: /env/props/{name}/{name}_prop.bp'],
        ['Without adjustments', 'Original game path used — name is cosmetic only'],
        ['Unique required', 'Each adjusted prop needs a unique name to avoid conflicts'],
      ],
      tip: 'Keep names lowercase with underscores — e.g. scorched_pine_t2.',
    },
    deleteprop: {
      title: 'Remove Prop',
      desc: 'Removes this prop from the list permanently. No output files are affected — only the list entry is removed.',
      details: [
        ['Irreversible', 'Re-add via Library or Add Custom Prop'],
        ['Adjustments', 'Lost unless you re-add and re-configure'],
      ],
      tip: 'Double-check before removing — adjustments cannot be recovered.',
    },
    addlibrary: {
      title: 'Add From Library',
      desc: 'Opens the Props Library overlay to browse and add game-native props directly from scanned FA prop files.',
      details: [
        ['Prerequisite', 'Run a library scan in Settings first'],
        ['Multi-select', 'Select multiple props at once'],
        ['Adjustments', 'Pre-configured adjustments are carried over from the library'],
      ],
      tip: 'Always use the Library for game-native props — faster and error-free.',
    },
    adjindicator: {
      title: 'Custom Texture Badge',
      desc: 'Shown when this prop has non-default texture adjustments applied. Indicates that a custom output file set will be generated.',
      details: [
        ['Means', 'Albedo DDS will be modified and saved alongside the blueprint'],
        ['Requires name', 'A unique output name must be set in the name field'],
      ],
      tip: 'All props with this badge will generate actual files on disk.',
    },
    linkgroup: {
      title: 'Link Group',
      desc: 'Links a prop to a texture source — making it use another prop\'s generated albedo texture file instead of generating its own.',
      details: [
        ['Source prop', 'The prop whose texture is used as the base'],
        ['Follower prop', 'Uses the source\'s adjusted albedo file directly'],
        ['Use case', 'Multiple mesh variants that share the same texture color'],
        ['Join group', 'Select an existing group from the dropdown to follow it'],
      ],
      tip: 'Link groups reduce generation work when multiple props share the same texture.',
    },
    generatebtn: {
      title: 'Generate Files',
      desc: 'Validates the configuration and writes all prop blueprint, mesh, and texture files to the map directory in one click.',
      details: [
        ['Creates', '_prop.bp, _lod0.scm, _albedo.dds, _normalsTS.dds per adjusted prop'],
        ['Original props', 'No files generated — original game paths used as-is'],
        ['Re-run safe', 'Re-generating always overwrites cleanly'],
        ['Prerequisite', 'Map Name must be set, at least one adjusted prop required'],
      ],
      tip: 'After generating: reference the output paths in your map\'s prop placement.',
    },
    detailpanel: {
      title: 'Detail Panel',
      desc: 'Shows full info for the selected prop: texture slider values, output file structure, and pass breakdown.',
      details: [
        ['Left column', 'Select a prop to populate this panel'],
        ['Sliders', 'Read-only display of current adjustment values'],
        ['Pass 1', 'Original game files — read-only source'],
        ['Pass 2', 'Custom generated files — written to map directory'],
      ],
      tip: 'Use the detail panel to review what files will be generated before clicking Generate.',
    },
    pass1: {
      title: 'Pass 1 — Original (Source)',
      desc: 'Shows the original game files this prop is based on. These files are read-only — they live in the FA game archives and are never modified.',
      details: [
        ['_prop.bp', 'The original blueprint — read to extract mesh paths, scale and reclaim values'],
        ['_lod0.scm', 'The original mesh — copied as-is into the custom output folder'],
        ['_albedo.dds', 'The original color texture — used as the pixel source for adjustment'],
        ['_normalsTS.dds', 'The original normal map — copied as-is, never modified'],
        ['Source path', 'Resolved from the game scan — typically /env/{Biome}/Props/{Category}/'],
        ['Read-only', 'No files are written here — generation only reads from this pass'],
      ],
      tip: 'If Pass 1 shows an incorrect path, the library scan may need to be re-run against a valid FA installation.',
    },
    pass2: {
      title: 'Pass 2 — Custom (Generated Output)',
      desc: 'Shows the files that will be written to your map directory when you click Generate Files. These are the custom prop assets FA will load in-game.',
      details: [
        ['_custom_prop.bp', 'New blueprint referencing the custom albedo and mesh paths'],
        ['_custom_lod0.scm', 'Mesh copied from the original — identical geometry, new path'],
        ['_custom_albedo.dds', 'Albedo with all texture adjustments baked in pixel-by-pixel'],
        ['_custom_normalsTS.dds', 'Normal map copied from the original — never modified'],
        ['Output path', '/maps/{mapName}/env/props/{propName}/ — determined by the name field'],
        ['Written on Generate', 'Files only appear on disk after clicking Generate Files'],
      ],
      tip: 'After generating, you must place these props in the FA map editor and save the scenario — generating the files alone does not add them to the map.',
    },
  };

  // ── TEXTURE tab info ─────────────────────────────────────────────────────
  const TEX_INFO = {
    hue: {
      title: 'Hue',
      desc: 'Rotates all colors in the texture around the color wheel. Values above 0° shift colors clockwise; negative shifts counter-clockwise.',
      details: [
        ['Range', '0° to 360° (full rotation)'],
        ['Default', '0° (no change)'],
        ['Effect', 'Turns red props blue, green props orange, etc.'],
        ['Neutral value', '0° or 360°'],
      ],
      tip: 'Use small shifts (±15°) for subtle biome adaptation. Large shifts create strong recolors.',
    },
    saturation: {
      title: 'Saturation',
      desc: 'Controls color intensity. Values below 100% desaturate toward grey; above 100% increase vividness.',
      details: [
        ['Range', '0% (greyscale) to 200% (highly saturated)'],
        ['Default', '100% (no change)'],
        ['0%', 'Full greyscale — all color information removed'],
        ['200%', 'Extreme saturation — use sparingly'],
      ],
      tip: 'Lowering saturation to 50-70% works well for rocky or burnt props.',
    },
    brightness: {
      title: 'Brightness',
      desc: 'Scales the overall luminosity of the texture. Applied as a direct pixel multiplication.',
      details: [
        ['Range', '0% (black) to 200%'],
        ['Default', '100% (no change)'],
        ['Below 100%', 'Darkens the texture'],
        ['Above 100%', 'Brightens — may clip bright areas to white'],
      ],
      tip: 'Combine with Contrast for natural-looking adjustments.',
    },
    contrast: {
      title: 'Contrast',
      desc: 'Increases or decreases the difference between light and dark areas.',
      details: [
        ['Range', '0% to 200%'],
        ['Default', '100% (no change)'],
        ['Below 100%', 'Flattens the image — reduces depth'],
        ['Above 100%', 'Amplifies shadows and highlights'],
      ],
      tip: 'Raising contrast slightly (110-130%) sharpens the visual read at game distances.',
    },
    gamma: {
      title: 'Gamma',
      desc: 'Non-linear brightness correction applied via an exponential curve — affects midtones more than extremes.',
      details: [
        ['Range', '0% to 200%'],
        ['Default', '100% (no change)'],
        ['Below 100%', 'Darkens midtones (gamma correction down)'],
        ['Above 100%', 'Brightens midtones without blowing out highlights'],
      ],
      tip: 'Use Gamma instead of Brightness for subtle lightening — it preserves highlight detail better.',
    },
    tint: {
      title: 'Tint Layer',
      desc: 'Blends a solid color over the texture using the Opacity slider as blend strength.',
      details: [
        ['Opacity 0%', 'Tint invisible — original texture unaffected'],
        ['Opacity 50%', 'Moderate color wash'],
        ['Opacity 100%', 'Full solid color — original detail mostly lost'],
        ['Color picker', 'Set any RGB tint color'],
      ],
      tip: 'Keep Opacity below 30% for subtle tints that preserve the original texture detail.',
    },
    selective: {
      title: 'Selective Color',
      desc: 'Shifts only a specific hue range in the texture — other colors remain unchanged.',
      details: [
        ['Target hue', 'Pick the source color (e.g. green foliage)'],
        ['Hue Range', 'Width of the hue band affected'],
        ['Hue Shift', 'How far the matched colors are rotated'],
        ['Use case', 'Change autumn to summer leaves without affecting bark'],
      ],
      tip: 'Great for changing foliage color on tree props without touching bark or rock surfaces.',
    },
    colorsel: {
      title: 'Color Selection',
      desc: 'Restricts all other adjustments to only affect pixels that match a selected color range.',
      details: [
        ['Selection color', 'Pick the target color region'],
        ['Tolerance', 'How broadly "similar" colors are included'],
        ['Effect', 'All sliders apply only within the selection mask'],
        ['Use case', 'Recolor just the bright snow highlights on a rock'],
      ],
      tip: 'Combine with Hue/Saturation for targeted recolors of specific texture regions.',
    },
    preview: {
      title: 'Live Preview',
      desc: 'Split-view showing the original texture (left) and the adjusted result (right) in real time.',
      details: [
        ['Left half', 'Original unmodified texture'],
        ['Right half', 'Current adjustments applied'],
        ['Real-time', 'Updates as you move sliders'],
        ['Requires', 'Prop must have a resolvable previewUrl'],
      ],
      tip: 'Use the preview to judge changes at a glance before committing.',
    },
    applyall: {
      title: 'Apply to All',
      desc: 'When enabled, any slider change you make is applied to all props in the list simultaneously.',
      details: [
        ['Enabled', 'All props get the same values instantly'],
        ['Disabled', 'Only the currently selected prop tab is affected'],
        ['Use case', 'Quickly set a uniform brightness pass across all props'],
      ],
      tip: 'Enable Apply to All only when you want a global baseline, then fine-tune per prop.',
    },
  };

  // ── ADDPROP tab info ─────────────────────────────────────────────────────
  const ADD_INFO = {
    inputmode: {
      title: 'Input Mode',
      desc: 'Choose how to define the prop: manually type file paths, or drop a complete prop folder for automatic file detection.',
      details: [
        ['Manual', 'Upload files one by one via drag-and-drop zones'],
        ['Folder Drop', 'Drop the entire prop folder — files are auto-detected'],
        ['Folder mode', 'Supports both single and multi-prop folders'],
      ],
      tip: 'Folder Drop is faster if your prop follows the standard FA folder structure.',
    },
    blueprint: {
      title: 'Blueprint File (_prop.bp)',
      desc: 'Required. The FA blueprint file defining the prop\'s game properties: health, reclaim values, scale, and mesh references.',
      details: [
        ['Required', 'Without a .bp file the prop cannot be used'],
        ['Auto-parse', 'Folder mode reads existing values from the .bp automatically'],
        ['Editable', 'All key values can be overridden in the form below'],
      ],
      tip: 'If your .bp file has unusual structure, switch to Manual mode and re-upload.',
    },
    mesh: {
      title: 'Mesh File (_lod0.scm)',
      desc: 'The 3D model file for this prop. SCM is FA\'s Supreme Commander Model format.',
      details: [
        ['LOD0', 'Highest-detail level of detail — shown up close'],
        ['LOD1-2', 'Lower detail versions shown at distance (optional)'],
        ['Format', '.scm — Supreme Commander Mesh binary'],
      ],
      tip: 'At minimum provide LOD0. LOD1/2 improve performance at distance.',
    },
    albedo: {
      title: 'Albedo Texture (_albedo.dds)',
      desc: 'The main color texture for the prop surface. DDS format, typically DXT1 or DXT5.',
      details: [
        ['Format', 'DDS (DirectDraw Surface)'],
        ['Power of 2', 'Must be 64×64, 128×128, 256×256, 512×512, etc.'],
        ['Channels', 'RGB = color. Alpha = specular mask in most FA shaders'],
      ],
      tip: 'Use DXT1 for opaque props, DXT5 if the alpha channel carries specular.',
    },
    normalmap: {
      title: 'Normal Map (_normalsTS.dds)',
      desc: 'Tangent-space normal map adding surface micro-detail without extra geometry.',
      details: [
        ['Optional', 'Prop will use flat normals if omitted'],
        ['Format', 'DDS DXT5 (tangent-space)'],
        ['Suffix', '_normalsTS — matches FA\'s naming convention'],
      ],
      tip: 'Even a simple baked normal map significantly improves visual quality in FA\'s lighting.',
    },
    bpfields: {
      title: 'Blueprint Properties',
      desc: 'Editable fields that directly set values in the generated _prop.bp file.',
      details: [
        ['Health', 'Hit points — how much damage before the prop dies'],
        ['Reclaim Mass', 'Mass resource returned when reclaimed by engineers'],
        ['Reclaim Energy', 'Energy resource returned when reclaimed'],
        ['Reclaim Time', 'Time in seconds to fully reclaim'],
        ['Uniform Scale', 'Visual size multiplier — 1.0 = default game scale'],
        ['Block Path', 'Whether units are blocked by this prop'],
        ['Size X/Y/Z', 'Collision footprint dimensions'],
      ],
      tip: 'Compare your values against similar vanilla props for balanced gameplay.',
    },
    proptype: {
      title: 'Prop Type',
      desc: 'Defines which blueprint template is used: Tree (with physics/burn sounds) or Rock/Static (minimal physics).',
      details: [
        ['Tree', 'Includes audio (burn, fall), TreeFall physics, ScriptClass = prop'],
        ['Rock/Static', 'No audio or tree-fall — suitable for rocks, debris, buildings'],
        ['Auto-detect', 'Folder mode reads the existing .bp to determine type'],
      ],
      tip: 'Always use Tree type for props intended to fall and be reclaimed like trees.',
    },
    foldermode: {
      title: 'Folder Drop Zone',
      desc: 'Drop an entire prop directory here. The tool auto-detects all .bp, .scm, and texture files inside.',
      details: [
        ['Single prop', 'One _prop.bp at root — standard setup'],
        ['Multi-prop', 'Multiple _prop.bp files at root — tabs appear per prop'],
        ['Deep structure', 'Subdirectories are scanned recursively'],
        ['Pack Together', 'Add all detected props in one click'],
      ],
      tip: 'For folders with multiple props, review each tab before confirming.',
    },
    confirm: {
      title: 'Confirm Button',
      desc: 'Validates all inputs and adds the prop to the Custom Props list.',
      details: [
        ['Required', '_prop.bp and _lod0.scm must be provided'],
        ['Duplicate check', 'Same prop cannot be added twice'],
        ['Multi-prop', 'Folder mode adds all detected props at once'],
      ],
      tip: 'A grey/disabled Confirm means required files are missing — check the drop zones.',
    },
  };

  return (
    <>
      <div className="help-modal-overlay" onClick={onClose} />
      <div className="help-modal" style={{ '--tab-color': '#3EA387', '--tab-glow': 'rgba(62,163,135,0.35)', '--tab-glow-strong': 'rgba(62,163,135,0.6)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">Help Guide</h2>
          <button className="help-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="help-modal-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`help-modal-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >{t.label}</button>
          ))}
        </div>

        <div className="help-modal-content">

          {/* ══════════════ MAIN TAB — Custom Props + Texture Adjustments ══════════════ */}
          {activeTab === 'main' && (
            <div style={{ display: 'flex', gap: '40px', height: '100%' }}>
              {/* Left: 1:1 replica of the actual CustomProps tab (with a prop selected + custom texture) */}
              <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Click any element to learn about it
                </div>

                {/* Exact same 2-col grid as the real UI */}
                <div className="cpt-content-grid" style={{ maxWidth: 'none', margin: 0 }}>

                  {/* ── LEFT col: Config + Props list + warning + generate ── */}
                  <div className="cpt-config-column">

                    {/* CONFIGURATION */}
                    <div className="cpt-section-card">
                      <h2 className="cpt-section-title">
                        <span className="cpt-section-icon"></span>
                        CONFIGURATION
                      </h2>
                      <div className="cpt-form-group" onClick={() => setHelpSelected('mapname')} style={{ cursor: 'pointer' }}>
                        <label className="cpt-form-label">Map Name</label>
                        <input readOnly onChange={() => {}} className="cpt-form-input" value="" placeholder="e.g. Hades_Dust.v0002"
                          style={{ outline: helpSelected === 'mapname' ? '2px solid var(--tab-color)' : 'none' }} />
                      </div>
                      <button className="cpt-btn-add-custom-prop" onClick={() => setHelpSelected('addfrombp')}
                        style={{ outline: helpSelected === 'addfrombp' ? '2px solid var(--tab-color)' : 'none' }}>
                        <span className="cpt-btn-add-icon"></span>
                        ADD CUSTOM PROP
                      </button>
                    </div>

                    {/* CUSTOM PROPS */}
                    <div className="cpt-section-card">
                      <h2 className="cpt-section-title">
                        <span className="cpt-section-icon"></span>
                        CUSTOM PROPS
                        <span className="cpt-title-badge">1 · 1 with textures</span>
                      </h2>
                      <div className="cpt-props-grid">
                        {/* Prop card — selected, with custom texture */}
                        <div className="cpt-prop-card selected" onClick={() => setHelpSelected('propcard')}
                          style={{ outline: helpSelected === 'propcard' ? '2px solid var(--tab-color)' : 'none', cursor: 'pointer' }}>
                          <div className="cpt-prop-card-header">
                            <div className="cpt-prop-thumb-wrap">
                              <div className="cpt-prop-thumb-placeholder"></div>
                              <div className="cpt-prop-adj-dot" />
                            </div>
                            <div className="cpt-prop-card-info">
                              <input readOnly onChange={() => {}} className="cpt-prop-name-input" value=""
                                placeholder="scorched_pine" onClick={e => { e.stopPropagation(); setHelpSelected('propname'); }}
                                style={{ outline: helpSelected === 'propname' ? '2px solid var(--tab-color)' : 'none' }} />
                              <span className="cpt-prop-card-meta">scorched_pine_prop.bp</span>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                <span className="cpt-prop-badge custom" onClick={e => { e.stopPropagation(); setHelpSelected('adjindicator'); }}
                                  style={{ cursor: 'pointer', outline: helpSelected === 'adjindicator' ? '2px solid var(--tab-color)' : 'none' }}>
                                  custom texture
                                </span>
                              </div>
                              <div className="cpt-link-row" onClick={e => { e.stopPropagation(); setHelpSelected('linkgroup'); }}
                                style={{ cursor: 'pointer', outline: helpSelected === 'linkgroup' ? '2px solid var(--tab-color)' : 'none' }}>
                                <button className="cpt-btn-add-link">+ Add Link</button>
                              </div>
                            </div>
                            <button className="cpt-btn-delete-small" onClick={e => { e.stopPropagation(); setHelpSelected('deleteprop'); }}
                              style={{ outline: helpSelected === 'deleteprop' ? '2px solid var(--tab-color)' : 'none', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.15)' }}>×</button>
                          </div>
                        </div>
                        {/* Add from library card */}
                        <div className="cpt-add-prop-card" onClick={() => setHelpSelected('addlibrary')}
                          style={{ outline: helpSelected === 'addlibrary' ? '2px solid var(--tab-color)' : 'none' }}>
                          <div className="cpt-add-prop-icon"><span>+</span></div>
                          <span className="cpt-add-prop-text">ADD FROM LIBRARY</span>
                        </div>
                      </div>
                    </div>

                    {/* Warning box */}
                    <div className="cpt-warn-box"> A map name must be set before generating.</div>

                    {/* Generate button */}
                    <button className="cpt-btn-primary cpt-btn-large" onClick={() => setHelpSelected('generatebtn')}
                      style={{ outline: helpSelected === 'generatebtn' ? '2px solid var(--tab-color)' : 'none' }}>
                      GENERATE FILES
                    </button>
                  </div>

                  {/* ── RIGHT col: Detail panel (prop selected, custom texture) ── */}
                  <div className="cpt-detail-column">
                    <div className="cpt-section-card cpt-detail-outer" onClick={() => setHelpSelected('detailpanel')}
                      style={{ cursor: 'pointer', outline: helpSelected === 'detailpanel' ? '2px solid var(--tab-color)' : 'none' }}>

                      {/* Detail header — mirrors PropDetailPanel header exactly */}
                      <div className="cpt-detail-header">
                        <div className="cpt-detail-thumb-placeholder"></div>
                        <div className="cpt-detail-title-wrap">
                          <div className="cpt-detail-name">scorched_pine</div>
                          <div className="cpt-detail-path">/env/props/scorched_pine_custom/scorched_pine_custom_prop.bp</div>
                          <div className="cpt-detail-meta">
                            <span>Biome: <strong>evergreen</strong></span>
                            <span> · </span>
                            <span>Source: <strong>env.scd</strong></span>
                          </div>
                        </div>
                        <div className="cpt-adj-indicator"> Custom Texture</div>
                      </div>

                      <div className="cpt-detail-scroll" onClick={e => e.stopPropagation()}>

                        {/* Texture Adjustments section */}
                        <div className="cpt-detail-section">
                          <h3 className="cpt-detail-section-title">
                            <span className="cpt-section-icon small"></span>
                            TEXTURE ADJUSTMENTS
                          </h3>
                          <div className="cpt-sliders">
                            {[
                              { key: 'hue',        label: 'Hue',        min: 0, max: 360, value: 148, defaultVal: 0,   unit: '°' },
                              { key: 'saturation', label: 'Saturation', min: 0, max: 200, value: 100, defaultVal: 100, unit: '%' },
                              { key: 'brightness', label: 'Brightness', min: 0, max: 200, value: 100, defaultVal: 100, unit: '%' },
                              { key: 'contrast',   label: 'Contrast',   min: 0, max: 200, value: 100, defaultVal: 100, unit: '%' },
                              { key: 'gamma',      label: 'Gamma',      min: 0, max: 200, value: 100, defaultVal: 100, unit: '%' },
                            ].map(({ key, label, min, max, value, defaultVal, unit }) => {
                              const pct = ((value - min) / (max - min)) * 100;
                              const defaultPct = ((defaultVal - min) / (max - min)) * 100;
                              const fillLeft  = Math.min(pct, defaultPct);
                              const fillWidth = Math.abs(pct - defaultPct);
                              const isChanged = value !== defaultVal;
                              const display = unit === '°' && value > 0 ? `+${value}°` : `${value}${unit}`;
                              return (
                                <div key={key} className="cpt-slider-row" onClick={e => { e.stopPropagation(); setHelpSelected(key); }}
                                  style={{ cursor: 'pointer', outline: helpSelected === key ? '2px solid var(--tab-color)' : 'none' }}>
                                  <div className="cpt-slider-header">
                                    <span className="cpt-slider-label">{label}</span>
                                    <span className="cpt-slider-val" style={{ color: isChanged ? 'var(--cpt-accent)' : 'rgba(255,255,255,0.35)' }}>{display}</span>
                                  </div>
                                  <div className="cpt-slider-track-wrap">
                                    <div className="cpt-slider-track" />
                                    <div className="cpt-slider-fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} />
                                    <input type="range" className="cpt-slider-input" readOnly onChange={() => {}} min={min} max={max} value={value} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Pass 1 — Original */}
                        <div className="cpt-detail-section" onClick={e => { e.stopPropagation(); setHelpSelected('pass1'); }}
                          style={{ cursor: 'pointer', outline: helpSelected === 'pass1' ? '2px solid var(--tab-color)' : 'none' }}>
                          <h3 className="cpt-detail-section-title">
                            <span className="cpt-section-icon small"></span>
                            PASS 1 — ORIGINAL
                            <span className="cpt-prop-badge" style={{ marginLeft: 8 }}>source</span>
                          </h3>
                          <div className="cpt-pass-dir">/env/Evergreen/Props/Bush/</div>
                          <div className="cpt-pass-files">
                            {[
                              { name: 'scorched_pine_prop.bp',       label: 'Blueprint · game source' },
                              { name: 'scorched_pine_lod0.scm',      label: 'Mesh · game source' },
                              { name: 'scorched_pine_albedo.dds',    label: 'Albedo · game source' },
                              { name: 'scorched_pine_normalsTS.dds', label: 'Normal Map · game source' },
                            ].map(f => (
                              <div key={f.name} className="cpt-pass-file">
                                <div className="cpt-pass-file-info">
                                  <span className="cpt-pass-file-name">{f.name}</span>
                                  <span className="cpt-pass-file-label">{f.label}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="cpt-pass-note">Read-only game files — used as source for texture generation</div>
                        </div>

                        {/* Pass 2 — Custom (Generated) */}
                        <div className="cpt-detail-section" onClick={e => { e.stopPropagation(); setHelpSelected('pass2'); }}
                          style={{ cursor: 'pointer', outline: helpSelected === 'pass2' ? '2px solid var(--tab-color)' : 'none' }}>
                          <h3 className="cpt-detail-section-title">
                            <span className="cpt-section-icon small"></span>
                            PASS 2 — CUSTOM (GENERATED)
                            <span className="cpt-prop-badge custom" style={{ marginLeft: 8 }}>output</span>
                          </h3>
                          <div className="cpt-pass-dir cpt-pass-dir-custom">/env/props/scorched_pine_custom/</div>
                          <div className="cpt-pass-files">
                            {[
                              { name: 'scorched_pine_custom_prop.bp',       label: 'Blueprint' },
                              { name: 'scorched_pine_custom_lod0.scm',      label: 'Mesh (copied)' },
                              { name: 'scorched_pine_custom_albedo.dds',    label: 'Albedo (adjusted)' },
                              { name: 'scorched_pine_custom_normalsTS.dds', label: 'Normal Map (copied)' },
                            ].map(f => (
                              <div key={f.name} className="cpt-pass-file custom">
                                <div className="cpt-pass-file-info">
                                  <span className="cpt-pass-file-name">{f.name}</span>
                                  <span className="cpt-pass-file-label">{f.label}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="cpt-pass-note cpt-pass-note-custom">Written to map directory with texture adjustments applied</div>
                        </div>

                      </div>
                    </div>
                  </div>

                </div>{/* end cpt-content-grid */}
              </div>{/* end left scrollable area */}

              {/* Right: explanation panel */}
              <div style={{ flex: 1, paddingLeft: 0, overflowY: 'auto', maxHeight: '80vh' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: 'var(--tab-color)' }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: '260px', lineHeight: 1.7 }}>Click any field, button, slider, or section on the left to learn what it does.</div>
                  </div>
                ) : (() => {
                  const sel = MAIN_INFO[helpSelected] || TEX_INFO[helpSelected];
                  if (!sel) return null;
                  return <HelpInfoPanel sel={sel} />;
                })()}
              </div>
            </div>
          )}

          {/* ══════════════ ADD CUSTOM PROP TAB ══════════════ */}
          {activeTab === 'addprop' && (
            <div style={{ display: 'flex', gap: '40px', height: '100%' }}>

              {/* Left: 1:1 replica of AddCustomPropOverlay — real acpo- classes */}
              <div style={{ flex: '0 0 auto', overflowY: 'auto', paddingRight: '20px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ padding: '8px 0 14px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Click any element to learn about it
                </div>

                {/* Exact panel replica — 720px wide like the real overlay */}
                <div style={{
                  width: '720px',
                  background: 'linear-gradient(155deg, #141414 0%, #0e0e0e 60%, #0a0a0a 100%)',
                  border: '1px solid rgba(62,163,135,0.22)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
                  display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
                }}>
                  {/* Top accent line */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--tab-color) 30%, var(--tab-color) 70%, transparent)' }} />

                  {/* Header */}
                  <div className="acpo-header">
                    <div className="acpo-header-title">
                      <span className="acpo-header-icon"></span>
                      ADD CUSTOM PROP
                    </div>
                    <button className="acpo-btn-close" style={{ pointerEvents: 'none' }}>×</button>
                  </div>

                  {/* Body */}
                  <div className="acpo-body" style={{ maxHeight: 'none', overflow: 'visible' }}>

                    {/* EINGABEMODUS */}
                    <div className="acpo-section" onClick={() => setHelpSelected('inputmode')}
                      style={{ cursor: 'pointer', outline: helpSelected === 'inputmode' ? '2px solid var(--tab-color)' : 'none' }}>
                      <label className="acpo-section-label">EINGABEMODUS</label>
                      <div className="acpo-type-switcher">
                        <button className="acpo-type-btn active" style={{ pointerEvents: 'none' }}> Manuell</button>
                        <button className="acpo-type-btn" style={{ pointerEvents: 'none' }}> Drop folder here</button>
                      </div>
                    </div>

                    {/* PROP TYPE */}
                    <div className="acpo-section" onClick={() => setHelpSelected('proptype')}
                      style={{ cursor: 'pointer', outline: helpSelected === 'proptype' ? '2px solid var(--tab-color)' : 'none' }}>
                      <label className="acpo-section-label">PROP TYPE</label>
                      <div className="acpo-type-switcher">
                        <button className="acpo-type-btn active" style={{ pointerEvents: 'none' }}> Tree</button>
                        <button className="acpo-type-btn" style={{ pointerEvents: 'none' }}> Rock</button>
                      </div>
                    </div>

                    {/* PROP NAME */}
                    <div className="acpo-section" onClick={() => setHelpSelected('propname')}
                      style={{ cursor: 'pointer', outline: helpSelected === 'propname' ? '2px solid var(--tab-color)' : 'none' }}>
                      <label className="acpo-section-label">PROP NAME</label>
                      <input readOnly onChange={() => {}} className="acpo-name-input" placeholder="e.g. PineTree_01"
                        style={{ pointerEvents: 'none' }} />
                      <div className="acpo-path-preview">/env/props/PineTree_01/PineTree_01_prop.bp</div>
                    </div>

                    {/* ASSETS */}
                    <div className="acpo-section" onClick={() => setHelpSelected('mesh')}
                      style={{ cursor: 'pointer', outline: helpSelected === 'mesh' || helpSelected === 'albedo' || helpSelected === 'normalmap' ? '2px solid var(--tab-color)' : 'none' }}>
                      <label className="acpo-section-label">ASSETS</label>
                      <div className="acpo-dropzones">
                        {[
                          { key: 'mesh',      label: 'Mesh LOD0',  icon: '', hint: '.scm (required)' },
                          { key: 'albedo',    label: 'Albedo',     icon: '', hint: '.dds / .png / .tga', optional: true },
                          { key: 'normalmap', label: 'Normal Map', icon: '', hint: '.dds / .png / .tga', optional: true },
                        ].map(({ key, label, icon, hint, optional }) => (
                          <div key={key}
                            className={`acpo-dropzone${optional ? ' optional' : ''}`}
                            onClick={e => { e.stopPropagation(); setHelpSelected(key); }}
                            style={{ cursor: 'pointer', outline: helpSelected === key ? '2px solid var(--tab-color)' : 'none' }}>
                            <div className="acpo-dropzone-icon">{icon}</div>
                            <div className="acpo-dropzone-label">
                              {label}
                              {optional && <span className="acpo-optional-badge">optional</span>}
                            </div>
                            <div className="acpo-dropzone-hint">{hint}</div>
                          </div>
                        ))}
                      </div>
                      <button className="acpo-lod-add-btn" style={{ pointerEvents: 'none', alignSelf: 'flex-start' }}>+ Add LOD levels (LOD1 / LOD2)</button>
                    </div>

                    {/* BLUEPRINT */}
                    <div className="acpo-section" onClick={() => setHelpSelected('blueprint')}
                      style={{ cursor: 'pointer', outline: helpSelected === 'blueprint' || helpSelected === 'bpfields' ? '2px solid var(--tab-color)' : 'none' }}>
                      <label className="acpo-section-label">BLUEPRINT</label>
                      <div className="acpo-bp-tabs">
                        <button className="acpo-bp-tab active" style={{ pointerEvents: 'none' }}>Upload prop.bp</button>
                        <button className="acpo-bp-tab" style={{ pointerEvents: 'none' }} onClick={e => { e.stopPropagation(); setHelpSelected('bpfields'); }}>Create prop.bp</button>
                      </div>

                      {/* Show "Create prop.bp" fields when bpfields selected */}
                      {helpSelected === 'bpfields' ? (
                        <div className="acpo-bp-fields" onClick={e => e.stopPropagation()}>
                          <div className="acpo-fields-grid">
                            {[
                              ['Reclaim Mass', '6'], ['Reclaim Energy', '15'], ['Reclaim Time', '5'],
                              ['Health', '50'], ['Uniform Scale', '0.155'], ['LOD Cutoff', '900'],
                              ['Size X', '10.1'], ['Size Y', '11.2'], ['Size Z', '10.1'],
                            ].map(([l, v]) => (
                              <div key={l} className="acpo-field">
                                <label className="acpo-field-label">{l}</label>
                                <input readOnly onChange={() => {}} className="acpo-field-input" value={v} />
                              </div>
                            ))}
                          </div>
                          <div className="acpo-field acpo-field-full">
                            <label className="acpo-field-label">Help Text</label>
                            <input readOnly onChange={() => {}} className="acpo-field-input" placeholder="Prop description" />
                          </div>
                          <div className="acpo-field acpo-field-checkbox">
                            <label className="acpo-field-label">Block Pathfinding</label>
                            <button className="acpo-toggle off" style={{ pointerEvents: 'none' }}>NO</button>
                          </div>
                        </div>
                      ) : (
                        <div className="acpo-bp-upload" onClick={e => e.stopPropagation()}>
                          <div className="acpo-dropzone" style={{ cursor: 'pointer' }}
                            onClick={() => setHelpSelected('blueprint')}>
                            <div className="acpo-dropzone-icon"></div>
                            <div className="acpo-dropzone-label">Blueprint</div>
                            <div className="acpo-dropzone-hint">Drop _prop.bp here</div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>{/* end acpo-body */}

                  {/* Footer */}
                  <div className="acpo-footer">
                    <div className="acpo-footer-hint">Enter a prop name to get started.</div>
                    <div className="acpo-footer-actions">
                      <button className="acpo-btn-cancel" style={{ pointerEvents: 'none' }}>Cancel</button>
                      <button className="acpo-btn-save" style={{ pointerEvents: 'none' }}
                        onClick={() => setHelpSelected('confirm')}> Save Prop</button>
                    </div>
                  </div>

                </div>{/* end panel */}
              </div>{/* end left col */}

              {/* Right: explanation */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '80vh' }}>
                {!helpSelected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.3, color: 'var(--tab-color)' }}>←</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>Select an element</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.18)', maxWidth: '240px', lineHeight: 1.7 }}>Click any section to learn about the Add Custom Prop workflow.</div>
                  </div>
                ) : (() => {
                  const sel = ADD_INFO[helpSelected];
                  if (!sel) return null;
                  return <HelpInfoPanel sel={sel} />;
                })()}
              </div>
            </div>
          )}

          {/* ══════════════ ADVANCED GUIDE TAB ══════════════ */}
          {activeTab === 'advanced' && (
            <div className="help-adv-layout">
              {/* Sub-tab switcher */}
              <div className="help-adv-subtabs">
                {[
                  { id: 'workflow',      label: 'Workflow' },
                  { id: 'textures',      label: 'Texture Pipeline' },
                  { id: 'linkgroups',    label: 'Link Groups' },
                  { id: 'filetypes',     label: 'File Types' },
                  { id: 'generate',      label: 'Generate Output' },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`help-adv-subtab${activeAdvSubTab === t.id ? ' active' : ''}`}
                    onClick={() => setActiveAdvSubTab(t.id)}
                  >{t.label}</button>
                ))}
              </div>

              {/* ─── WORKFLOW ─── */}
              {activeAdvSubTab === 'workflow' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Full Workflow Overview</h2>
                    <p className="help-adv-hero-desc">Complete reference for building a working custom prop setup from scratch — from naming conventions to final in-game verification.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button btn-primary">GENERATE FILES</div>
                    <div className="help-adv-button-hint">4 steps to production-ready output</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Core Process</h3>
                  <div className="help-adv-timeline">
                    {[
                      { n: '01', title: 'Set Map Name', desc: 'Enter the exact map folder name (e.g. Hades_Dust.v0002). This becomes the root of all output paths. The tool appends .v0001 automatically if omitted, but the version must match your actual map folder.', subs: ['Must match /maps directory folder name exactly — FA is case-sensitive', 'Omitting .v0001 appends it automatically at generation time', 'Wrong name = all prop file paths broken, props invisible in-game', 'Typical pattern: MapName.vXXXX where XXXX is a 4-digit version like 0001 or 0003'] },
                      { n: '02', title: 'Add Props', desc: 'Add props via the Library (recommended for game-native props) or via Add Custom Prop (for external .bp + mesh + texture files you created or extracted).', subs: ['Library: search by name, browse by biome, multi-select. Pre-configured adjustments carry over automatically', 'Add Custom Prop: drop a .bp file or an entire folder. Blueprint + mesh are required minimum — textures optional', 'Duplicate detection: adding the same prop twice is blocked automatically', 'Props without any adjustments are still valid — they reference original game paths as-is'] },
                      { n: '03', title: 'Configure Textures', desc: 'Double-click any prop card to open the Texture Editor. Apply adjustments per prop: Hue, Saturation, Brightness, Contrast, Gamma, Tint, and Region Restriction.', subs: ['Adjustments are baked into the albedo DDS pixel data at generation time — not shader uniforms', 'Props without adjustments use original game files directly — no output files written for them', '"Apply to All" propagates current slider values to every prop in the list — useful for a biome-wide baseline', 'Multi-pass baking: apply changes, bake, then apply another round of changes on top — used for complex color operations'] },
                      { n: '04', title: 'Generate Files', desc: 'Click GENERATE FILES. The tool validates names, checks for duplicates, confirms, then writes all blueprint + mesh + texture file sets to the map directory.', subs: ['Original props: no files written, game paths referenced as-is', 'Adjusted props: writes _prop.bp + _lod0.scm + _albedo.dds + _normalsTS.dds to /maps/{mapName}/env/props/{propName}/', 'Link group followers: write only _prop.bp referencing source\'s albedo path — no texture re-generated', 'Re-running is always safe — existing files overwritten cleanly, no manual cleanup needed'] },
                    ].map(s => (
                      <div key={s.n} className="help-adv-step">
                        <div className="help-adv-step-num">{s.n}</div>
                        <div className="help-adv-step-content">
                          <h4>{s.title}</h4>
                          <p>{s.desc}</p>
                          <ul style={{ margin: '10px 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {s.subs.map((sub, i) => <li key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.6 }}>{sub}</li>)}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Troubleshooting</h3>
                  {[
                    ['Props not showing in-game after generating', 'Verify the map name exactly matches the /maps folder. FA\'s prop system is case-sensitive and path-exact. Also confirm you actually placed the props in the FA map editor and saved the scenario file — generating files alone is not enough. The generated props are assets; you still need to reference them in the map\'s prop placement data.'],
                    ['Generate button is disabled', 'Check that (1) a Map Name is set and (2) at least one prop has texture adjustments or is in a link group. Original-only lists with no adjustments and no group followers produce nothing — the Generate button correctly stays disabled.'],
                    ['Duplicate name error on generation', 'Each adjusted prop must have a unique custom name. Two props with the same name would overwrite each other\'s files. Rename one of them in the name field on its card.'],
                    ['Texture looks wrong in-game', 'Check the Live Preview in the Texture Editor first. Also verify the prop\'s albedo DDS is power-of-2 dimensions (128×128, 256×256, 512×512, 1024×1024). Non-power-of-2 textures silently fail in FA\'s renderer.'],
                    ['Custom prop appears with wrong scale', 'The Uniform Scale value in the blueprint controls visual size. 1.0 is the default game scale for that prop type. If the prop appears too large or too small, adjust the Uniform Scale in Add Custom Prop\'s blueprint fields before confirming.'],
                  ].map(([q, a]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q">
                        <span className="help-adv-ts-icon">▸</span>
                        <strong style={{ color: 'var(--tab-color)' }}>{q}</strong>
                      </div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['', 'Generate Early', 'Generate after your first few props and verify in-game before configuring all 30. Finding path issues early saves hours.'],
                      ['', 'Use snake_case Names', 'No spaces, hyphens, or CamelCase in prop names. FA is case-sensitive; spaces in folder names break file resolution.'],
                      ['', 'Library First', 'Add props via the Library when possible — game-native paths are already correct and the scan resolves texture paths automatically.'],
                      ['', 'Re-run is Safe', 'Every generation run overwrites existing files cleanly. Fix → re-run is the designed workflow. No manual cleanup needed.'],
                    ].map(([icon, title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon">{icon}</div>
                        <h4 style={{ color: '#fff', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── TEXTURE PIPELINE ─── */}
              {activeAdvSubTab === 'textures' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Texture Pipeline</h2>
                    <p className="help-adv-hero-desc">How texture adjustments work internally — from slider values to the final DDS pixel output written to disk. Understanding the pipeline helps you predict what each adjustment does and combine them effectively.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      {['1. Hue & Saturation', '2. Brightness', '3. Contrast', '4. Gamma Correction', '5. Tint Blend'].map((s, i) => (
                        <div key={s} style={{ padding: '6px 12px', background: `rgba(62,163,135,${0.06 + i * 0.04})`, border: '1px solid rgba(62,163,135,0.2)', fontSize: '0.72rem', color: 'var(--tab-color)', letterSpacing: '0.06em', fontFamily: 'monospace' }}>{s}</div>
                      ))}
                    </div>
                    <div className="help-adv-button-hint">Processing order (top to bottom, per pixel)</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Processing Order — Step by Step</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                    {[
                      { n: '01', title: 'Hue Rotation (HSL space)', accent: false, desc: 'This is the colour shift slider — it rotates every pixel\'s colour around the colour wheel. Set it to +90° and a brown pine bark becomes teal. Set it to +180° and the whole palette flips to its opposite. Saturation is also controlled here: drop it toward 0% and colours fade to grey, push it above 100% and they become more vivid. Hue and saturation are adjusted together in a single step because that\'s how colour works — changing the hue without touching saturation keeps the intensity the same.',
                        rows: [
                          { label: 'bark hue 15°',  note: 'shift +90°', value: '→ teal / cyan', state: 'active' },
                          { label: 'any hue',        note: 'shift +180°', value: '→ hue inverted', state: 'active' },
                        ],
                        legend: 'Hue offset applied in HSL space · wraps at 360°',
                      },
                      { n: '02', title: 'Brightness (RGB multiply)', accent: false, desc: 'Brightness just multiplies every colour value by a number. Below 100% makes everything darker. Above 100% makes everything lighter. Simple — but it clips at white: if a pixel is already at 200 out of 255 and you push brightness to 150%, it hits 255 and stays there, losing detail in the bright areas. This is applied after hue and saturation so that colour shifts don\'t cause unexpected clipping.',
                        rows: [
                          { label: 'RGB (180, 120, 80)', note: '80% brightness', value: '→ (144, 96, 64)', state: 'active' },
                          { label: 'RGB (180, 120, 80)', note: '150% brightness', value: '→ (255, 180, 120)  clips', state: 'edge' },
                        ],
                        legend: 'output = input × (brightness ÷ 100)',
                      },
                      { n: '03', title: 'Contrast (pivot around mid-grey)', accent: false, desc: 'Contrast increases the difference between light and dark areas. Think of it as stretching the image away from mid-grey in both directions: bright areas get brighter, dark areas get darker, making the texture feel more punchy. Going below 100% does the opposite — everything gets pulled toward a flat grey wash. Contrast is applied after brightness so that if you\'ve already shifted the overall exposure, the contrast stretch works on those new values.',
                        rows: [
                          { label: 'RGB (200, 200, 200)', note: 'contrast 150%', value: '→ (236, 236, 236)', state: 'active' },
                          { label: 'RGB (50, 50, 50)',    note: 'contrast 150%', value: '→ (11, 11, 11)', state: 'active' },
                        ],
                        legend: 'output = 128 + (input − 128) × (contrast ÷ 100)',
                      },
                      { n: '04', title: 'Gamma Correction (power curve)', accent: false, desc: 'Gamma is a subtle midtone lift or push — it brightens or darkens the middle greys without blowing out highlights or crushing shadows. Pure black stays black, pure white stays white, but everything in between shifts. This makes it great for rescuing a texture that\'s a bit too dark overall without washing out the brighter areas. Think of it as a gentle S-curve rather than a flat multiplication like brightness.',
                        rows: [
                          { label: 'grey 128',  note: 'gamma 150%', value: '≈ 161  (brightened)', state: 'active' },
                          { label: 'grey 128',  note: 'gamma 70%',  value: '≈ 95   (darkened)',   state: 'edge' },
                          { label: '0  or  255', note: 'any gamma', value: 'unchanged',            state: 'excluded' },
                        ],
                        legend: 'output = (input ÷ 255) ^ (100 ÷ gamma) × 255',
                      },
                      { n: '05', title: 'Tint Blend (alpha composite)', accent: true, desc: 'Tint paints a solid colour over the entire texture at a chosen strength. At 0% opacity nothing changes. At 100% the whole texture becomes that flat colour. Somewhere in the middle — say 25% — the original texture shows through with a colour cast on top. This is useful for giving a prop a biome tint (reddish desert dust, greenish jungle moss) without completely overwriting the original detail. It\'s applied last so it works on top of all previous adjustments.',
                        rows: [
                          { label: 'R  128 → 152', note: '128×0.7 + 210×0.3', value: 'warm', state: 'active' },
                          { label: 'G  128 → 114', note: '128×0.7 +  80×0.3', value: 'mid',  state: 'edge' },
                          { label: 'B  128 → 102', note: '128×0.7 +  40×0.3', value: 'cool', state: 'excluded' },
                        ],
                        legend: 'Tint RGB (210, 80, 40) · opacity 30% · on grey (128, 128, 128)',
                      },
                    ].map(step => (
                      <div key={step.n} style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${step.accent ? 'var(--tab-color)' : 'rgba(255,255,255,0.15)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <div style={{ width: '26px', height: '26px', background: 'var(--tab-color)', color: '#000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>{step.n}</div>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{step.title}</h4>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: '0 0 12px' }}>{step.desc}</p>
                        {/* Example pill rows */}
                        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                            {step.legend}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '6px' }}>
                            {step.rows.map((row, ri) => {
                              const isActive   = row.state === 'active';
                              const isEdge     = row.state === 'edge';
                              const isExcluded = row.state === 'excluded';
                              return (
                                <div key={ri} style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  padding: '7px 10px',
                                  background: isActive ? 'rgba(62,163,135,0.08)' : isEdge ? 'rgba(255,255,255,0.03)' : 'transparent',
                                  border: `1px solid ${isActive ? 'rgba(62,163,135,0.25)' : isEdge ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
                                  transition: 'all 0.2s ease',
                                }}>
                                  {/* Status dot */}
                                  <span style={{
                                    width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                                    background: isActive ? 'var(--tab-color)' : isEdge ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                                    boxShadow: isActive ? '0 0 6px var(--tab-glow)' : 'none',
                                  }} ></span>
                                  {/* Label */}
                                  <code style={{
                                    fontFamily: 'monospace', fontSize: '0.76rem', flex: 1,
                                    color: isActive ? 'rgba(255,255,255,0.85)' : isEdge ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)',
                                  }}>{row.label}</code>
                                  {/* Note */}
                                  <span style={{
                                    fontSize: '0.68rem', letterSpacing: '0.04em',
                                    color: isActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)',
                                    fontStyle: 'italic',
                                  }}>{row.note}</span>
                                  {/* Value pill */}
                                  <span style={{
                                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
                                    padding: '2px 9px',
                                    background: isActive ? 'rgba(62,163,135,0.15)' : isEdge ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    border: `1px solid ${isActive ? 'rgba(62,163,135,0.35)' : isEdge ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
                                    color: isActive ? 'var(--tab-color)' : isEdge ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
                                    boxShadow: isActive ? '0 0 8px var(--tab-glow)' : 'none',
                                    fontFamily: 'monospace',
                                  }}>{row.value}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Multi-Pass Baking</h3>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: '24px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: 0 }}>The Texture Editor supports multi-pass baking via the "Apply Changes — bake as new base" button. When you bake, the current adjusted image becomes the new source canvas, and all sliders reset to their neutral defaults. You can then apply a completely independent second round of adjustments on top of the already-modified image.</p>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>This is useful for operations that would cancel each other out if applied in a single pass. Example: First pass shifts hue by +90° and boosts saturation. Second pass selectively desaturates only the greens that the first pass introduced. Each baked pass is stored and re-applied in sequence when generating, so re-running always reproduces the exact same result.</p>
                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 2, color: 'rgba(255,255,255,0.55)', marginTop: '16px' }}>
                      <div style={{ color: 'var(--tab-color)' }}>Pass 1 (baked):</div>
                      <div>Hue +120° · Saturation 130%</div>
                      <div style={{ color: 'var(--tab-color)', marginTop: 6 }}>Pass 2 (baked):</div>
                      <div>Brightness 85% · Contrast 115%</div>
                      <div style={{ color: 'var(--tab-color)', marginTop: 6 }}>Pass 3 (live):</div>
                      <div>Tint orange 20% opacity · Gamma 110%</div>
                    </div>
                  </div>
                </div>
                <div className="help-adv-note" style={{ marginTop: '24px' }}>
                  <strong>Performance note: </strong>All pixel processing runs in-browser via Canvas 2D. Large textures (512×512+) may take 1–3 seconds per pass. The live preview uses a down-scaled version (max 512px per side) for responsiveness — the actual generated DDS uses the full original resolution.
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['', 'Single Pass When Possible', 'Every baked pass introduces DXT compression artefacts. Hue + brightness + gamma can all be done in one pass — only use multi-pass when operations cancel each other.'],
                      ['', 'Power-of-2 Only', 'Source textures must be 64, 128, 256, 512, or 1024 per side. Non-power-of-2 DDS files are silently ignored by FA\'s renderer.'],
                      ['', 'Preview Before Generating', 'The split-view preview is your only chance to catch clipped highlights or unintended hue shifts before writing files. Always check it.'],
                      ['', 'DXT1 vs DXT5', 'Use DXT1 for fully opaque props. Use DXT5 if the albedo\'s alpha channel carries specular data — DXT1 discards the alpha channel entirely.'],
                    ].map(([icon, title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon">{icon}</div>
                        <h4 style={{ color: '#fff', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── LINK GROUPS ─── */}
              {activeAdvSubTab === 'linkgroups' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Link Groups — Deep Dive</h2>
                    <p className="help-adv-hero-desc">Link groups allow multiple props with different meshes to share a single adjusted albedo texture file. One source prop generates the texture; all followers point their blueprint at that same file. Reduces output size and ensures perfect colour consistency across related variants.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <div style={{ padding: '10px 14px', background: 'rgba(62,163,135,0.08)', border: '2px solid rgba(62,163,135,0.4)', color: 'var(--tab-color)', fontSize: '0.78rem', textAlign: 'center', fontWeight: 700 }}>Source Prop — generates albedo DDS</div>
                      <div style={{ textAlign: 'center', color: 'var(--tab-glow)', fontSize: '1.5rem', lineHeight: 1 }}>↓</div>
                      <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '0.74rem', textAlign: 'center' }}>Follower A → _prop.bp points to source albedo</div>
                      <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '0.74rem', textAlign: 'center' }}>Follower B → _prop.bp points to source albedo</div>
                      <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '0.74rem', textAlign: 'center' }}>Follower C → _prop.bp points to source albedo</div>
                    </div>
                    <div className="help-adv-button-hint">1 texture file, N blueprint files</div>
                  </div>
                </div>

                {/* ── THE CORE DIFFERENCE: Unlinked vs Linked ── */}
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">0</span>The Core Difference — Unlinked vs Linked</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
                    {/* UNLINKED */}
                    <div>
                      <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px', color: 'rgba(255,255,255,0.45)', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        ✗ &nbsp;Without Link Groups
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { name: 'pine_small', tex: 'pine_small_albedo.dds', own: true },
                          { name: 'pine_medium', tex: 'pine_medium_albedo.dds', own: true },
                          { name: 'pine_large', tex: 'pine_large_albedo.dds', own: true },
                          { name: 'pine_dead', tex: 'pine_dead_albedo.dds', own: true },
                        ].map(p => (
                          <div key={p.name} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }}>{p.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,120,80,0.7)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,120,80,0.5)', flexShrink: 0, display: 'inline-block' }} ></span>
                              {p.tex}
                            </div>
                          </div>
                        ))}
                        <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(255,80,80,0.05)', border: '1px solid rgba(255,80,80,0.15)', fontSize: '0.78rem', color: 'rgba(255,160,140,0.7)', lineHeight: 1.6 }}>
                          4 separate albedo DDS files generated — each processed independently. Any color adjustment must be manually matched across all four.
                        </div>
                      </div>
                    </div>
                    {/* LINKED */}
                    <div>
                      <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px', color: 'var(--tab-color)', paddingBottom: '8px', borderBottom: '1px solid rgba(62,163,135,0.2)' }}>
                        ✓ &nbsp;With Link Group
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ padding: '10px 14px', background: 'rgba(62,163,135,0.08)', border: '2px solid rgba(62,163,135,0.4)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontSize: '0.63rem', letterSpacing: '0.08em', color: 'var(--tab-color)', textTransform: 'uppercase', fontWeight: 700 }}>SOURCE</div>
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }}>pine_small</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--tab-color)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(62,163,135,0.7)', flexShrink: 0, display: 'inline-block' }} ></span>
                            pine_small_albedo.dds ← generated
                          </div>
                        </div>
                        {['pine_medium', 'pine_large', 'pine_dead'].map(name => (
                          <div key={name} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(62,163,135,0.2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '0.63rem', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 700 }}>FOLLOWER</div>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(62,163,135,0.5)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.7rem' }}>↗</span>
                              pine_small_albedo.dds ← shared
                            </div>
                          </div>
                        ))}
                        <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(62,163,135,0.05)', border: '1px solid rgba(62,163,135,0.2)', fontSize: '0.78rem', color: 'var(--tab-color)', lineHeight: 1.6 }}>
                          1 albedo DDS file generated. All props guaranteed identical colour. Followers only write a _prop.bp — no texture processing at all.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>How Link Groups Work — In Detail</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                    {[
                      { title: 'Source Prop', badge: 'generates', desc: 'The first prop added to a link group becomes the source. The source must have texture adjustments configured — its adjusted albedo DDS is the shared texture. During generation, a full 4-file set is written for the source: _prop.bp, _lod0.scm, _albedo.dds (adjusted), and _normalsTS.dds. The albedo output path for the source prop is what all followers reference.' },
                      { title: 'Follower Props', badge: 'references', desc: 'Props that join a group via the "Join group…" dropdown become followers. For each follower, the generator writes only one file: a _prop.bp that contains the follower\'s own mesh path (LOD0/LOD1/LOD2), but its AlbedoName field points to the source prop\'s output albedo DDS path. No separate texture is generated for followers. Their own mesh and any original texture adjustments are ignored — the source\'s albedo overrides.' },
                      { title: 'Creating a Group', badge: 'setup', desc: 'Click the "+ Add Link" button on the card of the prop you want to be the source. This creates a group with that prop as source and assigns it a unique group ID. Once the group exists, all other prop cards show it in their "Join group…" dropdown. The source prop\'s card displays a "source" badge in the link row showing the count of followers.' },
                      { title: 'Joining a Group', badge: 'setup', desc: 'On any prop card that is not yet in a group, open the "Join group…" dropdown. It lists all active link groups by their source prop\'s name. Selecting one immediately joins the follower to that group. The follower\'s card shows the source name with a link indicator. A prop can only be in one group at a time — joining a different group first requires leaving the current one.' },
                      { title: 'Dissolving a Group', badge: 'management', desc: 'Click the × on the source prop\'s link badge. This dissolves the entire group — all follower props revert to independent status. They keep their own texture adjustments and names. Alternatively, followers can individually leave by clicking their own × — this only removes that follower from the group without affecting others.' },
                      { title: 'Primary Use Cases', badge: 'use cases', desc: 'Tree families with size variants (small/medium/large/dead variants all share one colour-shifted albedo). Rock piles where the same rock texture is reused across different mesh arrangements. Debris sets where multiple wreckage meshes should look like they came from the same source object. Link groups save significant generation time and eliminate texture duplication when multiple props share the same visual appearance.' },
                    ].map(item => (
                      <div key={item.title} style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid var(--tab-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{item.title}</h4>
                          <span style={{ fontSize: '0.62rem', padding: '2px 8px', background: 'rgba(62,163,135,0.1)', border: '1px solid rgba(62,163,135,0.3)', color: 'var(--tab-color)', letterSpacing: '0.06em', fontWeight: 600 }}>{item.badge.toUpperCase()}</span>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>Generated Blueprint Structure — Follower vs Source</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--tab-color)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Source: scorched_pine_t2</div>
                      <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(62,163,135,0.3)', padding: '14px', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 2, color: 'rgba(255,255,255,0.55)' }}>
                        <div>PropBlueprint {'{'}</div>
                        <div style={{ paddingLeft: 12 }}>Display = {'{'}</div>
                        <div style={{ paddingLeft: 24 }}>Mesh = {'{'}</div>
                        <div style={{ paddingLeft: 36 }}>LODs = {'{'}</div>
                        <div style={{ paddingLeft: 48 }}>{'{'}</div>
                        <div style={{ paddingLeft: 60, color: 'var(--tab-color)' }}>AlbedoName =</div>
                        <div style={{ paddingLeft: 72, color: 'var(--tab-color)' }}>'/env/props/</div>
                        <div style={{ paddingLeft: 72, color: 'var(--tab-color)' }}>scorched_pine_t2/</div>
                        <div style={{ paddingLeft: 72, color: 'var(--tab-color)' }}>..._albedo.dds',</div>
                        <div style={{ paddingLeft: 60 }}>MeshName = '..._lod0.scm',</div>
                        <div style={{ paddingLeft: 48 }}>{'}'}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>Follower: scorched_pine_dead</div>
                      <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 2, color: 'rgba(255,255,255,0.55)' }}>
                        <div>PropBlueprint {'{'}</div>
                        <div style={{ paddingLeft: 12 }}>Display = {'{'}</div>
                        <div style={{ paddingLeft: 24 }}>Mesh = {'{'}</div>
                        <div style={{ paddingLeft: 36 }}>LODs = {'{'}</div>
                        <div style={{ paddingLeft: 48 }}>{'{'}</div>
                        <div style={{ paddingLeft: 60, color: 'rgba(255,160,80,0.85)' }}>AlbedoName =</div>
                        <div style={{ paddingLeft: 72, color: 'rgba(255,160,80,0.85)' }}>'/env/props/</div>
                        <div style={{ paddingLeft: 72, color: 'rgba(255,160,80,0.85)' }}>scorched_pine_t2/</div>
                        <div style={{ paddingLeft: 72, color: 'rgba(255,160,80,0.85)' }}>..._albedo.dds', ← SOURCE</div>
                        <div style={{ paddingLeft: 60 }}>MeshName = '..._dead_lod0.scm',</div>
                        <div style={{ paddingLeft: 48 }}>{'}'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="help-adv-note" style={{ marginTop: '16px' }}>
                    <strong>Key insight: </strong>The follower has its own unique mesh (dead variant) but the AlbedoName points to the source prop's texture file. Both props therefore appear with the same adjusted colour in-game, despite having different meshes.
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['', 'Pick Best Mesh as Source', 'Use the most-detailed, most-representative variant as the group source — you\'re colour-grading against its mesh visually. Followers inherit the colour without generating their own texture.'],
                      ['', 'Don\'t Link Different Colours', 'Link groups enforce identical colour on all members. Variants that need different hues (e.g. green pine vs red autumn pine) must be independent — keep only same-colour families in a group.'],
                      ['', 'Verify Follower Mesh Paths', 'When a prop joins a group its generated .bp uses its own mesh path. Confirm the follower\'s SCM file exists at the expected path before generating.'],
                      ['', 'Dissolve Before Recolouring', 'To change the source\'s texture significantly, dissolve the group first. Regenerate the source alone, then re-create the group. Avoids confusion about which run wrote which files.'],
                    ].map(([icon, title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon">{icon}</div>
                        <h4 style={{ color: '#fff', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {/* ─── FILE TYPES ─── */}
              {activeAdvSubTab === 'filetypes' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">File Types — Full Reference</h2>
                    <p className="help-adv-hero-desc">Every FA prop is composed of up to four file types. This section covers what each file does, what it contains, how it is structured, and what happens to it during generation.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                      {[['_prop.bp', 'Blueprint'], ['_lod0.scm', 'Mesh LOD0'], ['_albedo.dds', 'Albedo Texture'], ['_normalsTS.dds', 'Normal Map']].map(([f, l]) => (
                        <div key={f} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <div className="help-adv-button-hint">4 files per complete prop</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>_prop.bp — Blueprint (Full Anatomy)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>The blueprint is a Lua-syntax data file that FA reads to understand what the prop is. It defines everything from visual appearance to physical gameplay properties. Below is a fully annotated example of a tree prop blueprint — every field this tool may generate is included.</p>
                    <div style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(62,163,135,0.25)', padding: '20px', fontFamily: 'monospace', fontSize: '0.74rem', lineHeight: 2, color: 'rgba(255,255,255,0.6)', overflowX: 'auto' }}>
                      <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>-- scorched_pine_custom_prop.bp</div>
                      <div>PropBlueprint {'{'}</div>
                      {/* ScriptClass */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- ScriptClass: Lua script controller. 'Prop' = standard; 'TreeProp' = falling trees</div>
                      <div style={{ paddingLeft: 16 }}>ScriptClass = <span style={{ color: 'var(--tab-color)' }}>&apos;TreeProp&apos;</span>,</div>
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- ScriptModule: where the script lives</div>
                      <div style={{ paddingLeft: 16 }}>ScriptModule = <span style={{ color: 'var(--tab-color)' }}>&apos;/lua/sim/prop.lua&apos;</span>,</div>
                      {/* Categories */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Categories: flags that affect game mechanics (reclaim, hitbox, scanner)</div>
                      <div style={{ paddingLeft: 16 }}>Categories = {'{'} <span style={{ color: 'var(--tab-color)' }}>&apos;RECLAIMABLE&apos;</span>, <span style={{ color: 'var(--tab-color)' }}>&apos;TREE&apos;</span>, <span style={{ color: 'var(--tab-color)' }}>&apos;CANNOTRECLAIM&apos;</span>, {'}'}</div>
                      {/* Audio */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Audio: sound cues for prop events</div>
                      <div style={{ paddingLeft: 16 }}>Audio = {'{'}</div>
                      <div style={{ paddingLeft: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- Destroyed: played when prop health reaches 0</div>
                      <div style={{ paddingLeft: 32 }}>Destroyed = {'{'} Bank = <span style={{ color: 'var(--tab-color)' }}>&apos;EnvSounds&apos;</span>, Cue = <span style={{ color: 'var(--tab-color)' }}>&apos;EnvTreeFall&apos;</span>, LodCutoff = <span style={{ color: 'var(--tab-color)' }}>&apos;UnitMove&apos;</span>, {'}'}</div>
                      <div style={{ paddingLeft: 32 }}>Reclaimed = {'{'} Bank = <span style={{ color: 'var(--tab-color)' }}>&apos;EnvSounds&apos;</span>, Cue = <span style={{ color: 'var(--tab-color)' }}>&apos;EnvTreeReclaim&apos;</span>, LodCutoff = <span style={{ color: 'var(--tab-color)' }}>&apos;UnitMove&apos;</span>, {'}'}</div>
                      <div style={{ paddingLeft: 16 }}>{'}'}</div>
                      {/* Display */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Display block: visual representation</div>
                      <div style={{ paddingLeft: 16 }}>Display = {'{'}</div>
                      <div style={{ paddingLeft: 32 }}>Mesh = {'{'}</div>
                      <div style={{ paddingLeft: 48, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- IconFadeInZoom: zoom level at which prop icon appears on the strategic map</div>
                      <div style={{ paddingLeft: 48 }}>IconFadeInZoom = <span style={{ color: 'var(--tab-color)' }}>4</span>,</div>
                      <div style={{ paddingLeft: 48 }}>LODs = {'{'}</div>
                      {/* LOD 0 */}
                      <div style={{ paddingLeft: 64 }}>{'{'} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- LOD0: full-detail model shown up close</span></div>
                      <div style={{ paddingLeft: 80, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- AlbedoName: path to colour/diffuse DDS</div>
                      <div style={{ paddingLeft: 80 }}>AlbedoName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_albedo.dds&apos;</span>,</div>
                      <div style={{ paddingLeft: 80, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- NormalsName: tangent-space normal map DDS</div>
                      <div style={{ paddingLeft: 80 }}>NormalsName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_normalsTS.dds&apos;</span>,</div>
                      <div style={{ paddingLeft: 80, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- MeshName: path to the SCM geometry file</div>
                      <div style={{ paddingLeft: 80 }}>MeshName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_lod0.scm&apos;</span>,</div>
                      <div style={{ paddingLeft: 80, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- ShaderName: GPU shader. TreeFull=lit tree, TMeshAllAlpha=generic, TMeshNoNormals=flat</div>
                      <div style={{ paddingLeft: 80 }}>ShaderName = <span style={{ color: 'var(--tab-color)' }}>&apos;TreeFull&apos;</span>,</div>
                      <div style={{ paddingLeft: 80, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- SpecularName: specular mask. For tree shaders = same as albedo</div>
                      <div style={{ paddingLeft: 80 }}>SpecularName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_albedo.dds&apos;</span>,</div>
                      <div style={{ paddingLeft: 80, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- LODCutoff: distance in game units after which this LOD stops rendering</div>
                      <div style={{ paddingLeft: 80 }}>LODCutoff = <span style={{ color: 'var(--tab-color)' }}>60</span>,</div>
                      <div style={{ paddingLeft: 64 }}>{'}'}</div>
                      {/* LOD 1 */}
                      <div style={{ paddingLeft: 64 }}>{'{'} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- LOD1: reduced-poly model at medium range (optional)</span></div>
                      <div style={{ paddingLeft: 80 }}>AlbedoName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_albedo.dds&apos;</span>,</div>
                      <div style={{ paddingLeft: 80 }}>NormalsName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_normalsTS.dds&apos;</span>,</div>
                      <div style={{ paddingLeft: 80 }}>MeshName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_lod1.scm&apos;</span>,</div>
                      <div style={{ paddingLeft: 80 }}>ShaderName = <span style={{ color: 'var(--tab-color)' }}>&apos;TreeFull&apos;</span>,</div>
                      <div style={{ paddingLeft: 80 }}>SpecularName = <span style={{ color: 'var(--tab-color)' }}>&apos;/env/props/scorched_pine_custom/scorched_pine_custom_albedo.dds&apos;</span>,</div>
                      <div style={{ paddingLeft: 80 }}>LODCutoff = <span style={{ color: 'var(--tab-color)' }}>200</span>,</div>
                      <div style={{ paddingLeft: 64 }}>{'}'}</div>
                      <div style={{ paddingLeft: 48 }}>{'}'}</div>
                      <div style={{ paddingLeft: 48, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- UniformScale: visual size multiplier. 1.0 = game default</div>
                      <div style={{ paddingLeft: 48 }}>UniformScale = <span style={{ color: 'var(--tab-color)' }}>1</span>,</div>
                      <div style={{ paddingLeft: 32 }}>{'}'}</div>
                      <div style={{ paddingLeft: 16 }}>{'}'}</div>
                      {/* Economy */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Economy block: reclaim resource values</div>
                      <div style={{ paddingLeft: 16 }}>Economy = {'{'}</div>
                      <div style={{ paddingLeft: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- Mass returned when an engineer fully reclaims</div>
                      <div style={{ paddingLeft: 32 }}>ReclaimMassMax = <span style={{ color: 'var(--tab-color)' }}>2</span>,</div>
                      <div style={{ paddingLeft: 32 }}>ReclaimEnergyMax = <span style={{ color: 'var(--tab-color)' }}>0</span>,</div>
                      <div style={{ paddingLeft: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- Multiplier on base reclaim time</div>
                      <div style={{ paddingLeft: 32 }}>ReclaimTimeMultiplier = <span style={{ color: 'var(--tab-color)' }}>1</span>,</div>
                      <div style={{ paddingLeft: 16 }}>{'}'}</div>
                      {/* Defense */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Defense: health / hit points</div>
                      <div style={{ paddingLeft: 16 }}>Defense = {'{'}</div>
                      <div style={{ paddingLeft: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- MaxHealth: damage required to destroy the prop</div>
                      <div style={{ paddingLeft: 32 }}>MaxHealth = <span style={{ color: 'var(--tab-color)' }}>100</span>,</div>
                      <div style={{ paddingLeft: 32 }}>Health = <span style={{ color: 'var(--tab-color)' }}>100</span>,</div>
                      <div style={{ paddingLeft: 16 }}>{'}'}</div>
                      {/* Interface */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Interface: tooltip text shown on hover in-game</div>
                      <div style={{ paddingLeft: 16 }}>Interface = {'{'}</div>
                      <div style={{ paddingLeft: 32 }}>HelpText = <span style={{ color: 'var(--tab-color)' }}>&apos;Scorched Pine&apos;</span>,</div>
                      <div style={{ paddingLeft: 16 }}>{'}'}</div>
                      {/* Physics */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Physics: pathing, collision, destruction</div>
                      <div style={{ paddingLeft: 16 }}>Physics = {'{'}</div>
                      <div style={{ paddingLeft: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- BlockPath: true = units cannot path through this prop</div>
                      <div style={{ paddingLeft: 32 }}>BlockPath = <span style={{ color: 'var(--tab-color)' }}>true</span>,</div>
                      <div style={{ paddingLeft: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- FlattenedDestroyEffect: 'TreeFall' triggers falling animation</div>
                      <div style={{ paddingLeft: 32 }}>FlattenedDestroyEffect = <span style={{ color: 'var(--tab-color)' }}>&apos;TreeFall&apos;</span>,</div>
                      <div style={{ paddingLeft: 32, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>-- MotionType: RULEUMT_None = static prop (does not move)</div>
                      <div style={{ paddingLeft: 32 }}>MotionType = <span style={{ color: 'var(--tab-color)' }}>&apos;RULEUMT_None&apos;</span>,</div>
                      <div style={{ paddingLeft: 16 }}>{'}'}</div>
                      {/* SizeX/Y/Z */}
                      <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: 4 }}>-- Collision footprint in game units (independent of UniformScale)</div>
                      <div style={{ paddingLeft: 16 }}>SizeX = <span style={{ color: 'var(--tab-color)' }}>1</span>, SizeY = <span style={{ color: 'var(--tab-color)' }}>3</span>, SizeZ = <span style={{ color: 'var(--tab-color)' }}>1</span>,</div>
                      <div>{'}'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                      {[
                        { field: 'ScriptClass', note: 'TreeProp = enables falling/burning behaviour, TreeFall physics, burn sounds. Prop = static with no special script behaviour. Rock and debris props should use Prop.' },
                        { field: 'Categories', note: 'RECLAIMABLE = engineers can reclaim it. TREE = treated as a tree for rendering and physics. CANNOTRECLAIM = overrides RECLAIMABLE — use together for props that visually fall but cannot be reclaimed. WRECKAGE = treated as wreckage debris.' },
                        { field: 'Audio.Destroyed / .Reclaimed', note: 'Bank = the sound bank file. Cue = the sound cue name within that bank. LodCutoff = range category at which the sound stops playing. Matches values from vanilla EnvSounds bank — reuse these for consistent audio.' },
                        { field: 'AlbedoName', note: 'Forward-slash path starting with /env/ or /maps/. Case-sensitive on all platforms. For adjusted props this points to the generated file in the map subfolder. For link group followers it points to the source prop\'s generated albedo.' },
                        { field: 'NormalsName', note: 'Tangent-space normal map. This file is byte-copied unchanged by the generator. If omitted, FA falls back to a flat normal. Suffix must be _normalsTS.dds to match FA naming convention.' },
                        { field: 'ShaderName', note: 'TreeFull = lit tree with alpha test. TMeshAllAlpha = generic mesh with alpha. TMeshNoNormals = no normal map lookup, simpler. Wrong shader causes visual corruption. Tree props must use TreeFull or equivalent.' },
                        { field: 'SpecularName', note: 'For TreeFull shader, this is typically the same DDS as AlbedoName — the alpha channel of the albedo carries the specular mask. For TMeshAllAlpha props you may supply a separate specular DDS.' },
                        { field: 'LODCutoff', note: 'Distance in game units after which this LOD no longer renders and the next LOD takes over (or prop becomes invisible if it\'s the last LOD). LOD0 = 40–80 typical. LOD1 = 150–250. LOD2 = 400+.' },
                        { field: 'UniformScale', note: '1.0 = original game-unit size. Collision dimensions (SizeX/Y/Z) are not affected by this — only the visual mesh scales. Always adjust SizeX/Y/Z separately for accurate pathfinding.' },
                        { field: 'ReclaimMassMax', note: 'Mass returned on full reclaim. Vanilla trees: 2–8. Large rocks: 5–20. Wreckage: 10–50. ReclaimEnergyMax is almost always 0 for props. ReclaimTimeMultiplier = 1.0 is standard.' },
                        { field: 'MaxHealth / Health', note: 'Both must be set to the same value. Determines how much weapon damage destroys the prop. Trees: 100–500. Large rocks: 1000–3000. This does not affect reclaim — a prop can be reclaimed regardless of health.' },
                        { field: 'BlockPath', note: 'true = units path around this prop. false = units walk through it (good for grass, small debris). Most trees and rocks use true. Does not affect projectiles.' },
                        { field: 'FlattenedDestroyEffect', note: 'TreeFall = triggers falling animation and sound when destroyed. Only relevant for props using the TreeProp ScriptClass. Rock/Static props typically omit this field or set it to an empty string.' },
                        { field: 'MotionType', note: 'Always RULEUMT_None for props. This tells FA the entity does not move under its own power. Never change this for props — setting other values causes undefined behaviour.' },
                        { field: 'SizeX / SizeY / SizeZ', note: 'Collision box in game units. SizeY = height, SizeX/Z = footprint. These define the physics hitbox and pathfinding obstacle, but NOT the visual mesh size. For trees: typically 1×3×1. For rocks: 2×2×2 or larger.' },
                      ].map(({ field, note }) => (
                        <div key={field} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '16px' }}>
                          <code style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--tab-color)', flexShrink: 0, minWidth: '180px' }}>{field}</code>
                          <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>_lod0.scm — Mesh Format</h3>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: '24px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: 0 }}>SCM (Supreme Commander Mesh) is a proprietary binary mesh format used exclusively by FA. Files contain vertex positions, UV coordinates, bone weights, and surface normals in a compact binary layout.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                      {[
                        ['LOD0', 'Full-detail mesh rendered up close. Required. Typically 200–2000 tris for props.'],
                        ['LOD1', 'Reduced polygon version rendered at medium distance. Optional but improves performance significantly.'],
                        ['LOD2', 'Very low-poly version for far distance rendering. Optional. Some props omit this entirely.'],
                        ['LODCutoff', 'Distance at which each LOD transitions, defined in the blueprint\'s LODs table. The generator copies all LOD files found alongside LOD0.'],
                        ['Binary format', 'Cannot be opened directly. Use Supcom Mesh Editor, StrategicIconTool, or blender-supcom addon to work with SCM files.'],
                      ].map(([label, desc]) => (
                        <div key={label} style={{ display: 'flex', gap: '12px', fontSize: '0.83rem', lineHeight: 1.6, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <strong style={{ color: 'var(--tab-color)', minWidth: '90px', flexShrink: 0 }}>{label}:</strong>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>_albedo.dds — Texture Format & Constraints</h3>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: '24px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: 0 }}>DDS (DirectDraw Surface) is a compressed GPU texture format. FA uses it exclusively — no PNG, JPG, or TGA at runtime. The albedo texture carries the primary colour information for the prop surface.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                      {[
                        ['Power of 2', 'Dimensions MUST be exact powers of 2: 64, 128, 256, 512, 1024. Non-power-of-2 textures fail silently — the prop renders with a default grey or solid-colour fallback in FA. This is the most common cause of "texture looks wrong in-game" issues.'],
                        ['DXT1 compression', 'No alpha channel. Best for fully opaque props (rocks, buildings). Smallest file size (8:1 compression). Most vanilla FA rock and debris props use DXT1.'],
                        ['DXT5 compression', 'Has alpha channel. Required when the alpha channel carries specular intensity data (common in FA\'s tree shaders). The alpha channel controls surface reflectivity — white = specular, black = matte.'],
                        ['RGB channels', 'Standard diffuse colour. Red, green, blue. Linear colour space. The texture adjustments in this tool operate directly on these RGB values.'],
                        ['Alpha channel', 'In most FA prop shaders, alpha = specular mask. When Tint adjustments are applied, the alpha channel is preserved unchanged to avoid altering specular properties.'],
                        ['Resolution guide', '64×64: very small, distant props (grass tufts). 128×128: small rocks, tiny props. 256×256: standard tree/rock. 512×512: detailed large props. 1024×1024: hero props only — performance cost is high.'],
                      ].map(([label, desc]) => (
                        <div key={label} style={{ display: 'flex', gap: '12px', fontSize: '0.83rem', lineHeight: 1.6, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <strong style={{ color: 'var(--tab-color)', minWidth: '115px', flexShrink: 0 }}>{label}:</strong>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">4</span>_normalsTS.dds — Normal Map</h3>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: '24px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: 0 }}>The TS suffix stands for Tangent Space. This is a standard tangent-space normal map stored as DXT5 DDS, where the X and Y normal components are stored in the green and alpha channels (OpenGL convention, FA uses a standard layout). Blue channel stores the Z component.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                      {[
                        ['Optional', 'Props without a normal map use flat normals — appears lower quality under FA\'s directional lighting, especially at close range.'],
                        ['Not modified', 'The generator copies the original normal map as-is to the custom prop folder. Texture adjustments (hue, brightness, etc.) do NOT affect the normal map — only the albedo is modified.'],
                        ['Visual impact', 'Even a simple baked normal map from a mesh\'s high-poly silhouette significantly improves readability under FA\'s lighting. Most visible on rocky surfaces and tree bark.'],
                        ['DXT5 required', 'Normal maps must be DXT5, not DXT1. DXT1 does not have the precision needed for smooth normal interpolation and introduces visible banding artifacts in the surface detail.'],
                      ].map(([label, desc]) => (
                        <div key={label} style={{ display: 'flex', gap: '12px', fontSize: '0.83rem', lineHeight: 1.6, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <strong style={{ color: 'var(--tab-color)', minWidth: '115px', flexShrink: 0 }}>{label}:</strong>
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['', 'Match ShaderName to Content', 'TreeFull for foliage with alpha, TMeshAllAlpha for general meshes. Mismatched shader causes visual corruption. Check vanilla props of the same type for reference.'],
                      ['', 'LOD0 Required, LOD1/2 Optional', 'LOD0 must always be present. LOD1/2 significantly reduce GPU load at medium and long range on large maps. Provide LOD1 for any mesh with 200+ polygons.'],
                      ['', 'SpecularName = AlbedoName for Trees', 'For TreeFull shader, the specular mask lives in the albedo\'s alpha channel. Set SpecularName to the same path as AlbedoName. Other shaders may need a separate specular file.'],
                      ['', 'Set Both MaxHealth and Health', 'Both must be present and equal. FA reads MaxHealth for the hitpoint cap and Health for the starting value. Missing Health causes undefined regeneration behaviour.'],
                    ].map(([icon, title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon">{icon}</div>
                        <h4 style={{ color: '#fff', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}
              {activeAdvSubTab === 'generate' && (<>
                <div className="help-adv-hero">
                  <div className="help-adv-hero-content">
                    <h2 className="help-adv-hero-title">Generate Output — Full Reference</h2>
                    <p className="help-adv-hero-desc">Everything that happens when you click Generate Files — what is validated, what files are written, what paths are used, and how to debug problems when something goes wrong.</p>
                  </div>
                  <div className="help-adv-button-showcase">
                    <div className="help-adv-fake-button btn-primary">GENERATE FILES</div>
                    <div className="help-adv-button-hint">All operations run in a single pass</div>
                  </div>
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">1</span>Validation — What Is Checked Before Writing</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                    {[
                      { check: 'Map Name set', detail: 'Generation aborts immediately if Map Name is empty. All file paths depend on this value. Error: "Please enter a map name!"' },
                      { check: 'Maps Folder configured', detail: 'The absolute path to your /maps directory must be set either in Settings or visible in the Configuration section. Error: "No Maps folder configured."' },
                      { check: 'At least one operation to run', detail: 'There must be at least one prop with adjustments OR at least one follower in a link group. Original-only prop lists produce no files. Error: "No custom props added yet."' },
                      { check: 'No duplicate names', detail: 'Every adjusted prop with a custom name must have a unique name. Two props with the same name would overwrite each other\'s generated files. Error: "Duplicate prop names: [names]"' },
                      { check: 'Confirmation dialog', detail: 'A dialog shows the count of operations (adjusted props + link group followers), the breakdown, and the target directory. Generation proceeds only on explicit confirmation.' },
                    ].map(item => (
                      <div key={item.check} style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '16px' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(62,163,135,0.2)', border: '1px solid rgba(62,163,135,0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--tab-color)', fontWeight: 700, marginTop: 2 }}>✓</div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>{item.check}</div>
                          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">2</span>What Gets Written — Per Prop Type</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                    {[
                      { title: 'Original props (no adjustments, no group)', files: 'Nothing written to disk.', detail: 'The prop\'s original game path (e.g. /env/ForestPine01/ForestPine01_prop.bp) is used as-is in all references. No file I/O occurs. These props appear in the confirmed list but produce zero output operations.' },
                      { title: 'Adjusted props (has texture adjustments, is group source or solo)', files: '_prop.bp + _lod0.scm + _albedo.dds + _normalsTS.dds', detail: 'A complete 4-file set is written to /maps/{mapName}/env/props/{propName}/. The blueprint is freshly generated referencing the new file paths. The mesh is byte-copied from the original game files. The albedo DDS is pixel-processed with all adjustment passes applied in order. The normal map is byte-copied unchanged.' },
                      { title: 'Link group followers', files: '_prop.bp only', detail: 'One file is written: a _prop.bp containing the follower\'s mesh path, but with AlbedoName pointing to the source prop\'s output albedo DDS path. No texture processing occurs. The follower\'s own adjustment settings are ignored — the source albedo overrides.' },
                      { title: 'Re-run / overwrite behaviour', files: 'All existing files overwritten.', detail: 'Every generation run overwrites any files that already exist at the target paths. There is no merge, no conflict detection, and no backup. This is intentional — re-running is the designed workflow for iterating on adjustments. Safe to run as many times as needed.' },
                    ].map(item => (
                      <div key={item.title} style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid var(--tab-color)' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '6px', fontSize: '0.88rem', fontWeight: 600, color: '#fff', letterSpacing: '0.04em' }}>{item.title}</h4>
                        <div style={{ marginBottom: '10px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--tab-color)', background: 'rgba(62,163,135,0.06)', border: '1px solid rgba(62,163,135,0.15)', padding: '4px 10px', display: 'inline-block' }}>{item.files}</div>
                        <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">3</span>Output Directory Structure</h3>
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px 28px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 2.2, marginTop: '24px', overflowX: 'auto' }}>
                    <div style={{ color: 'rgba(255,255,255,0.85)' }}>/maps/Hades_Dust.v0002/</div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', paddingLeft: '24px' }}>env/props/</div>

                    <div style={{ paddingLeft: '48px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--tab-color)', fontWeight: 600 }}>scorched_pine_custom/</span>
                      <span style={{ color: 'var(--tab-glow)', fontSize: '0.7rem', marginLeft: '12px' }}>— adjusted prop (source)</span>
                    </div>
                    {[
                      { f: 'scorched_pine_custom_prop.bp',       c: 'rgba(255,255,255,0.5)', n: 'blueprint' },
                      { f: 'scorched_pine_custom_lod0.scm',      c: 'rgba(255,255,255,0.5)', n: 'mesh (copied)' },
                      { f: 'scorched_pine_custom_albedo.dds',    c: 'var(--tab-color)', n: '← pixel-modified' },
                      { f: 'scorched_pine_custom_normalsTS.dds', c: 'rgba(255,255,255,0.5)', n: 'normal (copied)' },
                    ].map(r => (
                      <div key={r.f} style={{ paddingLeft: '72px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ color: r.c }}>├ {r.f}</span>
                        <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem' }}>{r.n}</span>
                      </div>
                    ))}

                    <div style={{ paddingLeft: '48px', marginTop: '8px' }}>
                      <span style={{ color: 'rgba(255,200,100,0.7)', fontWeight: 600 }}>scorched_pine_dead/</span>
                      <span style={{ color: 'rgba(255,200,100,0.35)', fontSize: '0.7rem', marginLeft: '12px' }}>— link group follower</span>
                    </div>
                    <div style={{ paddingLeft: '72px' }}>
                      <span style={{ color: 'rgba(255,200,100,0.55)' }}>└ scorched_pine_dead_prop.bp</span>
                      <span style={{ color: 'rgba(255,200,100,0.3)', fontSize: '0.7rem', marginLeft: '12px' }}>only this file written</span>
                    </div>

                    <div style={{ paddingLeft: '48px', marginTop: '8px' }}>
                      <span style={{ color: 'var(--tab-color)', fontWeight: 600 }}>rock_variant_02/</span>
                      <span style={{ color: 'var(--tab-glow)', fontSize: '0.7rem', marginLeft: '12px' }}>— adjusted prop</span>
                    </div>
                    {[
                      { f: 'rock_variant_02_prop.bp',       c: 'rgba(255,255,255,0.5)' },
                      { f: 'rock_variant_02_lod0.scm',      c: 'rgba(255,255,255,0.5)' },
                      { f: 'rock_variant_02_albedo.dds',    c: 'var(--tab-color)' },
                      { f: 'rock_variant_02_normalsTS.dds', c: 'rgba(255,255,255,0.5)' },
                    ].map(r => (
                      <div key={r.f} style={{ paddingLeft: '72px' }}>
                        <span style={{ color: r.c }}>├ {r.f}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '24px', marginTop: '12px', flexWrap: 'wrap' }}>
                    {[
                      { color: 'rgba(62,163,135,0.6)',    label: 'Adjusted / source prop (4 files)' },
                      { color: 'rgba(255,200,100,0.5)',   label: 'Link group follower (1 file)' },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                        <span style={{ width: '10px', height: '10px', background: l.color, display: 'inline-block', flexShrink: 0 }} ></span>
                        {l.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="help-adv-ts-grid">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">4</span>Troubleshooting Generation Failures</h3>
                  {[
                    ['Generate succeeds but props are invisible in-game', 'The files exist but the map scenario file doesn\'t reference them. You must place the generated props in the FA map editor and save — generation creates the asset files, but the map scenario must explicitly place and reference them using the generated paths.'],
                    ['Error: Cannot find source texture for prop', 'The original game albedo DDS cannot be located. Verify the Maps Folder path is correct, that the prop\'s game path is valid, and that the FA game files are accessible. Props from the library resolve correctly if the library was scanned from a valid FA installation.'],
                    ['Albedo looks identical to original', 'All sliders may be at neutral defaults (Hue 0°, Sat/Bri/Con/Gamma 100%, Tint opacity 0%). A prop technically "has adjustments" if you modified and reset them — check the custom texture badge.'],
                    ['Link follower blueprint references wrong albedo path', 'The source prop must be successfully generated first. If the source failed, the follower\'s blueprint contains a dangling path. Check that the source prop\'s name is set, unique, and has adjustments configured.'],
                    ['Files appear in wrong subfolder depth', 'Check for leading/trailing spaces in the custom name field. A name " scorched_pine " creates a folder with spaces, which FA\'s file system may not recognise.'],
                  ].map(([q, a]) => (
                    <div key={q} className="help-adv-ts-item">
                      <div className="help-adv-ts-q">
                        <span className="help-adv-ts-icon">▸</span>
                        <strong style={{ color: 'var(--tab-color)' }}>{q}</strong>
                      </div>
                      <div className="help-adv-ts-a"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
                <div className="help-adv-structure">
                  <h3 className="help-adv-section-header"><span className="help-adv-section-num">5</span>Best Practices</h3>
                  <div className="help-adv-practice-grid">
                    {[
                      ['', 'Place Props After Generating', 'Generation writes the asset files. You still need to open FA\'s map editor, place each prop, and save the scenario file. Assets without placement data are invisible in-game.'],
                      ['', 'Match Reclaim Values to Vanilla', 'Look up a vanilla prop of similar size and use its ReclaimMassMax as your starting point. Wildly different values break map balance — trees are typically 2–8, large rocks 5–20.'],
                      ['', 'Test with 1–2 Props First', 'Before generating all 30 props, generate just one, place it, and verify it loads correctly in FA. Catching a path or scale issue early saves re-doing everything.'],
                      ['', 'Use Link Groups for Families', 'Any group of props sharing the same biome/colour should be in a link group. One texture file → zero texture drift between variants → faster generation.'],
                    ].map(([icon, title, desc]) => (
                      <div key={title} className="help-adv-practice-card">
                        <div className="help-adv-practice-icon">{icon}</div>
                        <h4 style={{ color: '#fff', fontSize: '0.88rem', letterSpacing: '0.04em' }}>{title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{desc}</p>
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

// ── Shared info panel component ──────────────────────────────────────────────
function HelpInfoPanel({ sel }) {
  return (
    <div className="help-adv-layout" style={{ padding: 0 }}>
      <div className="help-adv-hero" style={{ marginBottom: '24px' }}>
        <div className="help-adv-hero-content">
          <h2 className="help-adv-hero-title" style={{ fontSize: '1.6rem' }}>
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
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px 24px', marginTop: '24px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sel.details.map(([label, value], i) => (
              <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--tab-color)', minWidth: '120px', flexShrink: 0 }}>{label}:</strong>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="help-adv-note" style={{ marginTop: '16px' }}>
        <strong>Tip: </strong>{sel.tip}
      </div>
    </div>
  );
}
export default CustomPropsHelpModal;
