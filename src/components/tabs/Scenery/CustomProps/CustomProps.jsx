import React, { useState, useEffect, useRef } from 'react';
import AddCustomProp from './AddCustomProp';
import '../../../Shared/shared.css';
import './CustomProps.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import PropsLibrary from '../../../Shared/Libraries/PropsLibrary/PropsLibrary';
import { adjHasChanges, DEFAULT_ADJUSTMENTS } from './TextureEditor/TextureAdjustModal';
import TextureEditor from './TextureEditor/TextureEditor';
import CustomPropsHelpModal from '../../HelpModals/CustomProps_help.jsx';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';

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
function PropPreviewImg({ src, className, alt, style }) {
  const resolved = useDdsPreview(src);
  if (!resolved) return (
    <div className={className} style={{ ...style, display:'flex', alignItems:'center', justifyContent:'center',
      background:'#1a1a2e', color:'#555', fontSize:'10px' }}>DDS</div>
  );
  return <img className={className} src={resolved} alt={alt} style={style} />;
}

// ════════════════════════════════════════════════════════════════════════════
export default function CustomPropsTab({ settings, shared = {}, onSharedChange = () => {} }) {

  // ── Persisted state ──────────────────────────────────────────────────────
  const [mapName,        setMapNameState]        = useState(shared.cpt_mapName        ?? '');
  const [mapsFolderPath, setMapsFolderPathState] = useState(shared.cpt_mapsFolderPath ?? settings?.mapsFolder ?? '');
  const [customProps,    setCustomPropsState]    = useState(shared.cpt_customProps    ?? []);
  const [selectedIdx,    setSelectedIdx]         = useState(null);

  const setMapName        = v => { setMapNameState(v);        onSharedChange('cpt_mapName', v); };
  const setMapsFolderPath = v => { setMapsFolderPathState(v); onSharedChange('cpt_mapsFolderPath', v); };
  const setCustomProps    = v => {
    setCustomPropsState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      onSharedChange('cpt_customProps', next);
      return next;
    });
  };

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showLibrary,     setShowLibrary]     = useState(false);
  const [generating,      setGenerating]      = useState(false);
  const [showTextureEditor, setShowTextureEditor] = useState(false);
  const [resolvedLodUrls,   setResolvedLodUrls]   = useState({}); // { [entry.id]: lodPreviewUrls }

  const openTextureEditor = async () => {
    setShowTextureEditor(true);
    const mf = mapsFolderPath?.trim();
    const mn = mapName?.trim();
    if (!mf || !mn) return;
    const updates = {};
    await Promise.all(customProps.map(async (entry) => {
      // Try originalProp.gamePath first, then targetBpPath as fallback
      const gp = entry.originalProp?.gamePath || entry.targetBpPath;
      if (!gp) return;
      try {
        const res = await window.electronAPI.invoke('resolve-lod-preview-urls', {
          mapsFolder: mf, mapName: mn,
          gamePath:    entry.originalProp?.gamePath,
          targetBpPath: entry.targetBpPath,
        });
        if (res?.lodPreviewUrls && Object.keys(res.lodPreviewUrls).length > 0) {
          updates[entry.id] = res.lodPreviewUrls;
        }
      } catch {}
    }));
    if (Object.keys(updates).length > 0) setResolvedLodUrls(prev => ({ ...prev, ...updates }));
  };
  // showAddCustomProp replaced by 'add' section tab
  const [showHelp,        setShowHelp]        = useState(false);
  const [activeHelpTab,   setActiveHelpTab]   = useState('main');
  const [helpSelected,    setHelpSelected]    = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');
  const [activeSection, setActiveSection] = useState('main');
  const [generateReadme,  setGenerateReadmeState] = useState(
    shared.cpt_generateReadme !== undefined
      ? shared.cpt_generateReadme
      : (settings?.generateReadme !== false)
  );
  const setGenerateReadme = v => {
    setGenerateReadmeState(v);
    onSharedChange('cpt_generateReadme', v);
  };

  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder) setMapsFolderPath(settings.mapsFolder);
    if (shared.cpt_generateReadme === undefined && settings.generateReadme !== undefined) {
      setGenerateReadmeState(settings.generateReadme);
    }
  }, [settings]);

  // ── Library confirm handler ───────────────────────────────────────────────
  const handleLibraryConfirm = (propsWithAdj) => {
    if (!propsWithAdj?.length) return;

    setCustomProps(prev => {
      const next = [...prev];

      propsWithAdj.forEach(prop => {
        const adj = prop.textureAdjustments;
        const hasAdj = adj ? (adjHasChanges(adj) || adj._hasBakedPasses === true) : false;

        const origPath = prop.gamePath || prop.resolvedPath || prop.id;
        const baseName = origPath.split('/').pop()
          .replace(/_prop\.bp$/i, '')
          .replace(/\.bp$/i, '');

        let targetBpPath;
        if (hasAdj) {
          const allUsedPaths = next.map(p => p.targetBpPath);
          let customName = `${baseName}_custom`;
          let candidate  = `/env/props/${customName}/${customName}_prop.bp`;
          let idx = 2;
          while (allUsedPaths.includes(candidate)) {
            customName = `${baseName}_custom_${String(idx).padStart(2, '0')}`;
            candidate  = `/env/props/${customName}/${customName}_prop.bp`;
            idx++;
          }
          targetBpPath = candidate;
        } else {
          targetBpPath = origPath;
        }

        const alreadyExists = next.some(p =>
          p.originalProp?.id === prop.id && p.targetBpPath === targetBpPath
        );
        if (!alreadyExists) {
          next.push({
            id:           Date.now() + Math.random(),
            originalProp: prop,
            adjustments:  hasAdj ? adj : null,
            targetBpPath,
            customName:   null,
            linkedTo:     null,
            linkGroupId:  null,
          });
        }
      });

      return next;
    });

    setShowLibrary(false);
  };

  // Handle new custom prop from AddCustomPropOverlay
  const handleAddCustomPropConfirm = (prop) => {
    setCustomProps(prev => {
      const alreadyExists = prev.some(p => p.originalProp?.id === prop.id);
      if (alreadyExists) return prev;
      return [...prev, {
        id:           Date.now() + Math.random(),
        originalProp: prop,
        adjustments:  null,
        targetBpPath: prop.gamePath,
        customName:   null,
        linkedTo:     null,
        linkGroupId:  null,
      }];
    });
    setActiveSection('main');
  };

  // Rename prop AND update targetBpPath so output files get the new name
  const updateEntryName = (idx, name) => {
    setCustomProps(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      // Always store exactly what the user typed — including empty string.
      // targetBpPath is only updated when a non-empty name exists; otherwise kept as-is.
      if (!e.adjustments) return { ...e, customName: name };
      if (!name) return { ...e, customName: '' }; // keep existing targetBpPath, show placeholder
      const newPath = `/env/props/${name}/${name}_prop.bp`;
      return { ...e, customName: name, targetBpPath: newPath };
    }));
  };

  // ── Link group management ────────────────────────────────────────────────
  // Create a new link group with this prop as source
  const createLinkGroup = (idx) => {
    const groupId = `lg_${Date.now()}`;
    setCustomProps(prev => prev.map((e, i) =>
      i === idx ? { ...e, linkGroupId: groupId } : e
    ));
  };

  // Join an existing link group (as follower)
  const joinLinkGroup = (idx, groupId) => {
    setCustomProps(prev => prev.map((e, i) =>
      i === idx ? { ...e, linkGroupId: groupId || null } : e
    ));
  };

  // Leave/dissolve a link group.
  // If the source leaves, all followers in the same group are also removed from it.
  const leaveGroup = (idx) => {
    setCustomProps(prev => {
      const leaving = prev[idx];
      if (!leaving?.linkGroupId) return prev;
      const gid = leaving.linkGroupId;
      // Check if this is the source (first member)
      const sourceId = prev.find(p => p.linkGroupId === gid)?.id;
      const isSource = sourceId === leaving.id;
      if (isSource) {
        // Dissolve entire group
        return prev.map(e => e.linkGroupId === gid ? { ...e, linkGroupId: null } : e);
      }
      // Just remove self
      return prev.map((e, i) => i === idx ? { ...e, linkGroupId: null } : e);
    });
  };

  const removeEntry = (idx) => {
    setCustomProps(prev => prev.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx > idx) setSelectedIdx(s => s - 1);
  };

  // ── Texture editor confirm — receives array of all props with updated textureAdjustments ──
  const handleTextureEditorConfirm = (updatedProps) => {
    setCustomProps(prev => prev.map(entry => {
      const updated = updatedProps.find(p =>
        p.id === entry.originalProp?.id || p.gamePath === entry.originalProp?.gamePath
      );
      if (!updated) return entry;

      const adj = updated.textureAdjustments;
      const hasAdj = adj ? (adjHasChanges(adj) || adj._hasBakedPasses === true) : false;

      const base = entry.originalProp?.gamePath?.split('/').pop()
        ?.replace(/_prop\.bp$/i, '').replace(/\.bp$/i, '') ?? 'prop';

      let targetBpPath = entry.targetBpPath;
      let customName   = entry.customName;

      if (hasAdj && targetBpPath === (entry.originalProp?.gamePath || entry.originalProp?.id)) {
        const allUsedPaths = prev.filter(p => p.id !== entry.id).map(p => p.targetBpPath);
        let cn = `${base}_custom`;
        let candidate = `/env/props/${cn}/${cn}_prop.bp`;
        let n = 2;
        while (allUsedPaths.includes(candidate)) {
          cn = `${base}_custom_${String(n).padStart(2,'0')}`;
          candidate = `/env/props/${cn}/${cn}_prop.bp`;
          n++;
        }
        targetBpPath = candidate;
        customName   = cn;
      }

      return {
        ...entry,
        adjustments:           hasAdj ? adj : null,
        lodTextureAdjustments: updated.lodTextureAdjustments ?? entry.lodTextureAdjustments ?? undefined,
        targetBpPath,
        customName: customName ?? entry.customName,
      };
    }));
    setShowTextureEditor(false);
  };

  // ── Generate files ────────────────────────────────────────────────────────
  const generateFiles = async () => {
    if (!mapName?.trim()) {
      await luxuryAlert('Please enter a map name!', 'Error', 'error');
      return;
    }

    const mapsFolder = (settings?.mapsFolder || mapsFolderPath || '').trim();
    if (!mapsFolder) {
      await luxuryAlert(
        'No Maps folder configured.\n\nPlease set the Maps Folder in Settings.',
        'Error', 'error'
      );
      return;
    }

    if (customProps.length === 0) {
      await luxuryAlert('No custom props added yet.', 'Nothing to Generate', 'error');
      return;
    }

    // Validate: props with adjustments must have a name set
    const unnamed = customProps.filter(p => p.adjustments && !p.customName?.trim() &&
      !p.targetBpPath.split('/').pop().replace(/_prop\.bp$/i,''));
    // Also check for duplicate names
    const names = customProps.filter(p => p.adjustments).map(p =>
      p.customName?.trim() || p.targetBpPath.split('/').pop().replace(/_prop\.bp$/i,''));
    const dupes = names.filter((n, i) => n && names.indexOf(n) !== i);
    if (dupes.length > 0) {
      await luxuryAlert(`Duplicate prop names:\n${dupes.join(', ')}\n\nEach prop needs a unique name.`, 'Error', 'error');
      return;
    }

    // Determine group sources: for each group, the first prop (lowest array index) is the source
    const groupSources = {};
    customProps.forEach(p => {
      if (p.linkGroupId && !groupSources[p.linkGroupId]) groupSources[p.linkGroupId] = p.id;
    });
    const isGroupFollower = (p) => !!(p.linkGroupId && groupSources[p.linkGroupId] !== p.id);

    // Run for: props with adjustments + group followers (need patched .bp referencing source)
    const opsToRun = customProps.filter(p => p.adjustments || isGroupFollower(p));
    const sourceCount = customProps.filter(p => p.adjustments && !isGroupFollower(p)).length;
    const linkedCount = customProps.filter(p => isGroupFollower(p)).length;

    let finalMapName = mapName.trim();
    if (!finalMapName.match(/\.v\d{4}$/)) finalMapName += '.v0001';

    const confirmed = await luxuryConfirm(
      `Generate ${opsToRun.length} custom prop file set${opsToRun.length !== 1 ? 's' : ''}?\n\n` +
      `• ${sourceCount} with textures, ${linkedCount} linked follower${linkedCount !== 1 ? 's' : ''}\n\n` +
      `Target: ${mapsFolder}\\${finalMapName}\\env\\props\\`,
      'Generate Custom Props', 'Generate', 'Cancel'
    );
    if (!confirmed) return;

    setGenerating(true);
    try {
      if (opsToRun.length > 0) {
        const result = await window.electronAPI.invoke('generate-prop-files', {
          textureOps: opsToRun.map(p => {
            const name = p.customName?.trim() || '';
            const effectiveBpPath = (name && p.adjustments)
              ? `/env/props/${name}/${name}_prop.bp`
              : p.targetBpPath;
            let linkedEntry = null;
            if (p.linkGroupId && isGroupFollower(p)) {
              const srcId = groupSources[p.linkGroupId];
              const src = customProps.find(e => e.id === srcId) || null;
              if (src) {
                const srcName = src.customName?.trim() || '';
                linkedEntry = {
                  ...src,
                  targetBpPath: (srcName && src.adjustments)
                    ? `/env/props/${srcName}/${srcName}_prop.bp`
                    : src.targetBpPath,
                };
              }
            }
            return {
              ...p,
              targetBpPath: effectiveBpPath,
              customName:   name || null,
              linkedTo:     linkedEntry?.id || null,
              linkedEntry,
            };
          }),
          mapsFolder,
          mapName: finalMapName,
        });

        if (!result?.success) {
          const warn = result?.warnings?.join('\n') || result?.error || 'Unknown error';
          const proceed = await luxuryConfirm(
            `Some files had issues:\n\n${warn}\n\nContinue anyway?`,
            'Warning', 'Continue', 'Cancel'
          );
          if (!proceed) return;
        }
      }

      // ── README ──────────────────────────────────────────────────────────────────
      const mapFolderPath = `${mapsFolder}\\${finalMapName}`;
      if (generateReadme) {
        const now      = new Date();
        const dateStr  = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr  = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const divider  = '─'.repeat(70);
        const thick    = '═'.repeat(70);

        // Box header — perfectly aligned
        const BOX_INNER = 38;
        const c1 = 'CUSTOM PROPS — GENERATION README';
        const c2 = 'ForgeMapToolkit · Custom Props Tab';
        const boxTop  = '╔' + '═'.repeat(BOX_INNER) + '╗';
        const boxRow1 = '║  ' + c1 + ' '.repeat(BOX_INNER - 2 - c1.length) + '║';
        const boxRow2 = '║  ' + c2 + ' '.repeat(BOX_INNER - 2 - c2.length) + '║';
        const boxBot  = '╚' + '═'.repeat(BOX_INNER) + '╝';

        // Collect link group info
        const groupSourceMap = {};
        customProps.forEach(p => {
          if (p.linkGroupId && !groupSourceMap[p.linkGroupId]) groupSourceMap[p.linkGroupId] = p.id;
        });
        const linkedGroups = {};
        customProps.forEach(p => {
          if (p.linkGroupId) {
            if (!linkedGroups[p.linkGroupId]) linkedGroups[p.linkGroupId] = [];
            linkedGroups[p.linkGroupId].push(p);
          }
        });

        const lines = [];
        lines.push(boxTop);
        lines.push(boxRow1);
        lines.push(boxRow2);
        lines.push(boxBot);
        lines.push('');
        lines.push(`  Generated  : ${dateStr} at ${timeStr}`);
        lines.push(`  Repository : https://github.com/timmasalme/ForgeMapToolkit`);
        lines.push('');
        lines.push(divider);
        lines.push('  MAP SETTINGS');
        lines.push(divider);
        lines.push(`  Map Name    : ${finalMapName}`);
        lines.push(`  Maps Folder : ${mapsFolder}`);
        lines.push(`  Output Dir  : ${finalMapName}\\env\\props\\`);
        lines.push('');
        lines.push(divider);
        lines.push('  ALBEDO CHANGES (Texture Adjustments per Prop)');
        lines.push(divider);
        const propsWithAdj = customProps.filter(p => p.adjustments);
        if (propsWithAdj.length === 0) {
          lines.push('  (no albedo / texture adjustments configured)');
        } else {
          propsWithAdj.forEach((p, i) => {
            const adj         = p.adjustments;
            const displayName = p.customName?.trim() || p.originalProp?.name || p.targetBpPath.split('/').pop();
            const origPath    = (p.originalProp?.gamePath || p.originalProp?.id || '').split('/').pop();
            lines.push('');
            lines.push(`  [${String(i + 1).padStart(2, '0')}] ${displayName}`);
            lines.push(`       Original source : ${origPath || '—'}`);
            lines.push(`       Output path     : ${p.targetBpPath}`);
            const changes = [];
            if (adj.hue        !== undefined && adj.hue        !== 0)   changes.push(`Hue shift: ${adj.hue}°`);
            if (adj.saturation !== undefined && adj.saturation !== 100) changes.push(`Saturation: ${adj.saturation}%`);
            if (adj.brightness !== undefined && adj.brightness !== 100) changes.push(`Brightness: ${adj.brightness}%`);
            if (adj.contrast   !== undefined && adj.contrast   !== 100) changes.push(`Contrast: ${adj.contrast}%`);
            if (adj.gamma      !== undefined && adj.gamma      !== 100) changes.push(`Gamma: ${adj.gamma}%`);
            if (adj.tint?.opacity > 0)
              changes.push(`Tint: ${adj.tint.color || '#ffffff'} @ ${adj.tint.opacity}% opacity (mode: ${adj.tint.mode || 'normal'})`);
            if (adj.selectiveColor?.enabled)
              changes.push(`Selective color: enabled (${adj.selectiveColor.ranges?.length ?? 0} range(s))`);
            if (adj.selection?.enabled)
              changes.push(`Selection mask: enabled`);
            if (adj._hasBakedPasses)
              changes.push(`Baked texture passes applied`);
            if (changes.length === 0) {
              lines.push('       Albedo changes  : (no tracked changes)');
            } else {
              lines.push('       Albedo changes  :');
              changes.forEach(c => lines.push(`         • ${c}`));
            }
          });
        }
        lines.push('');
        lines.push(divider);
        lines.push('  LINKED PROP GROUPS');
        lines.push(divider);
        const groupIds = Object.keys(linkedGroups);
        if (groupIds.length === 0) {
          lines.push('  (no link groups configured)');
        } else {
          groupIds.forEach((gid, gi) => {
            const group    = linkedGroups[gid];
            const sourceId = groupSourceMap[gid];
            const source   = group.find(p => p.id === sourceId);
            const followers = group.filter(p => p.id !== sourceId);
            lines.push('');
            lines.push(`  Group ${gi + 1}  (ID: ${gid.slice(0, 8)}…)`);
            if (source) {
              const sName = source.customName?.trim() || source.originalProp?.name || '—';
              lines.push(`    Texture source : ${sName}`);
              lines.push(`    Source output  : ${source.targetBpPath}`);
            }
            followers.forEach((f, fi) => {
              const fName = f.customName?.trim() || f.originalProp?.name || '—';
              lines.push(`    Linked [${fi + 1}]     : ${fName}  →  ${f.targetBpPath}`);
            });
            lines.push(`    Members total  : ${group.length} (1 source, ${followers.length} follower${followers.length !== 1 ? 's' : ''})`);
          });
        }
        lines.push('');
        lines.push(divider);
        lines.push('  ALL CUSTOM PROPS');
        lines.push(divider);
        customProps.forEach((p, idx) => {
          const name     = p.customName?.trim() || p.originalProp?.name || '—';
          const hasAdjF  = !!p.adjustments;
          const isSource = groupIds.some(gid => groupSourceMap[gid] === p.id);
          const isFollow = groupIds.some(gid => groupSourceMap[gid] !== p.id && linkedGroups[gid]?.some(e => e.id === p.id));
          const tags = [hasAdjF ? 'custom texture' : 'original', isSource ? 'texture source' : '', isFollow ? 'linked follower' : ''].filter(Boolean).join(', ');
          lines.push(`  [${String(idx + 1).padStart(2, '0')}] ${name}`);
          lines.push(`       Target path : ${p.targetBpPath}`);
          lines.push(`       Tags        : ${tags}`);
        });
        lines.push('');
        lines.push(thick);
        lines.push('  COPYRIGHT');
        lines.push(thick);
        lines.push('');
        lines.push('  Creative Commons Attribution-NonCommercial 4.0 International');
        lines.push('  Copyright (c) 2026 timmasalme');
        lines.push('');
        lines.push('  This file was generated by ForgeMapToolkit for your personal use.');
        lines.push('  You are free to modify these generated files without attribution.');
        lines.push('  The tool itself (ForgeMapToolkit) may not be used commercially.');
        lines.push('');
        lines.push('  Full license: https://creativecommons.org/licenses/by-nc/4.0/legalcode');
        lines.push('');
        lines.push(thick);
        lines.push('  ForgeMapToolkit · https://github.com/timmasalme/ForgeMapToolkit');
        lines.push(thick);

        await window.electronAPI.invoke('write-file', {
          filePath: `${mapFolderPath}\\CustomProps_Generation_README.txt`,
          content:  lines.join('\n'),
        });
      }

      // ── Auto-open export folder ───────────────────────────────────────────────
      const currentSettings = await window.electronAPI.invoke('settings-load');
      if (currentSettings?.autoOpenExportFolder) {
        await window.electronAPI.invoke('open-folder', { folderPath: mapFolderPath });
      }

      await luxuryAlert(
        ` Successfully generated ${opsToRun.length} custom prop set${opsToRun.length !== 1 ? 's' : ''}!\n\n` +
        `Directory: ${mapsFolder}\\${finalMapName}\\env\\props\\` +
        (generateReadme ? '\n\n✓ README written to map folder' : ''),
        'Success', 'success'
      );
    } catch (err) {
      console.error('CustomPropsTab generate error:', err);
      await luxuryAlert(`Error generating files:\n${err.message}`, 'Error', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const selected = selectedIdx !== null ? customProps[selectedIdx] : null;
  const opsCount = customProps.filter(p => {
    if (p.adjustments) return true;
    if (p.linkGroupId) {
      // count followers too so Generate button enables
      const gs = {};
      customProps.forEach(q => { if (q.linkGroupId && !gs[q.linkGroupId]) gs[q.linkGroupId] = q.id; });
      return gs[p.linkGroupId] !== p.id;
    }
    return false;
  }).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cpt-tab">

      {showHelp && (
        <CustomPropsHelpModal
          onClose={() => setShowHelp(false)}
          activeTab={activeHelpTab}
          setActiveTab={(t) => { setActiveHelpTab(t); setHelpSelected(null); }}
          helpSelected={helpSelected}
          setHelpSelected={setHelpSelected}
          activeAdvSubTab={activeAdvSubTab}
          setActiveAdvSubTab={setActiveAdvSubTab}
        />
      )}

      {showLibrary && (
        <PropsLibraryOverlay
          mapName={mapName}
          mapsFolder={mapsFolderPath}
          onConfirm={handleLibraryConfirm}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {showTextureEditor && customProps.length > 0 && (
        <PropTextureEditor
          selectedProps={customProps.map(entry => ({
            ...entry.originalProp,
            lodPreviewUrls:        resolvedLodUrls[entry.id] ?? entry.originalProp?.lodPreviewUrls,
            textureAdjustments:    entry.adjustments          ?? { ...DEFAULT_ADJUSTMENTS },
            lodTextureAdjustments: entry.lodTextureAdjustments ?? undefined,
          }))}
          onConfirm={handleTextureEditorConfirm}
          onBack={() => setShowTextureEditor(false)}
          onClose={() => setShowTextureEditor(false)}
        />
      )}

      {!showLibrary && !showTextureEditor && (
        <button className="help-btn" onClick={() => setShowHelp(!showHelp)} title="Help Guide">?</button>
      )}

      <TabLayout
        sections={[
          { id: 'main', index: '01', label: 'Props', desc: 'Add custom props from library or drag-and-drop, configure textures, then generate.' },
          { id: 'add',  index: '02', label: 'Add Prop', desc: 'Create a new custom prop — drop a folder or fill in details manually to save it to the global library.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        ghostLabel="CUSTOM PROPS"
        railStorageKey="customprops-rail-pinned"
        navLabel="Custom Props navigation"
        previewCaption="PROP DETAIL"
        previewSlot={
          !selected ? (
            <div className="cpt-empty-state">
              <div className="cpt-empty-icon"></div>
              <div className="cpt-empty-title">No Prop Selected</div>
              <div className="cpt-empty-hint">
                Select a prop from the list to view details, sliders and output file passes.
              </div>
            </div>
          ) : (
            <PropDetailPanel entry={selected} />
          )
        }
      >
        {activeSection === 'main' && (
          <>
            <div className="form-group">
              <label className="field-label">Map Name</label>
              <input
                type="text"
                className="field-input"
                value={mapName}
                onChange={e => setMapName(e.target.value)}
                placeholder="e.g. Hades_Dust.v0002"
              />
              {mapName?.trim() && (
                <div className="cpt-form-help">
                  Saves to: /maps/{mapName.trim().match(/\.v\d{4}$/) ? mapName.trim() : mapName.trim() + '.v0001'}/env/props/
                </div>
              )}
            </div>

            <div className="subsection-head" style={{ marginTop: 'var(--space-xl)' }}>
              <span className="subsection-head-title">CUSTOM PROPS</span>
              {customProps.length > 0 && (
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-38)', fontFamily: 'var(--font-mono)' }}>
                  {customProps.length} · {opsCount} with textures
                </span>
              )}
            </div>

            <div className="cpt-props-grid">
              {customProps.map((entry, idx) => {
                const prop = entry.originalProp;
                const hasAdj = !!entry.adjustments;
                const isSelected = selectedIdx === idx;
                const linkedEntry = entry.linkedTo
                  ? customProps.find(e => e.id === entry.linkedTo)
                  : null;
                const isLinkSource = customProps.some(e => e.linkedTo === entry.id);
                const displayName = entry.customName !== null && entry.customName !== undefined
                  ? entry.customName
                  : (prop.name || prop.id);

return (
                <div
                  key={entry.id}
                  className={`cpt-prop-card ${isSelected ? 'selected' : ''} ${linkedEntry ? 'is-linked' : ''} ${isLinkSource ? 'is-link-source' : ''}`}
                  onClick={() => setSelectedIdx(isSelected ? null : idx)}
                  onDoubleClick={() => openTextureEditor()}
                  title="Double-click to edit textures"
                >
                  <div className="cpt-prop-card-header">
                    <div className="cpt-prop-thumb-wrap">
                      {prop.previewUrl ? (
                        <PropPreviewImg className="cpt-prop-thumb" src={prop.previewUrl} alt={displayName} />
                      ) : (
                        <div className="cpt-prop-thumb-placeholder"></div>
                      )}
                      {hasAdj && <div className="cpt-prop-adj-dot" />}
                      {linkedEntry && <div className="cpt-prop-link-dot" title={`Links textures from: ${linkedEntry.customName || linkedEntry.originalProp?.name}`}></div>}
                    </div>

                    <div className="cpt-prop-card-info">
                      <input
                        className="cpt-prop-name-input"
                        value={entry.customName ?? ''}
                        title="Rename — also renames output files"
                        onClick={e => e.stopPropagation()}
                        onDoubleClick={e => e.stopPropagation()}
                        onChange={e => updateEntryName(idx, e.target.value)}
                        placeholder={prop.name || prop.id}
                      />
                      <span className="cpt-prop-card-meta">
                        {hasAdj
                          ? entry.targetBpPath.split('/').pop()
                          : (prop.gamePath || prop.id).split('/').pop()}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        <span className={`cpt-prop-badge ${hasAdj ? 'custom' : ''}`}>
                          {hasAdj ? 'custom texture' : 'original'}
                        </span>
                        {isLinkSource && (
                          <span className="cpt-prop-badge link-source"> texture source</span>
                        )}
                      </div>

                      <LinkGroupRow
                        entry={entry}
                        idx={idx}
                        allProps={customProps}
                        onCreateGroup={() => createLinkGroup(idx)}
                        onJoinGroup={(gid) => joinLinkGroup(idx, gid)}
                        onLeave={() => leaveGroup(idx)}
                      />
                    </div>

                    <button
                      className="cpt-btn-delete-small"
                      onClick={e => { e.stopPropagation(); removeEntry(idx); }}
                      title="Remove"
                    >×</button>
                  </div>
                </div>
              );
            })}

              <div className="ec-add-tile" onClick={() => setShowLibrary(true)}>
                <div className="ec-add-tile-icon">+</div>
                <span className="ec-add-tile-label">ADD FROM LIBRARY</span>
              </div>
            </div>

            {!mapName?.trim() && opsCount > 0 && (
              <div className="cpt-warn-box">
                 A map name must be set before generating.
              </div>
            )}

            <div className="subsection-head" style={{ marginTop: 'var(--space-xl)' }}>
              <span className="subsection-head-title">EXPORT</span>
            </div>

            <label className="checkbox-label" style={{ marginBottom: '20px' }} onClick={() => setGenerateReadme(v => !v)}>
              <div className={`checkbox${generateReadme ? ' checked' : ''}`}>
                {generateReadme && (
                  <svg className="checkbox-check" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="1.5,5 4.5,8.5 10.5,1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="checkbox-text">Generate README file</span>
            </label>

            <button
              className="commit-button"
              onClick={generateFiles}
              disabled={generating || opsCount === 0 || !mapName?.trim()}
            >
              <span className="commit-button-label">{generating ? 'GENERATING…' : 'GENERATE FILES'}</span>
              <span className="commit-button-status">Custom Props</span>
              <span className="commit-button-bloom" />
              <span className="commit-button-line" />
            </button>
          </>
        )}

        {activeSection === 'add' && (
          <AddCustomPropOverlay
            inline
            onConfirm={handleAddCustomPropConfirm}
            onSaved={() => setActiveSection('main')}
            onClose={() => setActiveSection('main')}
          />
        )}
      </TabLayout>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PropDetailPanel — shown in right column when a prop is selected
// ────────────────────────────────────────────────────────────────────────────
function PropDetailPanel({ entry }) {
  const { originalProp, adjustments, targetBpPath } = entry;
  const hasAdj = !!adjustments;

  const origPath = originalProp.gamePath || originalProp.resolvedPath || originalProp.id;
  const origDir  = origPath.replace(/\/[^/]+$/, '');
  const origBase = origPath.split('/').pop().replace(/_prop\.bp$/i, '').replace(/\.bp$/i, '');

  const customDir  = hasAdj ? targetBpPath.replace(/\/[^/]+$/, '') : null;
  const customBase = hasAdj ? targetBpPath.split('/').pop().replace(/_prop\.bp$/i, '') : null;

  const FILE_TYPES = [
    { ext: '_prop.bp',       label: 'Blueprint',   icon: '' },
    { ext: '_lod0.scm',      label: 'Mesh',        icon: '' },
    { ext: '_albedo.dds',    label: 'Albedo',      icon: '' },
    { ext: '_normalsTS.dds', label: 'Normal Map',  icon: '' },
  ];

  const SLIDERS = [
    { key: 'hue',        label: 'Hue',        min: 0,   max: 360, defaultVal: 0,   unit: '°' },
    { key: 'saturation', label: 'Saturation', min: 0,   max: 200, defaultVal: 100, unit: '%' },
    { key: 'brightness', label: 'Brightness', min: 0,   max: 200, defaultVal: 100, unit: '%' },
    { key: 'contrast',   label: 'Contrast',   min: 0,   max: 200, defaultVal: 100, unit: '%' },
    { key: 'gamma',      label: 'Gamma',      min: 0,   max: 200, defaultVal: 100, unit: '%' },
  ];

  return (
    <>
      {/* Header */}
      <div className="cpt-detail-header">
        {originalProp.previewUrl ? (
          <PropPreviewImg className="cpt-detail-thumb" src={originalProp.previewUrl} alt={originalProp.name} />
        ) : (
          <div className="cpt-detail-thumb-placeholder"></div>
        )}
        <div className="cpt-detail-title-wrap">
          <div className="cpt-detail-name">{originalProp.name || originalProp.id}</div>
          <div className="cpt-detail-path">{targetBpPath}</div>
          {(originalProp.biome || originalProp.source) && (
            <div className="cpt-detail-meta">
              {originalProp.biome && <span>Biome: <strong>{originalProp.biome}</strong></span>}
              {originalProp.biome && originalProp.source && <span> · </span>}
              {originalProp.source && <span>Source: <strong>{originalProp.source}</strong></span>}
            </div>
          )}
        </div>
        {hasAdj && <div className="cpt-adj-indicator"> Custom Texture</div>}
      </div>

      <div className="cpt-detail-scroll">

        {/* ── Texture Adjustments ── */}
        {hasAdj && (
          <div className="cpt-detail-section">
            <h3 className="cpt-detail-section-title">
              <span className="cpt-section-icon small"></span>
              TEXTURE ADJUSTMENTS
            </h3>
            <div className="cpt-sliders">
              {SLIDERS.map(({ key, label, min, max, defaultVal, unit }) => {
                const value = adjustments[key] ?? defaultVal;
                const pct = ((value - min) / (max - min)) * 100;
                const defaultPct = ((defaultVal - min) / (max - min)) * 100;
                const fillLeft  = Math.min(pct, defaultPct);
                const fillWidth = Math.abs(pct - defaultPct);
                const isChanged = value !== defaultVal;
                const display = unit === '°' && value > 0 ? `+${value}°` : `${value}${unit}`;
                return (
                  <div key={key} className="cpt-slider-row">
                    <div className="cpt-slider-header">
                      <span className="cpt-slider-label">{label}</span>
                      <span className="cpt-slider-val"
                        style={{ color: isChanged ? 'var(--cpt-accent)' : 'rgba(255,255,255,0.35)' }}>
                        {display}
                      </span>
                    </div>
                    <div className="cpt-slider-track-wrap">
                      <div className="cpt-slider-track" />
                      <div className="cpt-slider-fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} />
                      <input type="range" className="cpt-slider-input"
                        min={min} max={max} value={value} readOnly onChange={() => {}} />
                    </div>
                  </div>
                );
              })}
              {(adjustments.tint?.opacity > 0 || adjustments.selectiveColor?.enabled || adjustments.selection?.enabled) && (
                <div className="cpt-badge-row">
                  {adjustments.tint?.opacity > 0 && (
                    <span className="cpt-prop-badge custom">Tint · {adjustments.tint.opacity}%</span>
                  )}
                  {adjustments.selectiveColor?.enabled && (
                    <span className="cpt-prop-badge custom">Selective Color</span>
                  )}
                  {adjustments.selection?.enabled && (
                    <span className="cpt-prop-badge custom">Color Selection</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pass 1: Original files ── */}
        <div className="cpt-detail-section">
          <h3 className="cpt-detail-section-title">
            <span className="cpt-section-icon small"></span>
            PASS 1 — ORIGINAL
            <span className="cpt-prop-badge" style={{ marginLeft: 8 }}>source</span>
          </h3>
          <div className="cpt-pass-dir">{origDir}/</div>
          <div className="cpt-pass-files">
            {FILE_TYPES.map(f => (
              <div key={f.ext} className="cpt-pass-file">
                <span className="cpt-pass-file-icon">{f.icon}</span>
                <div className="cpt-pass-file-info">
                  <span className="cpt-pass-file-name">{origBase}{f.ext}</span>
                  <span className="cpt-pass-file-label">{f.label} · game source</span>
                </div>
              </div>
            ))}
          </div>
          <div className="cpt-pass-note">Read-only game files — used as source for texture generation</div>
        </div>

        {/* ── Pass 2: Custom generated files (only if adjustments) ── */}
        {hasAdj && (
          <div className="cpt-detail-section">
            <h3 className="cpt-detail-section-title">
              <span className="cpt-section-icon small"></span>
              PASS 2 — CUSTOM (GENERATED)
              <span className="cpt-prop-badge custom" style={{ marginLeft: 8 }}>output</span>
            </h3>
            <div className="cpt-pass-dir cpt-pass-dir-custom">{customDir}/</div>
            <div className="cpt-pass-files">
              {[
                { ext: '_prop.bp',       label: 'Blueprint',           icon: '' },
                { ext: '_lod0.scm',      label: 'Mesh (copied)',        icon: '' },
                { ext: '_albedo.dds',    label: 'Albedo (adjusted)',    icon: '' },
                { ext: '_normalsTS.dds', label: 'Normal Map (copied)',  icon: '' },
              ].map(f => (
                <div key={f.ext} className="cpt-pass-file custom">
                  <span className="cpt-pass-file-icon">{f.icon}</span>
                  <div className="cpt-pass-file-info">
                    <span className="cpt-pass-file-name">{customBase}{f.ext}</span>
                    <span className="cpt-pass-file-label">{f.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="cpt-pass-note cpt-pass-note-custom">
              Written to map directory with texture adjustments applied
            </div>
          </div>
        )}

        {/* No-adjustment note */}
        {!hasAdj && (
          <div className="cpt-detail-section">
            <div className="cpt-info-card">
              <span className="cpt-info-icon">i</span>
              <span className="cpt-info-text">
                No texture adjustments — this prop uses <strong>original game files</strong> directly.
                No files will be generated; the blueprint path above is referenced as-is.
              </span>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
// ────────────────────────────────────────────────────────────────────────────
// LinkGroupRow — shown inside each prop card to manage link groups
// ────────────────────────────────────────────────────────────────────────────
function LinkGroupRow({ entry, idx, allProps, onCreateGroup, onJoinGroup, onLeave }) {
  // Build group map: groupId -> first prop in that group (the source)
  const groupSources = {};
  allProps.forEach(p => {
    if (p.linkGroupId && !groupSources[p.linkGroupId]) groupSources[p.linkGroupId] = p;
  });

  const myGroup   = entry.linkGroupId || null;
  const isSource  = myGroup && groupSources[myGroup]?.id === entry.id;
  const isFollower = myGroup && !isSource;
  const sourceEntry = isFollower ? groupSources[myGroup] : null;

  // Groups this prop could join (groups started by other props, not already in)
  const joinableGroups = Object.entries(groupSources)
    .filter(([gid, src]) => src.id !== entry.id)
    .map(([gid, src]) => ({ gid, src }));

  if (!myGroup) {
    // Not in any group yet
    return (
      <div className="cpt-link-row" onClick={e => e.stopPropagation()}>
        <button className="cpt-btn-add-link" onClick={onCreateGroup} title="Start a new link group — other props can then follow this prop's textures">
          + Add Link
        </button>
        {joinableGroups.length > 0 && (
          <select
            className="cpt-link-select"
            defaultValue=""
            onClick={e => e.stopPropagation()}
            onChange={e => {
              e.stopPropagation();
              const gid = e.target.value;
              if (gid) onJoinGroup(gid);
              e.target.value = '';
            }}
          >
            <option value="">Join group…</option>
            {joinableGroups.map(({ gid, src }) => (
              <option key={gid} value={gid}>
                {src.customName || src.originalProp?.name}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  if (isSource) {
    // This prop is the source of a group
    const followers = allProps.filter(p => p.linkGroupId === myGroup && p.id !== entry.id);
    return (
      <div className="cpt-link-row" onClick={e => e.stopPropagation()}>
        <span className="cpt-link-source-badge"> source</span>
        {followers.length > 0 && (
          <span className="cpt-link-followers">
            → {followers.map(f => f.customName || f.originalProp?.name).join(', ')}
          </span>
        )}
        <button
          className="cpt-btn-unlink-inline"
          title="Dissolve group (removes all members)"
          onClick={() => {
            // Remove everyone from this group
            onLeave(); // just leave — caller can handle dissolve
          }}
        >×</button>
      </div>
    );
  }

  if (isFollower) {
    // This prop follows another
    return (
      <div className="cpt-link-row" onClick={e => e.stopPropagation()}>
        <span className="cpt-link-label"></span>
        <span className="cpt-link-source-name">
          {sourceEntry?.customName || sourceEntry?.originalProp?.name || '?'}
        </span>
        <button
          className="cpt-btn-unlink-inline"
          title="Leave group"
          onClick={onLeave}
        >×</button>
      </div>
    );
  }

  return null;
}
// ════════════════════════════════════════════════════════════════════════════
// CustomPropsHelpModal
// ════════════════════════════════════════════════════════════════════════════
