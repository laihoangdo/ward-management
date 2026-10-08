import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas-pro';
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapLibreAreaMap.css';
import { HouseholdFacility } from '../types';
import apTc2Schematic from '../data/apTc2Schematic.json';
import apTc2DxfLinework from '../data/apTc2DxfLinework.json';
import {
  BUILDING_TYPES,
  BuildingTypeConfig,
  buildingTypeFromFloors,
  HOUSE_STATUS_STYLE,
  pointFootprint,
  ROAD_STYLE,
  roadRibbon,
  RoadType,
  UNKNOWN_BUILDING_COLOR,
} from './mapModel';
import { ThreeBuilding, ThreeBuildingLayer } from './ThreeBuildingLayer';

type Coordinate = [number, number];
type MapFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  {
    kind: 'building' | 'road' | 'road-surface' | 'area' | 'dxf-line';
    householdId?: string;
    height?: number;
    color?: string;
    id?: string;
    closed?: boolean;
    drawingMatch?: boolean;
    address?: string;
    name?: string;
    roadType?: RoadType;
    width?: number;
    status?: string;
    buildingType?: string;
    floors?: number;
    residentsCount?: number;
    estimated?: boolean;
    hoverId?: string;
  }
>;
type MapFeatures = GeoJSON.FeatureCollection<GeoJSON.Geometry, MapFeature['properties']>;

const EMPTY_FEATURES: MapFeatures = { type: 'FeatureCollection', features: [] };
const HOVER_COLOR = '#fff2a8';
const hoverColor = (base: unknown): any => ['case', ['boolean', ['feature-state', 'hover'], false], HOVER_COLOR, base];
function toThreeBuildings(features: MapFeatures, visualization: string, customColor: string, statusFilter: string): ThreeBuilding[] {
  return features.features.flatMap(feature => {
    if (feature.properties.kind !== 'building') return [];
    if (statusFilter !== 'all' && feature.properties.status !== statusFilter) return [];
    const geometry = feature.geometry;
    const coordinates =
      geometry.type === 'Polygon' ? geometry.coordinates : geometry.type === 'MultiPolygon' ? geometry.coordinates[0] : null;
    const height = feature.properties.height || 3.5;
    let color = feature.properties.color || UNKNOWN_BUILDING_COLOR;
    if (visualization === 'custom') color = customColor;
    if (visualization === 'height')
      color =
        height >= 18
          ? '#9c82bd'
          : height >= 14
            ? '#dc7770'
            : height >= 11
              ? '#eea25c'
              : height >= 8
                ? '#68b884'
                : height >= 5
                  ? '#65a9db'
                  : '#e9c46a';
    if (visualization === 'risk') color = HOUSE_STATUS_STYLE[feature.properties.status || '']?.color || UNKNOWN_BUILDING_COLOR;
    const statusColor = HOUSE_STATUS_STYLE[feature.properties.status || '']?.color;
    return coordinates ? [{ id: feature.properties.hoverId || '', coordinates, height, color, statusColor }] : [];
  });
}
// Blender positions are drawing coordinates. Keep this scene separate from the real OSM map.
const SCHEMATIC_SCALE = 111_320;
const SCHEMATIC_FEATURES: MapFeatures = {
  type: 'FeatureCollection',
  features: apTc2DxfLinework.addressBlocks.map((block, index) => {
    const ring: Coordinate[] = block.points.map(([x, y]) => [x / SCHEMATIC_SCALE, y / SCHEMATIC_SCALE]);
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        kind: 'building',
        id: `${block.address}-${index}`,
        hoverId: `schematic-${index}`,
        height: block.height * 1.6,
        color: block.estimated ? '#7ba6d6' : block.height >= 8 ? '#dc7770' : block.height >= 6 ? '#e9a45e' : '#67b99a',
        drawingMatch: !block.estimated,
      },
    };
  }),
};
const SCHEMATIC_LINEWORK: MapFeatures = {
  type: 'FeatureCollection',
  features: apTc2DxfLinework.paths.map((path, index) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: path.points.map(([x, y]) => [x / SCHEMATIC_SCALE, y / SCHEMATIC_SCALE]),
    },
    properties: { kind: 'dxf-line', id: `dxf-${index}`, closed: path.closed },
  })),
};
const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Esri, Earthstar Geographics',
    },
  },
  layers: [
    { id: 'ground', type: 'background', paint: { 'background-color': '#f3f4ef' } },
    { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } },
    { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
  ],
};

function validCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function allCoordinatesValid(value: unknown): boolean {
  if (validCoordinate(value)) return true;
  return Array.isArray(value) && value.length > 0 && value.every(allCoordinatesValid);
}

function parseAreaGeoJson(value: unknown): MapFeatures {
  if (!value || typeof value !== 'object' || (value as any).type !== 'FeatureCollection' || !Array.isArray((value as any).features)) {
    throw new Error('Cần tệp GeoJSON FeatureCollection đã gắn tọa độ WGS84.');
  }
  const features: MapFeature[] = [];
  for (const raw of (value as any).features) {
    const geometry = raw?.geometry;
    const kind = raw?.properties?.kind;
    const isBuilding = kind === 'building' && (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon');
    const isRoad = kind === 'road' && (geometry?.type === 'LineString' || geometry?.type === 'MultiLineString');
    const isArea = kind === 'area' && (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon');
    if (!isBuilding && !isRoad && !isArea) continue;
    if (!allCoordinatesValid(geometry.coordinates)) throw new Error('Tọa độ không hợp lệ. GeoJSON phải dùng [kinh độ, vĩ độ] WGS84.');
    const height = Number(raw.properties?.height);
    const floors = Number(raw.properties?.floors);
    const width = Number(raw.properties?.width);
    const roadType: RoadType = ['main', 'secondary', 'alley'].includes(raw.properties?.roadType) ? raw.properties.roadType : 'secondary';
    const buildingType = BUILDING_TYPES.find(item => item.code === raw.properties?.buildingType);
    features.push({
      type: 'Feature',
      geometry,
      properties: {
        kind,
        ...(typeof raw.properties?.householdId === 'string' || typeof raw.properties?.householdId === 'number'
          ? { householdId: String(raw.properties.householdId) }
          : {}),
        ...(Number.isFinite(height) && height > 0 && height <= 300 ? { height } : {}),
        ...(Number.isFinite(floors) && floors > 0 && floors <= 100 ? { floors } : {}),
        ...(Number.isFinite(width) && width > 0 && width <= 100 ? { width } : {}),
        ...(typeof raw.properties?.id === 'string' || typeof raw.properties?.id === 'number' ? { id: String(raw.properties.id) } : {}),
        ...(typeof raw.properties?.name === 'string' ? { name: raw.properties.name } : {}),
        ...(typeof raw.properties?.address === 'string' ? { address: raw.properties.address } : {}),
        ...(typeof raw.properties?.status === 'string' ? { status: raw.properties.status } : {}),
        ...(buildingType ? { buildingType: buildingType.code, color: buildingType.color } : {}),
        ...(isRoad ? { roadType } : {}),
      },
    });
  }
  if (features.length === 0) throw new Error('Không thấy đối tượng kind="building", "road" hoặc "area" hợp lệ.');
  return { type: 'FeatureCollection', features };
}

function getBounds(features: MapFeatures): maplibregl.LngLatBounds | null {
  const bounds = new maplibregl.LngLatBounds();
  let found = false;
  const add = (value: unknown): void => {
    if (validCoordinate(value)) {
      bounds.extend(value);
      found = true;
    } else if (Array.isArray(value)) value.forEach(add);
  };
  features.features.forEach(feature => add((feature.geometry as any).coordinates));
  return found ? bounds : null;
}

const SCHEMATIC_BOUNDS = getBounds(SCHEMATIC_LINEWORK);
const LAYER_OPTIONS = [
  ['buildings', 'Nhà dân / Buildings'],
  ['main', 'Đường chính'],
  ['secondary', 'Đường phụ'],
  ['alley', 'Hẻm/ngõ'],
  ['houseNumbers', 'Số nhà'],
  ['householdInfo', 'Điểm hộ dân'],
  ['boundaries', 'Ranh khu vực'],
  ['streetNames', 'Tên đường'],
  ['areaNames', 'Tên khu vực'],
  ['houseIds', 'ID nhà'],
  ['owners', 'Chủ hộ'],
  ['buildingTypes', 'Loại nhà'],
  ['places', 'Địa điểm quan trọng'],
  ['security', 'Điểm an ninh'],
  ['schools', 'Trường học'],
  ['markets', 'Chợ'],
  ['religious', 'Cơ sở tôn giáo'],
  ['facilities', 'Công trình công cộng'],
] as const;

interface Props {
  households: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
  onUpdateCoordinates?: (updates: { id: string; coordinates: [number, number] }[]) => Promise<void> | void;
}

export default function MapLibreAreaMap({ households, onSelectHousehold, onUpdateCoordinates }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const threeLayerRef = useRef<ThreeBuildingLayer | null>(null);
  const labelMarkersRef = useRef<maplibregl.Marker[]>([]);
  const geoLabelMarkersRef = useRef<maplibregl.Marker[]>([]);
  const editMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [baseLayer, setBaseLayer] = useState<'osm' | 'satellite'>('osm');
  const [editingCoordinates, setEditingCoordinates] = useState(false);
  const [pendingCoordinates, setPendingCoordinates] = useState<Record<string, [number, number]>>({});
  const [savingCoordinates, setSavingCoordinates] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [captureFeedback, setCaptureFeedback] = useState('');
  const [is3D, setIs3D] = useState(true);
  const [useThreeBuildings, setUseThreeBuildings] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showMapHelp, setShowMapHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tilt, setTilt] = useState(65);
  const [fullscreen, setFullscreen] = useState(false);
  // The DXF drawing has house footprints; the geographic map may have no GPS points yet.
  const [mapMode, setMapMode] = useState<'schematic' | 'geographic'>('schematic');
  const [showDxfLinework, setShowDxfLinework] = useState(true);
  const [area, setArea] = useState<MapFeatures>(EMPTY_FEATURES);
  const [zones, setZones] = useState<MapFeatures>(EMPTY_FEATURES);
  const [zoom, setZoom] = useState(16);
  const [visualization, setVisualization] = useState<'standard' | 'height' | 'population' | 'households' | 'risk' | 'custom'>('standard');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customColor, setCustomColor] = useState('#65a9db');
  const [buildingTypes, setBuildingTypes] = useState<BuildingTypeConfig[]>(BUILDING_TYPES);
  const [layers, setLayers] = useState({
    buildings: true,
    main: true,
    secondary: true,
    alley: true,
    houseNumbers: true,
    householdInfo: false,
    boundaries: true,
    places: true,
    security: true,
    schools: true,
    markets: true,
    religious: true,
    facilities: true,
    streetNames: true,
    areaNames: true,
    houseIds: false,
    owners: false,
    buildingTypes: false,
  });
  const [message, setMessage] = useState(
    'Đang hiển thị hộ dân hiện có bằng khối 3D minh họa tại tọa độ đã lưu. Nạp GeoJSON WGS84 để bổ sung ranh nhà, đường và khu vực chính xác.',
  );
  const [ready, setReady] = useState(false);
  const householdsRef = useRef(households);
  const selectRef = useRef(onSelectHousehold);
  householdsRef.current = households;
  selectRef.current = onSelectHousehold;

  const householdPoints = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; status: string; residentsCount: number }>>(
    () => ({
      type: 'FeatureCollection',
      features: households.flatMap(h => {
        if (h.coordinatesEstimated) return [];
        const [lat, lng] = h.coordinates || [];
        return typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0 && validCoordinate([lng, lat])
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [lng, lat] },
                properties: { id: h.id, status: h.status, residentsCount: h.residentsCount },
              },
            ]
          : [];
      }),
    }),
    [households],
  );

  const geoBuildings = useMemo<MapFeatures>(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...area.features
          .filter(feature => feature.properties.kind === 'building')
          .map((feature, index) => {
            const type =
              buildingTypes.find(item => item.code === feature.properties.buildingType) ||
              buildingTypeFromFloors(Number(feature.properties.floors), buildingTypes);
            const household = households.find(item => item.id === feature.properties.householdId);
            return {
              ...feature,
              properties: {
                ...feature.properties,
                hoverId: `area-${index}`,
                buildingType: type?.code,
                color: type?.color || UNKNOWN_BUILDING_COLOR,
                height: feature.properties.height || type?.height || 3.5,
                floors: feature.properties.floors || type?.floors,
                status: feature.properties.status || household?.status,
                residentsCount: feature.properties.residentsCount ?? household?.residentsCount,
              },
            };
          }),
        ...households.flatMap(h => {
          if (h.coordinatesEstimated || area.features.some(feature => feature.properties.householdId === h.id)) return [];
          const [lat, lng] = h.coordinates || [];
          if (!validCoordinate([lng, lat]) || lat === 0 || lng === 0) return [];
          return [
            {
              type: 'Feature' as const,
              geometry: { type: 'Polygon' as const, coordinates: pointFootprint(lng, lat) },
              properties: {
                kind: 'building' as const,
                id: h.id,
                hoverId: `household-${h.id}`,
                householdId: h.id,
                address: `${h.houseNumber} ${h.street}`,
                height: 3.5,
                color: UNKNOWN_BUILDING_COLOR,
                residentsCount: h.residentsCount,
                status: h.status,
                estimated: true,
              },
            },
          ];
        }),
      ],
    }),
    [area, households, buildingTypes],
  );

  useEffect(() => {
    let alive = true;
    axios
      .get<{ code: string; name: string; defaultHeightM: number; color: string; floorCount: number }[]>('/api/gis/building-types')
      .then(response => {
        if (!alive) return;
        const config = response.data.flatMap(item =>
          /^#[0-9a-fA-F]{6}$/.test(item.color) && Number.isFinite(item.defaultHeightM) && item.defaultHeightM > 0
            ? [
                {
                  code: item.code as BuildingTypeConfig['code'],
                  label: item.name,
                  height: item.defaultHeightM,
                  color: item.color,
                  floors: item.floorCount,
                },
              ]
            : [],
        );
        if (config.length) setBuildingTypes(config);
      })
      .catch(() => {
        /* Built-in defaults remain usable while the API is unavailable. */
      });
    return () => {
      alive = false;
    };
  }, []);

  const roadSurfaces = useMemo<MapFeatures>(
    () => ({
      type: 'FeatureCollection',
      features: area.features.flatMap(feature => {
        if (feature.properties.kind !== 'road') return [];
        const roadType = feature.properties.roadType || 'secondary';
        const width = feature.properties.width || ROAD_STYLE[roadType].defaultWidth;
        const lines =
          feature.geometry.type === 'LineString'
            ? [feature.geometry.coordinates]
            : feature.geometry.type === 'MultiLineString'
              ? feature.geometry.coordinates
              : [];
        return lines.flatMap((line, index) => {
          const polygon = roadRibbon(line, width);
          return polygon
            ? [
                {
                  type: 'Feature' as const,
                  geometry: { type: 'Polygon' as const, coordinates: polygon },
                  properties: {
                    ...feature.properties,
                    kind: 'road-surface' as const,
                    id: `${feature.properties.id || 'road'}-${index}`,
                    width,
                    roadType,
                  },
                },
              ]
            : [];
        });
      }),
    }),
    [area],
  );

  useEffect(() => {
    let alive = true;
    axios
      .get<{ id: number; name: string; boundaryGeoJson?: string }[]>('/api/area-zones?page=0&size=500')
      .then(response => {
        if (!alive) return;
        const features: MapFeature[] = [];
        for (const zone of response.data) {
          if (!zone.boundaryGeoJson) continue;
          try {
            const parsed = JSON.parse(zone.boundaryGeoJson);
            const candidates =
              parsed.type === 'FeatureCollection'
                ? parsed.features.map((feature: any) => feature.geometry)
                : [parsed.type === 'Feature' ? parsed.geometry : parsed];
            for (const geometry of candidates) {
              if ((geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') && allCoordinatesValid(geometry.coordinates)) {
                features.push({ type: 'Feature', geometry, properties: { kind: 'area', id: String(zone.id), name: zone.name } });
              }
            }
          } catch {
            /* Invalid saved boundary is ignored. */
          }
        }
        setZones({ type: 'FeatureCollection', features });
      })
      .catch(() => {
        /* The household map still works if area zones are unavailable. */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const canvas = document.createElement('canvas');
    if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) {
      setMessage('Trình duyệt này không hỗ trợ WebGL. Hãy dùng bản đồ hiện tại.');
      return;
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [0, 0],
      zoom: 16,
      pitch: 65,
      maxPitch: 80,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: {},
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'top-right');
    map.on('zoomend', () => setZoom(map.getZoom()));
    map.on('load', () => {
      map.addSource('area', { type: 'geojson', data: EMPTY_FEATURES });
      map.addSource('geo-buildings', { type: 'geojson', data: EMPTY_FEATURES, promoteId: 'hoverId' });
      map.addSource('road-surfaces', { type: 'geojson', data: EMPTY_FEATURES });
      map.addSource('zones', { type: 'geojson', data: EMPTY_FEATURES });
      map.addSource('households', { type: 'geojson', data: householdPoints });
      map.addSource('ap-tc2-schematic', { type: 'geojson', data: SCHEMATIC_FEATURES, promoteId: 'hoverId' });
      map.addSource('ap-tc2-dxf-linework', { type: 'geojson', data: SCHEMATIC_LINEWORK });
      map.addLayer({
        id: 'household-heatmap',
        type: 'heatmap',
        source: 'households',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 17, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 17, 38],
          'heatmap-opacity': 0.6,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.2,
            '#c8eee5',
            0.5,
            '#57ad90',
            0.8,
            '#eda65e',
            1,
            '#d75555',
          ],
        },
      });
      map.addLayer({
        id: 'schematic-dxf-linework',
        type: 'line',
        source: 'ap-tc2-dxf-linework',
        paint: {
          'line-color': ['case', ['get', 'closed'], '#b7c3cb', '#8d9ca8'],
          'line-width': ['case', ['get', 'closed'], 1, 1.6],
          'line-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'roads',
        type: 'line',
        source: 'area',
        filter: ['==', ['get', 'kind'], 'road'],
        paint: { 'line-color': '#f59e0b', 'line-width': 5, 'line-opacity': 0.85 },
      });
      map.addLayer({
        id: 'road-3d',
        type: 'fill-extrusion',
        source: 'road-surfaces',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': [
            'match',
            ['get', 'roadType'],
            'main',
            ROAD_STYLE.main.color,
            'alley',
            ROAD_STYLE.alley.color,
            ROAD_STYLE.secondary.color,
          ],
          'fill-extrusion-height': 0.18,
          'fill-extrusion-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'area-fill',
        type: 'fill',
        source: 'zones',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#58a7b3', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'area-outline',
        type: 'line',
        source: 'zones',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#168393', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      map.addLayer({
        id: 'building-outline',
        type: 'fill',
        source: 'geo-buildings',
        filter: ['==', ['get', 'kind'], 'building'],
        paint: { 'fill-color': hoverColor('#2563eb'), 'fill-opacity': 0.3, 'fill-outline-color': '#1e3a8a' },
      });
      map.addLayer({
        id: 'building-status-outline',
        type: 'line',
        source: 'geo-buildings',
        filter: ['==', ['get', 'kind'], 'building'],
        layout: { visibility: 'none' },
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'normal',
            HOUSE_STATUS_STYLE.normal.color,
            'warning',
            HOUSE_STATUS_STYLE.warning.color,
            'alert',
            HOUSE_STATUS_STYLE.alert.color,
            'business',
            HOUSE_STATUS_STYLE.business.color,
            UNKNOWN_BUILDING_COLOR,
          ],
          'line-width': 3,
        },
      });
      map.addLayer({
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'geo-buildings',
        filter: ['==', ['get', 'kind'], 'building'],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': hoverColor(['coalesce', ['get', 'color'], UNKNOWN_BUILDING_COLOR]),
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 3.5],
          'fill-extrusion-opacity': 0.86,
        },
      });
      map.addLayer({
        id: 'building-status-roof',
        type: 'fill-extrusion',
        source: 'geo-buildings',
        filter: ['==', ['get', 'kind'], 'building'],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': hoverColor([
            'match',
            ['get', 'status'],
            'normal',
            HOUSE_STATUS_STYLE.normal.color,
            'warning',
            HOUSE_STATUS_STYLE.warning.color,
            'alert',
            HOUSE_STATUS_STYLE.alert.color,
            'business',
            HOUSE_STATUS_STYLE.business.color,
            UNKNOWN_BUILDING_COLOR,
          ]),
          'fill-extrusion-base': ['coalesce', ['get', 'height'], 3.5],
          'fill-extrusion-height': ['+', ['coalesce', ['get', 'height'], 3.5], 0.45],
          'fill-extrusion-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'household-points',
        type: 'circle',
        source: 'households',
        paint: {
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-color': ['match', ['get', 'status'], 'alert', '#dc2626', 'warning', '#f59e0b', '#059669'],
        },
      });
      map.addLayer({
        id: 'schematic-outline',
        type: 'fill',
        source: 'ap-tc2-schematic',
        layout: { visibility: 'none' },
        paint: { 'fill-color': hoverColor(['get', 'color']), 'fill-opacity': 0.85, 'fill-outline-color': '#66717b' },
      });
      map.addLayer({
        id: 'schematic-blocks',
        type: 'fill-extrusion',
        source: 'ap-tc2-schematic',
        filter: ['==', ['get', 'drawingMatch'], true],
        paint: {
          'fill-extrusion-color': hoverColor(['get', 'color']),
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.96,
        },
      });
      map.addLayer({
        id: 'schematic-blocks-review',
        type: 'fill-extrusion',
        source: 'ap-tc2-schematic',
        filter: ['!=', ['get', 'drawingMatch'], true],
        paint: {
          'fill-extrusion-color': hoverColor(['get', 'color']),
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.68,
        },
      });
      const threeLayer = new ThreeBuildingLayer();
      try {
        map.addLayer(threeLayer);
        threeLayerRef.current = threeLayer;
      } catch {
        setUseThreeBuildings(false);
        setMessage('Thiết bị không hỗ trợ lớp Three.js; đã chuyển sang khối 3D MapLibre cơ bản.');
      }
      let hovered: { source: string; id: string } | null = null;
      const clearHover = () => {
        if (hovered) map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
        hovered = null;
        threeLayerRef.current?.setHoveredId(null);
        map.getCanvas().style.cursor = '';
      };
      map.on('mousemove', event => {
        const feature = map
          .queryRenderedFeatures(event.point, {
            layers: [
              'schematic-blocks',
              'schematic-blocks-review',
              'schematic-outline',
              'building-status-roof',
              'building-3d',
              'building-outline',
              'building-status-outline',
            ],
          })
          .find(item => item.properties?.kind === 'building' && item.properties.hoverId);
        const next = feature ? { source: feature.source, id: String(feature.properties?.hoverId) } : null;
        if (hovered?.source === next?.source && hovered?.id === next?.id) return;
        clearHover();
        if (!next) return;
        hovered = next;
        map.setFeatureState({ source: next.source, id: next.id }, { hover: true });
        threeLayerRef.current?.setHoveredId(next.id);
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseout', clearHover);
      const showSchematicHouse = (event: maplibregl.MapLayerMouseEvent) => {
        const properties = event.features?.[0]?.properties;
        if (!properties) return;
        const details = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `Ô nhà ${String(properties.id).replace(/-\d+$/, '')}`;
        const source = document.createElement('p');
        source.textContent = properties.drawingMatch ? 'Ranh nhà từ nét DXF khép kín' : 'Ô nhà ước lượng từ nhãn địa chỉ';
        const height = document.createElement('p');
        height.textContent = `Chiều cao hiển thị: ${properties.height} đơn vị sơ đồ (minh họa)`;
        details.append(title, source, height);
        new maplibregl.Popup({ closeButton: true }).setLngLat(event.lngLat).setDOMContent(details).addTo(map);
      };
      map.on('click', 'schematic-blocks', showSchematicHouse);
      map.on('click', 'schematic-blocks-review', showSchematicHouse);
      map.on('click', 'schematic-outline', showSchematicHouse);
      const select = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.householdId || feature?.properties?.id;
        const household = householdsRef.current.find(h => h.id === String(id));
        if (household) selectRef.current(household);
        if (feature?.properties) {
          const p = feature.properties;
          const details = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = household ? `${household.houseNumber} ${household.street}` : p.address || 'Nhà chưa có địa chỉ';
          const info = document.createElement('p');
          info.textContent = household
            ? `Chủ hộ: ${household.ownerName} · ${household.residentsCount} nhân khẩu · Trạng thái: ${household.status}`
            : `${p.buildingType || 'Chưa phân loại'} · ${p.floors || '—'} tầng · cao ${p.height || '—'} m · ${p.estimated ? 'Footprint minh họa' : 'Footprint GeoJSON'}`;
          details.append(title, info);
          new maplibregl.Popup().setLngLat(event.lngLat).setDOMContent(details).addTo(map);
        }
      };
      map.on('click', 'household-points', select);
      map.on('click', 'building-outline', select);
      map.on('click', 'building-3d', select);
      map.on('click', 'building-status-roof', select);
      const showRoad = (event: maplibregl.MapLayerMouseEvent) => {
        const road = event.features?.[0]?.properties;
        if (!road) return;
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setText(
            `${road.name || 'Đường chưa đặt tên'} · ID: ${road.id || '—'} · rộng ${road.width || ROAD_STYLE[(road.roadType as RoadType) || 'secondary'].defaultWidth} m · ${ROAD_STYLE[(road.roadType as RoadType) || 'secondary'].label} · ${road.status || 'Chưa cập nhật trạng thái'}`,
          )
          .addTo(map);
      };
      map.on('click', 'roads', showRoad);
      map.on('click', 'road-3d', showRoad);
      map.on('click', 'area-fill', event => {
        const zone = event.features?.[0]?.properties;
        if (zone)
          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setText(`${zone.name || 'Khu vực'} · ID: ${zone.id || '—'}`)
            .addTo(map);
      });
      const labels = [
        ...apTc2Schematic.labels.filter(label => label.kind !== 'road'),
        ...apTc2DxfLinework.streetLabels.map((label, index) => ({ ...label, id: `dxf-street-${index}`, kind: 'road' })),
      ];
      labelMarkersRef.current = labels.map(label => {
        const element = document.createElement('span');
        element.className = `tc2-map-label tc2-map-label--${label.kind}`;
        element.textContent = label.text;
        element.setAttribute('aria-label', label.text);
        return new maplibregl.Marker({ element, anchor: 'center', pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
          .setLngLat([label.x / SCHEMATIC_SCALE, label.y / SCHEMATIC_SCALE])
          .addTo(map);
      });
      if (SCHEMATIC_BOUNDS) map.fitBounds(SCHEMATIC_BOUNDS, { padding: 45, pitch: 65, bearing: -20, duration: 0 });
      setReady(true);
    });
    return () => {
      labelMarkersRef.current.forEach(marker => marker.remove());
      labelMarkersRef.current = [];
      geoLabelMarkersRef.current.forEach(marker => marker.remove());
      geoLabelMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      threeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement === sectionRef.current;
      setFullscreen(active);
      if (active) setShowLayerPanel(false);
      requestAnimationFrame(() => mapRef.current?.resize());
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === sectionRef.current) await document.exitFullscreen();
      else await sectionRef.current?.requestFullscreen();
    } catch {
      setMessage('Trình duyệt không cho phép bật toàn màn hình.');
    }
  };

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (mapRef.current.getSource('households') as GeoJSONSource).setData(householdPoints);
  }, [ready, householdPoints]);

  useEffect(() => {
    const map = mapRef.current;
    editMarkersRef.current.forEach(marker => marker.remove());
    editMarkersRef.current = [];
    if (!ready || !map || !editingCoordinates || mapMode !== 'geographic') return;
    for (const household of households) {
      const [lat, lng] = pendingCoordinates[household.id] ?? household.coordinates ?? [];
      if (!validCoordinate([lng, lat]) || lat === 0 || lng === 0 || household.coordinatesEstimated) continue;
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'tc2-edit-pin';
      element.title = `Kéo để đổi tọa độ ${household.houseNumber} ${household.street}`;
      element.setAttribute('aria-label', element.title);
      element.textContent = household.houseNumber;
      const marker = new maplibregl.Marker({ element, draggable: true }).setLngLat([lng, lat]).addTo(map);
      marker.on('dragend', () => {
        const point = marker.getLngLat();
        setPendingCoordinates(current => ({ ...current, [household.id]: [point.lat, point.lng] }));
      });
      editMarkersRef.current.push(marker);
    }
    return () => {
      editMarkersRef.current.forEach(marker => marker.remove());
      editMarkersRef.current = [];
    };
  }, [ready, editingCoordinates, mapMode, households, pendingCoordinates]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (mapRef.current.getSource('area') as GeoJSONSource).setData(area);
  }, [ready, area]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (mapRef.current.getSource('geo-buildings') as GeoJSONSource).setData(geoBuildings);
    (mapRef.current.getSource('road-surfaces') as GeoJSONSource).setData(roadSurfaces);
    (mapRef.current.getSource('zones') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [...zones.features, ...area.features.filter(feature => feature.properties.kind === 'area')],
    });
  }, [ready, geoBuildings, roadSurfaces, zones, area]);

  useEffect(() => {
    const layer = threeLayerRef.current;
    if (!ready || !layer) return;
    layer.setBuildings(
      toThreeBuildings(
        mapMode === 'schematic' ? SCHEMATIC_FEATURES : geoBuildings,
        visualization,
        customColor,
        mapMode === 'schematic' ? 'all' : statusFilter,
      ),
    );
  }, [ready, mapMode, geoBuildings, visualization, customColor, statusFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const update = () => {
      geoLabelMarkersRef.current.forEach(marker => marker.remove());
      geoLabelMarkersRef.current = [];
      if (mapMode !== 'geographic') return;
      const occupied = new Set<string>();
      for (const household of map.getZoom() >= 16.5 ? households : []) {
        if (geoLabelMarkersRef.current.length >= 120) break;
        if (statusFilter !== 'all' && household.status !== statusFilter) continue;
        if (household.coordinatesEstimated) continue;
        const [lat, lng] = household.coordinates || [];
        if (!validCoordinate([lng, lat]) || lat === 0 || lng === 0) continue;
        const pixel = map.project([lng, lat]);
        if (pixel.x < 0 || pixel.y < 0 || pixel.x > map.getCanvas().clientWidth || pixel.y > map.getCanvas().clientHeight) continue;
        const cell = `${Math.floor(pixel.x / 95)}:${Math.floor(pixel.y / 58)}`;
        if (occupied.has(cell)) continue;
        occupied.add(cell);
        const parts = [
          layers.houseNumbers ? household.houseNumber : '',
          layers.houseIds && map.getZoom() >= 18 ? household.code : '',
          layers.owners && map.getZoom() >= 18 ? household.ownerName : '',
          layers.buildingTypes && map.getZoom() >= 18
            ? buildingTypes.find(
                type =>
                  type.code ===
                  geoBuildings.features.find(feature => feature.properties.householdId === household.id)?.properties.buildingType,
              )?.label || 'Chưa khảo sát tầng'
            : '',
        ].filter(Boolean);
        if (!parts.length) continue;
        const element = document.createElement('span');
        element.className = 'tc2-map-label tc2-map-label--house';
        element.textContent = parts.join(' · ');
        geoLabelMarkersRef.current.push(
          new maplibregl.Marker({ element, anchor: 'bottom', pitchAlignment: 'viewport' }).setLngLat([lng, lat]).addTo(map),
        );
      }
      const addMapLabel = (name: string, coordinate: Coordinate, className: string) => {
        if (geoLabelMarkersRef.current.length >= 145) return;
        const pixel = map.project(coordinate);
        if (pixel.x < 0 || pixel.y < 0 || pixel.x > map.getCanvas().clientWidth || pixel.y > map.getCanvas().clientHeight) return;
        const cell = `${Math.floor(pixel.x / 95)}:${Math.floor(pixel.y / 58)}`;
        if (occupied.has(cell)) return;
        occupied.add(cell);
        const element = document.createElement('span');
        element.className = `tc2-map-label ${className}`;
        element.textContent = name;
        geoLabelMarkersRef.current.push(
          new maplibregl.Marker({ element, anchor: 'center', pitchAlignment: 'viewport' }).setLngLat(coordinate).addTo(map),
        );
      };
      if (layers.streetNames) {
        for (const feature of area.features) {
          if (feature.properties.kind !== 'road' || !feature.properties.name) continue;
          const coordinates =
            feature.geometry.type === 'LineString'
              ? feature.geometry.coordinates
              : feature.geometry.type === 'MultiLineString'
                ? feature.geometry.coordinates[0]
                : [];
          if (coordinates.length)
            addMapLabel(feature.properties.name, coordinates[Math.floor(coordinates.length / 2)] as Coordinate, 'tc2-map-label--road');
        }
      }
      if (layers.areaNames) {
        for (const feature of [...zones.features, ...area.features]) {
          if (feature.properties.kind !== 'area' || !feature.properties.name) continue;
          const bounds = getBounds({ type: 'FeatureCollection', features: [feature] });
          if (bounds) addMapLabel(feature.properties.name, bounds.getCenter().toArray() as Coordinate, 'tc2-map-label--place');
        }
      }
    };
    map.on('moveend', update);
    update();
    return () => {
      map.off('moveend', update);
      geoLabelMarkersRef.current.forEach(marker => marker.remove());
      geoLabelMarkersRef.current = [];
    };
  }, [ready, mapMode, households, layers, area, zones, statusFilter, buildingTypes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const schematic = mapMode === 'schematic';
    map.easeTo({ pitch: is3D ? tilt : 0, duration: 500 });
    labelMarkersRef.current.forEach(marker => {
      marker.getElement().style.display = schematic ? '' : 'none';
    });
    map.setLayoutProperty('osm', 'visibility', !schematic && baseLayer === 'osm' ? 'visible' : 'none');
    map.setLayoutProperty('satellite', 'visibility', !schematic && baseLayer === 'satellite' ? 'visible' : 'none');
    map.setLayoutProperty(
      'roads',
      'visibility',
      !schematic && !is3D && (layers.main || layers.secondary || layers.alley) ? 'visible' : 'none',
    );
    map.setLayoutProperty(
      'road-3d',
      'visibility',
      !schematic && is3D && (layers.main || layers.secondary || layers.alley) ? 'visible' : 'none',
    );
    map.setLayoutProperty('household-points', 'visibility', !schematic && layers.householdInfo ? 'visible' : 'none');
    if (threeLayerRef.current) threeLayerRef.current.visible = is3D && layers.buildings && useThreeBuildings;
    map.triggerRepaint();
    // Keep MapLibre extrusions underneath the Three.js trim as a reliable 3D fallback.
    map.setLayoutProperty('building-3d', 'visibility', !schematic && is3D && layers.buildings ? 'visible' : 'none');
    map.setLayoutProperty('building-status-roof', 'visibility', !schematic && is3D && layers.buildings ? 'visible' : 'none');
    map.setLayoutProperty(
      'building-outline',
      'visibility',
      !schematic && layers.buildings && (!is3D || useThreeBuildings) ? 'visible' : 'none',
    );
    map.setPaintProperty('building-outline', 'fill-opacity', [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.85,
      is3D ? 0.01 : 0.3,
    ]);
    map.setLayoutProperty('building-status-outline', 'visibility', !schematic && !is3D && layers.buildings ? 'visible' : 'none');
    map.setLayoutProperty('area-fill', 'visibility', !schematic && layers.boundaries ? 'visible' : 'none');
    map.setLayoutProperty('area-outline', 'visibility', !schematic && layers.boundaries ? 'visible' : 'none');
    const roadFilter: any = [
      'in',
      ['get', 'roadType'],
      ['literal', [...(layers.main ? ['main'] : []), ...(layers.secondary ? ['secondary'] : []), ...(layers.alley ? ['alley'] : [])]],
    ];
    map.setFilter('roads', ['all', ['==', ['get', 'kind'], 'road'], roadFilter]);
    map.setFilter('road-3d', roadFilter);
    map.setLayoutProperty('schematic-blocks', 'visibility', schematic && is3D && layers.buildings ? 'visible' : 'none');
    map.setLayoutProperty('schematic-blocks-review', 'visibility', schematic && is3D && layers.buildings ? 'visible' : 'none');
    map.setLayoutProperty('schematic-outline', 'visibility', schematic && (!is3D || useThreeBuildings) ? 'visible' : 'none');
    map.setPaintProperty('schematic-outline', 'fill-opacity', [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,
      is3D ? 0.01 : 0.85,
    ]);
    map.setLayoutProperty('schematic-dxf-linework', 'visibility', schematic && showDxfLinework ? 'visible' : 'none');
  }, [ready, is3D, mapMode, baseLayer, showDxfLinework, tilt, layers, useThreeBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const color: any =
      visualization === 'height'
        ? ['step', ['coalesce', ['get', 'height'], 3.5], '#e9c46a', 5, '#65a9db', 8, '#68b884', 11, '#eea25c', 14, '#dc7770', 18, '#9c82bd']
        : visualization === 'population' || visualization === 'households'
          ? ['step', ['coalesce', ['get', 'residentsCount'], 0], '#dceee7', 1, '#a5d6be', 4, '#55a781', 8, '#287457']
          : visualization === 'risk'
            ? ['match', ['get', 'status'], 'alert', '#dc5b5b', 'warning', '#f1af5b', '#7dbda0']
            : visualization === 'custom'
              ? customColor
              : ['coalesce', ['get', 'color'], '#65a9db'];
    map.setPaintProperty('building-3d', 'fill-extrusion-color', hoverColor(color));
    map.setPaintProperty('building-outline', 'fill-color', hoverColor(color));
    const heatmap = mapMode === 'geographic' && (visualization === 'population' || visualization === 'households');
    map.setLayoutProperty('household-heatmap', 'visibility', heatmap ? 'visible' : 'none');
    map.setPaintProperty(
      'household-heatmap',
      'heatmap-weight',
      visualization === 'population' ? ['max', 1, ['coalesce', ['get', 'residentsCount'], 1]] : 1,
    );
  }, [ready, visualization, mapMode, customColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const filter: any =
      statusFilter === 'all'
        ? ['==', ['get', 'kind'], 'building']
        : ['all', ['==', ['get', 'kind'], 'building'], ['==', ['get', 'status'], statusFilter]];
    map.setFilter('building-3d', filter);
    map.setFilter('building-status-roof', filter);
    map.setFilter('building-outline', filter);
    map.setFilter('building-status-outline', filter);
    map.setFilter('household-points', statusFilter === 'all' ? null : ['==', ['get', 'status'], statusFilter]);
  }, [ready, statusFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (mapMode === 'schematic') {
      if (SCHEMATIC_BOUNDS) map.fitBounds(SCHEMATIC_BOUNDS, { padding: 45, maxZoom: 18, duration: 500 });
    } else {
      const bounds = getBounds(area);
      if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 500 });
      else {
        const first = householdPoints.features[0]?.geometry.coordinates;
        map.flyTo({ center: first ? [first[0], first[1]] : [106.612, 10.854], zoom: 16, duration: 500 });
      }
    }
  }, [ready, mapMode, area]);

  const cancelCoordinateEdit = () => {
    setPendingCoordinates({});
    setEditingCoordinates(false);
  };

  const saveCoordinates = async () => {
    const updates = Object.entries(pendingCoordinates).map(([id, coordinates]) => ({ id, coordinates }));
    if (!updates.length) {
      setEditingCoordinates(false);
      return;
    }
    if (!onUpdateCoordinates) {
      setMessage('Không có chức năng lưu tọa độ cho bản đồ này.');
      return;
    }
    setSavingCoordinates(true);
    try {
      await onUpdateCoordinates(updates);
      setMessage(`Đã gửi cập nhật tọa độ cho ${updates.length} nhà.`);
      cancelCoordinateEdit();
    } catch {
      setMessage('Không lưu được tọa độ. Các vị trí đã kéo vẫn chờ lưu.');
    } finally {
      setSavingCoordinates(false);
    }
  };

  const importGeoJson = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('Tệp vượt quá 5 MB; cần đơn giản hóa hình học hoặc chia theo khu vực.');
      const parsed = parseAreaGeoJson(JSON.parse(await file.text()));
      setArea(parsed);
      setMapMode('geographic');
      setMessage(
        `Đã nạp ${parsed.features.filter(f => f.properties.kind === 'building').length} ranh nhà, ${parsed.features.filter(f => f.properties.kind === 'road').length} tuyến đường và ${parsed.features.filter(f => f.properties.kind === 'area').length} khu vực. Hộ chưa có footprint được thể hiện bằng khối minh họa.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đọc GeoJSON.');
    }
  };

  const fitCurrentMap = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = mapMode === 'schematic' ? SCHEMATIC_BOUNDS : getBounds(area);
    if (bounds) map.fitBounds(bounds, { padding: 55, maxZoom: 18, duration: 500 });
    else {
      const first = householdPoints.features[0]?.geometry.coordinates;
      map.flyTo({ center: first ? [first[0], first[1]] : [106.612, 10.854], zoom: 16, duration: 500 });
    }
  };

  const searchHousehold = () => {
    const query = searchQuery.trim().toLocaleLowerCase('vi-VN');
    if (!query) return;
    const household = households.find(
      h =>
        [h.houseNumber, h.street, h.code, h.ownerName].some(value => value?.toLocaleLowerCase('vi-VN').includes(query)) &&
        !h.coordinatesEstimated,
    );
    if (!household) {
      setMessage('Không tìm thấy hộ dân có tọa độ phù hợp.');
      return;
    }
    const [lat, lng] = household.coordinates;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 19, pitch: is3D ? tilt : 0, duration: 650 });
    setMessage(`Đã chuyển tới ${household.houseNumber} ${household.street}. Click vào khối nhà để mở hồ sơ.`);
  };

  const locateUser = () => {
    if (!navigator.geolocation) {
      setMessage('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => mapRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 17, duration: 650 }),
      () => setMessage('Không thể lấy vị trí. Hãy kiểm tra quyền định vị của trình duyệt.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const captureMap = async () => {
    const map = mapRef.current;
    if (!map || !captureRef.current || capturing) return;
    setCapturing(true);
    setCaptureFeedback('');
    map.triggerRepaint();
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      const captured = await html2canvas(captureRef.current, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: 2,
        backgroundColor: '#f1f5f9',
        onclone(documentClone) {
          documentClone.querySelectorAll('.tc2-map-tools, .tc2-map-tilt, .tc2-map-help').forEach(element => {
            (element as HTMLElement).style.display = 'none';
          });
        },
      });
      const headerHeight = 90;
      const footerHeight = 44;
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = captured.width;
      finalCanvas.height = captured.height + headerHeight + footerHeight;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, finalCanvas.width, headerHeight);
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText('CÔNG AN ĐỊA BÀN PHỤ TRÁCH', 24, 32);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('BẢN ĐỒ GIÁM SÁT ĐỊA BÀN & AN NINH TRẬT TỰ KHU DÂN CƯ', 24, 67);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, headerHeight - 4, finalCanvas.width, 4);
      ctx.drawImage(captured, 0, headerHeight);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, finalCanvas.height - footerHeight, finalCanvas.width, footerHeight);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px sans-serif';
      const center = map.getCenter();
      const location = mapMode === 'schematic' ? 'Sơ đồ TC2 (chưa gắn GPS)' : `${center.lat.toFixed(5)}° B, ${center.lng.toFixed(5)}° Đ`;
      ctx.fillText(
        `Trích xuất: ${new Date().toLocaleString('vi-VN')} | ${location} | ${mapMode === 'schematic' ? SCHEMATIC_FEATURES.features.length : geoBuildings.features.length} khối nhà`,
        24,
        finalCanvas.height - 16,
      );
      setScreenshotUrl(finalCanvas.toDataURL('image/png'));
      setShareOpen(false);
    } catch (error) {
      console.error('Không thể chụp ảnh bản đồ MapLibre:', error);
      setMessage('Không chụp được bản đồ. Hãy kiểm tra lớp ảnh vệ tinh hoặc quyền truy cập ảnh bản đồ.');
    } finally {
      setCapturing(false);
    }
  };

  const downloadScreenshot = () => {
    if (!screenshotUrl) return;
    const link = document.createElement('a');
    link.href = screenshotUrl;
    link.download = `ban-do-dia-ban-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.click();
    setCaptureFeedback('Đã tải ảnh PNG.');
  };

  const copyScreenshot = async () => {
    if (!screenshotUrl) return;
    try {
      const blob = await (await fetch(screenshotUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCaptureFeedback('Đã sao chép ảnh vào bộ nhớ tạm.');
    } catch {
      setCaptureFeedback('Trình duyệt không cho phép sao chép ảnh. Hãy tải PNG.');
    }
  };

  const shareScreenshot = async () => {
    if (!screenshotUrl) return;
    try {
      const blob = await (await fetch(screenshotUrl)).blob();
      const file = new File([blob], 'ban-do-dia-ban.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Ảnh trích xuất bản đồ địa bàn', files: [file] });
        setCaptureFeedback('Đã chia sẻ ảnh.');
        return;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
    setShareOpen(value => !value);
  };

  const printScreenshot = () => {
    if (!screenshotUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setCaptureFeedback('Trình duyệt đã chặn cửa sổ in.');
      return;
    }
    const image = printWindow.document.createElement('img');
    image.src = screenshotUrl;
    image.style.maxWidth = '100%';
    image.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    printWindow.document.body.appendChild(image);
  };

  return (
    <section ref={sectionRef} className="tc2-map-section mx-auto max-w-7xl space-y-3 rounded-xl bg-white p-3 shadow-sm">
      <div className="tc2-map-header flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-bold text-slate-900">Bản đồ địa bàn MapLibre</h2>
        <button
          type="button"
          aria-pressed={mapMode === 'schematic'}
          onClick={() => {
            cancelCoordinateEdit();
            setMapMode('schematic');
          }}
          className={`rounded px-3 py-2 text-sm ${mapMode === 'schematic' ? 'bg-amber-700 text-white' : 'bg-slate-100'}`}
        >
          Sơ đồ TC2 · {apTc2DxfLinework.addressBlocks.length} địa chỉ
        </button>
        {mapMode === 'geographic' && (
          <>
            <button
              type="button"
              aria-pressed={editingCoordinates}
              onClick={() => (editingCoordinates ? cancelCoordinateEdit() : setEditingCoordinates(true))}
              className={`rounded px-3 py-2 text-sm ${editingCoordinates ? 'bg-amber-500 text-white' : 'bg-slate-100'}`}
            >
              {editingCoordinates ? `Đang đổi tọa độ (${Object.keys(pendingCoordinates).length})` : 'Đổi tọa độ nhà'}
            </button>
            {editingCoordinates && (
              <>
                <button
                  type="button"
                  disabled={savingCoordinates}
                  onClick={() => void saveCoordinates()}
                  className="rounded bg-blue-700 px-3 py-2 text-sm text-white"
                >
                  Hoàn thành
                </button>
                <button
                  type="button"
                  disabled={savingCoordinates}
                  onClick={cancelCoordinateEdit}
                  className="rounded bg-slate-200 px-3 py-2 text-sm"
                >
                  Hủy
                </button>
              </>
            )}
          </>
        )}
        <button
          type="button"
          aria-pressed={mapMode === 'geographic'}
          onClick={() => setMapMode('geographic')}
          className={`rounded px-3 py-2 text-sm ${mapMode === 'geographic' ? 'bg-amber-700 text-white' : 'bg-slate-100'}`}
        >
          Bản đồ tọa độ
        </button>
        {mapMode === 'schematic' && (
          <button
            type="button"
            aria-pressed={showDxfLinework}
            onClick={() => setShowDxfLinework(value => !value)}
            className={`rounded px-3 py-2 text-sm ${showDxfLinework ? 'bg-slate-700 text-white' : 'bg-slate-100'}`}
          >
            Nét DXF {showDxfLinework ? 'đang hiện' : 'đang ẩn'}
          </button>
        )}
        <button
          type="button"
          aria-pressed={!is3D}
          onClick={() => setIs3D(false)}
          className={`rounded px-3 py-2 text-sm ${!is3D ? 'bg-blue-700 text-white' : 'bg-slate-100'}`}
        >
          2D
        </button>
        <button
          type="button"
          aria-pressed={is3D}
          onClick={() => setIs3D(true)}
          className={`rounded px-3 py-2 text-sm ${is3D ? 'bg-blue-700 text-white' : 'bg-slate-100'}`}
        >
          3D
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} className="rounded bg-slate-800 px-3 py-2 text-sm text-white">
          {fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
        </button>
        {is3D && (
          <button
            type="button"
            aria-pressed={useThreeBuildings}
            onClick={() => setUseThreeBuildings(value => !value)}
            className={`rounded px-3 py-2 text-sm ${useThreeBuildings ? 'bg-indigo-700 text-white' : 'bg-slate-100'}`}
          >
            Khối nhà {useThreeBuildings ? 'Three.js' : 'cơ bản'}
          </button>
        )}
        <label className="cursor-pointer rounded bg-slate-800 px-3 py-2 text-sm text-white">
          Nạp GeoJSON địa bàn
          <input
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="sr-only"
            onChange={event => {
              void importGeoJson(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      <p role="status" className="tc2-map-status text-sm text-slate-600">
        {mapMode === 'schematic'
          ? `Sơ đồ 3D từ ${apTc2DxfLinework.addressBlocks.length} nhãn địa chỉ DXF (${apTc2DxfLinework.addressBlocks.filter(block => !block.estimated).length} có ranh nét khép kín; số còn lại là ô ước lượng). ${apTc2DxfLinework.paths.length} nét DXF. Sơ đồ chưa gắn GPS.`
          : message}
      </p>
      {mapMode === 'schematic' && (
        <div className="tc2-map-legend" aria-label="Chú giải màu khối nhà sơ đồ">
          <span>
            <i style={{ background: '#7ba6d6' }} /> Ô nhà ước lượng
          </span>
          <span>
            <i style={{ background: '#67b99a' }} /> Khối thấp
          </span>
          <span>
            <i style={{ background: '#e9a45e' }} /> Khối trung bình
          </span>
          <span>
            <i style={{ background: '#dc7770' }} /> Khối cao
          </span>
        </div>
      )}
      {editingCoordinates && (
        <p className="tc2-map-edit-note text-sm text-amber-800">
          Kéo ghim số nhà đến vị trí mới, rồi nhấn Hoàn thành để lưu hoặc Hủy để bỏ thay đổi.
        </p>
      )}
      {mapMode === 'geographic' && (
        <form
          className="tc2-map-search"
          onSubmit={event => {
            event.preventDefault();
            searchHousehold();
          }}
        >
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Tìm số nhà, đường, mã hộ hoặc chủ hộ"
            aria-label="Tìm hộ dân trên bản đồ"
          />
          <button type="submit">Tìm trên bản đồ</button>
        </form>
      )}
      {mapMode === 'geographic' && showLayerPanel && (
        <div className="tc2-map-panel">
          <div className="tc2-map-panel-header">
            <strong>LAYERS</strong>
            <label>
              Map Visualization{' '}
              <select value={visualization} onChange={event => setVisualization(event.target.value as typeof visualization)}>
                <option value="standard">Standard</option>
                <option value="height">Building Height</option>
                <option value="population">Population per Household</option>
                <option value="households">Household Density (preview)</option>
                <option value="risk">Risk Area (household status)</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              Lọc trạng thái{' '}
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="normal">Bình thường</option>
                <option value="warning">Cảnh báo</option>
                <option value="alert">Nguy cơ cao</option>
                <option value="business">Kinh doanh</option>
              </select>
            </label>
            {visualization === 'custom' && (
              <label>
                Màu khối nhà <input type="color" value={customColor} onChange={event => setCustomColor(event.target.value)} />
              </label>
            )}
          </div>
          <div className="tc2-map-layer-grid">
            {LAYER_OPTIONS.map(([key, label]) => {
              const unavailable = ['places', 'security', 'schools', 'markets', 'religious', 'facilities'].includes(key);
              return (
                <label key={key} title={unavailable ? 'Chưa có hình học hoặc phân loại vị trí trong dữ liệu hiện có' : undefined}>
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    disabled={unavailable}
                    onChange={event => setLayers(value => ({ ...value, [key]: event.target.checked }))}
                  />{' '}
                  {label}
                  {unavailable ? ' · chưa có dữ liệu' : ''}
                </label>
              );
            })}
          </div>
          <small>
            Zoom {zoom.toFixed(1)} · {geoBuildings.features.length} khối nhà; {households.filter(h => !h.coordinatesEstimated).length} hộ có
            tọa độ. Khối từ điểm hộ dân có footprint và chiều cao minh họa, không phải ranh/số tầng đã khảo sát.{' '}
            {roadSurfaces.features.length} đoạn đường có hình học nhập; {zones.features.length} khu vực có ranh giới.
          </small>
          <div className="tc2-map-legend">
            <strong>Màu thân nhà · loại công trình:</strong>
            {buildingTypes.map(type => (
              <span key={type.code}>
                <i style={{ background: type.color }} />
                {type.label} ({geoBuildings.features.filter(feature => feature.properties.buildingType === type.code).length})
              </span>
            ))}
            <span>
              <i style={{ background: UNKNOWN_BUILDING_COLOR }} />
              Chưa khảo sát tầng ({geoBuildings.features.filter(feature => !feature.properties.buildingType).length})
            </span>
          </div>
          <div className="tc2-map-legend">
            <strong>Màu mái nhà · trạng thái:</strong>
            {Object.entries(HOUSE_STATUS_STYLE).map(([status, style]) => (
              <span key={status}>
                <i style={{ background: style.color }} />
                {style.label} ({geoBuildings.features.filter(feature => feature.properties.status === status).length})
              </span>
            ))}
          </div>
          {geoBuildings.features.some(feature => !feature.properties.buildingType) && (
            <small>
              Nhà chưa có số tầng/loại công trình được tô thân màu xám; nhập thuộc tính buildingType hoặc floors trong GeoJSON để hiện đúng
              màu phân loại.
            </small>
          )}
        </div>
      )}
      <div className="tc2-map-shell" ref={captureRef}>
        <div ref={containerRef} className="h-[65vh] min-h-[430px] w-full rounded-lg bg-slate-100" aria-label="Bản đồ địa bàn 2D và 3D" />
        <div className="tc2-map-tools" aria-label="Điều khiển bản đồ">
          {mapMode === 'geographic' && (
            <label className="tc2-map-basemap">
              Lớp nền
              <select
                value={baseLayer}
                onChange={event => setBaseLayer(event.target.value as 'osm' | 'satellite')}
                aria-label="Lớp bản đồ nền"
              >
                <option value="osm">Đường phố</option>
                <option value="satellite">Ảnh vệ tinh</option>
              </select>
            </label>
          )}
          <button
            type="button"
            title={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            aria-label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            onClick={() => void toggleFullscreen()}
          >
            ⛶
          </button>
          <button type="button" title="Bật/tắt panel lớp" aria-label="Bật/tắt panel lớp" onClick={() => setShowLayerPanel(value => !value)}>
            ☷
          </button>
          <button
            type="button"
            title={mapMode === 'schematic' ? 'Định vị chỉ dùng trên bản đồ tọa độ' : 'Định vị của tôi'}
            aria-label="Định vị của tôi"
            disabled={mapMode === 'schematic'}
            onClick={locateUser}
          >
            ◎
          </button>
          <button type="button" title="Chụp ảnh bản đồ" aria-label="Chụp ảnh bản đồ" disabled={capturing} onClick={() => void captureMap()}>
            ▣
          </button>
          <button type="button" title="Hướng dẫn bản đồ" aria-label="Hướng dẫn bản đồ" onClick={() => setShowMapHelp(value => !value)}>
            ?
          </button>
          <button type="button" title="Phóng to" aria-label="Phóng to" onClick={() => mapRef.current?.zoomIn()}>
            +
          </button>
          <button type="button" title="Thu nhỏ" aria-label="Thu nhỏ" onClick={() => mapRef.current?.zoomOut()}>
            −
          </button>
          <button
            type="button"
            title="Xoay trái"
            aria-label="Xoay trái"
            onClick={() => mapRef.current?.rotateTo((mapRef.current?.getBearing() ?? 0) - 30, { duration: 300 })}
          >
            ↶
          </button>
          <button
            type="button"
            title="Xoay phải"
            aria-label="Xoay phải"
            onClick={() => mapRef.current?.rotateTo((mapRef.current?.getBearing() ?? 0) + 30, { duration: 300 })}
          >
            ↷
          </button>
          <button type="button" title="Hướng Bắc" aria-label="Hướng Bắc" onClick={() => mapRef.current?.rotateTo(0, { duration: 300 })}>
            N
          </button>
          <button type="button" title="Vừa màn hình" aria-label="Vừa màn hình" onClick={fitCurrentMap}>
            ⌗
          </button>
          <button
            type="button"
            title="Đặt lại camera"
            aria-label="Đặt lại camera"
            onClick={() => {
              mapRef.current?.easeTo({ bearing: 0, pitch: is3D ? 65 : 0, duration: 400 });
              setTilt(65);
              fitCurrentMap();
            }}
          >
            ⟲
          </button>
        </div>
        {is3D && (
          <label className="tc2-map-tilt">
            Góc nghiêng {tilt}°
            <input
              type="range"
              min="0"
              max="80"
              value={tilt}
              onChange={event => setTilt(Number(event.target.value))}
              aria-label="Góc nghiêng bản đồ 3D"
            />
          </label>
        )}
        {showMapHelp && (
          <div className="tc2-map-help" role="dialog" aria-label="Hướng dẫn bản đồ">
            <button type="button" aria-label="Đóng hướng dẫn" onClick={() => setShowMapHelp(false)}>
              ×
            </button>
            <strong>Điều khiển bản đồ</strong>
            <p>
              Kéo để di chuyển; cuộn/chụm để zoom. Dùng nút xoay và thanh góc nghiêng để xem 3D. Click khối nhà để mở hồ sơ; click đường
              hoặc ranh khu vực để xem thuộc tính.
            </p>
            <p>Khối mờ hoặc footprint từ tọa độ hộ dân chỉ là minh họa khi chưa có ranh đã khảo sát.</p>
          </div>
        )}
      </div>
      {screenshotUrl && (
        <div
          className="tc2-capture-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setScreenshotUrl(null);
          }}
        >
          <div className="tc2-capture-modal" role="dialog" aria-modal="true" aria-label="Ảnh chụp trích xuất bản đồ an ninh địa bàn">
            <header className="tc2-capture-header">
              <div>
                <h3>Ảnh chụp trích xuất bản đồ an ninh địa bàn</h3>
                <p>Bản đồ địa bàn kèm khung tiêu đề hành chính và thông số giám sát</p>
              </div>
              <button type="button" className="tc2-capture-share" onClick={() => void shareScreenshot()}>
                Chia sẻ
              </button>
              <button type="button" className="tc2-capture-close" aria-label="Đóng ảnh chụp" onClick={() => setScreenshotUrl(null)}>
                ×
              </button>
            </header>
            <div className="tc2-capture-preview">
              <img src={screenshotUrl} alt="Ảnh chụp bản đồ địa bàn" />
            </div>
            {shareOpen && (
              <div className="tc2-capture-share-menu">
                <button type="button" onClick={() => void copyScreenshot()}>
                  Sao chép ảnh để chia sẻ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(window.location.href)
                      .then(() => setCaptureFeedback('Đã sao chép liên kết bản đồ.'))
                      .catch(() => setCaptureFeedback('Không sao chép được liên kết.'));
                  }}
                >
                  Sao chép liên kết bản đồ
                </button>
                <button type="button" onClick={downloadScreenshot}>
                  Tải ảnh để gửi qua ứng dụng khác
                </button>
              </div>
            )}
            <footer className="tc2-capture-footer">
              <span role="status">{captureFeedback || 'Độ phân giải cao (2x) · Định dạng PNG · Có thông tin trích xuất'}</span>
              <div>
                <button type="button" className="tc2-capture-share" onClick={() => void shareScreenshot()}>
                  Chia sẻ
                </button>
                <button type="button" onClick={() => void copyScreenshot()}>
                  Sao chép ảnh
                </button>
                <button type="button" onClick={printScreenshot}>
                  In ảnh
                </button>
                <button type="button" className="tc2-capture-download" onClick={downloadScreenshot}>
                  Tải về (.PNG)
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
      <p className="tc2-map-footer text-xs text-slate-500">
        Cuộn hoặc chụm hai ngón để phóng to/thu nhỏ; kéo để di chuyển. Dùng nút xoay và thanh góc nghiêng để khám phá bản đồ 3D.
      </p>
      <p className="tc2-map-footer text-xs text-slate-500">
        {mapMode === 'schematic'
          ? 'Sơ đồ dùng tọa độ cục bộ từ Blender; các nét DXF chỉ là tham chiếu, chưa xác định tim đường/hẻm hoặc ranh từng nhà. Tách khỏi nền OSM và hồ sơ hộ dân.'
          : 'Dữ liệu nạp chỉ tồn tại khi màn này đang mở; không tải lên máy chủ. Tọa độ dùng WGS84 [kinh độ, vĩ độ].'}
      </p>
    </section>
  );
}
