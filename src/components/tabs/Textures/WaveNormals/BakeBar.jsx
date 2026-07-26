import React from 'react';

/**
 * The bake action, docked to the bottom of the preview panel.
 *
 * It used to appear twice — once per section that happened to feel like a good
 * place for it — which meant the tab's loudest action was both duplicated and
 * only reachable by scrolling. The aside is the one surface that persists across
 * every rail step, so a single button lives here instead, physically attached to
 * the image it produces.
 *
 * The `stale` state is the other half of the point: it names which parameters
 * actually feed the pixels. Touch choppiness and the bar goes stale; touch the
 * foam target and it does not, because that one is solved from the bake that
 * already exists.
 */
export default function BakeBar({
  hasLayers, busy, stale, progress, error, elapsed, onBake,
}) {
  const status = busy
    ? `layer ${(progress?.slot ?? 0) + 1}/${progress?.total ?? 4} · ${progress?.label || ''}`
    : !hasLayers
      ? 'No bake yet'
      : stale
        ? 'Parameters changed since this bake'
        : `Up to date${elapsed ? ` · ${(elapsed / 1000).toFixed(1)} s` : ''}`;

  return (
    <div className={`wn-bakebar${stale && !busy ? ' is-stale' : ''}`}>
      {error && <div className="wn-error">{error}</div>}
      <button className="commit-button" onClick={onBake} disabled={busy} type="button">
        <span className="commit-button-label">
          {busy ? 'Baking…' : hasLayers ? 'Re-bake layers' : 'Bake layers'}
        </span>
        <span className="commit-button-status">{status}</span>
        <span className="commit-button-bloom" aria-hidden />
        <span className="commit-button-line" aria-hidden />
      </button>
    </div>
  );
}
