import React from 'react';
import { MatchingMode } from '../../../shared/entity-console/EntityConsole.jsx';

export default function EmitterMatching({ emitterMatchingMode, setEmitterMatchingMode, onConfigure }) {
  return (
    <MatchingMode
      value={emitterMatchingMode}
      onChange={setEmitterMatchingMode}
      onConfigure={onConfigure}
      modes={[
        { key: 'smart',        label: 'Smart Combination (3-Tier)', desc: 'Perfect Match → Partial Match → Fallback',  note: 'Card ["Smoke", "Dense"] gets only emitters active for BOTH categories first' },
        { key: 'simple',       label: 'Simple Union',               desc: 'Use ALL emitters active for ANY category',  note: 'Card ["Smoke", "Dense"] gets all emitters active for Smoke OR Dense' },
        { key: 'lastCategory', label: 'Last Category Only',         desc: 'Match only the last category in the list',  note: 'Card ["Smoke", "Dense"] → matches "Dense" only' },
      ]}
    />
  );
}
