import React from 'react';
import RotationDial from './RotationDial.jsx';
import { QUARTER_TURNS, normalizeAngle, isQuarterTurn, coverage } from './angles.js';

/**
 * Section 01 — pick the map and the angle.
 *
 * Presentational only: every value and setter comes from MapRotator.jsx.
 */
const Configuration = ({
  mapName, setMapName,
  angle, setAngle,
  angleDraft, setAngleDraft,
  mapInfo, scmapError, running,
}) => {
  const a       = normalizeAngle(angle);
  const quarter = isQuarterTurn(a);
  const lost    = (1 - coverage(a)) * 100;

  const commitDraft = () => {
    const parsed = parseFloat(angleDraft);
    if (!Number.isFinite(parsed)) { setAngleDraft(String(a)); return; }
    const next = normalizeAngle(parsed);
    setAngle(next);
    setAngleDraft(String(next));
  };

  return (
    <div className="ctrl-col">

      {/* ── Map ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Map</div>
        <div className="ctrl-content">
          <div className="ctrl-field">
            <div className="ctrl-label">Map Name</div>
            <input
              className="ctrl-input"
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              placeholder="Hades_Dust.v0002"
              disabled={running}
            />
          </div>
          {mapInfo?.ok && !scmapError && (
            <div className="mrot-mapline">
              <span className="mrot-mapline-key">Grid</span>
              <span className="mrot-mapline-val">{mapInfo.mapSize} × {mapInfo.mapSize}</span>
              <span className="mrot-mapline-key">Size</span>
              <span className="mrot-mapline-val">{mapInfo.km}</span>
            </div>
          )}

          {/* The save.lua read can succeed on a map whose .scmap holds no terrain —
              FAF's co-op placeholders are the usual case. Say so here rather than
              letting the run fail halfway through. */}
          {mapInfo?.ok && scmapError && (
            <div className="mrot-note mrot-note--warn">{scmapError}</div>
          )}
        </div>
      </div>

      {/* ── Angle ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Rotation</div>
        <div className="ctrl-content">

          <div className="mrot-turn-grid">
            {QUARTER_TURNS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`station mrot-turn-btn${a === opt.value ? ' active' : ''}`}
                onClick={() => { if (!running) { setAngle(opt.value); setAngleDraft(String(opt.value)); } }}
                disabled={running}
                title={`Rotate the map ${opt.value}° clockwise — lossless`}
              >
                <span className="mrot-turn-value">{opt.label}</span>
                <span className="mrot-turn-desc">{opt.desc}</span>
              </button>
            ))}
          </div>

          <div className="ctrl-field mrot-angle-field">
            <div className="ctrl-label">Custom Angle — degrees clockwise</div>
            <input
              className="ctrl-input"
              type="number"
              step="1"
              min="-359"
              max="359"
              value={angleDraft}
              onChange={e => setAngleDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={e => { if (e.key === 'Enter') commitDraft(); }}
              placeholder="90"
              disabled={running}
            />
          </div>

          <RotationDial angle={a} />

          {a === 0 && (
            <div className="mrot-note mrot-note--warn">
              0° is not a rotation — pick an angle before running.
            </div>
          )}

          {!quarter && a !== 0 && (
            <div className="mrot-note mrot-note--warn">
              <strong>{a}° is not a quarter turn.</strong> Every raster — heightmap,
              terrain types, texture masks, water masks — has to be resampled, so the
              terrain softens slightly. About <strong>{lost.toFixed(1)}%</strong> of the
              map rotates outside the frame and is lost; the matching corners inside
              the frame are filled by extending the border outwards. Markers, props and
              decals are exact at any angle — only the rasters pay.
            </div>
          )}

          {quarter && a !== 0 && (
            <div className="mrot-note mrot-note--ok">
              Quarter turn — every raster is rotated by index, so nothing is
              interpolated and nothing is clipped. Rasters come out
              byte-identical; positions and orientations are exact.
            </div>
          )}

        </div>
      </div>

    </div>
  );
};

export default Configuration;
