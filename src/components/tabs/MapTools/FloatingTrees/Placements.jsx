import React from 'react';
import { severityClass, shortName } from './severity.js';

/**
 * Floating Trees · Section 03 — Placements.
 *
 * Two ways into the individual props. **By asset** is usually the faster fix:
 * the cause is normally one blueprint scattered by one brush stroke across
 * ground it does not fit, so swapping that asset for a smaller group — or a
 * single tree — clears every one of its placements at once. **Worst placements**
 * is the fallback for the handful that need visiting by hand.
 */
/**
 * Name only the side that exists. "0/12 floating" on a prop whose problem is a
 * buried trunk states a measurement of nothing and buries the real finding.
 */
const describe = (f) => [
  f.floatingObjects.length ? `${f.floatingObjects.length}/${f.objectCount} floating` : null,
  f.buriedObjects.length ? `${f.buriedObjects.length}/${f.objectCount} buried` : null,
].filter(Boolean).join(', ') || 'origin off terrain';

export default function FloatingTreesPlacements({
  hasScan, byBlueprint, findings, openFinding, onOpenFinding,
}) {
  if (!hasScan) {
    return (
      <div className="ctrl-col">
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Placements</div>
          <div className="ctrl-content">
            <div className="ft-empty">Run a scan on the Configuration step first.</div>
          </div>
        </div>
      </div>
    );
  }

  if (!findings.length) {
    return (
      <div className="ctrl-col">
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Placements</div>
          <div className="ctrl-content">
            <div className="ft-empty">
              Nothing to list — no prop exceeded the tolerance. Lower it on the
              Configuration step to see the marginal cases.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ctrl-col">

      {/* ── By asset ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">By Asset</div>
        <div className="ctrl-content">
          <div className="ft-rows">
            {byBlueprint.slice(0, 20).map(b => (
              <div key={b.path} className={`ft-row ft-row--static ${severityClass(Math.max(b.worstAir, b.worstSink))}`}>
                <span className="ft-row-tick" aria-hidden="true" />
                <span className="ft-row-label">{b.name}</span>
                <span className="ft-row-sub">
                  {b.affected.toLocaleString()} of {b.placements.toLocaleString()} placement(s)
                  {' · '}{b.objectCount} object{b.objectCount === 1 ? '' : 's'} each
                </span>
                <span className="ft-row-val">
                  {b.worstAir > 0 ? `+${b.worstAir.toFixed(2)}` : `−${b.worstSink.toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
          {byBlueprint.length > 20 && (
            <div className="ft-hint">…and {byBlueprint.length - 20} more, in the report.</div>
          )}
        </div>
      </div>

      {/* ── Worst placements ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Worst Placements</div>
        <div className="ctrl-content">
          <div className="ft-rows">
            {findings.slice(0, 25).map(f => {
              const open = openFinding === f.index;
              return (
                <div key={f.index} className={`ft-item ${severityClass(f.severity)}${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="ft-row ft-row--head"
                    onClick={() => onOpenFinding(open ? null : f.index)}
                    aria-expanded={open}
                  >
                    <span className="ft-row-tick" aria-hidden="true" />
                    <span className="ft-row-label">{f.name || shortName(f.path)}</span>
                    <span className="ft-row-sub">
                      {f.position[0].toFixed(0)}, {f.position[2].toFixed(0)}
                      {' · '}{describe(f)}
                      {!f.isGroup && ' · single mesh'}
                    </span>
                    <span className="ft-row-val">
                      {f.worstAir > 0 ? `+${f.worstAir.toFixed(2)}` : `−${f.worstSink.toFixed(2)}`}
                    </span>
                  </button>

                  {open && (
                    <div className="ft-item-body">
                      {f.anchorDrift && (
                        <div className="ft-row-why">
                          The prop origin itself sits {f.anchorOffset.toFixed(2)} units off the terrain
                          {' '}under it — this placement predates the current ground.
                        </div>
                      )}
                      <ul className="ft-detail">
                        {f.floatingObjects.slice(0, 8).map((o, k) => (
                          <li key={`f${k}`}>
                            <b>{o.name}</b> · {o.dist.toFixed(1)} from origin
                            {' → '}{o.airGap.toFixed(2)} of air{o.underwater && ' (under water)'}
                          </li>
                        ))}
                        {f.buriedObjects.slice(0, 4).map((o, k) => (
                          <li key={`b${k}`}>
                            <b>{o.name}</b> · {o.dist.toFixed(1)} from origin
                            {' → '}buried {o.sink.toFixed(2)}{o.underwater && ' (under water)'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {findings.length > 25 && (
            <div className="ft-hint">
              …and {(findings.length - 25).toLocaleString()} more, in the report.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
