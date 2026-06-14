import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import '../modals/root.css';
import Wreckage        from '../tabs/Emitter/WreckageTab/Wreckage.jsx';
import Props           from '../tabs/Emitter/PropsTab/Props.jsx';
import CustomProps     from '../tabs/Generator/CustomPropsTab/CustomProps.jsx';
import Trees           from '../tabs/Generator/TreesTab/Trees.jsx';
import RockErosion     from '../tabs/Generator/RockErosionTab/RockErosion.jsx';
import Stars           from '../tabs/Skybox/StarsTab/Stars.jsx';
import Emitter         from '../tabs/Emitter/EmitterTab/Emitter.jsx';
import SkyboxGenerator from '../tabs/Skybox/SkyboxGeneratorTab/SkyboxGenerator.jsx';
import Contributions   from '../tabs/Community/ContributionsTab/Contributions.jsx';
import Settings        from '../tabs/Config/SettingsTab/Settings.jsx';
import ScmapTool       from '../tabs/Tools/ScmapTab/Scmap.jsx';
import AdaptiveMapHelper from '../tabs/Tools/AdaptiveMapHelperTab/AdaptiveMapHelper.jsx';
import HistoryTab      from '../tabs/Tools/HistoryTab/History.jsx';
import MapResizerTab  from '../tabs/Tools/MapResizerTab/MapResizer.jsx';
import PreviewImageTab from '../tabs/Tools/PreviewImageTab/PreviewImage.jsx';
import { commitHistoryEntry } from '../../../utils/ScmapHistoryTracker.js';
import HomeScreen from './home/HomeScreen.jsx';
import Banner from './banner/Banner.jsx';
import MegaNavbar from './navbar/MegaNavbar.jsx';
import './ForgeMapToolkit.css';

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRARY CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export const LibraryContext = createContext({
  emitters:   [],
  props:      [],
  units:      [],
  scanned:    false,
  scanning:   false,
  scanCounts: null,
  reload:     () => {},
});

export const useLibrary = () => useContext(LibraryContext);

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const FirstRunModal = ({ onDone, onSkip }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  }}>
    <div style={{
      background: '#111', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', width: '680px', maxHeight: '90vh', overflow: 'auto',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    }}>
      <div style={{
        padding: '24px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#eee', letterSpacing: '0.05em' }}>
            Welcome to Map Tool Suite
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            Set up your paths to get started — libraries will be scanned automatically.
          </div>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: '3px',
          background: 'rgba(255,140,0,0.15)', border: '1px solid rgba(255,140,0,0.35)',
          color: '#ff8c00', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
        }}>FIRST RUN</div>
      </div>
      <Settings compact onSave={onDone} />
      <div style={{
        padding: '16px 32px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <button onClick={onSkip} style={{
          padding: '9px 20px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          color: '#666', fontSize: '11px', cursor: 'pointer',
          fontFamily: 'Poppins, sans-serif',
        }}>Skip for now</button>
      </div>
    </div>
  </div>
);

const UpdateModal = ({ currentVersion, latestVersion, downloadUrl, onClose }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  }}>
    <div style={{
      background: '#111', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', width: '400px', padding: '28px 32px',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    }}>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#eee', marginBottom: '8px', fontFamily: 'Poppins, sans-serif' }}>
        Update Available
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px', lineHeight: 1.6, fontFamily: 'Poppins, sans-serif' }}>
        Running <span style={{ color: '#aaa', fontWeight: 600 }}>v{currentVersion}</span>.{' '}
        Latest: <span style={{ color: '#ff8c00', fontWeight: 700 }}>v{latestVersion}</span>.
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '9px 18px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          color: '#666', fontSize: '11px', cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
        }}>Later</button>
        <button onClick={() => { window.electronAPI.invoke('open-external', downloadUrl); onClose(); }} style={{
          padding: '9px 20px', background: 'rgba(255,140,0,0.15)',
          border: '1px solid rgba(255,140,0,0.4)', borderRadius: '4px',
          color: '#ff8c00', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
          letterSpacing: '0.05em', fontFamily: 'Poppins, sans-serif',
        }}>Download v{latestVersion}</button>
      </div>
    </div>
  </div>
);

const ScanProgressBanner = ({ counts }) => (
  <div style={{
    background: 'rgba(255,140,0,0.07)',
    borderBottom: '1px solid rgba(255,140,0,0.18)',
    padding: '8px 20px',
    display: 'flex', alignItems: 'center', gap: '12px',
    fontFamily: 'Poppins, sans-serif', fontSize: '11px', color: '#ff8c00',
  }}>
    <span style={{
      display: 'inline-block', width: '12px', height: '12px',
      border: '2px solid rgba(255,140,0,0.3)', borderTopColor: '#ff8c00',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
    {counts
      ? `Scan complete — ${counts.emitters} emitters · ${counts.props} props · ${counts.units} units`
      : 'Scanning gamedata libraries…'}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

const ForgeMapToolkit = () => {
  const [activeSection, setActiveSection] = useState(null);
  const [showFirstRun, setShowFirstRun]   = useState(false);
  const [updateInfo,   setUpdateInfo]     = useState(null);
  const [settings,     setSettings]       = useState(null);
  const [appVersion,   setAppVersion]     = useState('');

  const [library,    setLibrary]    = useState({ emitters: [], props: [], units: [], scanned: false });
  const [scanning,   setScanning]   = useState(false);
  const [scanCounts, setScanCounts] = useState(null);

  useEffect(() => {
    window.electronAPI.invoke('settings-get-version').then(v => setAppVersion(v)).catch(() => {});
  }, []);

  useEffect(() => {
    window.electronAPI.invoke('settings-load').then(s => {
      setSettings(s);
      if (s.firstRun) setShowFirstRun(true);
      else if (s.startTab) setActiveSection(s.startTab);
    });

    window.electronAPI.invoke('library-load').then(data => {
      setLibrary({ emitters: data.emitters, props: data.props, units: data.units, scanned: data.scanned });
    });

window.electronAPI.invoke('check-update').then(res => {
  if (res?.latestVersion && res?.currentVersion) {
    const parse = s => s.split('.').map(Number).reduce((a, n, i) => a + n * Math.pow(1000, 2 - i), 0);
    if (parse(res.latestVersion) > parse(res.currentVersion)) setUpdateInfo(res);
  }
}).catch(() => {});

    window.electronAPI.on('library-scan-started', () => {
      setScanning(true);
      setScanCounts(null);
    });

    window.electronAPI.on('library-scan-complete', (event, result) => {
      setScanning(false);
      if (result.success) {
        setScanCounts(result.counts);
        window.electronAPI.invoke('library-load').then(data => {
          setLibrary({ emitters: data.emitters, props: data.props, units: data.units, scanned: true });
        });
        setTimeout(() => setScanCounts(null), 4000);
      }
    });

    return () => {
      window.electronAPI.removeAllListeners('library-scan-started');
      window.electronAPI.removeAllListeners('library-scan-complete');
    };
  }, []);

  const reloadLibrary = async () => {
    const data = await window.electronAPI.invoke('library-load');
    setLibrary({ emitters: data.emitters, props: data.props, units: data.units, scanned: data.scanned });
  };

  const handleFirstRunSkip = async () => {
    const s = await window.electronAPI.invoke('settings-load');
    await window.electronAPI.invoke('settings-save', { ...s, firstRun: false });
    setShowFirstRun(false);
  };

  const isHomepage = activeSection === null;

  const libraryContextValue = {
    ...library,
    scanning,
    scanCounts,
    reload: reloadLibrary,
  };

  // ─── Persist tm_/re_ keys across sessions via localStorage ─────────────────
  const PERSIST_PREFIX = ['tm_', 're_'];
  const LS_KEY = 'fmtk_shared_state';

  const [sharedState, setSharedState] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  // Record a snapshot for a specific tab
const handleRecordSnapshot = useCallback((tabId, mapName, snapBefore, snapAfter) => {
  commitHistoryEntry(tabId, mapName, snapBefore, snapAfter);
}, []);

// Restore a snapshot: merge snapshot keys back into sharedState
const handleRestoreSnapshot = useCallback((tabId, snapshot) => {
  setSharedState(prev => ({ ...prev, ...snapshot }));
}, []);
  const updateShared = (key, val) => setSharedState(prev => ({ ...prev, [key]: val }));

  // ─── Project map name: push settings.mapName into every tab's map field ──────
  // Runs on initial settings load and whenever the user saves a new name.
  // A non-empty settings.mapName is authoritative — empty leaves tabs untouched.
  const MAP_NAME_SHARED_KEYS = [
    'pt_mapName',  // Props
    'wr_mapName',  // Wreckages
    'cpt_mapName', // CustomProps
    'tm_mapName',  // TreeMap
    're_mapName',  // RockErosion
    'em_mapName',  // Emitter
    'sb_mapName',  // Stars + SkyboxGenerator (same key)
    'amh_mapName', // AdaptiveMapHelper
    'mr_mapName',  // MapResizer
  ];

  useEffect(() => {
    if (!settings?.mapName) return;
    setSharedState(prev => {
      const patch = {};
      for (const key of MAP_NAME_SHARED_KEYS) patch[key] = settings.mapName;
      return { ...prev, ...patch };
    });
  }, [settings?.mapName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Write persisted keys to localStorage whenever sharedState changes
  useEffect(() => {
    try {
      const toPersist = Object.fromEntries(
        Object.entries(sharedState).filter(([k]) =>
          PERSIST_PREFIX.some(p => k.startsWith(p))
        )
      );
      localStorage.setItem(LS_KEY, JSON.stringify(toPersist));
    } catch { /* quota errors etc — fail silently */ }
  }, [sharedState]);

const tabProps = {
  settings,
  shared: sharedState,
  onSharedChange: updateShared,
  onNavigateTab: setActiveSection,
  onRecordSnapshot: handleRecordSnapshot, 
};

  return (
    <LibraryContext.Provider value={libraryContextValue}>
      <div className="map-tool-suite" data-active-theme={activeSection || 'home'}>

        {showFirstRun && (
          <FirstRunModal
            onDone={s => { setSettings(s); setShowFirstRun(false); }}
            onSkip={handleFirstRunSkip}
          />
        )}
        {updateInfo && !showFirstRun && (
          <UpdateModal {...updateInfo} onClose={() => setUpdateInfo(null)} />
        )}

        <Banner activeSection={activeSection} />

        {(scanning || scanCounts) && (
          <ScanProgressBanner counts={scanning ? null : scanCounts} />
        )}

        {!isHomepage && (
          <MegaNavbar
            activeSection={activeSection}
            onNavigate={id => setActiveSection(id)}
          />
        )}

        {isHomepage && (
          <HomeScreen
            onNavigate={setActiveSection}
            appVersion={appVersion}
            libraryScanned={library.scanned}
            scanning={scanning}
            settings={settings}
            mapName={settings?.mapName || null}
          />
        )}

        {!isHomepage && (
          <div className="tab-content">
            {activeSection === 'wreckages'        && <Wreckage        {...tabProps} />}
            {activeSection === 'props'            && <Props           {...tabProps} />}
            {activeSection === 'customprops'      && <CustomProps     {...tabProps} />}
            {activeSection === 'treemap'          && <Trees           {...tabProps} />}
            {activeSection === 'rockerosion'      && <RockErosion     {...tabProps} />}
            {activeSection === 'emitter'          && <Emitter         {...tabProps} />}
            {activeSection === 'stars'            && <Stars           {...tabProps} />}
            {activeSection === 'skybox-generator' && <SkyboxGenerator {...tabProps} />}
            {activeSection === 'scmaptool'        && <ScmapTool       {...tabProps} />}
            {activeSection === 'adaptivemaphelper'  && <AdaptiveMapHelper {...tabProps} />}
            {activeSection === 'history'          && (<HistoryTab settings={settings} shared={sharedState} />
)}
{activeSection === 'mapresizer'        && <MapResizerTab    {...tabProps} />}
{activeSection === 'previewimage'      && <PreviewImageTab  {...tabProps} />}
{activeSection === 'contributions'    && <Contributions   {...tabProps} />}
{activeSection === 'guides'           && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: '20px', fontFamily: 'Poppins, sans-serif', textAlign: 'center', padding: '60px 20px',
              }}>
                <div style={{ fontSize: '3rem', opacity: 0.25 }}>📖</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                  Guides
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '6px 16px', borderRadius: '4px',
                  background: 'rgba(200,111,255,0.1)', border: '1px solid rgba(200,111,255,0.3)',
                  color: '#C86FFF', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em',
                }}>
                  COMING IN V2
                </div>
                <p style={{ maxWidth: '400px', fontSize: '0.88rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.75, margin: 0 }}>
                  An in-app guide library with tutorials, mapping tips and reference articles is planned for the next major release.
                </p>
              </div>
            )}

            {activeSection === 'settings'         && (
              <Settings onSave={s => setSettings(s)} />
            )}
          </div>
        )}

        {!isHomepage && activeSection !== 'settings' && activeSection !== 'guides' && (
          <div className="suite-footer">
            <p className="footer-credit">
              <span className="footer-part footer-part--ver">v{appVersion || '1.0'}</span>
              <span className="footer-part">Seraphim-Noob</span>
              <span className="footer-part">Forged Alliance Forever</span>
            </p>
            <div className="footer-trace" aria-hidden="true">
              <div className="footer-trace-bloom" />
              <div className="footer-trace-line" />
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </LibraryContext.Provider>
  );
};

export default ForgeMapToolkit;