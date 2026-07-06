import React from 'react';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

export default function PropsExport({
  ready, generateFiles,
  generateReadme, setGenerateReadme, exportRawLua, setExportRawLua,
}) {
  return (
    <OutputChecklist
      ready={ready}
      onCommit={generateFiles}
      commitLabel="Generate Files"
      commitAriaLabel="Generate prop files"
      items={[
        { label: 'Generate README file', checked: generateReadme, onToggle: () => setGenerateReadme(!generateReadme) },
        { label: 'Export props.lua (no SCMAP)', checked: exportRawLua, onToggle: () => setExportRawLua(!exportRawLua) },
      ]}
    />
  );
}
