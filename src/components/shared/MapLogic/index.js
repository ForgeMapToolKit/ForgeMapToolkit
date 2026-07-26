export * from './mapGeometry';
export * from './scmapIO';
export * from './mapCanvas';
export { usePersistentState } from './usePersistentState';
export { useMapInfo } from './useMapInfo';
export { useScmapPreview } from './useScmapPreview';
export { loadImageChannel, sampleChannel } from './imageChannels';
export { useTerrainData, createTerrainSampler } from './terrainSampler';
export { STRATUM_SLOTS, shaderUsesHalfRange, computeDominantStratum, buildTerrainTypeBytes } from './terrainTypeLogic';
export {
  SYMMETRY_MODES, SYMMETRY_MODE_OPTIONS, symmetryModeById, symmetryBasis,
  mirrorPoint, mirrorBox, compareGrid, heightmapView, pairEntities,
  SYMMETRY_NEAR_RATIO, symmetryVerdict, SYMMETRY_VERDICT_LABEL,
  scoreSymmetryMode, buildSymmetryReport,
} from './symmetryLogic';
export {
  FLOAT_OBVIOUS, ANCHOR_DRIFT, FLOAT_VERDICT_LABEL,
  judgeFloatingProps, buildFloatingPropsReport,
} from './floatingPropsLogic';
export {
  BIOME_ROLES, ROLE_IDS, PRESET_ROLE_IDS, roleById, BIOME_LAYER_SLOTS,
  BIOME_CHANNELS, DEFAULT_CHANNELS, PROP_POLICIES,
  guessRole, guessRoles, roleEntry, presetCoverage, validatePreset,
  planTextureSwap, planPropSwap, buildBiomePatch, describePatch, patchIsEmpty,
  presetFromState, presetToSource, vecToHex,
} from './biomeLogic';
