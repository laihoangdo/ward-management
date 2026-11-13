import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Registers the MapLibre worker URL before any map instance is created.
import '../utils/maplibreWorkerUrl';
import { HouseholdFacility, HouseholdStatus } from '../types';
import { baDiemCommuneBoundary as boundary, baDiemCommuneBounds } from '../data/baDiemCommuneBoundary';
import { enrichForThree } from '../utils/threeAppearance';
import {
  FieldHouse,
  houseBounds,
  indexHouseholds,
  mergeSavedHouse,
  moveHouse,
  persistedHouse,
  validateDraft,
  validateBuildingProperties,
  MAX_BUILDING_FLOORS,
  MAX_BUILDING_HEIGHT,
} from '../utils/fieldHouseGeometry';
import { containsHousePoint } from '../utils/houseFootprints';
import { localRasterRequest } from '../utils/localRasterRequest';
import { prepareVectorBasemap, VECTOR_BASEMAP_STYLE_URL } from '../utils/vectorBasemap';
import './FieldHouseMap.css';
import { frameMapCapture, MapCaptureOfficer } from '../utils/mapCapture';
import { MapCapturePreview } from './MapCapturePreview';
import FieldHousePropertiesEditor from './FieldHousePropertiesEditor';
import { matchesHouseholdSearch } from '../utils/householdSearch';
import {
  BUILDING_THEMES,
  BuildingTheme,
  OCCUPANCY_SCALE,
  RECENCY_SCALE,
  RESIDENT_SCALE,
  recencyBucket,
  residentBucket,
  themeColor,
} from '../utils/buildingTheme';
import { areaSummary } from '../utils/areaSummary';
import { drawLabelImage, LABEL_IMAGE_PREFIX, LABEL_PIXEL_RATIO, labelText } from '../utils/mapLabelImage';

interface Props {
  captureOfficer?: MapCaptureOfficer;
  households: HouseholdFacility[];
  canAdd: boolean;
  canLink: boolean;
  onAdd: (coordinates: [number, number]) => void;
  onSelect: (household: HouseholdFacility) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Commune-level users open on the whole commune from above; others open on their assigned hamlets. */
  communeOverview?: boolean;
}
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const STATUS: Record<HouseholdStatus, string> = {
  normal: 'Bình thường',
  warning: 'Chú ý',
  alert: 'Cảnh báo',
  business: 'Kinh doanh',
  unverified: 'Chưa xác minh',
};
const COLORS = { normal: '#10b981', warning: '#f59e0b', alert: '#ef4444', business: '#38bdf8', unverified: '#94a3b8' };
const STATUS_PRIORITY: HouseholdStatus[] = ['alert', 'warning', 'business', 'normal'];
const highestStatus = (residents: HouseholdFacility[]): HouseholdStatus =>
  STATUS_PRIORITY.find(status => residents.some(r => r.status === status)) ?? 'unverified';
const QUICK_RESULT_LIMIT = 20;
/** Buildings lit up inside a drawn area, and household rows listed for it; the totals always cover the whole area. */
const MAX_AREA_HIGHLIGHTS = 400;
const MAX_AREA_ROWS = 30;
/** Buildings that do not match the status filter stay on the map as low grey blocks, so the street still reads. */
const DIM_COLOR = '#c3cad0';
const OWN_COLOR: maplibregl.ExpressionSpecification = ['coalesce', ['get', 'displayColor'], '#b6c9d6'];
const scaleExpression = (property: string, colors: string[]): maplibregl.ExpressionSpecification =>
  [
    'match',
    ['get', property],
    ...colors.flatMap((color, index) => [index, color]),
    OWN_COLOR,
  ] as unknown as maplibregl.ExpressionSpecification;
const THEME_EXPRESSION: Record<BuildingTheme, maplibregl.ExpressionSpecification> = {
  status: OWN_COLOR,
  occupancy: ['case', ['get', 'occupied'], OCCUPANCY_SCALE[0].color, OCCUPANCY_SCALE[1].color],
  residents: scaleExpression(
    'residentBucket',
    RESIDENT_SCALE.map(item => item.color),
  ),
  recency: scaleExpression(
    'checkedBucket',
    RECENCY_SCALE.map(item => item.color),
  ),
};
/** First matches only: the shared accent-insensitive lookup (owner, address, code, phone, residents, ID numbers). */
function searchHouseholds(list: HouseholdFacility[], query: string, limit: number): HouseholdFacility[] {
  const result: HouseholdFacility[] = [];
  for (const item of list) {
    if (!matchesHouseholdSearch(item, query)) continue;
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
/** Beyond this many changed buildings a full reload is cheaper than a diff. */
const MAX_DIFF_FEATURES = 500;
const MAX_LABEL_IMAGES = 2000;
const boundsOfPoints = (points: number[][]) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
};
const COMPACT_MAP_QUERY = '(max-width: 1024px), (max-height: 640px) and (pointer: coarse)';
type FieldEffects = ReturnType<typeof import('../three/field-effects.js').attachFieldEffects>;
function territoryPolygons(value: unknown): (GeoJSON.Polygon | GeoJSON.MultiPolygon)[] {
  if (!value || typeof value !== 'object') return [];
  const type = (value as { type?: string }).type;
  if (type === 'Feature') return territoryPolygons((value as GeoJSON.Feature).geometry);
  if (type === 'FeatureCollection') return (value as GeoJSON.FeatureCollection).features.flatMap(territoryPolygons);
  return type === 'Polygon' || type === 'MultiPolygon' ? [value as GeoJSON.Polygon | GeoJSON.MultiPolygon] : [];
}
const centerOf = (house: FieldHouse): [number, number] => {
  const [w, s, e, n] = houseBounds(house);
  return [(w + e) / 2, (s + n) / 2];
};
/** Enrich synthetic unedited footprints with natural undulating heights (1–5 floors) and architectural roofs for Three.js. */
const enrichHouseForThree = (house: FieldHouse): FieldHouse => enrichForThree(house, centerOf(house));
function insidePoint(house: FieldHouse): [number, number] {
  const center = centerOf(house);
  if (containsHousePoint(house.geometry, center)) return center;
  const [w, s, e, n] = houseBounds(house);
  for (let x = 1; x < 20; x++)
    for (let y = 1; y < 20; y++) {
      const p: [number, number] = [w + ((e - w) * x) / 20, s + ((n - s) * y) / 20];
      if (containsHousePoint(house.geometry, p)) return p;
    }
  const ring = house.geometry.type === 'Polygon' ? house.geometry.coordinates[0] : house.geometry.coordinates[0][0];
  for (let i = 1; i < ring.length - 1; i++) {
    const p: [number, number] = [(ring[0][0] + ring[i][0] + ring[i + 1][0]) / 3, (ring[0][1] + ring[i][1] + ring[i + 1][1]) / 3];
    if (containsHousePoint(house.geometry, p)) return p;
  }
  throw Error('Không xác định được điểm bên trong công trình.');
}

export default function FieldHouseMap({
  households,
  canAdd,
  canLink,
  onAdd,
  onSelect,
  isFullscreen,
  onToggleFullscreen,
  captureOfficer,
  communeOverview = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initializedMapRef = useRef<maplibregl.Map | null>(null);
  const framedMapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(() => !window.matchMedia?.(COMPACT_MAP_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia?.(COMPACT_MAP_QUERY);
    if (!mql?.addEventListener) return undefined;
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setLayersOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const [loading, setLoading] = useState(true);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [access, setAccess] = useState<{ global: boolean; territories: unknown[] }>({ global: false, territories: [] });
  const [hamletBoundaries, setHamletBoundaries] = useState<GeoJSON.FeatureCollection>(EMPTY);
  const territoryShapes = useMemo(() => access.territories.flatMap(territoryPolygons), [access.territories]);
  const realHamlets = useMemo(
    () => hamletBoundaries.features.filter(f => f.properties?.hamletId != null && f.properties?.name),
    [hamletBoundaries],
  );
  const [scopeHamletId, setScopeHamletId] = useState<string>('');
  const [quickSearch, setQuickSearch] = useState<string>('');
  const defaultHamletFeature = useMemo(() => {
    if (!realHamlets.length) return undefined;
    const areaHint = (captureOfficer?.area ?? '').toLocaleLowerCase();
    if (areaHint) {
      const matched = realHamlets.find(f => areaHint.includes(String(f.properties?.name ?? '').toLocaleLowerCase()));
      if (matched) return matched;
    }
    return (
      realHamlets.find(f =>
        String(f.properties?.name ?? '')
          .toLocaleLowerCase()
          .includes('trung chánh'),
      ) ??
      realHamlets.find(f => String(f.properties?.name ?? '').includes('62')) ??
      realHamlets[0]
    );
  }, [realHamlets, captureOfficer?.area]);
  const effectiveScopeHamletId = scopeHamletId || (defaultHamletFeature ? String(defaultHamletFeature.properties?.hamletId) : '');
  const activeTerritoryShapes = useMemo(() => {
    if (!access.global || territoryShapes.length > 0) return territoryShapes;
    if (!realHamlets.length || effectiveScopeHamletId === 'ALL') return [];
    const target = realHamlets.find(f => String(f.properties?.hamletId) === effectiveScopeHamletId) ?? defaultHamletFeature;
    return target ? territoryPolygons(target.geometry) : [];
  }, [access.global, territoryShapes, realHamlets, effectiveScopeHamletId, defaultHamletFeature]);
  const activeTerritoryWithBounds = useMemo(
    () =>
      activeTerritoryShapes.map(geometry => {
        const pts = geometry.coordinates.flat(geometry.type === 'Polygon' ? 1 : 2) as number[][];
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const [x, y] of pts) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        return { geometry, minX, minY, maxX, maxY };
      }),
    [activeTerritoryShapes],
  );
  const hasThreeScopeRestriction = !access.global || activeTerritoryWithBounds.length > 0;
  const [checkedAccess, setCheckedAccess] = useState({ id: '', allowed: false });
  const [houses, setHouses] = useState<FieldHouse[]>([]);
  const inThreeScopeIds = useMemo(() => {
    if (!hasThreeScopeRestriction) {
      return new Set(houses.filter(h => h.properties.canManage !== false).map(h => h.properties.buildingId));
    }
    if (!activeTerritoryWithBounds.length) return new Set<string>();
    const ids = new Set<string>();
    for (const h of houses) {
      if (h.properties.canManage === false) continue;
      const [lng, lat] = centerOf(h);
      const ring = h.geometry.type === 'Polygon' ? h.geometry.coordinates[0] : h.geometry.coordinates[0]?.[0];
      const sample: [number, number] =
        ring && ring.length >= 3 ? [(ring[0][0] + ring[1][0] + ring[2][0]) / 3, (ring[0][1] + ring[1][1] + ring[2][1]) / 3] : [lng, lat];
      if (
        activeTerritoryWithBounds.some(
          b =>
            (lng >= b.minX && lng <= b.maxX && lat >= b.minY && lat <= b.maxY && containsHousePoint(b.geometry, [lng, lat])) ||
            (sample[0] >= b.minX &&
              sample[0] <= b.maxX &&
              sample[1] >= b.minY &&
              sample[1] <= b.maxY &&
              containsHousePoint(b.geometry, sample)),
        )
      ) {
        ids.add(h.properties.buildingId);
      }
    }
    return ids;
  }, [houses, hasThreeScopeRestriction, activeTerritoryWithBounds]);
  const threeHouses = useMemo(
    () => houses.filter(h => inThreeScopeIds.has(h.properties.buildingId)).map(enrichHouseForThree),
    [houses, inThreeScopeIds],
  );
  const [threeEnabled, setThreeEnabled] = useState(true);
  const [threeActive, setThreeActive] = useState(false);
  const effectsRef = useRef<FieldEffects | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [vectorStreetIds, setVectorStreetIds] = useState<string[]>([]);
  const vectorStreetRequestRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoLinkError, setAutoLinkError] = useState(false);
  const [autoLinkRetry, setAutoLinkRetry] = useState(0);
  const autoLinkRunningRef = useRef(false);
  const autoLinkAttemptsRef = useRef(new Set<string>());
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<'select' | 'draw' | 'move' | 'area'>('select');
  const [draft, setDraft] = useState<number[][]>([]);
  const [height, setHeight] = useState(7);
  const [floors, setFloors] = useState(2);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#b6c9d6');
  const [moveLat, setMoveLat] = useState('');
  const [moveLng, setMoveLng] = useState('');
  const [search, setSearch] = useState('');
  const [linkId, setLinkId] = useState('');
  // Household whose removal from the selected building awaits a second click (inline confirmation).
  const [unlinkId, setUnlinkId] = useState('');
  useEffect(() => setUnlinkId(''), [selectedId]);
  const [status, setStatus] = useState<'all' | HouseholdStatus>('all');
  const [representation, setRepresentation] = useState<'3d' | 'point'>('3d');
  const [theme, setTheme] = useState<BuildingTheme>('status');
  const [themeNow] = useState(() => Date.now());
  const [layers, setLayers] = useState({
    satellite: true,
    map: false,
    darkStreets: false,
    buildings: true,
    empty: true,
    occupied: true,
    households: true,
    temporaryHouseholds: true,
    boundary: true,
    hamlets: true,
  });
  const explicitlyLinked = useMemo(() => new Set(houses.flatMap(h => h.properties.householdIds ?? [])), [houses]);
  const temporaryHouseholds = useMemo(
    () =>
      households.filter(h => {
        if (h.coordinateMethod !== 'RANDOM_WITHIN_TC2' || explicitlyLinked.has(h.id)) return false;
        const [lat, lng] = h.coordinates ?? [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || lat === 0 || lng === 0)
          return false;
        return access.global || territoryShapes.some(geometry => containsHousePoint(geometry, [lng, lat]));
      }),
    [households, explicitlyLinked, access.global, territoryShapes],
  );
  const householdsOnMap = useMemo(
    () =>
      access.global
        ? households
        : households.filter(
            h =>
              explicitlyLinked.has(h.id) ||
              (!h.coordinatesEstimated &&
                h.coordinateMethod !== 'RANDOM_WITHIN_TC2' &&
                h.coordinates?.every(Number.isFinite) &&
                territoryShapes.some(geometry => containsHousePoint(geometry, [h.coordinates[1], h.coordinates[0]]))),
          ),
    [access.global, households, explicitlyLinked, territoryShapes],
  );
  const indexed = useMemo(() => indexHouseholds(houses, householdsOnMap), [houses, householdsOnMap]);
  const houseById = useMemo(() => new Map(houses.map(h => [h.properties.buildingId, h])), [houses]);
  const buildingByHouseholdId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [bId, list] of indexed.entries()) {
      for (const h of list) map.set(h.id, bId);
    }
    return map;
  }, [indexed]);
  // Deferred so typing stays responsive while thousands of households are matched.
  const deferredQuickSearch = useDeferredValue(quickSearch);
  const quickMatches = useMemo(
    () => (deferredQuickSearch.trim() ? searchHouseholds(householdsOnMap, deferredQuickSearch, QUICK_RESULT_LIMIT) : []),
    [householdsOnMap, deferredQuickSearch],
  );
  const [quickActive, setQuickActive] = useState(0);
  useEffect(() => setQuickActive(0), [quickMatches]);
  const selected = houseById.get(selectedId);
  const linked = indexed.get(selectedId) ?? [];
  const savedLinked = linked.filter(h => selected?.properties.householdIds?.includes(h.id));
  const pendingLinked = linked.filter(h => !selected?.properties.householdIds?.includes(h.id));
  const canManageSelected =
    access.global || (selected?.properties.canManage !== false && checkedAccess.id === selectedId && checkedAccess.allowed);
  const mayWriteTerritory = access.global || access.territories.length > 0;
  const deferredSearch = useDeferredValue(search);
  const candidates = useMemo(
    () =>
      searchHouseholds(
        households.filter(h => !linked.some(l => l.id === h.id) && !explicitlyLinked.has(h.id)),
        deferredSearch,
        50,
      ),
    [households, linked, deferredSearch, explicitlyLinked],
  );
  const liveRef = useRef({ mode, canLink, houseById, households, onSelect, busy, indexed, selectedId });
  liveRef.current = { mode, canLink, houseById, households, onSelect, busy, indexed, selectedId };
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoveredIdRef = useRef('');
  const highlightId = (buildingId: string) => {
    const target = liveRef.current.houseById.get(buildingId);
    return target ? String(target.id ?? target.properties.buildingId) : '';
  };
  /** Selection and hover reach the Three.js layer as two texels, not as a 79k-entry state list. */
  const areaIdsRef = useRef<string[]>([]);
  const pushHighlights = () => {
    const selectedKey = highlightId(liveRef.current.selectedId);
    const hoveredKey = highlightId(hoveredIdRef.current);
    effectsRef.current?.setHighlights?.([
      ...areaIdsRef.current.map(highlightId).flatMap(id => (id && id !== selectedKey && id !== hoveredKey ? [{ id, level: 0.5 }] : [])),
      ...(hoveredKey && hoveredKey !== selectedKey ? [{ id: hoveredKey, level: 0.5 }] : []),
      ...(selectedKey ? [{ id: selectedKey, level: 1 }] : []),
    ]);
  };
  const pushHighlightsRef = useRef(pushHighlights);
  pushHighlightsRef.current = pushHighlights;
  // The search result under the pointer or the arrow keys lights up its building, so the list and the map read as one.
  const quickActiveBuildingId = (quickMatches[quickActive] && buildingByHouseholdId.get(quickMatches[quickActive].id)) || '';
  useEffect(() => {
    if (hoveredIdRef.current === quickActiveBuildingId) return;
    hoveredIdRef.current = quickActiveBuildingId;
    pushHighlightsRef.current();
  }, [quickActiveBuildingId]);
  // Area statistics: the polygon being drawn in 'area' mode is summarised as soon as it has three vertices.
  const area = useMemo(() => {
    if (mode !== 'area' || draft.length < 3) return null;
    const loose = [...householdsOnMap.filter(h => !buildingByHouseholdId.has(h.id)), ...temporaryHouseholds];
    return areaSummary(draft, houses, indexed, loose);
  }, [mode, draft, houses, indexed, householdsOnMap, buildingByHouseholdId, temporaryHouseholds]);
  useEffect(() => {
    areaIdsRef.current = area ? area.buildingIds.slice(0, MAX_AREA_HIGHLIGHTS) : [];
    pushHighlightsRef.current();
  }, [area]);
  useEffect(() => {
    if (mode !== 'area') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMode('select');
      setDraft([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);
  const featureCacheRef = useRef(new Map<string, { house: FieldHouse; key: string }>());
  const housesLoadedMapRef = useRef<maplibregl.Map | null>(null);
  const pointsLoadedMapRef = useRef<maplibregl.Map | null>(null);
  const labelImageCountRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [base, saved, territory, hamlets] = await Promise.all([
          axios.get<GeoJSON.FeatureCollection<FieldHouse['geometry'], FieldHouse['properties']>>('/content/data/badiem-houses.geojson', {
            signal: controller.signal,
          }),
          axios.get<GeoJSON.FeatureCollection<FieldHouse['geometry'], FieldHouse['properties']>>('/api/gis/field-buildings', {
            signal: controller.signal,
          }),
          axios.get<{ global: boolean; territories: unknown[] }>('/api/gis/field-buildings/access', { signal: controller.signal }),
          axios.get<GeoJSON.FeatureCollection>('/api/gis/field-buildings/boundaries', { signal: controller.signal }),
        ]);
        const merged = new Map(base.data.features.map(h => [h.properties.buildingId, h]));
        saved.data.features.forEach(h => merged.set(h.properties.buildingId, mergeSavedHouse(merged.get(h.properties.buildingId), h)));
        setHouses([...merged.values()]);
        setAccess(territory.data);
        setHamletBoundaries(hamlets.data);
        setLoading(false);
      } catch {
        if (!controller.signal.aborted) {
          setError('Không tải được dữ liệu công trình đã lưu. Kiểm tra kết nối và quyền xem bản đồ, sau đó tải lại trang.');
          setLoading(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selected || access.global) return;
    const controller = new AbortController();
    void axios
      .post<{ allowed: boolean }>('/api/gis/field-buildings/access/check', selected.geometry, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setCheckedAccess({ id: selectedId, allowed: data.allowed });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCheckedAccess({ id: selectedId, allowed: false });
      });
    return () => controller.abort();
  }, [selected, selectedId, access.global]);

  useEffect(() => {
    if (loading || !canLink || !mayWriteTerritory || busy || autoLinkRunningRef.current) return;
    const candidatesToSave: FieldHouse[] = [];
    let hasPendingMatches = false;
    for (const [id, matches] of indexed) {
      const pending = matches
        .filter(h => !explicitlyLinked.has(h.id))
        .map(h => h.id)
        .sort();
      if (!pending.length) continue;
      hasPendingMatches = true;
      const key = `${id}:${pending.join(',')}`;
      if (autoLinkAttemptsRef.current.has(key)) continue;
      autoLinkAttemptsRef.current.add(key);
      const house = houseById.get(id)!;
      if (house.properties.canManage === false) continue;
      candidatesToSave.push({ ...house, properties: { ...house.properties, householdIds: pending } });
    }
    if (!candidatesToSave.length) {
      if (!hasPendingMatches) setAutoLinkError(false);
      return;
    }
    autoLinkRunningRef.current = true;
    setBusy(true);
    setAutoLinkError(false);
    const sync = async () => {
      try {
        for (let offset = 0; offset < candidatesToSave.length; offset += 50) {
          const { data } = await axios.post<GeoJSON.FeatureCollection<FieldHouse['geometry'], FieldHouse['properties']>>(
            '/api/gis/field-buildings/auto-link',
            candidatesToSave.slice(offset, offset + 50).map(persistedHouse),
          );
          const confirmed = new Map(data.features.map(h => [h.properties.buildingId, h]));
          setHouses(previous =>
            previous.map(h => {
              const saved = confirmed.get(h.properties.buildingId);
              return saved ? mergeSavedHouse(h, saved) : h;
            }),
          );
        }
      } catch {
        setAutoLinkError(true);
      } finally {
        autoLinkRunningRef.current = false;
        setBusy(false);
      }
    };
    void sync();
  }, [loading, canLink, mayWriteTerritory, busy, indexed, explicitlyLinked, houseById, autoLinkRetry]);

  useEffect(() => {
    setReady(false);
    initializedMapRef.current = null;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const map = new maplibregl.Map({
      container: containerRef.current!,
      center: [106.56, 10.84],
      zoom: 16,
      pitch: 55,
      minPitch: 0,
      maxPitch: 75,
      maxZoom: 21,
      bearingSnap: 0,
      dragRotate: true,
      pitchWithRotate: true,
      dragPan: { linearity: 0.25, deceleration: 2200, maxSpeed: 1200 },
      scrollZoom: true,
      touchZoomRotate: true,
      touchPitch: true,
      // Cap render resolution on touch devices with high-DPI screens: building
      // geometry stays intact, while the GPU renders fewer pixels per gesture.
      ...(coarsePointer ? { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5) } : {}),
      clickTolerance: coarsePointer ? 8 : 5,
      transformRequest: localRasterRequest,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      style: {
        version: 8,
        sources: {
          // Surrounding imagery stops at z15; capping the source lets MapLibre enlarge it where no z16-18 tile exists.
          'satellite-context': {
            type: 'raster',
            tiles: [`${location.origin}/content/assets/badiem_satellite/{z}/{x}/{y}.jpg`],
            tileSize: 256,
            minzoom: 5,
            maxzoom: 15,
            bounds: [106.4, 10.72, 106.75, 10.98],
            attribution: 'Ảnh vệ tinh hiện có của dự án',
          },
          satellite: {
            type: 'raster',
            tiles: [`${location.origin}/content/assets/badiem_satellite/{z}/{x}/{y}.jpg`],
            tileSize: 256,
            minzoom: 16,
            maxzoom: 18,
            bounds: [106.5, 10.79, 106.63, 10.91],
            attribution: 'Ảnh vệ tinh hiện có của dự án',
          },
          streets: {
            type: 'raster',
            tiles: [`${location.origin}/content/assets/badiem_map/{z}/{x}/{y}.png`],
            tileSize: 256,
            minzoom: 1,
            maxzoom: 18,
            bounds: [106.5, 10.79, 106.63, 10.91],
            attribution: 'Bản đồ nền hiện có của dự án',
          },
        },
        layers: [
          // Earth tone: the area beyond the imagery should recede, not read as a hole in the map.
          { id: 'ground', type: 'background', paint: { 'background-color': '#3a4036' } },
          { id: 'satellite-context', type: 'raster', source: 'satellite-context', paint: { 'raster-fade-duration': 0 } },
          { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-fade-duration': 0 } },
          { id: 'streets', type: 'raster', source: 'streets', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
        ],
      },
    });
    mapRef.current = map;
    // MapLibre interpolates wheel input and applies inertia without React updates per frame.
    map.scrollZoom.setWheelZoomRate(1 / 650);
    map.scrollZoom.setZoomRate(1 / 120);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: false }));
    map.on('load', () => {
      if (mapRef.current !== map) return;
      // promoteId lets a saved building be patched in place instead of reloading all features.
      map.addSource('houses', { type: 'geojson', data: EMPTY, maxzoom: 20, promoteId: 'buildingId' });
      map.addLayer({
        id: 'houses-3d-outside',
        type: 'fill-extrusion',
        source: 'houses',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-color': ['coalesce', ['get', 'displayColor'], '#b6c9d6'],
          'fill-extrusion-opacity': 0.84,
        },
      });
      map.addLayer({
        id: 'houses-3d',
        type: 'fill-extrusion',
        source: 'houses',
        paint: {
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-color': ['case', ['==', ['get', 'buildingId'], ''], '#fbbf24', ['coalesce', ['get', 'displayColor'], '#b6c9d6']],
          'fill-extrusion-opacity': 0.88,
        },
      });
      map.addSource('house-points', { type: 'geojson', data: EMPTY, promoteId: 'buildingId' });
      map.addLayer({
        id: 'house-points',
        type: 'circle',
        source: 'house-points',
        paint: {
          'circle-radius': 5,
          'circle-color': ['coalesce', ['get', 'displayColor'], '#b6c9d6'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });
      const statusCount = (value: HouseholdStatus): maplibregl.ExpressionSpecification => [
        '+',
        ['case', ['==', ['get', 'status'], value], 1, 0],
      ];
      // Far out, unlinked household points merge into one circle per neighbourhood; each cluster keeps a count per status.
      map.addSource('households', {
        type: 'geojson',
        data: EMPTY,
        cluster: true,
        clusterMaxZoom: 15,
        clusterRadius: 44,
        clusterProperties: {
          alert: statusCount('alert'),
          warning: statusCount('warning'),
          business: statusCount('business'),
          normal: statusCount('normal'),
          unverified: statusCount('unverified'),
        },
      });
      map.addLayer({
        id: 'household-clusters',
        type: 'circle',
        source: 'households',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 9, 20, 13, 100, 17, 500, 22],
          'circle-color': [
            'case',
            ['>', ['get', 'alert'], 0],
            COLORS.alert,
            ['>', ['get', 'warning'], 0],
            COLORS.warning,
            ['>', ['get', 'business'], 0],
            COLORS.business,
            ['>', ['get', 'normal'], 0],
            COLORS.normal,
            COLORS.unverified,
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
      map.addLayer({
        id: 'households',
        type: 'circle',
        source: 'households',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 5,
          'circle-color': [
            'match',
            ['get', 'status'],
            'alert',
            COLORS.alert,
            'warning',
            COLORS.warning,
            'business',
            COLORS.business,
            'normal',
            COLORS.normal,
            COLORS.unverified,
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });
      map.addSource('temporary-households', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'temporary-households',
        type: 'circle',
        source: 'temporary-households',
        paint: {
          'circle-radius': 5,
          'circle-color': '#f97316',
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });
      map.addSource('boundary', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: boundary.features.filter(f => f.properties.kind === 'commune_boundary'),
        } as GeoJSON.FeatureCollection,
      });
      map.addLayer({ id: 'boundary', type: 'line', source: 'boundary', paint: { 'line-color': '#f43f5e', 'line-width': 3 } });
      map.addSource('hamlets', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'hamlet-boundaries',
        type: 'line',
        source: 'hamlets',
        paint: { 'line-color': '#fbbf24', 'line-width': 1.5, 'line-dasharray': [3, 2] },
      });
      map.addSource('assigned-territories', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'assigned-territories',
        type: 'fill',
        source: 'assigned-territories',
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'assigned-boundaries',
        type: 'line',
        source: 'assigned-territories',
        paint: { 'line-color': '#10b981', 'line-width': 2 },
      });
      // House numbers: images drawn on demand, so no glyph server is needed offline.
      map.addSource('house-labels', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'house-labels',
        type: 'symbol',
        source: 'house-labels',
        minzoom: 17,
        layout: {
          'icon-image': ['concat', LABEL_IMAGE_PREFIX, ['get', 'label']],
          'icon-anchor': 'bottom',
          'icon-offset': [0, -4],
          'icon-padding': 4,
          'symbol-sort-key': ['get', 'rank'],
        },
      });
      map.addSource('draft', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'draft-fill',
        type: 'fill',
        source: 'draft',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.35 },
      });
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft',
        filter: ['!=', ['geometry-type'], 'Point'],
        paint: { 'line-color': '#fbbf24', 'line-width': 3 },
      });
      map.addLayer({
        id: 'draft-vertices',
        type: 'circle',
        source: 'draft',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-color': '#fbbf24', 'circle-stroke-width': 2 },
      });
      initializedMapRef.current = map;
      setReady(true);
    });
    map.on('click', event => {
      const live = liveRef.current;
      if (live.busy) return;
      if ((live.mode === 'draw' && live.canLink) || live.mode === 'area') {
        setDraft(prev => [...prev, [event.lngLat.lng, event.lngLat.lat]]);
        return;
      }
      if (live.mode === 'move' && live.canLink) {
        setMoveLat(event.lngLat.lat.toFixed(7));
        setMoveLng(event.lngLat.lng.toFixed(7));
        return;
      }
      if (!map.getLayer('houses-3d')) return;
      const hits = map.queryRenderedFeatures(event.point, {
        layers: ['temporary-households', 'households', 'household-clusters', 'house-points', 'houses-3d'],
      });
      const h = hits.find(f => f.layer.id === 'temporary-households') ?? hits.find(f => f.layer.id === 'households');
      if (!h && hits.some(f => f.layer.id === 'household-clusters')) {
        map.easeTo({ center: event.lngLat, zoom: Math.min(map.getZoom() + 2, 18), duration: 500 });
        return;
      }
      if (h) {
        const record = live.households.find(item => item.id === h.properties.id);
        if (record) live.onSelect(record);
        return;
      }
      const id = hits.find(f => f.properties.buildingId)?.properties.buildingId;
      if (id && live.houseById.has(id)) {
        if ((containerRef.current?.clientWidth ?? 1000) <= 1024 || window.matchMedia?.(COMPACT_MAP_QUERY).matches) setLayersOpen(false);
        setSelectedId(id);
        setSearch('');
        setLinkId('');
        setNotice('');
        setError('');
      }
    });
    // MapLibre 6 resolves missing images through this callback; the styleimagemissing event fires too late to supply them.
    map.setMissingStyleImageResolver?.((id: string) => {
      if (typeof id !== 'string' || !id.startsWith(LABEL_IMAGE_PREFIX) || labelImageCountRef.current >= MAX_LABEL_IMAGES) return;
      const image = drawLabelImage(id.slice(LABEL_IMAGE_PREFIX.length));
      if (!image || map.hasImage(id)) return;
      map.addImage(id, image, { pixelRatio: LABEL_PIXEL_RATIO });
      labelImageCountRef.current += 1;
    });
    // Hover: one query per animation frame, written straight to the DOM and the GPU (no React render).
    let hoverFrame = 0;
    let hoverEvent: maplibregl.MapMouseEvent | null = null;
    const hideHover = () => {
      if (tooltipRef.current) tooltipRef.current.hidden = true;
      if (hoveredIdRef.current) {
        hoveredIdRef.current = '';
        pushHighlightsRef.current();
      }
    };
    const runHover = () => {
      hoverFrame = 0;
      const event = hoverEvent;
      const live = liveRef.current;
      if (!event || mapRef.current !== map || live.mode !== 'select' || map.isMoving() || !map.getLayer('houses-3d')) {
        hideHover();
        return;
      }
      const hit = map.queryRenderedFeatures(event.point, { layers: ['house-points', 'houses-3d'] })[0];
      const id = String(hit?.properties?.buildingId ?? '');
      const target = id ? live.houseById.get(id) : undefined;
      map.getCanvas().style.cursor = target ? 'pointer' : '';
      const tip = tooltipRef.current;
      if (!target || !tip) {
        hideHover();
        return;
      }
      const residents = live.indexed.get(id) ?? [];
      const first = residents[0];
      tip.textContent = [
        target.properties.name || (first ? `${first.houseNumber} ${first.street}`.trim() : 'Công trình'),
        residents.length ? `${residents.length} hộ · ${first.ownerName}${residents.length > 1 ? '…' : ''}` : 'Chưa có hộ dân',
      ].join(' — ');
      tip.style.transform = `translate(${Math.round(event.point.x + 14)}px, ${Math.round(event.point.y + 14)}px)`;
      tip.hidden = false;
      if (hoveredIdRef.current !== id) {
        hoveredIdRef.current = id;
        pushHighlightsRef.current();
      }
    };
    map.on('mousemove', (event: maplibregl.MapMouseEvent) => {
      hoverEvent = event;
      if (!hoverFrame) hoverFrame = requestAnimationFrame(runHover);
    });
    map.on('mouseout', () => {
      hoverEvent = null;
      hideHover();
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current!);
    return () => {
      observer.disconnect();
      if (hoverFrame) cancelAnimationFrame(hoverFrame);
      effectsRef.current?.dispose();
      effectsRef.current = null;
      initializedMapRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // The offline street tiles cover only part of the map; online streets fill the rest, requested only when the layer is on.
  useEffect(() => {
    const map = mapRef.current;
    if (!(layers.map || layers.darkStreets) || !ready || !map || initializedMapRef.current !== map) return;
    if (vectorStreetIds.length || vectorStreetRequestRef.current) return;
    const request = new AbortController();
    vectorStreetRequestRef.current = request;
    void (async () => {
      try {
        const response = await fetch(VECTOR_BASEMAP_STYLE_URL, { signal: request.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const basemap = prepareVectorBasemap((await response.json()) as maplibregl.StyleSpecification);
        if (mapRef.current !== map) return;
        map.setGlyphs(basemap.glyphs);
        if (typeof basemap.sprite === 'string') map.setSprite(basemap.sprite);
        Object.entries(basemap.sources).forEach(([id, source]) => map.addSource(id, source));
        basemap.layers.forEach(layer => map.addLayer(layer, 'streets'));
        setVectorStreetIds(basemap.layers.map(layer => layer.id));
      } catch {
        if (!request.signal.aborted) setNotice('Không tải được nền đường phố trực tuyến; phần ngoài khu vực có sẵn tạm để trống.');
      } finally {
        vectorStreetRequestRef.current = null;
      }
    })();
  }, [ready, layers.map, layers.darkStreets, vectorStreetIds.length]);
  useEffect(() => () => vectorStreetRequestRef.current?.abort(), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    map.getCanvas().style.cursor = mode === 'select' ? '' : 'crosshair';
    map.doubleClickZoom[mode === 'draw' || mode === 'area' ? 'disable' : 'enable']();
  }, [mode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const decorate = (h: FieldHouse) => {
      const residents = indexed.get(h.properties.buildingId) ?? [];
      return {
        ...h,
        properties: {
          ...h.properties,
          inThreeScope: inThreeScopeIds.has(h.properties.buildingId),
          occupied: residents.length > 0,
          normal: residents.some(r => r.status === 'normal'),
          unverified: residents.some(r => r.status === 'unverified'),
          warning: residents.some(r => r.status === 'warning'),
          alert: residents.some(r => r.status === 'alert'),
          business: residents.some(r => r.status === 'business'),
          residentBucket: residentBucket(residents),
          checkedBucket: recencyBucket(residents, themeNow),
          displayColor: residents.length ? COLORS[highestStatus(residents)] : (h.properties.color ?? '#b6c9d6'),
        },
      };
    };
    const asPoint = (h: ReturnType<typeof decorate>) => ({ ...h, geometry: { type: 'Point' as const, coordinates: centerOf(h) } });
    // Find which buildings actually changed since the last run (a save touches one or two of 79k).
    const previous = featureCacheRef.current;
    const next = new Map<string, { house: FieldHouse; key: string }>();
    const changed: FieldHouse[] = [];
    for (const h of houses) {
      const id = h.properties.buildingId;
      const residents = indexed.get(id);
      const buckets = `${residentBucket(residents ?? [])}|${recencyBucket(residents ?? [], themeNow)}`;
      const key = `${inThreeScopeIds.has(id) ? 1 : 0}|${residents ? residents.map(r => r.status).join(',') : ''}|${buckets}`;
      const cached = previous.get(id);
      if (!cached || cached.house !== h || cached.key !== key) changed.push(h);
      next.set(id, { house: h, key });
    }
    featureCacheRef.current = next;
    const houseSource = map.getSource('houses') as maplibregl.GeoJSONSource | undefined;
    const pointSource = map.getSource('house-points') as maplibregl.GeoJSONSource | undefined;
    // The 79k-point copy is only needed by the Point view; it is built the first time that view is chosen.
    const wantPoints = representation === 'point';
    const pointsLoaded = pointsLoadedMapRef.current === map;
    const canDiff =
      housesLoadedMapRef.current === map &&
      next.size === houses.length &&
      previous.size <= next.size &&
      changed.length <= MAX_DIFF_FEATURES &&
      typeof houseSource?.updateData === 'function' &&
      (!pointsLoaded || typeof pointSource?.updateData === 'function');
    const loadAllPoints = () => {
      pointSource?.setData({ type: 'FeatureCollection', features: houses.map(h => asPoint(decorate(h))) });
      pointsLoadedMapRef.current = houses.length ? map : null;
    };
    if (canDiff) {
      if (changed.length) {
        // Adding a feature whose id already exists replaces it.
        const features = changed.map(decorate);
        houseSource.updateData({ add: features });
        if (pointsLoaded) pointSource?.updateData({ add: features.map(asPoint) });
      }
      if (wantPoints && !pointsLoaded) loadAllPoints();
      return;
    }
    houseSource?.setData({ type: 'FeatureCollection', features: houses.map(decorate) });
    housesLoadedMapRef.current = houses.length ? map : null;
    if (wantPoints || pointsLoaded) loadAllPoints();
  }, [houses, indexed, ready, inThreeScopeIds, representation, themeNow]);

  // House-number labels for buildings with households, honouring the status filter.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const features: GeoJSON.Feature[] = [];
    if (layers.buildings && layers.occupied)
      for (const [id, residents] of indexed) {
        const target = houseById.get(id);
        if (!target || !residents.length || (status !== 'all' && !residents.some(r => r.status === status))) continue;
        const first = residents[0];
        // Without a building name or house number, one owner's name would mislabel a shared building: show the count.
        const place = target.properties.name || first.houseNumber;
        const count = `${residents.length} hộ`;
        const label = labelText(residents.length > 1 ? (place ? `${place} · ${count}` : count) : place || first.ownerName);
        if (!label) continue;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: centerOf(target) },
          // Lower rank wins a collision: alerts first, then the busiest buildings.
          properties: { label, rank: STATUS_PRIORITY.indexOf(highestStatus(residents)) * 1000 - residents.length },
        });
      }
    (map.getSource('house-labels') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [ready, indexed, houseById, status, layers.buildings, layers.occupied]);

  useEffect(() => {
    const map = mapRef.current;
    setThreeActive(false);
    if (!map || !ready || loading || !threeEnabled || representation !== '3d' || !layers.buildings) return undefined;
    let cancelled = false;
    let effects: FieldEffects | undefined;
    const [west, south, east, north] = baDiemCommuneBounds;
    // Rebuild only for geometry or territory scope changes, never for selection or status filters.
    const timer = window.setTimeout(() => {
      void import('../three/field-effects.js')
        .then(({ attachFieldEffects }) => {
          if (cancelled) return;
          effects = attachFieldEffects(map, {
            collection: { type: 'FeatureCollection', features: threeHouses },
            anchor: [(west + east) / 2, (south + north) / 2],
            onError() {
              if (!cancelled) {
                setThreeEnabled(false);
                setThreeActive(false);
                setNotice('Hiệu ứng Three.js bị lỗi; đã khôi phục bản đồ gốc.');
              }
            },
          });
          effectsRef.current = effects;
          effects.setDisplayState(displayStatesRef.current);
          pushHighlightsRef.current();
          return effects.ready.then(() => {
            if (!cancelled) setThreeActive(true);
          });
        })
        .catch(() => {
          if (!cancelled) {
            setThreeEnabled(false);
            setNotice('Không khởi tạo được hiệu ứng; bản đồ gốc vẫn hoạt động.');
          }
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      effectsRef.current = null;
      effects?.dispose();
    };
  }, [ready, loading, threeEnabled, threeHouses, representation, layers.buildings]);

  const displayStates = useMemo(
    () =>
      houses.map((house, index) => {
        const residents = indexed.get(house.properties.buildingId) ?? [];
        const occupied = residents.length > 0;
        const own = house.properties.appearanceSource === 'manual' ? undefined : house.properties.color;
        return {
          id: String(house.id ?? house.properties.buildingId ?? index),
          visible: occupied ? layers.occupied : layers.empty,
          // Filtered-out buildings are dimmed and flattened instead of removed, so the neighbourhood stays readable.
          dim: status !== 'all' && !residents.some(resident => resident.status === status),
          // A data colour tints the roof only; selection is a separate highlight (see pushHighlights).
          tint: occupied,
          color: theme === 'status' ? (occupied ? COLORS[highestStatus(residents)] : own) : (themeColor(theme, residents, themeNow) ?? own),
        };
      }),
    [houses, indexed, layers.occupied, layers.empty, status, theme, themeNow],
  );
  const themeScale =
    theme === 'status'
      ? (['normal', 'business', 'warning', 'alert', 'unverified'] as HouseholdStatus[]).map(key => ({
          color: COLORS[key],
          label: STATUS[key],
        }))
      : theme === 'residents'
        ? RESIDENT_SCALE
        : theme === 'recency'
          ? RECENCY_SCALE
          : OCCUPANCY_SCALE;
  const themeLegend = [
    ...themeScale,
    { color: '#f97316', label: 'Vị trí tạm' }, // taste-skill-ignore: màu điểm tạm có sẵn của lớp bản đồ
    ...(theme === 'occupancy' ? [] : [{ color: '#b6c9d6', label: 'Chưa có hộ' }]),
    ...(status === 'all' ? [] : [{ color: DIM_COLOR, label: 'Không khớp bộ lọc' }]),
  ];
  const displayStatesRef = useRef(displayStates);
  displayStatesRef.current = displayStates;
  useEffect(() => {
    effectsRef.current?.setDisplayState(displayStates);
  }, [displayStates]);
  useEffect(() => {
    pushHighlightsRef.current();
  }, [selectedId, houseById]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map?.getLayer('houses-3d')) {
      map.setLayoutProperty(
        'houses-3d-outside',
        'visibility',
        threeActive && hasThreeScopeRestriction && layers.buildings && representation === '3d' ? 'visible' : 'none',
      );
      map.setPaintProperty('houses-3d', 'fill-extrusion-opacity', threeActive ? 0 : 0.88);
    }
  }, [ready, threeActive, hasThreeScopeRestriction, layers.buildings, representation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const colorExpression = [
      'case',
      ['==', ['get', 'buildingId'], selectedId],
      '#fbbf24',
      ...(status === 'all' ? [] : [['!=', ['get', status], true], DIM_COLOR]),
      THEME_EXPRESSION[theme],
    ] as maplibregl.ExpressionSpecification;
    map.setPaintProperty('houses-3d', 'fill-extrusion-color', colorExpression);
    map.setPaintProperty('houses-3d-outside', 'fill-extrusion-color', colorExpression);
    map.setPaintProperty('house-points', 'circle-color', colorExpression);
  }, [selectedId, ready, status, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    // The status filter only recolours buildings (see the colour expression); the layer switches remove them.
    const filter: maplibregl.FilterSpecification = ['all', ['case', ['get', 'occupied'], layers.occupied, layers.empty]];
    const outsideFilter: maplibregl.FilterSpecification = [
      'all',
      ['==', ['get', 'inThreeScope'], false],
      ['case', ['get', 'occupied'], layers.occupied, layers.empty],
    ];
    map.setFilter('houses-3d-outside', outsideFilter);
    map.setFilter('houses-3d', filter);
    map.setFilter('house-points', filter);
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    // The dark street view replaces every other backdrop so the whole map keeps one style.
    show('satellite-context', layers.satellite && !layers.darkStreets);
    show('satellite', layers.satellite && !layers.darkStreets);
    show('streets', layers.map && !layers.darkStreets);
    vectorStreetIds.forEach(id => show(id, layers.map || layers.darkStreets));
    // Online streets have no land fill of their own; match the light land of the offline street tiles.
    map.setPaintProperty('ground', 'background-color', layers.map && !layers.satellite && !layers.darkStreets ? '#f2efe9' : '#3a4036');
    show('boundary', layers.boundary);
    show('hamlet-boundaries', layers.hamlets);
    show('assigned-territories', layers.hamlets);
    show('assigned-boundaries', layers.hamlets);
    show('houses-3d', layers.buildings && representation === '3d');
    show('house-points', layers.buildings && representation === 'point');
    show('households', layers.households);
    show('household-clusters', layers.households);
    map.setFilter(
      'household-clusters',
      status === 'all' ? ['has', 'point_count'] : ['all', ['has', 'point_count'], ['>', ['get', status], 0]],
    );
    show('temporary-households', layers.temporaryHouseholds);
    map.setFilter('temporary-households', status === 'all' ? null : ['==', ['get', 'status'], status]);
    map.setFilter('households', status === 'all' ? ['!', ['has', 'point_count']] : ['==', ['get', 'status'], status]);
  }, [ready, layers, representation, status, vectorStreetIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const displayedTerritories = threeEnabled ? activeTerritoryShapes : territoryShapes;
    (map.getSource('hamlets') as maplibregl.GeoJSONSource | undefined)?.setData(hamletBoundaries);
    (map.getSource('assigned-territories') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: displayedTerritories.map(geometry => ({ type: 'Feature', properties: {}, geometry })),
    });
  }, [ready, hamletBoundaries, activeTerritoryShapes, territoryShapes, threeEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    (map.getSource('temporary-households') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: temporaryHouseholds.map(h => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.coordinates[1], h.coordinates[0]] },
        properties: { id: h.id, status: h.status, coordinateMethod: h.coordinateMethod },
      })),
    });
  }, [ready, temporaryHouseholds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    (map.getSource('households') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: households.flatMap(h => {
        if (explicitlyLinked.has(h.id)) return [];
        const point: number[] | undefined =
          h.coordinates && !h.coordinatesEstimated && h.coordinateMethod !== 'RANDOM_WITHIN_TC2' && h.coordinates.every(Number.isFinite)
            ? [h.coordinates[1], h.coordinates[0]]
            : undefined;
        if (!access.global && point && !territoryShapes.some(geometry => containsHousePoint(geometry, point))) return [];
        return point
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: point },
                properties: { id: h.id, status: h.status },
              },
            ]
          : [];
      }),
    });
  }, [ready, households, explicitlyLinked, access.global, territoryShapes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const features: GeoJSON.Feature[] = draft.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
    if (draft.length > 1)
      features.push({
        type: 'Feature',
        geometry: draft.length > 2 ? { type: 'Polygon', coordinates: [[...draft, draft[0]]] } : { type: 'LineString', coordinates: draft },
        properties: {},
      });
    if (mode === 'move' && selected && moveLng.trim() && moveLat.trim()) {
      try {
        features.push(moveHouse(selected, Number(moveLng), Number(moveLat)));
      } catch {
        /* Invalid input stays in the form until corrected. */
      }
    }
    (map.getSource('draft') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }, [draft, ready, mode, moveLng, moveLat, selected]);

  const persist = async (house: FieldHouse) => {
    if (!access.global) {
      const { data: scope } = await axios.post<{ allowed: boolean }>('/api/gis/field-buildings/access/check', house.geometry);
      if (!scope.allowed) throw Error('Khối nhà nằm ngoài phạm vi ấp được giao hoặc chưa có ranh giới để xác minh.');
    }
    const { data } = await axios.put<FieldHouse>(
      `/api/gis/field-buildings/${encodeURIComponent(house.properties.buildingId)}`,
      persistedHouse(house),
    );
    setHouses(prev => {
      const index = prev.findIndex(h => h.properties.buildingId === data.properties.buildingId);
      return index < 0 ? [...prev, mergeSavedHouse(house, data)] : prev.map((h, i) => (i === index ? mergeSavedHouse(h, data) : h));
    });
    return data;
  };
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.status === 409
            ? 'Hộ dân đã liên kết với công trình khác. Vui lòng tải lại dữ liệu.'
            : err.response?.status === 403
              ? 'Bạn chưa được cấp quyền thực hiện thao tác này.'
              : 'Không lưu được dữ liệu. Kiểm tra kết nối, dữ liệu polygon và thử lại.'
          : err instanceof Error
            ? err.message
            : 'Không lưu được dữ liệu. Vui lòng thử lại.',
      );
    } finally {
      setBusy(false);
    }
  };
  const frameCommune = (map: maplibregl.Map) => {
    const b = baDiemCommuneBounds;
    map.fitBounds(
      [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      { padding: 60, pitch: 0, bearing: 0, duration: 900 },
    );
  };
  const overview = () => {
    const map = mapRef.current;
    if (!map || !houses.length) return;
    frameCommune(map);
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || loading || !map || initializedMapRef.current !== map || framedMapRef.current === map) return;
    framedMapRef.current = map;
    const points = territoryShapes.flatMap(shape => shape.coordinates.flat(shape.type === 'Polygon' ? 1 : 2) as number[][]);
    if (communeOverview || access.global || !points.length) {
      frameCommune(map);
      return;
    }
    const box = boundsOfPoints(points);
    map.fitBounds(
      [
        [box.minX, box.minY],
        [box.maxX, box.maxY],
      ],
      { padding: 48, pitch: 55, bearing: 0, duration: 900 },
    );
  }, [ready, loading, communeOverview, access.global, territoryShapes]);
  const zoomSelected = () => {
    if (selected) {
      const width = containerRef.current?.clientWidth ?? 1000;
      const mapHeight = containerRef.current?.clientHeight ?? 650;
      const compact = width <= 760 || window.matchMedia?.(COMPACT_MAP_QUERY).matches;
      mapRef.current?.fitBounds(houseBounds(selected), {
        padding: compact
          ? { top: Math.min(48, mapHeight * 0.12), bottom: mapHeight * 0.52 + 8, left: 20, right: 20 }
          : { top: 100, bottom: 100, left: 80, right: 360 },
        maxZoom: 20,
        pitch: representation === '3d' ? 55 : 0,
        duration: 800,
      });
    }
  };
  const screenshot = () =>
    void act(async () => {
      const map = mapRef.current;
      if (!map || initializedMapRef.current !== map) throw Error('Bản đồ chưa sẵn sàng để chụp.');
      const pixelRatio = map.getPixelRatio();
      const waitFor = (event: 'idle' | 'render') =>
        new Promise<void>((resolve, reject) => {
          const done = () => {
            clearTimeout(timeout);
            if (mapRef.current !== map) reject(Error('Bản đồ đã đóng. Hãy mở lại và thử chụp.'));
            else resolve();
          };
          const timeout = setTimeout(() => {
            map.off(event, done);
            reject(Error('Bản đồ chưa tải xong. Vui lòng thử chụp lại.'));
          }, 15000);
          map.once(event, done);
          map.triggerRepaint();
        });
      try {
        if (!map.loaded()) await waitFor('idle');
        // Render an actual 2x frame; restore mobile's lower ratio afterwards.
        map.setPixelRatio(2);
        await waitFor('render');
        const center = map.getCenter();
        const canvas = frameMapCapture(map.getCanvas(), captureOfficer, [
          `Trích xuất: ${new Date().toLocaleString('vi-VN')} · Tâm bản đồ: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
          `Zoom: ${map.getZoom().toFixed(1)} · ${houses.length.toLocaleString('vi-VN')} công trình · ${layers.darkStreets ? 'OpenFreeMap © OpenMapTiles, dữ liệu OpenStreetMap' : layers.map ? 'Bản đồ nền và ảnh vệ tinh hiện có của dự án' : 'Ảnh vệ tinh hiện có của dự án'}`,
          ...(layers.temporaryHouseholds && temporaryHouseholds.length
            ? ['Điểm cam: vị trí hộ tạm, chưa xác minh; chưa liên kết công trình.']
            : []),
          ...(layers.hamlets && hamletBoundaries.features.some(feature => feature.properties?.provisional)
            ? ['Ranh giới ấp tạm dựng từ PDF.']
            : []),
        ]);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(value => (value ? resolve(value) : reject(Error('Không tạo được ảnh PNG.'))), 'image/png'),
        );
        setScreenshotBlob(blob);
      } finally {
        if (mapRef.current === map) map.setPixelRatio(pixelRatio);
      }
    });
  const toggle = (key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const frameBoundsList = (boundsList: { minX: number; minY: number; maxX: number; maxY: number }[]) => {
    const map = mapRef.current;
    if (!map || !boundsList.length) return;
    const { minX, minY, maxX, maxY } = boundsOfPoints(
      boundsList.flatMap(b => [
        [b.minX, b.minY],
        [b.maxX, b.maxY],
      ]),
    );
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 56, maxZoom: 17.8, pitch: 58, bearing: -18, duration: 900 },
    );
  };
  const jumpToHousehold = (h: HouseholdFacility) => {
    setQuickSearch('');
    if ((containerRef.current?.clientWidth ?? 1000) <= 1024 || window.matchMedia?.(COMPACT_MAP_QUERY).matches) {
      setLayersOpen(false);
    }
    const bId = buildingByHouseholdId.get(h.id);
    const bHouse = bId ? houseById.get(bId) : undefined;
    if (bId && bHouse) {
      setSelectedId(bId);
      setMode('select');
      const width = containerRef.current?.clientWidth ?? 1000;
      const mapHeight = containerRef.current?.clientHeight ?? 650;
      const compact = width <= 760 || window.matchMedia?.(COMPACT_MAP_QUERY).matches;
      mapRef.current?.fitBounds(houseBounds(bHouse), {
        padding: compact
          ? { top: Math.min(48, mapHeight * 0.12), bottom: mapHeight * 0.52 + 8, left: 20, right: 20 }
          : { top: 100, bottom: 100, left: 80, right: 360 },
        maxZoom: 20,
        pitch: representation === '3d' ? 55 : 0,
        duration: 800,
      });
      return;
    }
    const [lat, lng] = h.coordinates ?? [];
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      mapRef.current?.easeTo({ center: [lng, lat], pitch: 55 });
    }
    onSelect(h);
  };

  return (
    <div className="field-house-map">
      {screenshotBlob && <MapCapturePreview blob={screenshotBlob} onClose={() => setScreenshotBlob(null)} />}
      <header>
        <div className="field-header-brand">
          <strong>Bản Đồ Không Gian 3D Thực Địa</strong>
          <span className="field-count-badge">
            {loading ? 'Đang tải công trình…' : `${houses.length.toLocaleString('vi-VN')} công trình`}
          </span>
        </div>
        <div className="field-quick-search">
          <input
            type="search"
            aria-label="Tìm nhanh hộ dân trên bản đồ 3D"
            placeholder="Tìm nhanh chủ hộ, mã hộ, địa chỉ…"
            value={quickSearch}
            role="combobox"
            aria-expanded={quickMatches.length > 0}
            aria-controls="field-quick-results"
            aria-activedescendant={quickMatches.length ? `field-quick-${quickMatches[quickActive]?.id}` : undefined}
            autoComplete="off"
            onChange={e => setQuickSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setQuickSearch('');
              if (!quickMatches.length) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                const nextIndex = (quickActive + step + quickMatches.length) % quickMatches.length;
                setQuickActive(nextIndex);
                document.getElementById(`field-quick-${quickMatches[nextIndex].id}`)?.scrollIntoView?.({ block: 'nearest' });
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                jumpToHousehold(quickMatches[quickActive] ?? quickMatches[0]);
              }
            }}
          />
          {quickMatches.length > 0 && (
            <div id="field-quick-results" className="field-quick-results" role="listbox" aria-label="Gợi ý hộ dân trên bản đồ">
              {quickMatches.map((h, index) => {
                const bId = buildingByHouseholdId.get(h.id);
                return (
                  <button
                    key={h.id}
                    id={`field-quick-${h.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === quickActive}
                    tabIndex={-1}
                    className={index === quickActive ? 'field-quick-item field-quick-item-active' : 'field-quick-item'}
                    onMouseEnter={() => setQuickActive(index)}
                    onClick={() => jumpToHousehold(h)}
                  >
                    <strong>
                      <i className="field-status-dot" style={{ background: COLORS[h.status] }} aria-hidden="true" />
                      {h.ownerName}
                    </strong>
                    <span>
                      {h.code} · {h.houseNumber} {h.street} · {bId ? 'Đã gắn khối nhà 3D' : 'Điểm tọa độ'}
                    </span>
                  </button>
                );
              })}
              {quickMatches.length === QUICK_RESULT_LIMIT && (
                <small className="field-quick-more">Hiện {QUICK_RESULT_LIMIT} kết quả đầu — gõ thêm để thu hẹp.</small>
              )}
            </div>
          )}
          {deferredQuickSearch.trim() && quickMatches.length === 0 && (
            <div className="field-quick-results" role="status">
              <small className="field-quick-more">Không tìm thấy hộ dân phù hợp trong phạm vi bản đồ.</small>
            </div>
          )}
        </div>
        <div className="field-map-actions" role="toolbar" aria-label="Điều khiển bản đồ 3D">
          <div className="field-tool-group" role="group" aria-label="Góc nhìn">
            <button
              type="button"
              title="Toàn cảnh từ trên cao"
              aria-label="Toàn cảnh từ trên cao"
              disabled={!ready || loading || busy || mode !== 'select'}
              onClick={overview}
            >
              Toàn cảnh
            </button>
            <button
              type="button"
              aria-label="Nhìn từ trên"
              disabled={!ready}
              onClick={() => mapRef.current?.easeTo({ pitch: 0, bearing: 0 })}
            >
              Từ trên
            </button>
            <button type="button" aria-label="Góc nghiêng 3D" disabled={!ready} onClick={() => mapRef.current?.easeTo({ pitch: 55 })}>
              Nghiêng 3D
            </button>
            <button
              type="button"
              aria-label="Đặt lại góc nhìn"
              disabled={!ready}
              onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 55, duration: 600 })}
            >
              Đặt lại
            </button>
          </div>
          <div className="field-tool-group" role="group" aria-label="Thu phóng">
            <button type="button" disabled={!ready} aria-label="Phóng to" onClick={() => mapRef.current?.zoomIn()}>
              +
            </button>
            <button type="button" disabled={!ready} aria-label="Thu nhỏ" onClick={() => mapRef.current?.zoomOut()}>
              −
            </button>
          </div>
          <div className="field-tool-group" role="group" aria-label="Công cụ">
            {canLink && mayWriteTerritory && (
              <button
                type="button"
                className="field-btn-accent"
                disabled={!ready || loading || busy || mode !== 'select'}
                onClick={() => {
                  if ((containerRef.current?.clientWidth ?? 1000) <= 1024 || window.matchMedia?.(COMPACT_MAP_QUERY).matches) {
                    setLayersOpen(false);
                  }
                  setMode('draw');
                  setSelectedId('');
                  setDraft([]);
                  setError('');
                  setNotice('');
                  mapRef.current?.easeTo({ pitch: 0 });
                }}
              >
                + Vẽ khối nhà
              </button>
            )}
            <button
              type="button"
              aria-pressed={mode === 'area'}
              aria-label="Khoanh vùng để thống kê hộ dân"
              disabled={!ready || loading || busy || (mode !== 'select' && mode !== 'area')}
              onClick={() => {
                setDraft([]);
                if (mode === 'area') {
                  setMode('select');
                  return;
                }
                if ((containerRef.current?.clientWidth ?? 1000) <= 1024 || window.matchMedia?.(COMPACT_MAP_QUERY).matches) {
                  setLayersOpen(false);
                }
                setMode('area');
                setSelectedId('');
                setError('');
                setNotice('');
              }}
            >
              Khoanh vùng
            </button>
            <button type="button" disabled={!ready || busy || loading} onClick={screenshot}>
              Chụp ảnh PNG
            </button>
          </div>
          <div className="field-tool-group" role="group" aria-label="Hiển thị">
            <button
              type="button"
              aria-pressed={threeEnabled}
              disabled={!ready || loading}
              onClick={() => {
                const next = !threeEnabled;
                setThreeEnabled(next);
                if (next && activeTerritoryWithBounds.length > 0) {
                  frameBoundsList(activeTerritoryWithBounds);
                }
              }}
            >
              {threeEnabled ? 'Tắt hiệu ứng Three.js' : 'Hiệu ứng Three.js'}
            </button>
            <button type="button" onClick={onToggleFullscreen}>
              {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            </button>
          </div>
        </div>
      </header>
      {threeEnabled && (
        <div role="status" className="field-notice field-three-banner">
          <span>
            {threeActive ? 'Hiệu ứng Three.js đang bật' : 'Đang chuẩn bị hiệu ứng Three.js…'} · Áp dụng{' '}
            <strong>{threeHouses.length.toLocaleString('vi-VN')}</strong> công trình thuộc phạm vi quản lý (nhấp nhô 1–5 tầng, mái ngói/mái
            bằng); công trình ngoài phạm vi giữ nguyên · Thuộc tính minh họa từ GeoJSON dùng chung, không phải khảo sát thực tế.
          </span>
          {access.global && territoryShapes.length === 0 && realHamlets.length > 0 && (
            <label className="field-scope-picker">
              Phạm vi ấp:
              <select
                aria-label="Phạm vi ấp áp dụng Three.js"
                value={effectiveScopeHamletId}
                onChange={e => {
                  const val = e.target.value;
                  setScopeHamletId(val);
                  if (val === 'ALL') {
                    overview();
                  } else {
                    const target = realHamlets.find(f => String(f.properties?.hamletId) === val);
                    if (target) {
                      const shapes = territoryPolygons(target.geometry).map(geometry =>
                        boundsOfPoints(geometry.coordinates.flat(geometry.type === 'Polygon' ? 1 : 2) as number[][]),
                      );
                      frameBoundsList(shapes);
                    }
                  }
                }}
              >
                {realHamlets.map(f => (
                  <option key={String(f.properties?.hamletId)} value={String(f.properties?.hamletId)}>
                    {String(f.properties?.name)}
                  </option>
                ))}
                <option value="ALL">Toàn xã Bà Điểm ({houses.length.toLocaleString('vi-VN')} nhà)</option>
              </select>
            </label>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="field-notice">
          {notice}
        </p>
      )}
      {autoLinkError && (
        <p role="alert" className="field-error">
          Chưa lưu được liên kết tự nhận diện. Các hộ này vẫn giữ point và được đánh dấu chưa lưu.
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              autoLinkAttemptsRef.current.clear();
              setAutoLinkRetry(value => value + 1);
            }}
          >
            Thử lưu lại
          </button>
        </p>
      )}
      {!loading && !access.global && !access.territories.length && (
        <p className="field-notice">
          Chỉ xem hình khối toàn xã và hồ sơ hộ dân được giao. Chưa có ranh giới ấp được phân quyền để cho phép thao tác vị trí.
        </p>
      )}
      {layers.temporaryHouseholds && temporaryHouseholds.length > 0 && (
        <p className="field-temporary-notice">
          <span aria-hidden="true">●</span> {temporaryHouseholds.length.toLocaleString('vi-VN')} hộ/nhóm địa chỉ · Điểm cam là vị trí tạm,
          chưa xác minh; chưa liên kết khối nhà.
        </p>
      )}
      <div className="field-map-body">
        <div ref={containerRef} className="field-map-canvas" />
        <div ref={tooltipRef} className="field-hover-tip" role="tooltip" hidden />
        <div className="field-mouse-help">
          Kéo chuột trái: di chuyển · Kéo chuột phải ngang: xoay · Kéo chuột phải dọc: nghiêng · Lăn chuột: zoom tại con trỏ
          <br />
          Có thể giữ Ctrl + kéo chuột trái để xoay/nghiêng. Click để chọn nhà; khi vẽ, click để thêm đỉnh.
        </div>
        <div className="field-touch-help">Một ngón: di chuyển · Hai ngón: chụm để zoom, xoay hoặc kéo dọc để nghiêng</div>
        <details className="field-layers" open={layersOpen} onToggle={event => setLayersOpen(event.currentTarget.open)}>
          <summary>Layer & bộ lọc</summary>
          {(
            [
              ['satellite', 'Ảnh vệ tinh'],
              ['map', 'Bản đồ đường phố (trên vệ tinh)'],
              ['darkStreets', 'Đường phố nền tối (cần Internet)'],
              ['boundary', 'Ranh giới xã'],
              ['hamlets', 'Ranh giới ấp / phạm vi được giao'],
              ['buildings', 'Công trình'],
              ['occupied', 'Nhà có thông tin hộ dân'],
              ['empty', 'Nhà chưa có hộ dân'],
              ['households', 'Điểm hộ dân'],
              ['temporaryHouseholds', 'Hộ dân — vị trí tạm'],
            ] as [keyof typeof layers, string][]
          ).map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
          <label className="field-layer-select">
            <span>Hiển thị công trình</span>
            <select
              value={representation}
              onChange={e => {
                setRepresentation(e.target.value as '3d' | 'point');
              }}
            >
              <option value="3d">Khối nhà 3D</option>
              <option value="point">Điểm (Point)</option>
            </select>
          </label>
          <label className="field-layer-select">
            <span>Trạng thái hộ dân</span>
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value as typeof status);
              }}
            >
              <option value="all">Tất cả</option>
              {Object.entries(STATUS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-layer-select">
            <span>Tô màu theo</span>
            <select value={theme} onChange={e => setTheme(e.target.value as BuildingTheme)}>
              {Object.entries(BUILDING_THEMES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="field-legend" role="list" aria-label={`Chú giải màu: ${BUILDING_THEMES[theme]}`}>
            {themeLegend.map(item => (
              <span key={item.label} className="field-legend-item" role="listitem">
                <i style={{ background: item.color }} aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
          <small>Khi lọc trạng thái, nhà không khớp được làm mờ và hạ thấp. Chiều cao nhập từ dữ liệu nguồn là giả lập.</small>
          <small>Ranh giới {hamletBoundaries.features.length} ấp: nét vàng. Phạm vi được giao: nét xanh.</small>
          {hamletBoundaries.features.some(feature => feature.properties?.provisional) && (
            <small>Ranh giới ấp tạm dựng từ PDF, dùng cho phân quyền và sẽ được cập nhật khi có tọa độ chuẩn.</small>
          )}
        </details>
        {mode === 'draw' && (
          <aside className="field-panel">
            <h3>Vẽ khối nhà Polygon</h3>
            <p>Click lần lượt các đỉnh trên bản đồ. Khi lưu, cạnh cuối sẽ nối về đỉnh đầu.</p>
            <div className="field-draw-status">
              <span>{draft.length} đỉnh</span>
              <button type="button" disabled={!draft.length || busy} onClick={() => setDraft(prev => prev.slice(0, -1))}>
                Bỏ đỉnh cuối
              </button>
            </div>
            <label>
              Tên công trình
              <input value={name} maxLength={255} onChange={e => setName(e.target.value)} />
            </label>
            <div className="field-form-grid-2">
              <label>
                Số tầng
                <input
                  type="number"
                  min={1}
                  max={MAX_BUILDING_FLOORS}
                  value={floors}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setFloors(v);
                    if (Number.isFinite(v) && v >= 1) setHeight(Math.min(MAX_BUILDING_HEIGHT, v * 3.5));
                  }}
                />
              </label>
              <label>
                Chiều cao (m)
                <input
                  type="number"
                  min={0.5}
                  max={MAX_BUILDING_HEIGHT}
                  step={0.5}
                  value={height}
                  onChange={e => setHeight(Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Màu khối nhà
              <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            </label>
            <div className="field-panel-actions">
              <button
                type="button"
                className="field-primary"
                disabled={busy || draft.length < 3}
                onClick={() =>
                  void act(async () => {
                    const problem = validateDraft(draft);
                    if (problem) throw Error(problem);
                    const invalidProperties = validateBuildingProperties({ buildingId: '', height, floors, name, color });
                    if (invalidProperties) throw Error(invalidProperties);
                    const id = `custom-${crypto.randomUUID()}`;
                    await persist({
                      type: 'Feature',
                      id,
                      geometry: { type: 'Polygon', coordinates: [[...draft, draft[0]]] },
                      properties: { buildingId: id, height, floors, name, color, estimated: false, householdIds: [] },
                    });
                    setSelectedId(id);
                    setDraft([]);
                    setMode('select');
                    setNotice('Đã lưu khối nhà vào cơ sở dữ liệu.');
                  })
                }
              >
                {busy ? 'Đang lưu…' : 'Lưu khối nhà'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode('select');
                  setDraft([]);
                }}
              >
                Hủy vẽ
              </button>
            </div>
          </aside>
        )}
        {mode === 'area' && (
          <aside className="field-panel" aria-label="Thống kê theo vùng">
            <h3>Thống kê theo vùng</h3>
            <p>Bấm lần lượt các đỉnh quanh khu vực cần xem (từ 3 đỉnh). Nhấn Esc để thoát.</p>
            <div className="field-draw-status">
              <span>{draft.length} đỉnh</span>
              <button type="button" disabled={!draft.length} onClick={() => setDraft(prev => prev.slice(0, -1))}>
                Bỏ đỉnh cuối
              </button>
            </div>
            {area && (
              <div role="status">
                <dl className="field-area-stats">
                  <div>
                    <dt>Công trình</dt>
                    <dd>{area.buildingIds.length.toLocaleString('vi-VN')}</dd>
                  </div>
                  <div>
                    <dt>Có hộ dân</dt>
                    <dd>{area.occupiedBuildings.toLocaleString('vi-VN')}</dd>
                  </div>
                  <div>
                    <dt>Hộ dân</dt>
                    <dd>{area.households.length.toLocaleString('vi-VN')}</dd>
                  </div>
                  <div>
                    <dt>Nhân khẩu</dt>
                    <dd>{area.residents.toLocaleString('vi-VN')}</dd>
                  </div>
                </dl>
                <div className="field-legend" role="list" aria-label="Số hộ theo trạng thái trong vùng">
                  {(Object.keys(STATUS) as HouseholdStatus[]).map(key => (
                    <span key={key} className="field-legend-item" role="listitem">
                      <i style={{ background: COLORS[key] }} aria-hidden="true" />
                      {STATUS[key]}: {area.byStatus[key]}
                    </span>
                  ))}
                </div>
                {area.looseHouseholds > 0 && <small>Trong đó {area.looseHouseholds} hộ chưa gắn với công trình nào.</small>}
                {area.households.slice(0, MAX_AREA_ROWS).map(h => (
                  <button key={h.id} type="button" className="field-household" onClick={() => onSelect(h)}>
                    <span className="field-household-main">
                      <i className="field-status-dot" style={{ background: COLORS[h.status] }} aria-hidden="true" />
                      {h.ownerName} · {h.code}
                    </span>
                    <span className="field-household-sub">
                      {[`${h.houseNumber} ${h.street}`.trim(), `${h.residentsCount || 0} nhân khẩu`].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
                {area.households.length > MAX_AREA_ROWS && (
                  <small>
                    Hiện {MAX_AREA_ROWS} hộ đầu trong {area.households.length.toLocaleString('vi-VN')} hộ; thu nhỏ vùng để xem hết.
                  </small>
                )}
              </div>
            )}
            <div className="field-panel-actions">
              <button type="button" disabled={!draft.length} onClick={() => setDraft([])}>
                Xoá vùng
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('select');
                  setDraft([]);
                }}
              >
                Đóng
              </button>
            </div>
          </aside>
        )}
        {selected && mode !== 'draw' && mode !== 'area' && (
          <aside className="field-panel" aria-label="Thông tin công trình">
            <div className="field-panel-heading">
              <h3>{canManageSelected ? selected.properties.name || 'Công trình đã chọn' : 'Công trình · Chỉ xem hình khối'}</h3>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSelectedId('');
                  setMode('select');
                }}
              >
                Đóng
              </button>
            </div>
            <div className="field-meta-card">
              <p className="field-id">{selectedId}</p>
              <div className="field-meta-row">
                <p>
                  Chiều cao: {selected.properties.height} m {selected.properties.estimated ? '(giả lập)' : ''}
                </p>
                <button type="button" onClick={zoomSelected}>
                  Zoom tới khối nhà
                </button>
              </div>
            </div>
            {mode === 'select' && canLink && canManageSelected && (
              <FieldHousePropertiesEditor
                key={selectedId}
                house={selected}
                busy={busy}
                onSave={updated =>
                  act(async () => {
                    await persist(updated);
                    setNotice('Đã lưu thuộc tính khối nhà.');
                  })
                }
              />
            )}
            {!canManageSelected && (
              <p>
                {selected.properties.accessReason === 'linked-household-outside-scope'
                  ? 'Công trình có liên kết hộ dân ngoài phạm vi hồ sơ được giao. Chưa thể thao tác; cần quản trị viên kiểm tra lại liên kết và địa bàn của hộ dân.'
                  : 'Ngoài phạm vi thao tác hoặc chưa xác minh được ranh giới ấp. Không được thêm hộ, liên kết hay di chuyển công trình.'}
              </p>
            )}
            {canManageSelected && (
              <>
                <p>{savedLinked.length ? `${savedLinked.length} hộ dân đã liên kết` : 'Chưa có liên kết hộ dân đã lưu'}</p>
                {savedLinked.length > 0 && (
                  <small>Tổng {savedLinked.reduce((sum, h) => sum + (h.residentsCount || 0), 0)} nhân khẩu trong công trình này.</small>
                )}
                {savedLinked.map(h => {
                  // A verified point inside this footprint is re-linked automatically, so removing it would not last:
                  // that link is fixed by correcting the household's coordinates, not here.
                  const matchedByPoint =
                    !h.coordinatesEstimated &&
                    h.coordinateMethod !== 'RANDOM_WITHIN_TC2' &&
                    h.coordinates?.every(Number.isFinite) &&
                    containsHousePoint(selected.geometry, [h.coordinates[1], h.coordinates[0]]);
                  return (
                    <div key={h.id} className="field-linked-row">
                      <button type="button" className="field-household" onClick={() => onSelect(h)}>
                        <span className="field-household-main">
                          <i className="field-status-dot" style={{ background: COLORS[h.status] }} aria-hidden="true" />
                          {h.ownerName} · {h.code} · {STATUS[h.status]}
                        </span>
                        <span className="field-household-sub">
                          {[`${h.houseNumber} ${h.street}`.trim(), `${h.residentsCount || 0} nhân khẩu`, h.ownerPhone]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>
                      {canLink && matchedByPoint && <small>Khớp theo tọa độ đã xác minh</small>}
                      {canLink && !matchedByPoint && (
                        <button
                          type="button"
                          className={unlinkId === h.id ? 'field-unlink field-unlink-confirm' : 'field-unlink'}
                          disabled={busy}
                          aria-label={unlinkId === h.id ? `Xác nhận gỡ liên kết hộ ${h.code}` : `Gỡ liên kết hộ ${h.code}`}
                          onClick={() => {
                            if (unlinkId !== h.id) {
                              setUnlinkId(h.id);
                              return;
                            }
                            void act(async () => {
                              const next = {
                                ...selected,
                                properties: {
                                  ...selected.properties,
                                  householdIds: (selected.properties.householdIds ?? []).filter(id => id !== h.id),
                                },
                              };
                              await persist(next);
                              setUnlinkId('');
                              setNotice(`Đã gỡ liên kết hộ ${h.code} khỏi công trình.`);
                            });
                          }}
                        >
                          {unlinkId === h.id ? 'Xác nhận gỡ' : 'Gỡ liên kết'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {canManageSelected && pendingLinked.length > 0 && (
                  <>
                    <p>
                      {pendingLinked.length} hộ khớp tọa độ, {busy ? 'đang lưu liên kết…' : 'chưa lưu liên kết'}
                    </p>
                    {!canLink && <small>Cần quyền chỉnh sửa tọa độ để lưu liên kết tự nhận diện.</small>}
                    {pendingLinked.map(h => (
                      <button type="button" key={h.id} className="field-household" onClick={() => onSelect(h)}>
                        {h.ownerName} · {h.code} · Chưa lưu liên kết
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
            {mode === 'select' && canAdd && canManageSelected && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  try {
                    const [lng, lat] = insidePoint(selected);
                    onAdd([lat, lng]);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                Thêm hộ dân tại công trình
              </button>
            )}
            {mode === 'select' && canLink && canManageSelected && (
              <>
                <label>
                  Liên kết hộ dân đã có
                  <input
                    placeholder="Tên, mã hộ hoặc địa chỉ"
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setLinkId('');
                    }}
                  />
                </label>
                <select aria-label="Chọn hộ dân để liên kết" value={linkId} onChange={e => setLinkId(e.target.value)}>
                  <option value="">Chọn hộ dân ({candidates.length} kết quả đầu)</option>
                  {candidates.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.ownerName} · {h.code}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="field-primary"
                  disabled={!linkId || busy}
                  onClick={() =>
                    void act(async () => {
                      // Linking is persisted independently of coordinates; moving the footprint keeps this relation.
                      const next = {
                        ...selected,
                        properties: {
                          ...selected.properties,
                          householdIds: [...new Set([...(selected.properties.householdIds ?? []), ...linked.map(h => h.id), linkId])],
                        },
                      };
                      // The server rejects duplicate explicit links transactionally.
                      await persist(next);
                      setLinkId('');
                      setNotice('Đã lưu liên kết hộ dân vào công trình.');
                    })
                  }
                >
                  {busy ? 'Đang lưu…' : 'Lưu liên kết hộ dân'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const [lng, lat] = centerOf(selected);
                    setMoveLng(lng.toFixed(7));
                    setMoveLat(lat.toFixed(7));
                    setMode('move');
                    setNotice('Click vị trí mới trên bản đồ hoặc nhập tọa độ rồi bấm Lưu.');
                  }}
                >
                  Di chuyển khối nhà
                </button>
              </>
            )}
            {mode === 'move' && canManageSelected && (
              <>
                <p>
                  Click vị trí mới hoặc nhập tâm khung bao. Giữ hình dạng, lỗ rỗng, chiều cao và liên kết hộ dân. Tọa độ GPS gốc của hộ
                  không thay đổi.
                </p>
                <div className="field-form-grid-2">
                  <label>
                    Vĩ độ
                    <input type="number" step="0.0000001" value={moveLat} onChange={e => setMoveLat(e.target.value)} />
                  </label>
                  <label>
                    Kinh độ
                    <input type="number" step="0.0000001" value={moveLng} onChange={e => setMoveLng(e.target.value)} />
                  </label>
                </div>
                <div className="field-panel-actions">
                  <button
                    type="button"
                    className="field-primary"
                    disabled={busy || !moveLat.trim() || !moveLng.trim()}
                    onClick={() =>
                      void act(async () => {
                        const moved = moveHouse(selected, Number(moveLng), Number(moveLat));
                        moved.properties = {
                          ...moved.properties,
                          householdIds: [...new Set([...(selected.properties.householdIds ?? []), ...linked.map(h => h.id)])],
                        };
                        await persist(moved);
                        setMode('select');
                        setNotice('Đã lưu vị trí mới và giữ liên kết hộ dân.');
                      })
                    }
                  >
                    {busy ? 'Đang lưu…' : 'Lưu vị trí khối nhà'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setMode('select')}>
                    Hủy di chuyển
                  </button>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
