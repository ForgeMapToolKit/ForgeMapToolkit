'use strict';
/**
 * scmap-utils.js
 * Pure Node.js translation of the LÖVE/Lua BrewMapTool scmap parser + writer.
 * Handles Supreme Commander Forged Alliance .scmap binary format.
 *
 * Translated from:
 *   utils/maths.lua, utils/scmap.lua, utils/fileformats.lua, utils/table.lua
 */

const fs   = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// BINARY READER
// ═══════════════════════════════════════════════════════════════════════════

class BinReader {
  constructor(buf) {
    this.buf    = buf instanceof Buffer ? buf : Buffer.from(buf);
    this.offset = 0;
  }

  get size()       { return this.buf.length; }
  remaining()      { return this.buf.length - this.offset; }

  readBytes(n) {
    if (n === 0) return Buffer.alloc(0);
    if (n < 0)   throw new Error(`readBytes: negative n=${n} at offset ${this.offset}`);
    const slice = this.buf.slice(this.offset, this.offset + n);
    this.offset += n;
    return slice;
  }

  peekBytes(n) {
    return this.buf.slice(this.offset, this.offset + n);
  }

  int()   { const v = this.buf.readInt32LE(this.offset);   this.offset += 4; return v; }
  uint()  { const v = this.buf.readUInt32LE(this.offset);  this.offset += 4; return v; }
  float() { const v = this.buf.readFloatLE(this.offset);   this.offset += 4; return v; }
  short() { const v = this.buf.readUInt16LE(this.offset);  this.offset += 2; return v; }
  byte()  { const v = this.buf.readUInt8(this.offset);     this.offset += 1; return v; }

  vec2()  { return [this.float(), this.float()]; }
  vec3()  { return [this.float(), this.float(), this.float()]; }
  vec4()  { return [this.float(), this.float(), this.float(), this.float()]; }

  stringNull() {
    let str = '';
    while (this.offset < this.buf.length) {
      const b = this.buf[this.offset++];
      if (b === 0) break;
      str += String.fromCharCode(b);
    }
    return str;
  }

  // Read n bytes and return as hex string (like Lua math.formatBytes)
  readHex4() {
    const b = this.readBytes(4);
    return b[0].toString(16).padStart(2,'0') +
           b[1].toString(16).padStart(2,'0') +
           b[2].toString(16).padStart(2,'0') +
           b[3].toString(16).padStart(2,'0');
  }

  // Read length-prefixed binary blob
  intFile() {
    const len  = this.int();
    const data = this.readBytes(len);
    return { data, format: getFormat(data) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BINARY WRITER
// ═══════════════════════════════════════════════════════════════════════════

class BinWriter {
  constructor() { this.parts = []; }

  push(buf) {
    if (typeof buf === 'string') buf = Buffer.from(buf, 'binary');
    this.parts.push(buf);
    return this;
  }

  int(v)   { const b = Buffer.alloc(4); b.writeInt32LE(v,  0); return this.push(b); }
  uint(v)  { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return this.push(b); }
  float(v) { const b = Buffer.alloc(4); b.writeFloatLE(v,  0); return this.push(b); }
  short(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); return this.push(b); }
  byte(v)  { return this.push(Buffer.from([v & 0xff])); }

  vec2(a)  { return this.float(a[0]).float(a[1]); }
  vec3(a)  { return this.float(a[0]).float(a[1]).float(a[2]); }
  vec4(a)  { return this.float(a[0]).float(a[1]).float(a[2]).float(a[3]); }

  stringNull(s) { return this.push(Buffer.from((s || '') + '\x00', 'binary')); }

  // Write length-prefixed binary blob
  intFile(data) {
    if (typeof data === 'string') data = Buffer.from(data, 'binary');
    return this.int(data.length).push(data);
  }

  // Write hex string back as 4 bytes (reverse of readHex4)
  hex4(hex) {
    const b = Buffer.from([
      parseInt(hex.slice(0,2),  16),
      parseInt(hex.slice(2,4),  16),
      parseInt(hex.slice(4,6),  16),
      parseInt(hex.slice(6,8),  16),
    ]);
    return this.push(b);
  }

  toBuffer() { return Buffer.concat(this.parts); }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE FORMAT DETECTION  (utils/fileformats.lua)
// ═══════════════════════════════════════════════════════════════════════════

function getFormat(buf) {
  if (!buf || buf.length < 4) return 'unknown';
  // DDS: magic "DDS " = 0x44 44 53 20
  if (buf[0]===0x44 && buf[1]===0x44 && buf[2]===0x53 && buf[3]===0x20) return 'dds';
  // PNG: 0x89 50 4E 47 0D 0A 1A 0A
  if (buf.length>=8 && buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4E && buf[3]===0x47) return 'png';
  // JPG: FF D8 ... FF D9
  if (buf[0]===0xFF && buf[1]===0xD8 && buf[buf.length-2]===0xFF && buf[buf.length-1]===0xD9) return 'jpg';
  // TGA: ends with "TRUEVISION-XFILE.\0"
  if (buf.length>=18) {
    const tail = buf.slice(buf.length-18).toString('binary');
    if (tail === 'TRUEVISION-XFILE.\x00') return 'tga';
  }
  // INDEX (arbitrary index file)
  if (buf.length>=5 && buf.toString('binary',0,5) === 'INDEX') return 'index';
  return 'unknown';
}

function isDDS(buf)   { return getFormat(buf) === 'dds'; }
function isIndex(buf) { return getFormat(buf) === 'index'; }

// INDEX binary format helpers  (fileformats.lua)
function indexBinToLua(buf) {
  const count  = buf.readInt32LE(5);
  let   offset = 9;
  const array  = [];
  for (let i = 0; i < count; i++) {
    let str = '';
    while (offset < buf.length && buf[offset] !== 0) {
      str += String.fromCharCode(buf[offset++]);
    }
    offset++; // null terminator
    array.push(str);
  }
  return array;
}

function indexLuaToBin(array) {
  const w = new BinWriter();
  w.push(Buffer.from('INDEX', 'binary'));
  w.int(array.length);
  for (const s of array) w.stringNull(s);
  return w.toBuffer();
}

// ═══════════════════════════════════════════════════════════════════════════
// LUA SERIALIZER  (utils/table.lua  →  table.serialize)
// ═══════════════════════════════════════════════════════════════════════════

const LUA_RESERVED = new Set([
  'and','break','do','else','elseif','goto','end','false','for','function',
  'if','in','local','global','nil','not','or','repeat','return','then',
  'true','until','while'
]);

function luaSerialize(val, key, depth) {
  depth = depth || 0;
  const indent = '    '.repeat(depth);
  let prefix = indent;

  if (typeof key !== 'number') {
    prefix += (key != null ? key + ' = ' : 'return ');
  }

  const t = typeof val;

  if (t === 'object' && val !== null && !Buffer.isBuffer(val)) {
    // Native JS arrays (0-based) → serialize as 1-based Lua sequences
    if (Array.isArray(val)) {
      if (val.length === 0) return prefix + '{}';
      let out = prefix + '{\n';
      let seqIdx = 0;
      for (const item of val) {
        out += luaSerialize(item, seqIdx++, depth+1) + ',\n';
      }
      out += indent + '}';
      return out;
    }

    const keys = Object.keys(val);
    if (keys.length === 0) return prefix + '{}';

    // Detect integer-indexed Lua array — either:
    //   1-based {1:x, 2:y, 3:z} from parseLuaDataFile (original Lua files)
    //   0-based {0:x, 1:y, 2:z} from broken prior serialization
    const numKeys = keys.map(Number);
    const allInts = numKeys.every(k => Number.isInteger(k) && k >= 0);
    const sorted0 = numKeys.slice().sort((a,b)=>a-b);
    const isZeroBased = allInts && sorted0[0] === 0 && sorted0.every((v,i) => v === i);
    const isOneBased  = allInts && sorted0[0] === 1 && sorted0.every((v,i) => v === i+1);
    const isArray = isZeroBased || isOneBased;

    let out = prefix + '{\n';
    if (isArray) {
      // Always write as 1-based Lua sequence (no explicit keys)
      // Pass index as numeric key so luaSerialize doesn't emit 'return' prefix
      let seqIdx = 0;
      for (const i of sorted0) {
        out += luaSerialize(val[i], seqIdx++, depth+1) + ',\n';
      }
    } else {
      const sorted = keys.slice().sort((a,b) => String(a) < String(b) ? -1 : 1);
      for (const k of sorted) {
        let luaKey = k;
        if (/^\d/.test(k) || /[^a-zA-Z0-9_]/.test(k) || LUA_RESERVED.has(k)) {
          luaKey = `[${JSON.stringify(k)}]`;
        }
        out += luaSerialize(val[k], luaKey, depth+1) + ',\n';
      }
    }
    out += indent + '}';
    return out;

  } else if (t === 'number') {
    return prefix + (Number.isFinite(val) ? String(val) : '0');
  } else if (t === 'boolean') {
    return prefix + String(val);
  } else if (t === 'string') {
    return prefix + luaQuoteString(val);
  } else {
    return prefix + luaQuoteString(String(val));
  }
}

function luaQuoteString(s) {
  // Use Lua long strings for binary-heavy content, otherwise standard quotes
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/"/g,  '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '\\0');
  return `"${escaped}"`;
}

// ═══════════════════════════════════════════════════════════════════════════
// LUA PARSER  (for reading data.lua files written by BrewMapTool)
// ═══════════════════════════════════════════════════════════════════════════

function parseLuaDataFile(src) {
  // Strip "return " prefix
  src = src.trim();
  if (src.startsWith('return ')) src = src.slice(7);
  return parseLuaValue(src, { pos: 0 });
}

function parseLuaValue(src, ctx) {
  skipWhitespaceAndComments(src, ctx);
  const c = src[ctx.pos];

  if (c === '{')    return parseLuaTable(src, ctx);
  if (c === '"' || c === "'") return parseLuaString(src, ctx);
  if (src.slice(ctx.pos, ctx.pos+2) === '[[') return parseLuaLongString(src, ctx);
  if (c === '-' || (c >= '0' && c <= '9')) return parseLuaNumber(src, ctx);
  // true / false / nil
  const word = src.slice(ctx.pos).match(/^(true|false|nil)\b/);
  if (word) {
    ctx.pos += word[1].length;
    return word[1] === 'true' ? true : word[1] === 'false' ? false : null;
  }
  throw new Error(`parseLuaValue: unexpected char '${c}' at pos ${ctx.pos}: ...${src.slice(ctx.pos,ctx.pos+40)}`);
}

function parseLuaTable(src, ctx) {
  ctx.pos++; // skip {
  const obj = {};
  let arrayIndex = 1;

  while (true) {
    skipWhitespaceAndComments(src, ctx);
    if (ctx.pos >= src.length || src[ctx.pos] === '}') { ctx.pos++; break; }
    if (src[ctx.pos] === ',') { ctx.pos++; continue; }

    // Key detection
    let key = null;

    // [expr] = ...
    if (src[ctx.pos] === '[' && src[ctx.pos+1] !== '[') {
      ctx.pos++; // skip [
      key = parseLuaValue(src, ctx);
      skipWhitespaceAndComments(src, ctx);
      ctx.pos++; // skip ]
      skipWhitespaceAndComments(src, ctx);
      ctx.pos++; // skip =
    }
    // ident = ...
    else {
      const m = src.slice(ctx.pos).match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (m) {
        key = m[1];
        ctx.pos += m[0].length;
      }
    }

    const val = parseLuaValue(src, ctx);
    if (key != null) {
      obj[key] = val;
    } else {
      obj[arrayIndex++] = val;
    }
  }
  return obj;
}

function parseLuaString(src, ctx) {
  const q   = src[ctx.pos++];
  let   str = '';
  while (ctx.pos < src.length) {
    const c = src[ctx.pos];
    if (c === q) { ctx.pos++; break; }
    if (c === '\\') {
      ctx.pos++;
      const e = src[ctx.pos++];
      if      (e === 'n')  str += '\n';
      else if (e === 'r')  str += '\r';
      else if (e === 't')  str += '\t';
      else if (e === '0')  str += '\0';
      else if (e === '\\') str += '\\';
      else if (e === '"')  str += '"';
      else if (e === "'")  str += "'";
      else if (/\d/.test(e)) {
        let num = e;
        if (/\d/.test(src[ctx.pos]))   num += src[ctx.pos++];
        if (/\d/.test(src[ctx.pos]))   num += src[ctx.pos++];
        str += String.fromCharCode(parseInt(num,10));
      } else str += e;
    } else {
      str += c;
      ctx.pos++;
    }
  }
  return str;
}

function parseLuaLongString(src, ctx) {
  // find level: [==[ etc
  let level = 0;
  ctx.pos += 2; // skip [[
  while (src[ctx.pos] === '=') { level++; ctx.pos++; }
  if (src[ctx.pos] === '[') ctx.pos++; // skip final [
  const end = ']' + '='.repeat(level) + ']';
  const i   = src.indexOf(end, ctx.pos);
  if (i < 0) throw new Error('parseLuaLongString: no closing bracket');
  const str = src.slice(ctx.pos, i);
  ctx.pos   = i + end.length;
  return str.startsWith('\n') ? str.slice(1) : str;
}

function parseLuaNumber(src, ctx) {
  const m = src.slice(ctx.pos).match(/^-?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/);
  if (!m) throw new Error(`parseLuaNumber: failed at ${ctx.pos}`);
  ctx.pos += m[0].length;
  return parseFloat(m[0]);
}

function skipWhitespaceAndComments(src, ctx) {
  while (ctx.pos < src.length) {
    // whitespace
    if (/\s/.test(src[ctx.pos])) { ctx.pos++; continue; }
    // line comment
    if (src.slice(ctx.pos, ctx.pos+2) === '--' && src.slice(ctx.pos, ctx.pos+4) !== '--[[') {
      while (ctx.pos < src.length && src[ctx.pos] !== '\n') ctx.pos++;
      continue;
    }
    // long comment  --[[ ... ]]
    if (src.slice(ctx.pos, ctx.pos+4) === '--[[') {
      ctx.pos += 4;
      const i = src.indexOf(']]', ctx.pos);
      ctx.pos = i < 0 ? src.length : i+2;
      continue;
    }
    break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCMAP READER  (scmap.lua → scmapUtils.readDatastream)
// ═══════════════════════════════════════════════════════════════════════════

const SCMAP_HEADER = [
  Buffer.from('Map\x1a',             'binary'),
  Buffer.from('\x02\x00\x00\x00',   'binary'),
  Buffer.from('\xed\xfe\xef\xbe',   'binary'),
];

function validateHeader(r) {
  const h0 = r.readBytes(4);
  const h1 = r.readBytes(4);
  const h2 = r.readBytes(4);
  const h3 = r.readBytes(4);
  return h0.equals(SCMAP_HEADER[0]) &&
         h1.equals(SCMAP_HEADER[1]) &&
         h2.equals(SCMAP_HEADER[2]) &&
         h3.equals(SCMAP_HEADER[1]);
}

function readDatastream(buf) {
  const r = new BinReader(buf);

  if (!validateHeader(r)) throw new Error('Invalid scmap header');

  const data = {};

  r.float(); // floatWidth  (discarded)
  r.float(); // floatHeight (discarded)

  const padding = r.readBytes(6);
  if (!padding.equals(Buffer.alloc(6))) throw new Error('Missing padding after dimensions');

  data.previewImage = r.intFile();

  data.version = r.int();
  if (data.version !== 56 && data.version !== 60)
    throw new Error(`Unexpected scmap version: ${data.version}`);

  data.size          = [r.int(), r.int()];
  data.heightmapScale = r.float();
  const hmSize       = (data.size[0]+1) * (data.size[1]+1) * 2;
  data.heightmap     = { data: r.readBytes(hmSize), format: 'raw' };
  const hmNull       = r.readBytes(1);
  if (hmNull[0] !== 0) throw new Error('Missing null terminator after heightmap');

  data.shaderPath     = r.stringNull();
  data.backgroundPath = r.stringNull();
  data.skyCubePath    = r.stringNull();

  const cubeMapCount  = r.int();
  data.cubeMaps       = [];
  for (let i = 0; i < cubeMapCount; i++) {
    data.cubeMaps.push({ name: r.stringNull(), path: r.stringNull() });
  }

  data.lightingSettings = {
    lightingMultiplier: r.float(),
    sunDirection:       r.vec3(),
    sunAmbience:        r.vec3(),
    sunColor:           r.vec3(),
    shadowFillColor:    r.vec3(),
    specularColor:      r.vec4(),
    bloom:              r.float(),
    fogColor:           r.vec3(),
    fogStart:           r.float(),
    fogEnd:             r.float(),
  };

  data.waterSettings = {
    waterPresent:    r.byte() === 1,
    elevation:       r.float(),
    elevationDeep:   r.float(),
    elevationAbyss:  r.float(),
    surfaceColor:    r.vec3(),
    colorLerp:       r.vec2(),
    refractionScale: r.float(),
    fresnelBias:     r.float(),
    fresnelPower:    r.float(),
    unitReflection:  r.float(),
    skyReflection:   r.float(),
    sunShininess:    r.float(),
    sunStrength:     r.float(),
    sunDirection:    r.vec3(),
    sunColor:        r.vec3(),
    sunReflection:   r.float(),
    sunGlow:         r.float(),
    texPathCubeMap:  r.stringNull(),
    texPathWaterRamp: r.stringNull(),
    waveNormalRepeats: r.vec4(),
    waveTextures: [0,1,2,3].map(() => ({ movement: r.vec2(), path: r.stringNull() })),
  };

  const waveGenCount  = r.int();
  data.waveGenerators = [];
  for (let i = 0; i < waveGenCount; i++) {
    data.waveGenerators.push({
      textureName:      r.stringNull(),
      rampName:         r.stringNull(),
      position:         r.vec3(),
      rotation:         r.float(),
      velocity:         r.vec3(),
      lifeTimeFirst:    r.float(),
      lifeTimeSecond:   r.float(),
      periodFirst:      r.float(),
      periodSecond:     r.float(),
      scaleFirst:       r.float(),
      scaleSecond:      r.float(),
      frameCount:       r.float(),
      frameRateFirst:   r.float(),
      frameRateSecond:  r.float(),
      stripCount:       r.float(),
    });
  }

  data.miniMapContourInterval   = r.int();
  data.miniMapDeepWaterColor    = r.readHex4();
  data.miniMapContourColor      = r.readHex4();
  data.miniMapShoreColor        = r.readHex4();
  data.miniMapLandStartColor    = r.readHex4();
  data.miniMapLandEndColor      = r.readHex4();

  if (data.version > 56) {
    data.unknownFA = r.readHex4();
  }

  data.textures = [];
  data.normals  = [];
  for (let i = 0; i < 10; i++) data.textures.push({ path: r.stringNull(), scale: r.float() });
  for (let i = 0; i < 9;  i++) data.normals.push(  { path: r.stringNull(), scale: r.float() });

  data.unknown1 = r.readHex4();
  data.unknown2 = r.readHex4();

  const decalCount = r.int();
  data.decals = [];
  for (let i = 0; i < decalCount; i++) {
    const decal = { id: r.int(), type: r.int(), textures: [] };
    const texCount = r.int();
    for (let j = 0; j < texCount; j++) {
      const len = r.int();
      decal.textures.push(r.readBytes(len).toString('binary'));
    }
    decal.scale      = r.vec3();
    decal.position   = r.vec3();
    decal.rotation   = r.vec3();
    decal.LODCutoff  = r.float();
    decal.LODCutoffMin = r.float();
    decal.army       = r.int();
    data.decals.push(decal);
  }

  const decalGroupCount = r.int();
  data.decalGroups = [];
  for (let i = 0; i < decalGroupCount; i++) {
    const group = { id: r.int(), name: r.stringNull(), data: [] };
    const cnt   = r.int();
    for (let j = 0; j < cnt; j++) group.data.push(r.int());
    data.decalGroups.push(group);
  }

  r.int(); // intWidth  (discarded)
  r.int(); // intHeight (discarded)

  const arbitraryCount = r.int();
  if (arbitraryCount === 1 && isDDS(r.peekBytes(9).slice(4))) {
    data.normalMap = r.intFile();
  } else if (arbitraryCount > 0) {
    data.arbitrary = [];
    let remaining  = arbitraryCount;
    const peeked   = r.peekBytes(9).slice(4);
    if (isIndex(peeked)) {
      const lenFile = r.int();
      const raw     = r.readBytes(lenFile);
      const index   = indexBinToLua(raw);
      data.arbitrary.push({ data: Buffer.from(luaSerialize(index.reduce((a,v,i)=>{a[i+1]=v;return a;},{})), 'utf8'), format: 'lua', filename: 'index.lua' });
      remaining--;
    }
    for (let i = 0; i < remaining; i++) {
      const file = r.intFile();
      if (data.arbitrary.length > 0 && data.arbitrary[0].format === 'lua') {
        // has index — filename from index
        const idx   = parseLuaDataFile(data.arbitrary[0].data.toString('utf8'));
        const keys  = Object.keys(idx).map(Number).sort((a,b)=>a-b);
        file.filename = idx[keys[i]] || null;
      }
      data.arbitrary.push(file);
    }
  }

  data.textureMaskLow  = r.intFile();
  data.textureMaskHigh = r.intFile();

  const utilityCount = r.int();
  if (utilityCount === 1) {
    data.waterMap = r.intFile();
  } else if (utilityCount > 1) {
    data.utilityTextures = [];
    for (let i = 0; i < utilityCount; i++) data.utilityTextures.push(r.intFile());
  }

  const halfSize           = (data.size[0]/2) * (data.size[1]/2);
  data.waterFoamMask       = { data: r.readBytes(halfSize), format: 'raw' };
  data.waterFlatness       = { data: r.readBytes(halfSize), format: 'raw' };
  data.waterDepthBiasMask  = { data: r.readBytes(halfSize), format: 'raw' };
  data.terrainType         = { data: r.readBytes(data.size[0] * data.size[1]), format: 'raw' };

  if (data.version >= 60) {
    data.skyBox = {
      position:            r.vec3(),
      horizonHeight:       r.float(),
      scale:               r.float(),
      subHeight:           r.float(),
      subDivAx:            r.int(),
      subDivHeight:        r.int(),
      zenithHeight:        r.float(),
      horizonColor:        r.vec3(),
      zenithColor:         r.vec3(),
      decalGlowMultiplier: r.float(),
      albedo:              r.stringNull(),
      glow:                r.stringNull(),
      planets:             [],
    };
    const planetCount = r.int();
    for (let i = 0; i < planetCount; i++) {
      data.skyBox.planets.push({
        position: r.vec3(),
        rotation: r.float(),
        scale:    r.vec2(),
        uv:       r.vec4(),
      });
    }
    data.skyBox.midColor        = [r.byte(), r.byte(), r.byte()];
    data.skyBox.cirrusMultiplier = r.float();
    data.skyBox.cirrusColor      = r.vec3();
    data.skyBox.cirrusTexture    = r.stringNull();
    data.skyBox.cirrusLayers     = [];
    const cirrusCount            = r.int();
    for (let i = 0; i < cirrusCount; i++) {
      data.skyBox.cirrusLayers.push({
        frequency: r.vec2(),
        speed:     r.float(),
        direction: r.vec2(),
      });
    }
    data.skyBox.clouds7 = r.float();
  }

  const propCount = r.int();
  data.props      = [];
  for (let i = 0; i < propCount; i++) {
    data.props.push({
      path:      r.stringNull(),
      position:  r.vec3(),
      rotationX: r.vec3(),
      rotationY: r.vec3(),
      rotationZ: r.vec3(),
      scale:     r.vec3(),
    });
  }

  console.log(`[scmap] Parsed ${r.offset} of ${r.size} bytes`);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT  (scmap.lua → scmapUtils.exportScmapData)
// Writes unpacked folder to disk — identical structure to BrewMapTool output
// ═══════════════════════════════════════════════════════════════════════════

function exportScmapData(data, folderPath, onProgress) {
  fs.mkdirSync(folderPath, { recursive: true });
  const progress = onProgress || (() => {});

  // Write binary blobs that have __format
  const blobKeys = ['previewImage','heightmap','textureMaskLow','textureMaskHigh',
                    'waterMap','waterFoamMask','waterFlatness','waterDepthBiasMask',
                    'terrainType','normalMap'];

  for (const k of blobKeys) {
    if (!data[k]) continue;
    progress(`Writing ${k}`);
    const entry = data[k];
    fs.writeFileSync(path.join(folderPath, `${k}.${entry.format}`), entry.data);
    delete data[k];
  }

  // arbitrary / utilityTextures sub-folders
  for (const folderName of ['arbitrary','utilityTextures']) {
    if (!data[folderName]) continue;
    const subDir = path.join(folderPath, folderName);
    fs.mkdirSync(subDir, { recursive: true });
    for (const file of data[folderName]) {
      const filename = file.filename ||
        `_utilityc${data[folderName].indexOf(file)}.${file.format}`;
      progress(`Writing ${folderName}/${filename}`);
      fs.writeFileSync(path.join(subDir, filename), file.data);
    }
    delete data[folderName];
  }

  // Split large arrays (waveGenerators, decals, props) just like BrewMapTool
  const LIMITS = { waveGenerators: 750, decals: 920, props: 870 };
  for (const [set, limit] of Object.entries(LIMITS)) {
    if (!data[set]) continue;
    const arr   = toArray(data[set]); // normalise Lua obj → JS array
    const count = arr.length;
if (count > 0 && count <= limit) {
  progress(`Writing ${set}.lua`);
  fs.writeFileSync(
    path.join(folderPath, `${set}.lua`),
    luaSerialize(arrayToLuaObj(arr))
  );
  delete data[set];
} else if (count > limit) {
      const chunks = Math.ceil(count / limit);
      for (let k = 0; k < chunks; k++) {
        const subset = arr.slice(k*limit, (k+1)*limit);
        progress(`Writing ${set}${k+1}.lua`);
        fs.writeFileSync(
          path.join(folderPath, `${set}${k+1}.lua`),
          luaSerialize(arrayToLuaObj(subset))
        );
      }
      delete data[set];
    }
  }

  // Write main data.lua
  progress('Writing data.lua');
  fs.writeFileSync(path.join(folderPath, 'data.lua'), luaSerialize(data));

  progress('Done');
}

// Convert JS array to 1-based Lua-style object for serialization
function arrayToLuaObj(arr) {
  const obj = {};
  arr.forEach((v,i) => { obj[i+1] = v; });
  return obj;
}

// Convert a Lua-parsed object (1-based integer keys) OR a real JS array
// into a guaranteed JS array. Safe to call on anything from data.lua.
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') {
    const keys = Object.keys(val).map(Number).filter(n => !isNaN(n) && n >= 1);
    if (!keys.length) return [];
    keys.sort((a, b) => a - b);
    return keys.map(k => val[k]);
  }
  return [];
}

// Normalise a vec2/vec3/vec4 that may be stored as {1:x,2:y,...} in Lua
function toVec(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null)
    return Object.keys(val).map(Number).sort((a,b)=>a-b).map(k => val[k]);
  return val;
}

// ═══════════════════════════════════════════════════════════════════════════
// PACK  (scmap.lua → scmapUtils.writeDatastream)
// Reads an unpacked folder and produces a .scmap Buffer
// ═══════════════════════════════════════════════════════════════════════════

function readFolderFiles(folderPath) {
  const files = {};
  const entries = fs.readdirSync(folderPath);

  // Required binary blobs
  const blobNames = [
    'heightmap.raw', 'previewImage', 'terrainType.raw',
    'textureMaskHigh', 'textureMaskLow',
    'waterDepthBiasMask.raw', 'waterFlatness.raw', 'waterFoamMask.raw',
  ];
  const optionalBlobs = ['normalMap', 'waterMap'];

  for (const entry of entries) {
    const full     = path.join(folderPath, entry);
    const baseName = entry.replace(/\.[^.]+$/, '');
    const ext      = entry.split('.').pop().toLowerCase();

    // data.lua and split variants
    if (entry === 'data.lua') {
      files['data.lua'] = parseLuaDataFile(fs.readFileSync(full, 'utf8'));
      continue;
    }

    // Split data files (waveGenerators1.lua, props2.lua, etc.)
    const splitMatch = entry.match(/^([a-zA-Z]+)(\d+)\.lua$/);
    if (splitMatch) {
      const key = splitMatch[1];
      const idx = parseInt(splitMatch[2]);
      if (!files._splits) files._splits = {};
      if (!files._splits[key]) files._splits[key] = {};
      files._splits[key][idx] = parseLuaDataFile(fs.readFileSync(full, 'utf8'));
      continue;
    }

    // Single split file (waveGenerators.lua, props.lua, decals.lua)
    if (ext === 'lua' && ['waveGenerators','props','decals'].includes(baseName)) {
      files[baseName] = parseLuaDataFile(fs.readFileSync(full, 'utf8'));
      continue;
    }

    // Binary blobs — match by base or full name
    const isRequired = blobNames.some(b => b === entry || b.startsWith(baseName));
    const isOptional = optionalBlobs.some(b => entry.startsWith(b));
    if (isRequired || isOptional) {
      files[entry] = fs.readFileSync(full);
      continue;
    }
  }

  // Merge splits back into data.lua
  // Split files (props1.lua, props2.lua, …) REPLACE data.lua[key] entirely —
  // they are the authoritative source; data.lua[key] is only used when no
  // split files exist at all.
  if (files._splits && files['data.lua']) {
    for (const [key, chunks] of Object.entries(files._splits)) {
      const sorted = Object.keys(chunks).map(Number).sort((a, b) => a - b);
      const merged = [];
      for (const i of sorted) {
        merged.push(...toArray(chunks[i]));
      }
      // REPLACE — do not append to data.lua[key]
      files['data.lua'][key] = merged;
    }
    delete files._splits;
  }

  // Also handle single split files (waveGenerators.lua, props.lua, decals.lua)
  // These REPLACE data.lua[key] — but only if no numbered splits (props1.lua etc.)
  // already handled this key. Splits take priority over the single file.
  for (const key of ['waveGenerators', 'props', 'decals']) {
    if (files[key]) {
      if (!files['data.lua']) throw new Error('data.lua missing');
      // Only apply if splits didn't already populate this key
      if (!Array.isArray(files['data.lua'][key]) || files['data.lua'][key].length === 0) {
        files['data.lua'][key] = toArray(files[key]);
      } else {
        // Splits exist — append single file entries to them (props.lua = original,
        // props1.lua+ = toolkit additions; all should end up in the scmap)
        files['data.lua'][key] = [...toArray(files[key]), ...files['data.lua'][key]];
      }
      delete files[key];
    }
  }

  // arbitrary and utilityTextures sub-folders
  for (const subName of ['arbitrary','utilityTextures']) {
    const subDir = path.join(folderPath, subName);
    if (fs.existsSync(subDir)) {
      const subEntries = fs.readdirSync(subDir).sort();
      files[subName] = [];

      // Check for index.lua
      let index = null;
      const indexFile = subEntries.find(e => e === 'index.lua');
      if (indexFile) {
        index = parseLuaDataFile(fs.readFileSync(path.join(subDir, indexFile), 'utf8'));
      }

      if (index) {
        // Write index as binary first
        const idxArr = Object.keys(index).map(Number).sort((a,b)=>a-b).map(k=>index[k]);
        files[subName].push(indexLuaToBin(idxArr));
      }

      for (const e of subEntries) {
        if (e === 'index.lua') continue;
        files[subName].push(fs.readFileSync(path.join(subDir, e)));
      }
    }
  }

  return files;
}

function writeDatastream(folderPath) {
  const files = readFolderFiles(folderPath);
  const data  = files['data.lua'];
  if (!data) throw new Error('data.lua not found in folder');

  const w = new BinWriter();

  function getFile(name) {
    if (files[name])         return files[name];
    if (files[name+'.raw'])  return files[name+'.raw'];
    if (files[name+'.dds'])  return files[name+'.dds'];
    if (files[name+'.tga'])  return files[name+'.tga'];
    if (files[name+'.png'])  return files[name+'.png'];
    return null;
  }

  // vec helpers that accept both JS arrays and Lua {1:x,2:y,...} objects
  const wv2 = (v) => w.vec2(toVec(v));
  const wv3 = (v) => w.vec3(toVec(v));
  const wv4 = (v) => w.vec4(toVec(v));

  const hmFile = getFile('heightmap');
  if (!hmFile) throw new Error('heightmap.raw not found');
  const previewFile = getFile('previewImage');
  if (!previewFile) throw new Error('previewImage not found');

  const sz = toVec(data.size); // size may also be {1:x,2:y}
  const expectedHMSize = (sz[0]+1) * (sz[1]+1) * 2;
  if (hmFile.length !== expectedHMSize)
    console.warn(`[scmap] Warning: heightmap ${hmFile.length} bytes, expected ${expectedHMSize}`);

  // ── Header ───────────────────────────────────────────────────────────────
  w.push(SCMAP_HEADER[0]);
  w.push(SCMAP_HEADER[1]);
  w.push(SCMAP_HEADER[2]);
  w.push(SCMAP_HEADER[1]);

  w.float(sz[0]);
  w.float(sz[1]);
  w.push(Buffer.alloc(6));

  w.intFile(previewFile);

  w.int(data.version);
  w.int(sz[0]);
  w.int(sz[1]);
  w.float(data.heightmapScale);
  w.push(hmFile);
  w.byte(0);

  w.stringNull(data.shaderPath);
  w.stringNull(data.backgroundPath);
  w.stringNull(data.skyCubePath);

  // CubeMaps
  const cubeMaps = toArray(data.cubeMaps);
  w.int(cubeMaps.length);
  for (const cm of cubeMaps) {
    w.stringNull(cm.name);
    w.stringNull(cm.path);
  }

  // Lighting
  const l = data.lightingSettings;
  w.float(l.lightingMultiplier);
  wv3(l.sunDirection);
  wv3(l.sunAmbience);
  wv3(l.sunColor);
  wv3(l.shadowFillColor);
  wv4(l.specularColor);
  w.float(l.bloom);
  wv3(l.fogColor);
  w.float(l.fogStart);
  w.float(l.fogEnd);

  // Water
  const ws = data.waterSettings;
  w.byte(ws.waterPresent ? 1 : 0);
  w.float(ws.elevation);
  w.float(ws.elevationDeep);
  w.float(ws.elevationAbyss);
  wv3(ws.surfaceColor);
  wv2(ws.colorLerp);
  w.float(ws.refractionScale);
  w.float(ws.fresnelBias);
  w.float(ws.fresnelPower);
  w.float(ws.unitReflection);
  w.float(ws.skyReflection);
  w.float(ws.sunShininess);
  w.float(ws.sunStrength);
  wv3(ws.sunDirection);
  wv3(ws.sunColor);
  w.float(ws.sunReflection);
  w.float(ws.sunGlow);
  w.stringNull(ws.texPathCubeMap);
  w.stringNull(ws.texPathWaterRamp);
  wv4(ws.waveNormalRepeats);
  for (const wt of toArray(ws.waveTextures)) {
    wv2(wt.movement);
    w.stringNull(wt.path);
  }

  // WaveGenerators
  const waveGens = toArray(data.waveGenerators);
  w.int(waveGens.length);
  for (const v of waveGens) {
    w.stringNull(v.textureName);
    w.stringNull(v.rampName);
    wv3(v.position);
    w.float(v.rotation);
    wv3(v.velocity);
    w.float(v.lifeTimeFirst);
    w.float(v.lifeTimeSecond);
    w.float(v.periodFirst);
    w.float(v.periodSecond);
    w.float(v.scaleFirst);
    w.float(v.scaleSecond);
    w.float(v.frameCount);
    w.float(v.frameRateFirst);
    w.float(v.frameRateSecond);
    w.float(v.stripCount);
  }

  // Minimap
  w.int(data.miniMapContourInterval);
  w.hex4(data.miniMapDeepWaterColor);
  w.hex4(data.miniMapContourColor);
  w.hex4(data.miniMapShoreColor);
  w.hex4(data.miniMapLandStartColor);
  w.hex4(data.miniMapLandEndColor);
  if (data.version > 56) w.hex4(data.unknownFA ?? '00000000');

  // Textures / Normals
  for (const t of toArray(data.textures)) { w.stringNull(t.path); w.float(t.scale); }
  for (const n of toArray(data.normals))  { w.stringNull(n.path); w.float(n.scale); }

  w.hex4(data.unknown1);
  w.hex4(data.unknown2);

  // Decals
  const decals = toArray(data.decals);
  w.int(decals.length);
  for (const d of decals) {
    w.int(d.id);
    w.int(d.type);
    const dTextures = toArray(d.textures);
    w.int(dTextures.length);
    for (const t of dTextures) {
      const tb = Buffer.from(t, 'binary');
      w.int(tb.length);
      w.push(tb);
    }
    wv3(d.scale);
    wv3(d.position);
    wv3(d.rotation);
    w.float(d.LODCutoff);
    w.float(d.LODCutoffMin);
    w.int(d.army);
  }

  // Decal groups
  const decalGroups = toArray(data.decalGroups);
  w.int(decalGroups.length);
  for (const g of decalGroups) {
    w.int(g.id);
    w.stringNull(g.name);
    const gData = toArray(g.data);
    w.int(gData.length);
    for (const v of gData) w.int(v);
  }

  // intWidth / intHeight
  w.int(sz[0]);
  w.int(sz[1]);

  // Normal map / arbitrary
  const normalFile    = getFile('normalMap');
  const arbitraryList = files['arbitrary'];
  if (normalFile) {
    w.int(1);
    w.intFile(normalFile);
  } else if (arbitraryList && arbitraryList.length > 0) {
    w.int(arbitraryList.length);
    for (const f of arbitraryList) w.intFile(f);
  } else {
    w.int(0);
  }

  // textureMaskLow / High
  const tml = getFile('textureMaskLow');
  const tmh = getFile('textureMaskHigh');
  if (!tml) throw new Error('textureMaskLow not found');
  if (!tmh) throw new Error('textureMaskHigh not found');
  w.intFile(tml);
  w.intFile(tmh);

  // waterMap / utilityTextures
  const waterMapFile   = getFile('waterMap');
  const utilityTexList = files['utilityTextures'];
  if (waterMapFile) {
    w.int(1);
    w.intFile(waterMapFile);
  } else if (utilityTexList && utilityTexList.length > 0) {
    w.int(utilityTexList.length);
    for (const f of utilityTexList) w.intFile(f);
  } else {
    w.int(0);
    console.warn('[scmap] Warning: no waterMap/utilityTextures — map may not render correctly');
  }

  // Raw masks
  const halfSize = (sz[0]/2) * (sz[1]/2);
  for (const name of ['waterFoamMask','waterFlatness','waterDepthBiasMask']) {
    const f = getFile(name);
    if (!f) throw new Error(`${name}.raw not found`);
    if (f.length !== halfSize) console.warn(`[scmap] Warning: ${name} ${f.length} bytes, expected ${halfSize}`);
    w.push(f);
  }

  const ttFile = getFile('terrainType');
  if (!ttFile) throw new Error('terrainType.raw not found');
  w.push(ttFile);

  // SkyBox (version 60+)
  if (data.version >= 60 && data.skyBox) {
    const sb = data.skyBox;
    wv3(sb.position);
    w.float(sb.horizonHeight);
    w.float(sb.scale);
    w.float(sb.subHeight);
    w.int(sb.subDivAx);
    w.int(sb.subDivHeight);
    w.float(sb.zenithHeight);
    wv3(sb.horizonColor);
    wv3(sb.zenithColor);
    w.float(sb.decalGlowMultiplier);
    w.stringNull(sb.albedo);
    w.stringNull(sb.glow);
    const planets = toArray(sb.planets);
    w.int(planets.length);
    for (const p of planets) {
      wv3(p.position);
      w.float(p.rotation);
      wv2(p.scale);
      wv4(p.uv);
    }
    const midColor = toVec(sb.midColor);
    w.byte(midColor[0]);
    w.byte(midColor[1]);
    w.byte(midColor[2]);
    w.float(sb.cirrusMultiplier);
    wv3(sb.cirrusColor);
    w.stringNull(sb.cirrusTexture);
    const cirrusLayers = toArray(sb.cirrusLayers);
    w.int(cirrusLayers.length);
    for (const cl of cirrusLayers) {
      wv2(cl.frequency);
      w.float(cl.speed);
      wv2(cl.direction);
    }
    w.float(sb.clouds7);
  }

  // Props
  const props = toArray(data.props);
  w.int(props.length);
  for (const p of props) {
    w.stringNull(p.path || '');
    wv3(p.position);
    wv3(p.rotationX);
    wv3(p.rotationY);
    wv3(p.rotationZ);
    wv3(p.scale);
  }

  return w.toBuffer();
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

module.exports = { readDatastream, exportScmapData, writeDatastream, parseLuaDataFile, luaSerialize };