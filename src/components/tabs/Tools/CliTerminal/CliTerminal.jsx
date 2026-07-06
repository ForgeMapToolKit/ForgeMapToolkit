import React, { useState, useEffect, useRef } from 'react';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout.jsx';
import './CliTerminal.css';

const RESOLUTIONS = [
  { label: '512',  w: 512,  h: 512  },
  { label: '1024', w: 1024, h: 1024 },
  { label: '2048', w: 2048, h: 2048 },
];

const SECTIONS = [
  {
    id:    'render',
    index: '01',
    label: 'Render Preview',
    desc:  'Render map preview image via FAF Map Editor. Registry keys are written automatically.',
  },
  {
    id:    'unpack',
    index: '02',
    label: 'Unpack SCMAP',
    desc:  'Unpack a .scmap binary to the working folder for inspection or manual editing.',
  },
  {
    id:    'pack',
    index: '03',
    label: 'Pack SCMAP',
    desc:  'Repack the working folder back into a .scmap file in the map directory.',
  },
];

const LINE_CLS = {
  stdout: 'cli-line--stdout',
  stderr: 'cli-line--stderr',
  info:   'cli-line--info',
  error:  'cli-line--error',
};

const CliTerminalTab = ({ settings }) => {
  const [activeSection, setActiveSection] = useState('render');
  const [mapName,      setMapName]      = useState(settings?.mapName ?? '');
  const [resolution,   setResolution]   = useState(RESOLUTIONS[1]);
  const [running,      setRunning]      = useState(false);
  const [lines,        setLines]        = useState([]);
  const logRef = useRef(null);

  // Auto-fill map name from settings once
  useEffect(() => {
    if (!mapName && settings?.mapName) setMapName(settings.mapName);
  }, [settings?.mapName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to streaming output from main process
  useEffect(() => {
    const unsub = window.electronAPI.on('cli-output', msg => {
      setLines(prev => [...prev, msg]);
    });
    return unsub;
  }, []);

  // Keep terminal scrolled to bottom
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const addLine = (type, text) =>
    setLines(prev => [...prev, { type, text, ts: Date.now() }]);

  const handleRun = async () => {
    const name = mapName.trim();
    if (!name || running) return;

    const section = SECTIONS.find(s => s.id === activeSection);
    setRunning(true);
    addLine('info', `━━━  ${section?.label ?? activeSection}  ━━━`);

    try {
      let result;

      if (activeSection === 'render') {
        result = await window.electronAPI.invoke('cli-run', {
          command: 'render',
          mapName: name,
          width:   resolution.w,
          height:  resolution.h,
        });

      } else if (activeSection === 'unpack') {
        result = await window.electronAPI.invoke('cli-run', {
          command: 'unpack',
          mapName: name,
        });

      } else if (activeSection === 'pack') {
        result = await window.electronAPI.invoke('cli-run', {
          command: 'pack',
          mapName: name,
        });
      }

      if (result && !result.success) {
        addLine('error', `✗  ${result.error ?? 'Command failed'}`);
      }
    } catch (e) {
      addLine('error', `✗  ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleAbort = async () => {
    await window.electronAPI.invoke('cli-abort');
    addLine('info', '  Aborted.');
    setRunning(false);
  };

  const editorPath = settings?.editorPath ?? '';
  const missing    = activeSection === 'render' && !editorPath;
  const canRun     = mapName.trim() && !missing;

  // ── Terminal panel (aside slot) ─────────────────────────────────────────────
  const terminalPanel = (
    <div className="cli-terminal-panel">
      <div className="cli-terminal-head">
        <span className="cli-terminal-label">OUTPUT</span>
        <button
          className="cli-clear-btn"
          onClick={() => setLines([])}
          disabled={running}
        >
          CLEAR
        </button>
      </div>
      <div className="cli-terminal-log" ref={logRef}>
        {lines.length === 0
          ? <span className="cli-line cli-line--ghost">No output yet — run a command.</span>
          : lines.map((l, i) => (
              <span key={i} className={`cli-line ${LINE_CLS[l.type] ?? 'cli-line--info'}`}>
                {l.text}
              </span>
            ))
        }
      </div>
    </div>
  );

  // ── Controls (left column) ──────────────────────────────────────────────────
  const controls = (
    <div className="ctrl-col">

      <div className="ctrl-block">
        <span className="ctrl-subtitle">Map</span>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <label className="ctrl-label">Map Name</label>
            <input
              className="ctrl-input ctrl-input--text"
              placeholder="e.g. MyMap.v0002"
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              disabled={running}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {activeSection === 'render' && (
        <div className="ctrl-block">
          <span className="ctrl-subtitle">Resolution</span>
          <div className="ctrl-content">
            <div className="cli-res-group">
              {RESOLUTIONS.map(r => (
                <button
                  key={r.w}
                  className={`cli-res-btn${resolution.w === r.w ? ' active' : ''}`}
                  onClick={() => setResolution(r)}
                  disabled={running}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {missing && (
        <div className="ctrl-block">
          <div className="ctrl-content">
            <p className="ctrl-mapinfo ctrl-mapinfo-err">
              Editor path not configured — set it under Settings → Game Paths.
            </p>
          </div>
        </div>
      )}

      <div className="ctrl-action-row" style={{ marginTop: 'var(--space-3xl)' }}>
        {running
          ? <button className="ftr-preview-readmore" onClick={handleAbort}>Abort</button>
          : (
              <button
                className="ftr-preview-readmore"
                onClick={handleRun}
                disabled={!canRun}
              >
                Run
              </button>
            )
        }
      </div>

    </div>
  );

  return (
    <div
      className="cli-theme tab-root"
      style={{
        '--tab-color':       'var(--cliterminal-color)',
        '--tab-glow':        'var(--cliterminal-glow)',
        '--tab-glow-strong': 'var(--cliterminal-glow-strong)',
      }}
    >
      <TabLayout
        sections={SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        layoutMode="x"
        controlsWidth="half"
        asideSlot={terminalPanel}
        asideCaption=""
        railStorageKey="cli-terminal-rail-pinned"
        navLabel="CLI commands"
        bootMs={0}
      >
        {controls}
      </TabLayout>
    </div>
  );
};

export default CliTerminalTab;
