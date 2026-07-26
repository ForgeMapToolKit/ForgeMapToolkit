import React from 'react';
import { luxuryConfirm } from '../../../Shared/Ui/Notifications/notifications';
import { EntityCard, EntityCardGrid, AddTile, CoordinateList, EmitterToggleBlock } from '../../../Shared/Ui/EntityPanel/EntityPanel.jsx';

const propLabelOf = (p, i) => p.propName?.toUpperCase() || `Prop ${i + 1}`;

export default function PropsPropList({
  props, selectedProp, setSelectedProp,
  availableColors, showColorPicker, setShowColorPicker,
  coordsOpen, setCoordsOpen,
  handleOpenPropsImport, propsImportLoading,
  deleteAllProps, addProp, deleteProp, updatePropColor, updatePropName,
  updateBlueprintPath, deleteBlueprintPath, onOpenBlueprintLibrary,
  addCoordinate, updateCoordinate, deleteCoordinate, deleteAllCoordinates,
  // Emitter props
  configuredEmitters,
  getEmitterName,
  onToggleUnitEmitter,
  onSetUnitSource,
  onClearUnitSource,
  onSetUnitIsSource,
}) {
  return (
    <div className="ctrl-col">
      <div className="ctrl-block">
        <div className="ctrl-subtitle">Props</div>
        <div className="ctrl-content">

          <div className="ctrl-action-row" style={{ justifyContent: 'space-between' }}>
            <button className="ctrl-btn-add" onClick={handleOpenPropsImport} disabled={propsImportLoading}>
              {propsImportLoading ? '…' : 'Import from Map'}
            </button>
            {props.length >= 1 && (
              <button className="ctrl-btn-danger" onClick={deleteAllProps}>Delete All</button>
            )}
          </div>

          <EntityCardGrid>
            {props.map((prop, propIdx) => (
              <EntityCard
                key={prop.id}
                index={propIdx}
                color={prop.color}
                selected={propIdx === selectedProp}
                onSelect={() => setSelectedProp(propIdx)}
                onDelete={() => deleteProp(propIdx)}
                title={prop.propName ? prop.propName.toUpperCase() : `Prop ${propIdx + 1}`}
                availableColors={availableColors}
                showColorPicker={showColorPicker === propIdx}
                onToggleColorPicker={() => setShowColorPicker(showColorPicker === propIdx ? null : propIdx)}
                onPickColor={(color) => { updatePropColor(propIdx, color); setShowColorPicker(null); }}
              >
                {propIdx === selectedProp && (<>

                  {/* Prop Name */}
                  <div className="ctrl-field">
                    <input
                      type="text"
                      className="ctrl-input ctrl-input--text"
                      value={prop.propName}
                      onChange={(e) => updatePropName(propIdx, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. lava_tree01"
                    />
                  </div>

                  {/* Blueprint Paths */}
                  <div style={{ marginTop: 'var(--space-xl)' }} onClick={e => e.stopPropagation()}>
                    <div className="trace-subsection">Blueprint Paths</div>
                    <div className="ctrl-row-gap" style={{ marginTop: 'var(--space-sm)' }}>
                      {prop.blueprintPaths.map((path, pathIdx) => (
                        <div key={pathIdx} className="ctrl-row">
                          <input
                            type="text"
                            className="ctrl-input"
                            value={path}
                            onChange={(e) => updateBlueprintPath(propIdx, pathIdx, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp"
                          />
                          <button className="ctrl-btn-delete" onClick={() => deleteBlueprintPath(propIdx, pathIdx)}>×</button>
                        </div>
                      ))}
                    </div>
                    <div className="ctrl-action-row" style={{ marginTop: 'var(--space-sm)' }}>
                      <button className="ftr-preview-readmore" onClick={(e) => { e.stopPropagation(); onOpenBlueprintLibrary(propIdx); }}>Library</button>
                    </div>
                  </div>

                  {/* Emitter block — replaces Categories */}
                  <EmitterToggleBlock
                    entity={prop}
                    entityIdx={propIdx}
                    allEntities={props}
                    configuredEmitters={configuredEmitters}
                    getEmitterName={getEmitterName}
                    labelOf={propLabelOf}
                    onToggleEmitter={onToggleUnitEmitter}
                    onSetSource={onSetUnitSource}
                    onClearSource={onClearUnitSource}
                    onSetIsSource={onSetUnitIsSource}
                  />

                  {/* Coordinates */}
                  <div style={{ marginTop: 'var(--space-xl)' }}>
                    <CoordinateList
                      coordinates={prop.coordinates}
                      fields={[[
                        { key: 'x', label: 'X', placeholder: '256' },
                        { key: 'y', label: 'Y', placeholder: '26' },
                        { key: 'z', label: 'Z', placeholder: '256' },
                      ]]}
                      open={!!coordsOpen[propIdx]}
                      onToggle={() => setCoordsOpen(prev => ({ ...prev, [propIdx]: !prev[propIdx] }))}
                      labelFor={(coord, ci) => `Point ${ci + 1}${coord.isMirrored ? ' · mirror' : ''}`}
                      onUpdate={(ci, key, value) => updateCoordinate(propIdx, ci, key, value)}
                      onDelete={(ci) => deleteCoordinate(propIdx, ci)}
                      onAdd={() => addCoordinate(propIdx)}
                      hasPlaced={prop.coordinates.some(c => c.x && c.z)}
                      onDeleteAll={async () => {
                        const ok = await luxuryConfirm('Delete all coordinates for this prop?', 'Confirm Delete', 'Delete All', 'Cancel');
                        if (ok) deleteAllCoordinates(propIdx);
                      }}
                    />
                  </div>

                </>)}
              </EntityCard>
            ))}
            <AddTile label="Add Prop Type" onClick={addProp} />
          </EntityCardGrid>

        </div>
      </div>
    </div>
  );
}
