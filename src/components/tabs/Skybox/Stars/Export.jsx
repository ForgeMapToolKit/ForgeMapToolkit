import React from 'react';

// ─────────────────────────────────────────────────────────────────
// Stars_Export — Section 04 (Export options + generate button).
// Pure presentational: no hooks, no state. All actions and toggles
// flow through callbacks from the parent (Stars.jsx).
// ─────────────────────────────────────────────────────────────────
export default function Export({
  exportRawJson, onExportRawJsonChange,
  generateReadme, onGenerateReadmeChange,
  onExportJson,
  onInjectStars,
}) {
  return (
    <>
      <label className="checkbox-label" style={{ marginBottom: '12px' }}
        onClick={() => onExportRawJsonChange(v => !v)}>
        <div className={`checkbox${exportRawJson ? ' checked' : ''}`}>
          {exportRawJson && (
            <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="checkbox-text">Export planets JSON (no SCMAP)</span>
      </label>

      {!exportRawJson && (
        <label className="checkbox-label" style={{ marginBottom: '20px', cursor: 'pointer' }}
          onClick={() => onGenerateReadmeChange(v => !v)}>
          <div className={`checkbox${generateReadme ? ' checked' : ''}`}>
            {generateReadme && (
              <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className="checkbox-text">Generate README file</span>
        </label>
      )}

      <button className="btn-primary btn-lg" onClick={exportRawJson ? onExportJson : onInjectStars}>
        {exportRawJson ? 'Export Planets JSON' : 'Generate Stars'}
      </button>
    </>
  );
}
