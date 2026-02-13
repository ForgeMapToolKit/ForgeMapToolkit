import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import './PropsTab.css';

const PropsTab = () => {
  const [mapSize, setMapSize] = useState(() => {
    try {
      const saved = localStorage.getItem('props_mapSize');
      return saved || '1024';
    } catch (e) {
      return '1024';
    }
  });
  
  const [emitters, setEmitters] = useState(() => {
    try {
      const saved = localStorage.getItem('props_emitters');
      return saved ? JSON.parse(saved) : [''];
    } catch (e) {
      return [''];
    }
  });
  
  const [props, setProps] = useState(() => {
    try {
      const saved = localStorage.getItem('props_props');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(prop => {
          const { blueprintPath, ...rest } = prop;
          return {
            ...rest,
            blueprintPaths: prop.blueprintPaths || (blueprintPath ? [blueprintPath] : [''])
          };
        });
      }
      return [{
        id: Date.now(),
        propName: '',
        blueprintPaths: [''],
        coordinates: [{ x: '', y: '', z: '', isMirrored: false }],
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      }];
    } catch (e) {
      console.error('Error loading props:', e);
      return [{
        id: Date.now(),
        propName: '',
        blueprintPaths: [''],
        coordinates: [{ x: '', y: '', z: '', isMirrored: false }],
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      }];
    }
  });
  
  const [selectedProp, setSelectedProp] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImageData, setPreviewImageData] = useState(() => {
    try {
      return localStorage.getItem('shared_preview_image') || null;
    } catch (e) {
      return null;
    }
  });
  const [mirrorMode, setMirrorMode] = useState('diagonal');
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showBlueprintLibrary, setShowBlueprintLibrary] = useState(null);
  const [showEmitterLibrary, setShowEmitterLibrary] = useState(false);
  const [blueprintLibrary, setBlueprintLibrary] = useState({ categories: [] });
  const [emitterLibrary, setEmitterLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBlueprints, setSelectedBlueprints] = useState([]);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const availableColors = [
    { name: 'Trainer', color: '#FFAF00', glow: 'rgba(255, 175, 0, 0.35)' },
    { name: 'Promotions', color: '#FF7B00', glow: 'rgba(255, 123, 0, 0.35)' },
    { name: 'FAF Live', color: '#FFFA00', glow: 'rgba(255, 250, 0, 0.35)' },
    { name: 'Tournament', color: '#A5E801', glow: 'rgba(165, 232, 1, 0.35)' },
    { name: 'Matchmaking', color: '#538A33', glow: 'rgba(83, 138, 51, 0.35)' },
    { name: 'Balance', color: '#8A12BD', glow: 'rgba(138, 18, 189, 0.35)' },
    { name: 'Games', color: '#00DDFF', glow: 'rgba(0, 221, 255, 0.35)' },
    { name: 'Creative', color: '#3B76FF', glow: 'rgba(59, 118, 255, 0.35)' },
    { name: 'Moderation', color: '#FE1818', glow: 'rgba(254, 24, 24, 0.35)' },
    { name: 'DevOps', color: '#3EA387', glow: 'rgba(62, 163, 135, 0.35)' },
    { name: 'Campaign', color: '#18C748', glow: 'rgba(24, 199, 72, 0.35)' },
    { name: 'Association', color: '#FFFFFF', glow: 'rgba(255, 255, 255, 0.35)' },
    { name: 'Black', color: '#000000', glow: 'rgba(0, 0, 0, 0.35)' }
  ];

  // Load blueprint library from localStorage
  const loadBlueprintLibrary = () => {
    try {
      const saved = localStorage.getItem('blueprint_library');
      if (saved) {
        const data = JSON.parse(saved);
        setBlueprintLibrary(data);
      } else {
        // Default example structure
        setBlueprintLibrary({
          generated: new Date().toISOString(),
          categories: [
            {
              name: 'Example Trees',
              count: 2,
              props: [
                { 
                  name: 'tree_01_prop',
                  preview: 'tree_01_albedo.dds',
                  path: 'Supreme Commander Forged Alliance/gamedata/env/trees/props',
                  category: 'Example Trees',
                  subcategory: null
                },
                { 
                  name: 'tree_02_prop',
                  preview: 'tree_02_albedo.dds',
                  path: 'Supreme Commander Forged Alliance/gamedata/env/trees/props',
                  category: 'Example Trees',
                  subcategory: null
                }
              ]
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error loading blueprint library:', error);
      setBlueprintLibrary({ categories: [] });
    }
  };

  // Load emitter library from localStorage
  const loadEmitterLibrary = () => {
    try {
      const saved = localStorage.getItem('emitter_library');
      if (saved) {
        setEmitterLibrary(JSON.parse(saved));
      } else {
        setEmitterLibrary([
          { 
            name: 'Fire Emitter', 
            path: '/effects/emitters/fire_emit.bp',
            preview: null
          },
          { 
            name: 'Smoke Emitter', 
            path: '/effects/emitters/smoke_emit.bp',
            preview: null
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading emitter library:', error);
      setEmitterLibrary([]);
    }
  };

  // Handle library JSON file upload
  const handleLibraryUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (type === 'blueprint') {
        setBlueprintLibrary(data);
        localStorage.setItem('blueprint_library', JSON.stringify(data));
        alert(`Loaded ${data.categories?.length || 0} categories with ${data.categories?.reduce((sum, cat) => sum + cat.count, 0) || 0} blueprints`);
      } else {
        setEmitterLibrary(data);
        localStorage.setItem('emitter_library', JSON.stringify(data));
        alert(`Loaded ${data.length} emitters`);
      }
    } catch (error) {
      alert('Error loading library file: ' + error.message);
    }
  };

  // Toggle blueprint selection
  const toggleBlueprintSelection = (blueprint) => {
    setSelectedBlueprints(prev => {
      const isSelected = prev.some(b => b.name === blueprint.name && b.path === blueprint.path);
      if (isSelected) {
        return prev.filter(b => !(b.name === blueprint.name && b.path === blueprint.path));
      } else {
        return [...prev, blueprint];
      }
    });
  };

  // Select all blueprints in current category
  const selectAllInCategory = () => {
    if (!selectedCategory) return;
    
    const category = blueprintLibrary.categories.find(cat => cat.name === selectedCategory);
    if (category) {
      setSelectedBlueprints(category.props);
    }
  };

  // Confirm and add selected blueprints
  const confirmBlueprintSelection = (propIndex) => {
    if (selectedBlueprints.length === 0) return;

    const newProps = JSON.parse(JSON.stringify(props));
    
    // Remove empty blueprint paths
    newProps[propIndex].blueprintPaths = newProps[propIndex].blueprintPaths.filter(p => p.trim() !== '');
    
    // Add selected blueprints
    selectedBlueprints.forEach(blueprint => {
      const fullPath = `${blueprint.path}/${blueprint.name}.bp`;
      if (!newProps[propIndex].blueprintPaths.includes(fullPath)) {
        newProps[propIndex].blueprintPaths.push(fullPath);
      }
    });

    // Ensure at least one empty input for adding more
    if (!newProps[propIndex].blueprintPaths.some(p => p === '')) {
      newProps[propIndex].blueprintPaths.push('');
    }

    setProps(newProps);
    setShowBlueprintLibrary(null);
    setSelectedBlueprints([]);
    setSelectedCategory(null);
  };

  // Select emitter from library
  const selectEmitterFromLibrary = (emitter) => {
    const newEmitters = [...emitters];
    const emptyIndex = newEmitters.findIndex(e => e === '');
    
    if (emptyIndex !== -1) {
      newEmitters[emptyIndex] = emitter.path;
    } else {
      newEmitters.push(emitter.path);
    }
    
    setEmitters(newEmitters);
    setShowEmitterLibrary(false);
  };

  // Save data functions
  useEffect(() => {
    try {
      localStorage.setItem('props_mapSize', mapSize);
      localStorage.setItem('props_emitters', JSON.stringify(emitters));
      localStorage.setItem('props_props', JSON.stringify(props));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, [mapSize, emitters, props]);

  // Load preview image
  useEffect(() => {
    if (previewImageData) {
      const img = new Image();
      img.onload = () => setPreviewImage(img);
      img.src = previewImageData;
    }
  }, [previewImageData]);

  const addEmitter = () => {
    setEmitters([...emitters, '']);
  };

  const updateEmitter = (index, value) => {
    const newEmitters = [...emitters];
    newEmitters[index] = value;
    setEmitters(newEmitters);
  };

  const deleteEmitter = (index) => {
    if (emitters.length === 1) {
      setEmitters(['']);
    } else {
      setEmitters(emitters.filter((_, i) => i !== index));
    }
  };

  const addProp = () => {
    const newProp = {
      id: Date.now(),
      propName: '',
      blueprintPaths: [''],
      coordinates: [{ x: '', y: '', z: '', isMirrored: false }],
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    };
    setProps([...props, newProp]);
    setSelectedProp(props.length);
  };

  const updatePropName = (index, value) => {
    const newProps = [...props];
    newProps[index].propName = value;
    setProps(newProps);
  };

  const updateBlueprintPath = (propIndex, pathIndex, value) => {
    const newProps = [...props];
    newProps[propIndex].blueprintPaths[pathIndex] = value;
    
    // Add new empty input if last one is filled
    const lastPath = newProps[propIndex].blueprintPaths[newProps[propIndex].blueprintPaths.length - 1];
    if (lastPath && lastPath.trim() !== '') {
      newProps[propIndex].blueprintPaths.push('');
    }
    
    setProps(newProps);
  };

  const deleteBlueprintPath = (propIndex, pathIndex) => {
    const newProps = [...props];
    if (newProps[propIndex].blueprintPaths.length === 1) {
      newProps[propIndex].blueprintPaths = [''];
    } else {
      newProps[propIndex].blueprintPaths = newProps[propIndex].blueprintPaths.filter((_, i) => i !== pathIndex);
    }
    setProps(newProps);
  };

  const deleteProp = (index) => {
    if (props.length === 1) {
      setProps([{
        id: Date.now(),
        propName: '',
        blueprintPaths: [''],
        coordinates: [{ x: '', y: '', z: '', isMirrored: false }],
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      }]);
      setSelectedProp(0);
    } else {
      setProps(props.filter((_, i) => i !== index));
      if (selectedProp >= props.length - 1) {
        setSelectedProp(Math.max(0, props.length - 2));
      }
    }
  };

  const updatePropColor = (index, color) => {
    const newProps = [...props];
    newProps[index].color = color;
    setProps(newProps);
  };

  const addCoordinate = (propIndex) => {
    const newProps = [...props];
    newProps[propIndex].coordinates.push({ x: '', y: '', z: '', isMirrored: false });
    setProps(newProps);
  };

  const updateCoordinate = (propIndex, coordIndex, field, value) => {
    const newProps = [...props];
    newProps[propIndex].coordinates[coordIndex][field] = value;
    setProps(newProps);
  };

  const deleteCoordinate = (propIndex, coordIndex) => {
    const newProps = [...props];
    if (newProps[propIndex].coordinates.length === 1) {
      newProps[propIndex].coordinates = [{ x: '', y: '', z: '', isMirrored: false }];
    } else {
      newProps[propIndex].coordinates = newProps[propIndex].coordinates.filter((_, i) => i !== coordIndex);
    }
    setProps(newProps);
  };

  const deleteAllCoordinates = (propIndex) => {
    const newProps = [...props];
    newProps[propIndex].coordinates = [{ x: '', y: '', z: '', isMirrored: false }];
    setProps(newProps);
  };

    const getMirroredCoords = (x, z, mapSize, mode) => {
    const mapSizeNum = parseFloat(mapSize) || 1024;
    switch (mode) {
      case 'diagonal':
        return { x: mapSizeNum - x, z: mapSizeNum - z };
      case 'horizontal':
        return { x, z: mapSizeNum - z };
      case 'vertical':
        return { x: mapSizeNum - x, z };
      default:
        return null;
    }
  };
  const handleCanvasClick = (e) => {
    if (selectedProp < 0 || selectedProp >= props.length) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = ((e.clientX - rect.left) / rect.width) * 1024;
    const canvasZ = ((e.clientY - rect.top) / rect.height) * 1024;

    const mapSizeNum = parseFloat(mapSize) || 1024;
    const scale = mapSizeNum / 1024;
    
    const worldX = (canvasX * scale) - (mapSizeNum / 2);
    const worldZ = (canvasZ * scale) - (mapSizeNum / 2);

    const newProps = [...props];
    
    if (mirrorMode === 'none') {
      const emptyCoordIndex = newProps[selectedProp].coordinates.findIndex(c => !c.x && !c.z);
      
      if (emptyCoordIndex !== -1) {
        newProps[selectedProp].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2),
          y: '2',
          z: worldZ.toFixed(2),
          isMirrored: false
        };
      } else {
        newProps[selectedProp].coordinates.push({
          x: worldX.toFixed(2),
          y: '2',
          z: worldZ.toFixed(2),
          isMirrored: false
        });
      }
      
      setProps(newProps);
    } else {
      // Konvertiere zu absolutem Koordinatensystem für Mirroring
      const absX = worldX + (mapSizeNum / 2);
      const absZ = worldZ + (mapSizeNum / 2);
      
      const mirrored = getMirroredCoords(absX, absZ, mapSize, mirrorMode);
      
      const emptyCoordIndex = newProps[selectedProp].coordinates.findIndex(c => !c.x && !c.z);
      
      if (emptyCoordIndex !== -1) {
        newProps[selectedProp].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2),
          y: '2',
          z: worldZ.toFixed(2),
          isMirrored: false
        };
      } else {
        newProps[selectedProp].coordinates.push({
          x: worldX.toFixed(2),
          y: '2',
          z: worldZ.toFixed(2),
          isMirrored: false
        });
      }
      
      // Füge gespiegelte Koordinate hinzu
      const mirroredX = mirrored.x - (mapSizeNum / 2);
      const mirroredZ = mirrored.z - (mapSizeNum / 2);
      
      newProps[selectedProp].coordinates.push({
        x: mirroredX.toFixed(2),
        y: '2',
        z: mirroredZ.toFixed(2),
        isMirrored: true
      });
      
      setProps(newProps);
    }
  };
const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result;
        if (typeof imageData === 'string') {
          localStorage.setItem('shared_preview_image', imageData);
          setPreviewImageData(imageData);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const mapSizeNum = parseInt(mapSize) || 1024;

    ctx.clearRect(0, 0, width, height);

    // Background
    if (previewImage && previewImage.complete) {
      ctx.drawImage(previewImage, 0, 0, width, height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
    }


ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 2;
ctx.setLineDash([10, 10]);

if (mirrorMode === 'diagonal' || mirrorMode === 'vertical') {
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
}

if (mirrorMode === 'diagonal' || mirrorMode === 'horizontal') {
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

ctx.setLineDash([]);

    // Draw coordinates
    props.forEach((prop, propIdx) => {
      prop.coordinates.forEach((coord, coordIdx) => {
        if (coord.x && coord.z) {
          const x = ((parseFloat(coord.x) + mapSizeNum / 2) / mapSizeNum) * width;
          const z = ((parseFloat(coord.z) + mapSizeNum / 2) / mapSizeNum) * height;

          const r = parseInt(prop.color.match(/hsl\((\d+)/)?.[1] || 0);
          const colorHex = `hsl(${r}, 70%, 60%)`;

          // Main point
          ctx.fillStyle = colorHex;
          ctx.shadowColor = colorHex;
          ctx.shadowBlur = propIdx === selectedProp ? 20 : 15;
          
          ctx.beginPath();
          ctx.arc(x, z, propIdx === selectedProp ? 8 : 6, 0, Math.PI * 2);
          ctx.fill();
          
          if (propIdx === selectedProp) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          if (coord.isMirrored) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 6, z - 6);
            ctx.lineTo(x - 6, z + 6);
            ctx.lineTo(x + 6, z - 6);
            ctx.stroke();
          }

          ctx.shadowBlur = 0;
        }
      });
    });

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
  }, [props, selectedProp, previewImage, mirrorMode, mapSize]);

  // Generate markers for overlay
  const markers = [];
  props.forEach((prop, propIdx) => {
    prop.coordinates.forEach((coord, coordIdx) => {
      if (coord.x && coord.z) {
        const mapSizeNum = parseInt(mapSize) || 1024;
        const x = ((parseFloat(coord.x) + mapSizeNum / 2) / mapSizeNum) * 100;
        const z = ((parseFloat(coord.z) + mapSizeNum / 2) / mapSizeNum) * 100;

        markers.push({
          id: `${prop.id}-${coordIdx}`,
          x, z,
          color: prop.color,
          propName: prop.propName || `Prop ${propIdx + 1}`,
          isSelected: propIdx === selectedProp,
          isMirrored: coord.isMirrored
        });
      }
    });
  });
  const generateFiles = async () => {
    try {
      const zip = new JSZip();
      const propsList = [];
      const saveData = {};

      props.forEach((prop, idx) => {
        if (!prop.blueprintPaths || prop.blueprintPaths.length === 0) return;
        
        const validPaths = prop.blueprintPaths.filter(p => p && p.trim() !== '');
        if (validPaths.length === 0) return;

        prop.coordinates.forEach(coord => {
          if (coord.x && coord.z) {
            const baseCoords = [
              { x: coord.x, y: coord.y || '2', z: coord.z }
            ];

            if (mirrorMode !== 'none') {
              if (mirrorMode === 'diagonal' || mirrorMode === 'horizontal') {
                baseCoords.push({ x: (-parseFloat(coord.x)).toString(), y: coord.y || '2', z: coord.z });
              }
              if (mirrorMode === 'diagonal' || mirrorMode === 'vertical') {
                baseCoords.push({ x: coord.x, y: coord.y || '2', z: (-parseFloat(coord.z)).toString() });
              }
              if (mirrorMode === 'diagonal') {
                baseCoords.push({ x: (-parseFloat(coord.x)).toString(), y: coord.y || '2', z: (-parseFloat(coord.z)).toString() });
              }
            }

            baseCoords.forEach(c => {
              const blueprintPath = validPaths[Math.floor(Math.random() * validPaths.length)];
              propsList.push({
                blueprintPath,
                position: [c.x, c.y, c.z],
                orientation: [0, 0, 0]
              });
            });
          }
        });
      });

      const saveContent = {
        Scenario: {
          Props: propsList,
          MasterChain: {
            ['_MASTERCHAIN_'] : {
              Markers: {},
            }
          },
          Chains: {}
        },
        masterChainKeyTable: ['_MASTERCHAIN_']
      };

      if (emitters.some(e => e.trim() !== '')) {
        const validEmitters = emitters.filter(e => e.trim() !== '');
        saveContent.Scenario.MasterChain['_MASTERCHAIN_'].EmitterBlueprints = validEmitters;
      }

      const saveJson = JSON.stringify(saveContent, null, 2);
      zip.file('save.lua', `ScenarioInfo = ${saveJson.replace(/"([^"]+)":/g, '$1 =').replace(/:/g, ' =')}`);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `props_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ Success!\n\nGenerated ${propsList.length} prop placements\nFiles saved to ZIP`);
    } catch (error) {
      console.error('Generation error:', error);
      alert(`Error generating files: ${error.message}`);
    }
  };

  return (
    <div className="props-tab">
      {/* Blueprint Library Modal */}
      {showBlueprintLibrary !== null && (
        <>
          <div className="props-library-overlay" onClick={() => setShowBlueprintLibrary(null)} />
          <div className="props-library-sidebar">
            <div className="props-library-header">
              <h2 className="props-library-title">BLUEPRINT LIBRARY</h2>
              <button
                className="props-btn-close"
                onClick={() => setShowBlueprintLibrary(null)}
              >
                ×
              </button>
            </div>

            <div className="props-library-content">
              <div className="props-library-upload">
                <label className="props-upload-label">
                  📁 Load Library JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => handleLibraryUpload(e, 'blueprint')}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {selectedBlueprints.length > 0 && (
  <div className="props-selection-info">
    <span>{selectedBlueprints.length} blueprint(s) selected</span>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        className="props-btn-secondary"
        onClick={() => setSelectedBlueprints([])}
        style={{ padding: '8px 15px', fontSize: '0.8rem' }}
      >
        Clear All
      </button>
      <button
        className="props-btn-confirm"
        onClick={() => confirmBlueprintSelection(showBlueprintLibrary)}
      >
        ✓ Add to Prop
      </button>
    </div>
  </div>
)}

              <div className="props-category-list">
                {blueprintLibrary.categories && blueprintLibrary.categories.length > 0 ? (
                  blueprintLibrary.categories.map((category, idx) => (
                    <div key={idx} className="props-category-item">
                      <div 
                        className="props-category-header"
                        onClick={() => setSelectedCategory(selectedCategory === category.name ? null : category.name)}
                      >
                        <span className="props-category-name">{category.name}</span>
                        <span className="props-category-count">{category.count} props</span>
                      </div>

                      {selectedCategory === category.name && (
                        <div className="props-category-content">
                          <div className="props-category-actions">
                            <button
                              className="props-btn-select-all"
                              onClick={selectAllInCategory}
                            >
                              Select All
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
  {category.props && category.props.map((blueprint, bIdx) => {
    const isSelected = selectedBlueprints.some(
      b => b.name === blueprint.name && b.path === blueprint.path
    );

    return (
      <div
        key={bIdx}
        onClick={() => toggleBlueprintSelection(blueprint)}
        style={{
          cursor: 'pointer',
          background: isSelected ? 'rgba(165, 232, 1, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: `2px solid ${isSelected ? 'var(--props-accent)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '8px',
          padding: '12px',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minHeight: '80px',
          boxShadow: isSelected ? '0 0 20px var(--props-accent-glow)' : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'var(--props-accent)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }
        }}
      >
        {/* Preview Image */}
        <div style={{
          width: '60px',
          height: '60px',
          flexShrink: 0,
          background: '#1a1a1a',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {blueprint.preview ? (
            <img 
              src={blueprint.preview}
              alt={blueprint.name}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                imageRendering: 'pixelated'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                const parent = e.target.parentElement;
                if (parent && !parent.querySelector('.fallback-icon')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-icon';
                  fallback.style.cssText = 'color: var(--props-text-secondary); font-size: 1.5rem;';
                  fallback.textContent = '🌳';
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <span style={{ color: 'var(--props-text-secondary)', fontSize: '1.5rem' }}>🌳</span>
          )}
        </div>

        {/* Blueprint Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '1rem',
            fontWeight: '600',
            marginBottom: '4px',
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {blueprint.name}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--props-text-muted)',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {blueprint.path}
          </div>
        </div>

        {/* Check Mark */}
        {isSelected && (
          <div style={{
            color: 'var(--props-accent)',
            fontSize: '1.5rem',
            fontWeight: '700',
            flexShrink: 0
          }}>✓</div>
        )}
      </div>
    );
  })}
</div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="props-empty-state">
                    <p>No blueprint library loaded.</p>
                    <p>Upload a library JSON file to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Emitter Library Modal */}
      {showEmitterLibrary && (
        <>
          <div className="props-library-overlay" onClick={() => setShowEmitterLibrary(false)} />
          <div className="props-library-sidebar">
            <div className="props-library-header">
              <h2 className="props-library-title">EMITTER LIBRARY</h2>
              <button
                className="props-btn-close"
                onClick={() => setShowEmitterLibrary(false)}
              >
                ×
              </button>
            </div>

            <div className="props-library-content">
              <div className="props-library-upload">
                <label className="props-upload-label">
                  📁 Load Emitter Library JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => handleLibraryUpload(e, 'emitter')}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div className="props-emitter-list">
                {emitterLibrary && emitterLibrary.length > 0 ? (
                  emitterLibrary.map((emitter, idx) => (
                    <div
                      key={idx}
                      className="props-emitter-item"
                      onClick={() => selectEmitterFromLibrary(emitter)}
                    >
                      <div className="props-emitter-name">{emitter.name}</div>
                      <div className="props-emitter-path">{emitter.path}</div>
                    </div>
                  ))
                ) : (
                  <div className="props-empty-state">
                    <p>No emitter library loaded.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="props-content-grid">
        <div className="props-config-column">
          <div className="props-section-card">
            <h2 className="props-section-title">
              <span className="props-section-icon"></span>
              CONFIGURATION
            </h2>

            <div className="props-form-group">
              <label className="props-form-label">Map Size</label>
              <input
                type="number"
                className="props-form-input"
                value={mapSize}
                onChange={(e) => setMapSize(e.target.value)}
                placeholder="1024"
              />
            </div>

            <div className="props-form-group">
              <label className="props-form-label">Emitters</label>
              {emitters.map((emitter, idx) => (
                <div key={idx} className="props-input-with-button">
                  <input
                    type="text"
                    className="props-form-input"
                    value={emitter}
                    onChange={(e) => updateEmitter(idx, e.target.value)}
                    placeholder="/maps/mapname.v0001/env/emitters/props/forest_mist_emit.bp"
                  />
                  <button
                    className="props-btn-delete"
                    onClick={() => deleteEmitter(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={addEmitter} className="props-btn-secondary" style={{ flex: 1 }}>
                  + ADD EMITTER
                </button>
                <button 
                  onClick={() => {
                    loadEmitterLibrary();
                    setShowEmitterLibrary(true);
                  }} 
                  className="props-btn-library"
                >
                  Library
                </button>
              </div>
            </div>
          </div>

          <div className="props-section-card">
            <h2 className="props-section-title">
              <span className="props-section-icon"></span>
              PROPS
            </h2>

            <div className="props-props-grid">
              {props.map((prop, propIdx) => (
                <div 
                  key={prop.id} 
                  className={`props-prop-card ${propIdx === selectedProp ? 'selected' : ''}`}
                  onClick={() => setSelectedProp(propIdx)}
                >
                  <div className="props-prop-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div
                        className="props-color-indicator"
                        style={{ backgroundColor: prop.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowColorPicker(showColorPicker === propIdx ? null : propIdx);
                        }}
                      />
                      <span className="props-prop-card-title">
                        Prop {propIdx + 1}
                      </span>
                    </div>
                    <button
                      className="props-btn-delete-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProp(propIdx);
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {showColorPicker === propIdx && (
                    <div 
                      className="props-color-picker-dropdown"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="props-color-grid">
                        {availableColors.map((colorOption, cIdx) => (
                          <div
                            key={cIdx}
                            className="props-color-option"
                            style={{ backgroundColor: colorOption.color }}
                            onClick={() => {
                              updatePropColor(propIdx, colorOption.color);
                              setShowColorPicker(null);
                            }}
                            title={colorOption.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {propIdx === selectedProp && (
                    <div className="props-prop-details">
                      <div className="props-form-group">
                        <label>Prop Name</label>
                        <input
                          type="text"
                          className="props-form-input"
                          value={prop.propName}
                          onChange={(e) => updatePropName(propIdx, e.target.value)}
                          placeholder="Enter prop name (e.g. lava_tree01)"
                        />
                      </div>

                      <div className="props-form-group">
                        <label>Blueprint Paths</label>
                        {prop.blueprintPaths.map((path, pathIdx) => (
                          <div key={pathIdx} className="props-input-with-button">
                            <input
                              type="text"
                              className="props-form-input"
                              value={path}
                              onChange={(e) => updateBlueprintPath(propIdx, pathIdx, e.target.value)}
                              placeholder="/env/Lava/props/Trees/Groups/Dead01_Group1_prop.bp"
                            />
                            <button
                              className="props-btn-delete"
                              onClick={() => deleteBlueprintPath(propIdx, pathIdx)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            loadBlueprintLibrary();
                            setShowBlueprintLibrary(propIdx);
                          }} 
                          className="props-btn-library"
                          style={{ width: '100%' }}
                        >
                          Library
                        </button>
                      </div>

                      <div className="props-form-group">
                        <label>Coordinates ({prop.coordinates.filter(c => c.x && c.z).length})</label>
                        {prop.coordinates.map((coord, coordIdx) => (
                          <div key={coordIdx} className="props-coordinate-entry">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span className="props-coord-label">Point {coordIdx + 1}</span>
                              <button
                                className="props-btn-delete-small"
                                onClick={() => deleteCoordinate(propIdx, coordIdx)}
                              >
                                ×
                              </button>
                            </div>
                            <div className="props-coord-grid">
                              <div className="props-coord-field">
                                <label>X</label>
                                <input
                                  type="text"
                                  className="props-form-input-small"
                                  value={coord.x}
                                  onChange={(e) => updateCoordinate(propIdx, coordIdx, 'x', e.target.value)}
                                />
                              </div>
                              <div className="props-coord-field">
                                <label>Y</label>
                                <input
                                  type="text"
                                  className="props-form-input-small"
                                  value={coord.y}
                                  onChange={(e) => updateCoordinate(propIdx, coordIdx, 'y', e.target.value)}
                                />
                              </div>
                              <div className="props-coord-field">
                                <label>Z</label>
                                <input
                                  type="text"
                                  className="props-form-input-small"
                                  value={coord.z}
                                  onChange={(e) => updateCoordinate(propIdx, coordIdx, 'z', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            className="props-btn-secondary"
                            onClick={() => addCoordinate(propIdx)}
                            style={{ flex: 1 }}
                          >
                            + Add Coordinate
                          </button>
                          {prop.coordinates.some(c => c.x && c.z) && (
                            <button
                              className="props-btn-danger"
                              onClick={() => {
                                if (confirm('Delete all coordinates for this prop?')) {
                                  deleteAllCoordinates(propIdx);
                                }
                              }}
                              style={{ padding: '10px 20px' }}
                            >
                              Delete All
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="props-add-prop-card" onClick={addProp}>
                <div className="props-add-prop-icon">
                  <span style={{ fontSize: '2rem' }}>+</span>
                </div>
                <span className="props-add-prop-text">ADD PROP TYPE</span>
              </div>
            </div>
          </div>

          <button onClick={generateFiles} className="props-btn-primary props-btn-large">
            GENERATE FILES
          </button>
        </div>

        <div className="props-preview-column">
          <div className="props-section-card props-preview-card">
            <div className="props-preview-header">
              <h2 className="props-section-title" style={{ margin: 0 }}>
                <span className="props-section-icon"></span>
                PREVIEW
              </h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  className="props-mirror-dropdown"
                  value={mirrorMode}
                  onChange={(e) => setMirrorMode(e.target.value)}
                >
                  <option value="none">No Mirror</option>
                  <option value="diagonal">Diagonal</option>
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
                {previewImageData && (
                  <button
                    className="props-btn-danger-preview"
                    onClick={() => {
                      if (confirm('Delete preview image?')) {
                        localStorage.removeItem('shared_preview_image');
                        setPreviewImageData(null);
                        setPreviewImage(null);
                      }
                    }}
                  >
                    Delete Preview
                  </button>
                )}
              </div>
            </div>

            <div className="props-upload-area" onClick={() => fileInputRef.current?.click()}>
              <span className="props-upload-icon"></span>
              <span>Click to upload map image</span>
              <input
                ref={fileInputRef}
                type="file"
                className="props-file-input"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>

            <div className="props-canvas-container" style={{ position: 'relative', width: '700px', height: '700px' }}>
              <canvas
                ref={canvasRef}
                className="props-preview-canvas"
                width={1024}
                height={1024}
                onClick={handleCanvasClick}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
              
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none'
              }}>
                {markers.map(marker => (
                  <div
                    key={marker.id}
                    style={{
                      position: 'absolute',
                      left: `${marker.x}%`,
                      top: `${marker.z}%`,
                      transform: 'translate(-50%, -50%)',
                      width: marker.isSelected ? '16px' : '12px',
                      height: marker.isSelected ? '16px' : '12px',
                      borderRadius: '50%',
                      backgroundColor: marker.color,
                      border: marker.isSelected ? '3px solid white' : '2px solid white',
                      boxShadow: `0 0 ${marker.isSelected ? '20px' : '15px'} ${marker.color}, 0 0 ${marker.isSelected ? '10px' : '5px'} rgba(255,255,255,0.5)`,
                      transition: 'all 0.3s ease',
                      pointerEvents: 'auto',
                      cursor: 'pointer'
                    }}
                    title={marker.propName}
                  >
                    {marker.isMirrored && (
                      <div style={{
                        position: 'absolute',
                        inset: '-2px',
                        borderLeft: '2px solid white',
                        borderTop: '2px solid white'
                      }} />
                    )}
                  </div>
                ))}
              </div>

              {!previewImage && props.every(p => p.coordinates.every(c => !c.x)) && (
                <div className="props-canvas-placeholder">
                  Click on canvas to place props
                </div>
              )}
            </div>

            <div className="props-legend">
              <div className="props-legend-title">PROP LEGEND</div>
              <div className="props-legend-items">
                {props.map((prop, idx) => (
                  <div key={prop.id} className="props-legend-item">
                    <div
                      className="props-legend-color"
                      style={{ backgroundColor: prop.color }}
                    />
                    <span className={idx === selectedProp ? 'selected' : ''}>
                      {prop.propName || `Prop ${idx + 1}`}
                    </span>
                    <span className="props-coord-count">
                      {prop.coordinates.filter(c => c.x && c.z).length} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="props-hint-box">
              Click on the canvas to place coordinates - {mirrorMode !== 'none' ? `${mirrorMode} mirroring active` : 'No mirroring'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropsTab;