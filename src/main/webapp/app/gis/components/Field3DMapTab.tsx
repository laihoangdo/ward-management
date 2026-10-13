import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Boxes,
  Layers,
  Compass,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Filter,
  Sliders,
  X,
  Search,
  Building2,
  Store,
  Landmark,
  MapPin,
  Phone,
  User,
  Users,
  Camera,
  Activity,
  Sun,
  Sunset,
  Moon,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Download,
  Copy,
  Printer,
  Share2,
  ChevronDown,
  Info,
  Trees,
  Route,
  Home,
  Check,
  Palette,
  Grid,
  Sparkles,
} from 'lucide-react';
import { HouseholdFacility, NavigationTab } from '../types';
import baDiemPoisGis from '../data/baDiemPoisGis.json';
import baDiemBoundaryGis from '../data/baDiemBoundaryGis.json';
import { latLngToWorld } from '../data/baDiemSpatialData';
import { SpatialRoad } from '../models/spatial3dTypes';
import { isCoordinateInBaDiem3dBoundary, isHouseholdVisibleIn3d } from '../utils/household3dEligibility';

// Match the EPSG:32648 origin recorded in data/hcmc_processed/dataset_manifest.json.
function vietMapLatLngToWorld(lat: number, lng: number): [number, number] {
  const a = 6378137;
  const e2 = 0.0066943799901413165;
  const ep2 = e2 / (1 - e2);
  const phi = (lat * Math.PI) / 180;
  const delta = ((lng - 105) * Math.PI) / 180;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const n = a / Math.sqrt(1 - e2 * sin * sin);
  const t = tan * tan;
  const c = ep2 * cos * cos;
  const A = cos * delta;
  const m =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const east = 500000 + 0.9996 * n * (A + ((1 - t + c) * A ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * A ** 5) / 120);
  const north =
    0.9996 *
    (m +
      n *
        tan *
        (A ** 2 / 2 + ((5 - t + 9 * c + 4 * c ** 2) * A ** 4) / 24 + ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * A ** 6) / 720));
  return [east - 672065.4606277763, -(north - 1200087.0524449677)];
}

// Invert the exact projection used above, rather than the older approximate map transform.
function vietMapWorldToLatLng(x: number, z: number): [number, number] {
  let lat = 10.85 - z / 110600;
  let lng = 106.56 + x / 109000;
  for (let i = 0; i < 5; i++) {
    const [px, pz] = vietMapLatLngToWorld(lat, lng);
    const [latX, latZ] = vietMapLatLngToWorld(lat + 0.00001, lng);
    const [lngX, lngZ] = vietMapLatLngToWorld(lat, lng + 0.00001);
    const a = (latX - px) / 0.00001;
    const b = (lngX - px) / 0.00001;
    const c = (latZ - pz) / 0.00001;
    const d = (lngZ - pz) / 0.00001;
    const determinant = a * d - b * c;
    if (Math.abs(determinant) < 1) break;
    const dx = x - px;
    const dz = z - pz;
    lat += (dx * d - b * dz) / determinant;
    lng += (a * dz - dx * c) / determinant;
  }
  return [lat, lng];
}

interface Field3DMapTabProps {
  households: HouseholdFacility[];
  capturingOfficerName: string;
  onSelectHousehold: (household: HouseholdFacility) => void;
  onAddHouseholdAtCoordinates?: (coordinates: [number, number]) => void;
  canAddHouseholds?: boolean;
  onNavigateTab?: (tab: NavigationTab) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

// 9 Blender Collections matching Ba_Diem_3D.blend design
export type BlenderCollectionKey =
  'boundary' | 'terrain' | 'majorRoads' | 'localRoads' | 'residential' | 'commercial' | 'civic' | 'vegetation' | 'pois' | 'households';

interface CollectionConfig {
  key: BlenderCollectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: string;
  description: string;
  visible: boolean;
  color: string;
}

const DEFAULT_COLLECTIONS: CollectionConfig[] = [
  {
    key: 'boundary',
    label: 'Ranh giới Hành chính (8 Ấp)',
    icon: Navigation,
    count: '9 ranh giới',
    description: 'Đường biên giới Xã Bà Điểm & ranh giới 8 ấp',
    visible: true,
    color: '#f43f5e',
  },
  {
    key: 'terrain',
    label: 'Nền Địa hình & Vệ tinh VietMap',
    icon: Layers,
    count: '1 bề mặt',
    description: 'Bề mặt cao độ thực địa & ảnh bản đồ vệ tinh VietMap',
    visible: true,
    color: '#0284c7',
  },
  {
    key: 'majorRoads',
    label: 'Trục Giao thông Chính (14 Tuyến)',
    icon: Route,
    count: '14 tuyến',
    description: 'Phan Văn Hớn, QL22, Nguyễn Ảnh Thủ... Sơn vạch tên đường trực địa 3D',
    visible: true,
    color: '#f59e0b',
  },
  {
    key: 'localRoads',
    label: 'Đường Nội bộ & Hẻm Dân cư',
    icon: Route,
    count: '668 đoạn hẻm',
    description: 'Mạng lưới hẻm liên ấp, nhúng tên đường & hẻm trực tiếp mặt đường',
    visible: true,
    color: '#94a3b8',
  },
  {
    key: 'residential',
    label: 'Khu Nhà ở Dân cư (825 Nhà)',
    icon: Home,
    count: '825 nhà',
    description: 'Nhà cấp 4 mái ngói chữ A, nhà ống, nhà phố liền kề',
    visible: true,
    color: '#38bdf8',
  },
  {
    key: 'commercial',
    label: 'Thương mại & Dịch vụ (123 Điểm)',
    icon: Store,
    count: '123 điểm',
    description: 'Siêu thị Co.opmart, Chợ Bà Điểm, cửa hàng mặt tiền',
    visible: true,
    color: '#fbbf24',
  },
  {
    key: 'civic',
    label: 'Cơ quan & Công trình Công cộng',
    icon: Landmark,
    count: '12 điểm',
    description: 'UBND Xã, Công an Xã, Trạm Y tế, Trường học, Chùa Vĩnh Phước',
    visible: true,
    color: '#a855f7',
  },
  {
    key: 'vegetation',
    label: 'Cây xanh & Vườn trầu Bà Điểm',
    icon: Trees,
    count: '24 cây & 4 vườn',
    description: 'Vườn cau trầu truyền thống, rặng tre và mảng xanh',
    visible: true,
    color: '#22c55e',
  },
  {
    key: 'pois',
    label: 'Địa danh & Điểm Cảnh báo (POIs)',
    icon: MapPin,
    count: '14 điểm mốc',
    description: 'Cột tiêu cảnh báo an ninh, trạm CSKV và địa danh lịch sử',
    visible: true,
    color: '#f97316',
  },
];

const householdCollection = (count: number): CollectionConfig => ({
  key: 'households',
  label: 'Hộ dân có tọa độ trong xã',
  icon: Users,
  count: `${count} hộ`,
  description: 'Điểm hộ dân trong ranh giới tạm; chưa gắn với dấu chân công trình',
  visible: true,
  color: '#10b981',
});

const HOUSEHOLD_STATUSES = [
  { key: 'normal', label: 'Bình thường', color: '#10b981' },
  { key: 'business', label: 'Kinh doanh', color: '#38bdf8' },
  { key: 'warning', label: 'Chú ý', color: '#f59e0b' },
  { key: 'alert', label: 'Cảnh báo', color: '#ef4444' },
] as const;
type HouseholdMarkerStatus = (typeof HOUSEHOLD_STATUSES)[number]['key'];
const HOUSEHOLD_TYPES = [
  { key: 'household', label: 'Nhà ở', color: '#52796f' },
  { key: 'business', label: 'Kinh doanh', color: '#927d58' },
  { key: 'special_monitoring', label: 'Theo dõi', color: '#a18eaf' },
] as const;
const householdMarkerStatus = (household: HouseholdFacility): HouseholdMarkerStatus =>
  household.status === 'business' || household.status === 'warning' || household.status === 'alert' ? household.status : 'normal';
const householdMarkerColor = (status: HouseholdMarkerStatus): string =>
  HOUSEHOLD_STATUSES.find(item => item.key === status)?.color ?? '#10b981';

// Camera Viewpoint Presets designed in Blender
interface CameraPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  position: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'overview',
    name: 'Toàn Cảnh Xã Bà Điểm (Overview)',
    badge: 'Camera Blender 1',
    description: 'Góc nhìn bao quát toàn bộ 7.4 km² xã Bà Điểm từ độ cao 2,000m',
    position: [-1000, 2000, 2500],
    target: [0, 0, 0],
  },
  {
    id: 'neighborhood',
    name: 'Cận Cảnh Cụm Dân Cư (Neighborhood)',
    badge: 'Camera Blender 2',
    description: 'Khu trung tâm Phan Văn Hớn - Ấp Tiền Lân - Chợ Bà Điểm ở độ cao 220m',
    position: [-150, 220, 450],
    target: [80, 0, -140],
  },
  {
    id: 'topdown',
    name: 'Bản Đồ Trực Giao 2D/3D (Top-Down Ortho)',
    badge: 'Camera Blender 3',
    description: 'Góc nhìn vệ tinh từ đỉnh đầu xuống toàn bộ ranh giới hành chính',
    position: [-1165, 5200, -265],
    target: [-1165, 0, -265],
  },
  {
    id: 'major_road_closeup',
    name: 'Cận Cảnh Sơn Vạch Phan Văn Hớn',
    badge: 'Camera Blender 4',
    description: 'Chiêm ngưỡng vạch sơn tên đường Phan Văn Hớn nhúng trực tiếp trên mặt đường nhựa',
    position: [-1399, 55, 1321],
    target: [-1444, 0, 1251],
  },
  {
    id: 'narrow_alley_closeup',
    name: 'Cận Cảnh Sơn Vạch Hẻm 414 Tô Ký',
    badge: 'Camera Blender 5',
    description: 'Chiêm ngưỡng chữ sơn tên hẻm 414 Tô Ký khảm trên mặt bê tông hẻm dân cư',
    position: [790, 12, -878],
    target: [782, 0, -890],
  },
  {
    id: 'admin_center',
    name: 'Trung Tâm Hành Chính (UBND & CA Xã)',
    badge: 'Trọng điểm ANTT',
    description: 'Khu vực cơ quan công quyền, Trụ sở Công an Xã và Trạm Y tế',
    position: [-220, 180, 220],
    target: [-115, 0, 15],
  },
  {
    id: 'market_zone',
    name: 'Chợ Bà Điểm & Ngã Ba Huyết Mạch',
    badge: 'Thương mại sầm uất',
    description: 'Giao lộ Phan Văn Hớn - Bà Điểm 4 tập trung mật độ dân cư đông đúc',
    position: [120, 140, 260],
    target: [210, 0, 80],
  },
  {
    id: 'junction_ql22',
    name: 'Nút Giao Quốc Lộ 22 - Nguyễn Ảnh Thủ',
    badge: 'Cửa ngõ Tây Bắc',
    description: 'Tuyến quốc lộ xuyên Á kết nối giao thông liên tỉnh',
    position: [-600, 280, -420],
    target: [-450, 0, -560],
  },
];

// Basemap Background Themes
export type BasemapTheme = 'dark_cyber' | 'vietmap_satellite' | 'architectural_slate' | 'contrast_light';

interface BasemapThemeConfig {
  id: BasemapTheme;
  name: string;
  badge: string;
  desc: string;
  bgColor: number;
  fogColor: number;
  fogDensity: number;
  terrainColor: number;
  useTexture: boolean;
  resBldgColor: number;
  resBldgEmissive: number;
  resBldgEmissiveInt: number;
  resEdgeColor: number;
  comBldgColor: number;
  comBldgEmissive: number;
  civicBldgColor: number;
  civicBldgEmissive: number;
  majorRoadColor: number;
  majorRoadEmissive: number;
  localRoadColor: number;
  localRoadEmissive: number;
  boundaryCommuneColor: number;
  boundaryHamletColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
}

const BASEMAP_THEMES: Record<BasemapTheme, BasemapThemeConfig> = {
  dark_cyber: {
    id: 'dark_cyber',
    name: 'Nền Tối Chỉ Huy (Digital Twin)',
    badge: 'Tương Phản Cao',
    desc: 'Nền xám đen kỹ thuật số, các khối nhà & trục đường phát sáng nổi bật tối đa',
    bgColor: 0x070c18,
    fogColor: 0x070c18,
    fogDensity: 0.000035,
    terrainColor: 0x0f172a,
    useTexture: false,
    resBldgColor: 0xf8fafc,
    resBldgEmissive: 0x1e293b,
    resBldgEmissiveInt: 0.25,
    resEdgeColor: 0x38bdf8,
    comBldgColor: 0xfbbf24,
    comBldgEmissive: 0xb45309,
    civicBldgColor: 0xa855f7,
    civicBldgEmissive: 0x7e22ce,
    majorRoadColor: 0xffffff,
    majorRoadEmissive: 0xf8fafc,
    localRoadColor: 0xffffff,
    localRoadEmissive: 0xe2e8f0,
    boundaryCommuneColor: 0xf43f5e,
    boundaryHamletColor: 0x06b6d4,
    sunIntensity: 1.4,
    hemiSkyColor: 0x38bdf8,
    hemiGroundColor: 0x020617,
  },
  vietmap_satellite: {
    id: 'vietmap_satellite',
    name: 'Vệ Tinh VietMap (Satellite)',
    badge: 'Ảnh Thực Địa',
    desc: 'Hiển thị bề mặt ảnh vệ tinh kết hợp đổ bóng và khối 3D tôn lên mái ngói',
    bgColor: 0x1e293b,
    fogColor: 0x1e293b,
    fogDensity: 0.000045,
    terrainColor: 0xffffff,
    useTexture: true,
    resBldgColor: 0xd97706,
    resBldgEmissive: 0x78350f,
    resBldgEmissiveInt: 0.15,
    resEdgeColor: 0x1e293b,
    comBldgColor: 0x0284c7,
    comBldgEmissive: 0x0369a1,
    civicBldgColor: 0x9333ea,
    civicBldgEmissive: 0x6b21a8,
    majorRoadColor: 0xf59e0b,
    majorRoadEmissive: 0xb45309,
    localRoadColor: 0x64748b,
    localRoadEmissive: 0x1e293b,
    boundaryCommuneColor: 0xef4444,
    boundaryHamletColor: 0x0284c7,
    sunIntensity: 1.6,
    hemiSkyColor: 0xe0f2fe,
    hemiGroundColor: 0x1e293b,
  },
  architectural_slate: {
    id: 'architectural_slate',
    name: 'Ghi Xám Đô Thị (Architectural)',
    badge: 'Quy Hoạch Đô Thị',
    desc: 'Nền xám ghi công trình nhã nhặn, tôn vinh hình khối kiến trúc và mạng lưới đường',
    bgColor: 0x1e293b,
    fogColor: 0x1e293b,
    fogDensity: 0.00004,
    terrainColor: 0x334155,
    useTexture: false,
    resBldgColor: 0xf8fafc,
    resBldgEmissive: 0x0f172a,
    resBldgEmissiveInt: 0.1,
    resEdgeColor: 0x0f172a,
    comBldgColor: 0x38bdf8,
    comBldgEmissive: 0x0284c7,
    civicBldgColor: 0xf59e0b,
    civicBldgEmissive: 0xd97706,
    majorRoadColor: 0xfbbf24,
    majorRoadEmissive: 0xb45309,
    localRoadColor: 0x94a3b8,
    localRoadEmissive: 0x334155,
    boundaryCommuneColor: 0xf43f5e,
    boundaryHamletColor: 0x06b6d4,
    sunIntensity: 1.5,
    hemiSkyColor: 0x94a3b8,
    hemiGroundColor: 0x0f172a,
  },
  contrast_light: {
    id: 'contrast_light',
    name: 'Sáng Tương Phản (High-Contrast)',
    badge: 'Đổ Bóng Sắc Nét',
    desc: 'Nền be sáng kết hợp mái ngói đỏ gạch Nam Bộ và các trục đường đen tương phản cao',
    bgColor: 0xe2e8f0,
    fogColor: 0xe2e8f0,
    fogDensity: 0.000035,
    terrainColor: 0xcbd5e1,
    useTexture: false,
    resBldgColor: 0xc2410c,
    resBldgEmissive: 0x7c2d12,
    resBldgEmissiveInt: 0.1,
    resEdgeColor: 0x0f172a,
    comBldgColor: 0x0369a1,
    comBldgEmissive: 0x075985,
    civicBldgColor: 0x7e22ce,
    civicBldgEmissive: 0x581c87,
    majorRoadColor: 0x0f172a,
    majorRoadEmissive: 0x1e293b,
    localRoadColor: 0x475569,
    localRoadEmissive: 0x1e293b,
    boundaryCommuneColor: 0xdc2626,
    boundaryHamletColor: 0x0284c7,
    sunIntensity: 1.8,
    hemiSkyColor: 0xf8fafc,
    hemiGroundColor: 0x94a3b8,
  },
};

type LightingMode = 'day' | 'sunset' | 'night' | 'tactical';

export const Field3DMapTab: React.FC<Field3DMapTabProps> = ({
  households,
  capturingOfficerName,
  onSelectHousehold,
  onAddHouseholdAtCoordinates,
  canAddHouseholds = false,
  onNavigateTab,
  isFullscreen: isFullscreenProp,
  onToggleFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fullscreen state: controlled by parent or fallback to local
  const [localFullscreen, setLocalFullscreen] = useState<boolean>(false);
  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : localFullscreen;

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any)?.webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any)?.webkitFullscreenElement && (document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setLocalFullscreen(prev => !prev);
    }
  };

  // Sync state if user exits fullscreen via browser button or Escape key
  useEffect(() => {
    const handleFsChange = () => {
      const isNativeFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!isNativeFs && isFullscreen) {
        if (onToggleFullscreen) onToggleFullscreen();
        else setLocalFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [isFullscreen, onToggleFullscreen]);

  // Lock body scroll when fullscreen is active to avoid iOS/mobile rubberband bounce
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isFullscreen]);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const householdPointsRef = useRef<THREE.Group | null>(null);
  const householdLocationsRef = useRef<Array<{ household: HouseholdFacility; position: THREE.Vector3 }>>([]);
  const householdLayerVisibleRef = useRef(true);
  const animFrameIdRef = useRef<number | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Lights & Fog refs
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  // Categorized mesh maps for 9 collections
  const collectionMeshMap = useRef<Map<BlenderCollectionKey, THREE.Mesh[]>>(new Map());
  // Original materials cache for hover/selection/mode restorations
  const originalMaterials = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  // Edge lines map
  const buildingEdgesMap = useRef<Map<string, THREE.LineSegments>>(new Map());

  // Interactive UI state
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<BasemapTheme>('dark_cyber');
  const [lightingMode, setLightingMode] = useState<LightingMode>('day');
  const [showEdges, setShowEdges] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [collections, setCollections] = useState<CollectionConfig[]>(DEFAULT_COLLECTIONS);
  const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>(CAMERA_PRESETS);
  const isVietMapModel = useRef(false);
  const [activePreset, setActivePreset] = useState<string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 640 : true);
  const [selectedRoadInfo, setSelectedRoadInfo] = useState<SpatialRoad | null>(null);
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [compassHeading, setCompassHeading] = useState<number>(0);

  // Mobile-specific UI toggles
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);
  const [isMobileThemeOpen, setIsMobileThemeOpen] = useState<boolean>(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);

  // Selected building details card
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh | null>(null);
  const [selectedBuildingInfo, setSelectedBuildingInfo] = useState<{
    id: string;
    name: string;
    category: string;
    height: number;
    floors: number;
    area: number;
    address: string;
    household?: HouseholdFacility;
    source: 'household' | 'osm' | 'poi' | 'vietmap';
  } | null>(null);
  const [selectedHouseholdMarker, setSelectedHouseholdMarker] = useState<HouseholdFacility | null>(null);
  const householdCardOpenedAtRef = useRef(0);
  const selectionPointerRef = useRef<{ x: number; y: number } | null>(null);
  const householdPressRef = useRef<{ pointerId: number; x: number; y: number; household: HouseholdFacility } | null>(null);
  const [isPlacingHousehold, setIsPlacingHousehold] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const placementPointerRef = useRef<{ x: number; y: number } | null>(null);
  const validHouseholds = useMemo(() => (households || []).filter(isHouseholdVisibleIn3d), [households]);
  const [householdDisplayMode, setHouseholdDisplayMode] = useState<'points' | 'houses'>('points');
  const [householdStatusFilters, setHouseholdStatusFilters] = useState<Record<HouseholdMarkerStatus, boolean>>({
    normal: true,
    business: true,
    warning: true,
    alert: true,
  });
  const [householdTypeFilters, setHouseholdTypeFilters] = useState<Record<HouseholdFacility['type'], boolean>>({
    household: true,
    business: true,
    special_monitoring: true,
  });
  const displayedHouseholds = useMemo(
    () => validHouseholds.filter(h => householdStatusFilters[householdMarkerStatus(h)] && householdTypeFilters[h.type]),
    [validHouseholds, householdStatusFilters, householdTypeFilters],
  );

  // Quick lookup dictionary for households by id and clean id (null-safe)
  const householdLookup = useMemo(() => {
    const map = new Map<string, HouseholdFacility>();
    (households || []).forEach(h => {
      if (!h || !h.id) return;
      map.set(h.id, h);
      map.set(h.id.replace('-', '_'), h);
      const cleanNum = h.id.replace(/[^0-9]/g, '');
      if (cleanNum) {
        map.set(`hh_${cleanNum}`, h);
        map.set(`hh-${cleanNum}`, h);
      }
    });
    return map;
  }, [households]);

  // Raycaster for mouse interaction
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);

  // Camera flight animation state
  const cameraAnimRef = useRef<{
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    targetTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null>(null);

  // Smooth fly camera to a specified position and look-at target
  const flyCameraTo = useCallback((pos: [number, number, number], target: [number, number, number], durationMs = 1200) => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraAnimRef.current = {
      startPos: cameraRef.current.position.clone(),
      targetPos: new THREE.Vector3(pos[0], pos[1], pos[2]),
      startTarget: controlsRef.current.target.clone(),
      targetTarget: new THREE.Vector3(target[0], target[1], target[2]),
      startTime: performance.now(),
      duration: durationMs,
    };
  }, []);

  useEffect(() => {
    setCollections(current =>
      current.some(layer => layer.key === 'households')
        ? current.map(layer => (layer.key === 'households' ? { ...layer, count: `${validHouseholds.length} hộ` } : layer))
        : current,
    );
  }, [validHouseholds.length, isLoading]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (isLoading || !scene) return;
    const group = new THREE.Group();
    group.name = 'Household_Location_Markers';
    group.visible = householdLayerVisibleRef.current;
    const locations = displayedHouseholds.map(household => {
      const [x, z] = vietMapLatLngToWorld(household.coordinates[0], household.coordinates[1]);
      return { household, position: new THREE.Vector3(x, 4, z) };
    });
    householdLocationsRef.current = locations;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        locations.flatMap(item => item.position.toArray()),
        3,
      ),
    );
    const colors = locations.flatMap(({ household }) => {
      const color = new THREE.Color(householdMarkerColor(householdMarkerStatus(household)));
      return [color.r, color.g, color.b];
    });
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const icon = document.createElement('canvas');
    icon.width = icon.height = 64;
    const context = icon.getContext('2d');
    if (context) {
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(32, 32, 27, 0, Math.PI * 2);
      context.fill();
    }
    const texture = new THREE.CanvasTexture(icon);
    const halo = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: texture,
        size: 20,
        sizeAttenuation: false,
        color: '#ffffff',
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
      }),
    );
    halo.renderOrder = 20;
    const cores = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: texture,
        size: 12,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    cores.renderOrder = 21;
    const points = new THREE.Group();
    points.name = 'Colored_Points';
    points.visible = householdDisplayMode === 'points';
    points.add(halo, cores);
    group.add(points);

    // Type-specific symbols mark household coordinates; dimensions and architecture are illustrative.
    const houses = new THREE.Group();
    houses.name = 'Illustrative_House_Markers';
    houses.visible = householdDisplayMode === 'houses';
    const residential = locations.filter(item => item.household.type === 'household');
    const businesses = locations.filter(item => item.household.type === 'business');
    const monitored = locations.filter(item => item.household.type === 'special_monitoring');
    const houseGeometries: THREE.BufferGeometry[] = [];
    const houseMaterials: THREE.Material[] = [];
    const box = new THREE.BoxGeometry(1, 1, 1);
    const roof = new THREE.ConeGeometry(1, 1, 4);
    const beacon = new THREE.SphereGeometry(1, 8, 6);
    houseGeometries.push(box, roof, beacon);
    const material = (color: string, emissiveIntensity = 0) => {
      const result = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.68,
        metalness: 0.08,
        emissive: color,
        emissiveIntensity,
      });
      houseMaterials.push(result);
      return result;
    };
    type Location = (typeof locations)[number];
    const addPart = (
      entries: Location[],
      shape: THREE.BufferGeometry,
      surface: THREE.Material,
      offset: [number, number, number],
      scale: [number, number, number],
      tintByStatus = false,
      rotationY = 0,
    ) => {
      if (!entries.length) return;
      const mesh = new THREE.InstancedMesh(shape, surface, entries.length);
      const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      const size = new THREE.Vector3(...scale);
      const matrix = new THREE.Matrix4();
      entries.forEach(({ household, position }, index) => {
        matrix.compose(new THREE.Vector3(position.x + offset[0], offset[1], position.z + offset[2]), quaternion, size);
        mesh.setMatrixAt(index, matrix);
        if (tintByStatus) mesh.setColorAt(index, new THREE.Color(householdMarkerColor(householdMarkerStatus(household))));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      houses.add(mesh);
    };

    // Residential marker: compact walls, pitched roof, visible entrance and windows.
    addPart(residential, box, material('#c9ddd5'), [0, 4, 0], [6.5, 8, 7]);
    addPart(residential, roof, material('#52796f'), [0, 9.6, 0], [5.2, 3.2, 5.2], false, Math.PI / 4);
    addPart(residential, box, material('#334155'), [0, 1.6, 3.57], [1.55, 3.2, 0.18]);
    addPart(residential, box, material('#7dd3fc', 0.22), [-1.8, 5.4, 3.58], [1.2, 1.55, 0.16]);
    addPart(residential, box, material('#7dd3fc', 0.22), [1.8, 5.4, 3.58], [1.2, 1.55, 0.16]);
    addPart(residential, box, material('#ffffff', 0.2), [0, 8.2, 3.62], [5.8, 0.42, 0.2], true);

    // Business marker: wider storefront, glass facade, canopy, flat roof and sign strip.
    addPart(businesses, box, material('#ddd3be'), [0, 4.25, 0], [9, 8.5, 7.5]);
    addPart(businesses, box, material('#927d58'), [0, 8.85, 0], [10, 0.7, 8.5]);
    addPart(businesses, box, material('#67e8f9', 0.27), [0, 2.5, 3.84], [7.4, 4.4, 0.18]);
    addPart(businesses, box, material('#0f172a'), [0, 2.5, 3.96], [0.16, 4.4, 0.1]);
    addPart(businesses, box, material('#ffffff', 0.2), [0, 5.1, 4.55], [10, 0.75, 2.2], true);
    addPart(businesses, box, material('#ffffff', 0.3), [0, 6.4, 3.91], [7.5, 1.35, 0.2], true);

    // A stepped roof distinguishes monitoring records as a symbol, not verified architecture.
    addPart(monitored, box, material('#d6c9df'), [0, 4, 0], [6.5, 8, 7]);
    addPart(monitored, box, material('#827092'), [0, 8.35, 0], [7.1, 0.7, 7.6]);
    addPart(monitored, box, material('#a18eaf'), [0, 9.2, -0.7], [4.6, 1, 4.8]);
    addPart(monitored, box, material('#334155'), [0, 1.6, 3.57], [1.55, 3.2, 0.18]);
    addPart(monitored, box, material('#c4b5fd', 0.22), [-1.8, 5.4, 3.58], [1.2, 1.55, 0.16]);
    addPart(monitored, box, material('#c4b5fd', 0.22), [1.8, 5.4, 3.58], [1.2, 1.55, 0.16]);
    addPart(monitored, box, material('#ffffff', 0.2), [0, 8.2, 3.9], [5.8, 0.42, 0.2], true);
    addPart(monitored, beacon, material('#fb7185', 0.65), [0, 12.4, 0], [1.1, 1.1, 1.1]);
    // A small screen-size dot keeps the house locations readable from the commune overview.
    const overviewDots = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: texture,
        size: 8,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    overviewDots.renderOrder = 21;
    houses.add(overviewDots);
    group.add(houses);
    scene.add(group);
    householdPointsRef.current = group;
    return () => {
      scene.remove(group);
      if (householdPointsRef.current === group) householdPointsRef.current = null;
      householdLocationsRef.current = [];
      geometry.dispose();
      texture.dispose();
      (halo.material as THREE.Material).dispose();
      (cores.material as THREE.Material).dispose();
      (overviewDots.material as THREE.Material).dispose();
      houseGeometries.forEach(item => item.dispose());
      houseMaterials.forEach(item => item.dispose());
    };
  }, [isLoading, displayedHouseholds]);

  useEffect(() => {
    const group = householdPointsRef.current;
    if (!group) return;
    const points = group.getObjectByName('Colored_Points');
    const houses = group.getObjectByName('Illustrative_House_Markers');
    if (points) points.visible = householdDisplayMode === 'points';
    if (houses) houses.visible = householdDisplayMode === 'houses';
  }, [householdDisplayMode, isLoading]);

  // Proportional, clamped, mathematically stable Zoom In / Zoom Out
  const handleZoom = (direction: 1 | -1) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const currentDist = offset.length();

    // 30% step: 0.72 closer for Zoom In, 1.35 farther for Zoom Out
    const factor = direction === 1 ? 0.72 : 1.35;
    const newDist = THREE.MathUtils.clamp(currentDist * factor, controls.minDistance + 2, controls.maxDistance - 50);

    if (currentDist > 0.001) {
      offset.multiplyScalar(newDist / currentDist);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    }
  };

  // 1. Initialize Three.js Scene, Camera, Renderer, Controls
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const themeCfg = BASEMAP_THEMES.dark_cyber;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeCfg.bgColor);
    scene.fog = new THREE.FogExp2(themeCfg.fogColor, themeCfg.fogDensity);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 50000);
    camera.position.set(-1000, 2000, 2500);
    cameraRef.current = camera;

    // Renderer with ACESFilmicToneMapping to prevent washed-out white blowout
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // OrbitControls with full Touch Gestures for mobile (1 finger rotate, 2 fingers pinch-zoom & pan)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 20;
    controls.maxDistance = 30000;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.target.set(0, 0, 0);
    controls.enableZoom = true;
    controls.zoomSpeed = 1.0;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controlsRef.current = controls;

    // Spatial Coordinate Grid Helper (Sa bàn kỹ thuật số - Mặc định Tắt)
    const grid = new THREE.GridHelper(7200, 72, 0x38bdf8, 0x1e293b);
    grid.position.y = 0.02;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    grid.visible = false;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Balanced Lighting Setup
    const sunLight = new THREE.DirectionalLight(0xfffbeb, themeCfg.sunIntensity);
    sunLight.position.set(-1200, 2400, 1600);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 7000;
    const d = 2800;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0002;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const hemiLight = new THREE.HemisphereLight(themeCfg.hemiSkyColor, themeCfg.hemiGroundColor, 0.55);
    hemiLight.position.set(0, 3000, 0);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.35);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // Load Blender GLTF Model: Ba_Diem_3D.glb
    const loader = new GLTFLoader();
    setIsLoading(true);
    setLoadingProgress(10);

    const modelPath = '/content/models/Ba_Diem_3D.glb?v=vietmap-massing-20261011';

    loader.load(
      modelPath,
      gltf => {
        setLoadingProgress(100);
        setIsLoading(false);

        const sceneBaDiem = gltf.scenes.find(s => s.name === 'Ba_Diem_Post_Merger_Available_Extent') || gltf.scene;
        isVietMapModel.current = sceneBaDiem.name === 'Ba_Diem_Post_Merger_Available_Extent';

        const group = new THREE.Group();
        group.name = 'BaDiem3D_Model_Root';

        DEFAULT_COLLECTIONS.forEach(col => {
          collectionMeshMap.current.set(col.key, []);
        });

        // Traverse all meshes, categorize and enhance materials & edges
        sceneBaDiem.traverse(obj => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              originalMaterials.current.set(mesh.uuid, mesh.material);
            }

            const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const isRoadPaint = sourceMaterials.some(
              material => material?.name?.includes('Mat_Road_Marking_Paint') || material?.name?.startsWith('Road_Paint_'),
            );
            const name = mesh.name || '';
            const parentName = mesh.parent?.name || '';
            const feature = mesh.parent?.userData?.source_id ? mesh.parent : mesh;
            const sourceId = String(feature.userData?.source_id || '');
            const isVietMapRoad =
              sourceId.startsWith('vietmap-road-') || name.startsWith('vietmap-road-') || parentName.startsWith('vietmap-road-');
            const isVietMapBuilding = sourceId.startsWith('vietmap-building-') || name.startsWith('vietmap-building-');
            const isBuildingDetail =
              name.startsWith('Roof_Detail_') ||
              name.startsWith('Facade_Panels_') ||
              parentName.startsWith('Roof_Detail_') ||
              parentName.startsWith('Facade_Panels_');
            const isMajorRoad =
              name.includes('Road_Major') || parentName.includes('Road_Major') || (isVietMapRoad && feature.userData?.category === 'major');
            const isLocalRoad =
              name.includes('Roads_Local') ||
              parentName.includes('Roads_Local') ||
              name.includes('Road_Alley') ||
              parentName.includes('Road_Alley') ||
              (isVietMapRoad && !isMajorRoad);

            if (name.startsWith('Boundary_') || parentName.startsWith('Boundary_')) {
              collectionMeshMap.current.get('boundary')?.push(mesh);
            } else if (
              name.startsWith('Terrain_') ||
              parentName.startsWith('Terrain_') ||
              name.startsWith('Flat_Ground_') ||
              parentName.startsWith('Flat_Ground_')
            ) {
              mesh.receiveShadow = true;
              mesh.castShadow = false;
              collectionMeshMap.current.get('terrain')?.push(mesh);
            } else if (isMajorRoad) {
              mesh.userData.isRoadPaint = isRoadPaint;
              collectionMeshMap.current.get('majorRoads')?.push(mesh);
            } else if (isLocalRoad) {
              mesh.userData.isRoadPaint = isRoadPaint;
              collectionMeshMap.current.get('localRoads')?.push(mesh);
            } else if (isVietMapBuilding || isBuildingDetail) {
              mesh.userData.isBuildingDetail = isBuildingDetail;
              collectionMeshMap.current.get('residential')?.push(mesh);
              if (!isBuildingDetail) createBuildingEdges(mesh, 0x38bdf8);
            } else if (name.startsWith('Bldg_Res_') || parentName.startsWith('Bldg_Res_')) {
              collectionMeshMap.current.get('residential')?.push(mesh);
              createBuildingEdges(mesh, 0x38bdf8);
            } else if (name.startsWith('Bldg_Com_') || parentName.startsWith('Bldg_Com_')) {
              collectionMeshMap.current.get('commercial')?.push(mesh);
              createBuildingEdges(mesh, 0xfde047);
            } else if (name.startsWith('Bldg_Pub_') || parentName.startsWith('Bldg_Pub_')) {
              collectionMeshMap.current.get('civic')?.push(mesh);
              createBuildingEdges(mesh, 0xc084fc);
            } else if (
              name.startsWith('Tree_') ||
              name.startsWith('Park_Green_') ||
              parentName.startsWith('Tree_') ||
              parentName.startsWith('Park_Green_')
            ) {
              collectionMeshMap.current.get('vegetation')?.push(mesh);
            } else if (name.startsWith('POI_') || parentName.startsWith('POI_')) {
              mesh.position.y = 1.5;
              collectionMeshMap.current.get('pois')?.push(mesh);
            }
          }
        });

        group.add(sceneBaDiem);
        scene.add(group);
        modelGroupRef.current = group;

        if (isVietMapModel.current) {
          const majorCount = new Set(
            (collectionMeshMap.current.get('majorRoads') || []).map(
              mesh => mesh.parent?.userData?.source_id || mesh.userData?.source_id || mesh.name,
            ),
          ).size;
          const localCount = new Set(
            (collectionMeshMap.current.get('localRoads') || []).map(
              mesh => mesh.parent?.userData?.source_id || mesh.userData?.source_id || mesh.name,
            ),
          ).size;
          setCollections(previous => [
            ...previous
              .filter(col => ['boundary', 'terrain', 'majorRoads', 'localRoads', 'residential'].includes(col.key))
              .map(col => {
                if (col.key === 'boundary')
                  return {
                    ...col,
                    label: 'Ranh giới xã Bà Điểm mới',
                    count: 'Ranh giới',
                    description: 'Ranh giới tham chiếu sau sáp nhập',
                  };
                if (col.key === 'terrain')
                  return { ...col, label: 'Nền địa hình', count: 'Nền phẳng', description: 'Chưa có dữ liệu cao độ được xác minh' };
                if (col.key === 'majorRoads')
                  return {
                    ...col,
                    label: 'Đường chính VietMap',
                    count: `${majorCount} đoạn`,
                    description: 'Tên có nguồn được sơn trực tiếp trên mặt đường',
                  };
                if (col.key === 'localRoads')
                  return {
                    ...col,
                    label: 'Đường địa phương và hẻm',
                    count: `${localCount} đoạn`,
                    description: 'Chỉ hiện tên đường và hẻm có trong dữ liệu',
                  };
                return {
                  ...col,
                  label: 'Công trình VietMap',
                  count: '190 khối',
                  description: 'Hình khối, mái và mặt đứng suy đoán từ 190 dấu chân công trình',
                };
              }),
            householdCollection(validHouseholds.length),
          ]);
          const bounds = new THREE.Box3().setFromObject(group);
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const span = Math.max(size.x, size.z);
          const buildingBodies = (collectionMeshMap.current.get('residential') || []).filter(mesh => !mesh.userData.isBuildingDetail);
          const buildingCenters = buildingBodies.map(mesh => new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
          const clusterRadius = 250;
          const clusterSeed = buildingCenters.reduce(
            (best, point) => {
              const neighbors = buildingCenters.filter(
                candidate => candidate.distanceToSquared(point) < clusterRadius * clusterRadius,
              ).length;
              return neighbors > best.neighbors ? { point, neighbors } : best;
            },
            { point: center, neighbors: 0 },
          ).point;
          const nearbyBuildings = buildingCenters.filter(point => point.distanceToSquared(clusterSeed) < clusterRadius * clusterRadius);
          const buildingTarget = nearbyBuildings.length
            ? nearbyBuildings.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(nearbyBuildings.length)
            : center;
          // const buildingPreset: CameraPreset = {
          //   id: 'buildings',
          //   name: 'Cận cảnh khối công trình VietMap',
          //   badge: 'Công trình',
          //   description: `${buildingBodies.length} dấu chân công trình; chọn một khối để zoom gần hơn`,
          //   position: [buildingTarget.x + 180, buildingTarget.y + 135, buildingTarget.z + 205],
          //   target: [buildingTarget.x, buildingTarget.y, buildingTarget.z],
          // };
          const overview: CameraPreset = {
            id: 'overview',
            name: 'Toàn cảnh xã Bà Điểm mới',
            badge: 'Toàn cảnh',
            description: 'Phạm vi dữ liệu VietMap hiện có sau sáp nhập',
            position: [center.x - span * 0.5, span * 1.1, center.z + span * 0.8],
            target: [center.x, 0, center.z],
          };
          const painted = [
            ...(collectionMeshMap.current.get('majorRoads') || []),
            ...(collectionMeshMap.current.get('localRoads') || []),
          ].find(mesh => mesh.userData.isRoadPaint);
          const paintCenter = painted ? new THREE.Box3().setFromObject(painted).getCenter(new THREE.Vector3()) : center;
          // const closeup: CameraPreset = {
          //   id: 'major_road_closeup',
          //   name: 'Tên đường sơn trên mặt đường',
          //   badge: 'Cận cảnh',
          //   description: 'Chữ tối gắn trực tiếp vào hình học mặt đường VietMap',
          //   position: [paintCenter.x + 50, paintCenter.y + 65, paintCenter.z + 70],
          //   target: [paintCenter.x, paintCenter.y, paintCenter.z],
          // };
          setCameraPresets([
            overview,
            // buildingPreset,
            { ...overview, id: 'topdown', name: 'Nhìn từ trên xuống', position: [center.x, span * 1.3, center.z + 1] },
          ]);
          // camera.position.set(...buildingPreset.position);
          // controls.target.set(...buildingPreset.target);
          controls.update();
          // setActivePreset(buildingPreset.id);
        }

        // Apply initial high-contrast dark theme
        applyThemeStyling('dark_cyber');
      },
      progress => {
        if (progress.total > 0) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          setLoadingProgress(pct);
        } else {
          setLoadingProgress(prev => Math.min(prev + 15, 90));
        }
      },
      error => {
        console.error('Error loading Ba_Diem_3D.glb:', error);
        setLoadError('Không thể nạp tệp mô hình 3D Ba_Diem_3D.glb.');
        setIsLoading(false);
      },
    );

    // Animation & Render Loop
    let lastHeadingUpdate = 0;
    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (cameraAnimRef.current) {
        const anim = cameraAnimRef.current;
        const elapsed = time - anim.startTime;
        const t = Math.min(elapsed / anim.duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        camera.position.lerpVectors(anim.startPos, anim.targetPos, ease);
        controls.target.lerpVectors(anim.startTarget, anim.targetTarget, ease);
        controls.update();

        if (t >= 1) {
          cameraAnimRef.current = null;
        }
      }

      if (isRotating && !cameraAnimRef.current && !householdPressRef.current) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.8;
      } else {
        controls.autoRotate = false;
      }

      controls.update();

      if (time - lastHeadingUpdate >= 100) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const angleRad = Math.atan2(forward.x, forward.z);
        const angleDeg = Math.round((angleRad * 180) / Math.PI);
        const heading = angleDeg < 0 ? angleDeg + 360 : angleDeg;
        setCompassHeading(previous => (previous === heading ? previous : heading));
        lastHeadingUpdate = time;
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // ResizeObserver for reliable viewport updates (fullscreen, mobile orientation, keyboard)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
          }
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    const handleWindowResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      controls.dispose();
    };
  }, []);

  // Synchronize canvas resize whenever fullscreen status changes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && rendererRef.current && cameraRef.current) {
        const w = containerRef.current.clientWidth || window.innerWidth;
        const h = containerRef.current.clientHeight || window.innerHeight;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };
    updateSize();
    const t1 = setTimeout(updateSize, 80);
    const t2 = setTimeout(updateSize, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isFullscreen]);

  // Helper: Create crisp architectural silhouette edges on building blocks
  const createBuildingEdges = (mesh: THREE.Mesh, edgeColor: number) => {
    try {
      const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 25);
      const edgeMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.85,
        linewidth: 1,
      });
      const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
      edgeLine.name = 'Edge_' + mesh.name;
      mesh.add(edgeLine);
      buildingEdgesMap.current.set(mesh.uuid, edgeLine);
    } catch {
      // Ignore geometry edge creation errors if any
    }
  };

  // 2. Apply Basemap Theme Styling (Colors, Lighting, Contrast)
  const applyThemeStyling = useCallback((themeKey: BasemapTheme) => {
    const theme = BASEMAP_THEMES[themeKey];
    const scene = sceneRef.current;
    const sun = sunLightRef.current;
    const hemi = hemiLightRef.current;
    if (!scene || !sun || !hemi) return;

    scene.background = new THREE.Color(theme.bgColor);
    scene.fog = new THREE.FogExp2(theme.fogColor, isVietMapModel.current ? theme.fogDensity * 0.18 : theme.fogDensity);

    sun.intensity = theme.sunIntensity;
    hemi.color.setHex(theme.hemiSkyColor);
    hemi.groundColor.setHex(theme.hemiGroundColor);

    const terrainMeshes = collectionMeshMap.current.get('terrain') || [];
    terrainMeshes.forEach(mesh => {
      if (theme.useTexture) {
        const orig = originalMaterials.current.get(mesh.uuid);
        if (orig) mesh.material = orig;
      } else {
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(theme.terrainColor),
          roughness: 0.92,
          metalness: 0.08,
        });
      }
    });

    const resMeshes = collectionMeshMap.current.get('residential') || [];
    resMeshes.forEach(mesh => {
      if (isVietMapModel.current) {
        const original = originalMaterials.current.get(mesh.uuid);
        if (original) mesh.material = original;
        return;
      }
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.resBldgColor),
        emissive: new THREE.Color(theme.resBldgEmissive),
        emissiveIntensity: theme.resBldgEmissiveInt,
        roughness: 0.45,
        metalness: 0.15,
      });
      const edge = buildingEdgesMap.current.get(mesh.uuid);
      if (edge) (edge.material as THREE.LineBasicMaterial).color.setHex(theme.resEdgeColor);
    });

    const comMeshes = collectionMeshMap.current.get('commercial') || [];
    comMeshes.forEach(mesh => {
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.comBldgColor),
        emissive: new THREE.Color(theme.comBldgEmissive),
        emissiveIntensity: 0.45,
        roughness: 0.35,
        metalness: 0.2,
      });
      const edge = buildingEdgesMap.current.get(mesh.uuid);
      if (edge) (edge.material as THREE.LineBasicMaterial).color.setHex(0xfde047);
    });

    const civicMeshes = collectionMeshMap.current.get('civic') || [];
    civicMeshes.forEach(mesh => {
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.civicBldgColor),
        emissive: new THREE.Color(theme.civicBldgEmissive),
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.25,
      });
      const edge = buildingEdgesMap.current.get(mesh.uuid);
      if (edge) (edge.material as THREE.LineBasicMaterial).color.setHex(0xc084fc);
    });

    const roadMaterials = (
      mesh: THREE.Mesh,
      roadMaterial: () => THREE.MeshStandardMaterial,
      paintColor: string,
    ): THREE.Material | THREE.Material[] => {
      const source = originalMaterials.current.get(mesh.uuid);
      const materials = Array.isArray(source) ? source : [source || (mesh.material as THREE.Material)];
      const styled = materials.map(material =>
        material.name.includes('Mat_Road_Marking_Paint') || material.name.startsWith('Road_Paint_')
          ? new THREE.MeshBasicMaterial({
              name: material.name,
              color: paintColor,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: -3,
              polygonOffsetUnits: -3,
            })
          : roadMaterial(),
      );
      return Array.isArray(source) ? styled : styled[0];
    };

    const majorRoads = collectionMeshMap.current.get('majorRoads') || [];
    majorRoads.forEach(mesh => {
      mesh.material = roadMaterials(
        mesh,
        () =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(isVietMapModel.current ? 0xf8fafc : theme.majorRoadColor),
            emissive: new THREE.Color(isVietMapModel.current ? 0x000000 : theme.majorRoadEmissive),
            roughness: 0.4,
            metalness: 0.15,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          }),
        '#0b1220',
      );
      mesh.renderOrder = mesh.userData.isRoadPaint ? 2 : 1;
    });

    const localRoads = collectionMeshMap.current.get('localRoads') || [];
    localRoads.forEach(mesh => {
      mesh.material = roadMaterials(
        mesh,
        () =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(isVietMapModel.current ? 0xf8fafc : theme.localRoadColor),
            emissive: new THREE.Color(isVietMapModel.current ? 0x000000 : theme.localRoadEmissive),
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          }),
        '#0b1220',
      );
      mesh.renderOrder = mesh.userData.isRoadPaint ? 2 : 1;
    });

    const boundaryMeshes = collectionMeshMap.current.get('boundary') || [];
    boundaryMeshes.forEach(mesh => {
      const isCommune = mesh.name.includes('Commune');
      const bColor = isCommune ? theme.boundaryCommuneColor : theme.boundaryHamletColor;
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(bColor),
        emissive: new THREE.Color(bColor),
        emissiveIntensity: 0.7,
        roughness: 0.2,
      });
    });
  }, []);

  const handleSelectTheme = (themeKey: BasemapTheme) => {
    setCurrentTheme(themeKey);
    applyThemeStyling(themeKey);
    setIsMobileThemeOpen(false);
  };

  const handleToggleEdges = () => {
    const next = !showEdges;
    setShowEdges(next);
    buildingEdgesMap.current.forEach(edge => {
      edge.visible = next;
    });
  };

  const handleToggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = next;
    }
  };

  const handleToggleCollection = useCallback((key: BlenderCollectionKey) => {
    setCollections(prev => {
      const next = prev.map(c => (c.key === key ? { ...c, visible: !c.visible } : c));
      const targetCol = next.find(c => c.key === key);
      if (key === 'households') {
        householdLayerVisibleRef.current = targetCol?.visible ?? true;
        if (householdPointsRef.current) householdPointsRef.current.visible = householdLayerVisibleRef.current;
      }
      const meshes = collectionMeshMap.current.get(key) || [];
      meshes.forEach(m => {
        m.visible = targetCol ? targetCol.visible : true;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const sun = sunLightRef.current;
    const hemi = hemiLightRef.current;
    const ambient = ambientLightRef.current;
    if (!scene || !sun || !hemi || !ambient) return;

    if (lightingMode === 'day') {
      applyThemeStyling(currentTheme);
    } else if (lightingMode === 'sunset') {
      scene.background = new THREE.Color(0x2c1408);
      scene.fog = new THREE.FogExp2(0x2c1408, 0.00004);
      sun.color.setHex(0xfb923c);
      sun.intensity = 2.0;
      sun.position.set(-2400, 800, 2600);
      hemi.color.setHex(0xfeb272);
      hemi.groundColor.setHex(0x78350f);
      hemi.intensity = 0.55;
      ambient.color.setHex(0x9a3412);
      ambient.intensity = 0.45;
    } else if (lightingMode === 'night') {
      scene.background = new THREE.Color(0x020617);
      scene.fog = new THREE.FogExp2(0x020617, 0.00004);
      sun.color.setHex(0x93c5fd);
      sun.intensity = 0.5;
      sun.position.set(1000, 2000, 1000);
      hemi.color.setHex(0x1e293b);
      hemi.groundColor.setHex(0x020617);
      hemi.intensity = 0.3;
      ambient.color.setHex(0x0f172a);
      ambient.intensity = 0.25;

      applyNightWindowGlow();
    } else if (lightingMode === 'tactical') {
      scene.background = new THREE.Color(0x050811);
      scene.fog = new THREE.FogExp2(0x050811, 0.000035);
      sun.color.setHex(0x94a3b8);
      sun.intensity = 1.0;
      sun.position.set(0, 3000, 0);
      hemi.color.setHex(0x1e293b);
      hemi.groundColor.setHex(0x020617);
      hemi.intensity = 0.35;
      ambient.color.setHex(0x1e293b);
      ambient.intensity = 0.3;

      applyTacticalHeatmapColors();
    }
  }, [lightingMode, currentTheme, applyThemeStyling]);

  const applyNightWindowGlow = () => {
    ['residential', 'commercial'].forEach(key => {
      const meshes = collectionMeshMap.current.get(key as BlenderCollectionKey) || [];
      meshes.forEach(m => {
        if ((m.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.emissive = new THREE.Color(0xf59e0b);
          mat.emissiveIntensity = 0.65;
          m.material = mat;
        }
      });
    });
  };

  const applyTacticalHeatmapColors = () => {
    ['residential', 'commercial', 'civic'].forEach(key => {
      const meshes = collectionMeshMap.current.get(key as BlenderCollectionKey) || [];
      meshes.forEach(m => {
        const name = m.name || '';
        let hh: HouseholdFacility | undefined;
        const match = name.match(/_hh_([a-zA-Z0-9_]+)/);
        if (match) {
          hh = householdLookup.get(match[1]) || householdLookup.get(`hh-${match[1]}`);
        }

        const mat = new THREE.MeshStandardMaterial({
          roughness: 0.3,
          metalness: 0.2,
        });

        if (hh) {
          if (hh.status === 'alert') {
            mat.color = new THREE.Color(0xef4444);
            mat.emissive = new THREE.Color(0x991b1b);
            mat.emissiveIntensity = 0.8;
          } else if (hh.status === 'warning') {
            mat.color = new THREE.Color(0xf59e0b);
            mat.emissive = new THREE.Color(0xb45309);
            mat.emissiveIntensity = 0.6;
          } else {
            mat.color = new THREE.Color(0x10b981);
            mat.emissive = new THREE.Color(0x065f46);
            mat.emissiveIntensity = 0.35;
          }
        } else {
          mat.color = new THREE.Color(0x334155);
          mat.emissive = new THREE.Color(0x0f172a);
          mat.emissiveIntensity = 0.15;
        }
        m.material = mat;
      });
    });
  };

  const handleToggleWireframe = () => {
    const next = !isWireframe;
    setIsWireframe(next);
    ['residential', 'commercial', 'civic', 'terrain', 'majorRoads'].forEach(key => {
      const meshes = collectionMeshMap.current.get(key as BlenderCollectionKey) || [];
      meshes.forEach(m => {
        if (Array.isArray(m.material)) {
          m.material.forEach(mat => {
            (mat as any).wireframe = next;
          });
        } else if (m.material) {
          (m.material as any).wireframe = next;
        }
      });
    });
  };

  const handleSelectPreset = (preset: CameraPreset) => {
    setActivePreset(preset.id);
    flyCameraTo(preset.position, preset.target, 1400);
    // On mobile screens, auto-close bottom sheet after selection
    if (window.innerWidth < 640) {
      setIsSidebarOpen(false);
    }
  };

  const householdAtScreenPoint = (clientX: number, clientY: number): HouseholdFacility | null => {
    const camera = cameraRef.current;
    const canvas = rendererRef.current?.domElement;
    if (!camera || !canvas || !householdPointsRef.current?.visible) return null;
    const rect = canvas.getBoundingClientRect();
    let nearest: HouseholdFacility | null = null;
    let nearestDistance = 14 * 14;
    for (const { household, position } of householdLocationsRef.current) {
      const projected = position.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const x = rect.left + ((projected.x + 1) * rect.width) / 2;
      const y = rect.top + ((1 - projected.y) * rect.height) / 2;
      const distance = (clientX - x) ** 2 + (clientY - y) ** 2;
      if (distance < nearestDistance) {
        nearest = household;
        nearestDistance = distance;
      }
    }
    return nearest;
  };

  const selectHouseholdMarker = (household: HouseholdFacility) => {
    if (selectedMesh) applyThemeStyling(currentTheme);
    setSelectedMesh(null);
    setSelectedBuildingInfo(null);
    setSelectedRoadInfo(null);
    householdCardOpenedAtRef.current = performance.now();
    setSelectedHouseholdMarker(household);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current || !cameraRef.current || !modelGroupRef.current) return;
    if (householdPressRef.current) return;
    if (isPlacingHousehold) {
      rendererRef.current.domElement.style.cursor = 'crosshair';
      return;
    }
    if (householdAtScreenPoint(e.clientX, e.clientY)) {
      if (hoveredMeshRef.current && hoveredMeshRef.current !== selectedMesh) applyThemeStyling(currentTheme);
      hoveredMeshRef.current = null;
      rendererRef.current.domElement.style.cursor = 'pointer';
      return;
    }
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, cameraRef.current);

    const targetMeshes: THREE.Mesh[] = [
      ...(collectionMeshMap.current.get('residential') || []),
      ...(collectionMeshMap.current.get('commercial') || []),
      ...(collectionMeshMap.current.get('civic') || []),
      ...(collectionMeshMap.current.get('pois') || []),
    ].filter(m => m.visible && !m.userData.isBuildingDetail);

    const intersects = raycaster.intersectObjects(targetMeshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      if (hoveredMeshRef.current !== hitMesh) {
        if (hoveredMeshRef.current && hoveredMeshRef.current !== selectedMesh) {
          applyThemeStyling(currentTheme);
        }
        hoveredMeshRef.current = hitMesh;
        if (hitMesh !== selectedMesh && (hitMesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const hMat = (hitMesh.material as THREE.MeshStandardMaterial).clone();
          hMat.emissive = new THREE.Color(0x38bdf8);
          hMat.emissiveIntensity = 0.75;
          hitMesh.material = hMat;
        }
        if (rendererRef.current.domElement) {
          rendererRef.current.domElement.style.cursor = 'pointer';
        }
      }
    } else {
      if (hoveredMeshRef.current && hoveredMeshRef.current !== selectedMesh) {
        applyThemeStyling(currentTheme);
      }
      hoveredMeshRef.current = null;
      if (rendererRef.current.domElement) {
        rendererRef.current.domElement.style.cursor = 'default';
      }
    }
  };

  const releaseHouseholdPress = () => {
    householdPressRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  const handlePointerDownCapture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || isPlacingHousehold) return;
    const household = householdAtScreenPoint(e.clientX, e.clientY);
    if (!household) return;
    // Capture before OrbitControls' native pointerdown listener starts rotating the camera.
    householdPressRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, household };
    cameraAnimRef.current = null;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
      controlsRef.current.enabled = false;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    if (!rendererRef.current || !cameraRef.current) return;
    if (householdPressRef.current) return;
    if (isPlacingHousehold) {
      placementPointerRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    selectionPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const householdPress = householdPressRef.current;
    if (householdPress?.pointerId === e.pointerId) {
      releaseHouseholdPress();
      if (Math.hypot(e.clientX - householdPress.x, e.clientY - householdPress.y) <= 8) {
        selectHouseholdMarker(householdPress.household);
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    if (!rendererRef.current || !cameraRef.current) return;
    const start = isPlacingHousehold ? placementPointerRef.current : selectionPointerRef.current;
    placementPointerRef.current = null;
    selectionPointerRef.current = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
    if (!isPlacingHousehold) {
      const household = householdAtScreenPoint(e.clientX, e.clientY);
      if (household) {
        selectHouseholdMarker(household);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(mouse, cameraRef.current);
      const targetMeshes: THREE.Mesh[] = [
        ...(collectionMeshMap.current.get('residential') || []),
        ...(collectionMeshMap.current.get('commercial') || []),
        ...(collectionMeshMap.current.get('civic') || []),
        ...(collectionMeshMap.current.get('pois') || []),
      ].filter(mesh => mesh.visible && !mesh.userData.isBuildingDetail);
      const hit = raycaster.intersectObjects(targetMeshes, false)[0];
      if (hit) selectBuildingMesh(hit.object as THREE.Mesh);
      return;
    }
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, cameraRef.current);
    const worldPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), worldPoint)) {
      setPlacementError('Không chọn được vị trí trên mặt đất. Hãy xoay góc nhìn rồi thử lại.');
      return;
    }
    const coordinates = vietMapWorldToLatLng(worldPoint.x, worldPoint.z);
    if (!isCoordinateInBaDiem3dBoundary(...coordinates)) {
      setPlacementError('Điểm chọn nằm ngoài ranh giới Bà Điểm đang dùng trên bản đồ.');
      return;
    }
    setPlacementError(null);
    setIsPlacingHousehold(false);
    onAddHouseholdAtCoordinates?.(coordinates);
  };

  const selectBuildingMesh = (mesh: THREE.Mesh) => {
    setSelectedRoadInfo(null);
    setSelectedHouseholdMarker(null);
    if (selectedMesh) {
      applyThemeStyling(currentTheme);
    }

    setSelectedMesh(mesh);

    if ((mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const selMat = (mesh.material as THREE.MeshStandardMaterial).clone();
      selMat.color = new THREE.Color(0xfbbf24);
      selMat.emissive = new THREE.Color(0xf59e0b);
      selMat.emissiveIntensity = 0.95;
      mesh.material = selMat;
    }

    const name = mesh.name || '';
    let category = 'Khu dân cư';
    if (name.startsWith('Bldg_Com_')) category = 'Thương mại & Dịch vụ';
    if (name.startsWith('Bldg_Pub_')) category = 'Công trình Công cộng';
    if (name.startsWith('POI_')) category = 'Địa danh & Điểm cảnh báo';

    let hh: HouseholdFacility | undefined;
    let bldgId = name;
    let source: 'household' | 'osm' | 'poi' | 'vietmap' = 'osm';

    if (isVietMapModel.current) {
      source = 'vietmap';
      category = 'Công trình VietMap; kiểu khối ước lượng';
      bldgId = String(mesh.userData.source_id || mesh.parent?.userData?.source_id || name);
    }

    if (name.includes('_hh_')) {
      const hhPart = name.split('_hh_')[1];
      hh = householdLookup.get(hhPart) || householdLookup.get(`hh-${hhPart}`);
      bldgId = `Hộ dân #${hhPart}`;
      source = 'household';
    } else if (name.startsWith('POI_')) {
      bldgId = name.replace('POI_Beacon_', '').replace('POI_Label_', '');
      source = 'poi';
    }

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);

    const heightM = Math.round(size.y * 10) / 10 || 7.5;
    const areaM2 = Math.round(size.x * size.z) || 96;
    const floors = source === 'vietmap' ? 0 : Math.max(1, Math.round(heightM / 3.5));

    setSelectedBuildingInfo({
      id: bldgId,
      name: hh
        ? String(hh.ownerName || (hh as any).name || 'Hộ dân')
        : source === 'vietmap'
          ? `Công trình ${bldgId}`
          : name.replace(/_/g, ' '),
      category,
      height: heightM,
      floors,
      area: areaM2,
      address:
        source === 'vietmap'
          ? 'Vị trí theo dấu chân VietMap; chưa có địa chỉ xác minh'
          : hh
            ? String((hh as any).address || `${hh.houseNumber || ''} ${hh.street || ''}, ${hh.hamlet || ''}`.trim())
            : 'Khu vực Xã Bà Điểm, TP. Hồ Chí Minh',
      household: hh,
      source,
    });
  };

  const handleFlyToSelectedBuilding = () => {
    if (!selectedMesh || !cameraRef.current || !controlsRef.current) return;
    const box = new THREE.Box3().setFromObject(selectedMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const flyPos: [number, number, number] = [center.x + 35, center.y + 25, center.z + 45];
    flyCameraTo(flyPos, [center.x, center.y, center.z], 1200);
  };

  const handleTakeScreenshot = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera || isCapturing) return;
    const size = renderer.getSize(new THREE.Vector2());
    const previousPixelRatio = renderer.getPixelRatio();
    setIsCapturing(true);
    setCaptureFeedback(null);
    try {
      const context = renderer.getContext();
      const maxSize = context.getParameter(context.MAX_RENDERBUFFER_SIZE) as number;
      const scale = Math.min(2, maxSize / Math.max(size.x, size.y));
      renderer.setPixelRatio(1);
      renderer.setSize(Math.round(size.x * scale), Math.round(size.y * scale), false);
      renderer.render(scene, camera);

      const source = renderer.domElement;
      const headerHeight = 96;
      const footerHeight = 48;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = source.width;
      exportCanvas.height = source.height + headerHeight + footerHeight;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Không thể tạo ảnh PNG');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, exportCanvas.width, headerHeight);
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText('BẢN ĐỒ ĐỊA BÀN XÃ BÀ ĐIỂM', 28, 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('KHÔNG GIAN 3D • ĐƯỜNG, HẺM VÀ CÔNG TRÌNH', 28, 69);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Công an khu vực : ${capturingOfficerName}`, exportCanvas.width - 28, 38, exportCanvas.width * 0.4);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, headerHeight - 4, exportCanvas.width, 4);
      ctx.drawImage(source, 0, headerHeight);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, exportCanvas.height - footerHeight, exportCanvas.width, footerHeight);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px sans-serif';
      const capturedAt = new Date();
      const capturedTime = capturedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const capturedDate = capturedAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      ctx.fillText(`Trích xuất: ${capturedTime} ${capturedDate}`, 28, exportCanvas.height - 17);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Bản đồ xã Bà Điểm 3D', exportCanvas.width - 28, exportCanvas.height - 17);
      setScreenshotUrl(exportCanvas.toDataURL('image/png'));
      setIsShareMenuOpen(false);
    } catch (error) {
      console.error('Không thể chụp bản đồ 3D:', error);
      setCaptureFeedback('Không thể chụp ảnh 3D. Vui lòng thử lại.');
    } finally {
      renderer.setPixelRatio(previousPixelRatio);
      renderer.setSize(size.x, size.y, false);
      renderer.render(scene, camera);
      setIsCapturing(false);
    }
  };

  const handleDownloadScreenshot = () => {
    if (!screenshotUrl) return;
    const link = document.createElement('a');
    link.download = `Ba_Diem_3D_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.href = screenshotUrl;
    link.click();
  };

  const handleCopyScreenshot = async () => {
    if (!screenshotUrl) return;
    try {
      const blob = await (await fetch(screenshotUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCaptureFeedback('Đã sao chép ảnh. Có thể dán bằng Ctrl+V.');
    } catch {
      setCaptureFeedback('Trình duyệt không cho phép sao chép ảnh; hãy tải PNG để sử dụng.');
    }
  };

  const handleShareScreenshot = async () => {
    if (!screenshotUrl) return;
    if (navigator.share) {
      try {
        const blob = await (await fetch(screenshotUrl)).blob();
        const file = new File([blob], 'Ba_Diem_3D.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'Bản đồ 3D xã Bà Điểm', files: [file] });
          return;
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    setIsShareMenuOpen(previous => !previous);
  };

  const handlePrintScreenshot = () => {
    if (!screenshotUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setCaptureFeedback('Trình duyệt đã chặn cửa sổ in ảnh.');
      return;
    }
    const image = printWindow.document.createElement('img');
    image.src = screenshotUrl;
    image.alt = 'Ảnh chụp bản đồ 3D xã Bà Điểm';
    image.style.cssText = 'display:block;max-width:100%;height:auto;margin:auto';
    printWindow.document.title = 'Ảnh chụp bản đồ 3D xã Bà Điểm';
    printWindow.document.body.style.margin = '0';
    printWindow.document.body.appendChild(image);
    image.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  useEffect(() => {
    if (!screenshotUrl) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setScreenshotUrl(null);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [screenshotUrl]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const matches: {
      id: string;
      title: string;
      subtitle: string;
      type: 'household' | 'poi' | 'hamlet' | 'street';
      hh?: HouseholdFacility;
      coords?: [number, number];
    }[] = [];

    // 1. Search only households eligible for this 3D extent.
    validHouseholds.forEach(h => {
      if (!h) return;
      const ownerName = String(h.ownerName || (h as any).name || '');
      const houseNum = String(h.houseNumber || '');
      const street = String(h.street || '');
      const address = String((h as any).address || `${houseNum} ${street}`.trim());
      const hamlet = String(h.hamlet || '');
      const phone = String(h.ownerPhone || (h as any).phone || '');
      const code = String(h.code || '');

      if (
        (ownerName && ownerName.toLowerCase().includes(q)) ||
        (address && address.toLowerCase().includes(q)) ||
        (street && street.toLowerCase().includes(q)) ||
        (hamlet && hamlet.toLowerCase().includes(q)) ||
        (phone && phone.toLowerCase().includes(q)) ||
        (houseNum && houseNum.toLowerCase().includes(q)) ||
        (code && code.toLowerCase().includes(q))
      ) {
        matches.push({
          id: h.id || `hh-${Math.random()}`,
          title: `${ownerName || 'Hộ dân'} - ${address || hamlet}`,
          subtitle: `${hamlet}${phone ? ` • SĐT: ${phone}` : ''} • ${h.residentsCount || (h as any).membersCount || 0} nhân khẩu`,
          type: 'household',
          hh: h,
        });
      }
    });

    // 2. Search Hamlets (8 Ấp)
    const hamlets = [
      { name: 'Ấp Tiền Lân', coords: [106.613, 10.853] as [number, number] },
      { name: 'Ấp Hậu Lân', coords: [106.608, 10.85] as [number, number] },
      { name: 'Ấp Bắc Lân', coords: [106.605, 10.863] as [number, number] },
      { name: 'Ấp Đông Lân', coords: [106.619, 10.857] as [number, number] },
      { name: 'Ấp Nam Lân', coords: [106.61, 10.843] as [number, number] },
      { name: 'Ấp Tây Lân', coords: [106.598, 10.852] as [number, number] },
      { name: 'Ấp 1', coords: [106.603, 10.867] as [number, number] },
      { name: 'Ấp 2', coords: [106.616, 10.864] as [number, number] },
    ];
    hamlets.forEach(h => {
      if (h.name.toLowerCase().includes(q)) {
        matches.push({
          id: `hamlet-${h.name}`,
          title: h.name,
          subtitle: 'Khu vực hành chính Xã Bà Điểm, TP. Hồ Chí Minh',
          type: 'hamlet',
          coords: h.coords,
        });
      }
    });

    // 3. Search Major Streets (14 Tuyến đường chính)
    const majorStreets = [
      { name: 'Đường Phan Văn Hớn', desc: 'Trục huyết mạch trung tâm Bà Điểm', coords: [106.611, 10.8525] as [number, number] },
      { name: 'Đường Nguyễn Ảnh Thủ', desc: 'Tuyến giao thông kết nối Quận 12', coords: [106.614, 10.862] as [number, number] },
      { name: 'Quốc Lộ 22', desc: 'Tuyến Xuyên Á kết nối Tây Ninh', coords: [106.604, 10.861] as [number, number] },
      { name: 'Đường Song Hành Quốc Lộ 22', desc: 'Tuyến song hành giảm tải QL22', coords: [106.608, 10.859] as [number, number] },
      { name: 'Quốc Lộ 1A', desc: 'Vành đai kết nối An Sương', coords: [106.621, 10.846] as [number, number] },
      { name: 'Đường Nguyễn Thị Sóc', desc: 'Kết nối Chợ Đầu Mối Hóc Môn', coords: [106.609, 10.865] as [number, number] },
      { name: 'Đường Bà Điểm 4', desc: 'Tuyến dân sinh Chợ Bà Điểm', coords: [106.613, 10.853] as [number, number] },
      { name: 'Đường Bà Điểm 12', desc: 'Khu dân cư Ấp Nam Lân', coords: [106.61, 10.848] as [number, number] },
      { name: 'Đường Hưng Lân', desc: 'Tuyến kết nối Vĩnh Lộc', coords: [106.602, 10.845] as [number, number] },
    ];
    majorStreets.forEach(st => {
      if (st.name.toLowerCase().includes(q)) {
        matches.push({
          id: `street-${st.name}`,
          title: st.name,
          subtitle: st.desc,
          type: 'street',
          coords: st.coords,
        });
      }
    });

    // 4. Search POIs
    (baDiemPoisGis as any)?.features?.forEach((f: any) => {
      const p = f?.properties;
      if (!p) return;
      const poiName = String(p.name || '');
      const poiAddress = String(p.address || '');
      if ((poiName && poiName.toLowerCase().includes(q)) || (poiAddress && poiAddress.toLowerCase().includes(q))) {
        matches.push({
          id: String(p.id || poiName),
          title: poiName,
          subtitle: poiAddress || 'Điểm mốc thực địa Xã Bà Điểm',
          type: 'poi',
          coords: f.geometry?.coordinates,
        });
      }
    });

    return matches.slice(0, 8);
  }, [searchQuery, validHouseholds]);

  return (
    <div
      ref={containerRef}
      className={`field3d-map relative w-full overflow-hidden bg-slate-950 font-sans select-none ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen h-[100dvh] w-screen w-[100dvw]' : 'h-full min-h-[480px] flex-1'
      }`}
    >
      {/* Three.js Canvas */}
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          placementPointerRef.current = null;
          selectionPointerRef.current = null;
          releaseHouseholdPress();
        }}
        onLostPointerCapture={e => {
          if (householdPressRef.current?.pointerId === e.pointerId) releaseHouseholdPress();
        }}
        className={`absolute inset-0 w-full h-full block touch-none ${isPlacingHousehold ? 'cursor-crosshair' : ''}`}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md text-white p-4">
          <div className="relative mb-4 flex items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
            <Boxes className="absolute w-7 h-7 sm:w-8 sm:h-8 text-blue-400 animate-pulse" />
          </div>
          <div className="text-base sm:text-lg font-bold tracking-wide text-white mb-1.5 text-center">
            Đang Tải Bản Đồ 3D Thực Địa Xã Bà Điểm
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mb-3 text-center max-w-sm">
            Đang tải 4.020 đoạn đường và 190 dấu chân công trình VietMap
          </p>
          <div className="w-60 sm:w-72 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
            <div
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <span className="text-[10px] sm:text-xs font-semibold text-blue-400 mt-2">{loadingProgress}% hoàn tất</span>
        </div>
      )}

      {/* TOP HUD BAR (Responsive on all screen sizes) */}
      <div
        className={`absolute top-2 sm:top-3 left-2 sm:left-4 right-2 sm:right-4 z-30 flex flex-col gap-2 pointer-events-none ${isSidebarOpen ? 'lg:left-[25.5rem]' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Left: Branding */}
          <div className="pointer-events-auto flex shrink-0 items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-xl rounded-2xl p-1.5 sm:p-2 px-2.5 sm:px-3 text-white">
            <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 shrink-0">
              <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold tracking-tight text-white whitespace-nowrap">3D Bà Điểm</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap hidden xs:inline">
                  Digital Twin
                </span>
              </div>
              <div className="text-[10px] text-slate-400 hidden sm:block">
                4.020 đoạn đường • 190 công trình • {validHouseholds.length} hộ hợp lệ • {collections.length} lớp
              </div>
            </div>
          </div>

          {/* Center: Desktop Search Input */}
          <div className="pointer-events-auto relative hidden min-w-[14rem] flex-1 md:block xl:max-w-sm">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm số nhà, chủ hộ, tuyến đường, ấp..."
                className="w-full bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl py-2.5 pl-9 pr-9 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xl"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-40 max-h-80 overflow-y-auto">
                {searchResults.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSearchQuery('');
                      if (item.type === 'household' && item.hh) {
                        const allMeshes = [
                          ...(collectionMeshMap.current.get('residential') || []),
                          ...(collectionMeshMap.current.get('commercial') || []),
                          ...(collectionMeshMap.current.get('civic') || []),
                        ];
                        const cleanId = String(item.hh.id || '').replace(/[^0-9]/g, '');
                        const targetMesh = allMeshes.find(m => {
                          const n = m.name || '';
                          return n.includes(String(item.hh!.id || '').replace('-', '_')) || (cleanId && n.includes(`_hh_${cleanId}`));
                        });
                        if (targetMesh) {
                          selectBuildingMesh(targetMesh);
                          const box = new THREE.Box3().setFromObject(targetMesh);
                          const c = new THREE.Vector3();
                          box.getCenter(c);
                          flyCameraTo([c.x + 30, c.y + 25, c.z + 40], [c.x, c.y, c.z], 1200);
                        } else if (item.hh.coordinates && item.hh.coordinates.length >= 2) {
                          selectHouseholdMarker(item.hh);
                          const [wX, wZ] = (isVietMapModel.current ? vietMapLatLngToWorld : latLngToWorld)(
                            Number(item.hh.coordinates[0]),
                            Number(item.hh.coordinates[1]),
                          );
                          flyCameraTo([wX + 35, 30, wZ + 45], [wX, 0, wZ], 1200);
                        }
                      } else if (item.coords && item.coords.length >= 2) {
                        const [wX, wZ] = (isVietMapModel.current ? vietMapLatLngToWorld : latLngToWorld)(item.coords[1], item.coords[0]);
                        const zoomDist = item.type === 'poi' ? 50 : item.type === 'street' ? 140 : 250;
                        flyCameraTo([wX + zoomDist * 0.7, zoomDist * 0.6, wZ + zoomDist], [wX, 0, wZ], 1200);
                      }
                    }}
                    className="p-2.5 px-3 border-b border-slate-800/80 hover:bg-blue-600/20 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.type === 'household' ? (
                        <Home className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : item.type === 'street' ? (
                        <Route className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : item.type === 'hamlet' ? (
                        <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title}</div>
                        <div className="text-[10px] text-slate-400">{item.subtitle}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Toolbar: Compact on Mobile, Full on Desktop */}
          <div className="field3d-toolbar pointer-events-auto ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur-md">
            {/* Mobile Search Trigger Button */}
            <button
              onClick={() => setIsMobileSearchOpen(prev => !prev)}
              title="Tìm kiếm"
              className={`md:hidden p-1.5 rounded-xl border transition-colors ${
                isMobileSearchOpen ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Desktop Theme Buttons */}
            <div className="hidden lg:flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60">
              <button
                onClick={() => handleSelectTheme('dark_cyber')}
                title="Nền Tối Chỉ Huy (Digital Twin)"
                className={`p-1.5 px-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  currentTheme === 'dark_cyber' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Nền Tối</span>
              </button>
              <button
                onClick={() => handleSelectTheme('vietmap_satellite')}
                title="Nền Vệ Tinh VietMap"
                className={`p-1.5 px-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  currentTheme === 'vietmap_satellite' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Vệ Tinh</span>
              </button>
              <button
                onClick={() => handleSelectTheme('architectural_slate')}
                title="Nền Ghi Xám Đô Thị"
                className={`p-1.5 px-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  currentTheme === 'architectural_slate' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Ghi Xám</span>
              </button>
              <button
                onClick={() => handleSelectTheme('contrast_light')}
                title="Nền Sáng Tương Phản"
                className={`p-1.5 px-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  currentTheme === 'contrast_light' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Sáng Rõ</span>
              </button>
            </div>

            {/* Mobile / Tablet Compact Theme Selector */}
            <div className="lg:hidden relative">
              <button
                onClick={() => setIsMobileThemeOpen(prev => !prev)}
                title="Đổi màu nền bản đồ"
                className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-xs"
              >
                <Palette className="w-3.5 h-3.5 text-blue-400" />
              </button>
              {isMobileThemeOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsMobileThemeOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1 z-50 w-36 animate-in slide-in-from-top-2 duration-150">
                    <button
                      onClick={() => handleSelectTheme('dark_cyber')}
                      className={`p-1.5 px-2 rounded-lg text-xs text-left font-medium flex items-center justify-between ${
                        currentTheme === 'dark_cyber' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>🌌 Nền Tối</span>
                      {currentTheme === 'dark_cyber' && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleSelectTheme('vietmap_satellite')}
                      className={`p-1.5 px-2 rounded-lg text-xs text-left font-medium flex items-center justify-between ${
                        currentTheme === 'vietmap_satellite' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>🗺️ Vệ Tinh</span>
                      {currentTheme === 'vietmap_satellite' && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleSelectTheme('architectural_slate')}
                      className={`p-1.5 px-2 rounded-lg text-xs text-left font-medium flex items-center justify-between ${
                        currentTheme === 'architectural_slate' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>🏛️ Ghi Xám</span>
                      {currentTheme === 'architectural_slate' && <Check className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleSelectTheme('contrast_light')}
                      className={`p-1.5 px-2 rounded-lg text-xs text-left font-medium flex items-center justify-between ${
                        currentTheme === 'contrast_light' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>☀️ Sáng Rõ</span>
                      {currentTheme === 'contrast_light' && <Check className="w-3 h-3" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Lighting Modes */}
            <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60">
              <button
                onClick={() => setLightingMode('day')}
                title="Ban ngày"
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                  lightingMode === 'day' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLightingMode('sunset')}
                title="Hoàng hôn"
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                  lightingMode === 'sunset' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sunset className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLightingMode('night')}
                title="Ban đêm"
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                  lightingMode === 'night' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLightingMode('tactical')}
                title="Bản đồ Nhiệt ANTT & PCCC"
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                  lightingMode === 'tactical' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Screenshot */}
            <button
              onClick={() => handleSelectPreset(cameraPresets.find(preset => preset.id === 'buildings') || cameraPresets[1])}
              title="Đến cụm công trình VietMap để chọn và zoom từng khối"
              className="hidden md:inline-flex whitespace-nowrap rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
            >
              Xem công trình
            </button>
            <button
              onClick={() => handleSelectPreset(cameraPresets[3])}
              title="Đến gần tên đường được sơn trên mặt đường"
              className="hidden md:inline-flex whitespace-nowrap rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
            >
              Xem tên đường
            </button>
            {canAddHouseholds && onAddHouseholdAtCoordinates && (
              <button
                type="button"
                onClick={() => {
                  setIsPlacingHousehold(current => !current);
                  setPlacementError(null);
                }}
                disabled={isLoading}
                title="Chọn một điểm trong xã trên bản đồ để thêm hộ dân tại đúng tọa độ đó"
                className={`flex items-center gap-1 whitespace-nowrap rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors ${isPlacingHousehold ? 'border-emerald-400 bg-emerald-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              >
                <MapPin className="h-3.5 w-3.5" />
                Thêm hộ tại điểm
              </button>
            )}
            <button
              onClick={handleTakeScreenshot}
              disabled={isCapturing || isLoading}
              title="Chụp và xem trước ảnh bản đồ 3D"
              className="p-1 sm:p-1.5 px-2 sm:px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium flex items-center gap-1 border border-slate-700 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">{isCapturing ? 'Đang chụp...' : 'Chụp'}</span>
            </button>

            {/* 9 Lớp 3D Button (Opens Bottom Sheet on Mobile / Left Panel on Desktop) */}
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              aria-expanded={isSidebarOpen}
              aria-controls="field3d-controls"
              aria-label="Điều khiển không gian 3D"
              title="Mở bảng điều khiển lớp 3D và góc quay"
              className={`p-1 sm:p-1.5 px-2 sm:px-2.5 rounded-xl text-xs font-medium flex items-center gap-1 border transition-colors ${
                isSidebarOpen
                  ? 'bg-blue-600/30 border-blue-500/60 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Điều khiển 3D</span>
            </button>
          </div>
        </div>

        {(isPlacingHousehold || placementError) && (
          <div className="absolute left-1/2 top-16 z-30 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-500/60 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{placementError || 'Nhấp một điểm trong ranh giới xã để đặt vị trí hộ dân. Có thể kéo bản đồ trước khi chọn.'}</span>
            <button
              type="button"
              aria-label="Thoát chọn vị trí"
              onClick={() => {
                setIsPlacingHousehold(false);
                setPlacementError(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Mobile Expanded Search Bar */}
        {isMobileSearchOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-transparent" onClick={() => setIsMobileSearchOpen(false)} />
            <div className="pointer-events-auto w-full md:hidden relative z-40 animate-in slide-in-from-top-2 duration-150">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm số nhà, chủ hộ, tuyến đường, ấp..."
                  autoFocus
                  className="w-full bg-slate-900/98 backdrop-blur-md border border-blue-500/80 rounded-xl py-2 pl-9 pr-9 text-xs text-white placeholder-slate-400 focus:outline-none shadow-2xl"
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-blue-400" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Dropdown Results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-64 overflow-y-auto">
                  {searchResults.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSearchQuery('');
                        setIsMobileSearchOpen(false);
                        if (item.type === 'household' && item.hh) {
                          const allMeshes = [
                            ...(collectionMeshMap.current.get('residential') || []),
                            ...(collectionMeshMap.current.get('commercial') || []),
                            ...(collectionMeshMap.current.get('civic') || []),
                          ];
                          const cleanId = String(item.hh.id || '').replace(/[^0-9]/g, '');
                          const targetMesh = allMeshes.find(m => {
                            const n = m.name || '';
                            return n.includes(String(item.hh!.id || '').replace('-', '_')) || (cleanId && n.includes(`_hh_${cleanId}`));
                          });
                          if (targetMesh) {
                            selectBuildingMesh(targetMesh);
                            const box = new THREE.Box3().setFromObject(targetMesh);
                            const c = new THREE.Vector3();
                            box.getCenter(c);
                            flyCameraTo([c.x + 30, c.y + 25, c.z + 40], [c.x, c.y, c.z], 1200);
                          } else if (item.hh.coordinates && item.hh.coordinates.length >= 2) {
                            selectHouseholdMarker(item.hh);
                            const [wX, wZ] = (isVietMapModel.current ? vietMapLatLngToWorld : latLngToWorld)(
                              Number(item.hh.coordinates[0]),
                              Number(item.hh.coordinates[1]),
                            );
                            flyCameraTo([wX + 35, 30, wZ + 45], [wX, 0, wZ], 1200);
                          }
                        } else if (item.coords && item.coords.length >= 2) {
                          const [wX, wZ] = (isVietMapModel.current ? vietMapLatLngToWorld : latLngToWorld)(item.coords[1], item.coords[0]);
                          const zoomDist = item.type === 'poi' ? 50 : item.type === 'street' ? 140 : 250;
                          flyCameraTo([wX + zoomDist * 0.7, zoomDist * 0.6, wZ + zoomDist], [wX, 0, wZ], 1200);
                        }
                      }}
                      className="p-2.5 px-3 border-b border-slate-800/80 hover:bg-blue-600/20 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        {item.type === 'household' ? (
                          <Home className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : item.type === 'street' ? (
                          <Route className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : item.type === 'hamlet' ? (
                          <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-semibold text-white">{item.title}</div>
                          <div className="text-[10px] text-slate-400">{item.subtitle}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 9 LAYERS & CAMERAS PANEL: Bottom Sheet on Mobile / Left Panel on Desktop */}
      {isSidebarOpen && (
        <>
          {/* Mobile Dark Backdrop */}
          <div
            className="lg:hidden absolute inset-0 bg-black/60 z-40 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setIsSidebarOpen(false)}
          />

          <div
            id="field3d-controls"
            className="field3d-sidebar absolute inset-x-0 bottom-0 z-50 flex max-h-[75%] flex-col overflow-hidden rounded-t-3xl border-t border-slate-700 bg-slate-900/98 text-white shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:bottom-4 lg:left-4 lg:top-3 lg:w-[380px] lg:max-h-none lg:rounded-2xl lg:border"
          >
            {/* Mobile Drag Indicator Bar */}
            <div className="w-12 h-1 bg-slate-500 rounded-full mx-auto my-2.5 lg:hidden shrink-0" />

            {/* Clean Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-700/80 bg-slate-900/90 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <div className="text-xs font-bold uppercase tracking-wide text-slate-100">Điều Khiển Không Gian 3D</div>
              </div>
              <button
                aria-label="Đóng điều khiển 3D"
                onClick={() => setIsSidebarOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-8 overscroll-contain sm:pb-5">
              {/* Visual Enhancement Toggles */}
              <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Tăng Cường Nổi Bật 3D
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={handleToggleEdges}
                    className={`p-2 rounded-lg border text-xs font-medium text-center transition-all ${
                      showEdges
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {showEdges ? '✓ Viền Cạnh: Bật' : 'Viền Cạnh: Tắt'}
                  </button>
                  <button
                    onClick={handleToggleGrid}
                    className={`p-2 rounded-lg border text-xs font-medium text-center transition-all ${
                      showGrid
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {showGrid ? '✓ Lưới Tọa Độ: Bật' : 'Lưới Tọa Độ: Tắt'}
                  </button>
                </div>
              </div>

              {/* Section 1: Blender Camera Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    Góc Nhìn Camera Blender
                  </div>
                  <span className="text-[10px] text-slate-500">{cameraPresets.length} góc quay</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {cameraPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left p-2 px-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                        activePreset === preset.id
                          ? 'bg-blue-600/20 border-blue-500/60 text-white shadow-md'
                          : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{preset.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{preset.description}</div>
                      </div>
                      {activePreset === preset.id && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: 9 Blender Collections Layers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    {collections.length} Lớp Chuyên Đề Blender
                  </div>
                  <span className="text-[10px] text-slate-500">Bật/tắt hiển thị</span>
                </div>
                <div className="space-y-2">
                  {collections.map(col => {
                    const Icon = col.icon;
                    return (
                      <button
                        type="button"
                        key={col.key}
                        onClick={() => handleToggleCollection(col.key)}
                        aria-pressed={col.visible}
                        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                          col.visible ? 'border-slate-600/80 bg-slate-800/80 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
                          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold leading-5">{col.label}</div>
                            <div className="text-[11px] leading-4 text-slate-400">{col.count}</div>
                          </div>
                        </div>
                        {col.visible ? (
                          <Eye className="h-4 w-4 shrink-0 text-blue-400" />
                        ) : (
                          <EyeOff className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-2xl border border-slate-600/80 bg-slate-800/70 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold text-slate-100">
                    <span>Hiển thị hộ dân</span>
                    <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-[11px] text-slate-200">
                      {displayedHouseholds.length}/{validHouseholds.length} hộ
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Kiểu hiển thị hộ dân">
                    <button
                      type="button"
                      onClick={() => setHouseholdDisplayMode('points')}
                      aria-pressed={householdDisplayMode === 'points'}
                      className={`min-h-10 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${householdDisplayMode === 'points' ? 'border-blue-400 bg-blue-600/30 text-white' : 'border-slate-600 text-slate-300 hover:text-white'}`}
                    >
                      <MapPin className="mr-1 inline h-3 w-3" />
                      Điểm màu
                    </button>
                    <button
                      type="button"
                      onClick={() => setHouseholdDisplayMode('houses')}
                      aria-pressed={householdDisplayMode === 'houses'}
                      className={`min-h-10 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${householdDisplayMode === 'houses' ? 'border-blue-400 bg-blue-600/30 text-white' : 'border-slate-600 text-slate-300 hover:text-white'}`}
                    >
                      <Home className="mr-1 inline h-3 w-3" />
                      Khối nhà 3D
                    </button>
                  </div>
                  <div className="mb-2 mt-4 text-[11px] font-semibold text-slate-300">Loại công trình minh họa</div>
                  <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Lọc theo loại hộ và cơ sở">
                    {HOUSEHOLD_TYPES.map(kind => {
                      const count = validHouseholds.filter(h => h.type === kind.key).length;
                      return (
                        <button
                          key={kind.key}
                          type="button"
                          onClick={() => setHouseholdTypeFilters(current => ({ ...current, [kind.key]: !current[kind.key] }))}
                          aria-pressed={householdTypeFilters[kind.key]}
                          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-center text-[11px] font-medium leading-4 transition-colors ${householdTypeFilters[kind.key] ? 'border-slate-500 bg-slate-700/80 text-white' : 'border-slate-700 text-slate-400'}`}
                        >
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: kind.color }} />
                            {kind.label}
                          </span>
                          <span className="text-[10px] opacity-80">{count} hộ</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mb-2 mt-4 text-[11px] font-semibold text-slate-300">Trạng thái hồ sơ</div>
                  <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Lọc hộ dân theo trạng thái">
                    {HOUSEHOLD_STATUSES.map(status => {
                      const count = validHouseholds.filter(h => householdMarkerStatus(h) === status.key).length;
                      return (
                        <button
                          key={status.key}
                          type="button"
                          onClick={() => setHouseholdStatusFilters(current => ({ ...current, [status.key]: !current[status.key] }))}
                          aria-pressed={householdStatusFilters[status.key]}
                          className={`min-h-10 rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium leading-4 transition-colors ${householdStatusFilters[status.key] ? 'border-slate-500 bg-slate-700/80 text-white' : 'border-slate-700 text-slate-400'}`}
                        >
                          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                          {status.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] leading-[1.55] text-slate-400">
                    Nhà ở: mái dốc, xanh dịu · Kinh doanh: mái bằng, mặt tiền kính, màu cát · Diện theo dõi: mái giật cấp, tím nhạt. Chấm và
                    dải màu thể hiện trạng thái hồ sơ. Hình khối là ký hiệu minh họa, chưa xác minh kiến trúc và dấu chân công trình.
                  </p>
                </div>
              </div>

              {/* Section 3: Visual Effects & Rendering Controls */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Hiệu Ứng Khung Dây & Xoay Tự Động
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleToggleWireframe}
                    className={`p-2 rounded-xl border text-xs font-medium text-center transition-colors ${
                      isWireframe
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isWireframe ? 'Tắt Khung Dây' : 'Bật Khung Dây'}
                  </button>
                  <button
                    onClick={() => setIsRotating(prev => !prev)}
                    className={`p-2 rounded-xl border text-xs font-medium text-center transition-colors ${
                      isRotating
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isRotating ? 'Dừng Tự Xoay' : 'Tự Động Xoay'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SELECTED BUILDING INSPECTION CARD: Bottom Sheet on Mobile / Right Card on Desktop */}
      {selectedBuildingInfo && (
        <>
          {/* Mobile backdrop */}
          <div
            className="sm:hidden fixed inset-0 bg-black/40 z-40 pointer-events-auto"
            onClick={() => {
              if (selectedMesh) applyThemeStyling(currentTheme);
              setSelectedMesh(null);
              setSelectedBuildingInfo(null);
            }}
          />

          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[62vh] max-h-[62dvh] rounded-t-3xl border-t border-slate-700 sm:border sm:rounded-2xl sm:fixed sm:inset-auto sm:top-18 sm:right-4 sm:bottom-6 sm:w-88 sm:max-h-[calc(100vh-100px)] bg-slate-900/98 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-white animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1 bg-slate-500 rounded-full mx-auto my-2 sm:hidden shrink-0" />

            {/* Card Header */}
            <div className="p-3 px-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900/40 to-slate-900 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold tracking-tight text-white truncate max-w-[210px] sm:max-w-[230px]">
                    {selectedBuildingInfo.name}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {selectedBuildingInfo.category} • {selectedBuildingInfo.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (selectedMesh) {
                    applyThemeStyling(currentTheme);
                  }
                  setSelectedMesh(null);
                  setSelectedBuildingInfo(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 shrink-0 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Card Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 overscroll-contain">
              {/* Building 3D Specifications Badge */}
              <div className="grid grid-cols-3 gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700/60 text-center">
                <div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400">Chiều Cao</div>
                  <div className="text-xs font-bold text-blue-400 mt-0.5">{selectedBuildingInfo.height} m</div>
                </div>
                <div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400">Số Tầng</div>
                  <div className="text-xs font-bold text-amber-400 mt-0.5">
                    {selectedBuildingInfo.source === 'vietmap' ? 'Chưa rõ' : `${selectedBuildingInfo.floors} tầng`}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400">Diện Tích</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">{selectedBuildingInfo.area} m²</div>
                </div>
              </div>

              {/* Address & Hamlet */}
              <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/40 space-y-1">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase font-semibold">Địa chỉ thực địa</div>
                    <div className="text-xs font-medium text-slate-200 mt-0.5 leading-snug">{selectedBuildingInfo.address}</div>
                  </div>
                </div>
              </div>

              {/* Household Attributes if linked */}
              {selectedBuildingInfo.household ? (
                <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/40 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Chủ hộ</div>
                        <div className="text-xs font-bold text-white truncate">
                          {selectedBuildingInfo.household.ownerName || (selectedBuildingInfo.household as any).name || 'Hộ dân'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-semibold shrink-0 ml-1.5 ${
                        selectedBuildingInfo.household.status === 'alert'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : selectedBuildingInfo.household.status === 'warning'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {selectedBuildingInfo.household.status === 'alert'
                        ? 'Cảnh báo ANTT'
                        : selectedBuildingInfo.household.status === 'warning'
                          ? 'Cần tuần tra'
                          : 'Bảo đảm ANTT'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[9px] text-slate-400">Số điện thoại</div>
                      <div className="font-semibold text-slate-300 mt-0.5 flex items-center gap-1 text-[11px]">
                        <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {selectedBuildingInfo.household.ownerPhone || (selectedBuildingInfo.household as any).phone || 'Chưa cập nhật'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400">Số nhân khẩu</div>
                      <div className="font-semibold text-slate-300 mt-0.5 flex items-center gap-1 text-[11px]">
                        <Users className="w-3 h-3 text-blue-400 shrink-0" />
                        {selectedBuildingInfo.household.residentsCount || (selectedBuildingInfo.household as any).membersCount || 0} người
                      </div>
                    </div>
                  </div>

                  {selectedBuildingInfo.household.notes && (
                    <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <span className="font-semibold text-slate-300">Ghi chú CSKV: </span>
                      {selectedBuildingInfo.household.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-800/30 border border-dashed border-slate-700/60 text-center">
                  <p className="text-[11px] text-slate-400">
                    {selectedBuildingInfo.source === 'vietmap'
                      ? 'Dấu chân từ VietMap; chiều cao, kiểu mái và mặt đứng là ước lượng minh họa.'
                      : 'Công trình thuộc dữ liệu bản đồ hiện có.'}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-3 pb-6 sm:pb-3 border-t border-slate-800 bg-slate-900/90 space-y-1.5 shrink-0">
              {selectedBuildingInfo.household && (
                <button
                  onClick={() => onSelectHousehold(selectedBuildingInfo.household!)}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Mở Hồ Sơ Chi Tiết Hộ Dân
                </button>
              )}

              <button
                onClick={handleFlyToSelectedBuilding}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 text-blue-400" />
                Zoom Cận Cảnh Thực Địa
              </button>

              {onNavigateTab && selectedBuildingInfo.household && (
                <button
                  onClick={() => onNavigateTab('residents')}
                  className="w-full py-1 px-3 text-[10px] text-slate-400 hover:text-slate-200 transition-colors text-center"
                >
                  Xem danh sách nhân khẩu cư trú →
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {selectedHouseholdMarker && (
        <>
          <div
            className="sm:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => {
              if (performance.now() - householdCardOpenedAtRef.current > 400) setSelectedHouseholdMarker(null);
            }}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[65vh] flex-col overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl sm:inset-auto sm:right-4 sm:top-18 sm:w-80 sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <div className="flex min-w-0 items-center gap-2">
                <div className="rounded-lg bg-emerald-600/30 p-2 text-emerald-300">
                  <Home className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">Hộ dân {selectedHouseholdMarker.code}</div>
                  <div className="text-[10px] text-slate-400">Điểm tọa độ trong ranh giới xã tạm</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedHouseholdMarker(null)}
                aria-label="Đóng thông tin hộ dân"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto p-4 text-xs">
              <p>
                <span className="text-slate-400">Chủ hộ:</span> {selectedHouseholdMarker.ownerName}
              </p>
              <p>
                <span className="text-slate-400">Địa chỉ:</span>{' '}
                {[
                  selectedHouseholdMarker.houseNumber,
                  selectedHouseholdMarker.street,
                  selectedHouseholdMarker.alley,
                  selectedHouseholdMarker.hamlet,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              <p>
                <span className="text-slate-400">Nhân khẩu:</span> {selectedHouseholdMarker.residentsCount}
              </p>
              <p>
                <span className="text-slate-400">Loại hồ sơ:</span>{' '}
                {selectedHouseholdMarker.type === 'business'
                  ? 'Cơ sở kinh doanh'
                  : selectedHouseholdMarker.type === 'special_monitoring'
                    ? 'Hộ thuộc diện theo dõi'
                    : 'Hộ ở'}
              </p>
              <p>
                <span className="text-slate-400">Trạng thái:</span>{' '}
                {selectedHouseholdMarker.status === 'alert'
                  ? 'Cảnh báo'
                  : selectedHouseholdMarker.status === 'warning'
                    ? 'Cần chú ý'
                    : selectedHouseholdMarker.status === 'business'
                      ? 'Kinh doanh'
                      : 'Bình thường'}
              </p>
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                Điểm này chưa được xác nhận thuộc khối nhà nào.
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-700 p-3">
              <button
                onClick={() => {
                  const [x, z] = vietMapLatLngToWorld(selectedHouseholdMarker.coordinates[0], selectedHouseholdMarker.coordinates[1]);
                  flyCameraTo([x + 38, 45, z + 52], [x, 0, z], 900);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-2 text-xs hover:bg-slate-700"
              >
                <ZoomIn className="h-3.5 w-3.5" /> Zoom vị trí
              </button>
              <button
                onClick={() => onSelectHousehold(selectedHouseholdMarker)}
                className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-2 py-2 text-xs font-semibold hover:bg-blue-500"
              >
                Mở hồ sơ hộ
              </button>
            </div>
          </div>
        </>
      )}

      {/* SELECTED ROAD INSPECTION CARD: Bottom Sheet on Mobile / Right Card on Desktop */}
      {selectedRoadInfo && !selectedBuildingInfo && !selectedHouseholdMarker && (
        <>
          {/* Mobile backdrop */}
          <div className="sm:hidden fixed inset-0 bg-black/40 z-40 pointer-events-auto" onClick={() => setSelectedRoadInfo(null)} />

          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-700 sm:border sm:rounded-2xl sm:fixed sm:inset-auto sm:top-18 sm:right-4 sm:bottom-auto sm:w-84 bg-slate-900/98 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden text-white animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 pointer-events-auto">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1 bg-slate-500 rounded-full mx-auto my-2 sm:hidden shrink-0" />

            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    selectedRoadInfo.type === 'main'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : selectedRoadInfo.type === 'alley'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  <Route className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">{selectedRoadInfo.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                    <span className="text-slate-400 font-mono">{selectedRoadInfo.code || 'RD-GPS'}</span>
                    <span className="text-slate-600">•</span>
                    <span
                      className={`font-semibold ${
                        selectedRoadInfo.type === 'main'
                          ? 'text-amber-300'
                          : selectedRoadInfo.type === 'alley'
                            ? 'text-purple-300'
                            : 'text-blue-300'
                      }`}
                    >
                      {selectedRoadInfo.type === 'main'
                        ? 'Trục Huyết Mạch'
                        : selectedRoadInfo.type === 'alley'
                          ? 'Hẻm Dân Cư'
                          : 'Đường Liên Ấp'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRoadInfo(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/40">
                <div>
                  <div className="text-[10px] text-slate-400">Lộ giới mặt đường</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">{selectedRoadInfo.width} mét</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Điểm mốc tọa độ</div>
                  <div className="text-sm font-bold text-blue-400 mt-0.5">{selectedRoadInfo.points.length} điểm GPS</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="bg-slate-800/30 p-2 rounded-lg border border-slate-700/30">
                  <span className="text-[10px] text-slate-400 block">Tốc độ tối đa</span>
                  <span className="font-semibold text-white">{selectedRoadInfo.speedLimit || 40} km/h</span>
                </div>
                <div className="bg-slate-800/30 p-2 rounded-lg border border-slate-700/30">
                  <span className="text-[10px] text-slate-400 block">Số làn xe</span>
                  <span className="font-semibold text-white">{selectedRoadInfo.laneCount || 2} làn</span>
                </div>
              </div>

              {selectedRoadInfo.status && (
                <div className="text-[11px] text-slate-400 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="font-semibold text-slate-300 block mb-0.5">Hiện trạng thực địa:</span>
                  {selectedRoadInfo.status}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900/90">
              <button
                onClick={() => {
                  const pts = selectedRoadInfo.points;
                  if (pts && pts.length > 0) {
                    const midPt = pts[Math.floor(pts.length / 2)];
                    const [wX, wZ] = (isVietMapModel.current ? vietMapLatLngToWorld : latLngToWorld)(midPt[1], midPt[0]);
                    flyCameraTo([wX - 80, 130, wZ + 90], [wX, 0, wZ], 1000);
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/30"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                Zoom Cận Cảnh Trục Tuyến
              </button>
            </div>
          </div>
        </>
      )}

      {/* Floating HUD Navigation Mini-Controls (Bottom Right) */}
      <div
        className={`absolute ${
          isFullscreen ? 'bottom-5 sm:bottom-6' : 'bottom-20 lg:bottom-6'
        } right-3 sm:right-6 z-35 flex flex-col items-center gap-2 transition-all duration-200 ${
          isSidebarOpen || selectedBuildingInfo ? 'opacity-30 sm:opacity-100 pointer-events-none sm:pointer-events-auto' : 'opacity-100'
        }`}
      >
        {/* Compass Widget */}
        <div
          onClick={() => {
            if (controlsRef.current && cameraRef.current) {
              const dist = cameraRef.current.position.distanceTo(controlsRef.current.target);
              flyCameraTo(
                [controlsRef.current.target.x, controlsRef.current.target.y + dist * 0.7, controlsRef.current.target.z + dist * 0.7],
                [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z],
                800,
              );
            }
          }}
          title="La bàn hướng Bắc (Bấm để xoay về Bắc)"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-2xl flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-all group"
        >
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-700 flex items-center justify-center transition-transform duration-100"
            style={{ transform: `rotate(${-compassHeading}deg)` }}
          >
            <div className="w-1.5 h-2.5 sm:h-3 bg-rose-500 rounded-t-sm" />
            <div className="w-1.5 h-2.5 sm:h-3 bg-slate-400 rounded-b-sm" />
          </div>
        </div>

        {/* Viewport Zoom & Fullscreen Controls */}
        <div className="flex flex-col bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-0.5">
          <button
            onClick={() => handleZoom(1)}
            title="Phóng to (Zoom In)"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-1)}
            title="Thu nhỏ (Zoom Out)"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-800 my-0.5" />
          <button
            onClick={() => handleSelectPreset(cameraPresets[0])}
            title="Đặt lại toàn cảnh (Reset View)"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình 3D'}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {screenshotUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/85 p-3 sm:p-5"
            role="presentation"
            onMouseDown={event => {
              if (event.target === event.currentTarget) setScreenshotUrl(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Ảnh chụp trích xuất bản đồ 3D"
              className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-5 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                    <Camera className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold leading-tight sm:text-2xl">Ảnh chụp trích xuất bản đồ an ninh địa bàn</h2>
                    <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                      Bản đồ không gian 3D xã Bà Điểm kèm tiêu đề, thời điểm trích xuất và nguồn dữ liệu
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={handleShareScreenshot}
                    className="hidden items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500 sm:flex"
                  >
                    <Share2 className="h-4 w-4" /> Chia sẻ
                  </button>
                  <button
                    onClick={() => setScreenshotUrl(null)}
                    aria-label="Đóng ảnh chụp"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-800 p-4 sm:p-6">
                <img
                  src={screenshotUrl}
                  alt="Ảnh chụp bản đồ không gian 3D xã Bà Điểm"
                  className="max-h-[55vh] max-w-full rounded border border-slate-600 object-contain shadow-xl"
                />
              </div>
              {isShareMenuOpen && (
                <div className="flex flex-wrap gap-2 border-t border-slate-700 bg-slate-800 px-4 py-3 sm:px-6">
                  <button
                    onClick={handleCopyScreenshot}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs hover:bg-slate-700"
                  >
                    Sao chép ảnh để chia sẻ
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(window.location.href);
                        setCaptureFeedback('Đã sao chép liên kết bản đồ.');
                      } catch {
                        setCaptureFeedback('Không thể sao chép liên kết trong trình duyệt này.');
                      }
                    }}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs hover:bg-slate-700"
                  >
                    Sao chép liên kết bản đồ
                  </button>
                </div>
              )}
              <div className="border-t border-slate-700 bg-slate-950/70 px-4 py-4 sm:px-6">
                <p role="status" className="mb-3 text-[11px] text-blue-200">
                  {captureFeedback || 'Độ phân giải cao (2x) • Định dạng PNG • Có tiêu đề và watermark'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleShareScreenshot}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold hover:bg-emerald-500"
                  >
                    <Share2 className="h-4 w-4" /> Chia sẻ <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleCopyScreenshot}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold hover:bg-slate-700"
                  >
                    <Copy className="h-4 w-4" /> Sao chép ảnh
                  </button>
                  <button
                    onClick={handlePrintScreenshot}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold hover:bg-slate-700"
                  >
                    <Printer className="h-4 w-4" /> In ảnh
                  </button>
                  <button
                    onClick={handleDownloadScreenshot}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold hover:bg-blue-500"
                  >
                    <Download className="h-4 w-4" /> Tải về (.PNG)
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
export default Field3DMapTab;
