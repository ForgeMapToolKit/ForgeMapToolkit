/**
 * SkyboxGenerator_Output.jsx — Sektion 05: Output
 *
 * TAB-CONTRACT §4: Rein präsentational — keine Hooks, kein IPC, kein State.
 * Bündelt: Export-Optionen + Generate-Button (OutputChecklist).
 *
 * Props (alle aus outputProps im Parent):
 *   mapName, mapsFolderPath
 *   exportRawScmskybox, setExportRawScmskybox
 *   generateReadme, setGenerateReadme
 *   onExportScmskybox, onInjectSkybox
 */
import React from 'react';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

const Output = ({
  mapName,
  mapsFolderPath,
  exportRawScmskybox,
  setExportRawScmskybox,
  generateReadme,
  setGenerateReadme,
  onExportScmskybox,
  onInjectSkybox,
}) => {
  const ready = !!(mapName?.trim() && mapsFolderPath?.trim());

  return (
    <div className="ctrl-col">

      <OutputChecklist
        ready={ready}
        onCommit={exportRawScmskybox ? onExportScmskybox : onInjectSkybox}
        commitLabel="Generate Skybox"
        commitAriaLabel={exportRawScmskybox ? 'Export skybox as .scmskybox file' : 'Inject skybox into .scmap'}
        items={[
          { label: 'Export raw .scmskybox', checked: !!exportRawScmskybox, onToggle: () => setExportRawScmskybox(!exportRawScmskybox) },
          { label: 'Generate README file', checked: !!generateReadme, onToggle: () => setGenerateReadme(!generateReadme) },
        ]}
      />

      {!ready && (
        <div className="ctrl-block">
          <div className="ctrl-content">
            <p className="sb-field-help">
              Set <strong>Map Name</strong> in the Atmosphere section and configure the <strong>Maps Folder</strong> in Settings to enable generation.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default Output;
