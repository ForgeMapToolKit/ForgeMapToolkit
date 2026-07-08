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
        onCommit={onInjectSkybox}
        commitLabel="Generate Skybox → .scmap"
        commitAriaLabel="Inject skybox into .scmap"
        items={[
          { label: 'Export raw .scmskybox JSON alongside .scmap inject', checked: !!exportRawScmskybox, onToggle: () => setExportRawScmskybox(!exportRawScmskybox) },
          { label: 'Generate README file', checked: !!generateReadme, onToggle: () => setGenerateReadme(!generateReadme) },
        ]}
      />

      <div className="ctrl-block">
        <div className="ctrl-content">
          <div className="ctrl-action-row">
            <button
              className="action-button action-button--full"
              onClick={onExportScmskybox}
              disabled={!ready}
              title={ready ? 'Export skyBox JSON as .scmskybox file' : 'Map Name and Maps Folder required'}
            >
              Export .scmskybox only
            </button>
          </div>
          {!ready && (
            <p className="sb-field-help">
              Set <strong>Map Name</strong> in the Atmosphere section and configure the <strong>Maps Folder</strong> in Settings to enable generation.
            </p>
          )}
        </div>
      </div>

    </div>
  );
};

export default Output;
