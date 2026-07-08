import React from 'react';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

export default function RockErosionExport({
  isReady, generateFiles,
  generateReadme, setGenerateReadme, exportRawLua, setExportRawLua,
}) {
  return (
    <OutputChecklist
      ready={isReady}
      onCommit={generateFiles}
      commitLabel="Generate Rocks"
      commitAriaLabel="Generate rock erosion files"
      items={[
        { label: 'Generate README file', checked: generateReadme, onToggle: () => setGenerateReadme(!generateReadme) },
        { label: 'Export props.lua (no SCMAP)', checked: exportRawLua, onToggle: () => setExportRawLua(!exportRawLua) },
      ]}
    />
  );
}
