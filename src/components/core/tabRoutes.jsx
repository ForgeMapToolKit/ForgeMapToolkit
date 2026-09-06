import React from 'react';
import Wreckage          from '../Tabs/Emitter/Wreckage/Wreckage.jsx';
import Props             from '../Tabs/Emitter/Props/Props.jsx';
import Emitter           from '../Tabs/Emitter/Emitter/Emitter.jsx';
import CustomProps       from '../Tabs/Scenery/CustomProps/CustomProps.jsx';
import Trees             from '../Tabs/Scenery/Trees/Trees.jsx';
import RockErosion       from '../Tabs/Scenery/RockErosion/RockErosion.jsx';
import WaveNormals       from '../Tabs/Textures/WaveNormals/WaveNormals.jsx';
import TerrainType        from '../Tabs/Emitter/TerrainType/TerrainType.jsx';
import Stars             from '../Tabs/Skybox/Stars/Stars.jsx';
import SkyboxGenerator   from '../Tabs/Skybox/SkyboxGenerator/SkyboxGenerator.jsx';
import TextureEditor     from '../Tabs/Textures/TextureEditor/TextureEditor.jsx';
import Viewer3D          from '../Tabs/Textures/Viewer3D/Viewer3D.jsx';
import Contributions     from '../Tabs/Community/Contributions/Contributions.jsx';
import Settings          from '../Tabs/System/Settings/Settings.jsx';
import ScmapTool         from '../Tabs/MapTools/Scmap/Scmap.jsx';
import AdaptiveMapHelper from '../Tabs/MapTools/AdaptiveMapHelper/AdaptiveMapHelper.jsx';
import HistoryTab        from '../Tabs/System/History/History.jsx';
import MapResizerTab     from '../Tabs/MapTools/MapResizer/MapResizer.jsx';
import MapRotatorTab     from '../Tabs/MapTools/MapRotator/MapRotator.jsx';
import PreviewImageTab   from '../Tabs/MapTools/PreviewImage/PreviewImage.jsx';
import BiomeChangerTab   from '../Tabs/MapTools/BiomeChanger/BiomeChanger.jsx';
import SymmetryChecker   from '../Tabs/MapTools/SymmetryChecker/SymmetryChecker.jsx';
import FloatingTrees     from '../Tabs/MapTools/FloatingTrees/FloatingTrees.jsx';
import CliTerminalTab    from '../Tabs/System/CliTerminal/CliTerminal.jsx';
import FooterArticleTab  from './Footer/ArticleTab/FooterArticleTab.jsx';

/**
 * tabRoutes — single render registry for the suite's tabs.
 *
 * Keyed by the same section ids used for navigation (see home/data/toolRegistry.js).
 * Each entry is a renderer `(ctx) => element`, where ctx exposes everything a tab
 * may need; most tabs spread the common `tabProps`, a few take bespoke props.
 *
 * Footer articles are not listed individually -- ids of the form "footer:<slug>"
 * are caught in renderTab() below and routed to FooterArticleTab.
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
  wavenormals:        (c) => <WaveNormals     {...c.tabProps} />,
  terraintype:        (c) => <TerrainType     {...c.tabProps} />,
  emitter:            (c) => <Emitter         {...c.tabProps} />,
  stars:              (c) => <Stars           {...c.tabProps} />,
  'skybox-generator': (c) => <SkyboxGenerator {...c.tabProps} />,
  'node-editor':      (c) => <TextureEditor   {...c.tabProps} />,
  viewer3d:           (c) => <Viewer3D        {...c.tabProps} />,
  scmaptool:          (c) => <ScmapTool       {...c.tabProps} />,
  adaptivemaphelper:  (c) => <AdaptiveMapHelper {...c.tabProps} />,
  history:            (c) => <HistoryTab settings={c.settings} shared={c.sharedState} />,
  mapresizer:         (c) => <MapResizerTab   {...c.tabProps} />,
  maprotator:         (c) => <MapRotatorTab   {...c.tabProps} />,
  previewimage:       (c) => <PreviewImageTab {...c.tabProps} />,
  biomechanger:       (c) => <BiomeChangerTab  {...c.tabProps} />,
  symmetrychecker:    (c) => <SymmetryChecker  {...c.tabProps} />,
  floatingtrees:      (c) => <FloatingTrees    {...c.tabProps} />,
  cliterminal:        (c) => <CliTerminalTab  {...c.tabProps} />,
  contributions:      (c) => <Contributions   {...c.tabProps} />,
  guides:             () => <GuidesPlaceholder />,
  settings:           (c) => <Settings onSave={c.setSettings} />,
};

/** Section ids that render their own full-bleed chrome (no suite footer). */
export const CHROMELESS_SECTIONS = new Set(['settings', 'guides']);

// Footer articles aren't entered in TAB_ROUTES individually -- one entry per
// id (about-fmt, changelog, licenses, ...) would just duplicate the list
// already in footerContentRegistry.js. Instead any id of the form
// "footer:<slug>" is recognised here and routed to a single shared component,
// which looks up its own title/teaser from the registry by slug.
const FOOTER_PREFIX = 'footer:';

export const renderTab = (id, ctx) => {
  if (typeof id === 'string' && id.startsWith(FOOTER_PREFIX)) {
    const slug = id.slice(FOOTER_PREFIX.length);
    return <FooterArticleTab slug={slug} {...ctx.tabProps} />;
  }
  return TAB_ROUTES[id]?.(ctx) ?? null;
};
