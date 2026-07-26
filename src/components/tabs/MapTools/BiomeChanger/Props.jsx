import React from 'react';
import { Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import { PROP_POLICIES } from '../../../Shared/MapLogic';

/**
 * BiomeChanger · Section 04 — Props.
 *
 * The prop remap and, above it, the number that makes this section worth its own
 * rail step: the reclaim delta. Swapping a tree for a rock is an economy change,
 * not a paint job — on a competitive map that matters more than the look, so it is
 * stated before the apply button, never after.
 */
export default function BiomeProps({
  plan, enabled, policy, onPolicy, matchReclaim, onMatchReclaim,
  libraryScanned, hasBiome,
}) {
  const policyOptions = PROP_POLICIES.map(p => ({ value: p.id, label: p.label }));
  const delta = plan?.reclaimDelta ?? 0;
  const pct = plan?.reclaimFrom ? (100 * delta / plan.reclaimFrom) : 0;

  if (!hasBiome) {
    return (
      <div className="ctrl-col">
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Props</div>
          <div className="ctrl-content">
            <div className="bc-empty">Read a map in Configuration first.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ctrl-col">
      {/* ── Matching ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Matching</div>
        <div className="ctrl-content">
          {!enabled && (
            <div className="bc-empty">
              The Props channel is off — nothing here will be written. Turn it on in Biome ▸ Channels.
            </div>
          )}
          {!libraryScanned && (
            <div className="bc-warn">
              No scanned prop library. Run the library scan (Settings) so the tool knows which
              props the target family actually has — without it there is nothing to map onto.
            </div>
          )}

          <div className="ctrl-field">
            <div className="ctrl-label">Target family</div>
            <div className="bc-meta"><span><b>{plan?.family || '— preset names none —'}</b></span></div>
          </div>

          <div className="ctrl-field">
            <div className="ctrl-label">When the family has no prop of that type</div>
            <Dropdown options={policyOptions} value={policy} onChange={onPolicy} ariaLabel="Unmatched prop policy" />
          </div>

          <button
            type="button"
            className={`ctrl-toggle-row${matchReclaim ? ' on' : ''}`}
            role="switch"
            aria-checked={!!matchReclaim}
            onClick={() => onMatchReclaim(!matchReclaim)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Prefer similar reclaim</span>
              <span className="ctrl-toggle-sub">
                Lets reclaim mass break ties between candidates, so the map&apos;s economy moves
                as little as possible. Off picks the closest-looking prop instead.
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* ── Reclaim ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Reclaim Impact</div>
        <div className="ctrl-content">
          <div className="bc-reclaim">
            <div className="bc-reclaim-side">
              <span className="bc-reclaim-label">Before</span>
              <span className="bc-reclaim-value">{Math.round(plan?.reclaimFrom ?? 0).toLocaleString()}</span>
            </div>
            <div className={`bc-reclaim-delta${delta > 0 ? ' up' : delta < 0 ? ' down' : ''}`}>
              <span>{delta === 0 ? '±0' : `${delta > 0 ? '+' : ''}${Math.round(delta).toLocaleString()}`}</span>
              <i>{plan?.reclaimFrom ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : 'mass'}</i>
            </div>
            <div className="bc-reclaim-side">
              <span className="bc-reclaim-label">After</span>
              <span className="bc-reclaim-value">{Math.round(plan?.reclaimTo ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="bc-meta">
            <span>Remapped <b>{plan?.changedInstances ?? 0}</b> instances</span>
            <span>Blueprints <b>{plan?.rows?.filter(r => r.changed).length ?? 0}</b></span>
            <span>Left alone <b>{plan?.unmatched ?? 0}</b></span>
            {plan?.drop?.length ? <span>Removed <b>{plan.drop.length}</b></span> : null}
          </div>
          <div className="bc-hint">
            Totals cover only props the scan knows a reclaim value for; unknown ones count as zero.
          </div>
        </div>
      </div>

      {/* ── Plan ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Blueprint Map</div>
        <div className="ctrl-content">
          {!plan?.rows?.length ? (
            <div className="bc-empty">This map has no props.</div>
          ) : (
            <div className="bc-props">
              {plan.rows.map((r) => (
                <div className={`bc-prop${r.changed ? ' bc-prop--changed' : ''}${r.dropped ? ' bc-prop--dropped' : ''}`} key={r.from}>
                  <span className="bc-prop-count">×{r.count}</span>
                  <span className="bc-prop-name" title={r.from}>
                    {r.fromName}
                    <i>{r.fromFamily || '?'} · {r.type}</i>
                  </span>
                  <span className="bc-prop-arrow" aria-hidden="true">→</span>
                  <span className="bc-prop-name" title={r.to || ''}>
                    {r.dropped ? '(removed)' : (r.toName || '(unchanged)')}
                    <i>{r.note || (r.massFrom != null && r.massTo != null ? `mass ${Math.round(r.massFrom)} → ${Math.round(r.massTo)}` : '')}</i>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
