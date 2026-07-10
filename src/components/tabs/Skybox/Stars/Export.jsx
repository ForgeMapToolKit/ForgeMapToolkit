import React from 'react';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

// ─────────────────────────────────────────────────────────────────
// Export — Section 04. Pure presentational: no hooks, no state. All
// actions and toggles flow through callbacks from the parent
// (Stars.jsx).
// ─────────────────────────────────────────────────────────────────
export default function Export({
  ready,
  exportRawJson, onExportRawJsonChange,
  generateReadme, onGenerateReadmeChange,
  onExportJson,
  onInjectStars,
}) {
  const items = [
    { label: 'Export planets JSON (no SCMAP)', checked: !!exportRawJson, onToggle: () => onExportRawJsonChange(!exportRawJson) },
  ];
  if (!exportRawJson) {
    items.push({ label: 'Generate README file', checked: !!generateReadme, onToggle: () => onGenerateReadmeChange(!generateReadme) });
  }

  return (
    <div className="ctrl-col">
      <OutputChecklist
        ready={ready}
        onCommit={exportRawJson ? onExportJson : onInjectStars}
        commitLabel={exportRawJson ? 'Export Planets JSON' : 'Generate Stars'}
        commitAriaLabel={exportRawJson ? 'Export stars as planets JSON file' : 'Inject stars into .scmap'}
        items={items}
      />

      {!ready && (
        <div className="ctrl-block">
          <div className="ctrl-content">
            <p className="field-hint">
              Set <strong>Map Name</strong> in Configuration and configure the <strong>Maps Folder</strong> in Settings to enable generation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
