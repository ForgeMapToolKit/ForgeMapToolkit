import React from 'react';

/**
 * TerrainType · Section 03 — Output.
 * Run summary + the primary apply action (unpack → write → pack).
 */
export default function TerrainTypeExport({
  assignedCount, cellCount, threshold,
  applying, applyMsg, onApply, ready,
}) {
  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Summary</div>
        <div className="ctrl-content">
          <div className="tt-meta">
            <span>Assigned layers <b>{assignedCount}</b></span>
            <span>Grid cells <b>{cellCount ? cellCount.toLocaleString() : '—'}</b></span>
            <span>Threshold <b>{Math.round(threshold * 100)}%</b></span>
          </div>
        </div>
      </div>

      <div className="ctrl-block">
        <div className="ctrl-subtitle">Apply</div>
        <div className="ctrl-content">
          <button
            className="commit-button"
            disabled={!ready || applying}
            onClick={ready && !applying ? onApply : undefined}
            aria-label="Apply terrain types to map"
          >
            <span className="commit-button-label">{applying ? (applyMsg || 'Applying…') : 'Apply to Map'}</span>
            <span className="commit-button-status">{ready ? 'Ready' : 'Not Ready'}</span>
            <span className="commit-button-bloom" aria-hidden="true" />
            <span className="commit-button-line" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
