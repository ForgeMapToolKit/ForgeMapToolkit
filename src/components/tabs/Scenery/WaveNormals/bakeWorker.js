/**
 * bakeWorker.js — runs the ocean simulation off the UI thread.
 *
 * A single layer is four 2D inverse FFTs plus two sweeps over the Lagrangian
 * grid: about a second at 512² and four times that at 1024². Four layers on the
 * renderer thread would lock the window for the whole bake, so the engine —
 * which is deliberately free of DOM and React dependencies — runs here instead
 * and reports progress per layer.
 *
 * Pixel buffers are transferred, not copied, on the way back.
 */

import { createOceanField } from '../../../Shared/Ocean/ocean.js';
import { bakeNormalMap } from '../../../Shared/Ocean/bake.js';
import {
  resolveSlotBands, sumCompensation, FOAM_WEIGHT_BY_RANK, tileOgrids,
} from '../../../Shared/Ocean/faWater.js';

self.onmessage = (e) => {
  const {
    sea, slots, bandMode, seed, resolution, resolutions, supersample, bake, only,
    detailFloorAuto = true, detailFloorTexels = 2.5, foamWeights = null,
  } = e.data;

  // The FFT is radix-2, so the supersampled grid (resolution × ss) must stay a
  // power of two — which means ss itself must be. A stray value like 3 would
  // otherwise blow up createOceanField with a cryptic length error mid-bake.
  const ss = supersample >= 4 ? 4 : supersample >= 2 ? 2 : 1;

  try {
    const bands = resolveSlotBands(slots, bandMode, seed, sea);
    const targets = only == null ? bands.map((_, i) => i) : [only];
    const results = [];

    for (const i of targets) {
      const s = bands[i];

      // Each layer may carry its own resolution — a 13 m tile does not need the
      // pixel budget a 400 m tile does. See resolutionForTile() in faWater.js.
      const M = resolutions?.[s.index] ?? resolution;

      // The small-wave damping is a *resolution* limit, not a property of the
      // sea, so it has to be solved per layer: a 0.10 m floor is right on a 20 m
      // tile and throws away three octaves on a 400 m one. Auto puts it a couple
      // of texels above the output Nyquist, which damps only what the texture
      // could not have stored anyway.
      const texel = s.L / M;
      const slotSea = detailFloorAuto
        ? { ...s.sea, detailFloor: detailFloorTexels * texel }
        : s.sea;

      self.postMessage({ type: 'progress', slot: i, total: targets.length, phase: 'spectrum' });
      const field = createOceanField({
        N: M * ss,
        L: s.L,
        sea: slotSea,
        seed: s.seed,
        kLo: s.kLo,
        kHi: s.kHi,
      });

      self.postMessage({ type: 'progress', slot: i, total: targets.length, phase: 'transform' });
      const baked = bakeNormalMap(field, {
        ...bake,
        M,
        // The engine renders the *mean* of the four layer slopes, so a layer has
        // to exaggerate. How much depends on whether the layers share
        // wavelengths — see sumCompensation() in faWater.js.
        slopeGain: (bake.sumCompensation ? sumCompensation(bandMode) : 1) * bake.slopeGain,
        // Which scales are allowed to break is a composition decision, so the
        // per-layer weight comes from the UI; the size-ranked table is only the
        // fallback when nothing has been set.
        foamGain: (foamWeights?.[s.index] ?? FOAM_WEIGHT_BY_RANK[s.rank]) * bake.foamGain,
      });

      results.push({
        index: s.index,
        rank: s.rank,
        L: s.L,
        ogrids: tileOgrids(s.repeatRate),
        repeatRate: s.repeatRate,
        movement: s.movement,
        derivedMovement: s.derivedMovement,
        kLo: s.kLo,
        // null = open band. The real upper limit is then the simulation's own
        // Nyquist, which the UI needs simN to express as a wavelength.
        kHi: Number.isFinite(s.kHi) ? s.kHi : null,
        simN: M * ss,
        windSpeed: slotSea.windSpeed,
        fetch: slotSea.fetch,
        detailFloor: slotSea.detailFloor,
        specRms: field.specRms,
        stats: baked.stats,
        width: M,
        texel,
        rgba: baked.rgba,
      });
    }

    self.postMessage({ type: 'done', results }, results.map(r => r.rgba.buffer));
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
