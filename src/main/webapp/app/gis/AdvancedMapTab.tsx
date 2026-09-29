import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import html2canvas from 'html2canvas-pro';
import {
  Navigation,
  Layers,
  MapPin,
  AlertTriangle,
  Store,
  AlertOctagon,
  Building,
  RotateCcw,
  Info,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Camera,
  Search,
  X,
  Filter,
  Eye,
  EyeOff,
  Download,
  Copy,
  Printer,
  Compass,
  Users,
  Phone,
  FileText,
  Check,
  Radio,
  CheckCircle2,
  ShieldAlert,
  Share2,
  Send,
  MessageSquare,
  Mail,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Sparkles,
  Move,
  Crosshair,
  Undo2,
  AlertCircle,
  GripHorizontal,
  HelpCircle,
} from 'lucide-react';
import { HouseholdFacility, NavigationTab, InspectionPhoto, AppUser } from './types';
import { updateHouseholdCoordinatesInFirestore } from './services/firestoreService';
import { MapQuickGuideModal } from './MapQuickGuideModal';
import { InspectionCameraModal } from './InspectionCameraModal';

interface AdvancedMapTabProps {
  households: HouseholdFacility[];
  currentUser?: AppUser | null;
  onSelectHousehold: (household: HouseholdFacility) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  onUpdateCoordinates?: (updates: Array<{ id: string; coordinates: [number, number] }>) => Promise<void> | void;
}

// Base map layer options
type BaseLayerType = 'osm' | 'voyager' | 'dark' | 'satellite' | 'positron';

const TILE_LAYERS: Record<BaseLayerType, { name: string; url: string; attribution: string; maxZoom: number; subdomains?: string }> = {
  osm: {
    name: 'Đường phố chuẩn (OpenStreetMap)',
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20,
    subdomains: 'abc',
  },
  // voyager: {
  //   name: 'Bản đồ chi tiết (CartoDB Voyager)',
  //   url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  //   attribution: '&copy; CARTO &amp; OpenStreetMap',
  //   maxZoom: 20,
  //   subdomains: 'abcd',
  // },
  // dark: {
  //   name: 'Đô thị đêm (CartoDB Dark)',
  //   url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  //   attribution: '&copy; CARTO &amp; OpenStreetMap',
  //   maxZoom: 20,
  //   subdomains: 'abcd',
  // },
  satellite: {
    name: 'Ảnh Vệ tinh thực địa (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Earthstar Geographics',
    maxZoom: 18,
  },
  // positron: {
  //   name: 'Đô thị sáng (CartoDB Light)',
  //   url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  //   attribution: '&copy; CARTO &amp; OpenStreetMap',
  //   maxZoom: 20,
  //   subdomains: 'abcd',
  // },
};

export const AdvancedMapTab: React.FC<AdvancedMapTabProps> = ({
  households,
  currentUser,
  onSelectHousehold,
  isFullscreen: controlledFullscreen,
  onToggleFullscreen: controlledToggleFullscreen,
  onNavigateTab,
  onUpdateCoordinates,
}) => {
  // Dynamic administrative area name and unit
  const wardName = useMemo(() => {
    if (currentUser?.assignedWard) return currentUser.assignedWard;
    const hWard = households.find(h => h.ward)?.ward;
    if (hWard) return hWard;
    return 'Địa bàn quản lý';
  }, [currentUser, households]);

  const unitName = useMemo(() => {
    if (currentUser?.unit) return currentUser.unit;
    if (currentUser?.assignedWard) return `Công an ${currentUser.assignedWard}`;
    return 'Công an Địa bàn Phụ trách';
  }, [currentUser]);

  const hamletListStr = useMemo(() => {
    const hamlets = Array.from(new Set(households.map(h => h.hamlet).filter(Boolean)));
    if (hamlets.length === 0) return 'Toàn địa bàn';
    if (hamlets.length <= 3) return hamlets.join(' & ');
    return `${hamlets.slice(0, 2).join(' & ')} (+${hamlets.length - 2})`;
  }, [households]);
  // DOM & Map references
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);

  // Center coordinates of Ba Diem, Hoc Mon, HCMC
  const centerLat = 10.854;
  const centerLng = 106.612;

  // Selected item
  const [selectedHouse, setSelectedHouse] = useState<HouseholdFacility | null>(null);

  // Coordinate Drag & Drop Editing States
  const [isEditingCoordinates, setIsEditingCoordinates] = useState<boolean>(false);
  const [pendingCoordinates, setPendingCoordinates] = useState<Record<string, [number, number]>>({});
  const [isSavingCoordinates, setIsSavingCoordinates] = useState<boolean>(false);
  const [coordNotification, setCoordNotification] = useState<string | null>(null);

  const getHouseholdCoords = (h?: HouseholdFacility | null): [number, number] => {
    if (!h) return [centerLat, centerLng];
    if (pendingCoordinates && pendingCoordinates[h.id]) return pendingCoordinates[h.id];
    if (Array.isArray(h.coordinates) && h.coordinates.length >= 2) {
      const pLat = Number(h.coordinates[0]);
      const pLng = Number(h.coordinates[1]);
      if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
        return [pLat, pLng];
      }
    }
    const anyH = h as any;
    const lat = Number(anyH.latitude);
    const lng = Number(anyH.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return [lat, lng];
    }
    return [centerLat, centerLng];
  };

  // UI Modes
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
  const [internalFullscreen, setInternalFullscreen] = useState<boolean>(false);
  const isFullscreen = controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;
  const [isFilterBarExpanded, setIsFilterBarExpanded] = useState<boolean>(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [currentLayer, setCurrentLayer] = useState<BaseLayerType>('osm');
  const [markerDisplayMode, setMarkerDisplayMode] = useState<'detailed' | 'minimal'>('detailed');
  const [showSecurityZones, setShowSecurityZones] = useState<boolean>(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<'all' | 'warning' | 'alert' | 'business' | 'normal'>('all');
  const [hamletFilter, setHamletFilter] = useState<string>('all');
  const [streetFilter, setStreetFilter] = useState<string>('all');
  const [residentsFilter, setResidentsFilter] = useState<'all' | 'crowded' | 'medium' | 'single'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Screenshot States
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Onboarding quick guide state
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Check first-time visit for map quick guide
  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('map_quick_guide_seen_v1');
      if (!hasSeen) {
        setIsGuideOpen(true);
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, []);

  // Check Web Share API capability
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  // Unique list of hamlets from households
  const hamletList = useMemo(() => {
    const list = Array.from(new Set(households.map(h => h.hamlet))).filter(Boolean);
    return ['all', ...list];
  }, [households]);

  // Unique list of streets from households
  const streetList = useMemo(() => {
    const list = Array.from(new Set(households.map(h => h.street))).filter(Boolean);
    return ['all', ...list];
  }, [households]);

  // Filtered households calculation
  const filteredHouseholds = useMemo(() => {
    return households.filter(h => {
      // 1. Status filter
      if (statusFilter === 'warning' && h.status !== 'warning') return false;
      if (statusFilter === 'alert' && h.status !== 'alert') return false;
      if (statusFilter === 'business' && h.status !== 'business' && h.type !== 'business') return false;
      if (statusFilter === 'normal' && h.status !== 'normal') return false;

      // 2. Hamlet filter
      if (hamletFilter !== 'all' && h.hamlet !== hamletFilter) return false;

      // 3. Street filter
      if (streetFilter !== 'all' && h.street !== streetFilter) return false;

      // 4. Residents count filter
      if (residentsFilter === 'crowded' && h.residentsCount <= 4) return false;
      if (residentsFilter === 'medium' && (h.residentsCount < 2 || h.residentsCount > 4)) return false;
      if (residentsFilter === 'single' && h.residentsCount !== 1) return false;

      // 5. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchNumber = h.houseNumber ? h.houseNumber.toLowerCase().includes(query) : false;
        const matchStreet = h.street ? h.street.toLowerCase().includes(query) : false;
        const matchOwner = h.ownerName ? h.ownerName.toLowerCase().includes(query) : false;
        const matchPhone = h.ownerPhone ? h.ownerPhone.toLowerCase().includes(query) : false;
        const matchBiz = h.businessName ? h.businessName.toLowerCase().includes(query) : false;
        const matchNotes = h.notes ? h.notes.toLowerCase().includes(query) : false;

        if (!matchNumber && !matchStreet && !matchOwner && !matchPhone && !matchBiz && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [households, statusFilter, hamletFilter, streetFilter, residentsFilter, searchQuery]);

  // Count active filters for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (hamletFilter !== 'all') count++;
    if (streetFilter !== 'all') count++;
    if (residentsFilter !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [statusFilter, hamletFilter, streetFilter, residentsFilter, searchQuery]);

  // Reset all filters
  const handleResetFilters = () => {
    setStatusFilter('all');
    setHamletFilter('all');
    setStreetFilter('all');
    setResidentsFilter('all');
    setSearchQuery('');
  };

  // Coordinate Drag & Drop Handlers
  const handleToggleEditCoordinates = () => {
    if (isEditingCoordinates) {
      if (Object.keys(pendingCoordinates).length > 0) {
        const confirmCancel = window.confirm(
          `Bạn có ${Object.keys(pendingCoordinates).length} điểm nhà đã đổi tọa độ nhưng chưa lưu. Bạn có muốn hủy và quay lại vị trí ban đầu không?`,
        );
        if (!confirmCancel) return;
      }
      setIsEditingCoordinates(false);
      setPendingCoordinates({});
      setCoordNotification(null);
    } else {
      setIsEditingCoordinates(true);
      setPendingCoordinates({});
      setCoordNotification('Chế độ đổi tọa độ: Nhấn giữ và kéo ghim nhà trên bản đồ đến vị trí mới.');
      setTimeout(() => setCoordNotification(null), 5000);
    }
  };

  const handleSaveCoordinates = async () => {
    const entries = Object.entries(pendingCoordinates);
    if (entries.length === 0) {
      setIsEditingCoordinates(false);
      return;
    }

    setIsSavingCoordinates(true);
    const updates: Array<{ id: string; coordinates: [number, number] }> = Object.entries(pendingCoordinates).map(([id, coords]) => ({
      id,
      coordinates: coords as [number, number],
    }));

    try {
      if (onUpdateCoordinates) {
        await onUpdateCoordinates(updates);
      } else {
        await updateHouseholdCoordinatesInFirestore(updates);
      }
      setCoordNotification(`✓ Đã cập nhật thành công tọa độ mới cho ${updates.length} điểm nhà!`);
      setPendingCoordinates({});
      setIsEditingCoordinates(false);
      setTimeout(() => setCoordNotification(null), 5000);
    } catch (err) {
      console.error('Lỗi khi lưu tọa độ nhà:', err);
      alert('Không thể lưu tọa độ. Vui lòng thử lại.');
    } finally {
      setIsSavingCoordinates(false);
    }
  };

  const handleCancelEditCoordinates = () => {
    setPendingCoordinates({});
    setIsEditingCoordinates(false);
    setCoordNotification('Đã hủy thay đổi tọa độ.');
    setTimeout(() => setCoordNotification(null), 3000);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 16,
      zoomControl: false, // We provide custom floating zoom controls
      scrollWheelZoom: true,
    });

    // Add Base Tile Layer
    const initialConfig = TILE_LAYERS[currentLayer];
    const tileLayer = L.tileLayer(initialConfig.url, {
      attribution: initialConfig.attribution,
      maxZoom: initialConfig.maxZoom,
      subdomains: initialConfig.subdomains || 'abc',
    }).addTo(map);

    activeTileLayerRef.current = tileLayer;

    // Layer groups for markers and safety radius circles
    const circlesGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    circlesLayerRef.current = circlesGroup;
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer dynamically
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (activeTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(activeTileLayerRef.current);
    }

    const config = TILE_LAYERS[currentLayer];
    const newTileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: config.subdomains || 'abc',
    }).addTo(mapInstanceRef.current);

    activeTileLayerRef.current = newTileLayer;
  }, [currentLayer]);

  // Update Markers & Security Circles whenever filters or coordinates/edit-mode change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !circlesLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    circlesLayerRef.current.clearLayers();

    filteredHouseholds.forEach(h => {
      // Effective coordinates: either from pending drag or default
      const currentCoords: [number, number] = getHouseholdCoords(h);
      const hasMoved = !!pendingCoordinates[h.id];

      let pinColor = '#10b981'; // green for normal
      let iconSymbol = '🏠';
      let circleColor = '#10b981';

      if (h.status === 'warning') {
        pinColor = '#f59e0b'; // amber
        iconSymbol = '⚠️';
        circleColor = '#f59e0b';
      } else if (h.status === 'alert') {
        pinColor = '#ef4444'; // red
        iconSymbol = '🚨';
        circleColor = '#ef4444';
      } else if (h.status === 'business' || h.type === 'business') {
        pinColor = '#2563eb'; // blue
        iconSymbol = '🏪';
        circleColor = '#2563eb';
      }

      // 1. Draw security buffer zone if toggled on
      if (showSecurityZones && (h.status === 'warning' || h.status === 'alert')) {
        const circle = L.circle(currentCoords, {
          radius: h.status === 'alert' ? 70 : 45,
          color: circleColor,
          fillColor: circleColor,
          fillOpacity: 0.18,
          weight: 1.5,
          dashArray: '4, 4',
        });
        circlesLayerRef.current?.addLayer(circle);
      }

      // 2. Build custom marker icon based on display mode & edit mode
      let customIcon: L.DivIcon;

      if (markerDisplayMode === 'detailed') {
        const borderStyle = isEditingCoordinates ? (hasMoved ? '2px solid #10b981' : '2px dashed #f59e0b') : '2px solid white';
        const shadowStyle = isEditingCoordinates
          ? hasMoved
            ? '0 0 0 3px rgba(16,185,129,0.4), 0 4px 12px rgba(0,0,0,0.3)'
            : '0 0 0 3px rgba(245,158,11,0.4), 0 4px 12px rgba(0,0,0,0.3)'
          : '0 4px 10px rgba(0,0,0,0.3)';
        const cursorStyle = isEditingCoordinates ? 'grab' : 'pointer';

        customIcon = L.divIcon({
          className: 'custom-map-marker-detailed',
          html: `
            <div style="
              background-color: ${hasMoved ? '#059669' : pinColor};
              color: white;
              padding: 4px 8px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 800;
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
              box-shadow: ${shadowStyle};
              border: ${borderStyle};
              cursor: ${cursorStyle};
              transform: translate(-50%, -50%);
              transition: transform 0.15s ease;
            ">
              <span style="font-size: 12px;">${isEditingCoordinates ? '✥' : iconSymbol}</span>
              <span>Số ${h.houseNumber}</span>
              ${
                isEditingCoordinates
                  ? hasMoved
                    ? '<span style="font-size:9px; background:#047857; padding:1px 5px; border-radius:4px; font-weight:700;">✓ Đã dời</span>'
                    : '<span style="font-size:9px; background:rgba(0,0,0,0.3); padding:1px 4px; border-radius:4px;">Kéo</span>'
                  : h.status === 'warning'
                    ? '<span style="font-size:9px; background:rgba(0,0,0,0.25); padding:1px 4px; border-radius:4px;">Hết hạn</span>'
                    : h.status === 'alert'
                      ? '<span style="font-size:9px; background:rgba(0,0,0,0.3); padding:1px 4px; border-radius:4px;">Chú ý</span>'
                      : ''
              }
            </div>
          `,
          iconSize: [88, 28],
          iconAnchor: [44, 14],
        });
      } else {
        // Minimal pin mode
        const borderStyle = isEditingCoordinates ? (hasMoved ? '3px solid #10b981' : '3px dashed #f59e0b') : '3px solid white';
        const shadowStyle = isEditingCoordinates
          ? hasMoved
            ? '0 0 0 4px rgba(16,185,129,0.5)'
            : '0 0 0 4px rgba(245,158,11,0.5)'
          : '0 2px 6px rgba(0,0,0,0.35)';

        customIcon = L.divIcon({
          className: 'custom-map-marker-minimal',
          html: `
            <div style="
              width: 22px;
              height: 22px;
              background-color: ${hasMoved ? '#059669' : pinColor};
              border: ${borderStyle};
              border-radius: 50%;
              box-shadow: ${shadowStyle};
              cursor: ${isEditingCoordinates ? 'grab' : 'pointer'};
              transform: translate(-50%, -50%);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 10px;
              font-weight: bold;
            ">${isEditingCoordinates ? '✥' : ''}</div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
      }

      const marker = L.marker(currentCoords, {
        icon: customIcon,
        draggable: isEditingCoordinates,
        autoPan: true,
      });

      if (isEditingCoordinates) {
        marker.on('dragstart', () => {
          marker.closePopup();
        });
        marker.on('dragend', (event: any) => {
          const latlng = event.target.getLatLng();
          const newLat = Number(latlng.lat.toFixed(6));
          const newLng = Number(latlng.lng.toFixed(6));
          setPendingCoordinates(prev => ({
            ...prev,
            [h.id]: [newLat, newLng],
          }));
          setCoordNotification(`Đã chuyển số nhà ${h.houseNumber} (${h.hamlet}) tới tọa độ mới: [${newLat}, ${newLng}]`);
        });
      }

      // Rich popup content
      const popupContent = `
        <div style="font-family: 'DM Sans', sans-serif; min-width: 220px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; color: #2563eb; text-transform: uppercase; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">
              ${h.hamlet}${h.ward ? ` • ${h.ward}` : ''}
            </span>
            <span style="font-size: 10px; font-weight: 700; color: ${hasMoved ? '#059669' : pinColor};">
              ${hasMoved ? '✓ Đã dời tọa độ' : h.status === 'warning' ? '⚠️ Hết hạn' : h.status === 'alert' ? '🚨 Chú ý' : h.status === 'business' ? '🏪 Cơ sở KD' : '✓ Hợp lệ'}
            </span>
          </div>

          <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">
            Số ${h.houseNumber} đường ${h.street}
          </div>

          ${
            hasMoved
              ? `<div style="font-size: 11px; color: #047857; background: #ecfdf5; padding: 4px 8px; border-radius: 6px; margin-top: 6px; font-weight: 700; border: 1px solid #a7f3d0;">
                  📍 Tọa độ mới chờ lưu: [${currentCoords[0].toFixed(5)}, ${currentCoords[1].toFixed(5)}]
                </div>`
              : ''
          }

          <div style="font-size: 12px; font-weight: 600; color: #334155; margin-top: 4px;">
            ${h.businessName ? `🏪 <strong>${h.businessName}</strong>` : `👤 Chủ hộ: <strong>${h.ownerName}</strong>`}
          </div>

          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            Nhân khẩu: <strong>${h.residentsCount} người</strong> (${h.maleCount} Nam, ${h.femaleCount} Nữ)
          </div>

          ${
            h.warningMessage
              ? `<div style="font-size: 11px; color: #92400e; background: #fffbeb; padding: 5px 8px; border-radius: 6px; margin-top: 6px; font-weight: 600; border: 1px solid #fde68a;">
                  ⚠️ ${h.warningMessage}
                </div>`
              : ''
          }

          <div style="font-size: 11px; color: #475569; margin-top: 6px; line-height: 1.4; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
            <em>${h.notes}</em>
          </div>

          <div style="margin-top: 8px; font-size: 10px; color: #94a3b8; text-align: right;">
            ${isEditingCoordinates ? 'Kéo thả ghim để định vị lại trên bản đồ' : 'Nhấp để chọn & xem chi tiết'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        setSelectedHouse(h);
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [filteredHouseholds, markerDisplayMode, showSecurityZones, isEditingCoordinates, pendingCoordinates]);

  // ResizeObserver on the map container to continuously guarantee accurate dimensions
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize({ animate: false });
          }
        }
      }
    });

    observer.observe(mapContainerRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Handle Resize and invalidate map size with smooth tile refresh whenever panel or fullscreen state changes
  useEffect(() => {
    // Trigger multiple layout passes (30ms, 100ms, 250ms, 450ms, 700ms) to ensure smooth tile rendering
    const timers = [30, 100, 250, 450, 700].map(delay =>
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
          window.dispatchEvent(new Event('resize'));
        }
      }, delay),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isPanelOpen, isFullscreen]);

  // Lock body scroll when in fullscreen overlay mode
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Toggle Fullscreen (delegates to parent App or internal fallback)
  const handleToggleFullscreen = () => {
    if (controlledToggleFullscreen) {
      controlledToggleFullscreen();
    } else {
      setInternalFullscreen(!internalFullscreen);
    }
  };

  // Listen for ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, controlledToggleFullscreen]);

  // Reset map view to center of An Lac
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLng], 16, { animate: true });
    }
  };

  // Zoom In/Out
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };
  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  // Capture Screenshot of the Map
  const handleTakeScreenshot = async () => {
    if (!mapContainerRef.current) return;
    setIsCapturing(true);

    try {
      // Small pause to let any map animations and tiles finalize rendering
      await new Promise(resolve => setTimeout(resolve, 200));

      const capturedCanvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2, // High resolution for crisp export
        backgroundColor: '#f1f5f9',
      });

      // Assemble final export image with official police administrative header and watermark
      const finalCanvas = document.createElement('canvas');
      const headerHeight = 90;
      const footerHeight = 44;
      finalCanvas.width = capturedCanvas.width;
      finalCanvas.height = capturedCanvas.height + headerHeight + footerHeight;
      const ctx = finalCanvas.getContext('2d');

      if (ctx) {
        // 1. Header Banner
        ctx.fillStyle = '#0f172a'; // slate-900
        ctx.fillRect(0, 0, finalCanvas.width, headerHeight);

        // Gold/red decorative accent line
        ctx.fillStyle = '#dc2626'; // red-600
        ctx.fillRect(0, headerHeight - 4, finalCanvas.width, 4);

        // Header Titles
        ctx.fillStyle = '#93c5fd'; // blue-300
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(unitName.toUpperCase(), 28, 34);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('BẢN ĐỒ GIÁM SÁT ĐỊA BÀN & AN NINH TRẬT TỰ KHU DÂN CƯ', 28, 68);

        // Header Right: Badge
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fef08a'; // yellow-200
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('HỆ THỐNG CSKV 4.0', finalCanvas.width - 28, 44);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.fillText(`KHU VỰC: ${hamletListStr.toUpperCase()}`, finalCanvas.width - 28, 66);
        ctx.textAlign = 'left';

        // 2. Draw captured Map Canvas
        ctx.drawImage(capturedCanvas, 0, headerHeight);

        // 3. Footer Banner
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, finalCanvas.height - footerHeight, finalCanvas.width, footerHeight);

        ctx.fillStyle = '#64748b';
        ctx.fillRect(0, finalCanvas.height - footerHeight, finalCanvas.width, 1);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '14px sans-serif';
        const nowFormatted = new Date().toLocaleString('vi-VN');
        ctx.fillText(
          `Thời điểm trích xuất: ${nowFormatted} | Tọa độ: 10.7440° B, 106.6130° Đ | Số điểm hiển thị: ${filteredHouseholds.length} / ${households.length}`,
          28,
          finalCanvas.height - 16,
        );

        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'italic 13px sans-serif';
        ctx.fillText(`Bản đồ giám sát an ninh trật tự ${wardName}`, finalCanvas.width - 28, finalCanvas.height - 16);
      }

      const dataUrl = finalCanvas.toDataURL('image/png');
      setScreenshotUrl(dataUrl);
      setIsScreenshotModalOpen(true);
      setIsShareMenuOpen(false);
      setShareFeedback(null);
    } catch (error) {
      console.error('Lỗi khi chụp màn hình bản đồ:', error);
      alert('Không thể hoàn tất chụp bản đồ. Vui lòng kiểm tra lại kết nối và thử lại.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Download screenshot file
  const handleDownloadScreenshot = () => {
    if (!screenshotUrl) return;
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = screenshotUrl;
    a.download = `bando_anninh_anlac_${timestamp}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShareFeedback('Đã tải ảnh về máy thành công!');
    setTimeout(() => setShareFeedback(null), 3000);
  };

  // Copy screenshot to clipboard
  const handleCopyScreenshot = async () => {
    if (!screenshotUrl) return;
    try {
      const res = await fetch(screenshotUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopySuccess(true);
      setShareFeedback('Đã sao chép ảnh vào bộ nhớ tạm! Bạn có thể dán (Ctrl+V) ngay.');
      setTimeout(() => {
        setCopySuccess(false);
        setShareFeedback(null);
      }, 3500);
    } catch (err) {
      console.warn('Clipboard write error:', err);
      alert('Trình duyệt không hỗ trợ sao chép ảnh trực tiếp. Vui lòng dùng nút "Tải ảnh về máy".');
    }
  };

  // Native Web Share with file
  const handleNativeShare = async () => {
    if (!screenshotUrl) return;
    setIsSharing(true);
    try {
      const res = await fetch(screenshotUrl);
      const blob = await res.blob();
      const file = new File([blob], `bando_anninh_${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Bản đồ Giám sát An ninh ${wardName}`,
          text: `Trích xuất bản đồ số giám sát an ninh trật tự ${wardName} (${filteredHouseholds.length} điểm giám sát).`,
          files: [file],
        });
        setShareFeedback('Đã chia sẻ thành công qua ứng dụng hệ thống!');
        setTimeout(() => setShareFeedback(null), 3500);
        return;
      } else if (navigator.share) {
        await navigator.share({
          title: `Bản đồ Giám sát An ninh ${wardName}`,
          text: `Bản đồ giám sát an ninh trật tự và PCCC ${wardName}.`,
          url: window.location.href,
        });
        setShareFeedback('Đã chia sẻ liên kết bản đồ!');
        setTimeout(() => setShareFeedback(null), 3500);
        return;
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      console.warn('Native share error or unsupported:', err);
    } finally {
      setIsSharing(false);
    }
    // If native share was not triggered, open share menu
    setIsShareMenuOpen(true);
  };

  // Primary Share toggle or trigger
  const handleShareScreenshot = async () => {
    if (!screenshotUrl) return;
    // If native share is available and not already open, try native or toggle menu
    if (canNativeShare && !isShareMenuOpen) {
      await handleNativeShare();
    } else {
      setIsShareMenuOpen(prev => !prev);
    }
  };

  // Share via Zalo (copy image & launch Zalo chat)
  const handleShareZalo = async () => {
    if (!screenshotUrl) return;
    try {
      const res = await fetch(screenshotUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setShareFeedback('Đã sao chép ảnh! Đang mở Zalo Web, bạn chỉ cần bấm Ctrl+V để gửi.');
    } catch {
      setShareFeedback('Đang mở Zalo Web...');
    }
    window.open('https://chat.zalo.me', '_blank');
    setTimeout(() => setShareFeedback(null), 6000);
  };

  // Share via Telegram
  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `Bản đồ Giám sát An ninh Trật tự ${wardName} - Trích xuất ảnh báo cáo thực địa (${filteredHouseholds.length} điểm giám sát)`,
    );
    const url = encodeURIComponent(window.location.href);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    setShareFeedback('Đang mở Telegram để chia sẻ báo cáo!');
    setTimeout(() => setShareFeedback(null), 3500);
  };

  // Share via Email
  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Báo cáo Bản đồ Giám sát An ninh Trật tự ${wardName}`);
    const body = encodeURIComponent(
      'Kính gửi Ban Chỉ huy / Cán bộ phụ trách,\n\n' +
        `Tôi gửi trích xuất hình ảnh bản đồ giám sát an ninh trật tự, PCCC và hộ kinh doanh ${wardName} (${filteredHouseholds.length} điểm hiển thị).\n\n` +
        'Vui lòng truy cập hệ thống trực tuyến tại: ' +
        window.location.href +
        '\n\n' +
        'Trân trọng.',
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    setShareFeedback('Đang mở trình gửi Email...');
    setTimeout(() => setShareFeedback(null), 3500);
  };

  // Copy app link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareFeedback('Đã sao chép liên kết hệ thống vào bộ nhớ tạm!');
      setTimeout(() => setShareFeedback(null), 3000);
    } catch {
      alert('Không thể sao chép liên kết.');
    }
  };

  // Print screenshot
  const handlePrintScreenshot = () => {
    if (!screenshotUrl) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Bản đồ Giám sát An ninh ${wardName}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; background: #fff; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${screenshotUrl}" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div
      id="advanced-map-wrapper"
      ref={mapWrapperRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-[99999] w-screen h-screen bg-slate-950 flex flex-col p-2 sm:p-2.5 overflow-hidden m-0'
          : 'space-y-4 sm:space-y-5 max-w-7xl mx-auto'
      }
      style={
        isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 99999,
              margin: 0,
            }
          : undefined
      }
    >
      {/* Fullscreen Top Navigation Bar */}
      {isFullscreen && (
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 shrink-0 text-white shadow-lg mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-xs sm:text-sm text-slate-100">
              BẢN ĐỒ GIÁM SÁT AN NINH {wardName.toUpperCase()} — TOÀN MÀN HÌNH
            </span>
            <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              {filteredHouseholds.length} / {households.length} vị trí
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateTab && (
              <button
                onClick={() => {
                  handleToggleFullscreen();
                  onNavigateTab('area-map');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Chuyển sang sơ đồ khối địa bàn"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden md:inline">Sơ đồ khối</span>
              </button>
            )}

            {/* Button: Hướng dẫn sử dụng nút bấm (Fullscreen) */}
            <button
              id="btn-open-map-quick-guide-fs"
              onClick={() => setIsGuideOpen(true)}
              className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Xem hướng dẫn nhanh các nút bấm trên bản đồ"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Hướng dẫn</span>
            </button>

            <button
              onClick={handleTakeScreenshot}
              disabled={isCapturing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isCapturing ? 'Đang chụp...' : 'Chụp ảnh'}</span>
            </button>

            {/* Button: Đổi tọa độ nhà (Fullscreen) */}
            <button
              id="btn-toggle-edit-coordinates-fs"
              onClick={handleToggleEditCoordinates}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isEditingCoordinates
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title={isEditingCoordinates ? 'Thoát chế độ chỉnh sửa tọa độ' : 'Kéo thả đổi vị trí nhà trên bản đồ'}
            >
              <Move className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isEditingCoordinates ? 'Đang đổi tọa độ' : 'Đổi tọa độ nhà'}</span>
            </button>

            {/* Button: Hoàn thành chỉnh sửa tọa độ (Fullscreen) */}
            {isEditingCoordinates && (
              <button
                id="btn-save-coordinates-fs"
                onClick={handleSaveCoordinates}
                disabled={isSavingCoordinates || Object.keys(pendingCoordinates).length === 0}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  Object.keys(pendingCoordinates).length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/40 ring-2 ring-emerald-400'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
                title={
                  Object.keys(pendingCoordinates).length > 0
                    ? `Lưu tọa độ mới cho ${Object.keys(pendingCoordinates).length} nhà đã đổi vị trí`
                    : 'Kéo thả ít nhất một điểm nhà để lưu'
                }
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isSavingCoordinates
                    ? 'Đang lưu...'
                    : Object.keys(pendingCoordinates).length > 0
                      ? `Hoàn thành (${Object.keys(pendingCoordinates).length})`
                      : 'Hoàn thành'}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isPanelOpen
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  : 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30'
              }`}
            >
              {isPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isPanelOpen ? 'Ẩn bảng chi tiết' : 'Hiện bảng chi tiết'}</span>
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Thoát chế độ toàn màn hình (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Thoát (Esc)</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Banner (hidden in fullscreen mode to maximize map area) */}
      {!isFullscreen && (
        <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div id="advanced-eyebrow" className="text-[11px] sm:text-xs font-bold text-blue-600 tracking-wider uppercase mb-0.5">
                BẢN ĐỒ GIÁM SÁT NÂNG CAO
              </div>
              <h2 id="advanced-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Bản đồ số địa bàn {wardName}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {filteredHouseholds.length} / {households.length} vị trí
                </span>
              </h2>
              <p id="advanced-description" className="text-xs sm:text-sm text-slate-500 mt-1">
                Tích hợp bộ lọc trực quan nổi trên bản đồ, chế độ toàn màn hình, chuyển đổi lớp vệ tinh và xuất hình ảnh trích xuất địa bàn.
              </p>
            </div>

            {/* Top Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('area-map')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 min-h-[38px] cursor-pointer"
                  title="Chuyển sang xem sơ đồ khối"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sơ đồ khối</span>
                </button>
              )}

              {/* Button: Hướng dẫn sử dụng nút bấm */}
              <button
                id="btn-open-map-quick-guide"
                onClick={() => setIsGuideOpen(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs min-h-[38px] cursor-pointer"
                title="Xem hướng dẫn nhanh các nút bấm trên bản đồ"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span>Hướng dẫn</span>
              </button>

              <button
                id="btn-quick-screenshot"
                onClick={handleTakeScreenshot}
                disabled={isCapturing}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs min-h-[38px] active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isCapturing ? 'Đang chụp...' : 'Chụp ảnh'}</span>
              </button>

              <button
                id="btn-toggle-fullscreen"
                onClick={handleToggleFullscreen}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs min-h-[38px] cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Toàn màn hình</span>
              </button>

              {/* Button: Đổi tọa độ nhà (Đặt gần nút Ẩn/Hiện bảng chi tiết) */}
              <button
                id="btn-toggle-edit-coordinates"
                onClick={handleToggleEditCoordinates}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 min-h-[38px] cursor-pointer ${
                  isEditingCoordinates
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title={isEditingCoordinates ? 'Thoát chế độ chỉnh sửa tọa độ' : 'Kéo thả đổi tọa độ các điểm nhà trên bản đồ'}
              >
                <Move className="w-3.5 h-3.5" />
                <span>{isEditingCoordinates ? 'Đang đổi tọa độ' : 'Đổi tọa độ nhà'}</span>
              </button>

              {/* Button: Hoàn thành chỉnh sửa tọa độ (Hiện khi đang ở chế độ chỉnh sửa) */}
              {isEditingCoordinates && (
                <button
                  id="btn-save-coordinates"
                  onClick={handleSaveCoordinates}
                  disabled={isSavingCoordinates || Object.keys(pendingCoordinates).length === 0}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 min-h-[38px] cursor-pointer shadow-xs active:scale-95 ${
                    Object.keys(pendingCoordinates).length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50 shadow-emerald-900/20 animate-pulse'
                      : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                  }`}
                  title={
                    Object.keys(pendingCoordinates).length > 0
                      ? `Lưu tọa độ mới cho ${Object.keys(pendingCoordinates).length} nhà đã di chuyển`
                      : 'Kéo thả ít nhất một điểm nhà để lưu'
                  }
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {isSavingCoordinates
                      ? 'Đang lưu...'
                      : Object.keys(pendingCoordinates).length > 0
                        ? `Hoàn thành (${Object.keys(pendingCoordinates).length} nhà)`
                        : 'Hoàn thành'}
                  </span>
                </button>
              )}

              <button
                id="btn-toggle-side-panel"
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 min-h-[38px] cursor-pointer ${
                  isPanelOpen
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {isPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
                <span>{isPanelOpen ? 'Ẩn bảng chi tiết' : 'Hiện bảng chi tiết'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Map & Side Inspector Layout */}
      <div
        className={
          isFullscreen
            ? 'flex-1 min-h-0 w-full flex gap-3 relative overflow-hidden'
            : `grid grid-cols-1 ${isPanelOpen ? 'lg:grid-cols-12' : 'grid-cols-1'} gap-4 sm:gap-5 items-start`
        }
      >
        {/* Map Container Wrapper */}
        <div
          className={
            isFullscreen
              ? 'flex-1 min-h-0 h-full relative flex flex-col rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl'
              : `${isPanelOpen ? 'lg:col-span-8' : 'w-full'} bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col`
          }
        >
          {/* MAP CANVAS */}
          <div
            id="advanced-map-canvas"
            ref={mapContainerRef}
            style={isFullscreen ? { width: '100%', height: '100%' } : { width: '100%' }}
            className={
              isFullscreen
                ? 'w-full h-full flex-1 min-h-0 relative z-0'
                : 'w-full h-[480px] sm:h-[560px] lg:h-[650px] rounded-lg sm:rounded-xl overflow-hidden bg-[#e2e8f0] relative z-0'
            }
          />

          {/* ========================================================================= */}
          {/* FLOATING COORDINATE EDITING ACTION BAR OVER MAP */}
          {/* ========================================================================= */}
          {isEditingCoordinates && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[94%] sm:w-auto bg-slate-950/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border-2 border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-md">
                  <Move className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-300 flex items-center gap-2">
                    <span>CHẾ ĐỘ KÉO THẢ TỌA ĐỘ NHÀ</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/40">
                      {Object.keys(pendingCoordinates).length} nhà đã chuyển
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Kéo thả ghim nhà trên bản đồ đến vị trí thực tế, sau đó nhấn "Hoàn thành".
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  id="btn-map-save-coordinates"
                  onClick={handleSaveCoordinates}
                  disabled={isSavingCoordinates || Object.keys(pendingCoordinates).length === 0}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    Object.keys(pendingCoordinates).length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/40 ring-2 ring-emerald-400 active:scale-95'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                  title={
                    Object.keys(pendingCoordinates).length > 0
                      ? `Lưu tọa độ mới cho ${Object.keys(pendingCoordinates).length} nhà`
                      : 'Kéo thả ít nhất một nhà để lưu'
                  }
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {isSavingCoordinates
                      ? 'Đang lưu...'
                      : Object.keys(pendingCoordinates).length > 0
                        ? `Hoàn thành (${Object.keys(pendingCoordinates).length} nhà)`
                        : 'Hoàn thành'}
                  </span>
                </button>

                <button
                  id="btn-map-cancel-coordinates"
                  onClick={handleCancelEditCoordinates}
                  disabled={isSavingCoordinates}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Hủy bỏ các thay đổi và trở lại vị trí cũ"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Hủy</span>
                </button>
              </div>
            </div>
          )}

          {/* Real-time notification Toast */}
          {coordNotification && !isEditingCoordinates && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-emerald-900/95 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-xl border border-emerald-500/50 flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{coordNotification}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FLOATING IN-MAP FILTER & TOOLS OVERLAY (HIỂN THỊ TRỰC TIẾP TRÊN BẢN ĐỒ) */}
          {/* ========================================================================= */}

          {/* 1. TOP FLOATING FILTER BAR */}
          <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-2xl z-20 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-lg p-2.5 sm:p-3 space-y-2">
              {/* Row 1: Quick Search & Status Filter & Expand Toggle */}
              <div className="flex items-center gap-2">
                {/* Search Box on Map */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm số nhà, chủ hộ, cơ sở..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Advanced Filter Toggle Button */}
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 border ${
                    showAdvancedFilters || activeFiltersCount > 0
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                  title="Mở rộng bộ lọc chi tiết"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bộ lọc</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {/* Minimize/Maximize filter overlay */}
                <button
                  onClick={() => setIsFilterBarExpanded(!isFilterBarExpanded)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shrink-0"
                  title={isFilterBarExpanded ? 'Thu gọn thanh lọc' : 'Mở rộng thanh lọc'}
                >
                  {isFilterBarExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Row 2: Main Status Chips (Visible when expanded) */}
              {isFilterBarExpanded && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
                  {/* Tất cả */}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                      statusFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({households.length})
                  </button>

                  {/* Cảnh báo / Hết hạn */}
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'warning' ? 'all' : 'warning')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 border ${
                      statusFilter === 'warning'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-200'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Hết hạn</span>
                  </button>

                  {/* Chú ý ANTT */}
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'alert' ? 'all' : 'alert')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 border ${
                      statusFilter === 'alert'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border-rose-200'
                    }`}
                  >
                    <AlertOctagon className="w-3 h-3 text-rose-600" />
                    <span>Chú ý</span>
                  </button>

                  {/* Cơ sở KD */}
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'business' ? 'all' : 'business')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 border ${
                      statusFilter === 'business'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-200'
                    }`}
                  >
                    <Store className="w-3 h-3 text-blue-600" />
                    <span>Cơ sở KD</span>
                  </button>

                  {/* Hộ bình thường */}
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'normal' ? 'all' : 'normal')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shrink-0 border ${
                      statusFilter === 'normal'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Bình thường</span>
                  </button>
                </div>
              )}

              {/* Row 3: Extended Filter Controls Panel (when showAdvancedFilters is true) */}
              {isFilterBarExpanded && showAdvancedFilters && (
                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                  {/* Hamlet & Streets Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block mb-1">Khu vực địa bàn:</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {hamletList.map(h => (
                          <button
                            key={h}
                            onClick={() => setHamletFilter(h)}
                            className={`py-1 px-2 text-center rounded-md font-semibold text-[11px] whitespace-nowrap transition-colors ${
                              hamletFilter === h ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {h === 'all' ? 'Tất cả' : h}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block mb-1">Tuyến đường:</span>
                      <select
                        value={streetFilter}
                        onChange={e => setStreetFilter(e.target.value)}
                        className="w-full py-1 px-2 bg-slate-100 text-slate-700 rounded-md border border-slate-200 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="all">Tất cả các tuyến đường</option>
                        {streetList
                          .filter(s => s !== 'all')
                          .map(st => (
                            <option key={st} value={st}>
                              Đường {st}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Demographics count filter */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">Quy mô nhân khẩu:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setResidentsFilter('all')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                          residentsFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tất cả
                      </button>
                      <button
                        onClick={() => setResidentsFilter('crowded')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                          residentsFilter === 'crowded' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Đông người (&gt;4)
                      </button>
                      <button
                        onClick={() => setResidentsFilter('medium')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                          residentsFilter === 'medium' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Gia đình (2-4)
                      </button>
                      <button
                        onClick={() => setResidentsFilter('single')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                          residentsFilter === 'single' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Độc thân (1)
                      </button>

                      {/* Reset filter link */}
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="ml-auto text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 py-1 px-1.5 rounded hover:bg-red-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Đặt lại</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Status summary pill */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>
                    Đang hiển thị: <strong className="text-slate-800 font-bold">{filteredHouseholds.length}</strong> / {households.length}{' '}
                    điểm
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-[10px]">10.7440° B, 106.6130° Đ</div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. FLOATING RIGHT ACTION TOOLBAR (TRỰC TIẾP TRÊN BẢN ĐỒ) */}
          {/* ========================================================================= */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
            {/* Base Layer Switcher Button & Dropdown */}
            <div className="relative">
              <button
                id="btn-map-layers"
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-white transition-all cursor-pointer"
                title="Đổi lớp bản đồ nền (OSM / Vệ tinh / Đô thị)"
              >
                <Layers className="w-4 h-4" />
              </button>

              {showLayerMenu && (
                <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-2 space-y-1 text-xs z-30 animate-in fade-in zoom-in-95">
                  <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">Lớp bản đồ nền</div>
                  {(Object.keys(TILE_LAYERS) as BaseLayerType[]).map(layerKey => (
                    <button
                      key={layerKey}
                      onClick={() => {
                        setCurrentLayer(layerKey);
                        setShowLayerMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-semibold transition-colors ${
                        currentLayer === layerKey ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{TILE_LAYERS[layerKey].name}</span>
                      {currentLayer === layerKey && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle Security Buffer Zones (Vùng an ninh) */}
            <button
              id="btn-toggle-security-zones"
              onClick={() => setShowSecurityZones(!showSecurityZones)}
              className={`w-10 h-10 rounded-xl backdrop-blur-md border shadow-md flex items-center justify-center transition-all cursor-pointer ${
                showSecurityZones
                  ? 'bg-rose-600 text-white border-rose-600 shadow-rose-200'
                  : 'bg-white/95 text-slate-700 border-slate-200 hover:text-rose-600 hover:bg-white'
              }`}
              title={showSecurityZones ? 'Tắt bán kính giám sát an ninh' : 'Bật bán kính an ninh quanh điểm chú ý'}
            >
              <Radio className="w-4 h-4" />
            </button>

            {/* Toggle Marker Label Mode (Chi tiết vs Tối giản) */}
            <button
              id="btn-toggle-marker-mode"
              onClick={() => setMarkerDisplayMode(markerDisplayMode === 'detailed' ? 'minimal' : 'detailed')}
              className={`w-10 h-10 rounded-xl backdrop-blur-md border shadow-md flex items-center justify-center transition-all cursor-pointer ${
                markerDisplayMode === 'minimal'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white/95 text-slate-700 border-slate-200 hover:text-amber-600 hover:bg-white'
              }`}
              title={markerDisplayMode === 'detailed' ? 'Chuyển sang ghim tối giản' : 'Chuyển sang nhãn số nhà chi tiết'}
            >
              <MapPin className="w-4 h-4" />
            </button>

            {/* Center View */}
            <button
              id="btn-center-map"
              onClick={handleResetView}
              className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-white transition-all cursor-pointer"
              title={`Về vị trí trung tâm ${wardName}`}
            >
              <Compass className="w-4 h-4" />
            </button>

            {/* In-Map Screenshot Button */}
            <button
              id="btn-inmap-screenshot"
              onClick={handleTakeScreenshot}
              disabled={isCapturing}
              className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-white transition-all cursor-pointer disabled:opacity-50"
              title="Chụp ảnh màn hình bản đồ"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* In-Map Fullscreen Toggle */}
            <button
              id="btn-inmap-fullscreen"
              onClick={handleToggleFullscreen}
              className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-white transition-all cursor-pointer"
              title={isFullscreen ? 'Thu nhỏ màn hình (Esc)' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* In-Map Toggle Coordinate Edit */}
            <button
              id="btn-inmap-toggle-edit-coord"
              onClick={handleToggleEditCoordinates}
              className={`w-10 h-10 rounded-xl backdrop-blur-md border shadow-md flex items-center justify-center transition-all cursor-pointer ${
                isEditingCoordinates
                  ? 'bg-amber-500 text-white border-amber-600 shadow-amber-300 ring-2 ring-amber-400'
                  : 'bg-white/95 text-slate-700 border-slate-200 hover:text-amber-600 hover:bg-white'
              }`}
              title={isEditingCoordinates ? 'Thoát chế độ đổi tọa độ' : 'Kéo thả đổi vị trí tọa độ nhà'}
            >
              <Move className="w-4 h-4" />
            </button>

            {/* In-Map Quick Guide Toggle */}
            <button
              id="btn-inmap-help-guide"
              onClick={() => setIsGuideOpen(true)}
              className="w-10 h-10 rounded-xl bg-indigo-50/95 backdrop-blur-md border border-indigo-200 text-indigo-700 shadow-md flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
              title="Hướng dẫn nhanh các nút bấm bản đồ"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* In-Map Toggle Side Panel */}
            <button
              id="btn-inmap-toggle-panel"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className={`w-10 h-10 rounded-xl backdrop-blur-md border shadow-md flex items-center justify-center transition-all cursor-pointer ${
                isPanelOpen
                  ? 'bg-white/95 text-slate-700 border-slate-200 hover:text-blue-600 hover:bg-white'
                  : 'bg-blue-600 text-white border-blue-600 shadow-blue-200'
              }`}
              title={isPanelOpen ? 'Ẩn bảng chi tiết bên cạnh' : 'Hiện bảng chi tiết bên cạnh'}
            >
              {isPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>

            {/* Zoom Controls */}
            <div className="flex flex-col rounded-xl overflow-hidden border border-slate-200 shadow-md bg-white/95 backdrop-blur-md">
              <button
                onClick={handleZoomIn}
                className="w-10 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-base transition-colors"
                title="Phóng to"
              >
                +
              </button>
              <div className="h-[1px] bg-slate-200"></div>
              <button
                onClick={handleZoomOut}
                className="w-10 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold text-base transition-colors"
                title="Thu nhỏ"
              >
                &minus;
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. FLOATING BOTTOM LEGEND OVERLAY (CHÚ THÍCH TRỰC TIẾP TRÊN BẢN ĐỒ) */}
          {/* ========================================================================= */}
          <div className="absolute bottom-3 left-3 z-10 pointer-events-none hidden md:block">
            <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-2 rounded-xl shadow-lg border border-slate-800 flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-200 font-medium">Bình thường</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-slate-200 font-medium">Cảnh báo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="text-slate-200 font-medium">Chú ý ANTT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="text-slate-200 font-medium">Cơ sở KD</span>
              </div>
            </div>
          </div>

          {/* Quick Selected House Floating Pill when panel is closed */}
          {!isPanelOpen && selectedHouse && (
            <div className="absolute bottom-3 right-3 z-20 pointer-events-auto bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl max-w-xs animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-extrabold text-slate-900 text-xs truncate">
                  Số {selectedHouse.houseNumber} {selectedHouse.street}
                </div>
                <button
                  onClick={() => setIsPanelOpen(true)}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shrink-0"
                >
                  Mở chi tiết
                </button>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                {selectedHouse.businessName ? `🏪 ${selectedHouse.businessName}` : `👤 ${selectedHouse.ownerName}`} (
                {selectedHouse.residentsCount} người)
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SIDE INSPECTOR PANEL (CÓ THỂ ẨN / HIỆN LINH HOẠT) */}
        {/* ========================================================================= */}
        {isPanelOpen && (
          <div
            className={
              isFullscreen
                ? 'w-80 sm:w-96 h-full min-h-0 shrink-0 bg-white rounded-xl shadow-2xl border border-slate-800 overflow-y-auto p-4 space-y-3.5 animate-in fade-in slide-in-from-right-3 duration-200'
                : 'lg:col-span-4 bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5 sm:space-y-4 animate-in fade-in slide-in-from-right-3 duration-200'
            }
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">Thông tin địa bàn</h3>
              </div>

              <div className="flex items-center gap-1">
                {selectedHouse && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-100">
                    {selectedHouse.hamlet}
                  </span>
                )}
                {/* Close Panel Button */}
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Ẩn bảng chi tiết"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selectedHouse ? (
              <div className="space-y-3.5 text-xs">
                {/* House Title & Location */}
                <div>
                  <div className="text-lg font-extrabold text-slate-900 leading-tight">
                    Số {selectedHouse.houseNumber} {selectedHouse.street}
                  </div>
                  <div className="text-slate-500 font-medium mt-1 flex items-center gap-1.5 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>
                      {selectedHouse.hamlet}
                      {selectedHouse.ward ? `, ${selectedHouse.ward}` : ''}
                      {selectedHouse.city ? `, ${selectedHouse.city}` : ''}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Tọa độ: {getHouseholdCoords(selectedHouse)[0].toFixed(5)}, {getHouseholdCoords(selectedHouse)[1].toFixed(5)}
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedHouse.status === 'warning' && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold border border-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Cảnh báo hết hạn</span>
                    </span>
                  )}
                  {selectedHouse.status === 'alert' && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-bold border border-rose-300 flex items-center gap-1">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Đối tượng chú ý ANTT</span>
                    </span>
                  )}
                  {selectedHouse.status === 'business' && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold border border-blue-300 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cơ sở kinh doanh có ĐK</span>
                    </span>
                  )}
                  {selectedHouse.status === 'normal' && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Hộ dân cư bình thường</span>
                    </span>
                  )}
                </div>

                {/* Pending coordinate banner in inspector if dragged */}
                {pendingCoordinates[selectedHouse.id] && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã thay đổi tọa độ (chờ lưu)</span>
                      </div>
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">Mới</span>
                    </div>
                    <div className="text-[11px] font-mono text-emerald-800">
                      Tọa độ mới: [{pendingCoordinates[selectedHouse.id][0].toFixed(6)},{' '}
                      {pendingCoordinates[selectedHouse.id][1].toFixed(6)}]
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Tọa độ cũ: [{getHouseholdCoords(selectedHouse)[0].toFixed(6)}, {getHouseholdCoords(selectedHouse)[1].toFixed(6)}]
                    </div>
                  </div>
                )}

                {/* Business Information */}
                {selectedHouse.businessName && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1">
                    <div className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      <span>{selectedHouse.businessName}</span>
                    </div>
                    <div className="text-[11px] text-blue-800">
                      Ngành nghề: <strong>{selectedHouse.businessCategory}</strong>
                    </div>
                    {selectedHouse.licenseExpiry && (
                      <div className="text-[11px] font-bold text-amber-900 mt-1">Hạn giấy phép: {selectedHouse.licenseExpiry}</div>
                    )}
                  </div>
                )}

                {/* Warning message if applicable */}
                {selectedHouse.warningMessage && (
                  <div
                    className={`p-3 rounded-xl font-medium text-[11px] border ${
                      selectedHouse.status === 'alert'
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <strong>Nội dung cảnh báo:</strong> {selectedHouse.warningMessage}
                  </div>
                )}

                {/* Demographic details */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Chủ hộ / Quản lý:</span>
                    <span className="font-bold text-slate-900">{selectedHouse.ownerName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Số điện thoại:</span>
                    <a
                      href={`tel:${selectedHouse.ownerPhone}`}
                      className="font-bold font-mono text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{selectedHouse.ownerPhone}</span>
                    </a>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tổng nhân khẩu:</span>
                    <span className="font-bold text-slate-900">
                      {selectedHouse.residentsCount} người ({selectedHouse.maleCount} Nam, {selectedHouse.femaleCount} Nữ)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Cơ cấu tuổi:</span>
                    <span className="text-slate-700">
                      {selectedHouse.above18Count} người lớn, {selectedHouse.under18Count} trẻ em
                    </span>
                  </div>
                </div>

                {/* Field Notes */}
                <div className="space-y-1">
                  <span className="font-bold text-slate-700">Ghi chú cán bộ phụ trách:</span>
                  <p className="p-3 bg-slate-50 rounded-xl text-slate-600 text-[11px] leading-relaxed border border-slate-200/70">
                    {selectedHouse.notes}
                  </p>
                  <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                    <span>Kiểm tra gần nhất: {selectedHouse.lastCheckedDate}</span>
                    <span>Cán bộ: {selectedHouse.officerInCharge}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-1 space-y-2">
                  <button
                    onClick={() => onSelectHousehold(selectedHouse)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Xem đầy đủ hồ sơ & cập nhật</span>
                  </button>

                  <a
                    href={`tel:${selectedHouse.ownerPhone}`}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-200 text-center"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Gọi điện trực tiếp ({selectedHouse.ownerPhone})</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-14 px-4 space-y-2 text-slate-400">
                <MapPin className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                <div className="text-xs font-bold text-slate-600">Chưa chọn vị trí</div>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Nhấn vào bất kỳ ghim số nhà nào trên bản đồ để xem chi tiết nhân khẩu, trạng thái an ninh và lịch sử kiểm tra.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SCREENSHOT PREVIEW MODAL (XEM TRƯỚC VÀ TẢI VỀ ẢNH CHỤP BẢN ĐỒ) */}
      {/* ========================================================================= */}
      {isScreenshotModalOpen && screenshotUrl && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Ảnh chụp trích xuất bản đồ an ninh địa bàn</h3>
                  <p className="text-xs text-slate-500">Bản đồ {wardName} kèm khung tiêu đề hành chính và thông số giám sát</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="modal-header-share-button"
                  onClick={handleShareScreenshot}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Chia sẻ nhanh ảnh trích xuất bản đồ"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Chia sẻ</span>
                </button>

                <button
                  onClick={() => setIsScreenshotModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Đóng cửa sổ"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Image Preview */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 flex flex-col items-center justify-center min-h-[300px]">
              <div className="rounded-xl overflow-hidden shadow-md border border-slate-300 max-h-[52vh] w-auto">
                <img src={screenshotUrl} alt="Ảnh chụp bản đồ an ninh" className="w-full h-auto object-contain max-h-[52vh]" />
              </div>
            </div>

            {/* Expandable Share Channels Drawer */}
            {isShareMenuOpen && (
              <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 animate-in slide-in-from-bottom-2 duration-150 shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Share2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wide">CHỌN KÊNH CHIA SẺ ẢNH BẢN ĐỒ</span>
                  </div>
                  <button
                    onClick={() => setIsShareMenuOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>Ẩn bảng</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* 1. Native System Share (Zalo, AirDrop, Messages...) */}
                  {canNativeShare && (
                    <button
                      onClick={handleNativeShare}
                      disabled={isSharing}
                      className="p-3 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50/80 text-left transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-emerald-950 flex items-center gap-1">
                          <span>Bảng chia sẻ hệ thống</span>
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                        </div>
                        <p className="text-[11px] text-emerald-700/90 leading-snug mt-0.5">
                          Mở danh bạ ứng dụng: Zalo, AirDrop, Tin nhắn, Bluetooth
                        </p>
                      </div>
                    </button>
                  )}

                  {/* 2. Zalo */}
                  <button
                    onClick={handleShareZalo}
                    className="p-3 rounded-xl border border-blue-200 bg-white hover:bg-blue-50/80 text-left transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0068FF] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform font-black text-xs">
                      Zalo
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-blue-950 flex items-center gap-1">
                        <span>Gửi qua Zalo</span>
                        <ExternalLink className="w-3 h-3 text-blue-500" />
                      </div>
                      <p className="text-[11px] text-blue-700 leading-snug mt-0.5">Tự động copy ảnh & mở Zalo Web (Dán Ctrl+V gửi ngay)</p>
                    </div>
                  </button>

                  {/* 3. Telegram */}
                  <button
                    onClick={handleShareTelegram}
                    className="p-3 rounded-xl border border-sky-200 bg-white hover:bg-sky-50/80 text-left transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#229ED9] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-sky-950 flex items-center gap-1">
                        <span>Gửi qua Telegram</span>
                        <ExternalLink className="w-3 h-3 text-sky-500" />
                      </div>
                      <p className="text-[11px] text-sky-700 leading-snug mt-0.5">Chia sẻ liên kết & báo cáo đến nhóm tác chiến</p>
                    </div>
                  </button>

                  {/* 4. Email */}
                  <button
                    onClick={handleShareEmail}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-left transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900">Gửi thư điện tử (Email)</div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Gửi báo cáo kèm thông số giám sát địa bàn</p>
                    </div>
                  </button>

                  {/* 5. Copy image directly */}
                  <button
                    onClick={handleCopyScreenshot}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-left transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Copy className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900">Sao chép ảnh (Clipboard)</div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Dán (Ctrl+V) ngay vào Word, PowerPoint hoặc Chat</p>
                    </div>
                  </button>

                  {/* 6. Copy App URL */}
                  <button
                    onClick={handleCopyLink}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-left transition-all flex items-start gap-3 group cursor-pointer shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900">Sao chép liên kết hệ thống</div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Chia sẻ đường dẫn truy cập bản đồ trực tuyến</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer: Action buttons */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {shareFeedback ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{shareFeedback}</span>
                  </div>
                ) : (
                  <span>Độ phân giải cao (2x) • Định dạng PNG • Tự động gắn watermark</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* SHARE BUTTON */}
                <button
                  id="btn-share-screenshot"
                  onClick={handleShareScreenshot}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  title="Chia sẻ ảnh trích xuất bản đồ qua Zalo, Email, Hệ thống"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Chia sẻ</span>
                  {isShareMenuOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* COPY BUTTON */}
                <button
                  onClick={handleCopyScreenshot}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copySuccess ? 'Đã sao chép!' : 'Sao chép ảnh'}</span>
                </button>

                {/* PRINT BUTTON */}
                <button
                  onClick={handlePrintScreenshot}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In ảnh</span>
                </button>

                {/* DOWNLOAD BUTTON */}
                <button
                  onClick={handleDownloadScreenshot}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải về (.PNG)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK GUIDE OVERLAY MODAL */}
      <MapQuickGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
