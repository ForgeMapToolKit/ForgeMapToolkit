import React from 'react';
import ToolSlat from './ToolSlat.jsx';
import { CATEGORIES, getToolsByCategory } from '../data/toolRegistry.js';

/**
 * ToolRail — fixed-geometry bottom selector of the TRACE system.
 *
 * Full 184px height. Category label floats top-left as a ghost caption.
 * Slats fill the full rail height — hover lifts the whole column.
 *
 * Props:
 *  - activeToolId:    currently focused/hovered tool id (null = none)
 *  - onSelect(id):    navigate to a tool
 *  - onToolFocus(id): hover intent for ProjectionStage
 *  - onToolBlur():    pointer left any slat
 */
const ToolRail = ({ activeToolId, onSelect, onToolFocus, onToolBlur }) => {
  const railCategories = CATEGORIES.filter(c =>
    ['emitter', 'generator', 'skybox', 'tools', 'community', 'config'].includes(c.key)
  );

  return (
    <nav className="hs-rail">
      {railCategories.map(({ key, navLabel, homeLabel }) => {
        const tools = getToolsByCategory(key).filter(t => t.status !== 'coming-soon');
        if (!tools.length) return null;
        return (
          <div key={key} className="hs-rail-group">
            {/* Ghost category label — absolute, fades in on group hover */}
            <span className="hs-rail-group-label">
              {(navLabel || homeLabel || key).toUpperCase()}
            </span>
            {/* Slats — full height */}
            <div className="hs-rail-slats">
              {tools.map(tool => (
                <ToolSlat
                  key={tool.id}
                  tool={tool}
                  active={activeToolId === tool.id}
                  onSelect={onSelect}
                  onFocus={onToolFocus}
                  onBlur={onToolBlur}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export default ToolRail;
