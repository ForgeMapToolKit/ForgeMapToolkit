import React from 'react';
import { MatchingMode } from '../../../shared/entity-console/EntityConsole.jsx';

export default function PropsMatching({ emitterMatchingMode, setEmitterMatchingMode, onConfigure }) {
  return (
    <MatchingMode
      value={emitterMatchingMode}
      onChange={setEmitterMatchingMode}
      onConfigure={onConfigure}
      modes={[
        { key: 'smart',        label: 'Smart Combination (3-Tier)', desc: 'Perfect Match → Partial Match → Fallback',    note: 'Prop ["Forest", "Dense"] gets only emitters active for BOTH categories first' },
        { key: 'simple',       label: 'Simple Union',               desc: 'Use ALL emitters active for ANY category',    note: 'Prop ["Forest", "Dense"] gets all emitters active for Forest OR Dense' },
        { key: 'lastCategory', label: 'Last Category Only',         desc: 'Match only the last category in the list',   note: 'Prop ["Forest", "Lava", "Dense"] → matches "Dense" only' },
      ]}
    />
  );
}
