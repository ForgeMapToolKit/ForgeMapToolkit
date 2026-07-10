import React, { useState, useEffect } from 'react';

// ── Hook: resolve a previewUrl that may be a local file:///...dds path ───────
// Returns a usable src string: data URL for local DDS files, original URL otherwise.
function useDdsPreview(previewUrl) {
  const [resolvedSrc, setResolvedSrc] = useState(null);
  const cache = useDdsPreview._cache || (useDdsPreview._cache = {});

  useEffect(() => {
    if (!previewUrl) { setResolvedSrc(null); return; }
    // Non-DDS URLs (GitHub PNG, etc.) can be used directly
    if (!previewUrl.toLowerCase().endsWith('.dds')) { setResolvedSrc(previewUrl); return; }

    // Check in-memory cache first
    if (cache[previewUrl]) { setResolvedSrc(cache[previewUrl]); return; }

    setResolvedSrc(null); // show loading state
    const filePath = previewUrl.replace(/^file:\/+/, '').replace(/\//g, '\\');
    window.electronAPI.invoke('dds-to-dataurl', { filePath })
      .then(result => {
        const src = result?.success ? result.dataUrl : null;
        cache[previewUrl] = src;
        setResolvedSrc(src);
      })
      .catch(() => setResolvedSrc(null));
  }, [previewUrl]);

  return resolvedSrc;
}

// ── Small component: img that handles DDS preview URLs transparently ─────────
export default function PropPreviewImg({ src, className, alt, style }) {
  const resolved = useDdsPreview(src);
  if (!resolved) return (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-ghost)', color: 'var(--ink-22)', fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-mono)' }}>DDS</div>
  );
  return <img className={className} src={resolved} alt={alt} style={style} />;
}
