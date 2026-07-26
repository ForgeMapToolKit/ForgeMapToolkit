/**
 * exportDds.js — read the output node's texture back and write a DDS.
 *
 * Reuses the suite's existing, quality-measured encoder (electron/modules/dds.js
 * via the allowlisted `write-dds` IPC channel) — the node editor does not
 * reimplement DDS. The renderer's only jobs are: render at target resolution,
 * read the pixels back top-down, and (unless the output node opts out via
 * `params.mipmaps === false`) build a box-filtered mip chain — FA's tiled water
 * layers alias without mips (see the dds.js header), but a 1D WaterRamp lookup
 * is never minified and mips there only blur adjacent depth stops together.
 */

/** Box-downsample an RGBA8 image to half size (min 1px). */
function halve(data, w, h) {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const out = new Uint8Array(nw * nh * 4);
  const sx = w > 1 ? 2 : 1;
  const sy = h > 1 ? 2 : 1;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0, n = 0;
        for (let dy = 0; dy < sy; dy++) {
          for (let dx = 0; dx < sx; dx++) {
            const px = Math.min(w - 1, x * sx + dx);
            const py = Math.min(h - 1, y * sy + dy);
            sum += data[(py * w + px) * 4 + c];
            n++;
          }
        }
        out[(y * nw + x) * 4 + c] = Math.round(sum / n);
      }
    }
  }
  return { data: out, width: nw, height: nh };
}

export function buildMipChain(rgba, w, h) {
  const levels = [{ width: w, height: h, data: rgba }];
  let cur = { data: rgba, width: w, height: h };
  while (cur.width > 1 || cur.height > 1) {
    cur = halve(cur.data, cur.width, cur.height);
    levels.push(cur);
  }
  return levels;
}

/**
 * Evaluate the graph's output node and write it to `<dir>/<filename>.dds`.
 * @returns {Promise<{success, path?, error?, bytes?}>}
 */
export async function exportGraphToDds({ ctx, evaluator, graph, outputId, dir }) {
  const node = graph.nodes[outputId];
  if (!node) return { success: false, error: 'no output node' };

  const target = evaluator.evaluate(graph, outputId);
  if (!target) return { success: false, error: 'output produced no texture' };

  const rgba = ctx.readPixels(target, { flipY: true });
  const levels = node.params.mipmaps === false
    ? [{ width: target.w, height: target.h, data: rgba }]
    : buildMipChain(rgba, target.w, target.h);
  const format = node.params.format === 'DXT5' ? 'DXT5' : 'RGBA';
  const filename = (node.params.filename || 'texture').replace(/[^\w.-]/g, '_');
  const filePath = `${dir.replace(/[\\/]+$/, '')}\\${filename}.dds`;

  const res = await window.electronAPI.invoke('write-dds', {
    filePath,
    levels: levels.map(v => ({ width: v.width, height: v.height, data: v.data })),
    format,
  });
  return res?.success ? { success: true, path: res.path, bytes: res.bytes } : { success: false, error: res?.error || 'write-dds failed' };
}
