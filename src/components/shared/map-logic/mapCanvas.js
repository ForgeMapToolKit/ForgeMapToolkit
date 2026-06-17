// ── Shared placement-canvas renderer ────────────────────────────────────────────
// Draws the map background, grid, mirror axes and entity points exactly as the
// per-tab canvas effects did. Tab-specific differences (grid style, border rect,
// colour derivation) are expressed through options so behaviour stays identical.

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {number} o.mapSize          playable size (already numeric)
 * @param {number} o.mapOffsetX
 * @param {number} o.mapOffsetY
 * @param {HTMLImageElement|null} o.previewImage
 * @param {string} o.mirrorMode
 * @param {Array}  o.entities
 * @param {number} o.selectedIdx
 * @param {Function} o.getColor       entity => css colour for its points
 * @param {Function} o.getCoords      entity => coordinate array
 * @param {object} [o.grid]           { stroke, span:'full'|'inner', whenPreview:boolean }
 * @param {string} [o.borderRect]     stroke colour for an outer border rect, or null
 */
export function drawPlacementCanvas(ctx, {
  width, height, mapSize, mapOffsetX, mapOffsetY,
  previewImage, mirrorMode, entities, selectedIdx, getColor, getCoords,
  grid = { stroke: 'rgba(255, 255, 255, 0.1)', span: 'full', whenPreview: false },
  borderRect = null,
}) {
  const ms = mapSize || 1024;

  ctx.clearRect(0, 0, width, height);

  const hasPreview = previewImage && previewImage.complete;
  if (hasPreview) {
    ctx.drawImage(previewImage, 0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
  }

  // Grid lines
  if (!hasPreview || grid.whenPreview) {
    ctx.strokeStyle = grid.stroke;
    ctx.lineWidth = 1;
    const step = width / 8;
    const lo = grid.span === 'inner' ? 1 : 0;
    const hi = grid.span === 'inner' ? 7 : 8;
    for (let i = lo; i <= hi; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(width, i * step); ctx.stroke();
    }
  }

  // Mirror axes
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  if (mirrorMode === 'diagonal' || mirrorMode === 'vertical') {
    ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
  }
  if (mirrorMode === 'diagonal' || mirrorMode === 'horizontal') {
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Entity points
  entities.forEach((entity, idx) => {
    const selected = idx === selectedIdx;
    const color = getColor(entity);
    getCoords(entity).forEach((coord) => {
      if (!coord.x || !coord.z) return;
      const x = ((parseFloat(coord.x) - mapOffsetX) / ms) * width;
      const z = ((parseFloat(coord.z) - mapOffsetY) / ms) * height;

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = selected ? 20 : 15;

      ctx.beginPath();
      ctx.arc(x, z, selected ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();

      if (selected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (coord.isMirrored) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 6, z - 6);
        ctx.lineTo(x - 6, z + 6);
        ctx.lineTo(x + 6, z - 6);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
    });
  });

  if (borderRect) {
    ctx.strokeStyle = borderRect;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
  }
}
