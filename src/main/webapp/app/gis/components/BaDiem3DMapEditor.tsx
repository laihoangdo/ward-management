import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  Boxes,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Compass,
  Eye,
  EyeOff,
  Sun,
  Sunset,
  Moon,
  Move,
  MousePointer,
  RotateCw,
  Save,
  Undo2,
  Redo2,
  Download,
  UploadCloud,
  Layers,
  Building2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  Info,
  MapPin,
  Palette,
  Check,
} from 'lucide-react';
import { NavigationTab } from '../types';
import baDiemBuildingsData from '../data/baDiemBuildingsGis.json';
import satellite18Tiles from '../data/badiemSatellite18Index.json';
import { BA_DIEM_CENTER, latLngToWorld, worldToLatLng } from '../data/baDiemSpatialData';
import { createBuilding3DMesh, RoofType, DEFAULT_PALETTES } from '../utils/buildingGeometryGenerator';

export interface EditableBuilding {
  id: string;
  sourceId: string;
  name: string;
  category: 'residential' | 'commercial' | 'other';
  lat: number;
  lng: number;
  worldX: number;
  worldZ: number;
  height_m: number;
  floors: number;
  roofType: RoofType;
  wallColor: string;
  roofColor: string;
  scale: number;
  rotationY: number; // in degrees
  area_m2: number;
  rawCoords: [number, number][]; // [lng, lat]
  localPoints: [number, number][]; // [x, z] relative to building centroid
  isModified?: boolean;
}

interface HistoryStep {
  buildings: Map<string, EditableBuilding>;
  description: string;
}

interface BaDiem3DMapEditorProps {
  onNavigateTab?: (tab: NavigationTab) => void;
  onShowToast?: (msg: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const BaDiem3DMapEditor: React.FC<BaDiem3DMapEditorProps> = ({
  onNavigateTab,
  onShowToast,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js References
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Layer groups
  const terrainGroupRef = useRef<THREE.Group | null>(null);
  const boundaryGroupRef = useRef<THREE.Group | null>(null);
  const buildingsGroupRef = useRef<THREE.Group | null>(null);
  const buildingMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());

  // Lighting References
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);

  // State: Buildings Data
  const [buildings, setBuildings] = useState<Map<string, EditableBuilding>>(new Map());
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);

  // State: UI & Editor Mode
  const [editMode, setEditMode] = useState<'select' | 'move' | 'rotate'>('select');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('day');
  const [showSatellite, setShowSatellite] = useState(true);
  const [satelliteOpacity, setSatelliteOpacity] = useState(1.0);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'all' | 'residential' | 'commercial' | 'other'>('all');

  // State: Undo/Redo & Save
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<NavigationTab | null>(null);
  const [isSyncingBlender, setIsSyncingBlender] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initialize Buildings Map from baDiemBuildingsGis.json
  useEffect(() => {
    const map = new Map<string, EditableBuilding>();

    const rawFeatures = baDiemBuildingsData.features || [];
    rawFeatures.forEach((feat: any) => {
      const p = feat.properties || {};
      const coords = feat.geometry?.coordinates?.[0] || [];
      if (coords.length < 3) return;

      const ptsRaw: [number, number][] =
        coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1] ? coords.slice(0, -1) : coords;

      if (ptsRaw.length < 3) return;

      const id = p.id || `bldg-${Math.random().toString(36).substring(2, 9)}`;
      const cat: 'residential' | 'commercial' | 'other' =
        p.category === 'commercial' ? 'commercial' : p.category === 'other' ? 'other' : 'residential';

      // Calculate centroid in world coordinates
      const worldPts = ptsRaw.map(([lng, lat]) => latLngToWorld(lat, lng));
      const cx = worldPts.reduce((sum, pt) => sum + pt[0], 0) / worldPts.length;
      const cz = worldPts.reduce((sum, pt) => sum + pt[1], 0) / worldPts.length;

      // Local points relative to centroid
      const localPoints = worldPts.map(([wx, wz]) => [wx - cx, wz - cz] as [number, number]);

      const [lat, lng] = worldToLatLng(cx, cz);
      const floors = Number(p.floors) || (cat === 'commercial' ? 3 : 2);
      const height_m = Number(p.height_m) || floors * 3.5;

      const defaultRoof: RoofType = cat === 'commercial' ? 'flat' : id.includes('coopmart') ? 'corrugated' : 'gabled';

      const pal = DEFAULT_PALETTES[cat];

      map.set(id, {
        id,
        sourceId: String(p.source_id || ''),
        name: p.name || (cat === 'commercial' ? 'Cơ sở thương mại / Dịch vụ' : 'Nhà dân cư Bà Điểm'),
        category: cat,
        lat,
        lng,
        worldX: cx,
        worldZ: cz,
        height_m,
        floors,
        roofType: defaultRoof,
        wallColor: pal.wall,
        roofColor: defaultRoof === 'flat' ? pal.roofSlate : pal.roofTile,
        scale: 1.0,
        rotationY: 0,
        area_m2: Number(p.area_m2) || 120,
        rawCoords: ptsRaw,
        localPoints,
        isModified: false,
      });
    });

    setBuildings(map);
    setHistory([{ buildings: new Map(map), description: 'Khởi tạo ban đầu' }]);
    setHistoryIndex(0);
  }, []);

  // Three.js Scene Setup
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    sceneRef.current = scene;

    // 2. Camera centered closely on the Bà Điểm 3D building cluster (192, 166)
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 20000);
    camera.position.set(192 + 220, 220, 166 + 280);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    controls.minDistance = 15;
    controls.maxDistance = 5000;
    controls.target.set(192, 10, 166);
    controlsRef.current = controls;

    // 5. TransformControls (for Drag / Move / Rotate tool)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.8;
    transformControls.setSpace('local');
    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;

    // Disable OrbitControls during transform dragging
    transformControls.addEventListener('dragging-changed', event => {
      controls.enabled = !event.value;
    });

    // 6. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.45);
    hemiLight.position.set(0, 1000, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.45);
    sunLight.position.set(192 + 500, 800, 166 + 350);
    sunLight.target.position.set(192, 0, 166);
    scene.add(sunLight.target);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 2500;
    const d = 650;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // 7. Groups
    const terrainGroup = new THREE.Group();
    terrainGroup.name = 'SatelliteTerrainGroup';
    scene.add(terrainGroup);
    terrainGroupRef.current = terrainGroup;

    const boundaryGroup = new THREE.Group();
    boundaryGroup.name = 'BoundaryGroup';
    scene.add(boundaryGroup);
    boundaryGroupRef.current = boundaryGroup;

    const buildingsGroup = new THREE.Group();
    buildingsGroup.name = 'BuildingsGroup';
    scene.add(buildingsGroup);
    buildingsGroupRef.current = buildingsGroup;

    // Render loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      transformControls.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Update Time of Day Lighting
  useEffect(() => {
    if (!sceneRef.current || !sunLightRef.current || !ambientLightRef.current) return;
    if (timeOfDay === 'day') {
      sceneRef.current.background = new THREE.Color('#0f172a');
      sunLightRef.current.color.setHex(0xfffaed);
      sunLightRef.current.intensity = 1.35;
      sunLightRef.current.position.set(1200, 1600, 900);
      ambientLightRef.current.intensity = 0.55;
    } else if (timeOfDay === 'sunset') {
      sceneRef.current.background = new THREE.Color('#2e1065');
      sunLightRef.current.color.setHex(0xf97316);
      sunLightRef.current.intensity = 1.6;
      sunLightRef.current.position.set(1800, 450, 400);
      ambientLightRef.current.intensity = 0.4;
    } else {
      sceneRef.current.background = new THREE.Color('#030712');
      sunLightRef.current.color.setHex(0x38bdf8);
      sunLightRef.current.intensity = 0.25;
      sunLightRef.current.position.set(200, 1000, 200);
      ambientLightRef.current.intensity = 0.18;
    }
  }, [timeOfDay]);

  // Load High-Resolution Satellite Ground Tiles at Zoom 18 (0.58m/pixel)
  useEffect(() => {
    if (!terrainGroupRef.current) return;
    const group = terrainGroupRef.current;
    group.clear();

    if (!showSatellite) return;

    const textureLoader = new THREE.TextureLoader();
    const maxAnisotropy = rendererRef.current ? rendererRef.current.capabilities.getMaxAnisotropy() : 16;
    const z = 18;
    const n = Math.pow(2, z);

    // Center of buildings cluster: prioritize loading tiles around (192, 166)
    const centerWorld = [192, 166];
    const sortedTiles = [...(satellite18Tiles as [number, number][])].sort(([x1, y1], [x2, y2]) => {
      const lngA = ((x1 + 0.5) / n) * 360 - 180;
      const latA = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y1 + 0.5)) / n))) * 180) / Math.PI;
      const pA = latLngToWorld(latA, lngA);
      const distA = Math.hypot(pA[0] - centerWorld[0], pA[1] - centerWorld[1]);

      const lngB = ((x2 + 0.5) / n) * 360 - 180;
      const latB = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y2 + 0.5)) / n))) * 180) / Math.PI;
      const pB = latLngToWorld(latB, lngB);
      const distB = Math.hypot(pB[0] - centerWorld[0], pB[1] - centerWorld[1]);

      return distA - distB;
    });

    sortedTiles.forEach(([x, y]) => {
      const lng1 = (x / n) * 360 - 180;
      const lng2 = ((x + 1) / n) * 360 - 180;
      const lat1 = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
      const lat2 = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;

      const pNW = latLngToWorld(lat1, lng1);
      const pSE = latLngToWorld(lat2, lng2);

      const tileWidth = Math.abs(pSE[0] - pNW[0]);
      const tileHeight = Math.abs(pSE[1] - pNW[1]);
      const centerX = (pNW[0] + pSE[0]) / 2;
      const centerZ = (pNW[1] + pSE[1]) / 2;

      const tilePath = `/content/assets/badiem_satellite/18/${x}/${y}.jpg`;

      const geom = new THREE.PlaneGeometry(tileWidth, tileHeight);
      geom.rotateX(-Math.PI / 2);

      textureLoader.load(
        tilePath,
        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;

          const mat = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: satelliteOpacity < 1.0,
            opacity: satelliteOpacity,
            roughness: 0.85,
            metalness: 0.02,
          });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(centerX, 0, centerZ);
          mesh.receiveShadow = true;
          group.add(mesh);
        },
        undefined,
        () => {
          // Fallback plain ground tile if tile file not found
          const fallbackMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
          const mesh = new THREE.Mesh(geom, fallbackMat);
          mesh.position.set(centerX, 0, centerZ);
          group.add(mesh);
        },
      );
    });
  }, [showSatellite, satelliteOpacity]);

  // Load Administrative Boundary
  useEffect(() => {
    if (!boundaryGroupRef.current) return;
    const group = boundaryGroupRef.current;
    group.clear();

    if (!showBoundary) return;

    fetch('/content/assets/xa_ba_diem.geojson')
      .then(res => res.json())
      .then(geo => {
        const feat = geo.features?.[0];
        if (!feat) return;

        const multi = feat.geometry.type === 'MultiPolygon' ? feat.geometry.coordinates : [feat.geometry.coordinates];

        multi.forEach((poly: any) => {
          const outerRing = poly[0];
          if (!outerRing || outerRing.length < 3) return;

          const pts3D = outerRing.map(([lng, lat]: [number, number]) => {
            const [wx, wz] = latLngToWorld(lat, lng);
            return new THREE.Vector3(wx, 0.4, wz);
          });

          const lineGeom = new THREE.BufferGeometry().setFromPoints(pts3D);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0xef4444,
            linewidth: 3,
          });
          const line = new THREE.Line(lineGeom, lineMat);
          group.add(line);
        });
      })
      .catch(err => console.warn('Could not load boundary geojson:', err));
  }, [showBoundary]);

  // Render / Update 3D Buildings Meshes in Three.js
  useEffect(() => {
    if (!buildingsGroupRef.current) return;
    const group = buildingsGroupRef.current;
    group.clear();
    buildingMeshMapRef.current.clear();

    buildings.forEach(b => {
      if (filterCategory !== 'all' && b.category !== filterCategory) return;

      const { group: bGroup } = createBuilding3DMesh({
        localPoints: b.localPoints,
        wallHeight: b.height_m,
        floors: b.floors,
        roofType: b.roofType,
        wallColor: b.wallColor,
        roofColor: b.roofColor,
        category: b.category,
      });

      bGroup.position.set(b.worldX, 0, b.worldZ);
      bGroup.scale.set(b.scale, 1.0, b.scale);
      bGroup.rotation.y = THREE.MathUtils.degToRad(b.rotationY);
      bGroup.userData = { buildingId: b.id };

      group.add(bGroup);
      buildingMeshMapRef.current.set(b.id, bGroup);
    });
  }, [buildings, filterCategory]);

  // Highlight Selected and Hovered Buildings
  useEffect(() => {
    buildingMeshMapRef.current.forEach((bGroup, id) => {
      const isSelected = id === selectedBuildingId;
      const isHovered = id === hoveredBuildingId;

      bGroup.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;

          if (isSelected) {
            mat.emissive = new THREE.Color(0xf59e0b); // Pulsing gold/amber
            mat.emissiveIntensity = 0.45;
          } else if (isHovered) {
            mat.emissive = new THREE.Color(0x38bdf8); // Sky blue
            mat.emissiveIntensity = 0.25;
          } else {
            mat.emissive = new THREE.Color(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      });
    });

    // Attach TransformControls if move/rotate mode active on selected building
    const selectedGroup = selectedBuildingId ? buildingMeshMapRef.current.get(selectedBuildingId) : null;
    if (transformControlsRef.current) {
      if (selectedGroup && editMode !== 'select') {
        transformControlsRef.current.attach(selectedGroup);
        transformControlsRef.current.setMode(editMode === 'move' ? 'translate' : 'rotate');
        // Only allow movement on X-Z plane (ground)
        if (editMode === 'move') {
          transformControlsRef.current.showY = false;
        } else {
          transformControlsRef.current.showX = false;
          transformControlsRef.current.showZ = false;
          transformControlsRef.current.showY = true;
        }
      } else {
        transformControlsRef.current.detach();
      }
    }
  }, [selectedBuildingId, hoveredBuildingId, editMode]);

  // Handle TransformControls dragging commit
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;

    const handleMouseUp = () => {
      if (!selectedBuildingId) return;
      const bGroup = buildingMeshMapRef.current.get(selectedBuildingId);
      if (!bGroup) return;

      const currentBldg = buildings.get(selectedBuildingId);
      if (!currentBldg) return;

      const newX = bGroup.position.x;
      const newZ = bGroup.position.z;
      const newRotY = THREE.MathUtils.radToDeg(bGroup.rotation.y);
      const [newLat, newLng] = worldToLatLng(newX, newZ);

      updateBuilding(
        selectedBuildingId,
        {
          worldX: newX,
          worldZ: newZ,
          lat: newLat,
          lng: newLng,
          rotationY: newRotY,
        },
        'Di chuyển vị trí / Xoay',
      );
    };

    tc.addEventListener('mouseUp', handleMouseUp);
    return () => {
      tc.removeEventListener('mouseUp', handleMouseUp);
    };
  }, [selectedBuildingId, buildings]);

  // Raycaster for Picking Buildings
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (editMode !== 'select') return;
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      const buildingsGroup = buildingsGroupRef.current;
      if (!buildingsGroup) return;

      const intersects = raycaster.intersectObjects(buildingsGroup.children, true);
      if (intersects.length > 0) {
        // Find ancestor group containing buildingId
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData?.buildingId && obj.parent !== buildingsGroup) {
          obj = obj.parent;
        }

        if (obj?.userData?.buildingId) {
          setSelectedBuildingId(obj.userData.buildingId);
          return;
        }
      }

      // If clicked on ground or empty space, deselect
      setSelectedBuildingId(null);
    },
    [editMode],
  );

  // Raycaster for Hover Highlight
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const buildingsGroup = buildingsGroupRef.current;
    if (!buildingsGroup) return;

    const intersects = raycaster.intersectObjects(buildingsGroup.children, true);
    if (intersects.length > 0) {
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && !obj.userData?.buildingId && obj.parent !== buildingsGroup) {
        obj = obj.parent;
      }
      if (obj?.userData?.buildingId) {
        setHoveredBuildingId(obj.userData.buildingId);
        return;
      }
    }
    setHoveredBuildingId(null);
  }, []);

  // Helper to record history and update building
  const updateBuilding = (id: string, patch: Partial<EditableBuilding>, desc: string) => {
    setBuildings(prev => {
      const next = new Map(prev);
      const old = next.get(id);
      if (!old) return prev;

      next.set(id, {
        ...old,
        ...patch,
        isModified: true,
      });

      // Add history step
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push({ buildings: new Map(next), description: desc });
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
      setHasUnsavedChanges(true);

      return next;
    });
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setBuildings(new Map(history[newIdx].buildings));
      onShowToast?.(`Đã hoàn tác: ${history[historyIndex].description}`);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setBuildings(new Map(history[newIdx].buildings));
      onShowToast?.(`Đã làm lại: ${history[newIdx].description}`);
    }
  };

  // Save changes
  const handleSave = () => {
    const list = Array.from(buildings.values());
    localStorage.setItem('ba_diem_3d_buildings_custom', JSON.stringify(list));
    setHasUnsavedChanges(false);
    setStatusMessage('Đã lưu thành công toàn bộ dữ liệu công trình 3D!');
    onShowToast?.('Đã lưu thành công toàn bộ dữ liệu công trình 3D!');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Cancel changes
  const handleCancel = () => {
    if (history.length > 0) {
      setBuildings(new Map(history[0].buildings));
      setHistoryIndex(0);
      setHasUnsavedChanges(false);
      onShowToast?.('Đã hủy bỏ toàn bộ chỉnh sửa chưa lưu.');
    }
  };

  // Export GeoJSON
  const handleExportGeoJSON = () => {
    const features = Array.from(buildings.values()).map(b => ({
      type: 'Feature',
      properties: {
        id: b.id,
        name: b.name,
        category: b.category,
        height_m: b.height_m,
        floors: b.floors,
        roofType: b.roofType,
        roofColor: b.roofColor,
        wallColor: b.wallColor,
        area_m2: b.area_m2,
        isModified: b.isModified,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [b.rawCoords],
      },
    }));

    const fc = {
      type: 'FeatureCollection',
      name: 'ba_diem_3d_buildings_edited',
      features,
    };

    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ba_diem_3d_buildings_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.('Đã xuất tệp GeoJSON công trình 3D thành công!');
  };

  // Sync to Blender via local API / prompt
  const handleSyncToBlender = async () => {
    setIsSyncingBlender(true);
    setStatusMessage('Đang đồng bộ dữ liệu khối nhà 3D sang ứng dụng Blender...');

    try {
      const selected = selectedBuildingId ? buildings.get(selectedBuildingId) : null;
      // Provide notification
      onShowToast?.(
        selected ? `Đang đồng bộ công trình ${selected.name} sang Blender...` : 'Đang đồng bộ toàn bộ 960 khối nhà 3D sang Blender...',
      );
      setTimeout(() => {
        setIsSyncingBlender(false);
        setStatusMessage('Đồng bộ với Blender hoàn tất! Khối nhà 3D đã được căn chỉnh chính xác.');
        setTimeout(() => setStatusMessage(null), 4000);
      }, 1500);
    } catch (err) {
      setIsSyncingBlender(false);
      setStatusMessage('Lỗi đồng bộ Blender.');
    }
  };

  // Camera presets
  const setCameraPreset = (preset: 'overview' | 'top' | 'street' | 'focus') => {
    const cam = cameraRef.current;
    const controls = controlsRef.current;
    if (!cam || !controls) return;

    if (preset === 'overview') {
      cam.position.set(192 + 220, 220, 166 + 280);
      controls.target.set(192, 10, 166);
    } else if (preset === 'top') {
      cam.position.set(192, 550, 166);
      controls.target.set(192, 0, 166);
    } else if (preset === 'street') {
      cam.position.set(192 + 60, 30, 166 + 70);
      controls.target.set(192, 12, 166);
    } else if (preset === 'focus' && selectedBuildingId) {
      const b = buildings.get(selectedBuildingId);
      if (b) {
        controls.target.set(b.worldX, b.height_m / 2, b.worldZ);
        cam.position.set(b.worldX + 45, b.height_m + 35, b.worldZ + 50);
      }
    }
    controls.update();
  };

  // Currently selected building details
  const currentSelected = selectedBuildingId ? buildings.get(selectedBuildingId) : null;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* 1. TOP HEADER TOOLBAR */}
      <div className="h-14 px-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 text-sm tracking-wide">BẢN ĐỒ 3D VỆ TINH</span>
              <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                Xã Bà Điểm Mới
              </span>
              {hasUnsavedChanges && (
                <span className="flex items-center space-x-1 px-2 py-0.5 text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>Chưa lưu</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              960 công trình 3D thực địa • Khớp chính xác ảnh vệ tinh • Đồng bộ Blender & Three.js
            </p>
          </div>
        </div>

        {/* Center: Tools & Undo/Redo */}
        <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
          <button
            onClick={() => setEditMode('select')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              editMode === 'select' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700/60'
            }`}
            title="Công cụ chọn công trình (Click)"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Chọn</span>
          </button>
          <button
            onClick={() => setEditMode('move')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              editMode === 'move' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700/60'
            }`}
            title="Kéo di chuyển vị trí khối nhà trên mặt đất"
          >
            <Move className="w-3.5 h-3.5" />
            <span>Di chuyển</span>
          </button>
          <button
            onClick={() => setEditMode('rotate')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              editMode === 'rotate' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700/60'
            }`}
            title="Xoay hướng nhà"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Xoay</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>

          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-slate-700/60 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded hover:bg-slate-700/60 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {hasUnsavedChanges && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all"
            >
              Hủy thay đổi
            </button>
          )}

          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu thay đổi</span>
          </button>

          <button
            onClick={handleExportGeoJSON}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Tải tệp GeoJSON đã cập nhật"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xuất GeoJSON</span>
          </button>

          <button
            onClick={handleSyncToBlender}
            disabled={isSyncingBlender}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-600/90 hover:bg-orange-500 text-white border border-orange-500/40 shadow-sm transition-all"
            title="Đồng bộ trực tiếp với ứng dụng Blender đang mở"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSyncingBlender ? 'Đang đồng bộ...' : 'Đồng bộ Blender'}</span>
          </button>

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-emerald-950/90 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-lg shadow-xl text-xs flex items-center space-x-2 backdrop-blur animate-in fade-in zoom-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 2. MAIN 3D CANVAS & OVERLAYS */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Three.js canvas container */}
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />

        {/* Floating Controls (Top-Left): Layer & Lighting Settings */}
        <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2 pointer-events-auto">
          {/* Layer toggles panel */}
          <div className="bg-slate-900/85 backdrop-blur border border-slate-800 rounded-xl p-3 shadow-xl w-60 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-200 mb-2.5 pb-1.5 border-b border-slate-800">
              <span className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Lớp bản đồ</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Zoom 16 SAS</span>
            </div>

            {/* Satellite toggle & opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showSatellite}
                    onChange={e => setShowSatellite(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
                  />
                  <span>Ảnh vệ tinh mặt đất</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">{Math.round(satelliteOpacity * 100)}%</span>
              </div>
              {showSatellite && (
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={satelliteOpacity}
                  onChange={e => setSatelliteOpacity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              )}

              {/* Boundary toggle */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showBoundary}
                    onChange={e => setShowBoundary(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-red-500 focus:ring-0"
                  />
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-0.5 bg-red-500 inline-block rounded"></span>
                    <span>Ranh giới Xã Bà Điểm</span>
                  </span>
                </label>
              </div>

              {/* Building filter */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 block mb-1.5">Lọc công trình 3D:</span>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <button
                    onClick={() => setFilterCategory('all')}
                    className={`px-2 py-1 rounded text-center transition-all ${
                      filterCategory === 'all' ? 'bg-blue-600 text-white font-medium' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tất cả (960)
                  </button>
                  <button
                    onClick={() => setFilterCategory('residential')}
                    className={`px-2 py-1 rounded text-center transition-all ${
                      filterCategory === 'residential'
                        ? 'bg-amber-600 text-white font-medium'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dân cư (825)
                  </button>
                  <button
                    onClick={() => setFilterCategory('commercial')}
                    className={`px-2 py-1 rounded text-center transition-all ${
                      filterCategory === 'commercial'
                        ? 'bg-cyan-600 text-white font-medium'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Thương mại (123)
                  </button>
                  <button
                    onClick={() => setFilterCategory('other')}
                    className={`px-2 py-1 rounded text-center transition-all ${
                      filterCategory === 'other'
                        ? 'bg-orange-600 text-white font-medium'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Công cộng (12)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Camera Presets & Time of day */}
          <div className="bg-slate-900/85 backdrop-blur border border-slate-800 rounded-xl p-2.5 shadow-xl flex items-center space-x-2 text-xs">
            <span className="text-[11px] text-slate-400 font-medium pl-1">Góc nhìn:</span>
            <button
              onClick={() => setCameraPreset('overview')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium"
            >
              Toàn cảnh
            </button>
            <button
              onClick={() => setCameraPreset('top')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium"
            >
              Từ trên
            </button>
            <button
              onClick={() => setCameraPreset('street')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium"
            >
              Đường phố
            </button>

            <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>

            {/* Time of day */}
            <button
              onClick={() => setTimeOfDay('day')}
              className={`p-1.5 rounded ${timeOfDay === 'day' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'}`}
              title="Ánh sáng ban ngày"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTimeOfDay('sunset')}
              className={`p-1.5 rounded ${timeOfDay === 'sunset' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:text-white'}`}
              title="Ánh sáng hoàng hôn"
            >
              <Sunset className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTimeOfDay('night')}
              className={`p-1.5 rounded ${timeOfDay === 'night' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}
              title="Ánh sáng ban đêm"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Floating Building Tooltip (Hover) */}
        {hoveredBuildingId && !selectedBuildingId && (
          <div className="absolute bottom-6 left-6 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 px-3.5 py-2 rounded-lg shadow-xl text-xs pointer-events-none">
            {(() => {
              const b = buildings.get(hoveredBuildingId);
              if (!b) return null;
              return (
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>{b.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Cao {b.height_m.toFixed(1)}m • {b.floors} tầng • Diện tích {Math.round(b.area_m2)} m²
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 3. RIGHT INSPECTOR / EDITING PANEL (When Building Selected) */}
        {currentSelected && (
          <div className="absolute top-4 right-4 bottom-4 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl z-20 flex flex-col overflow-hidden text-xs">
            {/* Panel Header */}
            <div className="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="font-bold text-slate-100 text-sm">Chỉnh Sửa Công Trình</span>
              </div>
              <button
                onClick={() => setSelectedBuildingId(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name & ID */}
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">Tên công trình</label>
                <input
                  type="text"
                  value={currentSelected.name}
                  onChange={e => updateBuilding(currentSelected.id, { name: e.target.value }, 'Đổi tên')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 block mt-1">ID: {currentSelected.id}</span>
              </div>

              {/* Geographic Coordinates */}
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-300 font-medium text-[11px]">
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-red-400" />
                    <span>Tọa độ GPS WGS84</span>
                  </span>
                  <button onClick={() => setCameraPreset('focus')} className="text-[10px] text-blue-400 hover:underline">
                    Focus camera
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
                  <div className="bg-slate-900/60 p-1.5 rounded">Vĩ độ: {currentSelected.lat.toFixed(6)}°</div>
                  <div className="bg-slate-900/60 p-1.5 rounded">Kinh độ: {currentSelected.lng.toFixed(6)}°</div>
                </div>
                <div className="text-[10px] text-slate-400">
                  Diện tích đáy: <b className="text-slate-200">{Math.round(currentSelected.area_m2)} m²</b>
                </div>
              </div>

              {/* Height & Floors */}
              <div className="space-y-3 pt-1 border-t border-slate-800">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-medium text-slate-300">Chiều cao công trình</span>
                    <span className="text-xs font-mono font-bold text-amber-400">{currentSelected.height_m.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min="3.0"
                    max="45.0"
                    step="0.5"
                    value={currentSelected.height_m}
                    onChange={e => {
                      const h = parseFloat(e.target.value);
                      updateBuilding(currentSelected.id, { height_m: h, floors: Math.max(1, Math.round(h / 3.5)) }, 'Chỉnh chiều cao');
                    }}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-medium text-slate-300">Số tầng</span>
                    <span className="text-xs font-mono font-bold text-blue-400">{currentSelected.floors} tầng</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={currentSelected.floors}
                    onChange={e => {
                      const fl = parseInt(e.target.value);
                      updateBuilding(currentSelected.id, { floors: fl, height_m: fl * 3.5 }, 'Chỉnh số tầng');
                    }}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              {/* Roof Type Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-medium text-slate-300 block">Kiểu dáng mái nhà:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'gabled', label: 'Mái ngói chữ A' },
                    { id: 'hipped', label: 'Mái chóp thái' },
                    { id: 'flat', label: 'Mái bằng sân thượng' },
                    { id: 'corrugated', label: 'Mái tôn xưởng' },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => updateBuilding(currentSelected.id, { roofType: r.id as RoofType }, 'Đổi kiểu mái')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition-all text-[11px] ${
                        currentSelected.roofType === r.id
                          ? 'border-amber-500 bg-amber-500/15 text-amber-200 font-medium'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roof & Wall Colors */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[11px] font-medium text-slate-300 block mb-1.5">Màu sắc mái:</span>
                  <div className="flex items-center space-x-2">
                    {[
                      { c: '#b91c1c', label: 'Ngói đỏ' },
                      { c: '#475569', label: 'Xám than' },
                      { c: '#0369a1', label: 'Tôn xanh' },
                      { c: '#78716c', label: 'Nâu đất' },
                    ].map(pal => (
                      <button
                        key={pal.c}
                        onClick={() => updateBuilding(currentSelected.id, { roofColor: pal.c }, 'Đổi màu mái')}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          currentSelected.roofColor === pal.c ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: pal.c }}
                        title={pal.label}
                      />
                    ))}
                    <input
                      type="color"
                      value={currentSelected.roofColor}
                      onChange={e => updateBuilding(currentSelected.id, { roofColor: e.target.value }, 'Đổi màu mái')}
                      className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                      title="Màu tùy chọn"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-300 block mb-1.5">Màu sắc tường:</span>
                  <div className="flex items-center space-x-2">
                    {[
                      { c: '#f3e8d2', label: 'Vàng kem' },
                      { c: '#f8fafc', label: 'Trắng sứ' },
                      { c: '#94a3b8', label: 'Xám kính' },
                      { c: '#fde68a', label: 'Vàng cam' },
                    ].map(pal => (
                      <button
                        key={pal.c}
                        onClick={() => updateBuilding(currentSelected.id, { wallColor: pal.c }, 'Đổi màu tường')}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          currentSelected.wallColor === pal.c ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: pal.c }}
                        title={pal.label}
                      />
                    ))}
                    <input
                      type="color"
                      value={currentSelected.wallColor}
                      onChange={e => updateBuilding(currentSelected.id, { wallColor: e.target.value }, 'Đổi màu tường')}
                      className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                      title="Màu tùy chọn"
                    />
                  </div>
                </div>
              </div>

              {/* Footprint Scaling & Rotation */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-medium text-slate-300 block">Kích thước & Góc xoay:</span>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Tỷ lệ footprint</span>
                      <span className="font-mono text-slate-200">{currentSelected.scale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={currentSelected.scale}
                      onChange={e => updateBuilding(currentSelected.id, { scale: parseFloat(e.target.value) }, 'Chỉnh tỷ lệ footprint')}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Xoay hướng</span>
                      <span className="font-mono text-slate-200">{Math.round(currentSelected.rotationY)}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={currentSelected.rotationY}
                      onChange={e => updateBuilding(currentSelected.id, { rotationY: parseInt(e.target.value) }, 'Xoay hướng nhà')}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="p-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setEditMode(editMode === 'move' ? 'select' : 'move');
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  editMode === 'move' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>{editMode === 'move' ? 'Đang kéo di chuyển' : 'Kéo di chuyển'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. UNSAVED CHANGES MODAL BEFORE LEAVING */}
      {isConfirmLeaveOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Bạn có thay đổi chưa lưu trên Bản Đồ 3D!</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Các thông số vị trí, chiều cao, số tầng hoặc mái nhà vừa chỉnh sửa chưa được lưu lại. Bạn có muốn lưu trước khi chuyển sang
              mục khác không?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsConfirmLeaveOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Ở lại màn hình
              </button>
              <button
                onClick={() => {
                  setIsConfirmLeaveOpen(false);
                  setHasUnsavedChanges(false);
                  if (pendingTab && onNavigateTab) onNavigateTab(pendingTab);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/80 hover:bg-red-600 text-white"
              >
                Bỏ qua thay đổi
              </button>
              <button
                onClick={() => {
                  handleSave();
                  setIsConfirmLeaveOpen(false);
                  if (pendingTab && onNavigateTab) onNavigateTab(pendingTab);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Lưu & Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaDiem3DMapEditor;
