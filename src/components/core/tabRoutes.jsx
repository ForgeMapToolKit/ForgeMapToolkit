import React from 'react';
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
import MapResizerTab   from '../tabs/Tools/MapResizerTab/MapResizer.jsx';
import PreviewImageTab from '../tabs/Tools/PreviewImageTab/PreviewImage.jsx';

/**
 * tabRoutes — single render registry for the suite's tabs.
 *
 * Keyed by the same section ids used for navigation (see home/data/toolRegistry.js).
 * Each entry is a renderer `(ctx) => element`, where ctx exposes everything a tab
 * may need; most tabs spread the common `tabProps`, a few take bespoke props.
 *
 *   ctx = { tabProps, settings, setSettings, sharedState }
 */

const GuidesPlaceholder = () => (
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
);

export const TAB_ROUTES = {
  wreckages:          (c) => <Wreckage        {...c.tabProps} />,
  props:              (c) => <Props           {...c.tabProps} />,
  customprops:        (c) => <CustomProps     {...c.tabProps} />,
  treemap:            (c) => <Trees           {...c.tabProps} />,
  rockerosion:        (c) => <RockErosion     {...c.tabProps} />,
  emitter:            (c) => <Emitter         {...c.tabProps} />,
  stars:              (c) => <Stars           {...c.tabProps} />,
  'skybox-generator': (c) => <SkyboxGenerator {...c.tabProps} />,
  scmaptool:          (c) => <ScmapTool       {...c.tabProps} />,
  adaptivemaphelper:  (c) => <AdaptiveMapHelper {...c.tabProps} />,
  history:            (c) => <HistoryTab settings={c.settings} shared={c.sharedState} />,
  mapresizer:         (c) => <MapResizerTab   {...c.tabProps} />,
  previewimage:       (c) => <PreviewImageTab {...c.tabProps} />,
  contributions:      (c) => <Contributions   {...c.tabProps} />,
  guides:             () => <GuidesPlaceholder />,
  settings:           (c) => <Settings onSave={c.setSettings} />,
};

/** Section ids that render their own full-bleed chrome (no suite footer). */
export const CHROMELESS_SECTIONS = new Set(['settings', 'guides']);

export const renderTab = (id, ctx) => TAB_ROUTES[id]?.(ctx) ?? null;
