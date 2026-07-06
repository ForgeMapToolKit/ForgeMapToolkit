import React, { useState, useEffect, useRef, useCallback } from 'react';
import './CoopVersioner.css';
import CoopVersionerHelpModal from '../../HelpModals/CoopVersioner_help.jsx';

const api = window.electronAPI;

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CoopVersioner({ settings }) {
  const [mapFolderName, setMapFolderName] = useState('');
  const [mapVersion,    setMapVersion]    = useState('1');
  const [running,       setRunning]       = useState(false);
  const [progress,      setProgress]      = useState(null);
  const [result,        setResult]        = useState(null);
  const [log,           setLog]           = useState([]);
  const [helpOpen,      setHelpOpen]      = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    const unsub = api.on('coop-progress', ({ msg, percent }) => {
      setProgress({ msg, percent });
      setLog(prev => [...prev, msg]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const versionedName = mapFolderName.trim()
    ? `${mapFolderName.trim()}.v${String(parseInt(mapVersion, 10) || 1).padStart(4, '0')}`
    : '';

  const handleRun = useCallback(async () => {
    const name = mapFolderName.trim();
    if (!name) return;
    const ver = parseInt(mapVersion, 10);
    if (isNaN(ver) || ver < 1) return;

    setRunning(true);
    setResult(null);
    setLog([]);
    setProgress({ msg: 'Starting…', percent: 0 });

    try {
      const res = await api.invoke('coop-version-fix', { mapFolderName: name, mapVersion: ver });
      setResult(res);
      if (!res.ok) setLog(prev => [...prev, `❌ Error: ${res.error}`]);
    } catch (err) {
      setResult({ ok: false, error: err.message });
      setLog(prev => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setRunning(false);
    }
  }, [mapFolderName, mapVersion]);

  const handleReset = () => {
    setMapFolderName('');
    setMapVersion('1');
    setResult(null);
    setLog([]);
    setProgress(null);
  };

  const versionInt = parseInt(mapVersion, 10);
  const canRun = mapFolderName.trim().length > 0 && !isNaN(versionInt) && versionInt >= 1 && !running;

  return (
    <div className="coop-versioner">

      {helpOpen && <CoopVersionerHelpModal onClose={() => setHelpOpen(false)} />}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="cv-header">
        <div className="cv-header-row">
          <h2 className="cv-title">Co-Op Mission Versioner</h2>
          <button className="cv-help-btn" onClick={() => setHelpOpen(true)}>?</button>
        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────────── */}
      <div className="cv-form">
        <div className="cv-form-row">
          <div className="cv-field cv-field-wide">
            <label className="cv-label" htmlFor="cv-map-folder">Base map folder name</label>
            <input
              id="cv-map-folder"
              className="cv-input"
              type="text"
              placeholder="e.g.  SCCA_Coop_E01"
              value={mapFolderName}
              onChange={e => { setMapFolderName(e.target.value); setResult(null); }}
              disabled={running}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="cv-field cv-field-narrow">
            <label className="cv-label" htmlFor="cv-version">Target version</label>
            <input
              id="cv-version"
              className="cv-input cv-input-version"
              type="number"
              min="1"
              max="9999"
              value={mapVersion}
              onChange={e => { setMapVersion(e.target.value); setResult(null); }}
              disabled={running}
            />
          </div>
        </div>

        {versionedName && (
          <div className="cv-preview-row">
            <span className="cv-preview-label">Output folder:</span>
            <span className="cv-preview-value">{versionedName}</span>
          </div>
        )}

        <div className="cv-actions">
          <button className="cv-btn cv-btn-primary" onClick={handleRun} disabled={!canRun}>
            {running ? (
              <><span className="cv-spinner" />Processing…</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cv-btn-icon">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
                Generate Files
              </>
            )}
          </button>
          {(result || log.length > 0) && !running && (
            <button className="cv-btn cv-btn-ghost" onClick={handleReset}>Reset</button>
          )}
        </div>
      </div>

      {/* ── Progress ────────────────────────────────────────────────────────── */}
      {(running || progress) && (
        <div className="cv-progress-section">
          <div className="cv-progress-bar-track">
            <div className="cv-progress-bar-fill" style={{ width: `${progress?.percent ?? 0}%` }} />
          </div>
          <span className="cv-progress-msg">{progress?.msg ?? ''}</span>
        </div>
      )}

      {/* ── Result ──────────────────────────────────────────────────────────── */}
      {result && !running && (
        <div className={`cv-result-banner ${result.ok ? 'cv-result-ok' : 'cv-result-err'}`}>
          {result.ok ? (
            <>
              <span className="cv-result-icon">✓</span>
              <div className="cv-result-body">
                <strong>Done!</strong> Output folder: <code>{versionedName}</code>
                <span className="cv-result-stats">
                  {result.luaPatched} Lua file{result.luaPatched !== 1 ? 's' : ''} patched
                  &nbsp;·&nbsp;
                  {result.scmapPatched} .scmap file{result.scmapPatched !== 1 ? 's' : ''} rewritten
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="cv-result-icon">✕</span>
              <div className="cv-result-body"><strong>Error:</strong> {result.error}</div>
            </>
          )}
        </div>
      )}

      {/* ── Log ─────────────────────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div className="cv-log-section">
          <div className="cv-log-header">
            <span className="cv-log-title">Log</span>
            <button className="cv-log-clear" onClick={() => setLog([])}>✕</button>
          </div>
          <div className="cv-log-body" ref={logRef}>
            {log.map((line, i) => <div key={i} className="cv-log-line">{line}</div>)}
          </div>
        </div>
      )}

    </div>
  );
}
