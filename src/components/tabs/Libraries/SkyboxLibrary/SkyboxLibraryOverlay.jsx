import React, { useState, useEffect } from 'react';
import './SkyboxLibraryOverlay.css';

const UV_COLORS = ['#ff4444','#44ff44','#4444ff','#ffff44','#ff44ff','#44ffff','#ff8844','#88ff44'];

// ── helpers ──────────────────────────────────────────────────────────────────
const toHex = (c) => {
  if (!c) return '#000000';
  if (typeof c === 'string') return c;
  const r = Math.round((c.r || 0) * 255).toString(16).padStart(2, '0');
  const g = Math.round((c.g || 0) * 255).toString(16).padStart(2, '0');
  const b = Math.round((c.b || 0) * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

// ── fetchSkyboxLibrary — named export consumed by SkyboxGeneratorTab
// Now delegates entirely to main process via IPC (no GitHub API in renderer).
// Main process caches the result to disk (skybox_library_cache.json), so
// subsequent opens are instant and consume zero API quota.
export async function fetchSkyboxLibrary({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    // Try disk cache first — fast, no network, no rate limit
    const cached = await window.electronAPI.invoke('skybox-library-load');
    if (cached?.cached && !cached.stale) {
      return cached.categories;
    }
  }
  // Cache missing, stale, or forceRefresh — fetch from GitHub in main process
  const result = await window.electronAPI.invoke('skybox-library-fetch');
  if (!result.success) throw new Error(result.error || 'skybox-library-fetch failed');
  return result.categories;
}

// ── SkyboxCard ────────────────────────────────────────────────────────────────
function SkyboxCard({ skybox, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const thumb = skybox.images?.[0];

  return (
    <div className="sl-card" onClick={onClick}>
      <div className="sl-card-thumb">
        {thumb && !imgFailed
          ? <img src={thumb} alt={skybox.name} onError={() => setImgFailed(true)} />
          : <div className="sl-card-thumb-placeholder">⬡</div>
        }
        {skybox.isCustom && <span className="sl-custom-badge">🔧 Custom</span>}
        {skybox.images?.length > 1 && (
          <span className="sl-img-count">🖼 {skybox.images.length}</span>
        )}
      </div>
      <div className="sl-card-info">
        <div className="sl-card-name" title={skybox.name}>{skybox.name}</div>
        <div className="sl-card-category">{skybox.category}</div>
      </div>
    </div>
  );
}

// ── DetailView ────────────────────────────────────────────────────────────────
function DetailView({ skybox, mapName, mapsFolderPath, onApply, onBack }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const d = skybox.scmskyboxData?.Data || skybox.scmskyboxData?.data || {};

  const hc     = toHex(d.HorizonColor);
  const zc     = toHex(d.ZenithColor);
  const layers = d.CirrusLayers || [];

  // Resolution picker state — only relevant for custom skyboxes
  const albedoResolutions = skybox.isCustom
    ? [...new Set((skybox.requiredFiles || []).filter(f => f.type === 'albedo').map(f => f.resolution))].sort((a,b) => a-b)
    : [];
  const glowResolutions = skybox.isCustom
    ? [...new Set((skybox.requiredFiles || []).filter(f => f.type === 'glow').map(f => f.resolution))].sort((a,b) => a-b)
    : [];

  const [albedoRes, setAlbedoRes] = useState(() => albedoResolutions[albedoResolutions.length - 1] ?? null);
  const [glowRes,   setGlowRes]   = useState(() => glowResolutions[0] ?? null);

  const handleApply = () => {
    onApply(skybox, { albedoRes, glowRes });
  };

  return (
    <div className="sl-detail">
      {/* Left: carousel */}
      <div className="sl-detail-left">
        <div className="sl-carousel-main">
          {skybox.images?.length > 0
            ? <img src={skybox.images[carouselIndex]} alt="" />
            : <div className="sl-carousel-placeholder">⬡</div>
          }
          {skybox.images?.length > 1 && (<>
            <button
              className="sl-carousel-btn prev"
              onClick={() => setCarouselIndex(i => (i - 1 + skybox.images.length) % skybox.images.length)}>
              ‹
            </button>
            <button
              className="sl-carousel-btn next"
              onClick={() => setCarouselIndex(i => (i + 1) % skybox.images.length)}>
              ›
            </button>
          </>)}
        </div>
        {skybox.images?.length > 1 && (
          <div className="sl-carousel-dots">
            {skybox.images.map((img, i) => (
              <img key={i} src={img} alt=""
                className={`sl-carousel-dot ${i === carouselIndex ? 'active' : ''}`}
                onClick={() => setCarouselIndex(i)} />
            ))}
          </div>
        )}
      </div>

      {/* Right: info + apply */}
      <div className="sl-detail-right">
        <div className="sl-detail-body">
          <h3 className="sl-detail-name">{skybox.name}</h3>
          {skybox.isCustom && (
            <div className="sl-custom-tag">🔧 Custom — includes texture files</div>
          )}

          {/* Cirrus layers */}
          {layers.length > 0 && (
            <div className="sl-detail-section">
              <div className="sl-detail-section-label">Cirrus — {layers.length} Layer</div>
              {layers.map((l, i) => (
                <div key={i} className="sl-cirrus-row">
                  <span style={{ color: UV_COLORS[i % UV_COLORS.length], minWidth: '22px', fontWeight: 700 }}>L{i+1}</span>
                  <span>freqX: {l.frequency?.x ?? l.FrequencyX}</span>
                  <span>speed: {l.Speed ?? l.speed}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                    dir: ({l.Direction?.x ?? l.DirectionX}, {l.Direction?.y ?? l.DirectionY})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Key values */}
          <div className="sl-stats-grid">
            {[
              ['Horizon Color', <span className="sl-stat-value"><span className="sl-color-swatch" style={{ background: hc }} />{hc}</span>],
              ['Zenith Color',  <span className="sl-stat-value"><span className="sl-color-swatch" style={{ background: zc }} />{zc}</span>],
              ['Horizon H',     d.HorizonHeight],
              ['Zenith H',      d.ZenithHeight],
              ['Cirrus Mult',   d.CirrusMultiplier],
              ['Albedo',        d.Albedo?.split('/').pop()],
            ].map(([label, val]) => (
              <div key={label} className="sl-stat-cell">
                <div className="sl-stat-label">{label}</div>
                <div className="sl-stat-value">{val ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* Resolution pickers — shown in body for custom skyboxes */}
          {skybox.isCustom && (albedoResolutions.length > 0 || glowResolutions.length > 0) && (
            <div className="sl-detail-section" style={{ marginTop: '14px' }}>
              <div className="sl-detail-section-label">Texture Resolution</div>
              {albedoResolutions.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>Albedo</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {albedoResolutions.map(r => (
                      <button key={r} onClick={() => setAlbedoRes(r)} style={{
                        padding: '5px 12px', fontSize: '0.78rem', fontFamily: 'monospace',
                        cursor: 'pointer', border: '1px solid',
                        borderColor: albedoRes === r ? '#00DDFF' : 'rgba(255,255,255,0.12)',
                        background:  albedoRes === r ? 'rgba(0,221,255,0.12)' : 'transparent',
                        color:       albedoRes === r ? '#00DDFF' : 'rgba(255,255,255,0.45)',
                        transition: 'all 0.15s',
                      }}>{r}</button>
                    ))}
                  </div>
                </div>
              )}
              {glowResolutions.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginBottom: '6px' }}>Glow</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {glowResolutions.map(r => (
                      <button key={r} onClick={() => setGlowRes(r)} style={{
                        padding: '5px 12px', fontSize: '0.78rem', fontFamily: 'monospace',
                        cursor: 'pointer', border: '1px solid',
                        borderColor: glowRes === r ? '#00DDFF' : 'rgba(255,255,255,0.12)',
                        background:  glowRes === r ? 'rgba(0,221,255,0.12)' : 'transparent',
                        color:       glowRes === r ? '#00DDFF' : 'rgba(255,255,255,0.45)',
                        transition: 'all 0.15s',
                      }}>{r}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Apply footer */}
        <div className="sl-detail-footer">
          {skybox.isCustom && (!mapName || !mapsFolderPath) && (
            <div className="sl-warning">
              ⚠ Set Map Name + Maps Folder in Props tab to auto-copy texture files.
            </div>
          )}
          <button className="sl-apply-btn" onClick={handleApply}>
            ⬇ Apply{skybox.isCustom ? ' + Copy DDS' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Overlay ──────────────────────────────────────────────────────────────
export default function SkyboxLibraryOverlay({ onApply, onClose, onReload, mapName, mapsFolderPath, categories = [], loading = false, tabColor, tabGlow }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSkybox,   setSelectedSkybox]   = useState(null);

  // Auto-select first category when data arrives
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].name);
    }
  }, [categories]);

  const currentSkyboxes = categories.find(c => c.name === selectedCategory)?.skyboxes || [];
  const totalCount = categories.reduce((n, c) => n + c.skyboxes.length, 0);

  return (
    <>
      <div className="sl-backdrop" onClick={onClose} />
      <div className="sl-window" style={tabColor ? { "--skybox-generator-color": tabColor, "--skybox-generator-glow": tabGlow || tabColor } : undefined}>

        {/* ── Sidebar ── */}
        <div className="sl-sidebar">
          <div className="sl-sidebar-header">
            <span className="sl-sidebar-mark">⬡</span>
            <span className="sl-sidebar-title">Skybox Library</span>
          </div>
          <div className="sl-cat-list">
            {categories.map((cat, i) => (
              <button key={i}
                className={`sl-cat-item ${selectedCategory === cat.name ? 'active' : ''}`}
                onClick={() => { setSelectedCategory(cat.name); setSelectedSkybox(null); }}>
                <span className="sl-cat-label">{cat.name}</span>
                <span className="sl-cat-count">{cat.skyboxes.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main ── */}
        <div className="sl-main">

          {/* Header */}
          <div className="sl-header">
            <div className="sl-header-badge">
              <span className="sl-header-name">
                {selectedSkybox ? selectedSkybox.name : (selectedCategory || 'Skybox Library')}
              </span>
              {loading && <span style={{ fontSize: '0.72rem', color: 'rgba(0,221,255,0.45)', fontWeight: 400 }}>⟳ Loading…</span>}
            </div>
            <div className="sl-header-right">
              {selectedSkybox
                ? <button className="sl-back-btn" onClick={() => setSelectedSkybox(null)}>← Back</button>
                : <button className="sl-reload-btn" onClick={onReload} disabled={loading}>↺ Reload</button>
              }
              <button className="sl-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* Body */}
          {selectedSkybox ? (
            <DetailView
              skybox={selectedSkybox}
              mapName={mapName}
              mapsFolderPath={mapsFolderPath}
              onApply={onApply}
              onBack={() => setSelectedSkybox(null)}
            />
          ) : (
            <div className="sl-content">
              {loading && categories.length === 0 ? (
                <div className="sl-empty">
                  <div className="sl-empty-icon sl-empty-spin">⟳</div>
                  <p>Loading from GitHub…</p>
                </div>
              ) : currentSkyboxes.length === 0 ? (
                <div className="sl-empty">
                  <div className="sl-empty-icon">⬡</div>
                  <p>No skyboxes found.<br />Add folders to <code>skyboxes/{selectedCategory?.toLowerCase()}/</code> in the repo.</p>
                </div>
              ) : (
                <div className="sl-grid">
                  {currentSkyboxes.map((skybox, i) => (
                    <SkyboxCard key={i} skybox={skybox}
                      onClick={() => setSelectedSkybox(skybox)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {!selectedSkybox && (
            <div className="sl-footer">
              <span className="sl-footer-count">{totalCount} skyboxes in {categories.length} categories</span>
              <button className="sl-footer-cancel" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}