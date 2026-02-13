import React, { useState, useEffect } from 'react';
import WreckageTab from './tabs/WreckageTab.jsx';
import PropsTab from './tabs/PropsTab.jsx';
import StarsTab from './tabs/StarsTab.jsx';
import './MapToolSuite.css';

const MapToolSuite = () => {
  const [activeSection, setActiveSection] = useState('wreckages');
  
  const navigationItems = [
    { id: 'wreckages', label: 'Wreckages', category: 'emitter', icon: '' },
    { id: 'props', label: 'Props', category: 'emitter', icon: '' },
    { id: 'stars', label: 'Stars', category: 'skybox', icon: '' }
  ];

  return (
    <div className="map-tool-suite" data-active-theme={activeSection}>
      {/* Header */}
      <div className="suite-header">
        <div className="header-gradient-line"></div>
        <div className="header-content">
          <h1 className="header-title">
            MAPPING TOOLS
          </h1>
          <div className="header-underline"></div>
          <p className="header-subtitle">PROFESSIONAL MAP CREATION TOOLKIT</p>
        </div>
      </div>

      {/* Modern Luxury Navigation Bar */}
      <nav className="luxury-navbar">
        <div className="navbar-container">
          <div className="navbar-track">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
                data-theme={item.id}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                <span className="nav-category">{item.category}</span>
                <span className="nav-glow"></span>
              </button>
            ))}
          </div>
          <div className="navbar-indicator" data-active={activeSection}></div>
        </div>
      </nav>

      {/* Tab Content */}
      <div className="tab-content">
        {activeSection === 'wreckages' && <WreckageTab />}
        {activeSection === 'props' && <PropsTab />}
        {activeSection === 'stars' && <StarsTab />}
      </div>

      {/* Footer */}
      <div className="suite-footer">
        <div className="footer-gradient-line"></div>
        <p className="footer-text">
          v1.0 • Created by Seraphim-Noob for Forged Alliance Forever
        </p>
      </div>
    </div>
  );
};

export default MapToolSuite;