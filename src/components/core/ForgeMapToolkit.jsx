import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import '../modals/root.css';
import { commitHistoryEntry } from '../../../utils/ScmapHistoryTracker.js';
import HomeScreen from './Home/HomeScreen.jsx';
import { getTool } from './Home/Data/toolRegistry.js';
import Banner from './banner/Banner.jsx';
import MegaNavbar from './Navbar/Navbar.jsx';
import FirstRunModal from './Chrome/FirstRunModal.jsx';
import UpdateModal from './Chrome/UpdateModal.jsx';
import ScanProgressBanner from './Chrome/ScanProgressBanner.jsx';
import { renderTab, CHROMELESS_SECTIONS } from './tabRoutes.jsx';
import { loadPersistedShared, persistShared, projectMapName } from './SharedState.js';
import Footer from './Footer/Footer.jsx';
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

  // ── Footer-article back-navigation ──────────────────────────────────────
  // previousSectionRef captures whatever tab was active right before a
  // footer article opened, so Back returns there instead of falling back to
  // Home. footerReopenToken is bumped on every Back press -- Footer.jsx's
  // expanded/collapsed state lives in its own local useFooterPanelState
  // hook, unreachable from here directly, so this is the side-channel that
  // tells it "re-open" without lifting that whole hook up.
  const previousSectionRef = useRef(null);
  const [footerReopenToken, setFooterReopenToken] = useState(null);

  const handleOpenFooterArticle = useCallback((slug) => {
    previousSectionRef.current = activeSection;
    setActiveSection(`footer:${slug}`);
  }, [activeSection]);

  const handleBackFromFooterArticle = useCallback(() => {
    setActiveSection(previousSectionRef.current ?? null);
    setFooterReopenToken(Date.now());
  }, []);


  const [library,    setLibrary]    = useState({ emitters: [], props: [], units: [], scanned: false });
  const [scanning,   setScanning]   = useState(false);
  const [scanCounts, setScanCounts] = useState(null);

  useEffect(() => {
    window.electronAPI.invoke('settings-get-version').then(v => setAppVersion(v)).catch(() => {});
  }, []);

  // Interface theme — single source of truth lives on <html data-theme>, read
  // by tokens-light.css. Re-asserted whenever settings load or a Settings-tab
  // commit lands (onSave → setSettings), so it's correct from first paint and
  // never depends on the Settings tab having been opened this session.
  useEffect(() => {
    document.documentElement.dataset.theme = settings?.colorTheme === 'light' ? 'light' : 'dark';
  }, [settings?.colorTheme]);

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

  // ─── Last real tool — single source of truth for the accent carry-over ────
  // "footer:<slug>" article tabs have no toolRegistry entry by design, so
  // getTool() returns null while one is open. Banner and Footer used to each
  // track this with their own useRef (duplicated logic); now it's computed
  // once here and handed down, so FooterArticleTab can use the exact same
  // value to theme --tab-color on .fat-root.
  const currentTool = getTool(activeSection);
  const lastToolRef = useRef(null);
  if (currentTool) lastToolRef.current = currentTool;
  const isFooterArticle = typeof activeSection === 'string' && activeSection.startsWith('footer:');
  const lastRealTool = currentTool ?? (isFooterArticle ? lastToolRef.current : null);

  // --current-accent (read by ForgeMapToolkit.css's [data-active-theme="..."]
  // rules, e.g. the mega navbar's indicator) used to go blind whenever a
  // footer article was open: activeSection was the literal "footer:<slug>"
  // string, which never matches any [data-active-theme] selector, so the
  // app idled on the default theme while Banner/Footer/FooterArticleTab
  // already carried lastRealTool's hue via their own --tab-color props.
  // Resolving to lastRealTool.id here keeps both theming layers in sync.
  const activeThemeKey = isFooterArticle ? (lastRealTool?.id ?? 'home') : (activeSection || 'home');

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
  onNavigateBack: handleBackFromFooterArticle,
  onRecordSnapshot: handleRecordSnapshot,
  lastRealTool,
};

  return (
    <LibraryContext.Provider value={libraryContextValue}>
      <div className="forgemaptoolkit" data-active-theme={activeThemeKey}>

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
          <Banner activeSection={activeSection} previewSection={isHomepage ? homeHoverId : null} lastRealTool={lastRealTool} />

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
  <Footer
    activeSection={activeSection}
    appVersion={appVersion}
    mapName={settings?.mapName || null}
    quickLinks={!!settings?.footerQuickLinks}
    onOpenArticle={handleOpenFooterArticle}
    footerReopenToken={footerReopenToken}
    lastRealTool={lastRealTool}
  />
)}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </LibraryContext.Provider>
  );
};

export default ForgeMapToolkit;
