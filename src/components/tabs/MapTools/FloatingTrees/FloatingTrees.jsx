// ─── Floating Trees ───────────────────────────────────────────────────────────
// Finds props whose geometry does not sit on the ground they were placed on.
//
// The case this tab exists for: the editor snaps a prop to the terrain at *one*
// point — its origin. A tree group is one prop holding a dozen trees on a single
// flat local plane, so snapping the origin snaps the whole slab. Over a cliff or
// a crater rim the outer trees keep the origin's elevation while the ground
// under them does not, and they hang in the air; the uphill ones sink into the
// mountain. Both come out of one measurement.
//
// Read-only by design: nothing here writes to the map. Thin orchestration per
// docs/TAB_CONTRACT.md — state, hooks and handlers here, one component per
// section. The measurement is `floatprops-scan` (main process, geometry only);
// the verdict is Shared/MapLogic/floatingPropsLogic.js so the tolerance slider
// re-judges a scanned map without touching disk again.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './FloatingTrees.css';
import { luxuryAlert } from '../../../Shared/Ui/Notifications/notifications';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { MapPreview, Dropdown } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import {
  finalizeMapName, writeFile,
  usePersistentState, useMapInfo, useScmapPreview,
  judgeFloatingProps, buildFloatingPropsReport,
  FLOAT_OBVIOUS,
} from '../../../Shared/MapLogic';
import { FloatingTreesHelp, FloatingTreesHelpButton } from './Help.jsx';
import FloatingTreesConfiguration from './Configuration.jsx';
import FloatingTreesFindings from './Findings.jsx';
import FloatingTreesPlacements from './Placements.jsx';
import FloatingTreesReport from './Report.jsx';

const api = () => window.electronAPI;

// The scan discards anything under this, and the tolerance slider is clamped to
// it — a slider that could ask for detail the scan threw away would undercount
// silently. Low enough that no visible gap is lost: a tenth of an ogrid is
// roughly a tenth of a trunk width.
const SCAN_FLOOR = 0.15;

const OVERLAY_OPTIONS = [
  { value: 'hotspots', label: 'Hotspots' },
  { value: 'props',    label: 'Every Finding' },
];

// Canvas ink. Raw rgba rather than tokens because these are drawn into a bitmap,
// not applied as CSS — the same exception SymmetryChecker's overlay takes. The
// hues are §7 Role 3 (feedback), so they must not follow --tab-color.
const INK_BAD  = 'rgba(255, 99, 99, ';
const INK_WARN = 'rgba(255, 193, 94, ';

const FloatingTreesTab = ({ settings, shared = {}, onSharedChange = () => {} }) => {
  const s = shared;

  // ── Persistent state ────────────────────────────────────────────────────────
  const [mapName,        setMapName]        = usePersistentState(s, 'ft_mapName', '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath] = usePersistentState(s, 'ft_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [tolerance,      setTolerance]      = usePersistentState(s, 'ft_tolerance', 0.5, onSharedChange);
  const [includeSingles, setIncludeSingles] = usePersistentState(s, 'ft_includeSingles', true, onSharedChange);
  const [includeUnderwater, setIncludeUnderwater] = usePersistentState(s, 'ft_includeUnderwater', false, onSharedChange);
  const [overlayMode,    setOverlayMode]    = usePersistentState(s, 'ft_overlayMode', 'hotspots', onSharedChange);
  const [legendCollapsed, setLegendCollapsed] = usePersistentState(s, 'ft_legendCollapsed', false, onSharedChange);

  const { mapInfo } = useMapInfo({
    mapName, mapsFolderPath, settings,
    onMapSize: v => onSharedChange('ft_mapSize', v),
  });
  const { previewImage, previewImageData, setPreviewImageData, previewLoading } =
    useScmapPreview({ mapName, mapsFolderPath, settings });

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [scan,     setScan]     = useState(null);   // the raw measurement, kept for re-judging
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [saveMsg,  setSaveMsg]  = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [activeSection, setActiveSection] = useState('config');
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [openFinding, setOpenFinding] = useState(null);

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (settings?.mapsFolder) setMapsFolderPath(settings.mapsFolder);
  }, [settings]);

  const mapFolderPath = useMemo(() => {
    const name   = (mapName || '').trim();
    const folder = (mapsFolderPath || settings?.mapsFolder || '').trim();
    if (!name || !folder) return '';
    return `${folder}\\${finalizeMapName(name)}`;
  }, [mapName, mapsFolderPath, settings]);

  // ── The scan ────────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    if (!mapFolderPath) {
      setError('Set a map name and maps folder first.');
      return;
    }
    setLoading(true);
    setError(null);
    setScan(null);
    setSelectedHotspot(null);
    setOpenFinding(null);
    try {
      const res = await api().invoke('floatprops-scan', { mapFolderPath, floor: SCAN_FLOOR });
      if (!res?.success) throw new Error(res?.error || 'floatprops-scan failed');
      setScan(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mapFolderPath]);

  // ── The verdict ─────────────────────────────────────────────────────────────
  const judged = useMemo(
    () => judgeFloatingProps({ scan, tolerance, includeUnderwater, includeSingles }),
    [scan, tolerance, includeUnderwater, includeSingles],
  );

  const { findings, byBlueprint, hotspots, counts, verdict, effectiveTolerance } = judged;

  // ── Overlay canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const size = cv.width;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    if (previewImage) ctx.drawImage(previewImage, 0, 0, size, size);
    if (!scan) return;

    const toPx = (v) => (v / scan.size[0]) * size;
    const hue = (severity) => (severity >= FLOAT_OBVIOUS ? INK_BAD : INK_WARN);

    if (overlayMode === 'hotspots') {
      // A ring the size of the affected area, so the mapper sees how much ground
      // one visit covers rather than a cloud of identical pins.
      hotspots.forEach((h, i) => {
        const x = toPx(h.x), z = toPx(h.z);
        const r = Math.max(toPx(h.radius), 5);
        const ink = hue(h.severity);
        const on = selectedHotspot === i;

        ctx.beginPath();
        ctx.arc(x, z, r, 0, Math.PI * 2);
        ctx.fillStyle = `${ink}${on ? 0.28 : 0.14})`;
        ctx.fill();
        ctx.strokeStyle = `${ink}${on ? 1 : 0.7})`;
        ctx.lineWidth = on ? 2 : 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, z, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `${ink}0.95)`;
        ctx.fill();
      });
      return;
    }

    // Every finding: a dot at the prop origin and a leader to its worst
    // offending object, which points at the terrain the group ran off.
    for (const f of findings.slice(0, 6000)) {
      const x = toPx(f.position[0]), z = toPx(f.position[2]);
      const ink = hue(f.severity);
      const worst = f.floatingObjects[0] || f.buriedObjects[0];

      if (worst) {
        ctx.strokeStyle = `${ink}0.4)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, z);
        ctx.lineTo(toPx(worst.x), toPx(worst.z));
        ctx.stroke();
      }
      ctx.fillStyle = `${ink}0.9)`;
      ctx.beginPath();
      ctx.arc(x, z, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [scan, findings, hotspots, overlayMode, previewImage, selectedHotspot]);

  // ── Report ──────────────────────────────────────────────────────────────────
  const reportText = useMemo(() => {
    if (!scan) return '';
    return buildFloatingPropsReport({
      mapName: finalizeMapName(mapName),
      scan, judged, tolerance,
      options: { includeSingles, includeUnderwater },
    });
  }, [scan, judged, mapName, tolerance, includeSingles, includeUnderwater]);

  const copyReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setSaveMsg('Copied to clipboard');
    } catch (err) {
      setSaveMsg(`Copy failed: ${err.message}`);
    }
  }, [reportText]);

  const saveReport = useCallback(async () => {
    if (!reportText || !mapFolderPath) return;
    setSaveMsg('Writing…');
    try {
      const file = `${finalizeMapName(mapName)}_floating_trees.txt`;
      const target = `${mapFolderPath}\\${file}`;
      await writeFile(target, reportText);
      setSaveMsg(`Saved → ${file}`);
      await luxuryAlert(`Report written to:\n${target}`, 'Report Saved', 'success');
    } catch (err) {
      setSaveMsg('');
      await luxuryAlert(err.message, 'Could not save report', 'error');
    }
  }, [reportText, mapFolderPath, mapName]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (typeof ev.target?.result === 'string') setPreviewImageData(ev.target.result); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSelectHotspot = useCallback((i) => {
    setSelectedHotspot(prev => (prev === i ? null : i));
    setOverlayMode('hotspots');
  }, [setOverlayMode]);

  // ── Sections ────────────────────────────────────────────────────────────────
  const SECTIONS = [
    { id: 'config',     index: '01', label: 'Configuration', desc: 'Pick the map and how much air counts as floating.',              done: !!scan },
    { id: 'findings',   index: '02', label: 'Findings',      desc: 'The verdict, and the places on the map worth visiting.',         done: !!scan && !counts.props },
    { id: 'placements', index: '03', label: 'Placements',    desc: 'Which asset keeps failing, and the worst individual props.',     done: !!scan && !counts.props },
    { id: 'report',     index: '04', label: 'Report',        desc: 'The full result as text — copy it or write it beside the map.',   done: false },
  ];

  const sectionContent = {
    config: (
      <FloatingTreesConfiguration
        mapName={mapName} setMapName={setMapName} mapInfo={mapInfo}
        onScan={runScan} loading={loading} error={error} scan={scan}
        tolerance={tolerance} setTolerance={setTolerance}
        effectiveTolerance={effectiveTolerance} scanFloor={SCAN_FLOOR}
        includeSingles={includeSingles} setIncludeSingles={setIncludeSingles}
        includeUnderwater={includeUnderwater} setIncludeUnderwater={setIncludeUnderwater}
      />
    ),
    findings: (
      <FloatingTreesFindings
        hasScan={!!scan}
        verdict={verdict} counts={counts} hotspots={hotspots}
        selectedHotspot={selectedHotspot} onSelectHotspot={onSelectHotspot}
        tolerance={effectiveTolerance}
        truncated={scan?.truncated ?? 0}
        unresolved={(scan?.models || []).filter(m => m.error)}
      />
    ),
    placements: (
      <FloatingTreesPlacements
        hasScan={!!scan}
        byBlueprint={byBlueprint} findings={findings}
        openFinding={openFinding} onOpenFinding={setOpenFinding}
      />
    ),
    report: (
      <FloatingTreesReport
        reportText={reportText} hasScan={!!scan} saveMsg={saveMsg}
        onCopy={copyReport} onSave={saveReport}
        verdict={verdict} counts={counts} hotspotCount={hotspots.length}
      />
    ),
  };

  // ── Preview slot ────────────────────────────────────────────────────────────
  const legendRows = hotspots.slice(0, 12).map((h, i) => ({
    id: i,
    color: h.severity >= FLOAT_OBVIOUS ? 'var(--status-err)' : 'var(--status-warn)',
    label: `${h.x.toFixed(0)}, ${h.z.toFixed(0)}`,
    meta: h.blueprints[0] ?? '—',
    pts: `${h.worstAir > 0 ? '+' : ''}${(h.worstAir || -h.worstSink).toFixed(2)}`,
  }));

  const previewSlot = (
    <MapPreview
      previewLoading={previewLoading}
      previewImageData={previewImageData}
      fileInputRef={fileInputRef}
      onImageUpload={handleImageUpload}
      controls={<Dropdown options={OVERLAY_OPTIONS} value={overlayMode} onChange={setOverlayMode} ariaLabel="Finding overlay" />}
      subtitle="Ground Contact"
      canvasRef={canvasRef}
      containerRef={canvasContainerRef}
      showPlaceholder={!scan}
      placeholder="Scan a map to see where its props leave the ground"
      legendTitle="Hotspots"
      legendRows={legendRows}
      legendCollapsible
      legendCollapsed={legendCollapsed}
      onToggleLegend={() => setLegendCollapsed(c => !c)}
      selectedLegendId={selectedHotspot}
      onLegendSelect={(id) => { onSelectHotspot(id); setActiveSection('findings'); }}
      hint={scan
        ? `${counts.props.toLocaleString()} prop(s) flagged · ${hotspots.length} hotspot(s) · ${effectiveTolerance.toFixed(2)} unit tolerance`
        : 'No map scanned'}
    />
  );

  return (
    <div className="floatingtrees-tab trace-tab">
      <FloatingTreesHelpButton open={showHelp} onClick={() => setShowHelp(o => !o)} />

      <TabLayout
        sections={SECTIONS}
        activeSection={activeSection}
        onSelect={setActiveSection}
        asideSlot={previewSlot}
        asideCaption={null}
        ghostLabel="FLOATING"
        navLabel="Floating trees console navigation"
      >
        {sectionContent[activeSection]}
      </TabLayout>

      <FloatingTreesHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
        contextLabel={SECTIONS.find(sec => sec.id === activeSection)?.label || ''}
        mapContext={mapName}
      />
    </div>
  );
};

export default FloatingTreesTab;
