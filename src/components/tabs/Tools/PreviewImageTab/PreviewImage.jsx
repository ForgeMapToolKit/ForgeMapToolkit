import React, { useState } from 'react';
import '../../../shared/shared.css';
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

  const isRunning = status === 'running';

  return (
    <div className="pi-theme tab-root tab-scrollbar">

      <div className="tab-grid">

        {/* LEFT */}
        <div className="tab-col-config">

          <div className="section-card">
            <h3 className="section-title">Map Configuration</h3>

            <div className="form-group">
              <label className="form-label">Map Name</label>
              <input
                className="form-input"
                placeholder="e.g. Hades_Dust.v0002"
                value={mapName}
                onChange={e => setMapName(e.target.value)}
                disabled={isRunning}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Render Resolution</label>
              <div className="pi-resolution-grid">
                {RESOLUTIONS.map(r => (
                  <button
                    key={r.label}
                    className={`pi-res-btn${resolution.w === r.w ? ' active' : ''}`}
                    style={{ opacity: r.warnRed ? 0.75 : 1 }}
                    onClick={() => setResolution(r)}
                    disabled={isRunning}
                  >
                    {r.label}{r.warnRed ? ' ⚠' : ''}
                  </button>
                ))}
              </div>
            </div>

            {resolution.warnYellow && (
              <div className="pi-warn-box">
                <strong>Performance notice:</strong> 2048 × 2048 previews take noticeably longer to render and convert.
              </div>
            )}
            {resolution.warnRed && (
              <div className="pi-warn-box" style={{ borderLeftColor: '#ff4444', background: 'rgba(255,60,60,0.07)', border: '1px solid rgba(255,60,60,0.3)', borderLeft: '4px solid #ff4444', color: '#ff9090' }}>
                <strong style={{ color: '#ff4444' }}>Caution:</strong> 4096 × 4096 previews cause a freeze and RAM spike when loading in lobby. Memory may not deallocate cleanly.
              </div>
            )}

            {(!editorPath || !mapsFolder) && (
              <div className="hint-box" style={{ marginTop: 18 }}>
                {!editorPath && <div>Map Editor path is not configured. Set it under <strong>Settings → Game Paths</strong>.</div>}
                {!mapsFolder && <div style={!editorPath ? { marginTop: 8 } : {}}>Maps folder is not configured. Set it under <strong>Settings → Game Paths</strong>.</div>}
              </div>
            )}
          </div>

          <div className="section-card">
            <h3 className="section-title">Pipeline</h3>
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

          <button
            className="btn-primary btn-lg"
            onClick={handleGenerate}
            disabled={isRunning || !mapName.trim() || !editorPath || !mapsFolder}
          >
            {isRunning ? <><span className="pi-spinner" /> Generating…</> : 'Generate Preview'}
          </button>

        </div>

        {/* RIGHT */}
        <div className="tab-col-detail">
          <div className="section-card pi-preview-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Preview</h3>
              {status === 'done'  && <span className="pi-badge pi-badge--success">Updated</span>}
              {status === 'error' && <span className="pi-badge pi-badge--error">Failed</span>}
            </div>

            <div className="pi-preview-area">
              {previewSrc ? (
                <img src={previewSrc} alt="Generated map preview" className="pi-preview-img" />
              ) : (
                <div className="canvas-placeholder pi-preview-placeholder">
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
              <div className="hint-box" style={{ marginTop: 20 }}>
                The .scmap has been updated with the new {resolution.label} preview image.
              </div>
            )}
          </div>
        </div>

      </div>

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
