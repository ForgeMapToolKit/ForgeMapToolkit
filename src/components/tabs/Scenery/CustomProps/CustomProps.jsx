import React, { useState, useEffect } from 'react';
import AddCustomProp from './AddCustomProp';
import '../../../Shared/shared.css';
import '../../../Shared/trace.css';
import './CustomProps.css';
import { luxuryAlert, luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import PropsLibraryOverlay from '../../../Shared/Libraries/PropsLibrary/PropsLibrary';
import { adjHasChanges, DEFAULT_ADJUSTMENTS } from './TextureEditor/TextureAdjustModal';
import TextureEditor from './TextureEditor/TextureEditor';
import CustomPropsHelpModal from '../../HelpModals/CustomProps_help.jsx';
import TabLayout from '../../../Shared/Ui/TabLayout/TabLayout';
import { usePersistentState, useMapInfo } from '../../../Shared/MapLogic';
import CustomPropsConfiguration from './Configuration.jsx';
import PropList from './PropList.jsx';
import PropDetail from './PropDetail.jsx';
import CustomPropsExport from './Export.jsx';

// ════════════════════════════════════════════════════════════════════════════
export default function CustomPropsTab({ settings, shared = {}, onSharedChange = () => {} }) {

  // ── Persisted state ──────────────────────────────────────────────────────
  const [mapName,        setMapName]        = usePersistentState(shared, 'cpt_mapName', '', onSharedChange);
  const [mapsFolderPath, setMapsFolderPath]  = usePersistentState(shared, 'cpt_mapsFolderPath', settings?.mapsFolder ?? '', onSharedChange);
  const [customProps,    setCustomProps]     = usePersistentState(shared, 'cpt_customProps', [], onSharedChange);
  const [generateReadme, setGenerateReadme]  = usePersistentState(
    shared, 'cpt_generateReadme',
    shared.cpt_generateReadme !== undefined ? shared.cpt_generateReadme : (settings?.generateReadme !== false),
    onSharedChange
  );

  const [selectedIdx, setSelectedIdx] = useState(null);
  const [activeSection, setActiveSection] = useState('props');

  const { mapInfo } = useMapInfo({ mapName, mapsFolderPath, settings });

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

  const [showHelp,        setShowHelp]        = useState(false);
  const [activeHelpTab,   setActiveHelpTab]   = useState('main');
  const [helpSelected,    setHelpSelected]    = useState(null);
  const [activeAdvSubTab, setActiveAdvSubTab] = useState('workflow');

  useEffect(() => {
    if (!settings) return;
    if (settings.mapsFolder) setMapsFolderPath(settings.mapsFolder);
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
    setActiveSection('props');
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
    <div className="cpt-tab trace-tab">

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
        <TextureEditor
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
          { id: 'props',  index: '01', label: 'Props',    desc: 'Set the target map, then add custom props from library or drag-and-drop and configure textures.', count: customProps.length || undefined },
          { id: 'export', index: '02', label: 'Export',   desc: 'Choose export options and generate the custom prop file sets.' },
          { id: 'add',    index: '03', label: 'Add Prop', desc: 'Create a new custom prop — drop a folder or fill in details manually to save it to the global library.' },
        ]}
        activeSection={activeSection}
        onSelect={setActiveSection}
        railStorageKey="customprops-rail-pinned"
        navLabel="Custom Props navigation"
        asideCaption="PROP DETAIL"
        asideSlot={
          !selected ? (
            <div className="cpt-empty-state">
              <div className="cpt-empty-title">No Prop Selected</div>
              <div className="cpt-empty-hint">
                Select a prop from the list to view details, sliders and output file passes.
              </div>
            </div>
          ) : (
            <PropDetail entry={selected} />
          )
        }
      >
        {activeSection === 'props' && (
          <div className="ctrl-col">
            <CustomPropsConfiguration
              mapName={mapName}
              setMapName={setMapName}
              mapInfo={mapInfo}
            />
            <PropList
              customProps={customProps}
              selectedIdx={selectedIdx}
              setSelectedIdx={setSelectedIdx}
              opsCount={opsCount}
              updateEntryName={updateEntryName}
              removeEntry={removeEntry}
              openTextureEditor={openTextureEditor}
              createLinkGroup={createLinkGroup}
              joinLinkGroup={joinLinkGroup}
              leaveGroup={leaveGroup}
              onAddFromLibrary={() => setShowLibrary(true)}
            />
          </div>
        )}

        {activeSection === 'export' && (
          <CustomPropsExport
            mapName={mapName}
            opsCount={opsCount}
            generating={generating}
            generateFiles={generateFiles}
            generateReadme={generateReadme}
            setGenerateReadme={setGenerateReadme}
          />
        )}

        {activeSection === 'add' && (
          <AddCustomProp
            inline
            onConfirm={handleAddCustomPropConfirm}
            onSaved={() => setActiveSection('props')}
            onClose={() => setActiveSection('props')}
          />
        )}
      </TabLayout>
    </div>
  );
}
