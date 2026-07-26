#!/usr/bin/env node
/**
 * design-lint — mechanical enforcement of docs/TAB_DESIGN_LAW.md.
 *
 * Reskinning an existing UI onto the design system fails in a way that reviewing
 * class *names* does not catch: the names look current while the shapes are still
 * the old ones. This script checks the three things that actually went wrong on
 * the Contributions and History tabs, plus the one that is pure bookkeeping:
 *
 *   ORPHAN    a class used in JSX that no stylesheet defines. Either a typo or a
 *             leftover from a rule that was deleted when its tab was migrated —
 *             the element then silently renders unstyled.
 *   FOREIGN   a class defined only in *another* tab's stylesheet. It works today
 *             and breaks the moment that tab is touched, and it means one tab is
 *             wearing another tab's identity.
 *   BOXED     §5: a neutral background surface AND a neutral border at once, or
 *             four generic neutral sides. This is what reads as "the old boxy
 *             design" even when every token is correct.
 *   LITERAL   §8 / the CSS header rule: raw hex or rgba() where a token exists.
 *             Reported per file as a count, since semantic data colors are a
 *             legitimate exception and need a human call.
 *
 * Usage:
 *   node scripts/design-lint.mjs               # whole app, summary + findings
 *   node scripts/design-lint.mjs WaveNormals   # one tab (path substring filter)
 *   node scripts/design-lint.mjs --json        # machine-readable
 *
 * Exit code is 1 if any ORPHAN or FOREIGN finding exists — those are unambiguous
 * defects. BOXED and LITERAL are reported but do not fail the run, because both
 * have sanctioned exceptions (§5 functional boxes, §7 data color).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const filter = args.find(a => !a.startsWith('--')) || null;

// ── File walk ────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(jsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const cssFiles = files.filter(f => f.endsWith('.css'));
const jsxFiles = files.filter(f => /\.jsx?$/.test(f));

const rel = f => relative(ROOT, f).split(sep).join('/');

/**
 * Which "owner" a file belongs to. Anything under DesignSystem or Shared is
 * global and may be used by everyone; a tab folder owns only itself.
 */
function ownerOf(file) {
  const r = rel(file);
  if (/\/(DesignSystem|Ui|Libraries)\//i.test(r) || /\/Shared\/[^/]+\.css$/i.test(r)) return '*';
  const m = r.match(/src\/components\/[Tt]abs\/[^/]+\/([^/]+)\//);
  if (m) return m[1];
  const h = r.match(/src\/components\/(core|Core|Shared|shared)\//);
  if (h) return '*';
  return '*';
}

// ── Collect defined classes ──────────────────────────────────────────────────

/** class -> Set of owners that define it */
const defined = new Map();
/** file -> literal count */
const literals = new Map();
const boxed = [];

const NEUTRAL_SAFE = /--tab-color|--tab-glow|--accent|--current-accent|--slat-color|--diff-|--?[a-z-]*(ok|warn|err|error|danger|success)/i;

for (const f of cssFiles) {
  const css = readFileSync(f, 'utf8');
  const owner = ownerOf(f);

  // §5 has real exceptions (a toggle track, a chip whose box IS its state). They
  // are opted out with a `design-lint-allow:` comment carrying the reason, so an
  // exception has to be argued in the file rather than silently tolerated. The
  // comment is matched before comments are stripped; the selectors it covers are
  // collected here.
  const allowed = new Set();
  for (const m of css.matchAll(/\/\*[^*]*design-lint-allow:[\s\S]*?\*\/\s*([^{]+)\{/g)) {
    for (const sel of m[1].split(',')) allowed.add(sel.trim().replace(/\s+/g, ' '));
  }

  // Strip comments before any analysis — the law and the CSS headers are full of
  // example selectors and hex values that are documentation, not rules.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const m of bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    if (!defined.has(m[1])) defined.set(m[1], new Set());
    defined.get(m[1]).add(owner);
  }

  // ── §5: rule-level box check ──
  for (const m of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    const body = m[2];
    if (!selector.startsWith('.') && !selector.includes('.')) continue;
    if (allowed.has(selector)) continue;

    const bg = [...body.matchAll(/(?:^|[;\s])background(?:-color)?\s*:\s*([^;]+)/g)].pop()?.[1]?.trim();
    const bd = [...body.matchAll(/(?:^|[;\s])border\s*:\s*([^;]+)/g)].pop()?.[1]?.trim();

    const realBg = bg && !/^(none|transparent|inherit|unset|0)$/i.test(bg);
    const realBd = bd && !/^(none|0|unset)$/i.test(bd);
    if (!realBd) continue;

    const neutralBd = !NEUTRAL_SAFE.test(bd);
    if (!neutralBd) continue;

    if (realBg && !NEUTRAL_SAFE.test(bg)) {
      boxed.push({ file: rel(f), selector, why: 'neutral surface + neutral border (§5 "never both")', bg, bd });
    } else if (!realBg) {
      boxed.push({ file: rel(f), selector, why: 'four generic neutral sides (§5 "never all four")', bg: bg || '—', bd });
    }
  }

  // ── literals ──
  const lit = (bare.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length
            + (bare.match(/rgba?\(/g) || []).length;
  if (lit) literals.set(rel(f), lit);
}

// ── Collect used classes ─────────────────────────────────────────────────────

const used = new Map(); // class -> [{file, owner}]

for (const f of jsxFiles) {
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const owner = ownerOf(f);
  const names = new Set();

  // Only string *literals* inside a className attribute are class names. A regex
  // cannot do this: `className={`a${x ? ' b' : ''}`}` needs balanced-brace
  // scanning, and without it every JS identifier in the ternary leaks in as a
  // fake class. So the attribute value is walked character by character, quote
  // state and brace depth tracked, and interpolations skipped outright.
  for (const m of src.matchAll(/className\s*=\s*/g)) {
    let i = m.index + m[0].length;
    const isBraced = src[i] === '{';
    if (isBraced) i++;

    let depth = 0, quote = null, buf = '';
    for (; i < src.length; i++) {
      const ch = src[i];

      if (quote) {
        if (ch === quote) { quote = null; buf += ' '; continue; }
        // `${` inside a template literal: skip to its matching brace.
        if (quote === '`' && ch === '$' && src[i + 1] === '{') {
          let d = 1; i += 2;
          while (i < src.length && d > 0) {
            if (src[i] === '{') d++;
            else if (src[i] === '}') d--;
            i++;
          }
          i--; buf += ' '; continue;
        }
        buf += ch;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '{') { depth++; continue; }
      if (ch === '}') { if (isBraced && depth === 0) break; depth--; continue; }
      if (!isBraced) break;         // unquoted bare value — nothing to read
      if (ch === '\n' && depth === 0 && !buf) continue;
    }

    for (const tok of buf.split(/\s+/)) {
      const t = tok.trim();
      if (/^-?[_a-zA-Z][\w-]*$/.test(t)) names.add(t);
    }
  }

  for (const n of names) {
    if (!used.has(n)) used.set(n, []);
    used.get(n).push({ file: rel(f), owner });
  }
}

// ── Findings ─────────────────────────────────────────────────────────────────

// Tokens that look like classes but are not: JS identifiers picked up from
// template expressions, and utility names owned by third-party/global CSS.
const IGNORE = /^(is|on|active|open|selected|disabled|done|locked|dim|warn|error|ok|true|false|null|undefined|prev|next|v|i|s|o|e|l|r|x|c|t|p|b|a|n|id|key|cls|className|style|props|children)$/;

const orphans = [];
const foreign = [];

for (const [cls, sites] of used) {
  if (IGNORE.test(cls) || cls.length < 3) continue;
  const owners = defined.get(cls);
  if (!owners) { orphans.push({ cls, sites }); continue; }
  if (owners.has('*')) continue;
  for (const site of sites) {
    if (site.owner !== '*' && !owners.has(site.owner)) {
      foreign.push({ cls, site, definedBy: [...owners] });
    }
  }
}

const pass = f => !filter || f.includes(filter);
const F = {
  orphans: orphans.filter(o => o.sites.some(s => pass(s.file))),
  foreign: foreign.filter(x => pass(x.site.file)),
  boxed:   boxed.filter(b => pass(b.file)),
  literals: [...literals].filter(([f]) => pass(f)).sort((a, b) => b[1] - a[1]),
};

if (asJson) {
  console.log(JSON.stringify(F, null, 2));
} else {
  const head = t => console.log(`\n\x1b[1m${t}\x1b[0m`);

  head(`ORPHAN — used in JSX, defined in no stylesheet (${F.orphans.length})`);
  for (const o of F.orphans) {
    console.log(`  .${o.cls}`);
    for (const s of o.sites.filter(s => pass(s.file))) console.log(`      ${s.file}`);
  }
  if (!F.orphans.length) console.log('  none');

  head(`FOREIGN — used in one tab, defined only in another (${F.foreign.length})`);
  for (const x of F.foreign) {
    console.log(`  .${x.cls}  in ${x.site.owner}  →  owned by ${x.definedBy.join(', ')}`);
    console.log(`      ${x.site.file}`);
  }
  if (!F.foreign.length) console.log('  none');

  head(`BOXED — §5 generic box violations (${F.boxed.length})`);
  for (const b of F.boxed) {
    console.log(`  ${b.selector}`);
    console.log(`      ${b.why}`);
    console.log(`      bg: ${b.bg}   border: ${b.bd}`);
    console.log(`      ${b.file}`);
  }
  if (!F.boxed.length) console.log('  none');

  head(`LITERAL — hex / rgba() counts per stylesheet (top 15)`);
  for (const [f, n] of F.literals.slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${f}`);
  if (!F.literals.length) console.log('  none');

  console.log(`\n\x1b[1mSummary\x1b[0m  orphan ${F.orphans.length} · foreign ${F.foreign.length} · boxed ${F.boxed.length} · files with literals ${F.literals.length}`);
}

process.exit(F.orphans.length || F.foreign.length ? 1 : 0);
