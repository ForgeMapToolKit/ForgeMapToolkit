import React from 'react';

// Looked up, not interpolated — see the note in Findings.jsx.
const VERDICT_CLASS = {
  pass: 'sy-verdict--pass', near: 'sy-verdict--near',
  fail: 'sy-verdict--fail', skip: 'sy-verdict--skip',
};

/**
 * Symmetry Checker · Section 03 — Report.
 * The run as plain text, plus the two ways out: clipboard, or a .txt beside the
 * map. This tab never writes into the map itself — the report is its only output.
 */
export default function SymmetryReport({
  reportText, hasMap, saveMsg, onCopy, onSave, overallVerdict, failing,
}) {
  return (
    <div className="ctrl-col">

      <div className="ctrl-block">
        <div className="ctrl-subtitle">Result</div>
        <div className="ctrl-content">
          {!hasMap ? (
            <div className="sy-empty">Run a check on the Configuration step first.</div>
          ) : (
            <>
              <div className={`sy-verdict ${VERDICT_CLASS[overallVerdict] || ''}`}>
                <span className="sy-verdict-word">
                  {failing.length ? `${failing.length} layer(s) asymmetric` : 'Fully symmetric'}
                </span>
                <span className="sy-verdict-note">
                  {failing.length ? failing.map(f => f.label).join(' · ') : 'Every checked layer matched its mirror.'}
                </span>
              </div>
              <pre className="sy-report">{reportText}</pre>
              <div className="ctrl-action-row">
                <button className="ctrl-btn-add" onClick={onCopy}>Copy Report</button>
              </div>
              {saveMsg && <div className="sy-note">{saveMsg}</div>}
            </>
          )}
        </div>
      </div>

      <div className="ctrl-block">
        <div className="ctrl-subtitle">Save</div>
        <div className="ctrl-content">
          <button
            className="commit-button"
            disabled={!hasMap}
            onClick={hasMap ? onSave : undefined}
            aria-label="Write the symmetry report next to the map"
          >
            <span className="commit-button-label">Write Report to Map Folder</span>
            <span className="commit-button-status">{hasMap ? 'Ready' : 'Not Ready'}</span>
            <span className="commit-button-bloom" aria-hidden="true" />
            <span className="commit-button-line" aria-hidden="true" />
          </button>
        </div>
      </div>

    </div>
  );
}
