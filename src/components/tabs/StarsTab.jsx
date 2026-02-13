import React, { useState, useRef, useEffect } from 'react';
import './StarsTab.css';

const StarsTab = () => {
  const [numStars, setNumStars] = useState(() => {
    const saved = localStorage.getItem('stars_numStars');
    return saved || '50';
  });
  
  const [numClusters, setNumClusters] = useState(() => {
    const saved = localStorage.getItem('stars_numClusters');
    return saved || '10';
  });
  
  const [clusterSpread, setClusterSpread] = useState(() => {
    const saved = localStorage.getItem('stars_clusterSpread');
    return saved || '14000';
  });
  
  const [clusterStdDev, setClusterStdDev] = useState(() => {
    const saved = localStorage.getItem('stars_clusterStdDev');
    return saved || '1800';
  });
  
  const [backgroundRatio, setBackgroundRatio] = useState(() => {
    const saved = localStorage.getItem('stars_backgroundRatio');
    return saved || '0.45';
  });

  const [scaleMin, setScaleMin] = useState(() => {
    const saved = localStorage.getItem('stars_scaleMin');
    return saved || '10';
  });

  const [scaleMax, setScaleMax] = useState(() => {
    const saved = localStorage.getItem('stars_scaleMax');
    return saved || '30';
  });

  const [uvOpacity, setUvOpacity] = useState(() => {
    const saved = localStorage.getItem('stars_uvOpacity');
    return saved || '0.25';
  });
  
  const [uvOptions, setUvOptions] = useState(() => {
    const saved = localStorage.getItem('stars_uvOptions');
    return saved || '0.0, 0.0, 0.5, 0.5\n0.5, 0.0, 0.5, 0.5\n0.0, 0.5, 0.5, 0.5\n0.5, 0.5, 0.5, 0.5';
  });
  
  const [uvWeights, setUvWeights] = useState(() => {
    const saved = localStorage.getItem('stars_uvWeights');
    return saved || '0.25\n0.25\n0.25\n0.25';
  });

  const [previewImage, setPreviewImage] = useState(null);
  // Use separate preview key for stars
  const [previewImageData, setPreviewImageData] = useState(() => {
    try {
      return localStorage.getItem('stars_preview_image') || null;
    } catch (e) {
      return null;
    }
  });
  const [starPreview, setStarPreview] = useState([]);
  const uvCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('stars_numStars', numStars);
    localStorage.setItem('stars_numClusters', numClusters);
    localStorage.setItem('stars_clusterSpread', clusterSpread);
    localStorage.setItem('stars_clusterStdDev', clusterStdDev);
    localStorage.setItem('stars_backgroundRatio', backgroundRatio);
    localStorage.setItem('stars_scaleMin', scaleMin);
    localStorage.setItem('stars_scaleMax', scaleMax);
    localStorage.setItem('stars_uvOpacity', uvOpacity);
    localStorage.setItem('stars_uvOptions', uvOptions);
    localStorage.setItem('stars_uvWeights', uvWeights);
  }, [numStars, numClusters, clusterSpread, clusterStdDev, backgroundRatio, scaleMin, scaleMax, uvOpacity, uvOptions, uvWeights]);

  // Load preview image from localStorage
  useEffect(() => {
    if (previewImageData) {
      const img = new Image();
      img.onload = () => setPreviewImage(img);
      img.src = previewImageData;
    }
  }, [previewImageData]);

  // UV Colors for visualization
  const UV_COLORS = [
    '#ff4444', '#44ff44', '#4444ff', '#ffff44', 
    '#ff44ff', '#44ffff', '#ff8844', '#88ff44'
  ];

  // Draw UV visualization
  useEffect(() => {
    const canvas = uvCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw preview image if available
    if (previewImage && previewImage.complete) {
      ctx.drawImage(previewImage, 0, 0, width, height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);
    } else {
      // Background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);
    }

    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const pos = (i / 4) * width;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(width, pos);
      ctx.stroke();
    }

    // UV coordinate labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Space Grotesk';
    ctx.fillText('(0,0)', 5, height - 5);
    ctx.fillText('(1,0)', width - 30, height - 5);
    ctx.fillText('(0,1)', 5, 15);
    ctx.fillText('(1,1)', width - 30, 15);

    // Parse and draw UV rectangles
    const lines = uvOptions.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });

    const rects = [];
    
    lines.forEach((line, idx) => {
      try {
        const values = line.split(',').map(v => parseFloat(v.trim()));
        if (values.length === 4 && values.every(v => !isNaN(v))) {
          const [x, y, z, w] = values;
          const color = UV_COLORS[idx % UV_COLORS.length];
          
          // Convert UV coords (0-1, origin bottom-left) to canvas coords (origin top-left)
          const canvasX1 = x * width;
          const canvasY1 = (1 - y - w) * height;
          const canvasX2 = (x + z) * width;
          const canvasY2 = (1 - y) * height;
          
          rects.push({
            x1: canvasX1,
            y1: canvasY1,
            x2: canvasX2,
            y2: canvasY2,
            color,
            index: idx + 1,
            uv: values
          });
        }
      } catch (e) {
        // Skip invalid lines
      }
    });

    // Draw semi-transparent fills first
    const opacity = parseFloat(uvOpacity) || 0;
    
    // Only draw overlay if opacity > 0
    if (opacity > 0) {
      const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
      
      rects.forEach(rect => {
        ctx.fillStyle = rect.color + opacityHex;
        ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
      });
    }

    // Draw borders and labels
    rects.forEach(rect => {
      // Border
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);

      // Label background
      const centerX = (rect.x1 + rect.x2) / 2;
      const centerY = (rect.y1 + rect.y2) / 2;
      
      ctx.fillStyle = '#1a1a1a';
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label text
      ctx.fillStyle = rect.color;
      ctx.font = 'bold 14px Space Grotesk';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(rect.index), centerX, centerY);
    });
  }, [uvOptions, uvOpacity, previewImage]);

  // Draw star preview with actual UV mapped texture
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw stars with actual UV mapped texture
    starPreview.forEach(star => {
      // Map 3D position to 2D (simple top-down view)
      const x = ((star.x / 14000) * 0.5 + 0.5) * width;
      const z = ((star.z / 14000) * 0.5 + 0.5) * height;
      
      const size = star.scale * 0.3;
      
      if (previewImage && previewImage.complete && star.uv) {
        // Draw actual texture from UV coordinates
        const imgWidth = previewImage.width;
        const imgHeight = previewImage.height;
        
        // UV coordinates - flip Y for canvas (UV origin is bottom-left, canvas is top-left)
        const uvX = star.uv.x * imgWidth;
        const uvY = (1 - star.uv.y - star.uv.w) * imgHeight;
        const uvWidth = star.uv.z * imgWidth;
        const uvHeight = star.uv.w * imgHeight;
        
        // Draw the texture portion directly (no clipping, no glow)
        ctx.save();
        ctx.globalAlpha = star.brightness * 0.9;
        
        const drawSize = size * 5;
        ctx.drawImage(
          previewImage,
          uvX, uvY, uvWidth, uvHeight,
          x - drawSize / 2, z - drawSize / 2, drawSize, drawSize
        );
        
        ctx.restore();
        
      } else {
        // Fallback to colored stars if no texture
        const r = parseInt(star.color.slice(1, 3), 16);
        const g = parseInt(star.color.slice(3, 5), 16);
        const b = parseInt(star.color.slice(5, 7), 16);
        
        // Glow with UV color
        const gradient = ctx.createRadialGradient(x, z, 0, x, z, size * 3);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${star.brightness})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${star.brightness * 0.3})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, z, size * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Core with UV color
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
        ctx.beginPath();
        ctx.arc(x, z, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // White center
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(x, z, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
  }, [starPreview, previewImage]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setPreviewImage(img);
          setPreviewImageData(event.target.result);
          try {
            // Use separate stars preview key
            localStorage.setItem('stars_preview_image', event.target.result);
          } catch (e) {
            console.error('Failed to save preview image:', e);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const deletePreviewImage = () => {
    setPreviewImage(null);
    setPreviewImageData(null);
    localStorage.removeItem('stars_preview_image');
  };

  const generatePreview = () => {
    try {
      // Parse configuration
      const nStars = parseInt(numStars) || 50;
      const nClusters = parseInt(numClusters) || 10;
      const spread = parseFloat(clusterSpread) || 14000;
      const stddev = parseFloat(clusterStdDev) || 1800;
      const bgRatio = parseFloat(backgroundRatio) || 0.45;
      const minScale = parseFloat(scaleMin) || 10;
      const maxScale = parseFloat(scaleMax) || 30;

      // Parse UV options
      const uvLines = uvOptions.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      const parsedUvs = [];
      uvLines.forEach(line => {
        try {
          const values = line.split(',').map(v => parseFloat(v.trim()));
          if (values.length === 4 && values.every(v => !isNaN(v))) {
            parsedUvs.push({ x: values[0], y: values[1], z: values[2], w: values[3] });
          }
        } catch (e) {}
      });

      // Parse weights
      const weightLines = uvWeights.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      const parsedWeights = [];
      weightLines.forEach(line => {
        try {
          const weight = parseFloat(line.trim());
          if (!isNaN(weight)) {
            parsedWeights.push(weight);
          }
        } catch (e) {}
      });

      if (parsedUvs.length === 0) {
        alert('Please provide valid UV options');
        return;
      }

      if (parsedWeights.length !== parsedUvs.length) {
        alert('Number of UV options must match number of weights');
        return;
      }

      // Generate cluster centers
      const clusterCenters = [];
      for (let i = 0; i < nClusters; i++) {
        clusterCenters.push({
          x: (Math.random() * 2 - 1) * spread,
          y: Math.random() * 1500,
          z: (Math.random() * 2 - 1) * spread
        });
      }

      // Generate stars for preview
      const stars = [];
      const totalWeight = parsedWeights.reduce((a, b) => a + b, 0);
      
      for (let i = 0; i < nStars; i++) {
        let x, y, z, isCluster;
        
        if (Math.random() < bgRatio) {
          // Background star
          x = (Math.random() * 2 - 1) * spread;
          y = Math.random() * 1500;
          z = (Math.random() * 2 - 1) * spread;
          isCluster = false;
        } else {
          // Cluster star
          const cluster = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
          
          const u1 = Math.random();
          const u2 = Math.random();
          const r = Math.sqrt(-2 * Math.log(u1));
          const theta = 2 * Math.PI * u2;
          
          const dx = r * Math.cos(theta) * stddev;
          const dz = r * Math.sin(theta) * stddev;
          
          x = cluster.x + dx;
          y = cluster.y + (Math.random() - 0.5) * 200;
          z = cluster.z + dz;
          isCluster = true;
        }

        // Choose UV based on weights
        let random = Math.random() * totalWeight;
        let uvIndex = 0;
        
        for (let j = 0; j < parsedWeights.length; j++) {
          random -= parsedWeights[j];
          if (random <= 0) {
            uvIndex = j;
            break;
          }
        }

        // Calculate scale with variation based on position
        // Stars further from center get slightly smaller
        const distanceFromCenter = Math.sqrt(x * x + z * z) / spread;
        const positionScaleFactor = 1 - (distanceFromCenter * 0.3); // 0-30% reduction based on distance
        
        // Random scale within range, modified by position
        const baseScale = minScale + Math.random() * (maxScale - minScale);
        const scale = baseScale * positionScaleFactor;
        
        // Brightness varies with cluster vs background
        const brightness = isCluster ? (0.6 + Math.random() * 0.4) : (0.3 + Math.random() * 0.4);
        
        // Get color from UV_COLORS
        const color = UV_COLORS[uvIndex % UV_COLORS.length];
        const uv = parsedUvs[uvIndex];
        
        stars.push({ x, y, z, scale, brightness, color, uvIndex, uv });
      }

      setStarPreview(stars);
    } catch (error) {
      console.error('Preview generation error:', error);
      alert('Error generating preview: ' + error.message);
    }
  };

  const insertAllDefaults = () => {
    setNumStars('50');
    setNumClusters('10');
    setClusterSpread('14000');
    setClusterStdDev('1800');
    setBackgroundRatio('0.45');
    setScaleMin('10');
    setScaleMax('30');
    setUvOpacity('0.25');
    setUvOptions('0.0, 0.0, 0.5, 0.5\n0.5, 0.0, 0.5, 0.5\n0.0, 0.5, 0.5, 0.5\n0.5, 0.5, 0.5, 0.5');
    setUvWeights('0.25\n0.25\n0.25\n0.25');
  };

  const generateSkybox = () => {
    try {
      // Parse configuration
      const nStars = parseInt(numStars) || 50;
      const nClusters = parseInt(numClusters) || 10;
      const spread = parseFloat(clusterSpread) || 14000;
      const stddev = parseFloat(clusterStdDev) || 1800;
      const bgRatio = parseFloat(backgroundRatio) || 0.45;
      const minScale = parseFloat(scaleMin) || 10;
      const maxScale = parseFloat(scaleMax) || 30;

      // Parse UV options
      const uvLines = uvOptions.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      const parsedUvs = [];
      uvLines.forEach(line => {
        try {
          const values = line.split(',').map(v => parseFloat(v.trim()));
          if (values.length === 4 && values.every(v => !isNaN(v))) {
            parsedUvs.push({ x: values[0], y: values[1], z: values[2], w: values[3] });
          }
        } catch (e) {}
      });

      // Parse weights
      const weightLines = uvWeights.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      const parsedWeights = [];
      weightLines.forEach(line => {
        try {
          const weight = parseFloat(line.trim());
          if (!isNaN(weight)) {
            parsedWeights.push(weight);
          }
        } catch (e) {}
      });

      if (parsedUvs.length === 0) {
        alert('Please provide valid UV options');
        return;
      }

      if (parsedWeights.length !== parsedUvs.length) {
        alert('Number of UV options must match number of weights');
        return;
      }

      // Generate cluster centers
      const clusterCenters = [];
      for (let i = 0; i < nClusters; i++) {
        clusterCenters.push({
          x: (Math.random() * 2 - 1) * spread,
          y: Math.random() * 1500,
          z: (Math.random() * 2 - 1) * spread
        });
      }

      // Generate stars
      const blueprints = [];
      
      for (let i = 0; i < nStars; i++) {
        let x, y, z;
        
        if (Math.random() < bgRatio) {
          // Background star (uniform distribution)
          x = (Math.random() * 2 - 1) * spread;
          y = Math.random() * 1500;
          z = (Math.random() * 2 - 1) * spread;
        } else {
          // Cluster star (gaussian distribution around cluster center)
          const cluster = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
          
          // Box-Muller transform for normal distribution
          const u1 = Math.random();
          const u2 = Math.random();
          const r = Math.sqrt(-2 * Math.log(u1));
          const theta = 2 * Math.PI * u2;
          
          const dx = r * Math.cos(theta) * stddev;
          const dz = r * Math.sin(theta) * stddev;
          
          x = cluster.x + dx;
          y = cluster.y + (Math.random() - 0.5) * 200;
          z = cluster.z + dz;
        }

        // Choose UV based on weights
        const totalWeight = parsedWeights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        let uvIndex = 0;
        
        for (let j = 0; j < parsedWeights.length; j++) {
          random -= parsedWeights[j];
          if (random <= 0) {
            uvIndex = j;
            break;
          }
        }

        const uv = parsedUvs[uvIndex];
        
        // Random scale within range
        const scale = minScale + Math.random() * (maxScale - minScale);
        
        blueprints.push({
          bp: '/env/common/splats/stars_alpha.bp',
          position: [x.toFixed(3), y.toFixed(3), z.toFixed(3)],
          scale: [scale.toFixed(2), scale.toFixed(2), scale.toFixed(2)],
          props: {
            LODCutoff: 500,
            ShaderParams: {
              OffsetX: uv.x,
              OffsetY: uv.y,
              ScaleX: uv.z,
              ScaleY: uv.w
            }
          }
        });
      }

      // Create JSON
      const skyboxData = {
        Decals: blueprints
      };

      const jsonString = JSON.stringify(skyboxData, null, 2);
      
      // Download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skybox_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ Success!\n\nGenerated ${blueprints.length} stars\nJSON file downloaded`);

    } catch (error) {
      console.error('Generation error:', error);
      alert(`Error generating skybox: ${error.message}`);
    }
  };

  return (
    <div className="stars-tab">
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
        <div className="stars-section-card">
          <h2 className="stars-section-title">
            <span className="stars-section-icon">⭐</span>
            STAR CONFIGURATION
          </h2>
          <p className="stars-section-description">
            Configure the distribution and clustering of stars
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div className="stars-form-group">
              <label>Number of Stars</label>
              <p className="stars-form-help">Total number of stars to generate</p>
              <input
                type="text"
                className="stars-form-input"
                value={numStars}
                onChange={(e) => setNumStars(e.target.value)}
                placeholder="50"
              />
            </div>

            <div className="stars-form-group">
              <label>Number of Clusters</label>
              <p className="stars-form-help">How many star clusters to create</p>
              <input
                type="text"
                className="stars-form-input"
                value={numClusters}
                onChange={(e) => setNumClusters(e.target.value)}
                placeholder="10"
              />
            </div>

            <div className="stars-form-group">
              <label>Cluster Spread</label>
              <p className="stars-form-help">Maximum distance from center for cluster centers</p>
              <input
                type="text"
                className="stars-form-input"
                value={clusterSpread}
                onChange={(e) => setClusterSpread(e.target.value)}
                placeholder="14000"
              />
            </div>

            <div className="stars-form-group">
              <label>Cluster Standard Deviation</label>
              <p className="stars-form-help">How tightly stars cluster around centers</p>
              <input
                type="text"
                className="stars-form-input"
                value={clusterStdDev}
                onChange={(e) => setClusterStdDev(e.target.value)}
                placeholder="1800"
              />
            </div>

            <div className="stars-form-group" style={{ gridColumn: 'span 2' }}>
              <label>Background Ratio</label>
              <p className="stars-form-help">Fraction of stars in background vs clusters (0-1)</p>
              <input
                type="text"
                className="stars-form-input"
                value={backgroundRatio}
                onChange={(e) => setBackgroundRatio(e.target.value)}
                placeholder="0.45"
              />
            </div>

            <div className="stars-form-group">
              <label>Scale Min</label>
              <p className="stars-form-help">Minimum star size</p>
              <input
                type="text"
                className="stars-form-input"
                value={scaleMin}
                onChange={(e) => setScaleMin(e.target.value)}
                placeholder="10"
              />
            </div>

            <div className="stars-form-group">
              <label>Scale Max</label>
              <p className="stars-form-help">Maximum star size</p>
              <input
                type="text"
                className="stars-form-input"
                value={scaleMax}
                onChange={(e) => setScaleMax(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>
        </div>

        <div className="stars-section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 className="stars-section-title" style={{ margin: 0 }}>
                <span className="stars-section-icon">🎨</span>
                UV TEXTURE CONFIGURATION
              </h2>
              <p className="stars-section-description" style={{ marginTop: '8px' }}>
                Define texture coordinates for star variants
              </p>
            </div>
            <button onClick={insertAllDefaults} className="stars-btn-default">
              Reset to Defaults
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
            <div>
              <div className="stars-form-group">
                <label>UV Options (x, y, z, w) - one per line</label>
                <p className="stars-form-help">Rectangle: x1=x, y1=y, x2=x+z, y2=y+w</p>
                <textarea
                  className="stars-form-input"
                  value={uvOptions}
                  onChange={(e) => setUvOptions(e.target.value)}
                  rows={8}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </div>

              <div className="stars-form-group">
                <label>UV Weights (one per line)</label>
                <p className="stars-form-help">Probability weights for each UV option</p>
                <textarea
                  className="stars-form-input"
                  value={uvWeights}
                  onChange={(e) => setUvWeights(e.target.value)}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontWeight: 'bold' }}>
                  UV Coordinate Visualization
                </label>
                {previewImageData && (
                  <button
                    className="stars-btn-danger-small"
                    onClick={deletePreviewImage}
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    Delete Preview
                  </button>
                )}
              </div>

              <div className="stars-form-group" style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '0.85rem', marginBottom: '5px', display: 'block' }}>
                  UV Overlay Opacity: {(parseFloat(uvOpacity) || 0).toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={uvOpacity}
                  onChange={(e) => setUvOpacity(e.target.value)}
                  style={{
                    width: '100%',
                    accentColor: 'var(--stars-color)',
                    cursor: 'pointer'
                  }}
                />
              </div>
              
              <div className="stars-upload-area" onClick={() => fileInputRef.current?.click()} style={{ marginBottom: '15px' }}>
                <span className="stars-upload-icon">📤</span>
                <span>Upload texture preview</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="stars-file-input"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>

              <canvas
                ref={uvCanvasRef}
                width={350}
                height={350}
                style={{
                  width: '100%',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px'
                }}
              />

              <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  LEGEND
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {uvOptions.split('\n').filter(line => line.trim() && !line.trim().startsWith('#')).map((_, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: UV_COLORS[idx % UV_COLORS.length],
                          border: '2px solid #fff'
                        }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        UV Option {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="stars-section-card">
          <h2 className="stars-section-title">
            <span className="stars-section-icon">🌌</span>
            STAR DISTRIBUTION PREVIEW
          </h2>
          <p className="stars-section-description">
            Top-down view showing star positions, sizes, and UV texture assignments
          </p>

          <button onClick={generatePreview} className="stars-btn-secondary" style={{ width: '100%', marginBottom: '20px' }}>
            🔄 Generate Preview
          </button>

          <canvas
            ref={previewCanvasRef}
            width={700}
            height={700}
            style={{
              width: '100%',
              maxWidth: '700px',
              margin: '0 auto 20px',
              display: 'block',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              background: '#0a0a0a'
            }}
          />

          <div className="stars-hint-box">
            {previewImage ? 
              'Showing actual UV-mapped texture sections. Star size reflects scale and distance from center. This is a 2D top-down view - actual skybox is in 3D space.' :
              'Upload a texture preview above to see actual star textures. Colors represent UV texture assignments. Star size reflects scale and distance from center.'
            }
          </div>
        </div>

        <button onClick={generateSkybox} className="btn-primary btn-large-star" style={{ width: '100%', marginTop: '20px' }}>
          ✨ GENERATE SKYBOX JSON
        </button>
      </div>
    </div>
  );
};

export default StarsTab;