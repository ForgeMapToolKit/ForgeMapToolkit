import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './WaveNormals.css';

import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { luxuryAlert } from '../../../Shared/Ui/Notifications/notifications';
import { usePersistentState, useMapInfo, ensureDir } from '../../../Shared/MapLogic';

import { DEFAULT_SEA, peakWavelength } from '../../../Shared/Ocean/spectrum.js';
import { DEFAULT_BAKE } from '../../../Shared/Ocean/bake.js';
import { buildMipChain } from '../../../Shared/Ocean/bake.js';
import {
  SLOT_PRESETS, RECOMMENDED_SLOTS, recommendWaveCrestThreshold,
  editorValues, deriveMovement, resolutionForTile, estimateBakeBytes, tileMetres,
  autoSupersample, FOAM_WEIGHT_BY_RANK, nearestEngineTexture,
} from '../../../Shared/Ocean/faWater.js';

import useBake from './useBake.js';
import TilePreview from './TilePreview.jsx';
import WaveConfiguration from './Configuration.jsx';
import WaveLayers from './Layers.jsx';
import WaveExport from './Export.jsx';
import { WaveNormalsHelp, WaveNormalsHelpButton } from './Help.jsx';

const DEFAULT_RATES = RECOMMENDED_SLOTS.map(s => s.repeatRate);

const WaveNormalsTab = ({ settings, shared = {}, onSharedChange = () => {} }) => {
  const s = shared;

  // ── Sea state ───────────────────────────────────────────────────────────────
  const [model,      setModel]      = usePersistentState(s, 'wn_model',      DEFAULT_SEA.model, onSharedChange);
  const [windSpeed,  setWindSpeed]  = usePersistentState(s, 'wn_windSpeed',  DEFAULT_SEA.windSpeed, onSharedChange);
  const [windDir,    setWindDir]    = usePersistentState(s, 'wn_windDir',    35, onSharedChange); // degrees in the UI
  const [fetchKm,    setFetchKm]    = usePersistentState(s, 'wn_fetchKm',    DEFAULT_SEA.fetch / 1000, onSharedChange);
  const [gamma,      setGamma]      = usePersistentState(s, 'wn_gamma',      DEFAULT_SEA.gamma, onSharedChange);
  const [depth,      setDepth]      = usePersistentState(s, 'wn_depth',      DEFAULT_SEA.depth, onSharedChange);
  const [deepWater,  setDeepWater]  = usePersistentState(s, 'wn_deepWater',  true, onSharedChange);
  const [spread,     setSpread]     = usePersistentState(s, 'wn_spread',     DEFAULT_SEA.spread, onSharedChange);
  const [flowSpeed,  setFlowSpeed]  = usePersistentState(s, 'wn_flowSpeed',  DEFAULT_SEA.flowSpeed, onSharedChange);
  const [angleSpread,setAngleSpread]= usePersistentState(s, 'wn_angleSpread',DEFAULT_SEA.angleSpreadDeg, onSharedChange);
  const [seed,       setSeed]       = usePersistentState(s, 'wn_seed',       20260722, onSharedChange);

  // Detail floor is a resolution limit, not a sea property — it lives with the
  // fidelity controls and is solved per layer from that layer's tile size.
  const [floorAuto,   setFloorAuto]   = usePersistentState(s, 'wn_floorAuto',   true, onSharedChange);
  const [floorTexels, setFloorTexels] = usePersistentState(s, 'wn_floorTexels', 2.5, onSharedChange);
  const [floorManual, setFloorManual] = usePersistentState(s, 'wn_floorManual', DEFAULT_SEA.detailFloor, onSharedChange);

  // ── Layers ──────────────────────────────────────────────────────────────────
  const [preset,   setPreset]   = usePersistentState(s, 'wn_preset',   'recommended', onSharedChange);
  const [rates,    setRates]    = usePersistentState(s, 'wn_rates',    DEFAULT_RATES, onSharedChange);
  const [bandMode, setBandMode] = usePersistentState(s, 'wn_bandMode', 'independent', onSharedChange);

  // ── Bake ────────────────────────────────────────────────────────────────────
  const [resMode,     setResMode]     = usePersistentState(s, 'wn_resMode',     'perTexel', onSharedChange);
  const [targetTexel, setTargetTexel] = usePersistentState(s, 'wn_targetTexel', 0.10, onSharedChange);
  const [resolution,  setResolution]  = usePersistentState(s, 'wn_resolution',  1024, onSharedChange);
  const [ssAuto,      setSsAuto]      = usePersistentState(s, 'wn_ssAuto',      true, onSharedChange);
  const [supersample, setSupersample] = usePersistentState(s, 'wn_supersample', 2, onSharedChange);
  const [lambda,      setLambda]      = usePersistentState(s, 'wn_lambda',      DEFAULT_BAKE.lambda, onSharedChange);
  const [slopeGain,   setSlopeGain]   = usePersistentState(s, 'wn_slopeGain',   DEFAULT_BAKE.slopeGain, onSharedChange);
  const [sumComp,     setSumComp]     = usePersistentState(s, 'wn_sumComp',     true, onSharedChange);
  const [foamMode,    setFoamMode]    = usePersistentState(s, 'wn_foamMode',    DEFAULT_BAKE.foamMode, onSharedChange);
  const [foamCoverage,setFoamCoverage]= usePersistentState(s, 'wn_foamCoverage',DEFAULT_BAKE.foamCoverage, onSharedChange);
  const [foamJacobian,setFoamJacobian]= usePersistentState(s, 'wn_foamJacobian',DEFAULT_BAKE.foamJacobian, onSharedChange);
  const [foamSharp,   setFoamSharp]   = usePersistentState(s, 'wn_foamSharp',   DEFAULT_BAKE.foamSharp, onSharedChange);
  const [foamGain,    setFoamGain]    = usePersistentState(s, 'wn_foamGain',    1, onSharedChange);
  const [foamBlur,    setFoamBlur]    = usePersistentState(s, 'wn_foamBlur',    DEFAULT_BAKE.foamBlur, onSharedChange);
  // Which layers are allowed to break. Foam on every scale reads as weather;
  // foam on the chop alone, over unbroken swell, reads as composition.
  const [foamWeights, setFoamWeights] = usePersistentState(s, 'wn_foamWeights', [...FOAM_WEIGHT_BY_RANK], onSharedChange);

  // ── Export ──────────────────────────────────────────────────────────────────
  const [mapName,  setMapName]  = usePersistentState(s, 'wn_mapName',  '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath] = usePersistentState(s, 'wn_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [format,   setFormat]   = usePersistentState(s, 'wn_format',   'RGBA', onSharedChange);
  const [baseName, setBaseName] = usePersistentState(s, 'wn_baseName', 'wave_normals', onSharedChange);
  const [foamTarget, setFoamTarget] = usePersistentState(s, 'wn_foamTarget', 0.06, onSharedChange);
  // Which slots actually get written. Replacing only the layers that need it and
  // leaving the rest on stock textures is a legitimate — often better — result
  // than replacing all four, so it is a first-class option rather than a hack.
  const [writeSlots, setWriteSlots] = usePersistentState(s, 'wn_writeSlots', [true, true, true, true], onSharedChange);
  // Patch the .scmap water settings so the map points at the new textures with
  // no manual editing. Opt-in because it rewrites the map file.
  const [writeScmap, setWriteScmap] = usePersistentState(s, 'wn_writeScmap', true, onSharedChange);
  const [liftSun,    setLiftSun]    = usePersistentState(s, 'wn_liftSun',    false, onSharedChange);

  const [activeSection, setActiveSection] = useState('sea');
  const [showHelp, setShowHelp] = useState(false);
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState(null);

  const { mapInfo } = useMapInfo({ mapName, mapsFolderPath, settings });
  const { layers, busy, progress, error, elapsed, run } = useBake();

  useEffect(() => {
    if (settings?.mapsFolder) setMapsFolderPath(settings.mapsFolder);
  }, [settings]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const sea = useMemo(() => ({
    model,
    windSpeed: Number(windSpeed) || 1,
    windDir: ((Number(windDir) || 0) * Math.PI) / 180,
    fetch: Math.max(100, (Number(fetchKm) || 1) * 1000),
    gamma: Number(gamma) || 1,
    depth: Number(depth) || 1,
    deepWater,
    spread: Number(spread) || 1,
    detailFloor: Number(floorManual) || 0,
    amplitude: 1,
    flowSpeed: Number(flowSpeed) || 0,
    angleSpreadDeg: Number(angleSpread) || 0,
  }), [model, windSpeed, windDir, fetchKm, gamma, depth, deepWater, spread, floorManual,
       flowSpeed, angleSpread]);

  const slots = useMemo(
    () => rates.map(r => ({ repeatRate: r, movement: [0, 0] })),
    [rates],
  );

  const peakLambda = useMemo(() => peakWavelength(sea), [sea]);

  /**
   * Per-layer resolution. In `perTexel` mode each layer is sized to hit the same
   * world-space texel, which is where the pixel budget actually earns anything —
   * a shared resolution over-resolves the small tiles by an order of magnitude
   * and starves the large one.
   */
  const layerRes = useMemo(() => rates.map(r => (
    resMode === 'perTexel'
      ? resolutionForTile(tileMetres(r), Number(targetTexel))
      : Number(resolution)
  )), [rates, resMode, targetTexel, resolution]);

  const effectiveSS = ssAuto
    ? autoSupersample(floorAuto, Number(floorTexels))
    : Number(supersample);

  const bakeBudget = useMemo(() => {
    const peak = Math.max(...layerRes.map(m => estimateBakeBytes(m, effectiveSS)));
    const bytes = layerRes.reduce((a, m) => a + m * m * 4, 0);
    return { peakMB: peak / 1048576, textureMB: bytes / 1048576, supersample: effectiveSS };
  }, [layerRes, effectiveSS]);

  /** The threshold that would put `foamTarget` of the surface under foam. */
  const recommended = useMemo(() => {
    if (!layers?.length) return null;
    return recommendWaveCrestThreshold(
      layers.map(l => ({ rgba: l.rgba, width: l.width, repeatRate: l.repeatRate })),
      foamTarget,
    );
  }, [layers, foamTarget]);

  const editorRows = useMemo(() => (layers || []).map((l) => {
    // The worker already computes derivedMovement (speed by √scale, heading
    // fanned per layer); fall back to a straight-with-wind vector only if absent.
    const movement = l.derivedMovement
      || deriveMovement(1 / l.repeatRate, sea.windDir, l.rank ?? 0, {
           flow: Number(flowSpeed) || 0.015,
           angleSpread: ((Number(angleSpread) || 0) * Math.PI) / 180,
         });
    return { ...l, ...editorValues({ repeatRate: l.repeatRate, movement }) };
  }), [layers, sea.windDir, flowSpeed, angleSpread]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const bake = useCallback((only = null) => run({
    sea, slots, bandMode, seed: Number(seed) || 1,
    resolution: Number(resolution),
    resolutions: layerRes,
    foamWeights,
    supersample: effectiveSS,
    detailFloorAuto: floorAuto,
    detailFloorTexels: Number(floorTexels),
    only,
    bake: {
      lambda: Number(lambda),
      slopeGain: Number(slopeGain),
      sumCompensation: sumComp,
      foamMode,
      foamCoverage: Number(foamCoverage),
      foamJacobian: Number(foamJacobian),
      foamSharp: Number(foamSharp),
      foamGain: Number(foamGain),
      foamBlur: Number(foamBlur),
    },
  }), [run, sea, slots, bandMode, seed, resolution, layerRes, effectiveSS, floorAuto,
       floorTexels, lambda, slopeGain, sumComp, foamMode, foamCoverage, foamJacobian,
       foamSharp, foamGain, foamBlur, foamWeights]);

  const setFoamWeight = useCallback((i, v) => {
    setFoamWeights(prev => {
      const next = [...(prev || FOAM_WEIGHT_BY_RANK)];
      next[i] = v;
      return next;
    });
  }, [setFoamWeights]);

  const applyPreset = useCallback((id) => {
    const p = SLOT_PRESETS.find(x => x.id === id);
    if (!p) return;
    setPreset(id);
    setRates(p.slots.map(x => x.repeatRate));
  }, [setPreset, setRates]);

  const setRate = useCallback((i, value) => {
    setRates(prev => prev.map((r, k) => (k === i ? value : r)));
    setPreset('custom');
  }, [setRates, setPreset]);

  const writeFiles = useCallback(async () => {
    if (!layers?.length) return;

    const folder = (settings?.mapsFolder || mapsFolderPath || '').trim();
    if (!folder) {
      await luxuryAlert('No Maps folder configured.\n\nSet the Maps Folder in Settings.', 'Missing Maps Folder', 'warning');
      return;
    }
    let finalName = mapName.trim();
    if (!finalName) {
      await luxuryAlert('Enter a map name before writing.', 'Missing Map Name', 'warning');
      return;
    }
    if (!/\.v\d{4}$/.test(finalName)) finalName += '.v0001';

    const dir = `${folder}\\${finalName}\\env\\layers\\water`;
    setWriting(true);
    try {
      const selected = layers.filter(l => writeSlots[l.index] !== false);
      if (!selected.length) {
        await luxuryAlert('No layers selected for export.', 'Nothing to write', 'warning');
        return;
      }

      await ensureDir(dir);
      const results = [];
      for (const l of selected) {
        const levels = buildMipChain(l.rgba, l.width);
        const filePath = `${dir}\\${baseName}_${l.index}.dds`;
        const res = await window.electronAPI.invoke('write-dds', {
          filePath,
          levels: levels.map(v => ({ width: v.width, height: v.height, data: v.data })),
          format,
        });
        if (!res?.success) throw new Error(res?.error || `write-dds failed for layer ${l.index}`);
        results.push({
          index: l.index,
          path: filePath,
          gamePath: `/maps/${finalName}/env/layers/water/${baseName}_${l.index}.dds`,
          bytes: res.bytes,
          mipCount: res.mipCount,
        });
      }

      // ── Patch the .scmap water settings ──────────────────────────────────────
      let scmapPatched = false, sunLifted = false;
      if (writeScmap) {
        const mapFolderPath = `${folder}\\${finalName}`;
        const listed = await window.electronAPI.invoke('list-dir', { dirPath: mapFolderPath });
        const scmapFile = (listed?.entries || [])
          .find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.scmap'));
        if (!scmapFile) throw new Error(`No .scmap found in ${mapFolderPath}`);
        const scmapPath = `${mapFolderPath}\\${scmapFile.name}`;

        const unpack = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
        if (!unpack?.success) throw new Error(`Unpack failed: ${unpack?.error}`);

        // All four slots in order: generated path where written, stock texture
        // where a slot was left on vanilla. Movement/repeat come from the layer.
        const wroteIdx = new Set(results.map(r => r.index));
        const waveTextures = layers
          .slice().sort((a, b) => a.index - b.index)
          .map(l => ({
            path: wroteIdx.has(l.index)
              ? results.find(r => r.index === l.index).gamePath
              : nearestEngineTexture(l.L).path,
            movement: l.derivedMovement || [0, 0],
          }));
        const waveNormalRepeats = layers
          .slice().sort((a, b) => a.index - b.index)
          .map(l => l.repeatRate);

        const patch = await window.electronAPI.invoke('scmap-patch-water', {
          folder: unpack.outputFolder, waveTextures, waveNormalRepeats, liftSun,
        });
        if (!patch?.success) throw new Error(`Water patch failed: ${patch?.error}`);
        sunLifted = patch.sunLifted;

        const packName = unpack.outputFolder.split(/[\\/]/).pop();
        const pack = await window.electronAPI.invoke('scmap-pack', { mapName: packName });
        if (!pack?.success) throw new Error(`Pack failed: ${pack?.error}`);

        const copyBack = await window.electronAPI.invoke('copy-file', { src: pack.outputPath, dest: scmapPath });
        if (!copyBack?.success) throw new Error('Failed to copy the repacked .scmap back');
        scmapPatched = true;
      }

      setWritten({ dir, files: results, at: Date.now(), scmapPatched, sunLifted });
    } catch (e) {
      await luxuryAlert(`Writing failed:\n${e.message}`, 'Export Error', 'error');
    } finally {
      setWriting(false);
    }
  }, [layers, settings, mapsFolderPath, mapName, baseName, format, writeSlots, writeScmap, liftSun]);

  const toggleWriteSlot = useCallback((i) => {
    setWriteSlots(prev => {
      const next = [...(prev || [true, true, true, true])];
      next[i] = next[i] === false;
      return next;
    });
  }, [setWriteSlots]);

  // ── Sections ────────────────────────────────────────────────────────────────

  const SECTIONS = [
    { id: 'sea',    index: '01', label: 'Sea State',
      desc: 'Pick a spectrum model and the wind that drives it. This is the physics; everything else is presentation.',
      done: true },
    { id: 'layers', index: '02', label: 'Layers',
      desc: 'The four normal slots FA sums: tile sizes, how the spectrum is split across them, choppiness and foam.',
      done: !!layers?.length },
    { id: 'export', index: '03', label: 'Export',
      desc: 'Write the DDS set into the map and read off the water settings to enter in the editor.',
      done: !!written },
  ];

  const configProps = {
    model, setModel, windSpeed, setWindSpeed, windDir, setWindDir,
    fetchKm, setFetchKm, gamma, setGamma, depth, setDepth, deepWater, setDeepWater,
    spread, setSpread, seed, setSeed,
    flowSpeed, setFlowSpeed, angleSpread, setAngleSpread, editorRows,
    peakLambda, busy, onBake: () => bake(null), progress, error, elapsed, layers,
  };

  const layerProps = {
    preset, applyPreset, rates, setRate, bandMode, setBandMode,
    resMode, setResMode, targetTexel, setTargetTexel,
    resolution, setResolution,
    ssAuto, setSsAuto, supersample, setSupersample, effectiveSS,
    layerRes, bakeBudget,
    floorAuto, setFloorAuto, floorTexels, setFloorTexels, floorManual, setFloorManual,
    lambda, setLambda, slopeGain, setSlopeGain, sumComp, setSumComp,
    foamMode, setFoamMode, foamCoverage, setFoamCoverage, foamJacobian, setFoamJacobian,
    foamSharp, setFoamSharp, foamGain, setFoamGain, foamBlur, setFoamBlur,
    foamWeights, setFoamWeight,
    layers, busy, onBake: () => bake(null), onBakeOne: i => bake(i), peakLambda,
  };

  const exportProps = {
    mapName, setMapName, mapInfo, baseName, setBaseName, format, setFormat,
    foamTarget, setFoamTarget, recommended, editorRows, layers,
    writeSlots, toggleWriteSlot,
    writeScmap, setWriteScmap, liftSun, setLiftSun,
    onWrite: writeFiles, writing, written,
  };

  const threshold = recommended?.threshold ?? 1;

  return (
    <div className="trace-tab wn-tab">
      <TabLayout
        sections={SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        layoutMode="x"
        controlsWidth="half"
        asideCaption="WATER PREVIEW"
        asideMirror={<WaveNormalsHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />}
        asideSlot={<TilePreview layers={layers} threshold={threshold} busy={busy} progress={progress} />}
      >
        {activeSection === 'sea'    && <WaveConfiguration {...configProps} />}
        {activeSection === 'layers' && <WaveLayers        {...layerProps} />}
        {activeSection === 'export' && <WaveExport        {...exportProps} />}
      </TabLayout>

      <WaveNormalsHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default WaveNormalsTab;
