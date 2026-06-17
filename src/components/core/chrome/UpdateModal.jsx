import React from 'react';

const UpdateModal = ({ currentVersion, latestVersion, downloadUrl, onClose }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  }}>
    <div style={{
      background: '#111', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', width: '400px', padding: '28px 32px',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    }}>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#eee', marginBottom: '8px', fontFamily: 'Poppins, sans-serif' }}>
        Update Available
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px', lineHeight: 1.6, fontFamily: 'Poppins, sans-serif' }}>
        Running <span style={{ color: '#aaa', fontWeight: 600 }}>v{currentVersion}</span>.{' '}
        Latest: <span style={{ color: '#ff8c00', fontWeight: 700 }}>v{latestVersion}</span>.
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '9px 18px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          color: '#666', fontSize: '11px', cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
        }}>Later</button>
        <button onClick={() => { window.electronAPI.invoke('open-external', downloadUrl); onClose(); }} style={{
          padding: '9px 20px', background: 'rgba(255,140,0,0.15)',
          border: '1px solid rgba(255,140,0,0.4)', borderRadius: '4px',
          color: '#ff8c00', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
          letterSpacing: '0.05em', fontFamily: 'Poppins, sans-serif',
        }}>Download v{latestVersion}</button>
      </div>
    </div>
  </div>
);

export default UpdateModal;
