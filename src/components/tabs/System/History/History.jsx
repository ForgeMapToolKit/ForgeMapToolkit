/**
 * History.jsx  —  scmap Diff Viewer + Inline Lua Editor
 *
 * On TabLayout (layoutMode="x", controlsWidth="half"):
 *   Controls column → Filter block (search + tab pills + clear) + Entries list
 *   Aside           → Selected snapshot: file diffs, side-by-side viewer, Lua editor
 *
 * Diff: side-by-side BEFORE | AFTER with char-level highlights
 * Editor: syntax-highlighted overlay + transparent textarea (no mode toggle)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import ReactDOM from 'react-dom';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import '../../../Shared/DesignSystem/index.css';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import HistoryHelpModal from '../../HelpModals/History_help.jsx';
import {
  formatBytes,
  commitHistoryEntry,
  applyInvertedDiff,
} from '../../../../../utils/ScmapHistoryTracker.js';
import './History.css';

// ─── Config ───────────────────────────────────────────────────────────────────

const TAB_LABELS = {
  wreckages:          'Wreckages',
  props:              'Props',
  emitter:            'Emitter',
  customprops:        'Custom Props',
  treemap:            'TreeMap',
  rockerosion:        'Rock Erosion',
  stars:              'Stars',
  'skybox-generator': 'Skybox',
  scmaptool:          'SCMAP Tool',
  previewimage:       'Preview Image',
  'history-editor':   'History',
};

const TAB_COLORS = {
  wreckages:          'var(--wreckages-color, #a78bfa)',
  props:              'var(--props-color,      #f472b6)',
  emitter:            'var(--emitter-color,    #60a5fa)',
  customprops:        'var(--customprops-color,#34d399)',
  treemap:            'var(--treemap-color,    #4ade80)',
  rockerosion:        'var(--rockerosion-color,#fb923c)',
  stars:              'var(--stars-color,      #c4b5fd)',
  'skybox-generator': 'var(--skybox-color,     #38bdf8)',
  scmaptool:          '#FFFA00',
  previewimage:       '#FF7B00',
  'history-editor':   '#FF8AFF',
  all:                '#FF8AFF',
};

const FILE_CATEGORY_LABELS = {
  props: 'Props Lua', data: 'Data Lua', lua: 'Lua',
  previewImage: 'Preview', normalMap: 'Normal Map',
  heightmap: 'Heightmap', textureMask: 'Texture Mask',
  waterMap: 'Water', dds: 'DDS', raw: 'RAW', other: 'Other',
};

function formatTs(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    '  ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
}

// ─── Lua Syntax Highlighter ───────────────────────────────────────────────────

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
    if (line[i] === '-' && line[i+1] === '-') { tokens.push({ text: line.slice(i), type: 'comment' }); break; }
    if (line[i] === '"') { let j=i+1; while(j<n&&!(line[j]==='"'&&line[j-1]!=='\\'))j++; tokens.push({text:line.slice(i,j+1),type:'string'}); i=j+1; continue; }
    if (line[i] === "'") { let j=i+1; while(j<n&&!(line[j]==="'"&&line[j-1]!=='\\'))j++; tokens.push({text:line.slice(i,j+1),type:'string'}); i=j+1; continue; }
    if (/[0-9]/.test(line[i])) { let j=i+1; while(j<n&&/[0-9.eE+\-xXa-fA-F_]/.test(line[j]))j++; tokens.push({text:line.slice(i,j),type:'number'}); i=j; continue; }
    if (/[a-zA-Z_]/.test(line[i])) { let j=i+1; while(j<n&&/[a-zA-Z0-9_]/.test(line[j]))j++; const w=line.slice(i,j); tokens.push({text:w,type:LUA_KEYWORDS.has(w)?'keyword':'identifier'}); i=j; continue; }
    if (/[{}[\](),=+\-*/<>~#%^&|;:.]/.test(line[i])) { tokens.push({text:line[i],type:'operator'}); i++; continue; }
    let j=i+1; while(j<n&&!/[-a-zA-Z0-9_"'{}[\](),=+*/<>~#%^&|;:.]/.test(line[j]))j++; tokens.push({text:line.slice(i,j),type:'plain'}); i=j;
  }
  return tokens;
}

const TC = { keyword:'#569cd6', string:'#ce9178', number:'#b5cea8', comment:'#6a9955', operator:'#d4d4d4', identifier:'#9cdcfe', plain:'#d4d4d4' };

const SyntaxLine = memo(({ line }) => {
  const tokens = useMemo(() => tokeniseLua(line), [line]);
  return <>{tokens.map((t,i) => <span key={i} style={{color:TC[t.type]}}>{t.text}</span>)}</>;
});

// ─── Char-level LCS diff ──────────────────────────────────────────────────────

function charDiff(a='', b='') {
  const ac=[...a], bc=[...b], m=ac.length, n=bc.length;
  const dp = Array.from({length:m+1}, ()=>new Int32Array(n+1));
  for(let i=m-1;i>=0;i--) for(let j=n-1;j>=0;j--)
    dp[i][j] = ac[i]===bc[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j],dp[i][j+1]);
  const os=[], ns=[];
  let i=0, j=0;
  while(i<m||j<n) {
    if(i<m&&j<n&&ac[i]===bc[j]){ os.push({t:ac[i],c:false}); ns.push({t:bc[j],c:false}); i++;j++; }
    else if(j<n&&(i>=m||dp[i][j+1]>=dp[i+1][j])){ ns.push({t:bc[j],c:true}); j++; }
    else { os.push({t:ac[i],c:true}); i++; }
  }
  const merge = segs => { const out=[]; for(const s of segs) if(out.length&&out[out.length-1].c===s.c) out[out.length-1].t+=s.t; else out.push({...s}); return out; };
  return { os: merge(os), ns: merge(ns) };
}

function CharLine({ segs, isOld }) {
  return <>{segs.map((s,i) => s.c
    ? <span key={i} className={isOld ? 'hist-char-rem' : 'hist-char-add'}>{s.t}</span>
    : <span key={i}>{s.t}</span>
  )}</>;
}

// ─── Side-by-side diff viewer ─────────────────────────────────────────────────

const SideBySideDiff = ({ diff }) => {
  const [expanded, setExpanded] = useState(false);
  if (!diff?.length) return null;

  const changed    = diff.filter(l => l.type !== 'equal');
  const addedCnt   = changed.filter(l => l.type === 'added').length;
  const removedCnt = changed.filter(l => l.type === 'removed').length;

  if (changed.length === 0)
    return <div className="hist-info-card"><span className="hist-info-icon">i</span><span className="hist-info-text">No textual differences.</span></div>;

  // Context: ±2 lines around each change
  const changedIdx = new Set(diff.flatMap((l,i) => l.type!=='equal'?[i]:[]));
  const shown = new Set();
  for(const ci of changedIdx) for(let k=ci-2;k<=ci+2;k++) if(k>=0&&k<diff.length) shown.add(k);
  const display = expanded ? diff : diff.filter((_,i) => shown.has(i));

  // Pair removed+added for side-by-side + char diffs
  const pairs = [];
  let idx = 0;
  while (idx < display.length) {
    const cur = display[idx];
    if (cur.type === 'removed') {
      const nxt = display[idx+1];
      if (nxt?.type === 'added') {
        const { os, ns } = charDiff(cur.line, nxt.line);
        pairs.push({ before: {...cur, charSegs: os}, after: {...nxt, charSegs: ns} });
        idx += 2; continue;
      }
      pairs.push({ before: cur, after: null });
    } else if (cur.type === 'added') {
      pairs.push({ before: null, after: cur });
    } else {
      pairs.push({ before: cur, after: cur });
    }
    idx++;
  }

  // Attach line numbers
  let bn = 1, an = 1;
  const withNums = pairs.map(p => {
    const bnum = p.before ? (p.before.type !== 'added'   ? bn++ : null) : null;
    const anum = p.after  ? (p.after.type  !== 'removed' ? an++ : null) : null;
    return { ...p, bnum, anum };
  });

  // Insert gap banners
  const rows = [];
  for (let i = 0; i < withNums.length; i++) {
    if (i > 0 && !expanded) {
      const prev = withNums[i-1], cur = withNums[i];
      const pb = prev.bnum ?? 0, cb = cur.bnum ?? 0;
      if (cb - pb > 1 && prev.before?.type==='equal' && cur.before?.type==='equal')
        rows.push({ type: 'gap', gap: cb - pb - 1 });
    }
    rows.push({ type: 'pair', ...withNums[i] });
  }

  return (
    <div className="hist-diff-root">

      {/* Toolbar */}
      <div className="hist-diff-toolbar">
        <div className="hist-diff-stats">
          <span className="hist-diff-stat a">+{addedCnt}</span>
          <span className="hist-diff-stat r">−{removedCnt}</span>
          <span className="hist-diff-stat n">lines</span>
        </div>
        <button className="hist-diff-expand" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'collapse' : `show all ${diff.length} lines`}
        </button>
      </div>

      {/* BEFORE / AFTER headers */}
      <div className="hist-diff-col-headers">
        <div className="hist-diff-col-label before">
          <span className="dot" style={{background:'var(--diff-rem)'}} /> Before
        </div>
        <div className="hist-diff-col-label after">
          <span className="dot" style={{background:'var(--diff-add)'}} /> After
        </div>
      </div>

      {/* Diff grid */}
      <div className="hist-diff-scroll">
        <div className="hist-diff-table">
          {rows.map((row, ri) => {
            if (row.type === 'gap')
              return <div key={`gap-${ri}`} className="hist-diff-gap">… {row.gap} unchanged lines …</div>;

            const { before, after, bnum, anum } = row;
            const lClass = !before ? 'empty' : before.type==='removed' ? 'rem' : 'equal';
            const rClass = !after  ? 'empty' : after.type==='added'    ? 'add' : 'equal';

            return (
              <React.Fragment key={ri}>
                {/* Before cell */}
                <div className={`hist-drow-l ${lClass}`}>
                  {before ? (
                    <>
                      <span className="hist-lnum">{bnum ?? ''}</span>
                      <span className={`hist-gutter ${before.type==='removed'?'rem':'eq'}`}>
                        {before.type==='removed'?'−':' '}
                      </span>
                      <span className={`hist-code${lClass==='equal'?' equal':''}`}>
                        {lClass==='equal'
                          ? (before.line || ' ')
                          : before.charSegs
                            ? <CharLine segs={before.charSegs} isOld />
                            : <SyntaxLine line={before.line||''} />
                        }
                      </span>
                    </>
                  ) : (
                    <><span className="hist-lnum"/><span className="hist-gutter eq"/><span className="hist-empty-cell"/></>
                  )}
                </div>

                {/* After cell */}
                <div className={`hist-drow-r ${rClass}`}>
                  {after ? (
                    <>
                      <span className="hist-lnum">{anum ?? ''}</span>
                      <span className={`hist-gutter ${after.type==='added'?'add':'eq'}`}>
                        {after.type==='added'?'+':' '}
                      </span>
                      <span className={`hist-code${rClass==='equal'?' equal':''}`}>
                        {rClass==='equal'
                          ? (after.line || ' ')
                          : after.charSegs
                            ? <CharLine segs={after.charSegs} isOld={false} />
                            : <SyntaxLine line={after.line||''} />
                        }
                      </span>
                    </>
                  ) : (
                    <><span className="hist-lnum"/><span className="hist-gutter eq"/><span className="hist-empty-cell"/></>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Lua Editor Modal — full-screen overlay, split Before | After ─────────────

function LuaEditorModal({ filename, content, folderPath, contentDiff, onClose, onSaved }) {
  const [code,    setCode]    = useState(content ?? '');
  const [saving,  setSaving]  = useState(false);
  const [packing, setPacking] = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);
  // Deferred render: start with false, flip after first paint to avoid blocking UI
  const [ready,   setReady]   = useState(false);

  // After-pane refs
  const taRef         = useRef(null);
  const afterHlRef    = useRef(null);
  const afterGutRef   = useRef(null);
  // Before-pane refs
  const beforeScrollRef = useRef(null);
  const beforeGutRef    = useRef(null);

  // Defer heavy render until after modal animation frame
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isDirty    = code !== (content ?? '');
  const afterLines = code.split('\n');

  // ── Virtualized line rendering ─────────────────────────────────────────────
  // Only render lines within ±50 of visible viewport to avoid 5s freeze on large files
  const LINE_H = 20;
  const OVERSCAN = 60;

  const [beforeScrollTop, setBeforeScrollTop] = useState(0);
  const [afterScrollTop,  setAfterScrollTop]  = useState(0);

  const visibleSlice = (lines, scrollTop, containerH = 600) => {
    const start = Math.max(0, Math.floor(scrollTop / LINE_H) - OVERSCAN);
    const end   = Math.min(lines.length, Math.ceil((scrollTop + containerH) / LINE_H) + OVERSCAN);
    return { start, end };
  };

  // ── Reconstruct BEFORE lines from contentDiff ──────────────────────────────
  const beforeLines = useMemo(() => {
    if (!contentDiff) return [];
    const lines = [];
    for (const d of contentDiff) {
      if (d.type === 'equal' || d.type === 'removed') lines.push(d.line);
    }
    return lines;
  }, [contentDiff]);

  // ── Delta map for After pane (lineIndex → 'add') ───────────────────────────
  const afterDeltaMap = useMemo(() => {
    if (!contentDiff) return new Map();
    const map = new Map();
    let li = 0;
    for (const d of contentDiff) {
      if (d.type === 'added')      { map.set(li, 'add'); li++; }
      else if (d.type === 'equal') { li++; }
    }
    return map;
  }, [contentDiff]);

  // ── Delta map for Before pane (lineIndex → 'rem') ─────────────────────────
  const beforeDeltaMap = useMemo(() => {
    if (!contentDiff) return new Map();
    const map = new Map();
    let li = 0;
    for (const d of contentDiff) {
      if (d.type === 'removed')    { map.set(li, 'rem'); li++; }
      else if (d.type === 'equal') { li++; }
    }
    return map;
  }, [contentDiff]);

  // ── Scroll sync: After textarea is master ─────────────────────────────────
  const syncScroll = useCallback(() => {
    const top  = taRef.current?.scrollTop  ?? 0;
    const left = taRef.current?.scrollLeft ?? 0;
    if (afterHlRef.current)      { afterHlRef.current.scrollTop  = top; afterHlRef.current.scrollLeft  = left; }
    if (afterGutRef.current)     { afterGutRef.current.scrollTop = top; }
    if (beforeScrollRef.current) { beforeScrollRef.current.scrollTop = top; beforeScrollRef.current.scrollLeft = left; }
    if (beforeGutRef.current)    { beforeGutRef.current.scrollTop = top; }
    setAfterScrollTop(top);
    setBeforeScrollTop(top);
  }, []);

  // ── Sync when Before pane is scrolled manually ────────────────────────────
  const syncFromBefore = useCallback(() => {
    const top  = beforeScrollRef.current?.scrollTop  ?? 0;
    const left = beforeScrollRef.current?.scrollLeft ?? 0;
    if (taRef.current)        { taRef.current.scrollTop  = top; taRef.current.scrollLeft  = left; }
    if (afterHlRef.current)   { afterHlRef.current.scrollTop  = top; afterHlRef.current.scrollLeft  = left; }
    if (afterGutRef.current)  { afterGutRef.current.scrollTop = top; }
    if (beforeGutRef.current) { beforeGutRef.current.scrollTop = top; }
    setBeforeScrollTop(top);
    setAfterScrollTop(top);
  }, []);

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Save & Repack ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!folderPath) { setError('No folder path.'); return; }
    setError(null); setSaving(true);
    try {
      const cleanFolder = folderPath.replace(/[\\/]+$/, '');
      const mapName     = cleanFolder.split(/[\\/]/).pop(); // e.g. "TEST2.scmap"
      const baseMapName = mapName.replace(/\.scmap$/i, ''); // e.g. "TEST2"
      const filePath    = cleanFolder + '\\' + filename;

      // Snapshot BEFORE
      const snapBefore = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: cleanFolder });

      const wr = await window.electronAPI.invoke('write-file', { filePath, content: code });
      if (!wr?.success) throw new Error(wr?.error || 'write-file failed');
      setSaving(false); setSaved(true); setPacking(true);

      const pk = await window.electronAPI.invoke('scmap-pack', { mapName, _caller: 'history-undo' });
      if (!pk?.success) throw new Error(pk?.error || 'scmap-pack failed');
      setPacking(false);

      // Snapshot AFTER + commit history entry
      const snapAfter = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: cleanFolder });
      if (snapBefore?.success && snapAfter?.success) {
        commitHistoryEntry(
          'history-editor',
          baseMapName,
          { ...snapBefore.snapshot, folderPath: cleanFolder },
          { ...snapAfter.snapshot,  folderPath: cleanFolder },
        ).catch(e => console.warn('[History] commitHistoryEntry failed:', e));
      }

      onSaved?.();
    } catch(e) { setError(e.message); setSaving(false); setPacking(false); setSaved(false); }
  };

  const btnLabel  = saving ? 'Saving…' : packing ? 'Repacking…' : 'Save & Repack';
  const btnActive = isDirty && !saving && !packing;
  const hasBefore = beforeLines.length > 0;

  return (
    <div className="lua-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lua-modal-window">

        {/* ── Title bar ──────────────────────────────────────────────────── */}
        <div className="lua-modal-titlebar">
          <div className="lua-modal-title-left">
            <span className="lua-modal-filename">{filename}</span>
            {isDirty && <span className="lua-modal-dirty">unsaved</span>}
            {saved && !isDirty && <span className="lua-modal-saved">saved &amp; repacked</span>}
          </div>
          <div className="lua-modal-title-right">
            <button
              className={`lua-modal-save-btn ${btnActive ? 'on' : 'off'}`}
              onClick={handleSave}
              disabled={!btnActive}
            >{btnLabel}</button>
            <button className="ctrl-btn-close" onClick={onClose} title="Close (Esc)">&#x2715;</button>
          </div>
        </div>

        {error && <div className="lua-modal-error">Error: {error}</div>}

        {/* ── Pane headers ───────────────────────────────────────────────── */}
        <div className={`lua-modal-pane-headers ${!hasBefore ? 'single' : ''}`}>
          {hasBefore && (
            <div className="lua-modal-pane-header before">
              <span className="lua-ph-dot" style={{background:'var(--diff-rem)'}}/>
              BEFORE
              <span className="lua-ph-count">{beforeLines.length} lines</span>
              <span className="lua-ph-badge read-only">read-only</span>
            </div>
          )}
          <div className="lua-modal-pane-header after">
            <span className="lua-ph-dot" style={{background:'var(--diff-add)'}}/>
            AFTER
            <span className="lua-ph-count">{afterLines.length} lines</span>
            <span className="lua-ph-badge editable">editable</span>
          </div>
        </div>

        {/* ── Split panes ────────────────────────────────────────────────── */}
        <div className={`lua-modal-panes ${!hasBefore ? 'single' : ''}`}>

          {/* ── BEFORE pane (read-only) ─────────────────────────────────── */}
          {hasBefore && (
            <div className="lua-pane lua-pane-before">
              {/* Gutter */}
              <div ref={beforeGutRef} className="lua-pane-gutter">
                {ready && beforeLines.map((_,i) => (
                  <div key={i} className="lua-gutter-row">
                    <span className="lua-lnum">{i+1}</span>
                    <span className={`lua-delta-bar ${beforeDeltaMap.has(i) ? 'rem' : 'eq'}`}/>
                  </div>
                ))}
              </div>
              {/* Code area (read-only, virtualized) */}
              <div
                ref={beforeScrollRef}
                className="lua-pane-code-scroll"
                onScroll={syncFromBefore}
              >
                {ready ? (() => {
                  const { start, end } = visibleSlice(beforeLines, beforeScrollTop);
                  return (
                    <div style={{ height: beforeLines.length * LINE_H, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: start * LINE_H, left: 0, right: 0 }}>
                        {beforeLines.slice(start, end).map((line, idx) => {
                          const i = start + idx;
                          return (
                            <div key={i} className={`lua-hl-line${beforeDeltaMap.has(i) ? ' delta-rem' : ''}`}>
                              <SyntaxLine line={line} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })() : <div style={{padding:'10px 18px',color:'rgba(255,255,255,0.2)',fontSize:12}}>Loading…</div>}
              </div>
            </div>
          )}

          {/* ── Divider ─────────────────────────────────────────────────── */}
          {hasBefore && <div className="lua-pane-divider"/>}

          {/* ── AFTER pane (editable) ───────────────────────────────────── */}
          <div className="lua-pane lua-pane-after">
            {/* Gutter */}
            <div ref={afterGutRef} className="lua-pane-gutter">
              {ready && afterLines.map((_,i) => (
                <div key={i} className="lua-gutter-row">
                  <span className="lua-lnum">{i+1}</span>
                  <span className={`lua-delta-bar ${afterDeltaMap.has(i) ? 'add' : 'eq'}`}/>
                </div>
              ))}
            </div>
            {/* Syntax highlight + textarea overlay */}
            <div className="lua-pane-overlay">
              <div ref={afterHlRef} className="lua-pane-hl">
                {ready ? (() => {
                  const { start, end } = visibleSlice(afterLines, afterScrollTop);
                  return (
                    <div style={{ height: afterLines.length * LINE_H }}>
                      <div style={{ paddingTop: start * LINE_H }}>
                        {afterLines.slice(start, end).map((line, idx) => {
                          const i = start + idx;
                          return (
                            <div key={i} className={`lua-hl-line${afterDeltaMap.has(i) ? ' delta-add' : ''}`}>
                              <SyntaxLine line={line} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })() : null}
              </div>
              <textarea
                ref={taRef}
                className="lua-pane-textarea"
                value={code}
                onChange={e => { setCode(e.target.value); setSaved(false); }}
                onScroll={syncScroll}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoFocus
              />
            </div>
          </div>

        </div>

        {/* ── Status bar ─────────────────────────────────────────────────── */}
        <div className="lua-modal-status">
          <span className="lua-status-lang">Lua</span>
          {hasBefore && (
            <>
              <span className="lua-status-sep"/>
              <span>{beforeLines.length} lines before</span>
            </>
          )}
          <span className="lua-status-sep"/>
          <span>{afterLines.length} lines after</span>
          <span className="lua-status-sep"/>
          <span>{code.length} chars</span>
          {afterDeltaMap.size > 0 && (
            <>
              <span className="lua-status-sep"/>
              <span style={{color:'var(--diff-add)'}}>+{afterDeltaMap.size} added</span>
            </>
          )}
          {beforeDeltaMap.size > 0 && (
            <>
              <span className="lua-status-sep"/>
              <span style={{color:'var(--diff-rem)'}}>−{beforeDeltaMap.size} removed</span>
            </>
          )}
          {folderPath && (
            <span className="lua-status-path">{folderPath}</span>
          )}
        <span className="lua-status-hint">press ESC or click outside to close</span>
        </div>

      </div>
    </div>
  );
}

// ─── FileChangeCard ───────────────────────────────────────────────────────────

const FileChangeCard = ({ item, kind, folderPath, onRefresh }) => {
  const [open,       setOpen]       = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [undoState,  setUndoState]  = useState('idle'); // idle | confirm | running | done | error
  const [undoError,  setUndoError]  = useState(null);

  const isLua   = /\.lua$/i.test(item.name);
  const canEdit = isLua && folderPath && kind !== 'removed';

  const content = kind === 'added'    ? item.file?.content
                : kind === 'modified' ? item.after?.content
                : null;

  // "before" content to restore:
  // modified → write item.before.content back
  // removed  → write item.file.content back (restore deleted file)
  // added    → delete the file
  const beforeContent = kind === 'modified' ? item.before?.content
                      : kind === 'removed'  ? item.file?.content
                      : null;

  const canUndo = !!folderPath && (
    (kind === 'modified' && beforeContent != null) ||
    (kind === 'removed'  && beforeContent != null) ||
    (kind === 'added')
  );

  const hasDiff    = kind === 'modified' && !!item.contentDiff;
  const hasContent = !!content;
  const canExpand  = hasDiff || hasContent;

  const kindClass = kind === 'added' ? 'add' : kind === 'removed' ? 'rem' : 'mod';
  const dotColor  = kind === 'added' ? 'var(--diff-add)' : kind === 'removed' ? 'var(--diff-rem)' : 'var(--diff-mod)';

  const handleRowClick = () => {
    if (canEdit) {
      setEditing(true);
    } else if (canExpand) {
      setOpen(o => !o);
    }
  };

  const handleUndo = async (e) => {
    e.stopPropagation();
    if (undoState === 'idle') { setUndoState('confirm'); return; }
    if (undoState !== 'confirm') return;

    setUndoState('running');
    setUndoError(null);
    try {
      const cleanFolder = folderPath.replace(/[\\/]+$/, '');
      const mapName     = cleanFolder.split(/[\\/]/).pop();
      const baseMapName = mapName.replace(/\.scmap$/i, '');
      const filePath    = cleanFolder + '\\' + item.name;

      // Snapshot BEFORE
      const snapBefore = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: cleanFolder });

      if (kind === 'added') {
        // File was added by this change → delete it
        const res = await window.electronAPI.invoke('delete-file', { filePath });
        if (!res?.success) throw new Error(res?.error || 'delete-file failed');

      } else if (kind === 'removed') {
        // File was removed by this change → restore full before content
        const res = await window.electronAPI.invoke('write-file', { filePath, content: beforeContent });
        if (!res?.success) throw new Error(res?.error || 'write-file failed');

      } else if (kind === 'modified') {
        // File was modified → read current disk content and apply inverted diff
        // so only the specific lines from this change are reverted
        const readRes = await window.electronAPI.invoke('read-file', { path: filePath });
        if (!readRes?.success) throw new Error(readRes?.error || 'read-file failed');

        let patchedContent;
        if (item.contentDiff) {
          // Lua file: patch only the changed lines
          patchedContent = applyInvertedDiff(readRes.content, item.contentDiff);
        } else {
          // Binary file (no contentDiff): fall back to writing before content directly
          patchedContent = beforeContent;
        }

        const res = await window.electronAPI.invoke('write-file', { filePath, content: patchedContent });
        if (!res?.success) throw new Error(res?.error || 'write-file failed');
      }

      const pk = await window.electronAPI.invoke('scmap-pack', { mapName, _caller: 'history-undo' });
      if (!pk?.success) throw new Error(pk?.error || 'scmap-pack failed');

      // Snapshot AFTER + commit history entry
      const snapAfter = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: cleanFolder });
      if (snapBefore?.success && snapAfter?.success) {
        commitHistoryEntry(
          'history-editor',
          baseMapName,
          { ...snapBefore.snapshot, folderPath: cleanFolder },
          { ...snapAfter.snapshot,  folderPath: cleanFolder },
        ).catch(e => console.warn('[History] commitHistoryEntry (undo) failed:', e));
      }

      setUndoState('done');
      onRefresh?.();
    } catch (err) {
      setUndoError(err.message);
      setUndoState('error');
    }
  };

  const handleUndoCancel = (e) => {
    e.stopPropagation();
    setUndoState('idle');
  };

  return (
    <div className={`hist-file-row ${kindClass}`}>
      <div
        className="hist-file-header"
        style={{cursor: (canEdit || canExpand) ? 'pointer' : 'default'}}
        onClick={handleRowClick}
      >
        {/* Dot */}
        <span className="hist-file-dot" style={{background:dotColor}}/>

        <span className="hist-file-name">{item.name}</span>

        {/* Category */}
        <span className="hist-file-cat">
          {FILE_CATEGORY_LABELS[item.category] || item.category || 'file'}
        </span>

        {/* Kind badge */}
        <span className={`hist-file-badge ${kindClass}`}>{kind}</span>

        {/* Size */}
        {kind !== 'modified' && (
          <span className="hist-file-size" style={{color: dotColor}}>
            {formatBytes(item.file?.size)}
          </span>
        )}
        {kind === 'modified' && (
          <span className="hist-file-size">
            {formatBytes(item.before?.size)}
            <span className="hist-file-size-sep">/</span>
            {formatBytes(item.after?.size)}
            {item.sizeDelta !== 0 && (
              <span className="hist-file-size-delta" style={{color:item.sizeDelta>0?'var(--diff-add)':'var(--diff-rem)'}}>
                ({item.sizeDelta>0?'+':''}{formatBytes(item.sizeDelta)})
              </span>
            )}
          </span>
        )}

        {/* Hint: click to edit or expand */}
        {canEdit && (
          <span className="hist-file-action-hint">click to edit</span>
        )}
        {!canEdit && canExpand && (
          <span className={`hist-file-chevron ${open?'open':''}`}/>
        )}
      </div>

      {/* ── Undo action bar — sits below the file header ── */}
      {canUndo && (
        <div className="hist-undo-bar" onClick={e => e.stopPropagation()}>
          {undoState === 'idle' && (
            <button className="hist-undo-bar-btn" onClick={handleUndo}>
              <span className="hist-undo-bar-icon">↩</span>
              <span className="hist-undo-bar-label">Restore previous state</span>
            </button>
          )}
          {undoState === 'confirm' && (
            <div className="hist-undo-bar-confirm">
              <span className="hist-undo-bar-confirm-msg">
                <span className="hist-undo-bar-confirm-icon">⚠</span>
                This will overwrite the current file on disk. Continue?
              </span>
              <div className="hist-undo-bar-confirm-actions">
                <button className="hist-undo-bar-yes" onClick={handleUndo}>Yes, restore</button>
                <button className="hist-undo-bar-no"  onClick={handleUndoCancel}>Cancel</button>
              </div>
            </div>
          )}
          {undoState === 'running' && (
            <div className="hist-undo-bar-status running">
              <span className="hist-undo-bar-spinner"/>
              Restoring file…
            </div>
          )}
          {undoState === 'done' && (
            <div className="hist-undo-bar-status done">
              ✓ File restored successfully
            </div>
          )}
          {undoState === 'error' && (
            <div className="hist-undo-bar-status error" title={undoError}>
              ✕ Restore failed — {undoError}
            </div>
          )}
        </div>
      )}

      {/* Editor modal rendered via portal — outside all layout constraints */}
      {editing && canEdit && ReactDOM.createPortal(
        <LuaEditorModal
          filename={item.name}
          content={content}
          folderPath={folderPath}
          contentDiff={item.contentDiff}
          onClose={() => setEditing(false)}
          onSaved={() => {}}
        />,
        document.body
      )}

      {open && !canEdit && (
        <div className="hist-file-body">
          {hasDiff ? (
            <SideBySideDiff diff={item.contentDiff} />
          ) : hasContent ? (
            <div className="hist-full-view">
              {content.split('\n').map((line,i) => (
                <div key={i} className={`hist-full-line ${kind==='added'?'is-add':'is-rem'}`}>
                  <SyntaxLine line={line}/>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// ─── Detail section heading — same tick language as .ctrl-card-section, ───────
// ─── parametrised by the semantic add/rem/mod colour (Role 3, not --tab-color) ─

const SectionTitle = ({ label, color, count }) => (
  <div className="hist-section-label" style={{ '--section-c': color }}>
    {label}
    {count !== undefined && <span className="hist-section-count">{count}</span>}
  </div>
);

// ─── SnapshotRestorePanel — used for tabs that skip LCS diff (e.g. treemap) ──
// Shows a summary of what changed by name/size and a single "Restore" button
// that writes ALL before.files back to disk and repacks.

const SnapshotRestorePanel = ({ entry, onRefresh }) => {
  const { summary, before } = entry;
  const folder = entry.before?.folderPath ?? entry.after?.folderPath ?? null;
  const [restoreState, setRestoreState] = useState('idle'); // idle|confirm|running|done|error
  const [restoreError, setRestoreError] = useState(null);

  const total = (summary.added??0) + (summary.removed??0) + (summary.modified??0);

  const handleRestore = async (e) => {
    e.stopPropagation();
    if (restoreState === 'idle')    { setRestoreState('confirm'); return; }
    if (restoreState !== 'confirm') return;

    setRestoreState('running');
    setRestoreError(null);
    try {
      const cleanFolder = (folder ?? '').replace(/[\\/]+$/, '');
      const mapName     = cleanFolder.split(/[\\\/]/).pop();
      const baseMapName = mapName.replace(/\.scmap$/i, '');

      // Write every text file from the before snapshot back to disk.
      // Binary files (dds/raw) are not stored as content — skip them.
      const files = before?.files ?? {};
      for (const [name, fileInfo] of Object.entries(files)) {
        if (fileInfo.binary || fileInfo.content == null) continue;
        const filePath = cleanFolder + '\\' + name;
        const wr = await window.electronAPI.invoke('write-file', { filePath, content: fileInfo.content });
        if (!wr?.success) throw new Error(`write-file failed for ${name}: ${wr?.error}`);
      }

      // Repack
      const snapBefore = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: cleanFolder });
      const pk = await window.electronAPI.invoke('scmap-pack', { mapName, _caller: 'history-restore' });
      if (!pk?.success) throw new Error(pk?.error || 'scmap-pack failed');
      const snapAfter = await window.electronAPI.invoke('scmap-snapshot-folder', { folderPath: cleanFolder });

      if (snapBefore?.success && snapAfter?.success) {
        commitHistoryEntry(
          'history-editor',
          baseMapName,
          { ...snapBefore.snapshot, folderPath: cleanFolder },
          { ...snapAfter.snapshot,  folderPath: cleanFolder },
        ).catch(e => console.warn('[History] commitHistoryEntry (restore) failed:', e));
      }

      setRestoreState('done');
      onRefresh?.();
    } catch (err) {
      setRestoreError(err.message);
      setRestoreState('error');
    }
  };

  const handleCancel = (e) => { e.stopPropagation(); setRestoreState('idle'); };

  return (
    <div className="hist-detail-scroll">
      {/* Changed-file name lists */}
      {(summary.modifiedNames?.length > 0) && (
        <div className="hist-detail-section">
          <SectionTitle label="Modified Files" color="var(--diff-mod)" count={summary.modifiedNames.length}/>
          <div className="hist-unchanged-pills">
            {summary.modifiedNames.map(n => <span key={n} className="hist-unchanged-pill">{n}</span>)}
          </div>
        </div>
      )}
      {(summary.addedNames?.length > 0) && (
        <div className="hist-detail-section">
          <SectionTitle label="Added Files" color="var(--diff-add)" count={summary.addedNames.length}/>
          <div className="hist-unchanged-pills">
            {summary.addedNames.map(n => <span key={n} className="hist-unchanged-pill">{n}</span>)}
          </div>
        </div>
      )}
      {(summary.removedNames?.length > 0) && (
        <div className="hist-detail-section">
          <SectionTitle label="Removed Files" color="var(--diff-rem)" count={summary.removedNames.length}/>
          <div className="hist-unchanged-pills">
            {summary.removedNames.map(n => <span key={n} className="hist-unchanged-pill">{n}</span>)}
          </div>
        </div>
      )}
      {total === 0 && (
        <div className="hist-detail-section">
          <div className="hist-info-card">
            <span className="hist-info-icon">i</span>
            <span className="hist-info-text">No scmap file changes were recorded in this snapshot.</span>
          </div>
        </div>
      )}

      {/* Restore block */}
      {folder && (
        <div className="hist-detail-section">
          <SectionTitle label="Restore Snapshot" color="var(--tab-color)"/>
          <div className="hist-info-card hist-info-card--gap">
            <span className="hist-info-icon">i</span>
            <span className="hist-info-text">
              Restores <strong>all</strong> Lua files from this snapshot back to disk and repacks the .scmap.
              Binary files (DDS, RAW) are not affected. Line-by-line editing is not available for TreeMap snapshots.
            </span>
          </div>
          <div className="hist-undo-bar hist-undo-bar--flush">
            {restoreState === 'idle' && (
              <button className="hist-undo-bar-btn" onClick={handleRestore}>
                <span className="hist-undo-bar-icon">↩</span>
                <span className="hist-undo-bar-label">Restore this snapshot</span>
              </button>
            )}
            {restoreState === 'confirm' && (
              <div className="hist-undo-bar-confirm">
                <span className="hist-undo-bar-confirm-msg">
                  <span className="hist-undo-bar-confirm-icon">⚠</span>
                  This will overwrite all Lua files in the scmap folder and repack. Continue?
                </span>
                <div className="hist-undo-bar-confirm-actions">
                  <button className="hist-undo-bar-yes" onClick={handleRestore}>Yes, restore</button>
                  <button className="hist-undo-bar-no"  onClick={handleCancel}>Cancel</button>
                </div>
              </div>
            )}
            {restoreState === 'running' && (
              <div className="hist-undo-bar-status running">
                <span className="hist-undo-bar-spinner"/>
                Restoring &amp; repacking…
              </div>
            )}
            {restoreState === 'done' && (
              <div className="hist-undo-bar-status done">✓ Snapshot restored successfully</div>
            )}
            {restoreState === 'error' && (
              <div className="hist-undo-bar-status error" title={restoreError}>
                ✕ Restore failed — {restoreError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Entry detail panel (aside content) ───────────────────────────────────────

const EntryDetail = ({ entry, accentColor, onRefresh }) => {
  const { diff, summary, mapName, timestamp, tabId } = entry;
  const folder = entry.after?.folderPath ?? entry.before?.folderPath ?? null;
  const total  = (summary.added??0) + (summary.removed??0) + (summary.modified??0);

  // treemap (and any future snapshot-restore tab) has diff===null
  const isSnapshotRestoreMode = diff === null;

  return (
    <div className="hist-detail">
      {/* Header */}
      <div className="hist-detail-header">
        <div className="hist-detail-dot" style={{background:accentColor, boxShadow:`0 0 10px ${accentColor}`}}/>
        <div className="hist-detail-info">
          <div className="hist-detail-map">{mapName || 'Unknown map'}</div>
          <div className="hist-detail-ts">{formatTs(timestamp)}</div>
          {folder && <div className="hist-detail-path">{folder}</div>}

          {/* Summary pills */}
          <div className="hist-summary-row">
            {(summary.added??0)>0    && <span className="hist-summary-pill add">+{summary.added} added</span>}
            {(summary.removed??0)>0  && <span className="hist-summary-pill rem">-{summary.removed} removed</span>}
            {(summary.modified??0)>0 && <span className="hist-summary-pill mod">~{summary.modified} modified</span>}
            {total===0 && <span className="hist-detail-nochange">No scmap changes</span>}
          </div>
        </div>

        <div className="hist-tab-badge">
          {TAB_LABELS[tabId] || tabId}
        </div>
      </div>

      {/* Snapshot-restore mode: no line diffs, just restore button */}
      {isSnapshotRestoreMode ? (
        <SnapshotRestorePanel entry={entry} onRefresh={onRefresh}/>
      ) : (
      /* Scrollable sections — normal diff mode */
      <div className="hist-detail-scroll">

        {(diff.added??[]).length > 0 && (
          <div className="hist-detail-section">
            <SectionTitle label="Added Files" color="var(--diff-add)" count={diff.added.length}/>
            {diff.added.map(item => (
              <FileChangeCard key={item.name} item={item} kind="added" folderPath={folder} onRefresh={onRefresh}/>
            ))}
          </div>
        )}

        {(diff.modified??[]).length > 0 && (
          <div className="hist-detail-section">
            <SectionTitle label="Modified Files" color="var(--diff-mod)" count={diff.modified.length}/>
            {diff.modified.map(item => (
              <FileChangeCard key={item.name} item={item} kind="modified" folderPath={folder} onRefresh={onRefresh}/>
            ))}
          </div>
        )}

        {(diff.removed??[]).length > 0 && (
          <div className="hist-detail-section">
            <SectionTitle label="Removed Files" color="var(--diff-rem)" count={diff.removed.length}/>
            {diff.removed.map(item => (
              <FileChangeCard key={item.name} item={item} kind="removed" folderPath={null} onRefresh={onRefresh}/>
            ))}
          </div>
        )}

        {(diff.unchanged??[]).length > 0 && (
          <div className="hist-detail-section">
            <SectionTitle label="Unchanged" color="var(--ink-22)" count={diff.unchanged.length}/>
            <div className="hist-unchanged-pills">
              {diff.unchanged.map(f => (
                <span key={f.name} className="hist-unchanged-pill">{f.name}</span>
              ))}
            </div>
          </div>
        )}

        {total===0 && !(diff.unchanged?.length) && (
          <div className="hist-detail-section">
            <div className="hist-info-card">
              <span className="hist-info-icon">i</span>
              <span className="hist-info-text">No scmap file changes were recorded in this snapshot.</span>
            </div>
          </div>
        )}

      </div>
      )}
    </div>
  );
};

// ─── Main HistoryTab component ─────────────────────────────────────────────────

function HistoryTab() {
  const api = window.electronAPI;

  // ── State ─────────────────────────────────────────────────────────────────
  const [allEntries,    setAllEntries]    = useState([]);
  const [activeTab,     setActiveTab]     = useState('all');
  const [search,        setSearch]        = useState('');
  const [selectedId,    setSelectedId]    = useState(null);
  const [clearState,    setClearState]    = useState('idle'); // idle | confirm
  const [showHelp,      setShowHelp]      = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('main');
  const [helpSelected,  setHelpSelected]  = useState(null);
  const [refreshNonce,  setRefreshNonce]  = useState(0);

  // ── Load history from disk on mount and on refresh ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const result = await api.invoke('history-load');
        if (result?.data && typeof result.data === 'object') {
          const entries = [];
          for (const [tabId, tabEntries] of Object.entries(result.data)) {
            if (Array.isArray(tabEntries)) {
              for (const e of tabEntries) entries.push({ ...e, tabId });
            }
          }
          entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setAllEntries(entries);
        }
      } catch (err) {
        console.error('[HistoryTab] load failed:', err);
      }
    })();
  }, [refreshNonce]);

  const refresh = useCallback(() => setRefreshNonce(n => n + 1), []);

  // ── Tabs with actual history ──────────────────────────────────────────────
  const tabsWithHistory = useMemo(() => {
    const seen = new Set();
    for (const e of allEntries) if (e.tabId) seen.add(e.tabId);
    return [...seen];
  }, [allEntries]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = activeTab === 'all' ? allEntries : allEntries.filter(e => e.tabId === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        (e.mapName || '').toLowerCase().includes(q) ||
        (TAB_LABELS[e.tabId] || e.tabId || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allEntries, activeTab, search]);

  const selectedEntry = useMemo(
    () => allEntries.find(e => e.id === selectedId) ?? null,
    [allEntries, selectedId]
  );
  const accentColor = selectedEntry ? (TAB_COLORS[selectedEntry.tabId] || 'var(--tab-color)') : 'var(--tab-color)';

  // ── Clear history ─────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    if (clearState === 'idle') { setClearState('confirm'); return; }
    if (clearState !== 'confirm') return;
    try {
      // Build new store with this tab's entries removed
      const grouped = {};
      for (const e of allEntries) {
        if (e.tabId === activeTab) continue; // remove this tab
        if (!grouped[e.tabId]) grouped[e.tabId] = [];
        grouped[e.tabId].push(e);
      }
      await api.invoke('history-save', { data: grouped });
      setSelectedId(null);
      setClearState('idle');
      refresh();
    } catch (err) {
      console.error('[HistoryTab] clear failed:', err);
      setClearState('idle');
    }
  }, [clearState, allEntries, activeTab, refresh]);

  const sectionMeta = {
    id: 'archive', index: '01', label: 'History',
    desc: 'Every recorded generation, browsable and reversible.',
  };

  // ── Aside (selected snapshot detail) ───────────────────────────────────────
  const asideSlot = selectedEntry ? (
    <EntryDetail
      key={selectedEntry.id}
      entry={selectedEntry}
      accentColor={accentColor}
      onRefresh={refresh}
    />
  ) : (
    <div className="hist-empty-state">
      <div className="hist-empty-icon">⟵</div>
      <div className="hist-empty-title">Select a snapshot</div>
      <div className="hist-empty-hint">Click any entry on the left to view its file changes.</div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="hist-tab trace-tab">

      <button
        className="help-btn"
        onClick={() => { setShowHelp(h => !h); setHelpSelected(null); }}
        title="Help Guide"
      >?</button>

      {showHelp && (
        <HistoryHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={t => { setActiveHelpTab(t); setHelpSelected(null); }}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
        />
      )}

      <TabLayout
        sections={[sectionMeta]}
        activeSection="archive"
        onSelect={() => {}}
        controlsWidth="half"
        navLabel="History console navigation"
        asideSlot={asideSlot}
        asideCaption={selectedEntry ? 'SNAPSHOT' : 'DIFF VIEWER'}
      >
        <div className="ctrl-col">

          {/* Filter block */}
          <div className="ctrl-block">
            <div className="ctrl-subtitle">Snapshots</div>
            <div className="ctrl-content">
              <div className="ctrl-field">
                <input
                  className="ctrl-input ctrl-input--text"
                  placeholder="Filter by map name or tab…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div className="hist-filter-row">
                <button
                  className={`hist-filter-pill${activeTab === 'all' ? ' active' : ''}`}
                  onClick={() => { setActiveTab('all'); setClearState('idle'); }}
                >All</button>
                {tabsWithHistory.map(tabId => (
                  <button
                    key={tabId}
                    className={`hist-filter-pill${activeTab === tabId ? ' active' : ''}`}
                    style={{ '--pill-c': TAB_COLORS[tabId] || 'var(--tab-color)' }}
                    onClick={() => { setActiveTab(tabId); setClearState('idle'); setSelectedId(null); }}
                  >{TAB_LABELS[tabId] || tabId}</button>
                ))}
              </div>

              {/* Clear history — only when a specific tab is selected */}
              {activeTab !== 'all' && (
                <>
                  {clearState === 'idle' && (
                    <button className="ctrl-btn-danger" onClick={handleClear}>Clear {TAB_LABELS[activeTab] || activeTab} History</button>
                  )}
                  {clearState === 'confirm' && (
                    <div className="hist-undo-bar-confirm hist-undo-bar-confirm--flush">
                      <span className="hist-undo-bar-confirm-msg">
                        <span className="hist-undo-bar-confirm-icon">⚠</span>
                        Delete all {TAB_LABELS[activeTab] || activeTab} history? This cannot be undone.
                      </span>
                      <div className="hist-undo-bar-confirm-actions">
                        <button className="hist-undo-bar-yes" onClick={handleClear}>Yes, clear</button>
                        <button className="hist-undo-bar-no"  onClick={() => setClearState('idle')}>Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Entry list block */}
          <div className="ctrl-block">
            <div className="ctrl-subtitle">Entries<span className="hist-entries-count">{filtered.length}</span></div>
            <div className="ctrl-content ctrl-content--flush">
              {filtered.length === 0 ? (
                <div className="hist-empty-state hist-empty-state--inline">
                  <div className="hist-empty-icon">⏱</div>
                  <div className="hist-empty-title">No history yet</div>
                  <div className="hist-empty-hint">
                    {search ? 'No entries match your search.' : 'Run a generation to record your first snapshot.'}
                  </div>
                </div>
              ) : (
                <div className="hist-entry-list">
                  {filtered.map(entry => {
                    const color   = TAB_COLORS[entry.tabId] || 'var(--tab-color)';
                    const isSel   = entry.id === selectedId;
                    const sum     = entry.summary ?? {};
                    const hasChg  = (sum.added??0) + (sum.removed??0) + (sum.modified??0) > 0;
                    return (
                      <button
                        type="button"
                        key={entry.id}
                        className={`station hist-entry${isSel ? ' active' : ''}`}
                        onClick={() => setSelectedId(isSel ? null : entry.id)}
                      >
                        <div className="hist-entry-row">
                          <span className="hist-entry-map">{entry.mapName || 'Unknown'}</span>
                          <span className="hist-entry-ts">{formatTs(entry.timestamp)}</span>
                        </div>
                        <div className="hist-entry-badges">
                          {!isSel && (
                            <span className="hist-source-badge" style={{ '--pill-c': color }}>
                              {TAB_LABELS[entry.tabId] || entry.tabId}
                            </span>
                          )}
                          {hasChg ? (
                            <>
                              {(sum.added   ?? 0) > 0 && <span className="hist-stat-chip add">+{sum.added}</span>}
                              {(sum.removed ?? 0) > 0 && <span className="hist-stat-chip rem">-{sum.removed}</span>}
                              {(sum.modified?? 0) > 0 && <span className="hist-stat-chip mod">~{sum.modified}</span>}
                            </>
                          ) : (
                            <span className="hist-entry-nochange">no changes</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </TabLayout>
    </div>
  );
}

export default HistoryTab;
