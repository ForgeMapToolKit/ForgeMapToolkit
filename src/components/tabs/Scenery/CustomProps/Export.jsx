import React from 'react';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

export default function CustomPropsExport({
  mapName, opsCount, generating, generateFiles,
  generateReadme, setGenerateReadme,
}) {
  const ready = opsCount > 0 && !!mapName?.trim();
  const noMapName = !mapName?.trim() && opsCount > 0;

  return (
    <div className="ctrl-col">
      {noMapName && (
        <div className="cpt-warn-box">A map name must be set before generating.</div>
      )}
      <OutputChecklist
        ready={ready}
        onCommit={generateFiles}
        commitLabel={generating ? 'GENERATING…' : 'GENERATE FILES'}
        commitAriaLabel="Generate custom prop files"
        readyText={`${opsCount} with textures`}
        notReadyText={opsCount === 0 ? 'No custom textures' : 'Set a map name'}
        items={[
          { label: 'Generate README file', checked: generateReadme, onToggle: () => setGenerateReadme(v => !v) },
        ]}
      />
    </div>
  );
}
