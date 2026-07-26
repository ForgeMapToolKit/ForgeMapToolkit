import React from 'react';
import { SYMMETRY_VERDICT_LABEL, symmetryModeById } from '../../../Shared/MapLogic';

/**
 * Symmetry Checker · Section 02 — Findings.
 * Presentational: one row per layer with its verdict; the selected row opens its
 * deviation numbers and worst offenders.
 */

// Modifier classes are looked up rather than interpolated (`sy-row--${v}`) so
// every className stays a complete literal — design-lint cannot resolve a class
// name that is half template expression, and reports the stub as an orphan.
const VERDICT_CLASS = {
  pass: 'sy-verdict--pass', near: 'sy-verdict--near',
  fail: 'sy-verdict--fail', skip: 'sy-verdict--skip',
};
const ROW_CLASS = {
  pass: 'sy-row--pass', near: 'sy-row--near',
  fail: 'sy-row--fail', skip: 'sy-row--skip',
};

const pctOf = (v) => {
  if (!v) return '0%';
  const p = v * 100;
  return p < 0.01 ? '<0.01%' : `${p.toFixed(2)}%`;
};

export default function SymmetryFindings({
  findings, selectedLayer, onSelectLayer,
  activeMode, overallVerdict, checkedCount, failingCount, hasMap,
}) {
  if (!hasMap) {
    return (
      <div className="ctrl-col">
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Findings</div>
          <div className="ctrl-content">
            <div className="sy-empty">Run a check on the Configuration step first.</div>
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
          <div className={`sy-verdict ${VERDICT_CLASS[overallVerdict] || ''}`}>
            <span className="sy-verdict-word">{SYMMETRY_VERDICT_LABEL[overallVerdict]}</span>
            <span className="sy-verdict-note">
              {failingCount
                ? `${failingCount} of ${checkedCount} checked layers break ${symmetryModeById(activeMode).short} symmetry`
                : `all ${checkedCount} checked layers hold ${symmetryModeById(activeMode).short} symmetry`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Layers ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Layers</div>
        <div className="ctrl-content">
          <div className="sy-rows">
            {findings.map(f => {
              const open = selectedLayer === f.id;
              return (
                <div key={f.id} className={`sy-row ${ROW_CLASS[f.verdict] || ''}${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="sy-row-head"
                    onClick={() => onSelectLayer(open ? null : f.id)}
                    aria-expanded={open}
                  >
                    <span className="sy-row-tick" aria-hidden="true" />
                    <span className="sy-row-label">{f.label}</span>
                    <span className="sy-row-verdict">{SYMMETRY_VERDICT_LABEL[f.verdict]}</span>
                    <span className="sy-row-ratio">
                      {f.stats?.ratio != null ? pctOf(f.stats.ratio) : '—'}
                    </span>
                  </button>

                  <div className="sy-row-headline">{f.headline}</div>

                  {open && (
                    <div className="sy-row-body">
                      <div className="sy-row-why">{f.why}</div>
                      {f.stats && (
                        <div className="sy-meta">
                          <span>Compared <b>{f.stats.compared.toLocaleString()}</b></span>
                          <span>Off <b>{f.stats.mismatched.toLocaleString()}</b></span>
                          <span>
                            {f.kind === 'grid' ? 'Worst Δ' : 'Worst offset'}
                            {' '}<b>{f.kind === 'grid' ? f.stats.maxDelta : f.stats.maxDelta.toFixed(3)}</b>
                            {' '}{f.unit}
                          </span>
                        </div>
                      )}
                      {f.detail?.length > 0 && (
                        <ul className="sy-detail">
                          {f.detail.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      )}
                      {f.entity?.unpaired?.length > 0 && (
                        <ul className="sy-detail">
                          {f.entity.unpaired.slice(0, 8).map((u, i) => (
                            <li key={i}>
                              <b>{u.label}</b> at {u.position[0].toFixed(1)}, {u.position[2].toFixed(1)}
                              {u.expected && <> — nothing at {u.expected.x.toFixed(1)}, {u.expected.z.toFixed(1)}</>}
                            </li>
                          ))}
                          {f.entity.unpaired.length > 8 && (
                            <li>…and {(f.entity.unpaired.length - 8).toLocaleString()} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
