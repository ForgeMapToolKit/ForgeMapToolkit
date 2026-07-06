import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import {
  GUIDE_CATEGORIES, GUIDES,
  getGuidesByCategory, getCategoryById, getGuideById,
  searchGuides,
} from '../guideData.js';
import './GuideSection.css';

const TAB_COLOR = '#C86FFF';
const ACCENT    = '#ff8c00';

// ─── Strip emojis ─────────────────────────────────────────────────────────────
const stripEmoji = (str) => {
  if (!str) return str;
  return str.replace(
    /[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu,
    ''
  ).trim();
};

// ═════════════════════════════════════════════════════════════════════════════════
// Error Boundary
// ═════════════════════════════════════════════════════════════════════════════════

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 16,
          color: 'rgba(255,255,255,0.5)', fontSize: 13,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ width: 36, height: 36, opacity: 0.4 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', maxWidth: 340, textAlign: 'center' }}>
            {this.state.error?.message ?? 'Unknown render error'}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8, padding: '6px 18px', fontSize: 12, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: 'rgba(255,255,255,0.6)',
            }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════════════════════

function SvgModal({ content, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sized = useMemo(() => {
    const vbMatch = content.match(/viewBox=["']([^"']+)["']/);
    if (!vbMatch) return content;
    const [, , , w, h] = vbMatch[1].split(/\s+/).map(Number);
    if (!w || !h) return content;
    return content
      .replace(/(<svg[^>]*?)\s+width=["'][^"']*["']/, '$1')
      .replace(/(<svg[^>]*?)\s+height=["'][^"']*["']/, '$1')
      .replace('<svg', `<svg width="100%" height="100%" style="display:block"`);
  }, [content]);

  return (
    <div className="gs-svg-modal-overlay" onClick={onClose}>
      <div className="gs-svg-modal-inner" onClick={e => e.stopPropagation()}>
        <button className="gs-svg-modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div className="gs-svg-modal-content" dangerouslySetInnerHTML={{ __html: sized }} />
      </div>
    </div>
  );
};

function ImgModal({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex ?? 0);
  const current = images[idx];
  const hasPrev = idx > 0;
  const hasNext = idx < images.length - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft'  && hasPrev) setIdx(i => i - 1);
      if (e.key === 'ArrowRight' && hasNext) setIdx(i => i + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext]);

  return (
    <div className="gs-svg-modal-overlay" onClick={onClose}
         style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {hasPrev && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
          style={{ position:'fixed', left:16, top:'50%', transform:'translateY(-50%)', zIndex:10001,
            background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
            borderRadius:6, padding:'10px 14px', cursor:'pointer', color:'#fff' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,display:'block'}}>
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      )}
      <div onClick={e => e.stopPropagation()}
           style={{ display:'flex', flexDirection:'column', alignItems:'center', maxWidth:'90vw', maxHeight:'90vh' }}>
        <button onClick={onClose}
          style={{ alignSelf:'flex-end', marginBottom:8, background:'rgba(255,255,255,0.08)',
            border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'4px 8px',
            cursor:'pointer', color:'#fff' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14,display:'block'}}>
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <img src={current.src} alt={current.alt ?? ''}
          style={{ maxWidth:'90vw', maxHeight:'80vh', objectFit:'contain', display:'block', borderRadius:4 }} />
        {(current.alt || images.length > 1) && (
          <div style={{ marginTop:8, fontSize:11, color:'rgba(255,255,255,0.45)', textAlign:'center' }}>
            {current.alt}{images.length > 1 ? ` — ${idx + 1} / ${images.length}` : ''}
          </div>
        )}
      </div>
      {hasNext && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
          style={{ position:'fixed', right:16, top:'50%', transform:'translateY(-50%)', zIndex:10001,
            background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
            borderRadius:6, padding:'10px 14px', cursor:'pointer', color:'#fff' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18,display:'block'}}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      )}
    </div>
  );
};

function VideoModal({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="gs-svg-modal-overlay" onClick={onClose}
         style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="gs-video-modal-inner" onClick={e => e.stopPropagation()}>
        <button className="gs-svg-modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <video src={src} autoPlay loop muted playsInline controls className="gs-video-modal-player" />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Image Gallery Context
// ═══════════════════════════════════════════════════════════════════════════════

const ImageGalleryContext = React.createContext(null);

function ImageGalleryProvider({ children }) {
  const [modal, setModal] = useState(null);
  const registryRef = useRef([]);

  const register = useCallback((src, alt) => {
    if (!registryRef.current.find(i => i.src === src)) {
      registryRef.current = [...registryRef.current, { src, alt }];
    }
  }, []);

  const open = useCallback((src) => {
    const images = registryRef.current;
    const index  = images.findIndex(i => i.src === src);
    setModal({ images, index: index >= 0 ? index : 0 });
  }, []);

  const close = useCallback(() => setModal(null), []);

  return (
    <ImageGalleryContext.Provider value={{ register, open }}>
      {children}
      {modal && <ImgModal images={modal.images} startIndex={modal.index} onClose={close} />}
    </ImageGalleryContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GuideImage
// ═══════════════════════════════════════════════════════════════════════════════

function GuideImage({ src, alt, widthPct, widthPx, assetCache, setAssetCache }) {
  const gallery     = React.useContext(ImageGalleryContext);
  const isDirectUrl = Boolean(src && (
    src.startsWith('blob:') || src.startsWith('data:') ||
    src.startsWith('http://') || src.startsWith('https://')
  ));
  const [resolved,  setResolved]  = useState(assetCache?.[src] ?? null);
  const [modalOpen, setModalOpen] = useState(false);

  // Width style: if widthPct given, constrain the figure to that percentage of the
  // container. Images inside always use max-width:100%/height:auto so they never
  // exceed the figure and keep their aspect ratio.
  const figureStyle = widthPx  ? { maxWidth: `${widthPx}px`, width: `${widthPx}px` }
                    : widthPct ? { maxWidth: `${widthPct}%` }
                    : undefined;

  useEffect(() => {
    if (!isDirectUrl && resolved?.type === 'img' && gallery) gallery.register(resolved.src, alt);
  }, [resolved, isDirectUrl, alt, gallery]);

  useEffect(() => {
    if (isDirectUrl && gallery) gallery.register(src, alt);
  }, [src, isDirectUrl, alt, gallery]);

  useEffect(() => {
    if (isDirectUrl || !src || resolved) return;
    if (assetCache?.[src]) { setResolved(assetCache[src]); return; }
    // Don't fire for obviously-incomplete paths (less than 5 chars or no extension)
    if (src.length < 5 || !src.includes('.')) return;

    const timer = setTimeout(async () => {
      try {
        let result;
        if (window.electronAPI?.invoke) {
          result = await window.electronAPI.invoke('read-guide-asset', src);
        } else {
          const GITHUB_RAW = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/guides/assets';
          const url = `${GITHUB_RAW}/${src.replace(/\\/g, '/')}`;
          const res = await fetch(url);
          if (!res.ok) return;
          if (src.endsWith('.svg')) {
            result = { type: 'svg', content: await res.text() };
          } else {
            result = { type: 'img', src: url };
          }
        }
        if (result && result.type && (result.src || result.content)) {
          setAssetCache(c => ({ ...c, [src]: result }));
          setResolved(result);
        } else {
          const err = { type: 'error', src };
          setAssetCache(c => ({ ...c, [src]: err }));
          setResolved(err);
        }
      } catch (e) {
        console.warn('[GuideImage] asset load failed:', src, e?.message);
        const err = { type: 'error', src };
        setAssetCache(c => ({ ...c, [src]: err }));
        setResolved(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [src, isDirectUrl]);

  const openImg = (imgSrc) => {
    if (gallery) gallery.open(imgSrc);
    else setModalOpen(true);
  };

  const zoomBtn = (
    <button className="gs-svg-zoom-btn" onClick={e => { e.stopPropagation(); openImg(isDirectUrl ? src : resolved?.src); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
      </svg>
    </button>
  );

  const notifyLayout = () =>
    window.dispatchEvent(new CustomEvent('gs-preview-layout-changed'));

  if (isDirectUrl) return (
    <span className="gs-img-figure" style={figureStyle}>
      <span className="gs-svg-wrap" onClick={() => openImg(src)}>
        <img className="gs-md-img" src={src} alt={alt ?? ''} style={{ cursor:'zoom-in' }}
          onLoad={notifyLayout} />
        {zoomBtn}
      </span>
      {alt && <span className="gs-img-caption">{alt}</span>}
    </span>
  );

  if (!resolved) return (
    <span style={{ display:'inline-block', width:40, height:18,
      background:'rgba(255,255,255,0.04)', borderRadius:3, verticalAlign:'middle' }} />
  );

  if (resolved.type === 'error') return (
    <span title={src} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px',
      fontSize:11, color:'rgba(255,255,255,0.25)', background:'rgba(255,255,255,0.04)',
      border:'1px solid rgba(255,255,255,0.08)', borderRadius:4, verticalAlign:'middle' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:11, height:11, opacity:0.5 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      {src.split('/').pop()}
    </span>
  );

  if (resolved.type === 'svg') return (
    <>
      {modalOpen && <SvgModal content={resolved.content} onClose={() => setModalOpen(false)} />}
      <span className="gs-img-figure" style={figureStyle}>
        <span className="gs-svg-wrap" onClick={() => setModalOpen(true)}>
          <span className="gs-md-svg" dangerouslySetInnerHTML={{ __html: resolved.content }} />
          <button className="gs-svg-zoom-btn" onClick={e => { e.stopPropagation(); setModalOpen(true); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
            </svg>
          </button>
        </span>
        {alt && <span className="gs-img-caption">{alt}</span>}
      </span>
    </>
  );

  return (
    <span className="gs-img-figure" style={figureStyle}>
      <span className="gs-svg-wrap" onClick={() => openImg(resolved.src)}>
        <img className="gs-md-img" src={resolved.src ?? ''} alt={alt ?? ''} style={{ cursor:'zoom-in' }}
          onLoad={notifyLayout} />
        {zoomBtn}
      </span>
      {alt && <span className="gs-img-caption">{alt}</span>}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VideoClip
// ═══════════════════════════════════════════════════════════════════════════════

function VideoClip({ src, widthPct, assetCache, setAssetCache }) {
  const isDirectUrl = Boolean(src && (
    src.startsWith('blob:') || src.startsWith('data:') ||
    src.startsWith('http://') || src.startsWith('https://')
  ));
  const [videoSrc, setVideoSrc] = useState(isDirectUrl ? src : (assetCache?.[src]?.src ?? null));
  const [modalOpen, setModalOpen] = useState(false);
  const wrapStyle = widthPct ? { maxWidth: `${widthPct}%` } : undefined;

  useEffect(() => {
    if (isDirectUrl || !src || videoSrc) return;
    if (assetCache?.[src]?.src) { setVideoSrc(assetCache[src].src); return; }

    const load = async () => {
      try {
        let result;
        if (window.electronAPI?.invoke) {
          result = await window.electronAPI.invoke('read-guide-asset', src);
        } else {
          const GITHUB_RAW = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/guides/assets';
          const url = `${GITHUB_RAW}/${src.replace(/\\/g, '/')}`;
          const res = await fetch(url);
          if (!res.ok) return;
          const blob = await res.blob();
          const dataUrl = await new Promise(r => {
            const reader = new FileReader();
            reader.onload = () => r(reader.result);
            reader.readAsDataURL(blob);
          });
          result = { type: 'video', src: dataUrl };
        }
        if (result?.src) {
          setAssetCache(c => ({ ...c, [src]: result }));
          setVideoSrc(result.src);
        }
      } catch (e) {
        console.warn('[VideoClip] asset load failed:', src, e?.message);
      }
    };
    load();
  }, [src, isDirectUrl]);

  if (!videoSrc) return null;

  return (
    <>
      {modalOpen && <VideoModal src={videoSrc} onClose={() => setModalOpen(false)} />}
      <span className="gs-video-wrap" style={wrapStyle} onClick={() => setModalOpen(true)}>
        <video src={videoSrc} autoPlay loop muted playsInline className="gs-md-video" />
        <button className="gs-svg-zoom-btn" onClick={e => { e.stopPropagation(); setModalOpen(true); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
          </svg>
        </button>
      </span>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Custom block components
// ═══════════════════════════════════════════════════════════════════════════════

function ComparisonBlock({ rows, assetCache, setAssetCache }) { return (
  <div className="gs-comparison">
    {rows.map(({ src, label, widthPct }, i) => (
      <div key={i} className="gs-comparison-item" style={widthPct ? { maxWidth: `${widthPct}%` } : undefined}>
        <GuideImage src={src} alt={null} widthPct={null} assetCache={assetCache} setAssetCache={setAssetCache} />
        {label && <div className="gs-comparison-label">{label}</div>}
      </div>
    ))}
  </div>
);
}

function NavigationStyleBlock({ title, body }) { return (
  <div className="gs-nav-style-block">
    {title && <span className="gs-nav-style-title">{title}</span>}
    {body  && <span className="gs-nav-style-body">{body}</span>}
  </div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HtmlEmbedBlock
// ═══════════════════════════════════════════════════════════════════════════════

function HtmlEmbedModal({ htmlContent, onClose }) {
  const containerRef = useRef(null);
  const mountId = useMemo(() => Math.random(), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !htmlContent) return;
    const suffix = `-${mountId.toString(36).slice(2, 8)}`;
    const guardNames = [];
    const guardRx = /window\.(__guard_\w+)\s*=\s*true/g;
    let m;
    while ((m = guardRx.exec(htmlContent)) !== null) guardNames.push(m[1]);

    el.querySelectorAll('[id]').forEach(node => { node.id = node.id + suffix; });
    el.querySelectorAll('script').forEach(old => {
      const fresh = document.createElement('script');
      if (old.src) {
        fresh.src = old.src;
      } else {
        let code = old.textContent.replace(
          /^if\s*\(!window\.__guard_\w+\)\s*\{\s*window\.__guard_\w+\s*=\s*true;\s*/, ''
        ).replace(/\s*\}$/, '');
        code = code.replace(
          /getElementById\(\s*(['"`])([^'"`]+)\1\s*\)/g,
          (_, q, id) => `getElementById(${q}${id}${suffix}${q})`
        );
        fresh.textContent = code;
      }
      old.replaceWith(fresh);
    });
    return () => { guardNames.forEach(g => { delete window[g]; }); };
  }, [mountId]);

  return (
    <div className="gs-svg-modal-overlay" onClick={onClose}>
      <div className="gs-html-embed-modal-inner" onClick={e => e.stopPropagation()}>
        <button className="gs-svg-modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div key={mountId} ref={containerRef} className="gs-html-embed-modal-content"
          dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </div>
  );
};

function HtmlEmbedBlock({ src, widthPct, assetCache, setAssetCache }) {
  const [htmlContent, setHtmlContent] = useState(assetCache?.[`html:${src}`] ?? null);
  const [error, setError]             = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [mountId, setMountId]         = useState(() => Math.random());
  const containerRef                  = useRef(null);
  const wrapStyle = widthPct ? { maxWidth: `${widthPct}%` } : undefined;

  useEffect(() => {
    if (!src) return;
    setMountId(Math.random());
    if (assetCache?.[`html:${src}`]) { setHtmlContent(assetCache[`html:${src}`]); return; }
    const load = async () => {
      try {
        let text;
        if (window.electronAPI?.invoke) {
          const result = await window.electronAPI.invoke('read-guide-asset', src);
          if (result?.content) text = result.content;
          else { setError(true); return; }
        } else {
          const GITHUB_RAW = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/guides/assets';
          const res = await fetch(`${GITHUB_RAW}/${src}`);
          if (!res.ok) { setError(true); return; }
          text = await res.text();
        }
        setAssetCache(c => ({ ...c, [`html:${src}`]: text }));
        setHtmlContent(text);
      } catch (_) { setError(true); }
    };
    load();
  }, [src]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !htmlContent) return;
    const suffix = `-${mountId.toString(36).slice(2, 8)}`;
    el.querySelectorAll('[id]').forEach(node => { node.id = node.id + suffix; });
    el.querySelectorAll('script').forEach(old => {
      const fresh = document.createElement('script');
      if (old.src) {
        fresh.src = old.src;
      } else {
        let code = old.textContent.replace(
          /^if\s*\(!window\.__guard_\w+\)\s*\{\s*window\.__guard_\w+\s*=\s*true;\s*/, ''
        ).replace(/\s*\}$/, '');
        code = code.replace(
          /getElementById\(\s*(['"`])([^'"`]+)\1\s*\)/g,
          (_, q, id) => `getElementById(${q}${id}${suffix}${q})`
        );
        fresh.textContent = code;
      }
      old.replaceWith(fresh);
    });
  }, [mountId]);

  if (error) return (
    <div style={{ padding:'12px 16px', background:'rgba(248,113,113,0.07)',
      border:'1px solid rgba(248,113,113,0.2)', borderRadius:6,
      fontSize:12, color:'#f87171', margin:'12px 0' }}>
      Could not load HTML widget: <code style={{ fontSize:11 }}>{src}</code>
    </div>
  );
  if (!htmlContent) return null;

  return (
    <>
      {modalOpen && <HtmlEmbedModal htmlContent={htmlContent} onClose={() => setModalOpen(false)} />}
      <div className="gs-html-embed-wrap" style={wrapStyle}>
        <div key={mountId} ref={containerRef} className="gs-html-embed"
          dangerouslySetInnerHTML={{ __html: htmlContent }} />
        <button className="gs-svg-zoom-btn gs-html-embed-zoom-btn" onClick={() => setModalOpen(true)} title="Fullscreen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
          </svg>
        </button>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HtmlViewer — renders a saved .html guide file
// ═══════════════════════════════════════════════════════════════════════════════

function HtmlViewer({ htmlFile, onHeadingsReady }) {
  const [rawHtml,    setRawHtml]    = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [scriptTick, setScriptTick] = useState(0);
  // ── In-guide search (Ctrl+F) ─────────────────────────────────────────────
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [searchIdx,   setSearchIdx]   = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  const searchInputRef = useRef(null);
  const marksRef       = useRef([]);
  // ─────────────────────────────────────────────────────────────────────────
  const bodyRef    = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setRawHtml('');
    const load = async () => {
      try {
        let text;
        if (window.electronAPI?.invoke) {
          text = await window.electronAPI.invoke('read-guide', htmlFile);
          if (text === null || text === undefined) throw new Error('not found');
        } else {
          const res = await fetch(`/guides/content/${htmlFile}`);
          if (!res.ok) throw new Error(res.statusText);
          text = await res.text();
        }
        setRawHtml(text);
        setScriptTick(t => t + 1);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [htmlFile]);

  const headings = useMemo(() => {
    if (!rawHtml) return [];
    return [...rawHtml.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => ({
      level: +m[1],
      text: m[2].replace(/<[^>]+>/g, '').trim(),
    }));
  }, [rawHtml]);

  // Bubble headings up to the layout so the Structure sidebar can render them
  useEffect(() => {
    if (onHeadingsReady) onHeadingsReady(headings);
  }, [headings, onHeadingsReady]);

  const bodyHtml = useMemo(() => {
    if (!rawHtml) return '';
    // Extract all <style> tags from <head> and prepend them so that
    // embedded CSS (e.g. highlight.js github-dark theme) is applied
    // when the HTML is rendered via dangerouslySetInnerHTML.
    const headStyles = [...rawHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
      .map(m => `<style>${m[1]}</style>`)
      .join('\n');
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : rawHtml;
    return headStyles + body;
  }, [rawHtml]);

  const scrollToHeading = useCallback((text) => {
    const body = bodyRef.current;
    if (!body) return;
    for (const el of body.querySelectorAll('h1,h2,h3')) {
      if (el.textContent.trim() === text.trim()) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }, []);

  // ── Ctrl+F search helpers ─────────────────────────────────────────────────
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
        mark.className = 'gs-search-highlight';
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
      m.className = i === target ? 'gs-search-highlight gs-search-highlight--active' : 'gs-search-highlight';
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
    marks[searchIdx].className = 'gs-search-highlight';
    marks[next].className = 'gs-search-highlight gs-search-highlight--active';
    marks[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSearchIdx(next);
  }, [searchIdx]);

  // Ctrl+F opens search bar; Escape closes; Enter navigates
  useEffect(() => {
    const onKey = (e) => {
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (mod && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchOpen) closeSearch();
      if (e.key === 'Enter' && searchOpen) { e.preventDefault(); navigateSearch(e.shiftKey ? -1 : 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, closeSearch, navigateSearch]);

  // Clear marks when guide changes
  useEffect(() => { clearMarks(); setSearchOpen(false); setSearchTerm(''); setSearchTotal(0); }, [htmlFile]);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (scriptTick === 0) return;
    const el = contentRef.current;
    if (!el) return;

    const guardNames = [];
    const guardRx = /window\.(__guard_\w+)\s*=\s*true/g;
    el.querySelectorAll('script').forEach(old => {
      if (!old.src) {
        let m;
        guardRx.lastIndex = 0;
        while ((m = guardRx.exec(old.textContent)) !== null) guardNames.push(m[1]);
      }
    });
    guardNames.forEach(g => { delete window[g]; });

    el.querySelectorAll('script').forEach(old => {
      const fresh = document.createElement('script');
      if (old.src) fresh.src = old.src;
      else fresh.textContent = old.textContent;
      old.replaceWith(fresh);
    });

    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); });
    return () => { guardNames.forEach(g => { delete window[g]; }); };
  }, [scriptTick]);

  if (loading) return (
    <div className="gs-viewer-loading"><div className="gs-viewer-spinner" />Loading...</div>
  );
  if (error) return (
    <div className="gs-viewer-error">
      <div>Could not load <code>{htmlFile}</code>.</div>
    </div>
  );

  return (
    <div ref={bodyRef} className="gs-md-body gs-htmlviewer-body" style={{ position:'relative' }}>
      {searchOpen && (
        <div className="gs-viewer-search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="gs-viewer-search-icon">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={searchInputRef}
            className="gs-viewer-search-input"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); applySearch(e.target.value, 0); }}
            placeholder="Search…"
            spellCheck={false}
            autoComplete="off"
          />
          {searchTotal > 0 && (
            <span className="gs-viewer-search-count">{searchIdx + 1} / {searchTotal}</span>
          )}
          {searchTerm && searchTotal === 0 && (
            <span className="gs-viewer-search-count gs-viewer-search-count--none">No results</span>
          )}
          <button className="gs-viewer-search-nav" onClick={() => navigateSearch(-1)} title="Previous (Shift+Enter)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button className="gs-viewer-search-nav" onClick={() => navigateSearch(1)} title="Next (Enter)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          <button className="gs-viewer-search-close" onClick={closeSearch} title="Close (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}
      <div ref={contentRef} className="gs-editor-content"
        style={{ maxWidth:'var(--gs-content-max-w)', margin:'0 auto', padding:'32px 40px' }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ContentViewer — renders a single guide
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_PAGES_GUIDE_BASE = 'https://timmasalme.github.io/ForgeMapToolkit-Assets/guides/content';

function ContentViewer({ guide, category, onHeadingsReady }) {
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('guide');
  const [copied,    setCopied]    = useState(false);

  const isLocal     = Boolean(guide.htmlFile);
  const isPlanned   = guide.status === 'planned';
  const hasVideo    = Boolean(guide.videoUrl);
  const hasExternal = Boolean(guide.externalUrl);

  const openExternal = (url) => {
    if (window.electronAPI?.invoke) window.electronAPI.invoke('open-external', url);
    else window.open(url, '_blank');
  };

  const copyGuideUrl = () => {
    const url = `${GITHUB_PAGES_GUIDE_BASE}/${(guide.htmlFile ?? '').replace(/\\/g, '/')}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const listMatch = url.match(/[?&]list=([^&]+)/);
    const vidMatch  = url.match(/[?&]v=([^&]+)|youtu\.be\/([^?]+)/);
    if (listMatch) return `https://www.youtube.com/embed/videoseries?list=${listMatch[1]}`;
    if (vidMatch)  return `https://www.youtube.com/embed/${vidMatch[1] || vidMatch[2]}`;
    return null;
  };

  const renderBody = () => {
    if (isPlanned) return (
      <div className="gs-viewer-planned">
        <div className="gs-viewer-planned-title">Not yet available</div>
        <div className="gs-viewer-planned-desc">This guide is planned but has not been written yet.</div>
        {guide.abstract && <p className="gs-viewer-planned-abstract">{guide.abstract}</p>}
      </div>
    );

    if (activeTab === 'video' && hasVideo) {
      const embedUrl = getYoutubeEmbedUrl(guide.videoUrl);
      if (embedUrl) return (
        <div className="gs-viewer-iframe-wrap">
          {loading && <div className="gs-viewer-loading"><div className="gs-viewer-spinner" />Loading video...</div>}
          <iframe src={embedUrl} title={guide.title} frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen className="gs-viewer-iframe"
            onLoad={() => setLoading(false)} style={{ opacity: loading ? 0 : 1 }} />
        </div>
      );
    }

    if (isLocal) return <HtmlViewer key={guide.htmlFile} htmlFile={guide.htmlFile} onHeadingsReady={onHeadingsReady} />;

    if (hasExternal) return (
      <div className="gs-viewer-external">
        <div className="gs-viewer-external-desc">
          This guide is hosted externally. Click below to open it in your browser.
        </div>
        <button className="gs-open-ext-btn" onClick={() => openExternal(guide.externalUrl)}>
          Open in browser
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <path d="M15 3h6v6M10 14L21 3"/>
          </svg>
        </button>
        {guide.abstract && <p className="gs-viewer-planned-abstract">{guide.abstract}</p>}
      </div>
    );

    return (
      <div className="gs-viewer-error">
        <div>No content available for this guide.</div>
      </div>
    );
  };

  return (
    <div className="gs-viewer">
      {/* Header */}
      <div className="gs-viewer-header">
        <div className="gs-viewer-title-block">
          <div className="gs-viewer-cat">{stripEmoji(category.label)}</div>
          <div className="gs-viewer-title">{guide.title}</div>
        </div>
        <div className="gs-viewer-meta">
          {guide.author && <span className="gs-viewer-author">by {guide.author}</span>}
          {guide.seriesName && (
            <span className="gs-viewer-series">{guide.seriesName} {guide.seriesPart}/{guide.seriesTotal}</span>
          )}
          {isLocal && guide.htmlFile && (
            <button className="gs-open-ext-btn" onClick={copyGuideUrl}>
              {copied ? 'Copied ✓' : 'Copy URL'}
            </button>
          )}
          {hasExternal && (
            <button className="gs-open-ext-btn" onClick={() => openExternal(guide.externalUrl)}>
              Open in browser
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <path d="M15 3h6v6M10 14L21 3"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Guide / Video tabs */}
      {hasVideo && (isLocal || hasExternal) && (
        <div className="gs-viewer-tabs">
          <button
            className={`gs-viewer-tab${activeTab === 'guide' ? ' gs-viewer-tab--active' : ''}`}
            onClick={() => setActiveTab('guide')}>
            📄 Guide
          </button>
          <button
            className={`gs-viewer-tab${activeTab === 'video' ? ' gs-viewer-tab--active' : ''}`}
            onClick={() => setActiveTab('video')}>
            ▶ Video
          </button>
        </div>
      )}

      <div className="gs-viewer-body">
        {renderBody()}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Category Thumbnail
// ═══════════════════════════════════════════════════════════════════════════════

function CategoryThumbnail({ categoryId, color, guideThumb }) {
  const svgThumbs = {
    water: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <defs>
          <radialGradient id="w-glow" cx="50%" cy="110%" r="75%">
            <stop offset="0%" stopColor="#1a4a7a" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#060e18" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="120" height="100" fill="#060e18"/>
        <ellipse cx="60" cy="80" rx="65" ry="24" fill="url(#w-glow)"/>
        <path d="M0 58 Q15 50 30 56 Q45 62 60 54 Q75 46 90 52 Q105 58 120 51 L120 100 L0 100Z" fill="#0d2840"/>
        <path d="M0 64 Q20 55 42 62 Q64 69 84 58 Q102 49 120 56 L120 100 L0 100Z" fill="#091e30" opacity="0.9"/>
        <path d="M0 70 Q30 64 60 70 Q90 76 120 68 L120 100 L0 100Z" fill="#060e18" opacity="0.95"/>
        <path d="M8 56 Q22 50 36 56 Q50 62 62 55" stroke="#378ADD" strokeWidth="0.9" fill="none" opacity="0.45"/>
        <path d="M65 52 Q80 46 96 52 Q108 57 118 52" stroke="#378ADD" strokeWidth="0.7" fill="none" opacity="0.3"/>
        <circle cx="28" cy="52" r="2.5" fill="#1D9E75" opacity="0.35"/>
        <circle cx="85" cy="49" r="2" fill="#1D9E75" opacity="0.25"/>
      </svg>
    ),
    terrain: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#090d05"/>
        <path d="M0 80 L20 55 L35 65 L55 30 L75 50 L90 38 L110 60 L120 52 L120 100 L0 100Z" fill="#141a09"/>
        <path d="M0 80 L20 55 L35 65 L55 30 L75 50 L90 38 L110 60 L120 52" stroke="#2a3a14" strokeWidth="0.8" fill="none"/>
        <path d="M55 30 L62 18 L69 30" fill="#1e2a10" stroke="#2e3e18" strokeWidth="0.5"/>
        <circle cx="62" cy="18" r="2" fill="#c8d890" opacity="0.5"/>
        <path d="M0 88 Q30 82 60 87 Q90 92 120 85 L120 100 L0 100Z" fill="#0e1408" opacity="0.9"/>
      </svg>
    ),
    editors: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#080810"/>
        <rect x="15" y="20" width="90" height="60" rx="2" fill="#0e0e1a" stroke="#1a1a2e" strokeWidth="0.5"/>
        <rect x="15" y="20" width="90" height="14" fill="#0c0c18" stroke="#1a1a2e" strokeWidth="0.5"/>
        <circle cx="24" cy="27" r="2.5" fill="#ff5f56" opacity="0.7"/>
        <circle cx="32" cy="27" r="2.5" fill="#febc2e" opacity="0.7"/>
        <circle cx="40" cy="27" r="2.5" fill="#28c840" opacity="0.7"/>
        <rect x="22" y="40" width="45" height="2" rx="0.5" fill="#C86FFF" opacity="0.3"/>
        <rect x="22" y="46" width="72" height="1.5" rx="0.5" fill="#2a2a3a"/>
        <rect x="22" y="51" width="60" height="1.5" rx="0.5" fill="#2a2a3a"/>
        <rect x="22" y="56" width="35" height="1.5" rx="0.5" fill="#C86FFF" opacity="0.15"/>
        <rect x="22" y="61" width="68" height="1.5" rx="0.5" fill="#2a2a3a"/>
        <rect x="22" y="66" width="50" height="1.5" rx="0.5" fill="#2a2a3a"/>
      </svg>
    ),
    gaea: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#0a0800"/>
        <path d="M10 75 Q30 40 50 55 Q70 70 90 35 L110 50 L110 90 L10 90Z" fill="#1a1200"/>
        <path d="M10 75 Q30 40 50 55 Q70 70 90 35" stroke="#ffb700" strokeWidth="0.8" fill="none" opacity="0.4"/>
        <circle cx="90" cy="35" r="8" fill="none" stroke="#ffb700" strokeWidth="0.6" opacity="0.3"/>
        <circle cx="90" cy="35" r="4" fill="#ffb700" opacity="0.12"/>
        <path d="M60 55 L80 30 L95 45" stroke="#ffb700" strokeWidth="0.5" fill="none" opacity="0.2"/>
        <rect x="20" y="78" width="80" height="1" fill="#ffb700" opacity="0.07"/>
      </svg>
    ),
    decals: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#0a0805"/>
        <rect x="20" y="20" width="80" height="60" fill="#120f08" stroke="#2a2010" strokeWidth="0.5"/>
        <rect x="20" y="20" width="80" height="60" fill="url(#d-tex)" opacity="0.4"/>
        <defs>
          <pattern id="d-tex" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="none"/>
            <circle cx="4" cy="4" r="0.8" fill="#FF9A3C" opacity="0.3"/>
          </pattern>
        </defs>
        <ellipse cx="60" cy="50" rx="28" ry="22" fill="none" stroke="#FF9A3C" strokeWidth="0.7" opacity="0.35"/>
        <ellipse cx="60" cy="50" rx="14" ry="11" fill="#FF9A3C" opacity="0.06"/>
        <line x1="20" y1="20" x2="100" y2="80" stroke="#FF9A3C" strokeWidth="0.4" opacity="0.12"/>
        <line x1="100" y1="20" x2="20" y2="80" stroke="#FF9A3C" strokeWidth="0.4" opacity="0.12"/>
      </svg>
    ),
    ai: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#0a0505"/>
        <circle cx="30" cy="50" r="5" fill="#FF4F4F" opacity="0.5"/>
        <circle cx="60" cy="30" r="5" fill="#FF4F4F" opacity="0.5"/>
        <circle cx="90" cy="50" r="5" fill="#FF4F4F" opacity="0.5"/>
        <circle cx="60" cy="70" r="5" fill="#FF4F4F" opacity="0.5"/>
        <circle cx="45" cy="40" r="3" fill="#FF4F4F" opacity="0.3"/>
        <circle cx="75" cy="40" r="3" fill="#FF4F4F" opacity="0.3"/>
        <circle cx="75" cy="60" r="3" fill="#FF4F4F" opacity="0.3"/>
        <circle cx="45" cy="60" r="3" fill="#FF4F4F" opacity="0.3"/>
        <line x1="30" y1="50" x2="60" y2="30" stroke="#FF4F4F" strokeWidth="0.6" opacity="0.25"/>
        <line x1="60" y1="30" x2="90" y2="50" stroke="#FF4F4F" strokeWidth="0.6" opacity="0.25"/>
        <line x1="90" y1="50" x2="60" y2="70" stroke="#FF4F4F" strokeWidth="0.6" opacity="0.25"/>
        <line x1="60" y1="70" x2="30" y2="50" stroke="#FF4F4F" strokeWidth="0.6" opacity="0.25"/>
        <line x1="30" y1="50" x2="90" y2="50" stroke="#FF4F4F" strokeWidth="0.4" opacity="0.15"/>
        <line x1="60" y1="30" x2="60" y2="70" stroke="#FF4F4F" strokeWidth="0.4" opacity="0.15"/>
      </svg>
    ),
    adaptive: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#0a0900"/>
        <rect x="25" y="35" width="30" height="30" rx="2" fill="#181600" stroke="#FFD700" strokeWidth="0.6" opacity="0.5"/>
        <rect x="65" y="35" width="30" height="30" rx="2" fill="#181600" stroke="#FFD700" strokeWidth="0.6" opacity="0.5"/>
        <path d="M55 50 Q60 44 65 50" stroke="#FFD700" strokeWidth="0.8" fill="none" opacity="0.6"/>
        <circle cx="60" cy="50" r="2" fill="#FFD700" opacity="0.4"/>
        <circle cx="40" cy="50" r="4" fill="#FFD700" opacity="0.2"/>
        <circle cx="80" cy="50" r="4" fill="#FFD700" opacity="0.2"/>
      </svg>
    ),
    skybox: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <defs>
          <radialGradient id="sky-g" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#1a0a2e"/>
            <stop offset="100%" stopColor="#050508"/>
          </radialGradient>
        </defs>
        <rect width="120" height="100" fill="url(#sky-g)"/>
        <circle cx="60" cy="25" r="10" fill="none" stroke="#FF8AFF" strokeWidth="0.6" opacity="0.3"/>
        <circle cx="60" cy="25" r="5" fill="#FF8AFF" opacity="0.08"/>
        {[...Array(12)].map((_, i) => {
          const a = (i/12)*Math.PI*2; const r = 35+Math.random()*25;
          const x = 60+r*Math.cos(a); const y = 50+r*Math.sin(a)*0.4;
          return <circle key={i} cx={x} cy={y} r={0.8+Math.random()*0.8} fill="#fff" opacity={0.1+Math.random()*0.3}/>;
        })}
        <ellipse cx="60" cy="88" rx="65" ry="8" fill="#0a0510" opacity="0.9"/>
      </svg>
    ),
    coop: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#050a0a"/>
        <circle cx="40" cy="50" r="12" fill="none" stroke="#00E5CC" strokeWidth="0.7" opacity="0.4"/>
        <circle cx="80" cy="50" r="12" fill="none" stroke="#00E5CC" strokeWidth="0.7" opacity="0.4"/>
        <circle cx="40" cy="50" r="5" fill="#00E5CC" opacity="0.15"/>
        <circle cx="80" cy="50" r="5" fill="#00E5CC" opacity="0.15"/>
        <line x1="52" y1="50" x2="68" y2="50" stroke="#00E5CC" strokeWidth="0.8" opacity="0.4"/>
        <circle cx="60" cy="50" r="2" fill="#00E5CC" opacity="0.5"/>
      </svg>
    ),
    vault: (
      <svg viewBox="0 0 120 100" width="120" height="100">
        <rect width="120" height="100" fill="#0a0505"/>
        <rect x="25" y="20" width="70" height="60" rx="2" fill="#150808" stroke="#FF6B6B" strokeWidth="0.6" opacity="0.5"/>
        <circle cx="60" cy="50" r="18" fill="none" stroke="#FF6B6B" strokeWidth="0.7" opacity="0.35"/>
        <circle cx="60" cy="50" r="8" fill="none" stroke="#FF6B6B" strokeWidth="0.5" opacity="0.25"/>
        <circle cx="60" cy="50" r="3" fill="#FF6B6B" opacity="0.2"/>
        <line x1="60" y1="32" x2="60" y2="50" stroke="#FF6B6B" strokeWidth="1" opacity="0.4"/>
        <line x1="60" y1="50" x2="72" y2="44" stroke="#FF6B6B" strokeWidth="0.7" opacity="0.3"/>
      </svg>
    ),
  };

  const svgEl       = svgThumbs[categoryId] ?? null;
  const fallbackColor = color ?? '#444';
  const [imgSrc, setImgSrc] = useState(null);
  const [svgContent, setSvgContent] = useState(null);

  useEffect(() => {
    if (!guideThumb && !categoryId) return;
    let cancelled = false;

    const tryLoad = async (path) => {
      try {
        let result;
        if (window.electronAPI?.invoke) {
          result = await window.electronAPI.invoke('read-guide-asset', path);
        } else {
          const url = `https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/guides/assets/${path}`;
          const res = await fetch(url);
          if (!res.ok) return false;
          result = { type: 'img', src: url };
        }
        if (!cancelled && result?.type === 'img') { setImgSrc(result.src); return true; }
      } catch (_) {}
      return false;
    };

    const tryLoadSvg = async (path) => {
      try {
        let result;
        if (window.electronAPI?.invoke) {
          result = await window.electronAPI.invoke('read-guide-asset', path);
        } else {
          const url = `https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/guides/assets/${path}`;
          const res = await fetch(url);
          if (!res.ok) return false;
          result = { type: 'svg', content: await res.text() };
        }
        if (!cancelled && result?.type === 'svg') { setSvgContent(result.content); return true; }
      } catch (_) {}
      return false;
    };

    const load = async () => {
      if (guideThumb) {
        if (await tryLoad(guideThumb)) return;
        if (guideThumb.endsWith('.svg') && await tryLoadSvg(guideThumb)) return;
      }
      if (await tryLoadSvg(`thumb/${categoryId}.svg`)) return;
      for (const ext of ['png', 'jpg', 'webp']) {
        if (await tryLoad(`thumb/${categoryId}.${ext}`)) return;
      }
    };

    load();
    return () => { cancelled = true; };
  }, [categoryId, guideThumb]);

  if (svgContent) return (
    <div style={{ width:'100%', height:'100%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}
      dangerouslySetInnerHTML={{ __html: svgContent }} />
  );

  if (imgSrc) return (
    <div style={{ width:'100%', height:'100%', background:'#0a0a0a',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'10%', boxSizing:'border-box' }}>
      <img src={imgSrc} alt={categoryId}
        style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', display:'block' }} />
    </div>
  );

  if (svgEl) return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
      {React.cloneElement(svgEl, { width:'100%', height:'100%', preserveAspectRatio:'xMidYMid meet', style:{ display:'block' } })}
    </div>
  );

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#111' }}>
      <div style={{ width:20, height:20, borderRadius:'50%', background:fallbackColor, opacity:0.5 }} />
    </div>
  );
};

// ─── Editor Thumbnail ─────────────────────────────────────────────────────────
function EditorThumbnail() { return (
  <div style={{ width:'100%', height:'100%', background:'#0e0e0e', overflow:'hidden' }}>
    <svg viewBox="0 0 120 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <rect width="120" height="100" fill="#0e0e0e"/>
      <rect x="20" y="20" width="80" height="60" rx="2" fill="#181818" stroke="#2a2a2a" strokeWidth="0.5"/>
      <rect x="20" y="20" width="80" height="12" rx="2" fill="#141414" stroke="#2a2a2a" strokeWidth="0.5"/>
      <rect x="24" y="24" width="16" height="4" rx="1" fill="#C86FFF" opacity="0.35"/>
      <rect x="44" y="24" width="12" height="4" rx="1" fill="#2a2a2a"/>
      <rect x="24" y="38" width="35" height="2" rx="0.5" fill="#333"/>
      <rect x="24" y="43" width="55" height="2" rx="0.5" fill="#2a2a2a"/>
      <rect x="24" y="48" width="45" height="2" rx="0.5" fill="#2a2a2a"/>
      <rect x="24" y="53" width="30" height="2" rx="0.5" fill="#333"/>
      <rect x="24" y="68" width="20" height="2" rx="0.5" fill="#C86FFF" opacity="0.2"/>
      <line x1="68" y1="32" x2="68" y2="80" stroke="#2a2a2a" strokeWidth="0.5"/>
    </svg>
  </div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Search view — renders results as guide cards
// ═══════════════════════════════════════════════════════════════════════════════

function SearchView({ query, onOpenGuide }) {
  const results = useMemo(() => searchGuides(query), [query]);

  return (
    <div className="gs-search-view">
      <div className="gs-search-view-count">
        {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </div>
      {results.length === 0 ? (
        <div className="gs-search-empty">No guides found.</div>
      ) : (
        <div className="gs-submenu-grid gs-search-grid">
          {results.map((g) => {
            const cat       = getCategoryById(g.category);
            const isPlanned = g.status === 'planned';
            return (
              <div key={g.id}
                className={`gs-guide-card${isPlanned ? ' gs-guide-card--planned' : ''}`}
                onClick={() => !isPlanned && onOpenGuide(g)}>
                <div className="gs-guide-card-thumb">
                  <CategoryThumbnail
                    categoryId={g.category}
                    color={cat?.color}
                    guideThumb={g.thumb} />
                  {isPlanned && <div className="gs-guide-card-planned-badge">Planned</div>}
                </div>
                <div className="gs-guide-card-info">
                  <div className="gs-guide-card-type">{stripEmoji(cat?.label ?? g.category)}</div>
                  {g.author && <span className="gs-guide-card-author">by {g.author}</span>}
                  <div className="gs-guide-card-title">{stripEmoji(g.title ?? g.id)}</div>
                  {g.abstract && !isPlanned && (
                    <div className="gs-guide-card-abstract">{g.abstract}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MainMenuPanel — fixed left sidebar: category list
// ═══════════════════════════════════════════════════════════════════════════════

function MainMenuPanel({ activeCatId, onSelectCategory, onOpenEditor, onGoHome, onGoMainMenu, hidden }) { return (
  <div className={`gs-layout-main${hidden ? ' gs-layout-main--hidden' : ''}`}>
    <div className="gs-layout-main-header">
      <div className="gs-layout-main-title">Guides</div>
    </div>
    {/* Home / back-to-grid button */}
    <button className="gs-layout-home-btn" onClick={onGoMainMenu}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
      Home
    </button>
    <div className="gs-layout-main-list">
      {GUIDE_CATEGORIES.map(cat => {
        const count   = getGuidesByCategory(cat.id).filter(g => g.status !== 'planned').length;
        const isActive = cat.id === activeCatId;
        return (
          <div key={cat.id}
            className={`gs-layout-cat-item${isActive ? ' gs-layout-cat-item--active' : ''}${count === 0 ? ' gs-layout-cat-item--empty' : ''}`}
            onClick={() => count > 0 && onSelectCategory(cat.id)}>
            <span className="gs-layout-cat-dot" style={{ background: cat.color }} />
            <span className="gs-layout-cat-name">{stripEmoji(cat.label)}</span>
            <span className="gs-layout-cat-count">{count || '—'}</span>
          </div>
        );
      })}
      <div className="gs-layout-cat-item gs-layout-cat-item--editor" onClick={onOpenEditor}>
        <span className="gs-layout-cat-dot" style={{ background: TAB_COLOR }} />
        <span className="gs-layout-cat-name">Editor</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ width:9, height:9, color: TAB_COLOR, opacity:0.6, flexShrink:0 }}>
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
        </svg>
      </div>
    </div>
  </div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SubMenuPanel — fixed second sidebar: guide list for active category
// ═══════════════════════════════════════════════════════════════════════════════

function SubMenuPanel({ activeCatId, activeGuideId, onOpenGuide, hidden }) {
  const category = useMemo(() => getCategoryById(activeCatId), [activeCatId]);

  const guides = useMemo(() => {
    if (!activeCatId) return [];
    return getGuidesByCategory(activeCatId);
  }, [activeCatId]);

  return (
    <div className={`gs-layout-sub${hidden ? ' gs-layout-sub--hidden' : ''}`}>
      <div className="gs-layout-sub-header">
        <div className="gs-layout-sub-catname">
          {category ? stripEmoji(category.label) : 'Guides'}
        </div>
      </div>
      <div className="gs-layout-sub-list">
        {guides.length === 0 ? (
          <div className="gs-subpanel-empty">No guides yet.</div>
        ) : guides.map((g, i) => {
          const isPlanned = g.status === 'planned';
          const isActive  = g.id === activeGuideId;
          return (
            <div key={g.id}
              className={`gs-subpanel-item${isActive ? ' gs-subpanel-item--active' : ''}${isPlanned ? ' gs-subpanel-item--planned' : ''}`}
              style={{ animationDelay:`${i*0.02}s` }}
              onClick={() => !isPlanned && onOpenGuide(g)}>
              <div className="gs-subpanel-item-accent" />
              <div className="gs-subpanel-item-inner">
                {g.seriesName && (
                  <div className="gs-subpanel-item-type">{g.seriesName} {g.seriesPart}/{g.seriesTotal}</div>
                )}
                <div className="gs-subpanel-item-title">{stripEmoji(g.title ?? g.id)}</div>
                {isPlanned && <span className="gs-subpanel-item-planned-tag">Planned</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// StructurePanel — ToC sidebar (right of submenu, left of content)
// ═══════════════════════════════════════════════════════════════════════════════

function StructurePanel({ headings, onScrollTo, hidden }) { return (
  <div className={`gs-layout-structure${hidden ? ' gs-layout-structure--hidden' : ''}`}>
    <div className="gs-layout-structure-label">Structure</div>
    {headings.length === 0 ? (
      <div className="gs-layout-structure-empty">—</div>
    ) : headings.map((h, i) => (
      <div key={i}
        className={`gs-layout-structure-item gs-layout-structure-item--h${h.level}`}
        onClick={() => onScrollTo(h.text)}
        title={h.text}>
        <span className="gs-layout-structure-dot" />
        <span className="gs-layout-structure-text">{h.text}</span>
      </div>
    ))}
  </div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CategoryGrid — shown in the content area when no guide is open
// ═══════════════════════════════════════════════════════════════════════════════

function CategoryGrid({ activeCatId, onOpenGuide }) {
  const guides = useMemo(() => getGuidesByCategory(activeCatId), [activeCatId]);
  const cat    = useMemo(() => getCategoryById(activeCatId), [activeCatId]);

  if (!activeCatId || guides.length === 0) return (
    <div className="gs-content-area gs-content-area--empty">
      <div style={{ color:'#282828', fontSize:11, letterSpacing:'0.08em' }}>Select a category</div>
    </div>
  );

  const [featured, ...rest] = guides;
  const isFeaturedPlanned = featured.status === 'planned';

  return (
    <div className="gs-content-area">
      <div className="gs-catgrid-wrap">

        {/* ── Featured Hero ── */}
        <div
          className={`gs-catgrid-featured${isFeaturedPlanned ? ' gs-catgrid-card--planned' : ''}`}
          onClick={() => !isFeaturedPlanned && onOpenGuide(featured)}>
          <div className="gs-catgrid-featured-thumb">
            <CategoryThumbnail
              categoryId={featured.category}
              color={cat?.color}
              guideThumb={featured.thumb} />
            <span className="gs-catgrid-card-badge" style={{ borderColor: cat?.color ?? 'var(--gs-tab)', color: cat?.color ?? 'var(--gs-tab)' }}>
              {stripEmoji(cat?.label ?? featured.category)}
            </span>
            {isFeaturedPlanned && <div className="gs-catgrid-card-planned">Planned</div>}
          </div>
          <div className="gs-catgrid-featured-info">
            <div className="gs-catgrid-featured-meta">
              {featured.author && <span className="gs-catgrid-card-author">by {featured.author}</span>}
              {featured.seriesName && (
                <span className="gs-catgrid-card-series">
                  {featured.seriesName} · Part {featured.seriesPart}/{featured.seriesTotal}
                </span>
              )}
            </div>
            <div className="gs-catgrid-featured-title">{stripEmoji(featured.title ?? featured.id)}</div>
            {featured.abstract && !isFeaturedPlanned && (
              <div className="gs-catgrid-featured-abstract">{featured.abstract}</div>
            )}
            <div className="gs-catgrid-featured-cta">Open Guide →</div>
          </div>
        </div>

        {/* ── Rest Grid ── */}
        {rest.length > 0 && (
          <div className="gs-catgrid">
            {rest.map((guide, i) => {
              const isPlanned = guide.status === 'planned';
              return (
                <div key={guide.id}
                  className={`gs-catgrid-card${isPlanned ? ' gs-catgrid-card--planned' : ''}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onClick={() => !isPlanned && onOpenGuide(guide)}>
                  <div className="gs-catgrid-card-img">
                    <CategoryThumbnail
                      categoryId={guide.category}
                      color={cat?.color}
                      guideThumb={guide.thumb} />
                    <span className="gs-catgrid-card-badge" style={{ borderColor: cat?.color ?? 'var(--gs-tab)', color: cat?.color ?? 'var(--gs-tab)' }}>
                      {stripEmoji(cat?.label ?? guide.category)}
                    </span>
                    {isPlanned && <div className="gs-catgrid-card-planned">Planned</div>}
                  </div>
                  <div className="gs-catgrid-card-info">
                    <div className="gs-catgrid-card-meta">
                      {guide.seriesName && <span className="gs-catgrid-card-series">{guide.seriesName} · {guide.seriesPart}/{guide.seriesTotal}</span>}
                      {guide.author && <span className="gs-catgrid-card-author">by {guide.author}</span>}
                    </div>
                    <div className="gs-catgrid-card-title">{stripEmoji(guide.title ?? guide.id)}</div>
                    {guide.abstract && !isPlanned && (
                      <div className="gs-catgrid-card-abstract">{guide.abstract}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GuideEditor — Markdown editor
// ═══════════════════════════════════════════════════════════════════════════════

function extractHeadings(md) {
  return [...md.matchAll(/^(#{1,3}) (.+)/gm)].map(m => ({
    level: m[1].length,
    text: m[2].trim(),
  }));
}

function countWords(md) {
  return md.replace(/```[\s\S]*?```/g, '').trim().split(/\s+/).filter(Boolean).length;
}

function insertAtCursor(ta, before, after = '', savedStart, savedEnd) {
  // execCommand('insertText') is unreliable in Electron/Chromium for controlled
  // React textareas — it sometimes returns true but inserts nothing, and after a
  // modal dialog the textarea loses focus so selectionStart/End reset to 0.
  // Always use manual string-splice and accept pre-modal cursor positions.
  const start = savedStart != null ? savedStart : ta.selectionStart;
  const end   = savedEnd   != null ? savedEnd   : ta.selectionEnd;
  const val   = ta.value;
  const sel   = val.slice(start, end);
  const newVal = val.slice(0, start) + before + sel + after + val.slice(end);
  return { newVal, newCursor: start + before.length + sel.length };
}

function MdPreview({ md }) {
  const [assetCache, setAssetCache] = useState({});

  // Build ordered list of source-line numbers for each non-empty line.
  // Each rendered block element grabs the next slot via nextLine().
  const blockLineIndex = useMemo(() => {
    const lines = md.split('\n');
    const idx = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) idx.push(i);
    }
    return idx;
  }, [md]);
  const blockCounterRef = useRef(0);
  blockCounterRef.current = 0;
  const nextLine = () => {
    const n = blockCounterRef.current++;
    return blockLineIndex[n] ?? n;
  };

  const processedContent = useMemo(() => {
    let s = md;
    // Encode each :::comparison block as a single base64 sentinel so
    // ReactMarkdown never splits it across children nodes.
    // Multiline: :::comparison 20\nimg1 | cap\nimg2 | cap\n:::
    s = s.replace(/:::comparison(?:\s+(\d+))?\s*\r?\n([\s\S]*?)\r?\n:::/g, (_, globalPct, inner) => {
      const encoded = btoa(unescape(encodeURIComponent(inner.trim())));
      const pct = globalPct ? globalPct : '';
      return `\nCOMPARISON_BLOCK::${pct}::${encoded}\n`;
    });
    // Single-line fallback: :::comparison 20 img1.png | cap1 img2.png | cap2 :::
    // Split on image path boundaries before any token containing a dot+image-ext
    s = s.replace(/:::comparison(?:\s+(\d+))?\s+(.+?)\s*:::/g, (_, globalPct, inner) => {
      const items = inner.split(/(?=\S+\.(?:png|jpg|jpeg|gif|webp|svg)\b)/i)
        .map(p => p.replace(/\*+/g, '_').trim())
        .filter(Boolean);
      const normalized = items.join('\n');
      const encoded = btoa(unescape(encodeURIComponent(normalized)));
      const pct = globalPct ? globalPct : '';
      return `\nCOMPARISON_BLOCK::${pct}::${encoded}\n`;
    });
    // Encode :::html blocks similarly — optional "| pct" suffix for width scaling
    // e.g.  :::html widgets/calc.html:::          (full width)
    //       :::html widgets/calc.html | 60:::     (60% wide)
    s = s.replace(/:::html\s+([^\s:|]+)\s*(?:\|\s*(\d+))?\s*:::/g, (_, assetPath, pct) => {
      return `\nHTMLEMBED_BLOCK::${pct ?? ''}::${assetPath.trim()}\n`;
    });
    // Float blocks: :::float left|right pct\nimage.png\nText next to image\n:::
    s = s.replace(/:::float\s+(left|right)\s+(\d+)\s*\r?\n([\s\S]*?)\r?\n:::/g, (_, side, pct, inner) => {
      const lines = inner.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const img  = lines[0];
      const text = lines.slice(1).join('\n');
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ side, pct, img, text }))));
      return `\nFLOAT_BLOCK::${encoded}\n`;
    });
    // Also support inline float via alt: ![caption||50||left](img.png) / ![caption||50||right](img.png)
    // These are handled at render time in the img component, no pre-processing needed.
    // Replace <br> inside table rows with sentinel ⏎ so ReactMarkdown passes it through.
    s = s.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        return line.replace(/<br\s*\/?>/gi, '\u23CE');
      }
      return line;
    }).join('\n');
    return s;
  }, [md]);

  const renderTableChildren = (children) => {
    const process = (child) => {
      if (typeof child !== 'string') return child;
      const parts = child.split('\u23CE');
      if (parts.length === 1) return child;
      return parts.flatMap((part, i) => i < parts.length - 1 ? [part, <br key={i} />] : [part]);
    };
    if (Array.isArray(children)) return children.map((c, i) => <React.Fragment key={i}>{process(c)}</React.Fragment>);
    return process(children);
  };

  const components = useMemo(() => ({
    h1: ({ children })  => <h1  className="gs-md-h1" data-line={nextLine()}>{children}</h1>,
    h2: ({ children })  => <h2  className="gs-md-h2" data-line={nextLine()}>{children}</h2>,
    h3: ({ children })  => <h3  className="gs-md-h3" data-line={nextLine()}>{children}</h3>,
    p:  ({ children })  => {
      const line = nextLine();
      const text = typeof children === 'string' ? children
        : Array.isArray(children) ? children.map(c => (typeof c === 'string' ? c : '')).join('') : '';

      if (text.startsWith('COMPARISON_BLOCK::')) {
        try {
          const withoutPrefix = text.slice('COMPARISON_BLOCK::'.length);
          const sepIdx = withoutPrefix.indexOf('::');
          const globalPct = sepIdx > 0 ? parseInt(withoutPrefix.slice(0, sepIdx), 10) : null;
          const encoded = withoutPrefix.slice(sepIdx + 2);
          const inner = decodeURIComponent(escape(atob(encoded)));
          const rows = inner.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
            const parts = l.split('|').map(p => p.trim());
            const src   = parts[0];
            const label = parts[1] ?? '';
            const perPct = parts[2] ? parseInt(parts[2], 10) : null;
            return { src, label, widthPct: perPct ?? globalPct ?? null };
          });
          return <div data-line={line}><ComparisonBlock rows={rows} assetCache={assetCache} setAssetCache={setAssetCache} /></div>;
        } catch (_) {}
      }
      if (text.startsWith('HTMLEMBED_BLOCK::')) {
        const withoutPrefix = text.slice('HTMLEMBED_BLOCK::'.length);
        const sepIdx = withoutPrefix.indexOf('::');
        const pctStr = sepIdx > 0 ? withoutPrefix.slice(0, sepIdx) : '';
        const assetPath = withoutPrefix.slice(sepIdx + 2).trim();
        const widthPct = pctStr ? parseInt(pctStr, 10) : null;
        return <div data-line={line}><HtmlEmbedBlock src={assetPath} widthPct={widthPct} assetCache={assetCache} setAssetCache={setAssetCache} /></div>;
      }
      if (text.startsWith('FLOAT_BLOCK::')) {
        try {
          const encoded = text.slice('FLOAT_BLOCK::'.length);
          const { side, pct, img, text: floatText } = JSON.parse(decodeURIComponent(escape(atob(encoded))));
          const isLeft = side === 'left';
          return (
            <div data-line={line} style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              flexDirection: isLeft ? 'row' : 'row-reverse',
              margin: '12px 0',
            }}>
              <div style={{ flexShrink: 0, width: `${pct}%` }}>
                <GuideImage src={img} alt="" widthPct={null} assetCache={assetCache} setAssetCache={setAssetCache} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{floatText}</ReactMarkdown>
              </div>
            </div>
          );
        } catch (_) {}
      }
      return <p className="gs-md-p" data-line={line}>{children}</p>;
    },
    ul: ({ children })  => <ul  className="gs-md-ul" data-line={nextLine()}>{children}</ul>,
    ol: ({ children })  => <ol  className="gs-md-ol" data-line={nextLine()}>{children}</ol>,
    li: ({ children })  => <li  className="gs-md-li">{children}</li>,
    blockquote: ({ children }) => <blockquote className="gs-md-blockquote" data-line={nextLine()}>{children}</blockquote>,
    hr: ()              => <hr  className="gs-md-hr" />,
    strong: ({ children }) => <strong className="gs-md-strong">{children}</strong>,
    em:     ({ children }) => <em     className="gs-md-em">{children}</em>,
    a:  ({ href, children }) => (
      <a className="gs-md-link" href={href}
        onClick={e => { e.preventDefault(); if (href) { if (window.electronAPI?.invoke) window.electronAPI.invoke('open-external', href); else window.open(href, '_blank'); } }}>
        {children}
      </a>
    ),
    pre:  ({ children }) => <pre  className="gs-md-pre" data-line={nextLine()}>{children}</pre>,
    code: ({ node, className, children, ...props }) => {
      const isBlock = Boolean(className);
      // For block code, rehype-highlight has already injected coloured <span>s
      // into `children` — just pass them through with the combined class list.
      // Do NOT add extra children; that caused the double-text / offset bug.
      return isBlock
        ? <code className={`gs-md-code ${className ?? ''}`} {...props}>{children}</code>
        : <code className="gs-md-code-inline" {...props}>{children}</code>;
    },
    table:   ({ children }) => <table   className="gs-md-table" data-line={nextLine()}>{children}</table>,
    thead:   ({ children }) => <thead>{children}</thead>,
    tbody:   ({ children }) => <tbody>{children}</tbody>,
    tr:      ({ children }) => <tr>{children}</tr>,
    th:      ({ children }) => <th  className="gs-md-th" style={{verticalAlign:'middle'}}>{renderTableChildren(children)}</th>,
    td:      ({ children }) => <td  className="gs-md-td" style={{verticalAlign:'middle'}}>{renderTableChildren(children)}</td>,
    img: ({ src, alt }) => {
      const line = nextLine();
      // Guard against undefined src — can happen when an empty line appears
      // inside a Markdown table, causing ReactMarkdown to emit a broken img
      // node with src=undefined, which crashes React's DOM renderer via
      // .toLowerCase() on undefined.
      if (!src) return null;
      const isVideo = Boolean(alt?.includes('{video}'));
      // Supported syntaxes (:: and || are both accepted; :: is preferred in tables
      // because | would be interpreted as a column separator by Markdown):
      //   ![cap::60px::left](img.png)   image+label flex row, 60px wide  (table-safe)
      //   ![cap::50::left](img.png)     image+label flex row, 50% wide   (table-safe)
      //   ![cap||50||left](img.png)     same, legacy syntax (outside tables)
      //   ![cap::60px](img.png)         60px wide block image
      //   ![cap::50](img.png)           50% wide block image
      const SEP = alt?.includes('::') ? '::' : '||';
      const alignMatch = (alt ?? '').match(new RegExp(`\\${SEP}(left|right)$`, 'i'));
      const align      = alignMatch ? alignMatch[1].toLowerCase() : null;
      const altNoAlign = (alt ?? '').replace(new RegExp(`\\${SEP}(left|right)$`, 'i'), '');
      const pxMatch    = altNoAlign.match(new RegExp(`\\${SEP}(\\d+)px$`, 'i'));
      const widthPx    = pxMatch ? parseInt(pxMatch[1], 10) : null;
      const pctMatch   = !pxMatch ? altNoAlign.match(new RegExp(`\\${SEP}(\\d+)$`)) : null;
      const widthPct   = pctMatch ? parseInt(pctMatch[1], 10) : null;
      const realAlt    = altNoAlign
        .replace('{video}', '')
        .replace(new RegExp(`\\${SEP}\\d+px$`, 'i'), '')
        .replace(new RegExp(`\\${SEP}\\d+$`), '')
        .trim();
      if (isVideo) return (
        <span data-line={line}><VideoClip src={src} widthPct={widthPct} assetCache={assetCache} setAssetCache={setAssetCache} /></span>
      );
      if (align) {
        const isLeft = align === 'left';
        // inline-flex works inside table cells; CSS float is ignored in td/th.
        // Pass alt="" to GuideImage to suppress its caption — we render the
        // label once ourselves so it never appears twice.
        return (
          <span data-line={line} style={{
            display: 'inline-flex',
            flexDirection: isLeft ? 'row' : 'row-reverse',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ flexShrink: 0, width: widthPx ? `${widthPx}px` : widthPct ? `${widthPct}%` : 'auto' }}>
              <GuideImage src={src} alt="" widthPct={null} widthPx={widthPx} assetCache={assetCache} setAssetCache={setAssetCache} />
            </span>
            {realAlt && <span style={{ whiteSpace: 'nowrap' }}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <>{children}</>, strong: ({children}) => <strong className="gs-md-strong">{children}</strong>, em: ({children}) => <em className="gs-md-em">{children}</em> }}>{realAlt}</ReactMarkdown></span>}
          </span>
        );
      }
      return (
        <span data-line={line}>
          <GuideImage src={src} alt={realAlt} widthPct={widthPct} widthPx={widthPx} assetCache={assetCache} setAssetCache={setAssetCache} />
        </span>
      );
    },
  }), [assetCache]);

  return (
    <div className="gs-md-body gs-editor-preview-body">
      <ImageGalleryProvider>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
          {processedContent}
        </ReactMarkdown>
      </ImageGalleryProvider>
    </div>
  );
};

function TB({ title, onClick, active, children, wide }) { return (
  <button
    className={['gs-tb', wide ? 'gs-tb--wide' : '', active ? 'gs-tb--active' : ''].filter(Boolean).join(' ')}
    title={title} onClick={onClick}>
    {children}
  </button>
);
}

// Link / Image / Html modals (unchanged internals, just referenced below)
function LinkModal({ onClose, onInsert }) {
  const [url, setUrl]   = useState('');
  const [text, setText] = useState('');
  return (
    <div className="gs-modal-backdrop" onClick={onClose}>
      <div className="gs-modal" onClick={e => e.stopPropagation()}>
        <div className="gs-modal-title">Insert Link</div>
        <div className="gs-modal-row">
          <label className="gs-modal-label">URL</label>
          <input className="gs-modal-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" autoFocus />
        </div>
        <div className="gs-modal-row">
          <label className="gs-modal-label">Display text (optional)</label>
          <input className="gs-modal-input" value={text} onChange={e => setText(e.target.value)} placeholder="Link text" />
        </div>
        <div className="gs-modal-actions">
          <button className="gs-editor-btn" onClick={onClose}>Cancel</button>
          <button className="gs-editor-btn gs-editor-btn--primary" onClick={() => { onInsert(url, text); onClose(); }}>Insert</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PathInput — asset path autocomplete
// Calls guide-asset-list (IPC) to get all files under guides/assets/ and
// filters them as you type. No network request needed — pure local disk scan.
// ═══════════════════════════════════════════════════════════════════════════════

const _assetListCache = { data: null };

async function fetchAssetList() {
  if (_assetListCache.data) return _assetListCache.data;
  try {
    if (window.electronAPI?.invoke) {
      const list = await window.electronAPI.invoke('guide-asset-list');
      console.log('[PathInput] guide-asset-list returned', Array.isArray(list) ? list.length : list, 'items');
      _assetListCache.data = Array.isArray(list) ? list : [];
    } else {
      console.warn('[PathInput] window.electronAPI.invoke not available, electronAPI=', window.electronAPI);
      _assetListCache.data = [];
    }
  } catch (e) {
    console.error('[PathInput] guide-asset-list failed:', e);
    _assetListCache.data = [];
  }
  return _assetListCache.data;
}

const IMAGE_EXTS = /\.(png|jpg|jpeg|webp|gif|svg)$/i;
const HTML_EXTS  = /\.(html|htm)$/i;

function PathInput({ value, onChange, placeholder, autoFocus, accept }) {
  const [suggestions, setSuggestions] = useState([]);
  const [allPaths,    setAllPaths]    = useState([]);
  const [open,        setOpen]        = useState(false);
  const [highlight,   setHighlight]   = useState(0);
  const [loading,     setLoading]     = useState(false);
  const wrapRef    = useRef(null);
  const loadedRef  = useRef(false);

  const applyFilter = (paths, v) => {
    if (!v.trim()) { setSuggestions([]); setOpen(false); return; }
    const q = v.toLowerCase();
    const matches = paths.filter(p => p.toLowerCase().includes(q)).slice(0, 14);
    setSuggestions(matches);
    setOpen(matches.length > 0);
    setHighlight(0);
  };

  // Load on mount — but also retry on first keystroke if mount load returned empty
  const ensureLoaded = async (currentValue) => {
    if (loadedRef.current) return allPaths;
    setLoading(true);
    const raw = await fetchAssetList();
    const filtered = accept === 'image' ? raw.filter(p => IMAGE_EXTS.test(p))
                   : accept === 'html'  ? raw.filter(p => HTML_EXTS.test(p))
                   : raw;
    loadedRef.current = true;
    setAllPaths(filtered);
    setLoading(false);
    return filtered;
  };

  useEffect(() => { ensureLoaded(); }, [accept]);

  const handleChange = async (e) => {
    const v = e.target.value;
    onChange(v);
    // If paths not yet loaded, wait for them first
    const paths = loadedRef.current ? allPaths : await ensureLoaded(v);
    applyFilter(paths, v);
  };

  const pick = (p) => {
    // Normalise file extension to lowercase (e.g. file.PNG → file.png)
    const normalised = p.replace(/(\.[^./\\]+)$/, ext => ext.toLowerCase());
    onChange(normalised);
    setSuggestions([]);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (suggestions[highlight]) pick(suggestions[highlight]); }
    if (e.key === 'Escape')    { setOpen(false); }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const renderHighlighted = (str) => {
    if (!value.trim()) return str;
    const q   = value.toLowerCase();
    const idx = str.toLowerCase().indexOf(q);
    if (idx === -1) return str;
    return (
      <>
        {str.slice(0, idx)}
        <mark style={{ background:'rgba(200,111,255,0.3)', color:'#e0b0ff', borderRadius:2, padding:'0 1px' }}>
          {str.slice(idx, idx + q.length)}
        </mark>
        {str.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <input
        className="gs-modal-input"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { ensureLoaded(); if (value) applyFilter(allPaths, value); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        autoComplete="off"
      />
      {loading && (
        <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
          width:10, height:10, borderRadius:'50%', border:'2px solid rgba(200,111,255,0.3)',
          borderTopColor:'var(--gs-tab)', animation:'gsSpin 0.72s linear infinite' }} />
      )}
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:10000,
          background:'#0e0e10', border:'1px solid rgba(200,111,255,0.25)',
          borderTop:'none', maxHeight:220, overflowY:'auto',
          boxShadow:'0 8px 24px rgba(0,0,0,0.6)',
          scrollbarWidth:'thin', scrollbarColor:'rgba(200,111,255,0.15) transparent',
        }}>
          {suggestions.map((s, i) => (
            <div key={s}
              onMouseDown={() => pick(s)}
              style={{
                padding:'7px 12px', fontSize:11, fontFamily:'var(--gs-mono)',
                color: i === highlight ? '#e0b0ff' : 'rgba(255,255,255,0.55)',
                background: i === highlight ? 'rgba(200,111,255,0.1)' : 'transparent',
                cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                borderBottom:'1px solid rgba(255,255,255,0.04)',
              }}>
              {renderHighlighted(s)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function ImageModal({ onClose, onInsert }) {
  const [url, setUrl]     = useState('');
  const [alt, setAlt]     = useState('');
  const [pct, setPct]     = useState(100);
  const [isVideo, setIsVideo] = useState(false);

  const insert = () => {
    // Pass pct as a separate third argument — no need to encode it in the alt string
    onInsert(url, isVideo ? `${alt}{video}` : alt, isVideo ? null : pct);
    onClose();
  };

  return (
    <div className="gs-modal-backdrop" onClick={onClose}>
      <div className="gs-modal gs-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="gs-modal-title">Insert Image / Video</div>
        <div className="gs-modal-row">
          <label className="gs-modal-label">Relative asset path (e.g. <code style={{fontSize:10}}>skybox/Cirrus_Clouds/img1.png</code>)</label>
          <PathInput value={url} onChange={setUrl} placeholder="category/subfolder/filename.png" autoFocus accept={isVideo ? undefined : 'image'} />
        </div>
        <div className="gs-modal-row">
          <label className="gs-modal-label">Alt text / caption</label>
          <input className="gs-modal-input" value={alt} onChange={e => setAlt(e.target.value)} placeholder="Description" />
        </div>
        <div className="gs-modal-row">
          <label className="gs-modal-label">Width — {pct}%</label>
          <input type="range" min="10" max="100" step="5" value={pct}
            onChange={e => setPct(+e.target.value)} className="gs-modal-slider" />
          <div className="gs-modal-slider-marks">
            {[25,50,75,100].map(v => (
              <button key={v} className={`gs-modal-slider-mark${pct===v?' active':''}`}
                onClick={() => setPct(v)}>{v}%</button>
            ))}
          </div>
        </div>
        <div className="gs-modal-row">
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#666', cursor:'pointer' }}>
            <input type="checkbox" checked={isVideo} onChange={e => setIsVideo(e.target.checked)}
              style={{ accentColor: TAB_COLOR }} />
            Treat as video clip (muted autoplay)
          </label>
        </div>
        <div className="gs-modal-actions">
          <button className="gs-editor-btn" onClick={onClose}>Cancel</button>
          <button className="gs-editor-btn gs-editor-btn--primary" onClick={insert}>Insert</button>
        </div>
      </div>
    </div>
  );
};

function HtmlModal({ onClose, onInsert }) {
  const [path, setPct_path] = useState('');
  const [pct,  setPct]      = useState(100);
  return (
    <div className="gs-modal-backdrop" onClick={onClose}>
      <div className="gs-modal" onClick={e => e.stopPropagation()}>
        <div className="gs-modal-title">Embed HTML Widget</div>
        <div className="gs-modal-row">
          <label className="gs-modal-label">Asset path (relative to assets/)</label>
          <PathInput value={path} onChange={setPct_path} placeholder="widgets/calculator.html" autoFocus accept="html" />
        </div>
        <div className="gs-modal-row">
          <label className="gs-modal-label">Width — {pct}%</label>
          <input type="range" min="10" max="100" step="5" value={pct}
            onChange={e => setPct(+e.target.value)} className="gs-modal-slider" />
          <div className="gs-modal-slider-marks">
            {[25,50,75,100].map(v => (
              <button key={v} className={`gs-modal-slider-mark${pct===v?' active':''}`}
                onClick={() => setPct(v)}>{v}%</button>
            ))}
          </div>
        </div>
        <div className="gs-modal-actions">
          <button className="gs-editor-btn" onClick={onClose}>Cancel</button>
          <button className="gs-editor-btn gs-editor-btn--primary"
            onClick={() => { onInsert(path, pct < 100 ? pct : null); onClose(); }}>Insert</button>
        </div>
      </div>
    </div>
  );
};

// ── Syntax highlighting for the editor overlay ───────────────────────────
// Produces HTML where each token is wrapped in a <span> with `color: X`.
// The overlay sits behind the transparent textarea so only the colors show.
const SYNTAX_COLORS = {
  heading:    '#C86FFF',   // # ## ###
  bold:       '#e8b4ff',   // **text**
  italic:     '#d4a0ff',   // *text*
  strike:     '#7a5a88',   // ~~text~~
  inlineCode: '#ffa94d',   // `code`
  codeOpen:   '#56d4a0',   // ```lang  line
  codeClose:  '#56d4a0',   // ``` closing line
  codeLang:   '#ff7eb3',   // the language name after ```
  codeBody:   '#8fa3b1',   // lines inside a fenced block
  blockquote: '#7a8fa0',   // > quote
  listMarker: '#C86FFF',   // - / * / 1.
  link:       '#56aeff',   // [text](url)
  imgBang:    '#ff7eb3',   // ![
  highlight:  '#ffd166',   // ==text==
  htmlTag:    '#7a9aff',   // :::html / :::comparison
  hr:         '#444',      // ---
  tableCell:  '#8fa3b1',   // | cell |
  comment:    '#555',      // not used yet
};

const buildSyntaxOverlayHtml = (text) => {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (color, content) => `<span style="color:${color}">${content}</span>`;

  const lines = text.split('\n');
  const out = [];
  let inFence = false;
  let fenceDelim = ''; // the full opening fence e.g. "```" or "~~~"

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    // ── Fenced code block open/close ─────────────────────────────────────
    const fenceOpenRx = /^(\s*)(```+|~~~+)(.*)$/;
    const fenceMatch  = line.match(fenceOpenRx);

    if (!inFence && fenceMatch) {
      inFence    = true;
      fenceDelim = fenceMatch[2];
      const langRaw = fenceMatch[3]; // preserve original spacing
      let h = esc(fenceMatch[1]) + span(SYNTAX_COLORS.codeOpen, esc(fenceMatch[2]));
      if (langRaw.trim()) h += span(SYNTAX_COLORS.codeLang, esc(langRaw));
      out.push(h);
      continue;
    }

    if (inFence) {
      // Closing fence: same char type, at least as many chars, nothing else
      const fChar  = fenceDelim[0];
      const fCount = fenceDelim.length;
      const escaped = fChar === '`' ? '`' : '~';
      const closeRx = new RegExp(`^\\s*${escaped}{${fCount},}\\s*$`);
      if (closeRx.test(line)) {
        inFence    = false;
        fenceDelim = '';
        out.push(span(SYNTAX_COLORS.codeClose, esc(line)));
      } else {
        out.push(span(SYNTAX_COLORS.codeBody, esc(line)));
      }
      continue;
    }

    // ── Horizontal rule (---, ***, ___) ──────────────────────────────────
    // Only match if the ENTIRE trimmed line is 3+ of the same separator char
    if (/^[ \t]*([-*_])\1\1+[ \t]*$/.test(line)) {
      out.push(span(SYNTAX_COLORS.hr, esc(line)));
      continue;
    }

    // ── Headings — "# text" (hash followed by space) ──────────────────────
    const headingMatch = line.match(/^(#{1,6}) (.+)/);
    if (headingMatch) {
      out.push(span(SYNTAX_COLORS.heading, esc(headingMatch[1])) + esc(' ' + headingMatch[2]));
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────
    if (/^>/.test(line)) {
      out.push(span(SYNTAX_COLORS.blockquote, esc(line)));
      continue;
    }

    // ── Custom blocks :::… ────────────────────────────────────────────────
    if (/^:::/.test(line)) {
      out.push(span(SYNTAX_COLORS.htmlTag, esc(line)));
      continue;
    }

    // ── Table rows ────────────────────────────────────────────────────────
    if (/^\|/.test(line)) {
      if (/^\|[\s|:−-]+\|$/.test(line)) {
        out.push(span(SYNTAX_COLORS.hr, esc(line)));
      } else {
        out.push(span(SYNTAX_COLORS.tableCell, esc(line)));
      }
      continue;
    }

    // ── Inline tokeniser ─────────────────────────────────────────────────
    let result = '';
    let i = 0;
    const len = line.length;

    // List marker: "- ", "* ", "+ ", "1. " — marker char must be followed by whitespace
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)(\s+)/);
    if (listMatch) {
      result += esc(listMatch[1]) +
                span(SYNTAX_COLORS.listMarker, esc(listMatch[2])) +
                esc(listMatch[3]);
      i = listMatch[0].length;
    }

    while (i < len) {
      const ch  = line[i];
      const ch2 = line[i + 1];
      const ch3 = line[i + 2];

      // Inline code `…` — single backtick only (not ``)
      if (ch === '`' && ch2 !== '`') {
        const end = line.indexOf('`', i + 1);
        if (end !== -1 && end > i) {
          result += span(SYNTAX_COLORS.inlineCode, esc(line.slice(i, end + 1)));
          i = end + 1;
          continue;
        }
      }

      // Highlight ==…==
      if (ch === '=' && ch2 === '=') {
        const end = line.indexOf('==', i + 2);
        if (end !== -1 && end > i + 1) {
          result += span(SYNTAX_COLORS.highlight, esc(line.slice(i, end + 2)));
          i = end + 2;
          continue;
        }
      }

      // Bold **…** — opening ** must not be followed by space; checked BEFORE italic *
      if (ch === '*' && ch2 === '*' && ch3 && ch3 !== ' ') {
        const rest = line.indexOf('**', i + 2);
        if (rest !== -1 && rest > i + 2) {
          result += span(SYNTAX_COLORS.bold, esc(line.slice(i, rest + 2)));
          i = rest + 2;
          continue;
        }
      }

      // Bold __…__ — opening __ must not be followed by space
      if (ch === '_' && ch2 === '_' && ch3 && ch3 !== ' ') {
        const rest = line.indexOf('__', i + 2);
        if (rest !== -1 && rest > i + 2) {
          result += span(SYNTAX_COLORS.bold, esc(line.slice(i, rest + 2)));
          i = rest + 2;
          continue;
        }
      }

      // Strikethrough ~~…~~
      if (ch === '~' && ch2 === '~') {
        const end = line.indexOf('~~', i + 2);
        if (end !== -1 && end > i + 1) {
          result += span(SYNTAX_COLORS.strike, esc(line.slice(i, end + 2)));
          i = end + 2;
          continue;
        }
      }

      // Italic *…* — ch2 must not be * (that would be bold), must exist, not space
      if (ch === '*' && ch2 !== '*' && ch2 && ch2 !== ' ') {
        // Find closing * that is not part of **
        let end = -1;
        for (let j = i + 1; j < len; j++) {
          if (line[j] === '*' && line[j - 1] !== ' ' && line[j + 1] !== '*') {
            end = j;
            break;
          }
        }
        if (end !== -1 && end > i + 1) {
          result += span(SYNTAX_COLORS.italic, esc(line.slice(i, end + 1)));
          i = end + 1;
          continue;
        }
      }

      // Italic _…_ — same guards
      if (ch === '_' && ch2 !== '_' && ch2 && ch2 !== ' ') {
        let end = -1;
        for (let j = i + 1; j < len; j++) {
          if (line[j] === '_' && line[j - 1] !== ' ' && line[j + 1] !== '_') {
            end = j;
            break;
          }
        }
        if (end !== -1 && end > i + 1) {
          result += span(SYNTAX_COLORS.italic, esc(line.slice(i, end + 1)));
          i = end + 1;
          continue;
        }
      }

      // Image ![alt](src)
      if (ch === '!' && ch2 === '[') {
        const closeB = line.indexOf(']', i + 2);
        if (closeB !== -1 && line[closeB + 1] === '(') {
          const closeP = line.indexOf(')', closeB + 2);
          if (closeP !== -1) {
            result += span(SYNTAX_COLORS.imgBang, esc(line.slice(i, closeP + 1)));
            i = closeP + 1;
            continue;
          }
        }
      }

      // Link [text](url)
      if (ch === '[') {
        const closeB = line.indexOf(']', i + 1);
        if (closeB !== -1 && line[closeB + 1] === '(') {
          const closeP = line.indexOf(')', closeB + 2);
          if (closeP !== -1) {
            result += span(SYNTAX_COLORS.link, esc(line.slice(i, closeP + 1)));
            i = closeP + 1;
            continue;
          }
        }
      }

      result += esc(ch);
      i++;
    }
    out.push(result);
  }

  let html = out.join('\n');
  if (text.endsWith('\n')) html += '\u200B';
  return html;
};
// Merge syntax highlighting with search highlights in one overlay pass
const buildCombinedOverlayHtml = (text, searchPositions, activeIdx, qLen) => {
  // If no search active, just use syntax
  if (!searchPositions || searchPositions.length === 0) {
    return buildSyntaxOverlayHtml(text);
  }
  // We need to insert search highlight marks into the already-syntax-highlighted HTML.
  // Easiest approach: build the syntax HTML first, then inject search marks at the
  // correct CHARACTER positions by working on the raw text and inserting open/close tags.
  // We do this by rebuilding in segments, wrapping each search hit with a mark.
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const syntaxHtml = buildSyntaxOverlayHtml(text);

  // The syntax HTML has the same character structure as the raw text (just with span wrappers).
  // We cannot easily re-insert at original positions after HTML escaping, so instead:
  // Build search-only overlay that marks hits, and rely on the syntax overlay being the
  // primary layer (rendered via a second overlay div).
  // Return syntax as primary; the search marks layer is handled separately.
  return syntaxHtml;
};

// ── Textarea search highlight overlay helper ──────────────────────────────
const buildOverlayHtml = (text, positions, activeIdx, qLen) => {
  let result = '', last = 0;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  positions.forEach((start, i) => {
    result += esc(text.slice(last, start));
    const cls = i === activeIdx ? 'gs-search-highlight gs-search-highlight--active' : 'gs-search-highlight';
    result += `<mark class="${cls}">${esc(text.slice(start, start + qLen))}</mark>`;
    last = start + qLen;
  });
  result += esc(text.slice(last));
  // Preserve trailing newline so overlay height matches textarea
  if (text.endsWith('\n')) result += '\u200B';
  return result;
};

function GuideEditor({ onClose }) {
  const [md,            setMd]           = useState('# New Guide\n\n');
  const [mode,          setMode]         = useState('split');
  // ── Undo / Redo history ──────────────────────────────────────────────────
  const historyRef     = useRef(['# New Guide\n\n']);
  const historyIdxRef  = useRef(0);
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback((newMd) => {
    if (skipHistoryRef.current) return;
    const h   = historyRef.current;
    const idx = historyIdxRef.current;
    const next = h.slice(0, idx + 1);
    next.push(newMd);
    if (next.length > 200) next.shift();
    historyRef.current    = next;
    historyIdxRef.current = next.length - 1;
  }, []);

  const undo = useCallback(() => {
    const h   = historyRef.current;
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    historyIdxRef.current  = idx - 1;
    skipHistoryRef.current = true;
    setMd(h[idx - 1]);
    skipHistoryRef.current = false;
  }, []);

  const redo = useCallback(() => {
    const h   = historyRef.current;
    const idx = historyIdxRef.current;
    if (idx >= h.length - 1) return;
    historyIdxRef.current  = idx + 1;
    skipHistoryRef.current = true;
    setMd(h[idx + 1]);
    skipHistoryRef.current = false;
  });
  // ─────────────────────────────────────────────────────────────────────────
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImgModal,  setShowImgModal]  = useState(false);
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [isDragging,    setIsDragging]   = useState(false);
  const [saveState,     setSaveState]    = useState('idle');
  // ── Editor search (Ctrl+F) ───────────────────────────────────────────────
  const [editorSearch,      setEditorSearch]      = useState(false);
  const [editorSearchTerm,  setEditorSearchTerm]  = useState('');
  const [editorSearchIdx,   setEditorSearchIdx]   = useState(0);
  const [editorSearchTotal, setEditorSearchTotal] = useState(0);
  const [editorSearchPositions, setEditorSearchPositions] = useState([]);
  const editorSearchRef    = useRef(null);
  const editorSearchIdxRef = useRef(0);
  // ─────────────────────────────────────────────────────────────────────────
  const textareaRef      = useRef(null);
  const previewRef       = useRef(null);
  const overlayRef       = useRef(null);
  const isSyncingRef     = useRef(false);
  const savedCursorRef = useRef({ start: 0, end: 0 });

  const headings  = useMemo(() => extractHeadings(md), [md]);
  const wordCount = useMemo(() => countWords(md), [md]);

  // Get flat char offset of cursor in a contentEditable element
  const getCaret = useCallback((el) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  }, []);

  // Set flat char offset as caret in a contentEditable element
  const setCaret = useCallback((el, offset) => {
    let remaining = offset;
    const sel = window.getSelection();
    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (remaining <= node.textContent.length) {
          const r = document.createRange();
          r.setStart(node, remaining);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          return true;
        }
        remaining -= node.textContent.length;
      }
      for (const child of node.childNodes) if (walk(child)) return true;
      return false;
    };
    walk(el);
  }, []);

  const applyWrap = useCallback((before, after = '', savedStart, savedEnd) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = savedStart != null ? savedStart : getCaret(el);
    const end   = savedEnd   != null ? savedEnd   : start;
    const val   = md;
    const sel   = val.slice(start, end);
    const newVal = val.slice(0, start) + before + sel + after + val.slice(end);
    const newCursor = start + before.length + sel.length + (after ? after.length : 0);
    setMd(newVal);
    requestAnimationFrame(() => {
      el.focus();
      setCaret(el, newCursor);
    });
  }, [md, getCaret, setCaret]);

  const insertLine = useCallback((prefix) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos       = getCaret(el);
    const val       = md;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const lineText  = val.slice(lineStart);
    const hasPrefix = lineText.startsWith(prefix);
    const newVal = hasPrefix
      ? val.slice(0, lineStart) + val.slice(lineStart + prefix.length)
      : val.slice(0, lineStart) + prefix + val.slice(lineStart);
    setMd(newVal);
    const newCursor = hasPrefix ? Math.max(lineStart, pos - prefix.length) : pos + prefix.length;
    requestAnimationFrame(() => {
      el.focus();
      setCaret(el, newCursor);
    });
  }, [md, getCaret, setCaret]);

  const saveCursor = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      const start = getCaret(el);
      savedCursorRef.current = { start, end: start };
    }
  }, [getCaret]);

  const handleKeyDown = useCallback((e) => {
    const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
    if (mod && e.key === 'b') { e.preventDefault(); applyWrap('**', '**'); }
    if (mod && e.key === 'i') { e.preventDefault(); applyWrap('*', '*'); }
    if (mod && e.key === 'k') { e.preventDefault(); saveCursor(); setShowLinkModal(true); }
    if (mod && e.key === '`') { e.preventDefault(); applyWrap('`', '`'); }
    if (e.key === 'Tab') { e.preventDefault(); applyWrap('  '); }
    if (e.key === 'Enter' && !mod) {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const pos = getCaret(el);
      const val = md;
      const newVal = val.slice(0, pos) + '\n' + val.slice(pos);
      const newPos = pos + 1;
      skipHistoryRef.current = false;
      setMd(newVal);
      pushHistory(newVal);
      requestAnimationFrame(() => {
        el.focus();
        setCaret(el, newPos);
      });
    }
    if (mod && e.key === 'f') { e.preventDefault(); setEditorSearch(true); setTimeout(() => editorSearchRef.current?.focus(), 50); }
    if (e.key === 'Escape') { setEditorSearch(false); setEditorSearchTerm(''); setEditorSearchTotal(0); setEditorSearchPositions([]); if (overlayRef.current) overlayRef.current.innerHTML = ''; }
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((mod && e.key === 'y') || (mod && e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); }
    if (e.key === 'Enter' && mod) {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const pos = getCaret(el);
      const val = md;
      const insert = '\\\n';
      const newVal = val.slice(0, pos) + insert + val.slice(pos);
      const newPos = pos + insert.length;
      setMd(newVal);
      pushHistory(newVal);
      requestAnimationFrame(() => { el.focus(); setCaret(el, newPos); });
    }
  }, [applyWrap, saveCursor, undo, redo]);

  // ── Editor search logic ──────────────────────────────────────────────────


  const editorSearchApply = useCallback((term, dir = 0) => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (!ta) return;
    const text = ta.textContent.replace(/​/g, '');
    if (!term) {
      setEditorSearchTotal(0);
      setEditorSearchIdx(0);
      setEditorSearchPositions([]);
      if (ov) ov.innerHTML = '';
      return;
    }
    const q = term.toLowerCase();
    const positions = [];
    let pos = 0;
    while (true) {
      const found = text.toLowerCase().indexOf(q, pos);
      if (found === -1) break;
      positions.push(found);
      pos = found + 1;
    }
    setEditorSearchTotal(positions.length);
    setEditorSearchPositions(positions);
    if (!positions.length) {
      editorSearchIdxRef.current = 0;
      setEditorSearchIdx(0);
      if (ov) ov.innerHTML = '';
      return;
    }
    const next = ((editorSearchIdxRef.current + dir) % positions.length + positions.length) % positions.length;
    editorSearchIdxRef.current = next;
    setEditorSearchIdx(next);

    // Render overlay with all matches highlighted
    if (ov) {
      ov.innerHTML = buildOverlayHtml(text, positions, next, q.length);
    }

    // Scroll textarea so the active match is visible
    const linesBefore = text.slice(0, positions[next]).split('\n').length - 1;
    ta.scrollTop = Math.max(0, linesBefore * 20 - ta.clientHeight / 2);
    requestAnimationFrame(() => {
        editorSearchRef.current?.focus();
    });
  }, [setCaret]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Syntax highlighting — set innerHTML on the contentEditable div ───────
  // plaintext-only contentEditable never re-structures our HTML on its own,
  // so we can safely write coloured spans and read back via textContent.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Preserve caret position across innerHTML updates
    const sel = window.getSelection();
    let caretOffset = 0;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      caretOffset = pre.toString().length;
    }
    el.innerHTML = buildSyntaxOverlayHtml(md);
    // Restore caret
    if (caretOffset > 0) {
      let remaining = caretOffset;
      const walk = node => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (remaining <= node.textContent.length) {
            const r = document.createRange();
            r.setStart(node, remaining);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            return true;
          }
          remaining -= node.textContent.length;
        }
        for (const child of node.childNodes) if (walk(child)) return true;
        return false;
      };
      walk(el);
    }
  }, [md]);

  // ─────────────────────────────────────────────────────────────────────────
  const handleLinkInsert  = useCallback((url, text) => {
    const { start, end } = savedCursorRef.current;
    applyWrap(`[${text || url}](${url})`, '', start, end);
  }, [applyWrap]);
  const handleImageInsert = useCallback((src, alt, pct) => {
    const { start, end } = savedCursorRef.current;
    if (alt.includes('{video}')) {
      applyWrap(`![${alt.replace('{video}', '')}](${src}){video}\n`, '', start, end);
      return;
    }
    // Encode pct into the alt string as ||pct so ReactMarkdown passes it through
    // the img handler. {width=X%} appended after the closing ) is NOT passed to
    // the img handler by ReactMarkdown — it renders as a literal text node instead.
    const altStr = pct && pct !== 100 ? `${alt}||${pct}` : alt;
    applyWrap(`![${altStr}](${src})\n`, '', start, end);
  }, [applyWrap]);
  const handleHtmlInsert  = useCallback((path, pct) => {
    const { start, end } = savedCursorRef.current;
    const pctSuffix = pct ? ` | ${pct}` : '';
    applyWrap(`:::html ${path}${pctSuffix} :::\n`, '', start, end);
  }, [applyWrap]);

  const htmlToMd = useCallback((html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const GITHUB_RAW = 'https://raw.githubusercontent.com/timmasalme/ForgeMapToolkit-Assets/main/guides/assets/';
    const convert = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (['head','style','script','meta','link'].includes(tag)) return '';
      const inner = () => [...node.childNodes].map(convert).join('');
      if (tag === 'h1') return `# ${inner().trim()}\n\n`;
      if (tag === 'h2') return `## ${inner().trim()}\n\n`;
      if (tag === 'h3') return `### ${inner().trim()}\n\n`;
      if (tag === 'p')  return `${inner().trim()}\n\n`;
      if (tag === 'hr') return `---\n\n`;
      if (tag === 'strong' || tag === 'b') return `**${inner()}**`;
      if (tag === 'em' || tag === 'i') return `*${inner()}*`;
      if (tag === 'del') return `~~${inner()}~~`;
      if (tag === 'code') return `\`${inner()}\``;
      if (tag === 'pre')  return `\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
      if (tag === 'blockquote') return `> ${inner().trim()}\n\n`;
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        return `[${inner()}](${href})`;
      }
      if (tag === 'img') {
        let src = node.getAttribute('src') || '';
        // Strip GitHub raw prefix back to relative path
        if (src.startsWith(GITHUB_RAW)) src = src.slice(GITHUB_RAW.length);
        // Never write blob: URLs
        if (src.startsWith('blob:') || src.startsWith('data:')) src = node.getAttribute('alt') || 'image';
        const alt = node.getAttribute('alt') || '';
        return `![${alt}](${src})`;
      }
      if (tag === 'video') {
        let src = node.getAttribute('src') || '';
        if (src.startsWith(GITHUB_RAW)) src = src.slice(GITHUB_RAW.length);
        const alt = node.getAttribute('alt') || '';
        return `![${alt}{video}](${src})`;
      }
      if (tag === 'ul') {
        return [...node.querySelectorAll(':scope > li')]
          .map(li => `- ${[...li.childNodes].map(convert).join('').trim()}`)
          .join('\n') + '\n\n';
      }
      if (tag === 'ol') {
        return [...node.querySelectorAll(':scope > li')]
          .map((li, idx) => `${idx + 1}. ${[...li.childNodes].map(convert).join('').trim()}`)
          .join('\n') + '\n\n';
      }
      if (tag === 'table') {
        const rows = [...node.querySelectorAll('tr')];
        if (!rows.length) return '';
        const toRow = tr => '| ' + [...tr.querySelectorAll('th,td')]
          .map(c => c.textContent.trim().replace(/\|/g, '\\|')).join(' | ') + ' |';
        const colCount = rows[0].querySelectorAll('th,td').length;
        const sep = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
        return [toRow(rows[0]), sep, ...rows.slice(1).map(toRow)].join('\n') + '\n\n';
      }
      // gs-comparison → :::comparison syntax
      if (node.classList?.contains('gs-comparison')) {
        const items = [...node.querySelectorAll('.gs-comparison-item')].map(item => {
          const img   = item.querySelector('img');
          const label = item.querySelector('.gs-comparison-label');
          let src = img?.getAttribute('src') || '';
          if (src.startsWith(GITHUB_RAW)) src = src.slice(GITHUB_RAW.length);
          return label?.textContent?.trim() ? `${src} | ${label.textContent.trim()}` : src;
        });
        return `:::comparison\n${items.join('\n')}\n:::\n\n`;
      }
      // gs-html-embed-wrap → :::html syntax
      if (node.classList?.contains('gs-html-embed-wrap')) {
        const dataSrc = node.getAttribute('data-src');
        if (dataSrc) return `:::html ${dataSrc} :::\n\n`;
      }
      return inner();
    };
    const result = [...doc.body.childNodes].map(convert).join('').replace(/\n{3,}/g, '\n\n').trim();
    return result + '\n';
  }, []);

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result || '';
      setMd(file.name.endsWith('.html') || file.name.endsWith('.htm') ? htmlToMd(text) : text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [htmlToMd]);

  const handleExportMd = useCallback(() => {
    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'guide.md'; a.click();
    URL.revokeObjectURL(url);
  }, [md]);

  const handleSaveHtml = useCallback(async () => {
    if (!window.electronAPI?.invoke) {
      alert('Save as HTML is only available in the desktop app.');
      return;
    }
    setSaveState('saving');
    const titleMatch = md.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : 'guide';
    try {
      const result = await window.electronAPI.invoke('save-guide', { mdContent: md, title });
      if (result?.canceled) setSaveState('idle');
      else if (result?.success) { setSaveState('done'); setTimeout(() => setSaveState('idle'), 2500); }
      else { setSaveState('error'); setTimeout(() => setSaveState('idle'), 3000); }
    } catch (_) {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }, [md]);

  const handleDragOver  = useCallback(e => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop      = useCallback(e => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      const reader = new FileReader();
      reader.onload = ev => setMd(htmlToMd(ev.target.result || ''));
      reader.readAsText(file);
    } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
      const reader = new FileReader();
      reader.onload = ev => setMd(ev.target.result || '');
      reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
      // blob: URLs are session-only and break on export/import — use filename as path hint
      const name = file.name;
      applyWrap(`![${name.replace(/\.[^.]+$/, '')}](${name})\n`);
    }
  }, [applyWrap, htmlToMd]);

  // Keep a ref to the current mode so scroll callbacks never close over a
  // stale value and don't create dependency chains that cause TDZ errors.
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Word-index-based scroll sync ──────────────────────────────────────────
  // The core idea: strip Markdown syntax from the source to get a flat list of
  // "real" words, find which word index corresponds to the cursor / top-of-view
  // position in the textarea, then locate that same word index in the rendered
  // preview DOM and scroll to it.  Because we track words — not lines or vh —
  // images in the preview can be any height without throwing off the sync.

  // Strip Markdown syntax tokens so only prose words remain.
  // We intentionally keep the word count identical on both sides: every real
  // word in the source appears exactly once in the preview text nodes.
  const mdToWords = useCallback((text) => {
    return text
      // fenced code blocks → remove entirely (not rendered as prose words)
      .replace(/```[\s\S]*?```/g, '')
      // inline code
      .replace(/`[^`]+`/g, '')
      // custom blocks :::html / :::comparison etc.
      .replace(/:::[\s\S]*?:::/g, '')
      // HTML tags
      .replace(/<[^>]+>/g, '')
      // image / video syntax ![alt](src)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // links [text](url) → keep text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Markdown heading markers
      .replace(/^#{1,6}\s+/gm, '')
      // bold / italic markers
      .replace(/(\*{1,3}|_{1,3})/g, '')
      // strikethrough
      .replace(/~~([^~]+)~~/g, '$1')
      // blockquote markers
      .replace(/^>\s*/gm, '')
      // list markers
      .replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, '')
      // horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // table separators
      .replace(/^\|[-| :]+\|$/gm, '')
      // pipe characters in tables
      .replace(/\|/g, ' ')
      // highlight markers
      .replace(/==/g, '')
      // split into words
      .split(/\s+/)
      .filter(w => w.length > 0);
  }, []);

  // Given a char offset in the raw markdown, return the word index at that point.
  const charOffsetToWordIndex = useCallback((text, charOffset) => {
    const before = text.slice(0, charOffset);
    return mdToWords(before).length;
  }, [mdToWords]);

  // Build a flat ordered list of all text-only leaf nodes inside the preview,
  // skipping <img>, <video>, <iframe>, <svg> and their descendants.
  // Returns [{ node: TextNode, wordStart: number, wordEnd: number }]
  const wordMapRef = useRef([]);   // rebuilt after every layout change
  const wordMapDirty = useRef(true);

  const rebuildWordMap = useCallback(() => {
    const pr = previewRef.current;
    if (!pr) { wordMapRef.current = []; return; }

    const SKIP_TAGS = new Set(['IMG','VIDEO','IFRAME','SVG','CANVAS','FIGURE',
                                'SCRIPT','STYLE','CODE','PRE']);
    const map = [];
    let globalIdx = 0;

    const walk = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (SKIP_TAGS.has(node.tagName)) return; // skip media & code blocks
        for (const child of node.childNodes) walk(child);
      } else if (node.nodeType === Node.TEXT_NODE) {
        const words = node.textContent.split(/\s+/).filter(w => w.length > 0);
        if (!words.length) return;
        map.push({ node, wordStart: globalIdx, wordEnd: globalIdx + words.length - 1 });
        globalIdx += words.length;
      }
    };
    walk(pr);
    wordMapRef.current = map;
    wordMapDirty.current = false;
  }, []);

  // ResizeObserver: mark map dirty whenever layout shifts (images, resize…)
  useEffect(() => {
    const pr = previewRef.current;
    if (!pr) return;
    let rafId = null;
    const schedule = () => {
      wordMapDirty.current = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(rebuildWordMap);
    };
    const obs = new ResizeObserver(schedule);
    obs.observe(pr);
    const childObs = new ResizeObserver(schedule);
    [...pr.children].forEach(c => childObs.observe(c));
    return () => { obs.disconnect(); childObs.disconnect(); cancelAnimationFrame(rafId); };
  }, [mode, rebuildWordMap]);

  useEffect(() => { wordMapDirty.current = true; }, [md]);

  useEffect(() => {
    const handler = () => {
      wordMapDirty.current = true;
      requestAnimationFrame(rebuildWordMap);
    };
    window.addEventListener('gs-preview-layout-changed', handler);
    return () => window.removeEventListener('gs-preview-layout-changed', handler);
  }, [rebuildWordMap]);

  // ── Editor → Preview sync ─────────────────────────────────────────────────
  const syncScrollEditorToPreview = useCallback(() => {
    if (modeRef.current !== 'split') return;
    const ta = textareaRef.current;
    const pr = previewRef.current;
    if (!ta || !pr) return;
    if (isSyncingRef.current) return;

    if (wordMapDirty.current) rebuildWordMap();
    const map = wordMapRef.current;

    // Find the character offset that corresponds to the top of the visible
    // editor viewport.  We do this via the textarea's scrollTop and a temporary
    // range measurement so it works even with variable-height lines (soft wraps).
    // Fallback: estimate via scrollHeight / line count when the API is unavailable.
    const totalLines = ta.textContent.split('\n').length || 1;
    const lineHeight = ta.scrollHeight / totalLines;
    const topLine    = lineHeight > 0 ? Math.floor(ta.scrollTop / lineHeight) : 0;
    // Clamp to valid lines and get char offset of that line's start
    const lines      = ta.textContent.split('\n');
    const safeTopLine = Math.min(topLine, lines.length - 1);
    const charOffset  = lines.slice(0, safeTopLine).reduce((s, l) => s + l.length + 1, 0);

    const targetWordIdx = charOffsetToWordIndex(ta.textContent, charOffset);

    if (!map.length) {
      // No word anchors: fall back to proportional scroll
      const ratio = ta.scrollHeight > ta.clientHeight
        ? ta.scrollTop / (ta.scrollHeight - ta.clientHeight) : 0;
      isSyncingRef.current = true;
      pr.scrollTop = ratio * (pr.scrollHeight - pr.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
      return;
    }

    // Binary-search for the map entry whose range contains targetWordIdx
    let lo = 0, hi = map.length - 1, found = map[0];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (map[mid].wordEnd < targetWordIdx) { lo = mid + 1; }
      else if (map[mid].wordStart > targetWordIdx) { found = map[mid]; hi = mid - 1; }
      else { found = map[mid]; break; }
    }

    // Get the pixel position of that text node relative to the preview container
    let targetTop = 0;
    try {
      const range = document.createRange();
      range.selectNodeContents(found.node);
      const rect    = range.getBoundingClientRect();
      const prRect  = pr.getBoundingClientRect();
      targetTop = rect.top - prRect.top + pr.scrollTop;
    } catch (_) {
      targetTop = 0;
    }

    isSyncingRef.current = true;
    pr.scrollTop = Math.max(0, targetTop);
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, [rebuildWordMap, charOffsetToWordIndex]);

  const scrollToHeading = useCallback((text, level) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const prefix = '#'.repeat(level) + ' ';
    const idx = ta.textContent.indexOf(prefix + text);
    if (idx === -1) return;
    ta.focus();
    setCaret(ta, idx);
    const linesBefore = ta.textContent.slice(0, idx).split('\n').length - 1;
    const totalLines  = ta.textContent.split('\n').length || 1;
    const lineHeight  = ta.scrollHeight / totalLines;
    ta.scrollTop = Math.max(0, linesBefore * lineHeight - 80);
    requestAnimationFrame(syncScrollEditorToPreview);
  }, [syncScrollEditorToPreview]);

  // Sync preview when cursor moves (click / arrow keys).
  // Uses the cursor position (selectionStart) rather than scroll-top so that
  // clicking on word 500 in the editor immediately shows word 500 in the preview.
  const syncPreviewToCursor = useCallback(() => {
    if (modeRef.current !== 'split') return;
    const ta = textareaRef.current;
    const pr = previewRef.current;
    if (!ta || !pr) return;
    if (isSyncingRef.current) return;

    if (wordMapDirty.current) rebuildWordMap();
    const map = wordMapRef.current;

    const cursorOffset  = getCaret(ta);
    const targetWordIdx = charOffsetToWordIndex(ta.textContent, cursorOffset);

    if (!map.length) { syncScrollEditorToPreview(); return; }

    let lo = 0, hi = map.length - 1, found = map[0];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (map[mid].wordEnd < targetWordIdx) { lo = mid + 1; }
      else if (map[mid].wordStart > targetWordIdx) { found = map[mid]; hi = mid - 1; }
      else { found = map[mid]; break; }
    }

    let targetTop = 0;
    try {
      const range = document.createRange();
      range.selectNodeContents(found.node);
      const rect   = range.getBoundingClientRect();
      const prRect = pr.getBoundingClientRect();
      targetTop = rect.top - prRect.top + pr.scrollTop;
    } catch (_) { targetTop = 0; }

    isSyncingRef.current = true;
    pr.scrollTop = Math.max(0, targetTop);
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, [rebuildWordMap, charOffsetToWordIndex, syncScrollEditorToPreview]);

  const handleTextareaScroll = useCallback(() => {
    syncScrollEditorToPreview();
  }, [syncScrollEditorToPreview]);

  const handlePreviewScroll = useCallback(() => {}, []);

  const modeTabs = [
    { id: 'write',   label: 'Write' },
    { id: 'split',   label: 'Split' },
    { id: 'preview', label: 'Preview' },
  ];

  return (
    <div className="gs-editor-root">
      {/* Topbar */}
      <div className="gs-viewer-header" style={{ gap:12, padding:'9px 16px' }}>
        <button className="gs-viewer-back" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
        <div className="gs-viewer-title-block">
          <div className="gs-viewer-cat">Guide Editor</div>
          <div className="gs-viewer-title" style={{ fontSize:11 }}>Markdown</div>
        </div>
        <div className="gs-editor-mode-tabs" style={{ marginLeft:'auto', marginRight:8 }}>
          {modeTabs.map(t => (
            <button key={t.id}
              className={`gs-editor-mode-tab${mode === t.id ? ' gs-editor-mode-tab--active' : ''}`}
              onClick={() => setMode(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <label className="gs-editor-btn" title="Import .md file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
            <input type="file" accept=".md,.markdown,.txt,.html,.htm" onChange={handleImport} style={{ display:'none' }} />
          </label>
          <button className="gs-editor-btn" onClick={handleExportMd} title="Export raw Markdown">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export .md
          </button>
          <button
            className="gs-editor-btn gs-editor-btn--primary"
            onClick={handleSaveHtml}
            disabled={saveState === 'saving'}
            style={saveState === 'done' ? { borderColor:'rgba(52,211,153,0.4)', color:'#34d399' }
                 : saveState === 'error' ? { borderColor:'rgba(248,113,113,0.4)', color:'#f87171' } : {}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
              {saveState === 'done'
                ? <path d="M5 13l4 4L19 7"/>
                : saveState === 'error'
                ? <><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></>
                : <><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>
              }
            </svg>
            {saveState === 'saving' ? 'Saving…' : saveState === 'done' ? 'Saved!' : saveState === 'error' ? 'Failed' : 'Save as HTML'}
          </button>
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="gs-editor-toolbar">
        <button className="gs-bfmt gs-bfmt--h1" title="H1" onClick={() => insertLine('# ')}>H1</button>
        <button className="gs-bfmt gs-bfmt--h2" title="H2" onClick={() => insertLine('## ')}>H2</button>
        <button className="gs-bfmt gs-bfmt--h3" title="H3" onClick={() => insertLine('### ')}>H3</button>
        <button className="gs-bfmt gs-bfmt--quote" title="Blockquote" onClick={() => insertLine('> ')}>
          <svg viewBox="0 0 20 16" fill="currentColor" style={{width:11,height:9}}>
            <path d="M0 0h8v8H4a4 4 0 004 4v4A8 8 0 010 8V0zm12 0h8v8h-4a4 4 0 004 4v4a8 8 0 01-8-8V0z"/>
          </svg>
          Quote
        </button>
        <button className="gs-bfmt gs-bfmt--code" title="Code block" onClick={() => applyWrap('\n```\n', '\n```\n')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          Code
        </button>
        <button className="gs-bfmt" title="Highlight" onClick={() => applyWrap('==','==')}>
          <code className="gs-md-code-hl" style={{fontSize:9,padding:'0 4px',pointerEvents:'none'}}>HL</code>
          Highlight
        </button>
        <div className="gs-editor-toolbar-sep" />
        <TB title="Bold (Ctrl+B)" onClick={() => applyWrap('**','**')} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:11,height:11}}>
            <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>
          </svg>
          Bold
        </TB>
        <TB title="Italic (Ctrl+I)" onClick={() => applyWrap('*','*')} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/>
            <line x1="15" y1="4" x2="9" y2="20"/>
          </svg>
          Italic
        </TB>
        <TB title="Strikethrough" onClick={() => applyWrap('~~','~~')} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <line x1="5" y1="12" x2="19" y2="12"/>
            <path d="M16 6C16 6 14.5 4 12 4C9.5 4 7 5.5 7 8C7 12 16 12 16 16C16 18.5 13.5 20 11 20C8.5 20 7 18 7 18"/>
          </svg>
          Strike
        </TB>
        <TB title="Inline code (Ctrl+`)" onClick={() => applyWrap('`','`')} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          Code
        </TB>
        <div className="gs-editor-toolbar-sep" />
        <TB title="Insert link (Ctrl+K)" onClick={() => { saveCursor(); setShowLinkModal(true); }} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          Link
        </TB>
        <TB title="Insert image" onClick={() => { saveCursor(); setShowImgModal(true); }} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          Image
        </TB>
        <TB title="Insert table" onClick={() => applyWrap('\n| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| Value 1 | Value 2 | Value 3 |\n')} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
          Table
        </TB>
        <TB title="Comparison block" onClick={() => applyWrap('\n:::comparison\npath/img1.png | Caption 1\npath/img2.png | Caption 2\n:::\n')} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <rect x="2" y="5" width="9" height="14" rx="1"/><rect x="13" y="5" width="9" height="14" rx="1"/>
          </svg>
          Compare
        </TB>
        <TB title="Embed HTML widget" onClick={() => { saveCursor(); setShowHtmlModal(true); }} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          HTML
        </TB>
        <div className="gs-editor-toolbar-sep" />
        <TB title="Insert line break / spacer (works after tables)" onClick={() => {
          const el = textareaRef.current;
          if (!el) return;
          const pos = getCaret(el);
          const val = md;
          // HTML br forces a rendered line break even directly after a table
          const insert = '\n<br>\n\n';
          const newVal = val.slice(0, pos) + insert + val.slice(pos);
          const newPos = pos + insert.length;
          setMd(newVal);
          pushHistory(newVal);
          requestAnimationFrame(() => { el.focus(); setCaret(el, newPos); });
        }} wide>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
            <path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/>
          </svg>
          Break
        </TB>
      </div>

      {/* Search bar — above the panes */}
      {editorSearch && (
        <div className="gs-viewer-search-bar gs-editor-search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="gs-viewer-search-icon">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={editorSearchRef}
            className="gs-viewer-search-input"
            value={editorSearchTerm}
            onChange={e => { setEditorSearchTerm(e.target.value); editorSearchApply(e.target.value, 0); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); editorSearchApply(editorSearchTerm, e.shiftKey ? -1 : 1); }
              if (e.key === 'Escape') { setEditorSearch(false); setEditorSearchTerm(''); setEditorSearchTotal(0); setEditorSearchPositions([]); if (overlayRef.current) overlayRef.current.innerHTML = ''; }
            }}
            placeholder="Search in editor…"
            spellCheck={false}
            autoComplete="off"
          />
          {editorSearchTotal > 0 && (
            <span className="gs-viewer-search-count">{editorSearchIdx + 1} / {editorSearchTotal}</span>
          )}
          {editorSearchTerm && editorSearchTotal === 0 && (
            <span className="gs-viewer-search-count gs-viewer-search-count--none">No results</span>
          )}
          <button className="gs-viewer-search-nav" onClick={() => editorSearchApply(editorSearchTerm, -1)} title="Previous">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className="gs-viewer-search-nav" onClick={() => editorSearchApply(editorSearchTerm, 1)} title="Next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button className="gs-viewer-search-close" onClick={() => { setEditorSearch(false); setEditorSearchTerm(''); setEditorSearchTotal(0); setEditorSearchPositions([]); if (overlayRef.current) overlayRef.current.innerHTML = ''; }} title="Close (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Main area */}
      <div className="gs-editor-panes">
        <div className="gs-editor-sidebar">
          <div className="gs-editor-sb-section">
            <div className="gs-editor-sb-label">Headings</div>
            <div className="gs-editor-heading-btns">
              {[['#','H1','Main Title','gs-hbtn--h1'],['##','H2','Section','gs-hbtn--h2'],['###','H3','Subsection','']].map(([prefix, tag, label, cls]) => (
                <button key={tag} className={`gs-hbtn ${cls}`} onClick={() => insertLine(prefix + ' ')}>
                  <span className="gs-hbtn-tag">{tag}</span>
                  <span className="gs-hbtn-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="gs-editor-sb-section gs-editor-sb-section--flex">
            <div className="gs-editor-sb-label">Structure</div>
            <div className="gs-editor-outline">
              {headings.length === 0
                ? <div className="gs-editor-outline-empty">No headings</div>
                : headings.map((h, i) => (
                    <div key={i}
                      className={`gs-editor-outline-item gs-editor-outline-item--h${h.level}`}
                      onClick={() => scrollToHeading(h.text, h.level)}
                      title={h.text}>
                      <span className="gs-editor-outline-dot" />
                      {h.text}
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        <div className="gs-editor-main" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          {(mode === 'write' || mode === 'split') && (
            <div className={`gs-editor-write-pane${mode === 'split' ? ' gs-editor-write-pane--split' : ''}`}>
              {/* Inner wrapper: position:relative so absolute overlays are anchored correctly */}
              <div className="gs-editor-write-inner">
                {/* Single contentEditable with plaintext-only — browser never injects
                    its own div/br structure, so innerHTML stays under our control.
                    textContent (not innerText) reads back exactly what was set. */}
                <div
                  ref={textareaRef}
                  className="gs-editor-textarea"
                  contentEditable="plaintext-only"
                  suppressContentEditableWarning
                  spellCheck={false}
                  onInput={e => {
                    const newMd = e.currentTarget.textContent.replace(/​/g, '');
                    if (newMd !== md) { setMd(newMd); pushHistory(newMd); }
                  }}
                  onKeyDown={handleKeyDown}
                  onClick={syncPreviewToCursor}
                  onKeyUp={syncPreviewToCursor}
                  onScroll={handleTextareaScroll}
                  data-placeholder="# Guide Title&#10;&#10;Start writing here…"
                />
              </div>
            </div>
          )}
          {mode === 'split' && <div className="gs-editor-split-divider" />}
          <div ref={previewRef}
            className={`gs-editor-preview-pane${mode === 'split' ? ' gs-editor-preview-pane--split' : ''}`}
            onScroll={mode === 'split' ? handlePreviewScroll : undefined}
            style={mode === 'write' ? { display: 'none' } : undefined}>
            <MdPreview md={md} />
          </div>
          {isDragging && (
            <div className="gs-editor-dropzone">
              <svg className="gs-editor-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div className="gs-editor-dropzone-label">.md or image</div>
            </div>
          )}
        </div>
      </div>

      <div className="gs-editor-statusbar">
        <span className="gs-editor-statusbar-dot" />
        <span>Markdown</span>
        <div className="gs-editor-statusbar-spacer" />
        <span style={{ color:'var(--gs-text-ghost)', fontSize:9 }}>
          Ctrl+B Bold · Ctrl+I Italic · Ctrl+K Link · Ctrl+` Code · Ctrl+F Search · Ctrl+Enter Break
        </span>
        <div className="gs-editor-statusbar-spacer" />
        <span>{wordCount} words · {headings.length} headings · {md.length} chars</span>
      </div>

      {showLinkModal && <LinkModal onClose={() => setShowLinkModal(false)} onInsert={handleLinkInsert} />}
      {showImgModal  && <ImageModal onClose={() => setShowImgModal(false)} onInsert={handleImageInsert} />}
      {showHtmlModal && <HtmlModal onClose={() => setShowHtmlModal(false)} onInsert={handleHtmlInsert} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MainMenuGrid — full-screen category grid shown on initial open (no sidebar)
// ═══════════════════════════════════════════════════════════════════════════════

function MainMenuGrid({ onSelectCategory, onOpenEditor, onGoHome }) { return (
  <div className="gs-main-grid-root">
    <div className="gs-main-grid-header">
      <button className="gs-layout-home-btn gs-main-grid-home" onClick={onGoHome}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Home
      </button>
      <div className="gs-main-grid-title">Guides</div>
      <div className="gs-main-grid-sub">Select a category to get started</div>
    </div>
    <div className="gs-main-grid">
      {GUIDE_CATEGORIES.map(cat => {
        const count = getGuidesByCategory(cat.id).filter(g => g.status !== 'planned').length;
        const isEmpty = count === 0;
        return (
          <div
            key={cat.id}
            className={`gs-main-grid-card${isEmpty ? ' gs-main-grid-card--empty' : ''}`}
            onClick={() => !isEmpty && onSelectCategory(cat.id)}>
            <div className="gs-main-grid-card-accent" style={{ background: cat.color }} />
            <div className="gs-main-grid-card-thumb">
              <CategoryThumbnail categoryId={cat.id} color={cat.color} />
            </div>
            <div className="gs-main-grid-card-info">
              <div className="gs-main-grid-card-name">{stripEmoji(cat.label)}</div>
              <div className="gs-main-grid-card-count" style={{ color: isEmpty ? 'var(--gs-text-ghost)' : cat.color }}>
                {isEmpty ? '—' : `${count} guide${count !== 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
        );
      })}
      <div className="gs-main-grid-card gs-main-grid-card--editor" onClick={onOpenEditor}>
        <div className="gs-main-grid-card-accent" style={{ background: TAB_COLOR }} />
        <div className="gs-main-grid-card-thumb gs-main-grid-card-thumb--editor">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ width: 32, height: 32, color: TAB_COLOR, opacity: 0.7 }}>
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>
        </div>
        <div className="gs-main-grid-card-info">
          <div className="gs-main-grid-card-name">Editor</div>
          <div className="gs-main-grid-card-count" style={{ color: TAB_COLOR }}>Create guides</div>
        </div>
      </div>
    </div>
  </div>
);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GuideSection — root component with persistent 3-panel layout
// ═══════════════════════════════════════════════════════════════════════════════

function GuideSection({ onGoHome }) {
  const [activeCatId,  setActiveCatId]  = useState(null);
  const [activeGuide,  setActiveGuide]  = useState(null);
  const [editorOpen,   setEditorOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [headings,     setHeadings]     = useState([]);
  const [openCount,    setOpenCount]    = useState(0);

  // ── View state drives sidebar visibility ──────────────────────────────────
  // 'main'    : only MainMenu sidebar — no category selected yet
  // 'submenu' : MainMenu + SubMenu — category selected, grid shown
  // 'guide'   : all three sidebars — guide open with ToC
  const [view, setView] = useState('main');

  const handleGoMainMenu = useCallback(() => {
    setActiveCatId(null);
    setActiveGuide(null);
    setSearchQuery('');
    setHeadings([]);
    setEditorOpen(false);
    setView('main');
  }, []);

  const handleSelectCategory = useCallback((catId) => {
    setActiveCatId(catId);
    setActiveGuide(null);
    setSearchQuery('');
    setHeadings([]);
    setEditorOpen(false);
    setView('submenu');
  }, []);

  const handleOpenGuide = useCallback((guide) => {
    setActiveGuide(guide);
    setActiveCatId(guide.category);
    setHeadings([]);
    setEditorOpen(false);
    setOpenCount(c => c + 1);
    setView('guide');
  }, []);

  const handleOpenEditor = useCallback(() => {
    setEditorOpen(true);
    setActiveGuide(null);
    setHeadings([]);
    setView('submenu');
  }, []);

  const handleHeadingsReady = useCallback((h) => {
    setHeadings(h);
  }, []);

  const handleStructureScroll = useCallback((text) => {
    window.dispatchEvent(new CustomEvent('gs-scroll-to-heading', { detail: { text } }));
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  const renderContent = () => {
    if (view === 'main') return <MainMenuGrid onSelectCategory={handleSelectCategory} onOpenEditor={handleOpenEditor} onGoHome={onGoHome} />;
    if (editorOpen) return <GuideEditor onClose={() => { setEditorOpen(false); setView('submenu'); }} />;
    if (activeGuide) {
      const cat = getCategoryById(activeGuide.category);
      return (
        <ContentViewer
          key={openCount}
          guide={activeGuide}
          category={cat ?? {}}
          onHeadingsReady={handleHeadingsReady}
        />
      );
    }
    if (isSearching) return <SearchView query={searchQuery} onOpenGuide={handleOpenGuide} />;
    if (activeCatId) return <CategoryGrid activeCatId={activeCatId} onOpenGuide={handleOpenGuide} />;
    return null;
  };

  return (
    <div className="gs-layout" data-view={view}>

      {/* ── Sidebar 1: Main menu — hidden in main view (shown as full grid instead) ── */}
      <MainMenuPanel
        activeCatId={activeCatId}
        onSelectCategory={handleSelectCategory}
        onOpenEditor={handleOpenEditor}
        onGoHome={onGoHome}
        onGoMainMenu={handleGoMainMenu}
        hidden={view === 'main'}
      />

      {/* ── Sidebar 2: Sub menu — only in guide view ── */}
      <SubMenuPanel
        activeCatId={activeCatId}
        activeGuideId={activeGuide?.id ?? null}
        onOpenGuide={handleOpenGuide}
        hidden={view !== 'guide'}
      />

      {/* ── Sidebar 3: Structure / ToC — only in guide view ── */}
      <StructurePanel
        headings={headings}
        onScrollTo={handleStructureScroll}
        hidden={view !== 'guide'}
      />

      {/* ── Content area ── */}
      <div className="gs-layout-content">
        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
      </div>
    </div>
  );
};

export { GuideEditor };
export default GuideSection;
