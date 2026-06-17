import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import '../modals/root.css';
import { commitHistoryEntry } from '../../../utils/ScmapHistoryTracker.js';
import HomeScreen from './home/HomeScreen.jsx';
import Banner from './banner/Banner.jsx';
import MegaNavbar from './navbar/MegaNavbar.jsx';
import FirstRunModal from './chrome/FirstRunModal.jsx';
import UpdateModal from './chrome/UpdateModal.jsx';
import ScanProgressBanner from './chrome/ScanProgressBanner.jsx';
import { renderTab, CHROMELESS_SECTIONS } from './tabRoutes.jsx';
import { loadPersistedShared, persistShared, projectMapName } from './sharedState.js';
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

  // Tool currently hovered on the home screen — lets the banner preview its hue.
  const [homeHoverId, setHomeHoverId] = useState(null);

  const libraryContextValue = {
    ...library,
    scanning,
    scanCounts,
    reload: reloadLibrary,
  };

  // ─── Shared store — flat per-tab-prefixed object (see core/sharedState.js) ────
  const [sharedState, setSharedState] = useState(loadPersistedShared);

  const handleRecordSnapshot = useCallback((tabId, mapName, snapBefore, snapAfter) => {
    commitHistoryEntry(tabId, mapName, snapBefore, snapAfter);
  }, []);

  // Restore a snapshot: merge snapshot keys back into sharedState
  const handleRestoreSnapshot = useCallback((tabId, snapshot) => {
    setSharedState(prev => ({ ...prev, ...snapshot }));
  }, []);

  const updateShared = (key, val) => setSharedState(prev => ({ ...prev, [key]: val }));

  // Project a saved settings.mapName into every tab's map field (authoritative
  // when non-empty; empty leaves tabs untouched).
  useEffect(() => {
    if (!settings?.mapName) return;
    setSharedState(prev => projectMapName(prev, settings.mapName));
  }, [settings?.mapName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist the persisted-prefix slice whenever the shared store changes.
  useEffect(() => { persistShared(sharedState); }, [sharedState]);

const tabProps = {
  settings,
  shared: sharedState,
  onSharedChange: updateShared,
  onNavigateTab: setActiveSection,
  onRecordSnapshot: handleRecordSnapshot, 
};

  return (
    <LibraryContext.Provider value={libraryContextValue}>
      <div className="forgemaptoolkit" data-active-theme={activeSection || 'home'}>

        {showFirstRun && (
          <FirstRunModal
            onDone={s => { setSettings(s); setShowFirstRun(false); }}
            onSkip={handleFirstRunSkip}
          />
        )}
        {updateInfo && !showFirstRun && (
          <UpdateModal {...updateInfo} onClose={() => setUpdateInfo(null)} />
        )}

        {/* Suite chrome — banner + navbar retract as one body when a help
            overlay mounts (see .forgemaptoolkit-chrome rule), clearing the help rail. */}
        <div className="forgemaptoolkit-chrome">
          <Banner activeSection={activeSection} previewSection={isHomepage ? homeHoverId : null} />

          {(scanning || scanCounts) && (
            <ScanProgressBanner counts={scanning ? null : scanCounts} />
          )}

          {!isHomepage && (
            <MegaNavbar
              activeSection={activeSection}
              onNavigate={id => setActiveSection(id)}
            />
          )}
        </div>

        {isHomepage && (
          <HomeScreen
            onNavigate={(id) => { setHomeHoverId(null); setActiveSection(id); }}
            onFocusChange={setHomeHoverId}
            appVersion={appVersion}
            libraryScanned={library.scanned}
            scanning={scanning}
            settings={settings}
            mapName={settings?.mapName || null}
          />
        )}

        {!isHomepage && (
          <div className="tab-content">
            {renderTab(activeSection, { tabProps, settings, setSettings, sharedState })}
          </div>
        )}

        {!isHomepage && !CHROMELESS_SECTIONS.has(activeSection) && (
          <div className="forgemaptoolkit-footer">
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