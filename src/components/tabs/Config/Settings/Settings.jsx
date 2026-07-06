import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './Settings.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_OPTIONS = [
  { value: null,                label: 'Homepage (default)' },
  { value: 'emitter',          label: 'Emitter' },
  { value: 'wreckages',        label: 'Wreckages' },
  { value: 'props',            label: 'Props' },
  { value: 'treemap',          label: 'TreeMap' },
  { value: 'rockerosion',      label: 'Rock Erosion' },
  { value: 'civilians',        label: 'Civilians' },
  { value: 'stars',            label: 'Stars' },
  { value: 'skybox-generator', label: 'Skybox Generator' },
  { value: 'scmap',            label: 'SCMAP Editor' },
  { value: 'contributions',    label: 'Contributions' },
];

const MAP_SIZES = ['256', '512', '1024', '2048'];

const LOG_LEVEL_OPTIONS = [
  { value: 'all',   label: 'All' },
  { value: 'debug', label: 'Debug' },
  { value: 'info',  label: 'Info' },
  { value: 'error', label: 'Errors only' },
  { value: 'off',   label: 'Off' },
];

const ATMOSPHERE_QUALITY_OPTIONS = [
  { value: 'performant', label: 'Performant' },
  { value: 'fast',       label: 'Fast' },
];

const AUTOSAVE_INTERVAL_OPTIONS = [
  { value: 5,    label: '5 min'  },
  { value: 15,   label: '15 min' },
  { value: 30,   label: '30 min' },
  { value: 60,   label: '1 h'    },
  { value: 720,  label: '12 h'   },
  { value: 1440, label: '24 h'   },
  { value: 10080,label: '7 d'    },
];

// `process` is unavailable in the context-isolated renderer (and undefined
// under the Vite dev server, where it threw a ReferenceError on load). Guard
// it so module load never crashes; these are only first-run fallbacks — real
// paths arrive from settings-load via IPC.
const OS_USER =
  (typeof process !== 'undefined' && process.env)
    ? (process.env.USERNAME || process.env.USER || '')
    : '';

const DEFAULT_PATHS = {
  faInstallPath:    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Supreme Commander Forged Alliance',
  fafPath:          'C:\\ProgramData\\FAForever',
  mapsFolder:       `C:\\Users\\${OS_USER}\\Documents\\My Games\\Gas Powered Games\\Supreme Commander Forged Alliance\\maps`,
  backupFolder:     `C:\\Users\\${OS_USER}\\Documents\\My Games\\Gas Powered Games\\Supreme Commander Forged Alliance\\maps\\MapBackups`,
  emitterBpFolder:  'C:\\ForgeMapToolkit\\public\\emitter',
  customPropsFolder: '',
  skyboxAssetsFolder: '',
  skyboxFolderPath: '',
};

const SETTINGS_DEFAULTS = {
  mapName:               '',
  logLevel:              'all',
  defaultMapSize:        '512',
  generateReadme:        true,
  defaultDecimalCoords:  2,
  defaultDecimalHeading: 2,
  backupEnabled:         false,
  maxBackups:            20,
  maxWorkers:            4,
  maxParallelFileReads:  2,
  hardwareAccel:         true,
  devTools:              false,
  autosaveEnabled:       false,
  autosaveInterval:      15,
  autosaveMapName:       '',
  autosavePath:          '',
  autosaveVersioned:     false,
  autosaveLastRun:       null,
  defaultPackTogether:   true,
  autoOpenExportFolder:  false,
  ddsCacheSize:          200,
  scanOnStartup:         false,
  loadSkyboxPreviewsOnStart: true,
  cacheMaxAgeDays:       0,
  verboseIpc:            false,
  skyboxSaveMode:        'mapFolder',
  skyboxFolderPath:      '',
  contribSkyboxAutoSwitch: true,
  defaultMirrorMode:       'none',
  atmosphereQuality:       'performant',
  footerQuickLinks:        false,
  colorTheme:              'dark',
};

function applyDefaultPaths(s) {
  const out = { ...SETTINGS_DEFAULTS, ...s };
  for (const [key, def] of Object.entries(DEFAULT_PATHS)) {
    if (out[key] === undefined || out[key] === null) out[key] = def;
  }
  const required = ['faInstallPath','fafPath','mapsFolder','backupFolder','emitterBpFolder'];
  for (const key of required) {
    if (!out[key] || !out[key].trim()) out[key] = DEFAULT_PATHS[key];
  }
  return out;
}

// Donation channels — fill in `url` to activate a tile. An empty url renders
// the tile as LINK PENDING (disabled, coming-soon style).
const DONATION_CHANNELS = [
  { id: 'paypal',  index: '01', label: 'PayPal',          url: '', color: '#00A8E8', desc: 'One-time donation — quick and direct.' },
  { id: 'github',  index: '02', label: 'GitHub Sponsors', url: '', color: '#DB61A2', desc: 'One-time or recurring sponsorship via GitHub.' },
  { id: 'patreon', index: '03', label: 'Patreon',         url: '', color: '#FF424D', desc: 'Monthly support with development updates.' },
  { id: 'kofi',    index: '04', label: 'Ko-fi',           url: '', color: '#FF5E5B', desc: 'Buy me a coffee — no account needed.' },
];

const SECTIONS = [
  { id: 'paths',       index: '01', label: 'Game Paths',   desc: 'Install directories, FAForever data, gamedata libraries & custom asset folders.' },
  { id: 'autosave',    index: '02', label: 'Autosave',     desc: 'Automatically save the current map at regular intervals.' },
  { id: 'backup',      index: '03', label: 'Backup',       desc: 'Backup before any overwrite — covers .lua, .scmap and copy operations. Configurable folder and retention limit.' },
  { id: 'defaults',    index: '04', label: 'Defaults',     desc: 'Map size, start tab, mirror mode and pack behaviour.' },
  { id: 'appearance',  index: '05', label: 'Appearance',   desc: 'Light or dark interface theme.' },
  { id: 'export',      index: '06', label: 'Export',       desc: 'Format, README generation, decimal precision and post-export actions.' },
  { id: 'performance', index: '07', label: 'Performance',  desc: 'Worker threads, DDS cache, library scan policy and hardware acceleration.' },
  { id: 'developer',   index: '08', label: 'Developer',    desc: 'Log level, verbose IPC, log viewer, DevTools and factory reset.' },
  { id: 'donations',   index: '09', label: 'Donations',    desc: 'Support the development of ForgeMapToolkit — PayPal, GitHub, Patreon, Ko-fi.' },
];

// Keys that change without user intent — never counted as uncommitted changes.
const DIRTY_IGNORE_KEYS = new Set(['autosaveLastRun', 'firstRun']);

// ─── Live status readouts — shown in the ledger and the plate header ─────────
const REQUIRED_PATH_KEYS = ['faInstallPath', 'fafPath', 'mapsFolder'];

const intervalLabel = (min) => {
  const preset = AUTOSAVE_INTERVAL_OPTIONS.find(o => o.value === (min ?? 15));
  return preset ? preset.label.toUpperCase() : `${min} MIN`;
};

function sectionStatus(id, s) {
  switch (id) {
    case 'paths': {
      const total   = REQUIRED_PATH_KEYS.length;
      const set     = REQUIRED_PATH_KEYS.filter(k => s[k] && s[k].trim()).length;
      const missing = total - set;
      if (missing) return { text: `${set}/${total} SET · ${missing} MISSING`, tone: 'warn' };
      return { text: s.mapName ? `${total}/${total} SET · ${s.mapName.toUpperCase()}` : `${total}/${total} SET`, tone: 'ok' };
    }
    case 'autosave':
      return s.autosaveEnabled
        ? { text: `ON · ${intervalLabel(s.autosaveInterval)}`, tone: 'ok' }
        : { text: 'OFF', tone: 'dim' };
    case 'backup':
      return s.backupEnabled
        ? { text: `ON · ${(s.maxBackups ?? 20) > 0 ? `${s.maxBackups ?? 20} KEPT` : 'UNLIMITED'}`, tone: 'ok' }
        : { text: 'OFF', tone: 'dim' };
    case 'defaults': {
      const tab = TAB_OPTIONS.find(o => o.value === (s.startTab ?? null));
      const tabLabel = tab && tab.value ? tab.label.toUpperCase() : 'HOME';
      return { text: `${s.defaultMapSize || '512'} · ${(s.defaultMirrorMode || 'none').toUpperCase()} · ${tabLabel}`, tone: 'dim' };
    }
    case 'appearance':
      return { text: (s.colorTheme === 'light') ? 'LIGHT' : 'DARK', tone: 'dim' };
    case 'export':
      return { text: `${s.generateReadme !== false ? 'README' : 'NO README'} · ${s.defaultDecimalCoords ?? 2}/${s.defaultDecimalHeading ?? 2} DP`, tone: 'dim' };
    case 'performance':
      return { text: `${s.maxWorkers ?? 4} WORKERS · CACHE ${s.ddsCacheSize ?? 200}`, tone: 'dim' };
    case 'developer':
      return { text: `LOG ${(s.logLevel || 'all').toUpperCase()}${s.devTools ? ' · DEVTOOLS' : ''}`, tone: 'dim' };
    case 'donations': {
      const live = DONATION_CHANNELS.filter(c => c.url).length;
      return { text: live ? `${live} CHANNEL${live > 1 ? 'S' : ''}` : 'EXTERNAL LINKS', tone: 'dim' };
    }
    default:
      return { text: '', tone: 'dim' };
  }
}

// ─── Controls ─────────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange, label, sublabel }) => (
  <div
    className="stc-switch-row"
    role="switch"
    aria-checked={!!value}
    tabIndex={0}
    onClick={() => onChange(!value)}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!value); } }}
  >
    <div className={`stc-switch${value ? ' on' : ''}`}>
      <div className="stc-switch-pole" />
    </div>
    <div className="stc-switch-text">
      <div className="stc-switch-label">{label}</div>
      {sublabel && <div className="stc-switch-sub">{sublabel}</div>}
    </div>
  </div>
);

const ChipSelector = ({ options, value, onChange }) => (
  <div className="st-chip-row">
    {options.map(o => (
      <button
        key={String(o.value)}
        className={`st-chip ${value === o.value ? 'active' : ''}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const PathField = ({ label, sublabel, value, onChange, pickerTitle, optional = false }) => {
  const pick = async () => {
    const res = await window.electronAPI.invoke('settings-pick-folder', { title: pickerTitle || label });
    if (res.success) onChange(res.path);
  };
  const isSet = value && value.trim().length > 3;
  return (
    <div className="st-field">
      <div className="st-field-header">
        <label className="st-label">
          {label}
          {optional && <span className="st-optional-tag">optional</span>}
        </label>
        {sublabel && <span className="st-sublabel">{sublabel}</span>}
      </div>
      <div className="st-path-row">
        <div className="st-path-input-wrap">
          <input
            type="text"
            className={`st-path-input ${isSet ? 'is-set' : ''}`}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={optional ? 'Not set' : 'Required'}
            spellCheck={false}
          />
          {value && <span className={`st-status-dot ${isSet ? 'ok' : 'bad'}`} />}
        </div>
        <button className="st-settings-btn-ghost" onClick={pick}>Browse</button>
      </div>
    </div>
  );
};

const FileField = ({ label, sublabel, value, onChange, pickerTitle, filter, optional = false }) => {
  const pick = async () => {
    const res = await window.electronAPI.invoke('settings-pick-file', {
      title:   pickerTitle || label,
      filters: filter || [{ name: 'Executable', extensions: ['exe'] }],
    });
    if (res.success) onChange(res.path);
  };
  const isSet = value && value.trim().length > 3;
  return (
    <div className="st-field">
      <div className="st-field-header">
        <label className="st-label">
          {label}
          {optional && <span className="st-optional-tag">optional</span>}
        </label>
        {sublabel && <span className="st-sublabel">{sublabel}</span>}
      </div>
      <div className="st-path-row">
        <div className="st-path-input-wrap">
          <input
            type="text"
            className={`st-path-input ${isSet ? 'is-set' : ''}`}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={optional ? 'Not set' : 'Required'}
            spellCheck={false}
          />
          {value && <span className={`st-status-dot ${isSet ? 'ok' : 'bad'}`} />}
        </div>
        <button className="st-settings-btn-ghost" onClick={pick}>Browse</button>
      </div>
    </div>
  );
};

const DerivedPath = ({ label, path }) => path ? (
  <div className="st-derived-path">
    <span className="st-derived-label">{label}</span>
    <code>{path}\gamedata</code>
    <span className="st-derived-auto">auto</span>
  </div>
) : null;

const Divider = () => <div className="st-divider" />;

// Allows free typing (including clearing the field) — only commits on blur.
// Reverts to last valid value if left empty or invalid.
const NumericInput = ({ value, onChange, min, max, step, className }) => {
  const [raw, setRaw] = useState(String(value ?? ''));

  useEffect(() => { setRaw(String(value ?? '')); }, [value]);

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const clamped = min !== undefined && n < min ? min
                    : max !== undefined && n > max ? max
                    : n;
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value ?? ''));
    }
  };

  return (
    <input
      type="number"
      className={className ?? 'st-number-input'}
      min={min} max={max} step={step}
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
    />
  );
};

const openLogWindow = () => window.electronAPI.invoke('open-log-window');

// ─── Factory Reset button (needs confirm) ────────────────────────────────────
function FactoryResetButton() {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return (
    <button className="st-settings-btn-danger" onClick={() => setConfirm(true)}>
      Reset all settings to defaults
    </button>
  );
  return (
    <div className="st-factory-confirm">
      <span className="st-factory-warn">⚠ This cannot be undone — all paths will be cleared.</span>
      <div className="st-factory-actions">
        <button className="st-settings-btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
        <button className="st-settings-btn-danger" onClick={async () => {
          await window.electronAPI.invoke('settings-save', { ...SETTINGS_DEFAULTS, ...DEFAULT_PATHS, firstRun: true });
          window.location.reload();
        }}>Confirm Reset</button>
      </div>
    </div>
  );
}

// ─── Section content ──────────────────────────────────────────────────────────

const SectionContent = ({ id, settings, set, scanStatus, setScanStatus }) => {
  const canScan = !!(settings?.faInstallPath || settings?.fafPath);

  const handleScan = async () => {
    if (!canScan) return;
    setScanStatus('scanning');
    try {
      await window.electronAPI.invoke('settings-save', { ...settings, firstRun: false });
      const res = await window.electronAPI.invoke('library-scan');
      if (res.success) {
        setScanStatus({ emitters: res.counts.emitters, blueprints: res.counts.props, units: res.counts.units });
      } else {
        setScanStatus({ error: res.error || 'Scan failed' });
      }
    } catch (e) {
      setScanStatus({ error: e.message });
    }
  };

  // ── 01 Game Paths ────────────────────────────────────────────────────────────
  if (id === 'paths') return (
    <div className="st-content-stack">
      <PathField
        label="Supreme Commander Install Path"
        sublabel="Steam: …\steamapps\common\Supreme Commander Forged Alliance"
        value={settings.faInstallPath}
        onChange={v => set('faInstallPath', v)}
        pickerTitle="Select SC:FA Install Folder"
      />
      <DerivedPath label="Vanilla Gamedata" path={settings.faInstallPath} />
      <Divider />
      <PathField
        label="FAForever Data Path"
        sublabel="Usually C:\ProgramData\FAForever"
        value={settings.fafPath}
        onChange={v => set('fafPath', v)}
        pickerTitle="Select FAForever Data Folder"
      />
      <DerivedPath label="FAF Addon Gamedata" path={settings.fafPath} />
      <Divider />
      <PathField
        label="Maps Folder"
        sublabel="Folder containing all your SC:FA maps"
        value={settings.mapsFolder}
        onChange={v => set('mapsFolder', v)}
        pickerTitle="Select Maps Folder"
      />

      <Divider />

      {/* Active map — the project map name. Synced to every tab's map name field on save. */}
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Active Map</label>
          <span className="st-sublabel">Map folder name (e.g. Hades_Dust.v0002) — automatically fills every tab</span>
        </div>
        <input
          type="text"
          className={`st-path-input${settings.mapName ? ' is-set' : ''}`}
          placeholder="e.g. Hades_Dust.v0002"
          value={settings.mapName || ''}
          onChange={e => set('mapName', e.target.value)}
          spellCheck={false}
        />
        {settings.mapsFolder && settings.mapName && (
          <div className="st-derived-path" style={{ marginTop: 6 }}>
            <span className="st-derived-label">Map folder</span>
            <code>{settings.mapsFolder}\{settings.mapName}</code>
          </div>
        )}
      </div>

      <Divider />
      <FileField
        label="FAForever Map Editor"
        sublabel="Path to FAForeverMapEditor.exe — required for Preview Image generation"
        value={settings.editorPath}
        onChange={v => set('editorPath', v)}
        pickerTitle="Select FAForeverMapEditor.exe"
        filter={[{ name: 'Executable', extensions: ['exe'] }, { name: 'All Files', extensions: ['*'] }]}
        optional
      />

      <Divider />
      <div className="st-scan-block">
        <div className="st-scan-info">
          <div className="st-scan-title">Scan Gamedata Libraries</div>
          <div className="st-scan-desc">
            Reads both gamedata folders — vanilla .scd first, FAF addons on top.
            Builds emitter, blueprint and unit libraries used across all tabs.
          </div>
        </div>
        <button
          className={`st-settings-btn ${scanStatus === 'scanning' ? 'is-loading' : ''}`}
          onClick={handleScan}
          disabled={!canScan || scanStatus === 'scanning'}
        >
          {scanStatus === 'scanning'
            ? <><span className="st-spinner" /> Scanning…</>
            : 'Scan Libraries'}
        </button>
      </div>
      {scanStatus && scanStatus !== 'scanning' && (
        <div className={`st-scan-result ${scanStatus.error ? 'err' : 'ok'}`}>
          <span className="st-result-dot" />
          {scanStatus.error
            ? <>Scan failed: {scanStatus.error}</>
            : <>
                <strong>{scanStatus.emitters}</strong> emitters
                &ensp;·&ensp;<strong>{scanStatus.blueprints}</strong> blueprints
                &ensp;·&ensp;<strong>{scanStatus.units}</strong> units
                <span className="st-result-note">across both gamedata sources</span>
              </>
          }
        </div>
      )}
    </div>
  );

  // ── 02 Autosave ──────────────────────────────────────────────────────────────
  if (id === 'autosave') {
    const intervalIsPreset = AUTOSAVE_INTERVAL_OPTIONS.some(
      o => o.value === (settings.autosaveInterval ?? 15)
    );

    const [runBusy, setRunBusy] = React.useState(false);

    return (
      <div className="st-content-stack">
        <Toggle
          value={!!settings.autosaveEnabled}
          onChange={v => set('autosaveEnabled', v)}
          label="Enable Autosave"
          sublabel="Automatically copies the map folder at the chosen interval — works even when the app is closed"
        />

        {settings.autosaveEnabled && <>
          <Divider />

          {/* Map name */}
          <div className="st-field">
            <div className="st-field-header">
              <label className="st-label">Map Name</label>
              <span className="st-sublabel">Folder name inside Maps Folder to back up (e.g. Hades_Dust.v0002)</span>
            </div>
            <input
              type="text"
              className="st-path-input"
              placeholder="Hades_Dust.v0002"
              value={settings.autosaveMapName || ''}
              onChange={e => set('autosaveMapName', e.target.value)}
              spellCheck={false}
            />
            {settings.mapsFolder && settings.autosaveMapName && (
              <div className="st-derived-path" style={{ marginTop: 6 }}>
                <span className="st-derived-label">Source</span>
                <code>{settings.mapsFolder}\{settings.autosaveMapName}</code>
              </div>
            )}
          </div>

          <Divider />

          {/* Destination path */}
          <PathField
            label="Destination"
            sublabel="Folder where the map copy will be saved"
            value={settings.autosavePath || ''}
            onChange={v => set('autosavePath', v)}
            pickerTitle="Select Autosave Destination Folder"
          />
          {settings.autosavePath && settings.autosaveMapName && (
            <div className="st-derived-path">
              <span className="st-derived-label">Saves to</span>
              <code>
                {settings.autosavePath}\
                {settings.autosaveVersioned
                  ? `${settings.autosaveMapName}_YYYY-MM-DDTHH-MM-SS`
                  : settings.autosaveMapName}
              </code>
              <span className="st-derived-auto">{settings.autosaveVersioned ? 'versioned' : 'overwrite'}</span>
            </div>
          )}

          <Divider />

          {/* Interval */}
          <div className="st-field">
            <div className="st-field-header">
              <label className="st-label">Interval</label>
              <span className="st-sublabel">How often the copy is made</span>
            </div>
            <ChipSelector
              options={AUTOSAVE_INTERVAL_OPTIONS}
              value={intervalIsPreset ? (settings.autosaveInterval ?? 15) : null}
              onChange={v => set('autosaveInterval', v)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span className="st-sublabel" style={{ whiteSpace: 'nowrap' }}>Custom (min):</span>
              <NumericInput
                min={1} max={99999}
                value={settings.autosaveInterval ?? 15}
                onChange={v => set('autosaveInterval', v)}
              />
            </div>
          </div>

          <Divider />

          <Toggle
            value={!!settings.autosaveVersioned}
            onChange={v => set('autosaveVersioned', v)}
            label="Versioned copies"
            sublabel="Each save gets a timestamp suffix — keeps history, uses more disk space"
          />

          <Divider />

          {/* Last run */}
          <div className="st-field">
            <div className="st-field-header">
              <label className="st-label">Last Autosave</label>
              <span className="st-sublabel">
                {settings.autosaveLastRun
                  ? new Date(settings.autosaveLastRun).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <button
              className={`st-settings-btn-ghost ${runBusy ? 'is-loading' : ''}`}
              disabled={runBusy}
              onClick={async () => {
                setRunBusy(true);
                await window.electronAPI.invoke('autosave-run-now');
                const updated = await window.electronAPI.invoke('settings-load');
                set('autosaveLastRun', updated.autosaveLastRun);
                setRunBusy(false);
              }}
            >
              ▶ Run Now
            </button>
          </div>

        </>}
      </div>
    );
  }

  // ── 03 Backup ────────────────────────────────────────────────────────────────
  if (id === 'backup') return (
    <div className="st-content-stack">
      <Toggle
        value={settings.backupEnabled}
        onChange={v => set('backupEnabled', v)}
        label="Backup before overwrite"
        sublabel="Creates a timestamped copy of any file before it is overwritten — covers .lua writes, .scmap pack and file copy operations"
      />
      {settings.backupEnabled && <>
        <Divider />
        <PathField
          label="Backup Folder"
          value={settings.backupFolder}
          onChange={v => set('backupFolder', v)}
          pickerTitle="Select Backup Folder"
        />
        <Divider />
        <div className="st-field">
          <div className="st-field-header">
            <label className="st-label">Max Backups Kept</label>
            <span className="st-sublabel">Per file name — oldest removed automatically when limit is reached · 0 = unlimited</span>
          </div>
          <NumericInput min={0} max={999}
            value={settings.maxBackups ?? 20}
            onChange={v => set('maxBackups', v)} />
        </div>
      </>}
    </div>
  );

  // ── 04 Defaults ──────────────────────────────────────────────────────────────
  if (id === 'defaults') return (
    <div className="st-content-stack">
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Default Map Size</label>
        </div>
        <ChipSelector
          options={MAP_SIZES.map(s => ({ value: s, label: s }))}
          value={settings.defaultMapSize || '512'}
          onChange={v => set('defaultMapSize', v)}
        />
      </div>
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Default Mirror Mode</label>
          <span className="st-sublabel">Pre-sets the mirror mode in the TreeMap tab</span>
        </div>
        <ChipSelector
          options={[
            { value: 'none',       label: 'None' },
            { value: 'diagonal',   label: 'Diagonal' },
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical',   label: 'Vertical' },
          ]}
          value={settings.defaultMirrorMode || 'none'}
          onChange={v => set('defaultMirrorMode', v)}
        />
      </div>
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Start Tab</label>
          <span className="st-sublabel">Which tab opens automatically on launch</span>
        </div>
        <div className="st-select-wrap">
          <select className="st-select" value={settings.startTab ?? ''}
            onChange={e => set('startTab', e.target.value || null)}>
            {TAB_OPTIONS.map(o => (
              <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
            ))}
          </select>
          <span className="st-select-arrow" />
        </div>
      </div>
      <Divider />
      <Toggle
        value={settings.defaultPackTogether !== false}
        onChange={v => set('defaultPackTogether', v)}
        label="Default Pack Together"
        sublabel="Pre-sets the Pack Together toggle when dropping a multi-prop folder"
      />
      <Divider />
      <Toggle
        value={settings.contribSkyboxAutoSwitch !== false}
        onChange={v => set('contribSkyboxAutoSwitch', v)}
        label="Auto-switch to Skybox Generator"
        sublabel="When loading a community skybox, automatically navigate to the Skybox Generator tab"
      />
      <Divider />
      <Toggle
        value={!!settings.footerQuickLinks}
        onChange={v => set('footerQuickLinks', v)}
        label="Footer Quick Links"
        sublabel="Skip the preview step — footer nav items open the full article directly"
      />
    </div>
  );

  // ── 05 Appearance ───────────────────────────────────────────────────────────
  if (id === 'appearance') return (
    <div className="st-content-stack">
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Interface Theme</label>
          <span className="st-sublabel">Switches the whole UI between the dark trace look and the light glacier palette</span>
        </div>
        <ChipSelector
          options={[
            { value: 'dark',  label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          value={settings.colorTheme || 'dark'}
          onChange={v => set('colorTheme', v)}
        />
      </div>
    </div>
  );

  // ── 06 Export ────────────────────────────────────────────────────────────────
  if (id === 'export') return (
    <div className="st-content-stack">
      <Toggle
        value={settings.generateReadme !== false}
        onChange={v => set('generateReadme', v)}
        label="Generate README on export"
        sublabel="Adds README.md with usage notes alongside exported files"
      />
      <Divider />
      <Toggle
        value={!!settings.autoOpenExportFolder}
        onChange={v => set('autoOpenExportFolder', v)}
        label="Auto-open export folder"
        sublabel="Opens the output folder in Windows Explorer after every export"
      />
      <Divider />
      <div className="st-inline-numbers">
        <div className="st-field">
          <div className="st-field-header">
            <label className="st-label">Decimal Places — Coords</label>
          </div>
          <div className="st-select-wrap">
            <select className="st-select"
              value={settings.defaultDecimalCoords ?? 2}
              onChange={e => set('defaultDecimalCoords', parseInt(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <span className="st-select-arrow" />
          </div>
        </div>
        <div className="st-field">
          <div className="st-field-header">
            <label className="st-label">Decimal Places — Heading</label>
          </div>
          <div className="st-select-wrap">
            <select className="st-select"
              value={settings.defaultDecimalHeading ?? 2}
              onChange={e => set('defaultDecimalHeading', parseInt(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <span className="st-select-arrow" />
          </div>
        </div>
      </div>
    </div>
  );

  // ── 07 Performance ───────────────────────────────────────────────────────────
  if (id === 'performance') return (
    <div className="st-content-stack">
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Home Atmosphere</label>
          <span className="st-sublabel">
            Volumetric haze behind the home screen. Performant — full effect with
            motion and depth (two layers, uses the GPU). Fast — a single static
            layer with no motion, for weaker machines.
          </span>
        </div>
        <ChipSelector
          options={ATMOSPHERE_QUALITY_OPTIONS}
          value={settings.atmosphereQuality || 'performant'}
          onChange={v => set('atmosphereQuality', v)}
        />
      </div>
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Max Worker Threads</label>
          <span className="st-sublabel">Higher = faster generation, more CPU usage</span>
        </div>
        <NumericInput min={1} max={32}
          value={settings.maxWorkers ?? 4}
          onChange={v => set('maxWorkers', v)} />
      </div>
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Max Parallel File Reads</label>
          <span className="st-sublabel">
            Concurrent file reads during gamedata scan — must be lower than worker threads or the UI will become unresponsive
            {(settings.maxParallelFileReads ?? 2) >= (settings.maxWorkers ?? 4) && (
              <span style={{color:'#fb923c', marginLeft:6, fontWeight:600}}>⚠ should be less than worker threads ({settings.maxWorkers ?? 4})</span>
            )}
          </span>
        </div>
        <NumericInput min={1} max={Math.max(1, (settings.maxWorkers ?? 4) - 1)}
          value={settings.maxParallelFileReads ?? 2}
          onChange={v => set('maxParallelFileReads', v)} />
      </div>
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">DDS Preview Cache Size</label>
          <span className="st-sublabel">Max DDS thumbnails held in memory — higher = smoother browsing, more RAM</span>
        </div>
        <NumericInput min={10} max={2000} step={10}
          value={settings.ddsCacheSize ?? 200}
          onChange={v => set('ddsCacheSize', v)} />
      </div>
      <Divider />
      <Toggle
        value={!!settings.scanOnStartup}
        onChange={v => set('scanOnStartup', v)}
        label="Scan library on startup"
        sublabel="Automatically re-scans gamedata when the app launches (respects cache age setting)"
      />
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Library Cache Max Age (days)</label>
          <span className="st-sublabel">Re-scan if cache is older than this — 0 = never expire</span>
        </div>
        <NumericInput min={0} max={365}
          value={settings.cacheMaxAgeDays ?? 0}
          onChange={v => set('cacheMaxAgeDays', v)} />
      </div>
      <Divider />
      <Toggle
        value={settings.hardwareAccel !== false}
        onChange={v => set('hardwareAccel', v)}
        label="Hardware Acceleration"
        sublabel="Disable only if you see GPU-related rendering glitches"
      />
      <Divider />
      <Toggle
        value={settings.loadSkyboxPreviewsOnStart !== false}
        onChange={v => set('loadSkyboxPreviewsOnStart', v)}
        label="Load Skybox Previews on Start"
        sublabel="Pre-loads skybox preview images when the Skybox Generator tab opens — disable to speed up initial load"
      />
    </div>
  );

  // ── 08 Developer ─────────────────────────────────────────────────────────────
  if (id === 'developer') return (
    <div className="st-content-stack">
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Log Level</label>
          <span className="st-sublabel">Controls verbosity of the application log</span>
        </div>
        <ChipSelector
          options={LOG_LEVEL_OPTIONS}
          value={settings.logLevel || 'all'}
          onChange={v => set('logLevel', v)}
        />
      </div>
      <Divider />
      <Toggle
        value={!!settings.verboseIpc}
        onChange={v => set('verboseIpc', v)}
        label="Verbose IPC Logging"
        sublabel="Logs every IPC call with full arguments — can produce a lot of output"
      />
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Application Log</label>
          <span className="st-sublabel">View all commands, processes and events in real time</span>
        </div>
        <button className="st-settings-btn-ghost" onClick={openLogWindow}>Show Log</button>
      </div>
      <Divider />
      <Toggle
        value={!!settings.devTools}
        onChange={v => set('devTools', v)}
        label="Open DevTools on Launch"
        sublabel="Auto-opens Chromium DevTools when the app starts"
      />
      <Divider />
      <div className="st-field">
        <div className="st-field-header">
          <label className="st-label">Factory Reset</label>
          <span className="st-sublabel">Resets all settings to their default values — paths will need to be re-entered</span>
        </div>
        <FactoryResetButton />
      </div>
    </div>
  );

  // ── 09 Donations ─────────────────────────────────────────────────────────────
  if (id === 'donations') return (
    <div className="st-content-stack">
      <p className="stc-donate-lede">
        ForgeMapToolkit is free and always will be. If it saves you hours of
        mapping work, you can support its development through any of these channels.
      </p>
      <div className="stc-donate-grid">
        {DONATION_CHANNELS.map((c, i) => {
          const live = !!c.url;
          return (
            <button
              key={c.id}
              className={`stc-donate-tile${live ? '' : ' is-pending'}`}
              style={{ '--don-color': c.color, '--don-i': i }}
              onClick={live ? () => window.electronAPI.invoke('open-external', c.url) : undefined}
              disabled={!live}
            >
              <div className="stc-donate-tick" aria-hidden="true" />
              <span className="stc-donate-index">{c.index}</span>
              <span className="stc-donate-label">{c.label.toUpperCase()}</span>
              <span className="stc-donate-desc">{c.desc}</span>
              <span className="stc-donate-action">{live ? 'OPEN ↗' : 'LINK PENDING'}</span>
            </button>
          );
        })}
      </div>
      <p className="stc-donate-note">
        Donations never unlock features — everything in the toolkit stays free for everyone.
      </p>
    </div>
  );

  return null;
};

// ─── Console rail — collapsed index strip, expands on hover or pin ────────────

const ConsoleRail = ({
  activeSection, onSelect, pinned, onTogglePin, booting,
  settings, dirtyCount, saved, onCommit, onDiscard,
}) => (
  <aside className={`stc-rail${pinned || booting ? ' stc-rail--open' : ''}`}>

    <button
      className="stc-rail-pin"
      onClick={onTogglePin}
      title={pinned ? 'Unpin rail' : 'Pin rail open'}
      aria-label={pinned ? 'Unpin rail' : 'Pin rail open'}
    >
      <span className={`stc-rail-pin-glyph${pinned ? ' pinned' : ''}`}>▸</span>
    </button>

    <nav className="stc-rail-slats">
      <button
        className={`stc-rail-slat${activeSection === null ? ' active' : ''}`}
        style={{ '--slat-i': 0 }}
        onClick={() => onSelect(null)}
      >
        <span className="stc-slat-tick" aria-hidden="true" />
        <span className="stc-slat-index">00</span>
        <span className="stc-slat-label">INDEX</span>
      </button>

      {SECTIONS.map((s, i) => {
        const status = sectionStatus(s.id, settings);
        return (
          <button
            key={s.id}
            className={`stc-rail-slat${activeSection === s.id ? ' active' : ''}`}
            style={{ '--slat-i': i + 1 }}
            onClick={() => onSelect(s.id)}
          >
            <span className="stc-slat-tick" aria-hidden="true" />
            <span className="stc-slat-index">{s.index}</span>
            <span className="stc-slat-label">{s.label.toUpperCase()}</span>
            {status.tone === 'warn' && <span className="stc-slat-warn" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>

    {/* Commit cell — dead while clean, glows when changes are pending */}
    <div className={`stc-commit${dirtyCount ? ' is-dirty' : ''}${saved ? ' is-saved' : ''}`}>
      <button
        className="stc-commit-btn"
        disabled={!dirtyCount}
        onClick={onCommit}
        title={dirtyCount ? `Commit ${dirtyCount} change${dirtyCount > 1 ? 's' : ''}` : 'No uncommitted changes'}
      >
        <span className="stc-commit-lamp" aria-hidden="true" />
        <span className="stc-commit-count">{saved ? '✓' : dirtyCount || '—'}</span>
        <span className="stc-commit-label">
          {saved ? 'COMMITTED' : dirtyCount ? `COMMIT ${dirtyCount} CHANGE${dirtyCount > 1 ? 'S' : ''}` : 'NO CHANGES'}
        </span>
      </button>
      {dirtyCount > 0 && !saved && (
        <button className="stc-commit-discard" onClick={onDiscard}>DISCARD</button>
      )}
    </div>

  </aside>
);

// ─── Ledger — state A: the status overview of all registers ──────────────────

const LedgerView = ({ settings, version, updateInfo, onCheckUpdate, onSelect }) => {
  const statuses  = SECTIONS.map(s => sectionStatus(s.id, settings));
  const warnCount = statuses.filter(st => st.tone === 'warn').length;

  return (
    <div className="stc-ledger">

      <header className="stc-ledger-head">
        <span className="stc-ledger-caption">CONFIGURATION — {SECTIONS.length} REGISTERS</span>
        <div className="stc-ledger-status">
          {version && <span className="stc-status-part">v{version}</span>}
          {warnCount > 0 && (
            <span className="stc-status-part warn">{warnCount} WARNING{warnCount > 1 ? 'S' : ''}</span>
          )}
          <button className="stc-status-part stc-status-link" onClick={onCheckUpdate}>
            {updateInfo === 'checking' ? 'CHECKING…'
              : updateInfo?.latestVersion ? `UPDATE v${updateInfo.latestVersion}`
              : 'CHECK UPDATE'}
          </button>
        </div>
      </header>

      <div className="stc-ghost" aria-hidden="true">SETTINGS</div>

      <div className="stc-ledger-rows">
        {SECTIONS.map((s, i) => {
          const status = statuses[i];
          return (
            <button
              key={s.id}
              className="stc-row"
              style={{ '--row-i': i }}
              onClick={() => onSelect(s.id)}
            >
              <span className="stc-row-tick" aria-hidden="true" />
              <span className="stc-row-index">{s.index}</span>
              <span className="stc-row-label">{s.label.toUpperCase()}</span>
              <span className="stc-row-desc">{s.desc}</span>
              <span className={`stc-row-status ${status.tone}`}>{status.text}</span>
              <span className="stc-row-trace" aria-hidden="true" />
            </button>
          );
        })}
      </div>

    </div>
  );
};

// ─── Section plate — state B: one register, printed like the banner ──────────

const SectionPlate = ({ section, settings, set, scanStatus, setScanStatus }) => {
  const status = sectionStatus(section.id, settings);
  return (
    <div className="stc-section">

      <div className="stc-section-eyebrow">CONFIGURATION — REGISTER {section.index}</div>

      <div className="stc-section-titlerow">
        <h2 className="stc-section-title">{section.label}</h2>
        <span className={`stc-row-status ${status.tone}`}>{status.text}</span>
      </div>

      {/* Trace filament — prints once under the title, banner grammar */}
      <div className="stc-section-trace" aria-hidden="true">
        <div className="stc-trace-line" />
        <div className="stc-trace-hot" />
      </div>

      <p className="stc-section-desc">{section.desc}</p>

      <div className="stc-section-content">
        <SectionContent
          key={section.id}
          id={section.id}
          settings={settings}
          set={set}
          scanStatus={scanStatus}
          setScanStatus={setScanStatus}
        />
      </div>

    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const RAIL_PIN_KEY = 'stc-rail-pinned';
const BOOT_MS      = 2200; // rail stays extended after mount, then retracts

const SettingsTab = ({ onSave, compact = false }) => {
  const [settings, setSettings]           = useState(null);
  const [baseline, setBaseline]           = useState(null);
  const [scanStatus, setScanStatus]       = useState(null);
  const [saved, setSaved]                 = useState(false);
  const [version, setVersion]             = useState('');
  const [updateInfo, setUpdateInfo]       = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [booting, setBooting]             = useState(true);
  const [railPinned, setRailPinned]       = useState(() => {
    try { return localStorage.getItem(RAIL_PIN_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    window.electronAPI.invoke('settings-load').then(s => {
      const loaded = applyDefaultPaths(s);
      setSettings(loaded);
      setBaseline(loaded);
    });
    window.electronAPI.invoke('settings-get-version').then(v => setVersion(v));
  }, []);

  // Boot: rail extends once with labels printed, then retracts.
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), BOOT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (settings?.logLevel) window.electronAPI.send('set-log-level', settings.logLevel);
  }, [settings?.logLevel]);

  // Live preview — theme flips instantly as the chip is toggled, independent
  // of Save/Discard. Mirrors the global apply in ForgeMapToolkit.jsx, which
  // re-asserts the committed value on mount / after a real save.
  useEffect(() => {
    document.documentElement.dataset.theme = settings?.colorTheme === 'light' ? 'light' : 'dark';
  }, [settings?.colorTheme]);

  const set = useCallback((key, val) =>
    setSettings(prev => ({ ...prev, [key]: val })), []);

  // Uncommitted changes — shallow diff against the last loaded/saved state.
  const dirtyCount = useMemo(() => {
    if (!settings || !baseline) return 0;
    const keys = new Set([...Object.keys(settings), ...Object.keys(baseline)]);
    let n = 0;
    for (const k of keys) {
      if (DIRTY_IGNORE_KEYS.has(k)) continue;
      if (settings[k] !== baseline[k]) n++;
    }
    return n;
  }, [settings, baseline]);

  const handleCommit = async () => {
    const updated = { ...settings, firstRun: false };
    await window.electronAPI.invoke('settings-save', updated);
    setBaseline(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
    onSave?.(updated);
  };

  const handleDiscard = () => setSettings(baseline);

  const handleTogglePin = () => {
    setRailPinned(p => {
      const next = !p;
      try { localStorage.setItem(RAIL_PIN_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const handleCheckUpdate = async () => {
    setUpdateInfo('checking');
    setUpdateInfo(await window.electronAPI.invoke('check-update'));
  };

  const currentSection = SECTIONS.find(s => s.id === activeSection);

  if (!settings) return <div className="st-loading">Loading settings…</div>;

  // First-run modal: focused path setup only — no rail, no ledger.
  if (compact) return (
    <div className="stc-firstrun">
      <SectionContent
        id="paths"
        settings={settings}
        set={set}
        scanStatus={scanStatus}
        setScanStatus={setScanStatus}
      />
      <div className="stc-firstrun-footer">
        <button className={`st-settings-btn ${saved ? 'saved' : ''}`} onClick={handleCommit}>
          {saved ? '✓  Saved' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="stc-root">

      <ConsoleRail
        activeSection={activeSection}
        onSelect={setActiveSection}
        pinned={railPinned}
        onTogglePin={handleTogglePin}
        booting={booting}
        settings={settings}
        dirtyCount={dirtyCount}
        saved={saved}
        onCommit={handleCommit}
        onDiscard={handleDiscard}
      />

      <main className="stc-plate">
        {currentSection ? (
          <SectionPlate
            key={currentSection.id}
            section={currentSection}
            settings={settings}
            set={set}
            scanStatus={scanStatus}
            setScanStatus={setScanStatus}
          />
        ) : (
          <LedgerView
            settings={settings}
            version={version}
            updateInfo={updateInfo}
            onCheckUpdate={handleCheckUpdate}
            onSelect={setActiveSection}
          />
        )}

        {updateInfo && updateInfo !== 'checking' && updateInfo.latestVersion && (
          <div className="st-update-banner">
            <span>Update v{updateInfo.latestVersion} available</span>
            <button className="st-settings-btn-ghost"
              onClick={() => window.electronAPI.invoke('open-external', updateInfo.downloadUrl)}>
              Download →
            </button>
          </div>
        )}
      </main>

      {/* Film grain — the same surface as banner and home screen */}
      <div className="stc-grain" aria-hidden="true" />

    </div>
  );
};

export default SettingsTab;
