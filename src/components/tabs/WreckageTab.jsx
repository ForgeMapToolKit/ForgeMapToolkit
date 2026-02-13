import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import './WreckageTab.css';

const WreckageTab = () => {
  const [mapSize, setMapSize] = useState(() => {
    try {
      const saved = localStorage.getItem('wreckage_mapSize');
      return saved || '1024';
    } catch (e) {
      return '1024';
    }
  });
  
  const [mapName, setMapName] = useState(() => {
    try {
      const saved = localStorage.getItem('wreckage_mapName');
      return saved || '';
    } catch (e) {
      return '';
    }
  });
  
  const [emitters, setEmitters] = useState(() => {
    try {
      const saved = localStorage.getItem('wreckage_emitters');
      return saved ? JSON.parse(saved) : [''];
    } catch (e) {
      return [''];
    }
  });
  
  const [blueprintPaths, setBlueprintPaths] = useState(() => {
    try {
      const saved = localStorage.getItem('wreckage_blueprintPaths');
      return saved ? JSON.parse(saved) : [''];
    } catch (e) {
      return [''];
    }
  });
  
  const [units, setUnits] = useState(() => {
    try {
      const saved = localStorage.getItem('wreckage_units');
      return saved ? JSON.parse(saved) : [{
        id: Date.now(),
        unitType: '',
        coordinates: [{ x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false }],
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      }];
    } catch (e) {
      return [{
        id: Date.now(),
        unitType: '',
        coordinates: [{ x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false }],
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      }];
    }
  });
  
  const [selectedUnit, setSelectedUnit] = useState(0);
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
  const [showUnitLibrary, setShowUnitLibrary] = useState(false);
  const [showEmitterLibrary, setShowEmitterLibrary] = useState(false);
  const [showBlueprintLibrary, setShowBlueprintLibrary] = useState(false);
  const [unitLibrary, setUnitLibrary] = useState({ categories: [] });
  const [emitterLibrary, setEmitterLibrary] = useState([]);
  const [blueprintLibrary, setBlueprintLibrary] = useState({ categories: [] });
  const [selectedBlueprints, setSelectedBlueprints] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
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

  // Search function for units
  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    const results = [];

    unitLibrary.categories?.forEach(category => {
      category.units?.forEach(unit => {
        const matchesName = unit.name?.toLowerCase().includes(lowerQuery);
        const matchesId = unit.id?.toLowerCase().includes(lowerQuery);
        
        if (matchesName || matchesId) {
          results.push({
            ...unit,
            categoryName: category.name
          });
        }
      });
    });

    setSearchResults(results);
  };

  // Load unit library
  const loadUnitLibrary = () => {
    try {
      const saved = localStorage.getItem('unit_library');
      if (saved) {
        setUnitLibrary(JSON.parse(saved));
      } else {
        setUnitLibrary({
          generated: new Date().toISOString(),
          categories: [
            {
              name: 'Example Units',
              count: 2,
              units: [
                { name: 'Iavish', id: 'xsa0202', preview: 'xsa0202.png', category: 'Example Units', subcategory: 'Fighter' },
                { name: 'Awhassa', id: 'xsa0402', preview: 'xsa0402.png', category: 'Example Units', subcategory: 'Experimental' }
              ]
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error loading unit library:', error);
      setUnitLibrary({ categories: [] });
    }
  };

  // Load emitter library
  const loadEmitterLibrary = () => {
    try {
      const saved = localStorage.getItem('wreckage_emitter_library');
      if (saved) {
        setEmitterLibrary(JSON.parse(saved));
      } else {
        setEmitterLibrary([
          { name: 'Destruction Explosion Concussion Ring', path: 'effects/emitters/destruction_explosion_concussion_ring_03_emit.bp', preview: null },
          { name: 'Fire Plume', path: 'effects/emitters/destruction_fire_plume_01_emit.bp', preview: null }
        ]);
      }
    } catch (error) {
      console.error('Error loading emitter library:', error);
      setEmitterLibrary([]);
    }
  };

  // Load blueprint library
  const loadBlueprintLibrary = () => {
    try {
      const saved = localStorage.getItem('wreckage_blueprint_library');
      if (saved) {
        setBlueprintLibrary(JSON.parse(saved));
      } else {
        setBlueprintLibrary([
          { name: 'Destruction Explosion Concussion Ring', path: '/effects/emitters/destruction_explosion_concussion_ring_03_emit.bp', preview: null },
          { name: 'Fire Plume', path: '/effects/emitters/destruction_fire_plume_01_emit.bp', preview: null }
        ]);
      }
    } catch (error) {
      console.error('Error loading blueprint library:', error);
      setBlueprintLibrary([]);
    }
  };

  // Handle library JSON file upload
  const handleLibraryUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (type === 'unit') {
        setUnitLibrary(data);
        localStorage.setItem('unit_library', JSON.stringify(data));
        alert(`Loaded ${data.categories?.length || 0} categories with ${data.categories?.reduce((sum, cat) => sum + cat.count, 0) || 0} units`);
      } else if (type === 'emitter') {
        setEmitterLibrary(data);
        localStorage.setItem('wreckage_emitter_library', JSON.stringify(data));
        alert(`Loaded ${data.length} emitters`);
      } else if (type === 'blueprint') {
        setBlueprintLibrary(data);
        localStorage.setItem('wreckage_blueprint_library', JSON.stringify(data));
        alert(`Loaded ${data.length} emitters`);
      }
    } catch (error) {
      alert('Error loading library file: ' + error.message);
    }
  };

  // Select unit from library
  const selectUnitFromLibrary = (unit) => {
    const newUnits = [...units];
    if (selectedUnit >= 0 && selectedUnit < newUnits.length) {
      newUnits[selectedUnit].unitType = unit.id;
      setUnits(newUnits);
    }
    setShowUnitLibrary(false);
    setSelectedCategory(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Select emitter from library
  const selectEmitterFromLibrary = (emitter) => {
    const mapName = prompt('Enter map name (e.g., Hades_Dust or Hades_Dust.v0001):');
    if (!mapName || !mapName.trim()) return;

    let finalMapName = mapName.trim();
    if (!finalMapName.match(/\.v\d{4}$/)) {
      finalMapName += '.v0001';
    }

    const newEmitters = [...emitters];
    const emptyIndex = newEmitters.findIndex(e => e === '');
    
    const relativePath = emitter.path.startsWith('/') ? emitter.path.substring(1) : emitter.path;
    const absolutePath = `/maps/${finalMapName}/${relativePath}`;
    
    if (emptyIndex !== -1) {
      newEmitters[emptyIndex] = absolutePath;
    } else {
      newEmitters.push(absolutePath);
    }
    
    setEmitters(newEmitters);
    setShowEmitterLibrary(false);
  };

  // Toggle blueprint selection (multi-select)
  const toggleBlueprintSelection = (emitter) => {
    setSelectedBlueprints(prev => {
      const isSelected = prev.some(e => e.path === emitter.path);
      if (isSelected) {
        return prev.filter(e => e.path !== emitter.path);
      } else {
        return [...prev, emitter];
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

  // Confirm blueprint selection
  const confirmBlueprintSelection = () => {
    if (selectedBlueprints.length === 0) return;

    const newBlueprintPaths = [...blueprintPaths].filter(p => p.trim() !== '');
    
    selectedBlueprints.forEach(emitter => {
      if (!newBlueprintPaths.includes(emitter.path)) {
        newBlueprintPaths.push(emitter.path);
      }
    });

    if (!newBlueprintPaths.some(p => p === '')) {
      newBlueprintPaths.push('');
    }

    setBlueprintPaths(newBlueprintPaths);
    setShowBlueprintLibrary(false);
    setSelectedBlueprints([]);
    setSelectedCategory(null);
  };

  // LocalStorage persistence
  useEffect(() => {
    try {
      localStorage.setItem('wreckage_mapSize', mapSize);
    } catch (e) {}
  }, [mapSize]);

  useEffect(() => {
    try {
      localStorage.setItem('wreckage_mapName', mapName);
    } catch (e) {}
  }, [mapName]);

  useEffect(() => {
    try {
      localStorage.setItem('wreckage_emitters', JSON.stringify(emitters));
    } catch (e) {}
  }, [emitters]);

  useEffect(() => {
    try {
      localStorage.setItem('wreckage_blueprintPaths', JSON.stringify(blueprintPaths));
    } catch (e) {}
  }, [blueprintPaths]);

  useEffect(() => {
    try {
      localStorage.setItem('wreckage_units', JSON.stringify(units));
    } catch (e) {}
  }, [units]);

  useEffect(() => {
    if (previewImageData) {
      const img = new Image();
      img.onload = () => setPreviewImage(img);
      img.src = previewImageData;
    }
  }, [previewImageData]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1024;
    const height = 1024;

    ctx.clearRect(0, 0, width, height);

    if (previewImage && previewImage.complete) {
      ctx.drawImage(previewImage, 0, 0, width, height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = width / 8;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(width, i * gridSize);
        ctx.stroke();
      }
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

    units.forEach((unit, unitIdx) => {
      unit.coordinates.forEach((coord) => {
        if (!coord.x || !coord.z) return;

        const x = (parseFloat(coord.x) / parseFloat(mapSize)) * width;
        const z = (parseFloat(coord.z) / parseFloat(mapSize)) * height;

        ctx.fillStyle = unit.color;
        ctx.shadowColor = unit.color;
        ctx.shadowBlur = unitIdx === selectedUnit ? 20 : 15;
        
        ctx.beginPath();
        ctx.arc(x, z, unitIdx === selectedUnit ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        
        if (unitIdx === selectedUnit) {
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
      });
    });
  }, [units, selectedUnit, previewImage, mapSize, mirrorMode]);

  // Emitter management
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

  // Blueprint Path management
  const updateBlueprintPath = (pathIndex, value) => {
    const newPaths = [...blueprintPaths];
    newPaths[pathIndex] = value;
    
    const lastPath = newPaths[newPaths.length - 1];
    if (lastPath && lastPath.trim() !== '') {
      newPaths.push('');
    }
    
    setBlueprintPaths(newPaths);
  };

  const deleteBlueprintPath = (pathIndex) => {
    const newPaths = [...blueprintPaths];
    if (newPaths.length === 1) {
      newPaths[0] = '';
    } else {
      newPaths.splice(pathIndex, 1);
    }
    setBlueprintPaths(newPaths);
  };

  // Unit management
  const addUnit = () => {
    const newUnit = {
      id: Date.now(),
      unitType: '',
      coordinates: [{ x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false }],
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    };
    setUnits([...units, newUnit]);
    setSelectedUnit(units.length);
  };

  const updateUnit = (index, field, value) => {
    const newUnits = [...units];
    newUnits[index][field] = value;
    setUnits(newUnits);
  };

  const deleteUnit = (index) => {
    if (units.length === 1) {
      setUnits([{
        id: Date.now(),
        unitType: '',
        coordinates: [{ x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false }],
        color: `hsl(${Math.random() * 360}, 70%, 60%)`
      }]);
      setSelectedUnit(0);
    } else {
      setUnits(units.filter((_, i) => i !== index));
      if (selectedUnit >= index && selectedUnit > 0) {
        setSelectedUnit(selectedUnit - 1);
      }
    }
  };

  const addCoordinate = (unitIndex) => {
    const newUnits = [...units];
    newUnits[unitIndex].coordinates.push({
      x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false
    });
    setUnits(newUnits);
  };

  const updateCoordinate = (unitIndex, coordIndex, field, value) => {
    const newUnits = [...units];
    newUnits[unitIndex].coordinates[coordIndex][field] = value;
    setUnits(newUnits);
  };

  const deleteCoordinate = (unitIndex, coordIndex) => {
    const newUnits = [...units];
    if (newUnits[unitIndex].coordinates.length === 1) {
      newUnits[unitIndex].coordinates[0] = {
        x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false
      };
    } else {
      newUnits[unitIndex].coordinates.splice(coordIndex, 1);
    }
    setUnits(newUnits);
  };

  const deleteAllCoordinates = (unitIndex) => {
    const newUnits = [...units];
    newUnits[unitIndex].coordinates = [{
      x: '', y: '', z: '', heading: 'math.pi', pitch: '0.0', roll: 'math.pi', isMirrored: false
    }];
    setUnits(newUnits);
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
    if (selectedUnit < 0 || selectedUnit >= units.length) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = ((e.clientX - rect.left) / rect.width) * 1024;
    const canvasZ = ((e.clientY - rect.top) / rect.height) * 1024;

    const mapSizeNum = parseFloat(mapSize) || 1024;
    const scale = mapSizeNum / 1024;
    
    const worldX = canvasX * scale;
    const worldZ = canvasZ * scale;

    const newUnits = [...units];
    
    if (mirrorMode === 'none') {
      const emptyCoordIndex = newUnits[selectedUnit].coordinates.findIndex(c => !c.x && !c.z);
      
      if (emptyCoordIndex !== -1) {
        newUnits[selectedUnit].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false
        };
      } else {
        newUnits[selectedUnit].coordinates.push({
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false
        });
      }
      
      setUnits(newUnits);
    } else {
      const mirrored = getMirroredCoords(worldX, worldZ, mapSize, mirrorMode);
      
      const emptyCoordIndex = newUnits[selectedUnit].coordinates.findIndex(c => !c.x && !c.z);
      
      if (emptyCoordIndex !== -1) {
        newUnits[selectedUnit].coordinates[emptyCoordIndex] = {
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false
        };
      } else {
        newUnits[selectedUnit].coordinates.push({
          x: worldX.toFixed(2),
          y: '26',
          z: worldZ.toFixed(2),
          heading: 'math.pi',
          pitch: '0.0',
          roll: 'math.pi',
          isMirrored: false
        });
      }
      
      newUnits[selectedUnit].coordinates.push({
        x: mirrored.x.toFixed(2),
        y: '26',
        z: mirrored.z.toFixed(2),
        heading: 'math.pi',
        pitch: '0.0',
        roll: 'math.pi',
        isMirrored: true
      });
      
      setUnits(newUnits);
    }
  };

  const markers = units.flatMap((unit, unitIdx) =>
    unit.coordinates
      .filter(coord => coord.x && coord.z)
      .map((coord, coordIdx) => ({
        id: `${unit.id}-${coordIdx}`,
        x: (parseFloat(coord.x) / parseFloat(mapSize)) * 100,
        z: (parseFloat(coord.z) / parseFloat(mapSize)) * 100,
        color: unit.color,
        unitType: unit.unitType || `Unit ${unitIdx + 1}`,
        isSelected: unitIdx === selectedUnit,
        isMirrored: coord.isMirrored
      }))
  );

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result;
        if (typeof imageData === 'string') {
          localStorage.setItem('shared_preview_image', imageData);
          setPreviewImageData(imageData);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert('Error loading image: ' + error.message);
    }
  };

  const generateFiles = async () => {
    try {
      const zip = new JSZip();
      
      // Get all valid emitter paths
      const validEmitterPaths = blueprintPaths.filter(e => e.trim());
      
      units.forEach((unit) => {
        if (!unit.unitType) return;
        
        const validCoords = unit.coordinates.filter(c => c.x && c.z);
        if (validCoords.length === 0) return;
        
        const unitId = unit.unitType.toLowerCase();
        
        validCoords.forEach((coord, coordIdx) => {
          const coordNumber = String(coordIdx + 1).padStart(2, '0');
          const instanceName = `${unitId}_${coordNumber}`;
          const folderPath = `wreckages/${unitId}/${instanceName}`;
          
          const x = parseFloat(coord.x) || 0;
          const y = parseFloat(coord.y) || 26;
          const z = parseFloat(coord.z) || 0;
          const heading = coord.heading || 'math.pi';
          const pitch = coord.pitch || '0.0';
          const roll = coord.roll || 'math.pi';
          
          // Randomly select an emitter for this wreckage
          let emitterPath = '/effects/emitters/destruction_explosion_concussion_ring_03_emit.bp';
          if (validEmitterPaths.length > 0) {
            const randomIndex = Math.floor(Math.random() * validEmitterPaths.length);
            emitterPath = validEmitterPaths[randomIndex];
          }
          
          // If mapName is set and path doesn't start with /maps/, add it
          if (mapName && emitterPath && !emitterPath.startsWith('/maps/')) {
            let finalMapName = mapName.trim();
            if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) {
              finalMapName += '.v0001';
            }
            const relativePath = emitterPath.startsWith('/') ? emitterPath.substring(1) : emitterPath;
            emitterPath = `/maps/${finalMapName}/${relativePath}`;
          }
          
          const propContent = `PropBlueprint {
    Display = {
        Mesh = {
            IconFadeInZoom = 4,
            LODs = {
                {
                    AlbedoName = '/env/common/props/marker01_albedo.dds',
                    MeshName = '/env/common/props/marker01_lod0.scm',
                    ShaderName = 'TMeshNoNormals',
                },
            },
        },
        UniformScale = 0,
    },
    Economy = {
        ReclaimEnergyMax = 0,
        ReclaimMassMax = 0,
    },
    Interface = {
        HelpText = '${instanceName}',
    },
    Physics = {
        BlockPath = false,
    },
    SizeX = 1,
    SizeY = 1,
    SizeZ = 1,
}`;
          
          const scriptContent = `local Prop = import('/lua/sim/Prop.lua').Prop

${instanceName} = Class(Prop) {

    _onCreateExecuted = false,

    OnCreate = function(self)
        Prop.OnCreate(self)

        if ${instanceName}._onCreateExecuted then
            LOG('${instanceName}: OnCreate skipped (already executed)')
            self:Destroy()
            return
        end

        ${instanceName}._onCreateExecuted = true
        LOG('${instanceName}: OnCreate executed')

        local unit = CreateUnitHPR('${unitId}', 'ARMY_17', ${x.toFixed(1)}, ${y}, ${z.toFixed(1)}, ${heading}, ${pitch}, ${roll})

        if unit and unit.DoNotCreateWreckage then
            unit:DoNotCreateWreckage(true)
        else
            LOG('${instanceName}: Warning - unit does not support DoNotCreateWreckage')
        end

        local wreck = unit:CreateWreckageProp(0)
        unit:Destroy()

        if wreck and wreck.Trash then
            wreck.Trash:Add(CreateEmitterAtBone(wreck, 0, -1, '${emitterPath}'))
        else
            LOG('${instanceName}: Warning - wreck or wreck.Trash is nil')
        end

        self:Destroy()
    end,
}

TypeClass = ${instanceName}`;
          
          zip.file(`${folderPath}/${instanceName}_prop.bp`, propContent);
          zip.file(`${folderPath}/${instanceName}_script.lua`, scriptContent);
        });
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wreckages.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Wreckage files generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      alert('Error generating files: ' + error.message);
    }
  };

  return (
    <div className="wreckage-tab">
      {/* Unit Library Sidebar - keeping original from Document 1 */}
      {showUnitLibrary && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 1999,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => {
              setShowUnitLibrary(false);
              setSelectedCategory(null);
              setSearchQuery('');
              setSearchResults([]);
            }}
          />
          
          <div 
            className="wreckage-library-sidebar"
            style={{
              position: 'fixed',
              left: '0',
              top: '0',
              bottom: '0',
              width: '500px',
              background: 'rgba(10, 10, 10, 0.98)',
              borderRight: '2px solid #FFFFFF',
              zIndex: 2000,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '5px 0 30px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.5rem' }}>
                  📚 Unit Library
                </h2>
                <button
                  className="wreckage-btn-icon"
                  onClick={() => {
                    setShowUnitLibrary(false);
                    setSelectedCategory(null);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={{ fontSize: '2rem', padding: '0 15px' }}
                >
                  ×
                </button>
              </div>
              
              <label 
                className="wreckage-btn-secondary"
                style={{ 
                  fontSize: '0.85rem', 
                  padding: '8px 16px',
                  cursor: 'pointer',
                  display: 'inline-block',
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                Upload Library JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => handleLibraryUpload(e, 'unit')}
                  style={{ display: 'none' }}
                />
              </label>
              
              {selectedCategory && !searchQuery && (
                <button
                  className="wreckage-btn-secondary"
                  onClick={() => setSelectedCategory(null)}
                  style={{ 
                    fontSize: '0.85rem', 
                    padding: '8px 16px',
                    marginTop: '10px',
                    width: '100%'
                  }}
                >
                  ← Back to Categories
                </button>
              )}

              {searchQuery && searchResults.length > 0 && (
                <button
                  className="wreckage-btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={{ 
                    fontSize: '0.85rem', 
                    padding: '8px 16px',
                    marginTop: '10px',
                    width: '100%'
                  }}
                >
                  ← Clear Search
                </button>
              )}
            </div>

            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <input
                type="text"
                placeholder="🔍 Search by unit name or ID..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="wreckage-form-input"
                style={{
                  width: '100%',
                  padding: '12px 16px'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {libraryLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⏳</div>
                  <p>Loading library...</p>
                </div>
              ) : searchQuery && searchResults.length > 0 ? (
                <div>
                  <h3 style={{ 
                    fontSize: '1rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '15px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Search Results ({searchResults.length})
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {searchResults.map((unit, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectUnitFromLibrary(unit)}
                        style={{
                          cursor: 'pointer',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '2px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '12px',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                      >
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
                          {unit.preview ? (
                            <img 
                              src={unit.preview}
                              alt={unit.name}
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
                                  fallback.style.cssText = 'color: var(--text-secondary); font-size: 1.5rem;';
                                  fallback.textContent = '🎮';
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '1.5rem' }}>🎮</span>
                          )}
                        </div>

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
                            {unit.name}
                          </div>
                          <div style={{ 
                            fontSize: '0.8rem', 
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace'
                          }}>
                            {unit.id}
                          </div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: 'rgba(255, 255, 255, 0.4)',
                            marginTop: '4px'
                          }}>
                            📁 {unit.categoryName}
                          </div>
                        </div>

                        <div style={{ 
                          color: 'rgba(255, 255, 255, 0.3)', 
                          fontSize: '1.2rem',
                          flexShrink: 0
                        }}>
                          →
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔍</div>
                  <p>No units found matching "{searchQuery}"</p>
                </div>
              ) : !selectedCategory ? (
                <div>
                  <h3 style={{ 
                    fontSize: '1rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '15px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Select Faction
                  </h3>
                  
                  {unitLibrary.categories && unitLibrary.categories.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {unitLibrary.categories.map((category, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedCategory(category.name)}
                          style={{
                            cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '20px',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            e.currentTarget.style.borderColor = '#FFFFFF';
                            e.currentTarget.style.transform = 'translateX(5px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
                          <div style={{ 
                            fontSize: '1.1rem', 
                            fontWeight: '600',
                            marginBottom: '8px',
                            color: '#fff'
                          }}>
                            {category.name}
                          </div>
                          <div style={{ 
                            fontSize: '0.85rem', 
                            color: 'var(--text-secondary)'
                          }}>
                            {category.count} unit{category.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📦</div>
                      <p>No categories found.</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '10px', lineHeight: '1.6' }}>
                        Upload a library JSON file.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px',
                    paddingBottom: '15px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{ 
                      fontSize: '1rem', 
                      color: 'var(--text-secondary)', 
                      margin: 0,
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {selectedCategory}
                    </h3>
                  </div>

                  {(() => {
                    const category = unitLibrary.categories.find(cat => cat.name === selectedCategory);
                    if (!category || !category.units || category.units.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                          <p>No units in this category.</p>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {category.units.map((unit, idx) => (
                          <div
                            key={idx}
                            onClick={() => selectUnitFromLibrary(unit)}
                            style={{
                              cursor: 'pointer',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '2px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '12px',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                          >
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
                              {unit.preview ? (
                                <img 
                                  src={unit.preview}
                                  alt={unit.name}
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
                                      fallback.style.cssText = 'color: var(--text-secondary); font-size: 1.5rem;';
                                      fallback.textContent = '🎮';
                                      parent.appendChild(fallback);
                                    }
                                  }}
                                />
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '1.5rem' }}>🎮</span>
                              )}
                            </div>

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
                                {unit.name}
                              </div>
                              <div style={{ 
                                fontSize: '0.8rem', 
                                color: 'var(--text-secondary)',
                                fontFamily: 'monospace'
                              }}>
                                {unit.id}
                              </div>
                            </div>

                            <div style={{ 
                              color: 'rgba(255, 255, 255, 0.3)', 
                              fontSize: '1.2rem',
                              flexShrink: 0
                            }}>
                              →
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Blueprint Library Modal - copying from PropsTab Document 2 */}
      {showBlueprintLibrary && (
        <>
          <div className="wreckage-library-overlay" onClick={() => setShowBlueprintLibrary(false)} />
          <div className="wreckage-library-sidebar">
            <div className="wreckage-library-header">
              <h2 className="wreckage-library-title">EMITTER LIBRARY</h2>
              <button
                className="wreckage-btn-close"
                onClick={() => setShowBlueprintLibrary(false)}
              >
                ×
              </button>
            </div>

            <div className="wreckage-library-content">
              <div className="wreckage-library-upload">
                <label className="wreckage-upload-label">
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
                <div className="wreckage-selection-info">
                  <span>{selectedBlueprints.length} emitter(s) selected</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="wreckage-btn-secondary"
                      onClick={() => setSelectedBlueprints([])}
                      style={{ padding: '8px 15px', fontSize: '0.8rem' }}
                    >
                      Clear All
                    </button>
                    <button
                      className="wreckage-btn-confirm"
                      onClick={confirmBlueprintSelection}
                    >
                      ✓ Add to Config
                    </button>
                  </div>
                </div>
              )}

              <div className="wreckage-emitter-list">
                {blueprintLibrary && blueprintLibrary.length > 0 ? (
                  blueprintLibrary.map((emitter, idx) => {
                    const isSelected = selectedBlueprints.some(
                      e => e.path === emitter.path
                    );

                    return (
                      <div
                        key={idx}
                        onClick={() => toggleBlueprintSelection(emitter)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          border: `2px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.1)'}`,
                          borderRadius: '8px',
                          padding: '12px',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          minHeight: '60px',
                          boxShadow: isSelected ? '0 0 20px rgba(255, 255, 255, 0.3)' : 'none',
                          marginBottom: '8px'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.borderColor = '#FFFFFF';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                      >
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
                            {emitter.name}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {emitter.path}
                          </div>
                        </div>

                        {isSelected && (
                          <div style={{
                            color: '#FFFFFF',
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            flexShrink: 0
                          }}>✓</div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="wreckage-empty-state">
                    <p>No emitter library loaded.</p>
                    <p>Upload a library JSON file to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="wreckage-content-grid">
        <div className="wreckage-config-column">
          <div className="wreckage-section-card">
            <h2 className="wreckage-section-title">
              <span className="wreckage-section-icon"></span>
              CONFIGURATION
            </h2>

            <div className="wreckage-form-group">
              <label className="wreckage-form-label">Map Name</label>
              <input
                type="text"
                className="wreckage-form-input"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                placeholder="e.g., Hades_Dust.v0001"
              />
            </div>

            <div className="wreckage-form-group">
              <label className="wreckage-form-label">Map Size</label>
              <input
                type="number"
                className="wreckage-form-input"
                value={mapSize}
                onChange={(e) => setMapSize(e.target.value)}
                placeholder="1024"
              />
            </div>

            <div className="wreckage-form-group">
              <label className="wreckage-form-label">Emitters</label>
              {blueprintPaths.map((path, idx) => {
                let displayPath = path;
                if (mapName && path) {
                  let finalMapName = mapName.trim();
                  if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) {
                    finalMapName += '.v0001';
                  }
                  const relativePath = path.startsWith('/') ? path.substring(1) : path;
                  displayPath = `/maps/${finalMapName}/${relativePath}`;
                }
                
                return (
                  <div key={idx} className="wreckage-input-with-button">
                    <input
                      type="text"
                      className="wreckage-form-input"
                      value={displayPath}
                      onChange={(e) => {
                        let newPath = e.target.value;
                        if (mapName && newPath.startsWith('/maps/')) {
                          let finalMapName = mapName.trim();
                          if (finalMapName && !finalMapName.match(/\.v\d{4}$/)) {
                            finalMapName += '.v0001';
                          }
                          const prefix = `/maps/${finalMapName}/`;
                          if (newPath.startsWith(prefix)) {
                            newPath = '/' + newPath.substring(prefix.length);
                          }
                        }
                        updateBlueprintPath(idx, newPath);
                      }}
                      placeholder="/maps/mapname.v0001/env/props/emitter/wreckages/Wreckage_smoke_03_emit.bp"
                    />
                    <button
                      className="wreckage-btn-delete"
                      onClick={() => deleteBlueprintPath(idx)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button 
                onClick={() => {
                  loadBlueprintLibrary();
                  setShowBlueprintLibrary(true);
                }} 
                className="wreckage-btn-library"
                style={{ width: '100%' }}
              >
                Library
              </button>
            </div>
          </div>

          <div className="wreckage-section-card">
            <h2 className="wreckage-section-title">
              <span className="wreckage-section-icon"></span>
              UNITS
            </h2>

            <div className="wreckage-units-grid">
              {units.map((unit, unitIdx) => (
                <div 
                  key={unit.id} 
                  className={`wreckage-unit-card ${unitIdx === selectedUnit ? 'selected' : ''}`}
                  onClick={() => setSelectedUnit(unitIdx)}
                >
                  <div className="wreckage-unit-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div
                        className="wreckage-color-indicator"
                        style={{ backgroundColor: unit.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowColorPicker(showColorPicker === unitIdx ? null : unitIdx);
                        }}
                      />
                      <span className="wreckage-unit-card-title">
                        Unit {unitIdx + 1}
                      </span>
                    </div>
                    <button
                      className="wreckage-btn-delete-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteUnit(unitIdx);
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {showColorPicker === unitIdx && (
                    <div 
                      className="wreckage-color-picker-dropdown"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="wreckage-color-grid">
                        {availableColors.map((colorOption, colorIdx) => (
                          <div
                            key={colorIdx}
                            className="wreckage-color-option"
                            style={{ 
                              backgroundColor: colorOption.color,
                              boxShadow: `0 0 10px ${colorOption.glow}`
                            }}
                            onClick={() => {
                              updateUnit(unitIdx, 'color', colorOption.color);
                              setShowColorPicker(null);
                            }}
                            title={colorOption.name}
                          />
                        ))}
                      </div>
                      <input
                        type="text"
                        className="wreckage-form-input"
                        placeholder="Custom color (#HEX or hsl())"
                        onChange={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            updateUnit(unitIdx, 'color', value);
                          }
                        }}
                        style={{ marginTop: '10px' }}
                      />
                    </div>
                  )}

                  <div className="wreckage-unit-card-content">
                    <div className="wreckage-input-with-button">
                      <input
                        type="text"
                        className="wreckage-form-input"
                        value={unit.unitType}
                        onChange={(e) => updateUnit(unitIdx, 'unitType', e.target.value)}
                        placeholder="UEL0203"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="wreckage-btn-library"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUnit(unitIdx);
                          setShowUnitLibrary(true);
                          loadUnitLibrary();
                        }}
                      >
                        Library
                      </button>
                    </div>

                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--text-secondary)',
                      marginTop: '12px'
                    }}>
                      {unit.coordinates.filter(c => c.x && c.z).length} coordinate{unit.coordinates.filter(c => c.x && c.z).length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {unitIdx === selectedUnit && (
                    <div className="wreckage-unit-coordinates" onClick={(e) => e.stopPropagation()}>
                      {unit.coordinates.map((coord, coordIdx) => (
                        <div key={coordIdx} className="wreckage-coordinate-entry">
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <span style={{ 
                              fontSize: '0.85rem', 
                              color: 'var(--text-secondary)',
                              fontWeight: '600'
                            }}>
                              Point {coordIdx + 1}
                            </span>
                            <button
                              className="wreckage-btn-delete-tiny"
                              onClick={() => deleteCoordinate(unitIdx, coordIdx)}
                            >
                              ×
                            </button>
                          </div>
                          <div className="wreckage-coord-grid">
                            <div className="wreckage-coord-field">
                              <label>X</label>
                              <input
                                type="text"
                                className="wreckage-form-input-small"
                                value={coord.x}
                                onChange={(e) => updateCoordinate(unitIdx, coordIdx, 'x', e.target.value)}
                                placeholder="256"
                              />
                            </div>
                            <div className="wreckage-coord-field">
                              <label>Y</label>
                              <input
                                type="text"
                                className="wreckage-form-input-small"
                                value={coord.y}
                                onChange={(e) => updateCoordinate(unitIdx, coordIdx, 'y', e.target.value)}
                                placeholder="26"
                              />
                            </div>
                            <div className="wreckage-coord-field">
                              <label>Z</label>
                              <input
                                type="text"
                                className="wreckage-form-input-small"
                                value={coord.z}
                                onChange={(e) => updateCoordinate(unitIdx, coordIdx, 'z', e.target.value)}
                                placeholder="256"
                              />
                            </div>
                          </div>
                          <div className="wreckage-coord-grid" style={{ marginTop: '10px' }}>
                            <div className="wreckage-coord-field">
                              <label>Heading</label>
                              <input
                                type="text"
                                className="wreckage-form-input-small"
                                value={coord.heading}
                                onChange={(e) => updateCoordinate(unitIdx, coordIdx, 'heading', e.target.value)}
                                placeholder="math.pi"
                              />
                            </div>
                            <div className="wreckage-coord-field">
                              <label>Pitch</label>
                              <input
                                type="text"
                                className="wreckage-form-input-small"
                                value={coord.pitch}
                                onChange={(e) => updateCoordinate(unitIdx, coordIdx, 'pitch', e.target.value)}
                                placeholder="0.0"
                              />
                            </div>
                            <div className="wreckage-coord-field">
                              <label>Roll</label>
                              <input
                                type="text"
                                className="wreckage-form-input-small"
                                value={coord.roll}
                                onChange={(e) => updateCoordinate(unitIdx, coordIdx, 'roll', e.target.value)}
                                placeholder="math.pi"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          className="wreckage-btn-secondary"
                          onClick={() => addCoordinate(unitIdx)}
                          style={{ flex: 1 }}
                        >
                          + Add Coordinate
                        </button>
                        {unit.coordinates.some(c => c.x && c.z) && (
                          <button
                            className="wreckage-btn-danger"
                            onClick={() => {
                              if (confirm('Delete all coordinates for this unit?')) {
                                deleteAllCoordinates(unitIdx);
                              }
                            }}
                            style={{ padding: '10px 20px' }}
                          >
                            Delete All
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="wreckage-add-unit-card" onClick={addUnit}>
                <div className="wreckage-add-unit-icon">
                  <span style={{ fontSize: '2rem' }}>+</span>
                </div>
                <span className="wreckage-add-unit-text">ADD UNIT TYPE</span>
              </div>
            </div>
          </div>

          <button onClick={generateFiles} className="wreckage-btn-primary btn-large">
            GENERATE FILES
          </button>
        </div>

        <div className="wreckage-preview-column">
          <div className="wreckage-section-card preview-card">
            <div className="wreckage-preview-header">
              <h2 className="wreckage-section-title" style={{ margin: 0 }}>
                <span className="wreckage-section-icon"></span>
                PREVIEW
              </h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  className="wreckage-btn-toggle"
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
                    className="btn-danger-small"
                    onClick={() => {
                      if (confirm('Delete preview image?')) {
                        localStorage.removeItem('shared_preview_image');
                        setPreviewImageData(null);
                        setPreviewImage(null);
                      }
                    }}
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    Delete Preview
                  </button>
                )}
              </div>
            </div>

            <div className="wreckage-upload-area" onClick={() => fileInputRef.current?.click()}>
              <span className="wreckage-upload-icon"></span>
              <span>Click to upload map image</span>
              <input
                ref={fileInputRef}
                type="file"
                className="wreckage-file-input"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>

            <div className="wreckage-canvas-container" style={{ position: 'relative', width: '700px', height: '700px' }}>
              <canvas
                ref={canvasRef}
                className="wreckage-preview-canvas"
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
                    title={marker.unitType}
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

              {!previewImage && units.every(u => u.coordinates.every(c => !c.x)) && (
                <div className="wreckage-canvas-placeholder">
                  Click on canvas to place units
                </div>
              )}
            </div>

            <div className="wreckage-legend">
              <div className="wreckage-legend-title">UNIT LEGEND</div>
              <div className="wreckage-legend-items">
                {units.map((unit, idx) => (
                  <div key={unit.id} className="wreckage-legend-item">
                    <div 
                      className="wreckage-legend-color"
                      style={{ backgroundColor: unit.color }}
                    />
                    <span>
                      {unit.unitType || `Unit ${idx + 1}`}
                    </span>
                    <span className="wreckage-coord-count">
                      {unit.coordinates.filter(c => c.x && c.z).length} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="wreckage-hint-box">
              Click on the canvas to place coordinates - {mirrorMode !== 'none' ? `${mirrorMode} mirroring active` : 'No mirroring'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WreckageTab;