import React from 'react';
import { FLOAT_VERDICT_LABEL } from '../../../Shared/MapLogic';
import { severityClass, shortName } from './severity.js';

/**
 * Floating Trees · Section 02 — Findings.
 *
 * The verdict, then the places to visit. Individual placements live one step
 * further on (Section 03) because that is the order the work happens in: a chain
 * of bad props along one cliff is one place to visit, not twenty coordinates to
 * copy down.
 */

// Looked up rather than interpolated (`ft-verdict--${v}`) so every className
// stays a complete literal — design-lint cannot resolve a half-template class
// name and reports the stub as an orphan.
const VERDICT_CLASS = {
  pass: 'ft-verdict--pass', near: 'ft-verdict--near',
  fail: 'ft-verdict--fail', skip: 'ft-verdict--skip',
};

export default function FloatingTreesFindings({
  hasScan, verdict, counts, hotspots,
  selectedHotspot, onSelectHotspot,
  tolerance, truncated, unresolved,
}) {
  if (!hasScan) {
    return (
      <div className="ctrl-col">
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Findings</div>
          <div className="ctrl-content">
            <div className="ft-empty">Run a scan on the Configuration step first.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ctrl-col">

      {/* ── Verdict ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Verdict</div>
        <div className="ctrl-content">
          <div className={`ft-verdict ${VERDICT_CLASS[verdict] || ''}`}>
            <span className="ft-verdict-word">{FLOAT_VERDICT_LABEL[verdict]}</span>
            <span className="ft-verdict-note">
              {counts.props
                ? `${counts.props.toLocaleString()} prop(s) do not sit on their ground — `
                  + `${counts.floatingObjects.toLocaleString()} object(s) in the air, `
                  + `${counts.buriedObjects.toLocaleString()} in the ground`
                : `every measured object sits within ${tolerance.toFixed(2)} units of the terrain beneath it`}
            </span>
          </div>

          {counts.props > 0 && (
            <div className="ft-meta">
              <span>Worst air <b>+{counts.worstAir.toFixed(2)}</b></span>
              <span>Worst sink <b>−{counts.worstSink.toFixed(2)}</b></span>
              <span>Hotspots <b>{hotspots.length}</b></span>
              {counts.anchorDrift > 0 && <span>Off terrain <b>{counts.anchorDrift}</b></span>}
            </div>
          )}

          {counts.anchorDrift > 0 && (
            <div className="ft-warn">
              {counts.anchorDrift} prop{counts.anchorDrift === 1 ? '' : 's'} sit off the terrain at
              {' '}their own origin — the ground was edited after they were placed. Re-drop those
              {' '}rather than reshaping the terrain.
            </div>
          )}

          {/* Neither cap nor blind spot is left silent: a truncated result set and
              an unreadable blueprint both make the counts a floor, not a total. */}
          {truncated > 0 && (
            <div className="ft-warn">
              {truncated.toLocaleString()} further flagged prop(s) were not returned — the scan caps
              {' '}its result set, so the counts above are a floor, not a total.
            </div>
          )}

          {unresolved?.length > 0 && (
            <div className="ft-warn">
              Not measured: {unresolved.slice(0, 3).map(m => `${shortName(m.path)} (${m.error})`).join(', ')}
              {unresolved.length > 3 && ` +${unresolved.length - 3} more`}
            </div>
          )}
        </div>
      </div>

      {/* ── Hotspots ── */}
      {hotspots.length > 0 && (
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Places to Visit</div>
          <div className="ctrl-content">
            <div className="ft-rows">
              {hotspots.slice(0, 40).map((h, i) => (
                <button
                  key={i}
                  type="button"
                  className={`ft-row ${severityClass(h.severity)}${selectedHotspot === i ? ' is-open' : ''}`}
                  onClick={() => onSelectHotspot(i)}
                  aria-pressed={selectedHotspot === i}
                >
                  <span className="ft-row-tick" aria-hidden="true" />
                  <span className="ft-row-label">{h.x.toFixed(0)}, {h.z.toFixed(0)}</span>
                  <span className="ft-row-sub">
                    {h.props} prop(s) · {h.objects} object(s) · {h.blueprints.slice(0, 2).join(', ')}
                    {h.blueprints.length > 2 && ` +${h.blueprints.length - 2}`}
                  </span>
                  <span className="ft-row-val">
                    {h.worstAir > 0 ? `+${h.worstAir.toFixed(2)}` : `−${h.worstSink.toFixed(2)}`}
                  </span>
                </button>
              ))}
            </div>
            {hotspots.length > 40 && (
              <div className="ft-hint">…and {hotspots.length - 40} more, in the report.</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
