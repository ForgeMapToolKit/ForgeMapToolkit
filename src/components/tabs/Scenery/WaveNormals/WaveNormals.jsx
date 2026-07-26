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
import BakeBar from './BakeBar.jsx';
import SeaState from './SeaState.jsx';
import WaveLayers from './Layers.jsx';
import WaveFoam from './Foam.jsx';
import WaveFidelity from './Fidelity.jsx';
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
  const [seed,       setSeed]       = usePersistentState(s, 'wn_seed',       20260722, onSharedChange);

  // ── Layers ──────────────────────────────────────────────────────────────────
  const [preset,   setPreset]   = usePersistentState(s, 'wn_preset',   'recommended', onSharedChange);
  const [rates,    setRates]    = usePersistentState(s, 'wn_rates',    DEFAULT_RATES, onSharedChange);
  const [bandMode, setBandMode] = usePersistentState(s, 'wn_bandMode', 'independent', onSharedChange);
  const [lambda,    setLambda]    = usePersistentState(s, 'wn_lambda',    DEFAULT_BAKE.lambda, onSharedChange);
  const [slopeGain, setSlopeGain] = usePersistentState(s, 'wn_slopeGain', DEFAULT_BAKE.slopeGain, onSharedChange);
  const [sumComp,   setSumComp]   = usePersistentState(s, 'wn_sumComp',   true, onSharedChange);

  // ── Foam ────────────────────────────────────────────────────────────────────
  const [foamMode,    setFoamMode]    = usePersistentState(s, 'wn_foamMode',    DEFAULT_BAKE.foamMode, onSharedChange);
  const [foamCoverage,setFoamCoverage]= usePersistentState(s, 'wn_foamCoverage',DEFAULT_BAKE.foamCoverage, onSharedChange);
  const [foamJacobian,setFoamJacobian]= usePersistentState(s, 'wn_foamJacobian',DEFAULT_BAKE.foamJacobian, onSharedChange);
  const [foamSharp,   setFoamSharp]   = usePersistentState(s, 'wn_foamSharp',   DEFAULT_BAKE.foamSharp, onSharedChange);
  const [foamGain,    setFoamGain]    = usePersistentState(s, 'wn_foamGain',    1, onSharedChange);
  const [foamBlur,    setFoamBlur]    = usePersistentState(s, 'wn_foamBlur',    DEFAULT_BAKE.foamBlur, onSharedChange);
  // Which layers are allowed to break. Foam on every scale reads as weather;
  // foam on the chop alone, over unbroken swell, reads as composition.
  const [foamWeights, setFoamWeights] = usePersistentState(s, 'wn_foamWeights', [...FOAM_WEIGHT_BY_RANK], onSharedChange);
  // Solved from the baked alphas, not fed into the bake — moving this costs
  // nothing and never makes the bake stale.
  const [foamTarget, setFoamTarget] = usePersistentState(s, 'wn_foamTarget', 0.06, onSharedChange);

  // ── Fidelity ────────────────────────────────────────────────────────────────
  const [resMode,     setResMode]     = usePersistentState(s, 'wn_resMode',     'perTexel', onSharedChange);
  const [targetTexel, setTargetTexel] = usePersistentState(s, 'wn_targetTexel', 0.10, onSharedChange);
  const [resolution,  setResolution]  = usePersistentState(s, 'wn_resolution',  1024, onSharedChange);
  const [ssAuto,      setSsAuto]      = usePersistentState(s, 'wn_ssAuto',      true, onSharedChange);
  const [supersample, setSupersample] = usePersistentState(s, 'wn_supersample', 2, onSharedChange);
  // Detail floor is a resolution limit, not a sea property — it is solved per
  // layer from that layer's tile size, which is why it lives here.
  const [floorAuto,   setFloorAuto]   = usePersistentState(s, 'wn_floorAuto',   true, onSharedChange);
  const [floorTexels, setFloorTexels] = usePersistentState(s, 'wn_floorTexels', 2.5, onSharedChange);
  const [floorManual, setFloorManual] = usePersistentState(s, 'wn_floorManual', DEFAULT_SEA.detailFloor, onSharedChange);

  // ── Export ──────────────────────────────────────────────────────────────────
  const [mapName,  setMapName]  = usePersistentState(s, 'wn_mapName',  '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath] = usePersistentState(s, 'wn_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [format,   setFormat]   = usePersistentState(s, 'wn_format',   'RGBA', onSharedChange);
  const [baseName, setBaseName] = usePersistentState(s, 'wn_baseName', 'wave_normals', onSharedChange);
  // Scroll motion only shapes the exported Speed/Angle pairs, never a pixel, so
  // it is export metadata and is solved live below.
  const [flowSpeed,  setFlowSpeed]  = usePersistentState(s, 'wn_flowSpeed',  DEFAULT_SEA.flowSpeed, onSharedChange);
  const [angleSpread,setAngleSpread]= usePersistentState(s, 'wn_angleSpread',DEFAULT_SEA.angleSpreadDeg, onSharedChange);
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
  const [bakedSig, setBakedSig] = useState(null);

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

  /**
   * The exported Speed/Angle pairs, solved live from the repeat rates and the
   * wind rather than read back off the bake. The worker does stamp a
   * `derivedMovement` on each layer, but that freezes the motion at bake time —
   * which made the motion controls silently dead until the next re-bake. Rank
   * (0 = largest tile) drives the heading fan, so it is resolved by tile size.
   */
  const editorRows = useMemo(() => {
    const rankOf = rates
      .map((r, index) => ({ index, L: tileMetres(r) }))
      .sort((a, b) => b.L - a.L)
      .reduce((acc, x, rank) => { acc[x.index] = rank; return acc; }, {});

    return rates.map((repeatRate, index) => {
      const movement = deriveMovement(1 / repeatRate, sea.windDir, rankOf[index], {
        flow: Number(flowSpeed) || 0,
        angleSpread: ((Number(angleSpread) || 0) * Math.PI) / 180,
      });
      return {
        index,
        repeatRate,
        L: tileMetres(repeatRate),
        rank: rankOf[index],
        movement,
        ...editorValues({ repeatRate, movement }),
      };
    });
  }, [rates, sea.windDir, flowSpeed, angleSpread]);

  /**
   * Everything the bake actually consumes. Compared against the signature of the
   * last completed full bake, this is what tells the bake bar it has gone stale —
   * and, by omission, which controls are free: the foam target and the whole of
   * Motion are absent because they are solved from a finished bake, not fed into
   * one.
   */
  const bakeSig = useMemo(() => JSON.stringify([
    model, windSpeed, windDir, fetchKm, gamma, depth, deepWater, spread, seed,
    rates, bandMode, lambda, slopeGain, sumComp,
    foamMode, foamCoverage, foamJacobian, foamSharp, foamGain, foamBlur, foamWeights,
    layerRes, effectiveSS, floorAuto, floorTexels, floorManual,
  ]), [model, windSpeed, windDir, fetchKm, gamma, depth, deepWater, spread, seed,
       rates, bandMode, lambda, slopeGain, sumComp,
       foamMode, foamCoverage, foamJacobian, foamSharp, foamGain, foamBlur, foamWeights,
       layerRes, effectiveSS, floorAuto, floorTexels, floorManual]);

  const stale = !!layers?.length && bakedSig !== bakeSig;

  // ── Actions ─────────────────────────────────────────────────────────────────

  const bake = useCallback(async (only = null) => {
    const sig = bakeSig;
    const results = await run({
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
    });
    // Only a full bake clears staleness. Re-baking one layer leaves the other
    // three on the old parameters, which is exactly what stale should keep saying.
    if (results && only == null) setBakedSig(sig);
  }, [run, sea, slots, bandMode, seed, resolution, layerRes, effectiveSS, floorAuto,
      floorTexels, lambda, slopeGain, sumComp, foamMode, foamCoverage, foamJacobian,
      foamSharp, foamGain, foamBlur, foamWeights, bakeSig]);

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
        // where a slot was left on vanilla. Movement comes from the live solve,
        // so the values written match what the Motion block is showing.
        const wroteIdx = new Set(results.map(r => r.index));
        const waveTextures = editorRows.map(r => ({
          path: wroteIdx.has(r.index)
            ? results.find(x => x.index === r.index).gamePath
            : nearestEngineTexture(r.L).path,
          movement: r.movement,
        }));
        const waveNormalRepeats = editorRows.map(r => r.repeatRate);

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
  }, [layers, settings, mapsFolderPath, mapName, baseName, format, writeSlots, writeScmap,
      liftSun, editorRows]);

  const toggleWriteSlot = useCallback((i) => {
    setWriteSlots(prev => {
      const next = [...(prev || [true, true, true, true])];
      next[i] = next[i] === false;
      return next;
    });
  }, [setWriteSlots]);

  // ── Sections ────────────────────────────────────────────────────────────────

  const SECTIONS = [
    { id: 'sea', index: '01', label: 'Sea State',
      desc: 'Pick a spectrum model and the wind that drives it. This is the physics — nothing here knows that FA only has four texture slots.',
      done: true },
    { id: 'layers', index: '02', label: 'Layers',
      desc: 'The four slots the engine sums: how large each tile is, which slice of the spectrum it carries, and how sharp its crests get.',
      done: !!layers?.length },
    { id: 'foam', index: '03', label: 'Foam',
      desc: 'The alpha channel, which the shader reads independently of the normal. Coverage per layer, which layers break, and the threshold that turns their sum into white water.',
      done: !!recommended },
    { id: 'fidelity', index: '04', label: 'Fidelity',
      desc: 'What the bake costs: texture size per layer, supersampling, and the wavelength where small-wave damping starts. Both auto modes are usually right.',
      done: !!layers?.length },
    { id: 'export', index: '05', label: 'Export',
      desc: 'Write the DDS set into the map, set how the layers scroll, and patch the water settings so nothing has to be typed into the editor.',
      done: !!written },
  ];

  const seaProps = {
    model, setModel, windSpeed, setWindSpeed, windDir, setWindDir,
    fetchKm, setFetchKm, gamma, setGamma, depth, setDepth, deepWater, setDeepWater,
    spread, setSpread, seed, setSeed,
    peakLambda, layers, elapsed,
  };

  const layerProps = {
    preset, applyPreset, rates, setRate, bandMode, setBandMode,
    lambda, setLambda, slopeGain, setSlopeGain, sumComp, setSumComp,
    layers, busy, onBakeOne: i => bake(i),
  };

  const foamProps = {
    rates,
    foamMode, setFoamMode, foamCoverage, setFoamCoverage, foamJacobian, setFoamJacobian,
    foamSharp, setFoamSharp, foamGain, setFoamGain, foamBlur, setFoamBlur,
    foamWeights, setFoamWeight,
    foamTarget, setFoamTarget, recommended, layers,
  };

  const fidelityProps = {
    resMode, setResMode, targetTexel, setTargetTexel, resolution, setResolution,
    ssAuto, setSsAuto, supersample, setSupersample, effectiveSS,
    floorAuto, setFloorAuto, floorTexels, setFloorTexels, floorManual, setFloorManual,
    rates, layerRes, bakeBudget, layers,
  };

  const exportProps = {
    mapName, setMapName, mapInfo, baseName, setBaseName, format, setFormat,
    flowSpeed, setFlowSpeed, angleSpread, setAngleSpread,
    recommended, editorRows, layers,
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
        asideSlot={(
          <div className="wn-aside">
            <TilePreview layers={layers} threshold={threshold} busy={busy} progress={progress} />
            <BakeBar
              hasLayers={!!layers?.length}
              busy={busy}
              stale={stale}
              progress={progress}
              error={error}
              elapsed={elapsed}
              onBake={() => bake(null)}
            />
          </div>
        )}
      >
        {activeSection === 'sea'      && <SeaState     {...seaProps} />}
        {activeSection === 'layers'   && <WaveLayers   {...layerProps} />}
        {activeSection === 'foam'     && <WaveFoam     {...foamProps} />}
        {activeSection === 'fidelity' && <WaveFidelity {...fidelityProps} />}
        {activeSection === 'export'   && <WaveExport   {...exportProps} />}
      </TabLayout>

      <WaveNormalsHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default WaveNormalsTab;
