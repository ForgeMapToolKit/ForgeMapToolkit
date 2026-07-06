import React, { useCallback } from 'react';
import './SlatRow.css';

/**
 * SlatRow — a single sub-item line in the left zone of NavbarPanel.
 *
 * ── Structure ────────────────────────────────────────────────────────────────
 *  [ tick (2px, --tab-color of the sub-item) ] [ index ] [ label ]
 *
 * Consistent with the existing Slat / SlatColumn system on the home screen,
 * adapted for horizontal panel layout instead of vertical rail.
 *
 * Hover: tick ignites electrically, label steps to --ink-92.
 * Active (current section): tick stays lit at reduced opacity as structural
 * signal, label at full white — same restraint contract as the navbar bar.
 *
 * Coming-soon items: dimmed, inert, SOON badge appended.
 *
 * Props:
 *  item       — toolRegistry entry (id, label, index, colorVar, status, …)
 *  isActive   — boolean: this item is the current active section
 *  onHover(item) — pointer entered: send the item to NavbarPanel for Register
 *  onLeave()    — pointer left
 *  onSelect(id) — click: navigate to this tool
 */

const SlatRow = ({ item, isActive, onHover, onLeave, onSelect }) => {
  const comingSoon = item.status === 'coming-soon';

  const handleMouseEnter = useCallback(() => {
    if (!comingSoon) onHover(item);
  }, [item, comingSoon, onHover]);

  const handleClick = useCallback(() => {
    if (!comingSoon) onSelect(item.id);
  }, [item.id, comingSoon, onSelect]);

  return (
    <li
      className={[
        'sr-row',
        isActive    ? 'sr-row--active' : '',
        comingSoon  ? 'sr-row--soon'   : '',
      ].filter(Boolean).join(' ')}
      style={{ '--sr-color': item.color, '--sr-glow': item.glow }}
    >
      <button
        className="sr-btn"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onLeave}
        disabled={comingSoon}
        tabIndex={comingSoon ? -1 : 0}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Tick — 2px vertical bar in the item's --tab-color */}
        <span className="sr-tick" aria-hidden="true" />

        {/* Index designation */}
        <span className="sr-index">{item.index}</span>

        {/* Label */}
        <span className="sr-label">{item.label.toUpperCase()}</span>

        {/* Coming-soon badge */}
        {comingSoon && <span className="sr-soon-badge">SOON</span>}
      </button>
    </li>
  );
};

export default SlatRow;
