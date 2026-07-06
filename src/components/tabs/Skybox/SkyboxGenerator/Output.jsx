/**
 * SkyboxGenerator_Output.jsx — Sektion 05: Output
 *
 * TAB-CONTRACT §4: Rein präsentational — keine Hooks, kein IPC, kein State.
 * Bündelt: Lua-Vorschau, Export-Optionen, Generate-Button, Summary-Badges.
 *
 * Props (alle aus outputProps im Parent):
 *   mapName, mapsFolderPath
 *   exportRawScmskybox, setExportRawScmskybox
 *   generateReadme, setGenerateReadme
 *   onExportScmskybox, onInjectSkybox
 *   previewJson       — live berechneter Lua-/JSON-String (readonly)
 *   planets           — Array, für Summary
 *   cirrusLayers      — Array, für Summary
 *   numStars          — String, für Summary
 *   stParsedUvs       — Array (parsed UV rows), für Summary
 */
import React from 'react';

// ── Hilfsfunktion: ersten N Zeichen des Previews kürzen ──────────
const MAX_PREVIEW = 2800;

const Output = ({
  mapName,
  mapsFolderPath,
  exportRawScmskybox,
  setExportRawScmskybox,
  generateReadme,
  setGenerateReadme,
  onExportScmskybox,
  onInjectSkybox,
  previewJson = '',
  planets = [],
  cirrusLayers = [],
  numStars = '0',
  stParsedUvs = [],
}) => {
  const ready = !!(mapName?.trim() && mapsFolderPath?.trim());
  const previewTrunc = previewJson.length > MAX_PREVIEW
    ? previewJson.slice(0, MAX_PREVIEW) + '\n  … (truncated)'
    : previewJson;

  return (
    <div className="skybox-section-stack">

      {/* ── Summary ─────────────────────────────────────────────── */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Configuration Summary</h2>

        <div className="sb-out-summary-grid">
          <div className="sb-out-badge">
            <span className="sb-out-badge-label">Planets</span>
            <span className="sb-out-badge-value">{planets.length}</span>
          </div>
          <div className="sb-out-badge">
            <span className="sb-out-badge-label">Stars</span>
            <span className="sb-out-badge-value">{numStars}</span>
          </div>
          <div className="sb-out-badge">
            <span className="sb-out-badge-label">UV Rows</span>
            <span className="sb-out-badge-value">{stParsedUvs.length}</span>
          </div>
          <div className="sb-out-badge">
            <span className="sb-out-badge-label">Cirrus Layers</span>
            <span className="sb-out-badge-value">{cirrusLayers.length}</span>
          </div>
          <div className={`sb-out-badge ${ready ? 'sb-out-badge--ok' : 'sb-out-badge--warn'}`}>
            <span className="sb-out-badge-label">Map</span>
            <span className="sb-out-badge-value">{ready ? 'Ready' : 'Not set'}</span>
          </div>
        </div>

        {!ready && (
          <p className="skybox-form-help sb-out-hint">
            Set <strong>Map Name</strong> and <strong>Maps Folder</strong> in the Atmosphere section to enable generation.
          </p>
        )}
      </div>

      {/* ── Lua Preview ─────────────────────────────────────────── */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Lua Preview</h2>
        <p className="skybox-form-help" style={{ marginBottom: '10px' }}>
          Read-only preview of the <code>skyBox</code> block that will be written into <code>data.lua</code>.
          The first {MAX_PREVIEW.toLocaleString()} characters are shown.
        </p>
        <pre className="sb-out-lua-preview">
          {previewTrunc || '— configure Atmosphere, Cirrus, Planets, and Stars to generate a preview —'}
        </pre>
      </div>

      {/* ── Export Options ──────────────────────────────────────── */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Export Options</h2>

        <label className="sb-out-check-row">
          <span className="checkbox">
            <input
              type="checkbox"
              checked={!!exportRawScmskybox}
              onChange={e => setExportRawScmskybox(e.target.checked)}
            />
            <span className="checkbox-check">
              <svg viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </span>
          <span className="checkbox-label">
            Export raw <code>.scmskybox</code> JSON alongside .scmap inject
          </span>
        </label>

        <label className="sb-out-check-row" style={{ marginTop: '10px' }}>
          <span className="checkbox">
            <input
              type="checkbox"
              checked={!!generateReadme}
              onChange={e => setGenerateReadme(e.target.checked)}
            />
            <span className="checkbox-check">
              <svg viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </span>
          <span className="checkbox-label">Generate README file</span>
        </label>
      </div>

      {/* ── Generate ────────────────────────────────────────────── */}
      <div className="skybox-section-card">
        <h2 className="skybox-section-title">Generate</h2>

        <div className="sb-out-actions">
          {/* Secondary: export raw .scmskybox only */}
          <button
            className="action-button action-button--full"
            onClick={onExportScmskybox}
            disabled={!ready}
            title={ready ? 'Export skyBox JSON as .scmskybox file' : 'Map Name and Maps Folder required'}
          >
            Export .scmskybox
          </button>

          {/* Primary: inject into .scmap */}
          <button
            className={`commit-button${ready ? '' : ' commit-button--disabled'}`}
            onClick={ready ? onInjectSkybox : undefined}
            disabled={!ready}
            aria-label="Inject skybox into .scmap"
            title={ready ? 'Inject skyBox into data.lua inside .scmap' : 'Map Name and Maps Folder required'}
          >
            <span className="commit-button-label">
              {ready ? 'Generate Skybox → .scmap' : 'Not Ready'}
            </span>
          </button>
        </div>

        <p className="skybox-form-help sb-out-hint" style={{ marginTop: '12px' }}>
          Inject unpacks the <code>.scmap</code>, replaces only the <code>skyBox</code> block in <code>data.lua</code>,
          and repacks — all other map data is preserved. Close FA before running inject.
        </p>
      </div>

    </div>
  );
};

export default Output;
