import React from 'react';

/**
 * HeaderRegister — top ruled register of the home screen.
 *
 * Pure status strip: identity lives in the suite banner directly
 * above (core/banner) — repeating the wordmark here would double it.
 *
 * Left:  quiet console caption.
 * Right: monospace status strip — pipe-separated like the reference design.
 * Bottom: single hairline rule.
 */
const HeaderRegister = ({ appVersion, mapsPath, libraryScanned, scanning }) => {
  const libStatus = scanning ? 'SCANNING…' : libraryScanned ? 'LIBS OK' : 'LIBS NOT SCANNED';
  const libOk     = !scanning && libraryScanned;

  return (
    <div className="hs-header-register">
      <span className="hs-header-console">CONSOLE — STANDBY</span>
      <div className="hs-header-status">
        {appVersion && (
          <span className="hs-status-part">v{appVersion}</span>
        )}
        <span className={`hs-status-part${libOk ? ' hs-status-part--ok' : ''}`}>
          {libStatus}
        </span>
        {mapsPath && (
          <span
            className="hs-status-part"
            style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {mapsPath}
          </span>
        )}
      </div>
    </div>
  );
};

export default HeaderRegister;
