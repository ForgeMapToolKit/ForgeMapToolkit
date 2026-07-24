import React from 'react';
import { DropSlot, ToggleSwitch } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/* ── CHANNEL_DEFS — the fixed, honest input contract ──────────────────
   Gaea produces these; FMT trusts them and reads them literally. No
   pseudo-physics, no hand-tuned curves — the meaning of each channel is
   whatever Gaea's simulation actually computed. */

const CHANNEL_DEFS = [
  { key: 'slope',      label: 'Slope', idleText: 'Optional — falls back to the real heightmap slope if a map is loaded' },
  { key: 'flow',       label: 'Flow Accumulation' },
  { key: 'curvature',  label: 'Curvature' },
  { key: 'deposition', label: 'Deposition / Sediment' },
];

function ChannelSlot({ def, channel, onUpload, onClear, onToggleInvert }) {
  return (
    <div className="ctrl-field re-channel-slot">
      <div className="ctrl-label">{def.label}</div>
      <DropSlot
        acceptInput="image/*"
        status={channel ? 'done' : 'idle'}
        idleText={def.idleText || 'Click or drop a greyscale mask'}
        doneText={channel ? `${channel.width} × ${channel.height} px` : undefined}
        onChange={onUpload}
        onClear={onClear}
      />
      {channel && (
        <ToggleSwitch
          className="re-channel-invert"
          label="Invert"
          value={!!channel.invert}
          onChange={onToggleInvert}
        />
      )}
    </div>
  );
}

export default function RockErosionChannels({
  channels, onChannelUpload, onChannelClear, onToggleInvert,
  heightmap, onHeightmapUpload, onHeightmapClear,
}) {
  return (
    <div className="ctrl-col">

      <div className="ctrl-block">
        <div className="ctrl-subtitle">Erosion Channels</div>
        <div className="ctrl-content">
          <div className="re-channel-grid">
            {CHANNEL_DEFS.map(def => (
              <ChannelSlot
                key={def.key}
                def={def}
                channel={channels[def.key]}
                onUpload={(file) => onChannelUpload(def.key, file)}
                onClear={() => onChannelClear(def.key)}
                onToggleInvert={() => onToggleInvert(def.key)}
              />
            ))}
          </div>

          <div className="trace-subsection" style={{ marginTop: 'var(--space-xl)' }}>Heightmap</div>
          <div className="ctrl-field re-channel-slot" style={{ marginTop: 'var(--space-sm)' }}>
            <DropSlot
              acceptInput="image/*"
              status={heightmap ? 'done' : 'idle'}
              idleText="Click or drop the map's heightmap"
              doneText={heightmap ? `${heightmap.width} × ${heightmap.height} px` : undefined}
              onChange={onHeightmapUpload}
              onClear={onHeightmapClear}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
