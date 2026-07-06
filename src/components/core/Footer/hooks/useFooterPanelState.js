import { useState, useEffect } from 'react';

/**
 * useFooterPanelState
 *
 * Owns the three interdependent pieces of panel state:
 *   - expanded      : whether the footer drawer is open
 *   - panelMode     : 'nav' | 'preview' — which stage view is shown
 *   - activeArticle : the footerContentRegistry entry currently previewed (or null)
 *
 * Also wires the Escape-key listener that collapses the panel while it is open,
 * and resets panelMode → 'nav' / activeArticle → null whenever the panel closes
 * so re-opening always starts at the nav columns.
 *
 * @param {object}   params
 * @param {boolean}  params.initialExpanded   - seed value (default false)
 * @returns {{
 *   expanded: boolean,
 *   setExpanded: function,
 *   panelMode: 'nav'|'preview',
 *   setPanelMode: function,
 *   activeArticle: object|null,
 *   setActiveArticle: function,
 * }}
 */
export function useFooterPanelState({ initialExpanded = false } = {}) {
  const [expanded,       setExpanded]       = useState(initialExpanded);
  const [panelMode,      setPanelMode]      = useState('nav');
  const [activeArticle,  setActiveArticle]  = useState(null);

  // Collapsing always resets to nav so the next open starts fresh
  useEffect(() => {
    if (!expanded) {
      setPanelMode('nav');
      setActiveArticle(null);
    }
  }, [expanded]);

  // Escape closes the panel while it's open
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  return {
    expanded,
    setExpanded,
    panelMode,
    setPanelMode,
    activeArticle,
    setActiveArticle,
  };
}
