import React, { useState } from 'react';
import { EntityCard, EntityCardGrid, AddTile, Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

const PREF_OPTIONS = [
  { value: 'ignore',     label: 'Ignore' },
  { value: 'preferLow',  label: 'Prefer Low' },
  { value: 'preferHigh', label: 'Prefer High' },
];

const CHANNEL_ROWS = [
  { key: 'slope',     label: 'Slope' },
  { key: 'flow',      label: 'Flow Accumulation' },
  { key: 'curvature', label: 'Curvature' },
];

/* ── ChannelPrefRow — one channel's Ignore/Prefer Low/Prefer High + Strength ── */

function ChannelPrefRow({ label, pref, hasChannel, onChange }) {
  const disabled = pref.mode === 'ignore';
  return (
    <div className="re-pref-row" onClick={e => e.stopPropagation()}>
      <span className="re-pref-label">{label}{!hasChannel && <span className="field-hint"> (no mask uploaded)</span>}</span>
      <Dropdown
        options={PREF_OPTIONS}
        value={pref.mode}
        onChange={(mode) => onChange({ ...pref, mode })}
        ariaLabel={`${label} preference`}
      />
      <input
        type="number" min="0" max="100"
        className="ctrl-input re-pref-strength"
        placeholder="50"
        disabled={disabled}
        value={pref.strength}
        onChange={(e) => onChange({ ...pref, strength: e.target.value })}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

/* ── RulePrefsBlock — the 3-channel preference block, open by default ──
   Unlike the collapsed-by-default toggle blocks elsewhere (Emitters,
   Grid Placement), this is a rule's primary configuration surface, so it
   starts open. */

function RulePrefsBlock({ rule, hasChannel, onUpdatePref }) {
  const [open, setOpen] = useState(true);
  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 'var(--space-xl)' }}>
      <div className="trace-subsection" onClick={() => setOpen(o => !o)}>
        Channel Preferences
      </div>
      {open && (
        <div style={{ marginTop: 'var(--space-sm)' }}>
          {CHANNEL_ROWS.map(row => (
            <ChannelPrefRow
              key={row.key}
              label={row.label}
              pref={rule.channelPrefs[row.key]}
              hasChannel={hasChannel(row.key)}
              onChange={(next) => onUpdatePref(row.key, next)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RockErosionRules({
  rules, selectedRule, setSelectedRule,
  availableColors, showColorPicker, setShowColorPicker,
  hasChannel,
  deleteAllRules, addRule, deleteRule, updateRule, updateChannelPref,
  updateBlueprintPath, deleteBlueprintPath, onOpenBlueprintLibrary,
}) {
  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Placement Rules</div>
        <div className="ctrl-content">

          {rules.length >= 1 && (
            <div className="ctrl-action-row" style={{ justifyContent: 'flex-end' }}>
              <button className="ctrl-btn-danger" onClick={deleteAllRules}>Delete All</button>
            </div>
          )}

          <EntityCardGrid>
            {rules.map((rule, idx) => (
              <EntityCard
                key={rule.id}
                index={idx}
                color={rule.color}
                selected={idx === selectedRule}
                onSelect={() => setSelectedRule(idx)}
                onDelete={() => deleteRule(idx)}
                title={rule.name ? rule.name.toUpperCase() : `Rule ${idx + 1}`}
                availableColors={availableColors}
                showColorPicker={showColorPicker === idx}
                onToggleColorPicker={() => setShowColorPicker(showColorPicker === idx ? null : idx)}
                onPickColor={(color) => { updateRule(idx, 'color', color); setShowColorPicker(null); }}
              >
                {idx === selectedRule && (<>

                  {/* Name */}
                  <div className="ctrl-field">
                    <input
                      type="text"
                      className="ctrl-input ctrl-input--text"
                      value={rule.name}
                      onChange={(e) => updateRule(idx, 'name', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. Talus, Debris Trail, Boulder Field"
                    />
                  </div>

                  {/* Blueprint Paths */}
                  <div style={{ marginTop: 'var(--space-xl)' }} onClick={e => e.stopPropagation()}>
                    <div className="trace-subsection">Blueprint Paths</div>
                    <div className="ctrl-row-gap" style={{ marginTop: 'var(--space-sm)' }}>
                      {rule.blueprintPaths.map((path, pathIdx) => (
                        <div key={pathIdx} className="ctrl-row">
                          <input
                            type="text"
                            className="ctrl-input"
                            value={path}
                            onChange={(e) => updateBlueprintPath(idx, pathIdx, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="/env/Rocks/Rock01_prop.bp"
                          />
                          <button className="ctrl-btn-delete" onClick={() => deleteBlueprintPath(idx, pathIdx)}>×</button>
                        </div>
                      ))}
                    </div>
                    <div className="ctrl-action-row" style={{ marginTop: 'var(--space-sm)' }}>
                      <button className="ftr-preview-readmore" onClick={(e) => { e.stopPropagation(); onOpenBlueprintLibrary(idx); }}>Library</button>
                    </div>
                  </div>

                  {/* Channel Preferences */}
                  <RulePrefsBlock
                    rule={rule}
                    hasChannel={hasChannel}
                    onUpdatePref={(channelKey, next) => updateChannelPref(idx, channelKey, next)}
                  />

                  {/* Density / Diffusion */}
                  <div style={{ marginTop: 'var(--space-xl)' }} onClick={e => e.stopPropagation()}>
                    <div className="trace-subsection">Density &amp; Diffusion</div>
                    <div className="re-density-grid" style={{ marginTop: 'var(--space-sm)' }}>
                      <div className="ctrl-field">
                        <div className="ctrl-label">Density</div>
                        <input
                          type="number" min="0" max="100"
                          className="ctrl-input"
                          placeholder="100"
                          value={rule.density}
                          onChange={(e) => updateRule(idx, 'density', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="ctrl-field">
                        <div className="ctrl-label">Diffusion</div>
                        <input
                          type="number" min="0" max="100"
                          className="ctrl-input"
                          placeholder="0"
                          value={rule.diffusion}
                          onChange={(e) => updateRule(idx, 'diffusion', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  </div>

                </>)}
              </EntityCard>
            ))}
            <AddTile label="Add Placement Rule" onClick={addRule} />
          </EntityCardGrid>

        </div>
      </div>
    </div>
  );
}
