import React from 'react';
import { EntityCard, EntityCardGrid, AddTile } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';
import PropPreviewImg from './PropPreviewImg.jsx';

// ────────────────────────────────────────────────────────────────────────────
// LinkGroupRow — shown inside each prop card to manage link groups
// ────────────────────────────────────────────────────────────────────────────
function LinkGroupRow({ entry, allProps, onCreateGroup, onJoinGroup, onLeave }) {
  // Build group map: groupId -> first prop in that group (the source)
  const groupSources = {};
  allProps.forEach(p => {
    if (p.linkGroupId && !groupSources[p.linkGroupId]) groupSources[p.linkGroupId] = p;
  });

  const myGroup    = entry.linkGroupId || null;
  const isSource   = myGroup && groupSources[myGroup]?.id === entry.id;
  const isFollower = myGroup && !isSource;
  const sourceEntry = isFollower ? groupSources[myGroup] : null;

  // Groups this prop could join (groups started by other props, not already in)
  const joinableGroups = Object.entries(groupSources)
    .filter(([, src]) => src.id !== entry.id)
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
        <span className="cpt-link-source-badge">source</span>
        {followers.length > 0 && (
          <span className="cpt-link-followers">
            → {followers.map(f => f.customName || f.originalProp?.name).join(', ')}
          </span>
        )}
        <button
          className="cpt-btn-unlink-inline"
          title="Dissolve group (removes all members)"
          onClick={onLeave}
        >×</button>
      </div>
    );
  }

  // isFollower
  return (
    <div className="cpt-link-row" onClick={e => e.stopPropagation()}>
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

// ────────────────────────────────────────────────────────────────────────────
// PropList — the prop card grid (Props section)
// ────────────────────────────────────────────────────────────────────────────
export default function PropList({
  customProps, selectedIdx, setSelectedIdx,
  opsCount,
  updateEntryName, removeEntry, openTextureEditor,
  createLinkGroup, joinLinkGroup, leaveGroup,
  onAddFromLibrary,
}) {
  return (
    <>
      <div className="ctrl-block">
        <div className="ctrl-subtitle">
          Custom Props
          {customProps.length > 0 && (
            <span className="cpt-count-badge">{customProps.length} · {opsCount} with textures</span>
          )}
        </div>
        <div className="ctrl-content">

          <EntityCardGrid>
            {customProps.map((entry, idx) => {
              const prop = entry.originalProp;
              const hasAdj = !!entry.adjustments;
              const isSelected = selectedIdx === idx;
              const linkedEntry = entry.linkedTo
                ? customProps.find(e => e.id === entry.linkedTo)
                : null;
              const isLinkSource = customProps.some(e => e.linkedTo === entry.id);

              return (
                <EntityCard
                  key={entry.id}
                  index={idx}
                  color="var(--tab-color)"
                  selected={isSelected}
                  onSelect={() => setSelectedIdx(isSelected ? null : idx)}
                  onDelete={() => removeEntry(idx)}
                  title={
                    <input
                      className="cpt-prop-name-input"
                      value={entry.customName ?? ''}
                      title="Rename — also renames output files"
                      onClick={e => e.stopPropagation()}
                      onDoubleClick={e => e.stopPropagation()}
                      onChange={e => updateEntryName(idx, e.target.value)}
                      placeholder={prop.name || prop.id}
                    />
                  }
                >
                  <div
                    className={`cpt-card-body${linkedEntry ? ' is-linked' : ''}${isLinkSource ? ' is-link-source' : ''}`}
                    onDoubleClick={() => openTextureEditor()}
                    title="Double-click to edit textures"
                  >
                    <div className="cpt-prop-thumb-wrap">
                      {prop.previewUrl ? (
                        <PropPreviewImg className="cpt-prop-thumb" src={prop.previewUrl} alt={prop.name || prop.id} />
                      ) : (
                        <div className="cpt-prop-thumb-placeholder" />
                      )}
                      {hasAdj && <div className="cpt-prop-adj-dot" />}
                      {linkedEntry && <div className="cpt-prop-link-dot" title={`Links textures from: ${linkedEntry.customName || linkedEntry.originalProp?.name}`} />}
                    </div>

                    <div className="cpt-prop-card-info">
                      <span className="cpt-prop-card-meta">
                        {hasAdj
                          ? entry.targetBpPath.split('/').pop()
                          : (prop.gamePath || prop.id).split('/').pop()}
                      </span>
                      <div className="cpt-badge-row">
                        <span className={`cpt-prop-badge${hasAdj ? ' custom' : ''}`}>
                          {hasAdj ? 'custom texture' : 'original'}
                        </span>
                        {isLinkSource && (
                          <span className="cpt-prop-badge link-source">texture source</span>
                        )}
                      </div>

                      <LinkGroupRow
                        entry={entry}
                        allProps={customProps}
                        onCreateGroup={() => createLinkGroup(idx)}
                        onJoinGroup={(gid) => joinLinkGroup(idx, gid)}
                        onLeave={() => leaveGroup(idx)}
                      />
                    </div>
                  </div>
                </EntityCard>
              );
            })}

            <AddTile label="ADD FROM LIBRARY" onClick={onAddFromLibrary} />
          </EntityCardGrid>

        </div>
      </div>
    </>
  );
}
