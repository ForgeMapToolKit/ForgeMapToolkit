import React from 'react';
import { FLOAT_VERDICT_LABEL } from '../../../Shared/MapLogic';

// Looked up, not interpolated — see the note in Findings.jsx.
const VERDICT_CLASS = {
  pass: 'ft-verdict--pass', near: 'ft-verdict--near',
  fail: 'ft-verdict--fail', skip: 'ft-verdict--skip',
};

/**
 * Floating Trees · Section 04 — Report.
 * The run as plain text, plus the two ways out: clipboard, or a .txt beside the
 * map. This tab never writes into the map itself — the report is its only output.
 */
export default function FloatingTreesReport({
  reportText, hasScan, saveMsg, onCopy, onSave, verdict, counts, hotspotCount,
}) {
  return (
    <div className="ctrl-col">

      <div className="ctrl-block">
        <div className="ctrl-subtitle">Result</div>
        <div className="ctrl-content">
          {!hasScan ? (
            <div className="ft-empty">Run a scan on the Configuration step first.</div>
          ) : (
            <>
              <div className={`ft-verdict ${VERDICT_CLASS[verdict] || ''}`}>
                <span className="ft-verdict-word">{FLOAT_VERDICT_LABEL[verdict]}</span>
                <span className="ft-verdict-note">
                  {counts.props
                    ? `${counts.props.toLocaleString()} prop(s) across ${hotspotCount} place(s) on the map`
                    : 'Every measured object sits on the terrain beneath it.'}
                </span>
              </div>
              <pre className="ft-report">{reportText}</pre>
              <div className="ctrl-action-row">
                <button className="ctrl-btn-add" onClick={onCopy}>Copy Report</button>
              </div>
              {saveMsg && <div className="ft-note">{saveMsg}</div>}
            </>
          )}
        </div>
      </div>

      <div className="ctrl-block">
        <div className="ctrl-subtitle">Save</div>
        <div className="ctrl-content">
          <button
            className="commit-button"
            disabled={!hasScan}
            onClick={hasScan ? onSave : undefined}
            aria-label="Write the floating-trees report next to the map"
          >
            <span className="commit-button-label">Write Report to Map Folder</span>
            <span className="commit-button-status">{hasScan ? 'Ready' : 'Not Ready'}</span>
            <span className="commit-button-bloom" aria-hidden="true" />
            <span className="commit-button-line" aria-hidden="true" />
          </button>
        </div>
      </div>

    </div>
  );
}
