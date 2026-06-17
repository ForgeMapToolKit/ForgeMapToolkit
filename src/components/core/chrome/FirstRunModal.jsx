import React from 'react';
import Settings from '../../tabs/Config/SettingsTab/Settings.jsx';

const FirstRunModal = ({ onDone, onSkip }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  }}>
    <div style={{
      background: '#111', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', width: '680px', maxHeight: '90vh', overflow: 'auto',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    }}>
      <div style={{
        padding: '24px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#eee', letterSpacing: '0.05em' }}>
            Welcome to ForgeMapToolkit
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            Set up your paths to get started — libraries will be scanned automatically.
          </div>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: '3px',
          background: 'rgba(255,140,0,0.15)', border: '1px solid rgba(255,140,0,0.35)',
          color: '#ff8c00', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
        }}>FIRST RUN</div>
      </div>
      <Settings compact onSave={onDone} />
      <div style={{
        padding: '16px 32px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <button onClick={onSkip} style={{
          padding: '9px 20px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          color: '#666', fontSize: '11px', cursor: 'pointer',
          fontFamily: 'Poppins, sans-serif',
        }}>Skip for now</button>
      </div>
    </div>
  </div>
);

export default FirstRunModal;
