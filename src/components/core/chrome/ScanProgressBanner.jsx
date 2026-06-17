import React from 'react';

const ScanProgressBanner = ({ counts }) => (
  <div style={{
    background: 'rgba(255,140,0,0.07)',
    borderBottom: '1px solid rgba(255,140,0,0.18)',
    padding: '8px 20px',
    display: 'flex', alignItems: 'center', gap: '12px',
    fontFamily: 'Poppins, sans-serif', fontSize: '11px', color: '#ff8c00',
  }}>
    <span style={{
      display: 'inline-block', width: '12px', height: '12px',
      border: '2px solid rgba(255,140,0,0.3)', borderTopColor: '#ff8c00',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
    {counts
      ? `Scan complete — ${counts.emitters} emitters · ${counts.props} props · ${counts.units} units`
      : 'Scanning gamedata libraries…'}
  </div>
);

export default ScanProgressBanner;
