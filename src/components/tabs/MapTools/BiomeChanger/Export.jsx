import React from 'react';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/**
 * BiomeChanger · Section 05 — Output.
 *
 * The change list is the contract: every row here is something the patch actually
 * writes, and anything not listed is not touched. If the list is empty the button
 * stays cold — a biome that would change nothing must not report success.
 */
export default function BiomeExport({
  rows, ready, applying, applyMsg,
  newVersion, onNewVersion,
  onApply, error, presetLabel, problems, skyboxBlocked,
}) {
  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Change List</div>
        <div className="ctrl-content">
          {rows.length === 0 ? (
            <div className="bc-empty">
              Nothing queued. Either the preset is still empty, every channel is off, or the map
              already looks like this preset.
            </div>
          ) : (
            <div className="bc-changes">
              {rows.map(r => (
                <div className="bc-change" key={r.id}>
                  <span className="bc-change-label">{r.label}</span>
                  <span className="bc-change-detail">{r.detail}</span>
                </div>
              ))}
            </div>
          )}

          {problems?.length > 0 && (
            <div className="bc-error">Preset has {problems.length} structural problem(s) — see Biome ▸ Preset.</div>
          )}
          {skyboxBlocked && (
            <div className="bc-warn">
              The Skybox channel is on but this map has no skybox block (scmap v56). Turn the
              channel off, or the patch will be refused.
            </div>
          )}
          {error && <div className="bc-error">{error}</div>}

          <div className="bc-hint">
            Heightmap, stratum masks, markers, water level and terrain type are never touched —
            a biome changes how the map looks, not what it is.
          </div>
        </div>
      </div>

      <OutputChecklist
        ready={ready}
        onCommit={onApply}
        commitLabel={applying ? (applyMsg || 'Applying…') : `Rebuild as ${presetLabel || 'preset'}`}
        commitAriaLabel="Apply the selected biome preset to the map"
        notReadyText={applying ? '●' : 'Not Ready'}
        optionsLabel="Version"
        filesLabel="Apply"
        items={[
          {
            label: 'Create new version',
            sub: newVersion
              ? 'A new versioned folder (e.g. map.v0007) is created — the original is untouched.'
              : 'The existing map folder is overwritten in place. Back up first.',
            checked: newVersion,
            onToggle: () => !applying && onNewVersion(!newVersion),
          },
        ]}
      />
    </div>
  );
}
