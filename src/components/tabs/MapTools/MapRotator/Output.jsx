import React from 'react';
import { OutputChecklist } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

/**
 * Section 02 — version behaviour and the commit action.
 */
const Output = ({ canRotate, running, createNewVersion, setCreateNewVersion, onRotate, angle }) => (
  <div className="ctrl-col">
    <OutputChecklist
      ready={canRotate}
      onCommit={onRotate}
      commitLabel={running ? 'Rotating…' : `Rotate Map ${angle}°`}
      commitAriaLabel={`Rotate the map ${angle} degrees clockwise`}
      notReadyText={running ? '●' : 'Not Ready'}
      optionsLabel="Version"
      filesLabel="Rotate"
      items={[
        {
          label: 'Create new version',
          sub: createNewVersion
            ? 'A new versioned folder (e.g. map.v0007) is created — the original is untouched.'
            : 'The existing map folder is overwritten in place. Back up first.',
          checked: createNewVersion,
          onToggle: () => !running && setCreateNewVersion(!createNewVersion),
        },
      ]}
    />
  </div>
);

export default Output;
