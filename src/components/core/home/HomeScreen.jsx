import React, { useState, useEffect, useRef } from 'react';
import HeaderRegister from './components/HeaderRegister.jsx';
import ProjectionStage from './components/ProjectionStage.jsx';
import ToolRail from './components/ToolRail.jsx';
import { getTool } from './data/toolRegistry.js';
import './HomeScreen.css';

/**
 * HomeScreen — the TRACE home screen system.
 *
 * Three ruled registers:
 *  1. HeaderRegister  — top, thin: wordmark + status strip + hairline
 *  2. ProjectionStage — ~70% height: standby card / tool projection
 *  3. ToolRail        — bottom: fixed-width slats + section captions
 *
 * Above everything: a fine film-grain layer — the surface of the
 * instrument, not an effect. Below interaction: a one-time boot
 * sequence (wordmark prints bright then recedes, rail runs a lamp-test
 * cascade) — the machine powers on; afterwards it is still.
 *
 * Click → commit: a shutter wipes the stage closed in the tool's hue
 * and navigation fires while the stage is dark — entering the tab
 * reads as a cut, not a route change.
 *
 * Props:
 *  - onNavigate(id|null)
 *  - appVersion:     string
 *  - libraryScanned: boolean
 *  - scanning:       boolean
 *  - settings:       settings object (for mapsPath)
 */

const COMMIT_MS = 380; // shutter sweep duration before navigation (matches CSS)

const HomeScreen = ({ onNavigate, appVersion, libraryScanned, scanning, settings, mapName }) => {
  const [focusedToolId, setFocusedToolId] = useState(null);
  const [commitToolId,  setCommitToolId]  = useState(null);
  const commitRef = useRef(null);

  useEffect(() => () => clearTimeout(commitRef.current), []);

  const handleSelect = (id) => {
    if (commitToolId) return; // a commit is already in flight
    setCommitToolId(id);
    commitRef.current = setTimeout(() => onNavigate(id), COMMIT_MS);
  };

  const focusedTool = getTool(focusedToolId);
  const commitTool  = getTool(commitToolId);
  const mapsPath    = settings?.mapsPath ?? null;

  return (
    <div className={`hs-root${commitToolId ? ' hs-root--commit' : ''}`}>

      <HeaderRegister
        appVersion={appVersion}
        mapsPath={mapsPath}
        libraryScanned={libraryScanned}
        scanning={scanning}
      />

      <ProjectionStage
        tool={focusedTool}
        commitTool={commitTool}
        appVersion={appVersion}
        lastMap={mapName}
        mapDims={null}
      />

      <ToolRail
        activeToolId={commitToolId ?? focusedToolId}
        onSelect={handleSelect}
        onToolFocus={setFocusedToolId}
        onToolBlur={() => setFocusedToolId(null)}
      />

      {/* Film grain — the instrument's surface, above everything */}
      <div className="hs-grain" aria-hidden="true" />

    </div>
  );
};

export default HomeScreen;
