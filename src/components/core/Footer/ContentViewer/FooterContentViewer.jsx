import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import './FooterContentViewer.css';

// ═══════════════════════════════════════════════════════════════════════════════
// FooterContentViewer
//
// Extracted from GuideSection.jsx's HtmlViewer. Deliberately stripped of
// everything guide-specific: no category/author/series metadata, no video
// tab, no ToC bubbling-up. Just "load a pre-rendered HTML article, render
// it, let the user search it, or close it" -- the same content pipeline
// GuideSection already proved out (electronAPI IPC -> fetch fallback ->
// dangerouslySetInnerHTML with extracted <style> tags for the embedded
// highlight.js theme).
//
// NOTE ON WIRING (not solvable from this file alone):
// `contentChannel` defaults to 'read-footer-article' -- a NEW ipcMain handler,
// not the existing 'read-guide' one. Don't repoint this at 'read-guide' unless
// you also widen its main-process path validation; better to add a sibling
// handler with the same path-traversal guards, scoped to its own content root
// (mirrors how 'read-guide' is presumably scoped to guides/content/).
// Wire it in preload.js's IPC allowlist same as any other channel.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Main component ──────────────────────────────────────────────────────────

function FooterContentViewer({
  slug,
  title,
  contentRoot = 'footer',
  contentChannel = 'read-footer-article',
  onClose,
}) {
  const [rawHtml,    setRawHtml]    = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [scriptTick, setScriptTick] = useState(0);

  // ── In-content search (Ctrl+F) ────────────────────────────────────────────
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [searchIdx,   setSearchIdx]   = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchInputRef = useRef(null);
  const marksRef        = useRef([]);
  // ───────────────────────────────────────────────────────────────────────────

  const contentRef = useRef(null);

  // ── Load the pre-rendered article HTML ────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    setRawHtml('');

    const load = async () => {
      try {
        let text;
        if (window.electronAPI?.invoke) {
          // Bare filename -- 'read-footer-article' is expected to scope this
          // to its own content root on the main-process side, the same way
          // 'read-guide' scopes a bare htmlFile to guides/content/. (Passing
          // `${contentRoot}/${slug}.html` here previously didn't match that
          // convention, and didn't match the /content/ segment the fetch
          // fallback below uses either -- if 'read-footer-article' isn't
          // wired up yet in preload.js/ipcMain, that mismatch wasn't the
          // only thing blocking this; see the file-level note above.)
          text = await window.electronAPI.invoke(contentChannel, `${slug}.html`);
          if (text === null || text === undefined) throw new Error('not found');
        } else {
          const res = await fetch(`/${contentRoot}/content/${slug}.html`);
          if (!res.ok) throw new Error(res.statusText);
          text = await res.text();
        }
        setRawHtml(text);
        setScriptTick((t) => t + 1);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, contentRoot, contentChannel]);

  // Extract <style> tags from <head> (e.g. baked-in highlight.js theme) and
  // prepend so they apply when the body is rendered via dangerouslySetInnerHTML.
  const bodyHtml = useMemo(() => {
    if (!rawHtml) return '';
    const headStyles = [...rawHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
      .map((m) => `<style>${m[1]}</style>`)
      .join('\n');
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : rawHtml;
    return headStyles + body;
  }, [rawHtml]);

  // ── Search helpers (unchanged from HtmlViewer) ────────────────────────────
  const clearMarks = useCallback(() => {
    for (const m of marksRef.current) {
      const parent = m.parentNode;
      if (parent) { parent.replaceChild(document.createTextNode(m.textContent), m); parent.normalize(); }
    }
    marksRef.current = [];
  }, []);

  const applySearch = useCallback((term, jumpIdx) => {
    clearMarks();
    if (!term || !contentRef.current) { setSearchTotal(0); setSearchIdx(0); return; }
    const q = term.toLowerCase();
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    const marks = [];
    for (const tn of nodes) {
      const text = tn.textContent;
      const lower = text.toLowerCase();
      let pos = 0, start;
      const frag = document.createDocumentFragment();
      let hasMatch = false;
      while ((start = lower.indexOf(q, pos)) !== -1) {
        if (start > pos) frag.appendChild(document.createTextNode(text.slice(pos, start)));
        const mark = document.createElement('mark');
        mark.className = 'fcv-search-highlight';
        mark.textContent = text.slice(start, start + q.length);
        frag.appendChild(mark);
        marks.push(mark);
        pos = start + q.length;
        hasMatch = true;
      }
      if (hasMatch) {
        if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
        tn.parentNode.replaceChild(frag, tn);
      }
    }
    marksRef.current = marks;
    setSearchTotal(marks.length);
    const target = typeof jumpIdx === 'number' ? jumpIdx : 0;
    setSearchIdx(target);
    marks.forEach((m, i) => {
      m.className = i === target ? 'fcv-search-highlight fcv-search-highlight--active' : 'fcv-search-highlight';
    });
    if (marks[target]) marks[target].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [clearMarks]);

  const closeSearch = useCallback(() => {
    clearMarks();
    setSearchOpen(false);
    setSearchTerm('');
    setSearchTotal(0);
    setSearchIdx(0);
  }, [clearMarks]);

  const navigateSearch = useCallback((dir) => {
    const marks = marksRef.current;
    if (!marks.length) return;
    const next = (searchIdx + dir + marks.length) % marks.length;
    marks[searchIdx].className = 'fcv-search-highlight';
    marks[next].className = 'fcv-search-highlight fcv-search-highlight--active';
    marks[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSearchIdx(next);
  }, [searchIdx]);

  // Ctrl/Cmd+F opens search. Escape: closes search first if open, otherwise
  // closes the whole article -- the outer Footer is responsible for NOT also
  // collapsing the panel on this same Escape press (two-tier handling lives
  // one level up, in Footer.jsx).
  useEffect(() => {
    const onKey = (e) => {
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (mod && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        if (searchOpen) closeSearch();
        else onClose?.();
      } else if (e.key === 'Enter' && searchOpen) {
        e.preventDefault();
        navigateSearch(e.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, closeSearch, navigateSearch, onClose]);

  useEffect(() => { clearMarks(); setSearchOpen(false); setSearchTerm(''); setSearchTotal(0); }, [slug, clearMarks]);

  // Re-execute any <script> tags embedded in the article body (guarded against
  // double-registration via the window.__guard_* sentinel convention).
  useEffect(() => {
    if (scriptTick === 0) return;
    const el = contentRef.current;
    if (!el) return;

    const guardNames = [];
    const guardRx = /window\.(__guard_\w+)\s*=\s*true/g;
    el.querySelectorAll('script').forEach((old) => {
      if (!old.src) {
        let m;
        guardRx.lastIndex = 0;
        while ((m = guardRx.exec(old.textContent)) !== null) guardNames.push(m[1]);
      }
    });
    guardNames.forEach((g) => { delete window[g]; });

    el.querySelectorAll('script').forEach((old) => {
      const fresh = document.createElement('script');
      if (old.src) fresh.src = old.src;
      else fresh.textContent = old.textContent;
      old.replaceWith(fresh);
    });

    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); });
    return () => { guardNames.forEach((g) => { delete window[g]; }); };
  }, [scriptTick]);

  return (
    <div className="fcv-root" aria-label={title}>
      <div className="fcv-back-row">
        <div className="fcv-column">
          {onClose && (
            <button type="button" className="fcv-back-btn" onClick={onClose} aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>
          )}
        </div>
      </div>

      <div className="fcv-body">
        <div className="fcv-column">
          {loading && (
            <div className="fcv-loading"><div className="fcv-spinner" />Loading…</div>
          )}

          {!loading && error && (
            <div className="fcv-error">
              <div>Could not load <code>{slug}</code>.</div>
            </div>
          )}

          {!loading && !error && (
            <>
              {searchOpen && (
                <div className="fcv-search-bar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="fcv-search-icon">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    className="fcv-search-input"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); applySearch(e.target.value, 0); }}
                    placeholder="Search…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {searchTotal > 0 && (
                    <span className="fcv-search-count">{searchIdx + 1} / {searchTotal}</span>
                  )}
                  {searchTerm && searchTotal === 0 && (
                    <span className="fcv-search-count fcv-search-count--none">No results</span>
                  )}
                  <button className="fcv-search-nav" onClick={() => navigateSearch(-1)} title="Previous (Shift+Enter)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <button className="fcv-search-nav" onClick={() => navigateSearch(1)} title="Next (Enter)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                  <button className="fcv-search-close" onClick={closeSearch} title="Close (Esc)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <div
                ref={contentRef}
                className="fcv-content"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FooterContentViewer;
