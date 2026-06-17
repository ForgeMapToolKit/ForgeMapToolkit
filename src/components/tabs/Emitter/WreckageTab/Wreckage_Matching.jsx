import React from 'react';
import { MatchingMode } from '../../../shared/entity-console/EntityConsole.jsx';

export default function WreckageMatching({ emitterMatchingMode, setEmitterMatchingMode, onConfigure }) {
  return (
    <MatchingMode
      value={emitterMatchingMode}
      onChange={setEmitterMatchingMode}
      onConfigure={onConfigure}
      modes={[
        { key: 'smart',        label: 'Smart Combination (3-Tier)', desc: 'Perfect Match → Partial Match → Fallback',  note: 'Unit ["Land","T3"] gets emitters active for BOTH first' },
        { key: 'simple',       label: 'Simple Union',               desc: 'Use ALL emitters active for ANY category',  note: 'Unit ["Land","T3"] gets all emitters active for Land OR T3' },
        { key: 'lastCategory', label: 'Last Category Only',         desc: 'Match only the last category in the list',  note: 'Unit ["Land","T2","Heavy"] → matches "Heavy" only' },
      ]}
    />
  );
}
