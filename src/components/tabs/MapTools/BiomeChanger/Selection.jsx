import React from 'react';
import { BIOME_CHANNELS } from '../../../Shared/MapLogic';

/**
 * BiomeChanger · Section 02 — Biome.
 * The preset grid plus the channel switches. Two blocks, both peer weight (§3):
 * "which biome" and "how much of it".
 *
 * Each preset card states its own coverage, so a preset that is only half filled
 * in biomePresets.js says so instead of quietly doing less than it looks like.
 */
export default function BiomeSelection({
  presets, presetId, onSelect,
  coverage, problems,
  channels, onChannel,
  skyboxUnavailable,
  adoptScales, onAdoptScales,
}) {
  return (
    <div className="ctrl-col">
      {/* ── Preset ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Preset</div>
        <div className="ctrl-content">
          <div className="bc-preset-grid">
            {presets.map((p) => {
              const cov = p.cov;
              const empty = cov.isEmpty;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`station bc-preset${p.id === presetId ? ' active' : ''}${empty ? ' bc-preset--empty' : ''}`}
                  onClick={() => onSelect(p.id)}
                  title={p.blurb}
                >
                  <span className="bc-preset-swatch" aria-hidden="true">
                    {(p.swatch || []).slice(0, 3).map((hex, i) => (
                      <i key={i} style={{ background: hex }} />
                    ))}
                  </span>
                  <span className="bc-preset-label">{p.label}</span>
                  <span className="bc-preset-state">
                    {empty ? 'skeleton' : `${cov.filledCount}/${BIOME_CHANNELS.length} channels`}
                  </span>
                </button>
              );
            })}
          </div>

          {problems.length > 0 && (
            <div className="bc-error">
              <b>This preset has {problems.length} problem(s)</b> — fix them in biomePresets.js:
              <ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Channels ── */}
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Channels</div>
        <div className="ctrl-content">
          {BIOME_CHANNELS.map((ch) => {
            const cov = coverage?.channels?.[ch.id];
            const blocked = ch.id === 'skybox' && skyboxUnavailable;
            const unfilled = !cov?.filled;
            return (
              <button
                key={ch.id}
                type="button"
                className={`ctrl-toggle-row bc-channel${channels[ch.id] ? ' on' : ''}${(unfilled || blocked) ? ' bc-channel--void' : ''}`}
                role="switch"
                aria-checked={!!channels[ch.id]}
                onClick={() => onChannel(ch.id, !channels[ch.id])}
              >
                <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
                <span className="ctrl-toggle-text">
                  <span className="ctrl-toggle-label">
                    {ch.label}
                    <i className="bc-channel-cov">
                      {blocked ? 'map has no skybox' : (cov?.detail ?? '—')}
                    </i>
                  </span>
                  <span className="ctrl-toggle-sub">{ch.hint}</span>
                </span>
              </button>
            );
          })}

          {/* Leise: tiling is authored per map, so adopting the preset's scales
              is opt-in rather than part of the textures channel. */}
          <button
            type="button"
            className={`ctrl-toggle-row bc-channel${adoptScales ? ' on' : ''}`}
            role="switch"
            aria-checked={!!adoptScales}
            onClick={() => onAdoptScales(!adoptScales)}
          >
            <span className="ctrl-toggle"><span className="ctrl-toggle-pole" /></span>
            <span className="ctrl-toggle-text">
              <span className="ctrl-toggle-label">Adopt preset tile scales</span>
              <span className="ctrl-toggle-sub">
                Off keeps this map&apos;s own tiling — safer, because scale is authored for the
                map&apos;s size. On takes the preset&apos;s scale values with the textures.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
