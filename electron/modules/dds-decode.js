'use strict';
/**
 * dds-decode.js — synchronous DDS → raw RGBA decoder.
 *
 * props.js already carries a DDS decoder, but it is async and coupled to sharp
 * (it always ends in a PNG encode). The TerrainType auto-paint needs the *raw*
 * per-channel mask values, not a PNG, and needs them synchronously inside the
 * scmap read handler. This module is that decoder: same proven block logic
 * (DXT1/BC1, DXT3/BC2, DXT5/BC3, ATI2/BC5, uncompressed A8R8G8B8) lifted out and
 * returned as a flat RGBA Buffer.
 *
 * Exports: decodeDDSToRGBA(buffer) -> { width, height, data: Buffer } | null
 */

function decodeDXT1Block(src, offset, rgba, bx, by, w) {
  const c0 = src.readUInt16LE(offset), c1 = src.readUInt16LE(offset + 2);
  const r0=(c0>>11&31)*255/31|0, g0=(c0>>5&63)*255/63|0, b0=(c0&31)*255/31|0;
  const r1=(c1>>11&31)*255/31|0, g1=(c1>>5&63)*255/63|0, b1=(c1&31)*255/31|0;
  const cr=[r0,r1,0,0], cg=[g0,g1,0,0], cb=[b0,b1,0,0], ca=[255,255,255,255];
  if (c0 > c1) {
    cr[2]=(2*r0+r1)/3|0; cg[2]=(2*g0+g1)/3|0; cb[2]=(2*b0+b1)/3|0;
    cr[3]=(r0+2*r1)/3|0; cg[3]=(g0+2*g1)/3|0; cb[3]=(b0+2*b1)/3|0;
  } else {
    cr[2]=(r0+r1)/2|0; cg[2]=(g0+g1)/2|0; cb[2]=(b0+b1)/2|0;
    cr[3]=0; cg[3]=0; cb[3]=0; ca[3]=0;
  }
  const bits = src.readUInt32LE(offset + 4);
  for (let py=0; py<4; py++) for (let px=0; px<4; px++) {
    const x=bx+px, y=by+py; if (x>=w) continue;
    const idx=(bits>>(2*(py*4+px)))&3, p=(y*w+x)*4;
    rgba[p]=cr[idx]; rgba[p+1]=cg[idx]; rgba[p+2]=cb[idx]; rgba[p+3]=ca[idx];
  }
}

function decodeDXT3Block(src, offset, rgba, bx, by, w) {
  const alphaLo=src.readUInt32LE(offset), alphaHi=src.readUInt32LE(offset+4);
  decodeDXT1Block(src, offset+8, rgba, bx, by, w);
  for (let py=0; py<4; py++) for (let px=0; px<4; px++) {
    const x=bx+px, y=by+py; if (x>=w) continue;
    const i=py*4+px, word=i<8?alphaLo:alphaHi, shift=(i%8)*4;
    rgba[(y*w+x)*4+3]=((word>>shift)&0xF)*17;
  }
}

function decodeDXT5Block(src, offset, rgba, bx, by, w) {
  const a0=src[offset], a1=src[offset+1];
  const ab=Buffer.from([src[offset+2],src[offset+3],src[offset+4],src[offset+5],src[offset+6],src[offset+7]]);
  const at=[a0,a1,0,0,0,0,0,0];
  if (a0>a1){for(let i=2;i<8;i++)at[i]=((8-i)*a0+(i-1)*a1)/7|0;}
  else{for(let i=2;i<6;i++)at[i]=((6-i)*a0+(i-1)*a1)/5|0;at[6]=0;at[7]=255;}
  decodeDXT1Block(src, offset+8, rgba, bx, by, w);
  let bits=0n;
  for(let i=5;i>=0;i--) bits=(bits<<8n)|BigInt(ab[i]);
  for(let py=0;py<4;py++) for(let px=0;px<4;px++){
    const x=bx+px, y=by+py; if(x>=w) continue;
    const i=py*4+px;
    rgba[(y*w+x)*4+3]=at[Number((bits>>(BigInt(i)*3n))&7n)];
  }
}

/**
 * Decode a DDS buffer to a flat RGBA Buffer (width*height*4 bytes).
 * Returns null for an unrecognised header / unsupported fourCC.
 */
function decodeDDSToRGBA(ddsBuffer) {
  if (!Buffer.isBuffer(ddsBuffer)) ddsBuffer = Buffer.from(ddsBuffer);
  if (ddsBuffer.length < 128 || ddsBuffer.toString('ascii', 0, 4) !== 'DDS ') return null;

  const height = ddsBuffer.readUInt32LE(12);
  const width  = ddsBuffer.readUInt32LE(16);
  const fourCC = ddsBuffer.readUInt32LE(84);
  const rgba   = Buffer.alloc(width * height * 4, 0);

  // Uncompressed A8R8G8B8 / X8R8G8B8 (stored BGRA byte order)
  if (fourCC === 0) {
    const bpp   = ddsBuffer.readUInt32LE(88);
    const bytes = bpp / 8;
    for (let i = 0; i < width * height; i++) {
      const s = 128 + i * bytes;
      rgba[i*4]   = ddsBuffer[s+2] ?? 0; // R
      rgba[i*4+1] = ddsBuffer[s+1] ?? 0; // G
      rgba[i*4+2] = ddsBuffer[s]   ?? 0; // B
      rgba[i*4+3] = bytes >= 4 ? (ddsBuffer[s+3] ?? 255) : 255;
    }
    return { width, height, data: rgba };
  }

  const fourCCStr = Buffer.from([
    fourCC&0xFF, (fourCC>>8)&0xFF, (fourCC>>16)&0xFF, (fourCC>>24)&0xFF,
  ]).toString('ascii');

  const bw = Math.ceil(width/4), bh = Math.ceil(height/4);
  if (fourCCStr === 'DXT1') {
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++)
      decodeDXT1Block(ddsBuffer, 128+(by*bw+bx)*8, rgba, bx*4, by*4, width);
  } else if (fourCCStr === 'DXT3') {
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++)
      decodeDXT3Block(ddsBuffer, 128+(by*bw+bx)*16, rgba, bx*4, by*4, width);
  } else if (fourCCStr === 'DXT5') {
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++)
      decodeDXT5Block(ddsBuffer, 128+(by*bw+bx)*16, rgba, bx*4, by*4, width);
  } else if (fourCCStr === 'ATI2' || fourCCStr === 'BC5S') {
    // Two BC4 channels (R=X, G=Y). Rare for masks but supported for completeness.
    for (let by=0;by<bh;by++) for (let bx=0;bx<bw;bx++) {
      const off=128+(by*bw+bx)*16;
      const r0=ddsBuffer[off],r1=ddsBuffer[off+1];
      const rb=ddsBuffer.slice(off+2,off+8);
      const rt=[r0,r1,0,0,0,0,0,0];
      if(r0>r1){for(let i=2;i<8;i++)rt[i]=((8-i)*r0+(i-1)*r1)/7|0;}
      else{for(let i=2;i<6;i++)rt[i]=((6-i)*r0+(i-1)*r1)/5|0;rt[6]=0;rt[7]=255;}
      const g0=ddsBuffer[off+8],g1=ddsBuffer[off+9];
      const gb=ddsBuffer.slice(off+10,off+16);
      const gt=[g0,g1,0,0,0,0,0,0];
      if(g0>g1){for(let i=2;i<8;i++)gt[i]=((8-i)*g0+(i-1)*g1)/7|0;}
      else{for(let i=2;i<6;i++)gt[i]=((6-i)*g0+(i-1)*g1)/5|0;gt[6]=0;gt[7]=255;}
      let rbits=0n; for(let i=5;i>=0;i--) rbits=(rbits<<8n)|BigInt(rb[i]);
      let gbits=0n; for(let i=5;i>=0;i--) gbits=(gbits<<8n)|BigInt(gb[i]);
      for(let py=0;py<4;py++) for(let px=0;px<4;px++){
        const x=bx+px,y=by+py; if(x>=width) continue;
        const i=py*4+px, p=(y*width+x)*4;
        rgba[p]  =rt[Number((rbits>>(BigInt(i)*3n))&7n)];
        rgba[p+1]=gt[Number((gbits>>(BigInt(i)*3n))&7n)];
        rgba[p+2]=128; rgba[p+3]=255;
      }
    }
  } else {
    return null;
  }

  return { width, height, data: rgba };
}

module.exports = { decodeDDSToRGBA };
