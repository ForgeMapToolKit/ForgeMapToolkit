/**
 * CodeSection — syntax-highlighted code block.
 *
 * Extracted and extended from the History tab tokenizer.
 * Supported languages: lua · json · bash · plain
 *
 * Props:
 *   label?       string    eyebrow label (e.g. "Example")
 *   lang?        string    'lua' | 'json' | 'bash' | 'plain'  (default 'plain')
 *   code         string    the code to display
 *   lineNumbers? boolean   show line numbers (default true)
 *
 * Usage:
 *   <CodeSection
 *     label="Scenario script snippet"
 *     lang="lua"
 *     code={`local props = {\n  density = 0.5,\n}`}
 *   />
 *
 *   <CodeSection lang="bash" code="fmtk export --map mymap --output ./out" lineNumbers={false} />
 */

import React, { memo, useMemo } from 'react';
import './sections.css';

/* ══════════════════════════════════════════════════════════════════
   TOKENIZERS
   ══════════════════════════════════════════════════════════════════ */

/* ── Lua ────────────────────────────────────────────────────────── */

const LUA_KEYWORDS = new Set([
  'and','break','do','else','elseif','end','false','for','function',
  'goto','if','in','local','nil','not','or','repeat','return','then',
  'true','until','while',
]);

function tokeniseLua(line) {
  const tokens = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    // comment
    if (line[i] === '-' && line[i+1] === '-') {
      tokens.push({ text: line.slice(i), type: 'comment' }); break;
    }
    // double-quote string
    if (line[i] === '"') {
      let j = i + 1;
      while (j < n && !(line[j] === '"' && line[j-1] !== '\\')) j++;
      tokens.push({ text: line.slice(i, j + 1), type: 'string' }); i = j + 1; continue;
    }
    // single-quote string
    if (line[i] === "'") {
      let j = i + 1;
      while (j < n && !(line[j] === "'" && line[j-1] !== '\\')) j++;
      tokens.push({ text: line.slice(i, j + 1), type: 'string' }); i = j + 1; continue;
    }
    // number
    if (/[0-9]/.test(line[i])) {
      let j = i + 1;
      while (j < n && /[0-9.eE+\-xXa-fA-F_]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' }); i = j; continue;
    }
    // identifier / keyword
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i + 1;
      while (j < n && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const w = line.slice(i, j);
      tokens.push({ text: w, type: LUA_KEYWORDS.has(w) ? 'keyword' : 'ident' }); i = j; continue;
    }
    // operator / punctuation
    if (/[{}[\](),=+\-*/<>~#%^&|;:.]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'operator' }); i++; continue;
    }
    // plain fallback
    let j = i + 1;
    while (j < n && !/[-a-zA-Z0-9_"'{}[\](),=+*/<>~#%^&|;:.]/.test(line[j])) j++;
    tokens.push({ text: line.slice(i, j), type: 'plain' }); i = j;
  }
  return tokens;
}

/* ── JSON ───────────────────────────────────────────────────────── */

const JSON_BOOLEANS = new Set(['true', 'false', 'null']);

function tokeniseJson(line) {
  const tokens = [];
  // JSON key: "word":
  const keyRx = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:)/;
  const strRx  = /^"(?:[^"\\]|\\.)*"/;
  const numRx  = /^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+\-]?[0-9]+)?/;
  const boolRx = /^(true|false|null)/;
  const punctRx = /^[{}\[\],:]/;

  let rem = line;
  while (rem.length) {
    let m;
    if ((m = keyRx.exec(rem))) {
      if (m[1]) tokens.push({ text: m[1], type: 'plain' });
      tokens.push({ text: m[2], type: 'key' });
      tokens.push({ text: m[3], type: 'operator' });
      rem = rem.slice(m[0].length); continue;
    }
    if ((m = strRx.exec(rem)))  { tokens.push({ text: m[0], type: 'string' });   rem = rem.slice(m[0].length); continue; }
    if ((m = numRx.exec(rem)))  { tokens.push({ text: m[0], type: 'number' });   rem = rem.slice(m[0].length); continue; }
    if ((m = boolRx.exec(rem))) { tokens.push({ text: m[0], type: 'bool' });     rem = rem.slice(m[0].length); continue; }
    if ((m = punctRx.exec(rem))){ tokens.push({ text: m[0], type: 'operator' }); rem = rem.slice(m[0].length); continue; }
    // whitespace / fallback
    tokens.push({ text: rem[0], type: 'plain' }); rem = rem.slice(1);
  }
  return tokens;
}

/* ── Bash ───────────────────────────────────────────────────────── */

function tokeniseBash(line) {
  const tokens = [];
  // comment
  if (/^\s*#/.test(line)) {
    return [{ text: line, type: 'comment' }];
  }
  // tokenize: command (first word), flags (--flag / -f), strings, rest
  const parts = line.split(/(\s+)/);
  let first = true;
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) { tokens.push({ text: p, type: 'plain' }); continue; }
    if (first && !/^-/.test(p)) { tokens.push({ text: p, type: 'cmd' }); first = false; continue; }
    if (/^--?[a-zA-Z]/.test(p)) { tokens.push({ text: p, type: 'flag' }); first = false; continue; }
    if (/^["']/.test(p))        { tokens.push({ text: p, type: 'string' }); first = false; continue; }
    tokens.push({ text: p, type: 'plain' }); first = false;
  }
  return tokens;
}

/* ── Router ─────────────────────────────────────────────────────── */

function tokenise(line, lang) {
  switch (lang) {
    case 'lua':  return tokeniseLua(line);
    case 'json': return tokeniseJson(line);
    case 'bash': return tokeniseBash(line);
    default:     return [{ text: line, type: 'plain' }];
  }
}

const TYPE_CLASS = {
  keyword:  'hs-tok-keyword',
  string:   'hs-tok-string',
  number:   'hs-tok-number',
  comment:  'hs-tok-comment',
  operator: 'hs-tok-operator',
  ident:    'hs-tok-ident',
  key:      'hs-tok-key',
  bool:     'hs-tok-bool',
  plain:    'hs-tok-plain',
  cmd:      'hs-tok-cmd',
  flag:     'hs-tok-flag',
};

/* ── CodeLine (memoised) ────────────────────────────────────────── */

const CodeLine = memo(({ line, lang, num, showNum }) => {
  const tokens = useMemo(() => tokenise(line, lang), [line, lang]);
  return (
    <div className="hs-code__line">
      {showNum && <span className="hs-code__line-num" aria-hidden="true">{num}</span>}
      <span className="hs-code__line-body">
        {tokens.map((t, i) => (
          <span key={i} className={TYPE_CLASS[t.type] || 'hs-tok-plain'}>{t.text}</span>
        ))}
      </span>
    </div>
  );
});

/* ── Main component ─────────────────────────────────────────────── */

export default function CodeSection({ label, lang = 'plain', code = '', lineNumbers = true }) {
  const lines = code.split('\n');
  // strip trailing empty line if code ends with \n
  if (lines[lines.length - 1] === '') lines.pop();

  const LANG_LABEL = { lua: 'LUA', json: 'JSON', bash: 'BASH', plain: 'TEXT' };

  return (
    <div className="hs-section hs-code">
      {(label || lang !== 'plain') && (
        <div className="hs-code__header">
          {label && <span className="hs-code__label">{label}</span>}
          <span className="hs-code__lang-badge">{LANG_LABEL[lang] || lang.toUpperCase()}</span>
        </div>
      )}
      <div className="hs-code__block">
        <div className="hs-code__scroll">
          <pre className="hs-code__pre" aria-label={label || 'Code block'}>
            {lines.map((line, i) => (
              <CodeLine
                key={i}
                line={line}
                lang={lang}
                num={i + 1}
                showNum={lineNumbers}
              />
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
