import React from 'react';
import { NAV_COLS } from './navColumns.js';
import './FooterNav.css';

/**
 * FooterNav
 *
 * Purely presentational: renders the four nav columns.
 * All logic (which action was clicked, routing to preview vs. tab) lives in
 * the Footer.jsx parent and arrives via onNavAction.
 *
 * @param {object}   props
 * @param {function} props.onNavAction - called with item.action string on button click
 */
function FooterNav({ onNavAction }) {
  return (
    <div className="ftr-nav">
      {NAV_COLS.map((col, i) => (
        <React.Fragment key={col.label}>
          {i > 0 && <div className="ftr-col-divider" aria-hidden="true" />}
          <div className="ftr-col">
            <div className="ftr-col-label">{col.label}</div>
            <ul className="ftr-col-links">
              {col.items.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="ftr-link"
                      target={item.extern ? '_blank' : undefined}
                      rel={item.extern ? 'noreferrer' : undefined}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <button
                      className="ftr-link ftr-link--btn"
                      onClick={(e) => { e.stopPropagation(); onNavAction(item.action); }}
                    >
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default FooterNav;
