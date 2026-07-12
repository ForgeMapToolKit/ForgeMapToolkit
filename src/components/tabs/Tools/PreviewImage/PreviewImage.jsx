import React, { useState } from 'react';
import '../../../Shared/DesignSystem/index.css';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import './PreviewImage.css';
import PreviewImageHelpModal from '../../HelpModals/PreviewImage_help.jsx';

const RESOLUTIONS = [
  { label: '512 × 512',   w: 512,  h: 512  },
  { label: '1024 × 1024', w: 1024, h: 1024 },
  { label: '2048 × 2048', w: 2048, h: 2048, warnYellow: true },
  { label: '4096 × 4096', w: 4096, h: 4096, warnRed: true },
];

const STEPS = [
  { id: 'unpack',  label: 'Unpacking .scmap'                 },
  { id: 'render',  label: 'Rendering preview via Map Editor' },
  { id: 'convert', label: 'Converting PNG → DDS'             },
  { id: 'replace', label: 'Replacing previewImage.dds'       },
  { id: 'pack',    label: 'Repacking .scmap'                 },
];

const PreviewImageTab = ({ settings }) => {
  const [mapName,     setMapName]    = useState(settings?.mapName ?? '');
  const [resolution,  setResolution] = useState(RESOLUTIONS[1]);
  const [status,      setStatus]     = useState('idle');
  const [stepStates,  setStepStates] = useState({});
  const [previewSrc,  setPreviewSrc] = useState(null);
  const [errorMsg,    setErrorMsg]   = useState('');

  const [activeSection, setActiveSection] = useState('configuration');
  const [showHelp,      setShowHelp]      = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('guide');
  const [helpSelected,  setHelpSelected]  = useState(null);

  const mapsFolder = settings?.mapsFolder ?? '';
  const editorPath = settings?.editorPath ?? '';

  const setStep = (id, state) =>
    setStepStates(prev => ({ ...prev, [id]: state }));

  const handleGenerate = async () => {
    const name = mapName.trim();
    if (!name || !mapsFolder || !editorPath) return;

    const finalName     = /\.v\d{4}$/.test(name) ? name : `${name}.v0001`;
    const mapFolderPath = `${mapsFolder}\\${finalName}`;
    const bareMapName   = finalName.replace(/\.v\d+$/, '');
    const scmapPath     = `${mapFolderPath}\\${bareMapName}.scmap`;
    const scenarioPath  = `${mapFolderPath}\\${bareMapName}_scenario.lua`;

    setStatus('running');
    setStepStates({});
    setPreviewSrc(null);
    setErrorMsg('');

    let tmpUnpackFolder, tmpPng;

    try {
      setStep('unpack', 'running');
      const unpackRes = await window.electronAPI.invoke('scmap-unpack', { scmapPath });
      if (!unpackRes.success) throw new Error(`Unpack failed: ${unpackRes.error}`);
      tmpUnpackFolder = unpackRes.outputFolder;
      setStep('unpack', 'done');

      setStep('render', 'running');
      const renderRes = await window.electronAPI.invoke('preview-render', {
        editorPath, width: resolution.w, height: resolution.h, scenarioPath, outputFolder: tmpUnpackFolder,
      });
      if (!renderRes.success) throw new Error(`Render failed: ${renderRes.error}`);
      tmpPng = renderRes.pngPath;
      setStep('render', 'done');

      if (renderRes.isDds) {
        setStep('convert', 'done');
        setStep('replace', 'done');
      } else {
        setStep('convert', 'running');
        const tmpDds = `${tmpUnpackFolder}\\previewImage.dds`;
        const ddsRes = await window.electronAPI.invoke('png-to-preview-dds', { pngPath: tmpPng, destPath: tmpDds });
        if (!ddsRes.success) throw new Error(`DDS conversion failed: ${ddsRes.error}`);
        setStep('convert', 'done');
        setStep('replace', 'done');
      }

      setStep('pack', 'running');
      const packRes = await window.electronAPI.invoke('scmap-pack', { unpackFolder: tmpUnpackFolder, scmapPath });
      if (!packRes.success) throw new Error(`Pack failed: ${packRes.error}`);
      setStep('pack', 'done');

      setPreviewSrc(`file:///${tmpPng.replace(/\\/g, '/')}?t=${Date.now()}`);
      setStatus('done');

    } catch (err) {
      const runningId = STEPS.find(s => stepStates[s.id] === 'running')?.id;
      if (runningId) setStep(runningId, 'error');
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const isRunning   = status === 'running';
  const canGenerate = !isRunning && !!mapName.trim() && !!editorPath && !!mapsFolder;

  // ── Sections ──────────────────────────────────────────────────────────────────

  const sections = [
    { id: 'configuration', index: '01', label: 'Configuration', desc: 'Set the map name and choose a render resolution.', done: !!mapName.trim() },
    { id: 'output',        index: '02', label: 'Output',        desc: 'Run the render pipeline and generate the preview.', done: status === 'done' },
  ];

  const sectionContent = {
    configuration: (
      <div className="ctrl-col">

        {/* Map Name */}
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Map</div>
          <div className="ctrl-content">
            <div className="ctrl-field">
              <div className="ctrl-label">Map Name</div>
              <input
                className="ctrl-input"
                placeholder="e.g. Hades_Dust.v0002"
                value={mapName}
                onChange={e => setMapName(e.target.value)}
                disabled={isRunning}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Render resolution */}
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Render Resolution</div>
          <div className="ctrl-content">
            <div className="pi-resolution-grid">
              {RESOLUTIONS.map(r => (
                <button
                  key={r.label}
                  type="button"
                  className={`station pi-res-btn${resolution.w === r.w ? ' active' : ''}`}
                  onClick={() => setResolution(r)}
                  disabled={isRunning}
                >
                  {r.label}{r.warnRed ? ' ⚠' : ''}
                </button>
              ))}
            </div>

            {resolution.warnYellow && (
              <div className="pi-warn-box">
                <strong>Performance notice:</strong> 2048 × 2048 previews take noticeably longer to render and convert.
              </div>
            )}
            {resolution.warnRed && (
              <div className="pi-warn-box pi-warn-box--danger">
                <strong>Caution:</strong> 4096 × 4096 previews cause a freeze and RAM spike when loading in lobby. Memory may not deallocate cleanly.
              </div>
            )}

            {(!editorPath || !mapsFolder) && (
              <div className="ctrl-field" style={{ marginTop: 'var(--space-lg)' }}>
                {!editorPath && <p className="field-hint">Map Editor path is not configured. Set it under <strong>Settings → Game Paths</strong>.</p>}
                {!mapsFolder && <p className="field-hint" style={!editorPath ? { marginTop: 'var(--space-xs)' } : {}}>Maps folder is not configured. Set it under <strong>Settings → Game Paths</strong>.</p>}
              </div>
            )}
          </div>
        </div>

      </div>
    ),
    output: (
      <div className="ctrl-col">

        {/* Pipeline */}
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Pipeline</div>
          <div className="ctrl-content">
            <div className="pi-steps">
              {STEPS.map((step, idx) => {
                const state = stepStates[step.id] ?? 'pending';
                return (
                  <div key={step.id} className={`pi-step pi-step--${state}`}>
                    <div className="pi-step-num">
                      {state === 'done'    ? '✓' :
                       state === 'error'   ? '✗' :
                       state === 'running' ? <span className="pi-spinner" /> :
                       idx + 1}
                    </div>
                    <div className="pi-step-label">{step.label}</div>
                  </div>
                );
              })}
            </div>

            {status === 'error' && errorMsg && (
              <div className="pi-error-box">
                <strong>Error:</strong> {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Generate */}
        <div className="ctrl-block">
          <div className="ctrl-subtitle">Generate</div>
          <div className="ctrl-content">
            <button
              className="commit-button"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              <span className="commit-button-label">{isRunning ? 'Generating…' : 'Generate Preview'}</span>
              <span className="commit-button-status">{canGenerate ? 'Ready' : (isRunning ? '●' : 'Not Ready')}</span>
              <div className="commit-button-bloom" aria-hidden="true" />
              <div className="commit-button-line"  aria-hidden="true" />
            </button>
          </div>
        </div>

      </div>
    ),
  };

  // ── Aside (rendered preview) ─────────────────────────────────────────────────

  const asideSlot = (
    <div className="ctrl-block">
      <div className="mp-subtitle">Preview</div>
      {(status === 'done' || status === 'error') && (
        <div className="mp-action-row">
          {status === 'done'  && <span className="ctrl-badge ctrl-badge--ok">Updated</span>}
          {status === 'error' && <span className="ctrl-badge ctrl-badge--err">Failed</span>}
        </div>
      )}

      <div className="ec-canvas-wrap pi-preview-wrap">
        {previewSrc ? (
          <img src={previewSrc} alt="Generated map preview" className="pi-preview-img" />
        ) : (
          <div className="ec-canvas-placeholder">
            {isRunning ? 'Rendering…' : 'Preview will appear here after generation'}
          </div>
        )}
        {isRunning && (
          <div className="pi-overlay-spinner">
            <div className="pi-big-spinner" />
          </div>
        )}
      </div>

      {status === 'done' && (
        <p className="field-hint" style={{ marginTop: 'var(--space-md)' }}>
          The .scmap has been updated with the new {resolution.label} preview image.
        </p>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="pi-theme trace-tab">
      <TabLayout
        sections={sections}
        activeSection={activeSection}
        onSelect={setActiveSection}
        navLabel="Preview image navigation"
        asideSlot={asideSlot}
        asideCaption={null}
        asideMirror={null}
      >
        {sectionContent[activeSection]}
      </TabLayout>

      <button className="help-btn" onClick={() => setShowHelp(true)} title="Help">?</button>

      {showHelp && (
        <PreviewImageHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={t => { setActiveHelpTab(t); setHelpSelected(null); }}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
        />
      )}
    </div>
  );
};

export default PreviewImageTab;
