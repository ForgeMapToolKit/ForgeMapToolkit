import React from 'react';
import { OutputChecklist } from '../../../shared/entity-console/EntityConsole.jsx';

export default function EmitterExport({
  ready, handleGenerate,
  generateReadme, setGenerateReadme, exportRawLua, setExportRawLua,
}) {
  return (
    <OutputChecklist
      ready={ready}
      onCommit={handleGenerate}
      commitLabel="Generate Files"
      commitAriaLabel="Generate emitter files"
      items={[
        { label: 'Generate README file',       checked: generateReadme, onToggle: () => setGenerateReadme(!generateReadme) },
        { label: 'Export props.lua (no SCMAP)', checked: exportRawLua,  onToggle: () => setExportRawLua(!exportRawLua) },
      ]}
    />
  );
}
