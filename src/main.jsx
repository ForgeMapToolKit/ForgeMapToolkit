import './devElectronShim.js'; // must stay first — sets up window.electronAPI for browser preview
import React from 'react';
import ReactDOM from 'react-dom/client';
import ForgeMapToolkit from './components/core/ForgeMapToolkit.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ForgeMapToolkit />
  </React.StrictMode>,
);
