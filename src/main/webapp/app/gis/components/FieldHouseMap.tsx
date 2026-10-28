import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { HouseholdFacility, HouseholdStatus } from '../types';
import { baDiemCommuneBoundary as boundary, baDiemCommuneBounds } from '../data/baDiemCommuneBoundary';
import { FieldHouse, houseBounds, indexHouseholds, moveHouse, validateDraft } from '../utils/fieldHouseGeometry';
import { containsHousePoint } from '../utils/houseFootprints';
import { localRasterRequest } from '../utils/localRasterRequest';
import './FieldHouseMap.css';
import { frameMapCapture, MapCaptureOfficer } from '../utils/mapCapture';
import { MapCapturePreview } from './MapCapturePreview';

interface Props {
  captureOfficer?: MapCaptureOfficer;
  households: HouseholdFacility[];
  canAdd: boolean;
  canLink: boolean;
  onAdd: (coordinates: [number, number]) => void;
  onSelect: (household: HouseholdFacility) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const STATUS: Record<HouseholdStatus, string> = { normal: 'Bình thường', warning: 'Chú ý', alert: 'Cảnh báo', business: 'Kinh doanh' };
const COLORS = { normal: '#10b981', warning: '#f59e0b', alert: '#ef4444', business: '#38bdf8' };
const COMPACT_MAP_QUERY = '(max-width: 760px), (max-height: 600px) and (pointer: coarse)';
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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initializedMapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(() => !window.matchMedia?.(COMPACT_MAP_QUERY).matches);
  const [loading, setLoading] = useState(true);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [access, setAccess] = useState<{ global: boolean; territories: unknown[] }>({ global: false, territories: [] });
  const [hamletBoundaries, setHamletBoundaries] = useState<GeoJSON.FeatureCollection>(EMPTY);
  const territoryShapes = useMemo(() => access.territories.flatMap(territoryPolygons), [access.territories]);
  const [checkedAccess, setCheckedAccess] = useState({ id: '', allowed: false });
  const [houses, setHouses] = useState<FieldHouse[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoLinkError, setAutoLinkError] = useState(false);
  const [autoLinkRetry, setAutoLinkRetry] = useState(0);
  const autoLinkRunningRef = useRef(false);
  const autoLinkAttemptsRef = useRef(new Set<string>());
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<'select' | 'draw' | 'move'>('select');
  const [draft, setDraft] = useState<number[][]>([]);
  const [height, setHeight] = useState(7);
  const [floors, setFloors] = useState(2);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#b6c9d6');
  const [moveLat, setMoveLat] = useState('');
  const [moveLng, setMoveLng] = useState('');
  const [search, setSearch] = useState('');
  const [linkId, setLinkId] = useState('');
  const [status, setStatus] = useState<'all' | HouseholdStatus>('all');
  const [representation, setRepresentation] = useState<'3d' | 'point'>('3d');
  const [layers, setLayers] = useState({
    satellite: true,
    map: false,
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
  const selected = houseById.get(selectedId);
  const linked = indexed.get(selectedId) ?? [];
  const savedLinked = linked.filter(h => selected?.properties.householdIds?.includes(h.id));
  const pendingLinked = linked.filter(h => !selected?.properties.householdIds?.includes(h.id));
  const canManageSelected =
    access.global || (selected?.properties.canManage !== false && checkedAccess.id === selectedId && checkedAccess.allowed);
  const mayWriteTerritory = access.global || access.territories.length > 0;
  const candidates = useMemo(
    () =>
      households
        .filter(
          h =>
            !linked.some(l => l.id === h.id) &&
            !explicitlyLinked.has(h.id) &&
            `${h.code} ${h.ownerName} ${h.houseNumber} ${h.street}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
        )
        .slice(0, 50),
    [households, linked, search, explicitlyLinked],
  );
  const liveRef = useRef({ mode, canLink, houseById, households, onSelect, busy });
  liveRef.current = { mode, canLink, houseById, households, onSelect, busy };

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
        saved.data.features.forEach(h => merged.set(h.properties.buildingId, h));
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
            candidatesToSave.slice(offset, offset + 50),
          );
          const confirmed = new Map(data.features.map(h => [h.properties.buildingId, h]));
          setHouses(previous => previous.map(h => confirmed.get(h.properties.buildingId) ?? h));
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
          satellite: {
            type: 'raster',
            tiles: [`${location.origin}/content/assets/badiem_satellite/{z}/{x}/{y}.jpg`],
            tileSize: 256,
            minzoom: 5,
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
          { id: 'ground', type: 'background', paint: { 'background-color': '#14212b' } },
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
      map.addSource('houses', { type: 'geojson', data: EMPTY, maxzoom: 20 });
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
      map.addSource('house-points', { type: 'geojson', data: EMPTY });
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
      map.addSource('households', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'households',
        type: 'circle',
        source: 'households',
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
            COLORS.normal,
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
      if (live.mode === 'draw' && live.canLink) {
        setDraft(prev => [...prev, [event.lngLat.lng, event.lngLat.lat]]);
        return;
      }
      if (live.mode === 'move' && live.canLink) {
        setMoveLat(event.lngLat.lat.toFixed(7));
        setMoveLng(event.lngLat.lng.toFixed(7));
        return;
      }
      if (!map.getLayer('houses-3d')) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: ['temporary-households', 'households', 'house-points', 'houses-3d'] });
      const h = hits.find(f => f.layer.id === 'temporary-households') ?? hits.find(f => f.layer.id === 'households');
      if (h) {
        const record = live.households.find(item => item.id === h.properties.id);
        if (record) live.onSelect(record);
        return;
      }
      const id = hits.find(f => f.properties.buildingId)?.properties.buildingId;
      if (id && live.houseById.has(id)) {
        if ((containerRef.current?.clientWidth ?? 1000) <= 760 || window.matchMedia?.(COMPACT_MAP_QUERY).matches) setLayersOpen(false);
        setSelectedId(id);
        setSearch('');
        setLinkId('');
        setNotice('');
        setError('');
      }
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current!);
    return () => {
      observer.disconnect();
      initializedMapRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    map.getCanvas().style.cursor = mode === 'select' ? '' : 'crosshair';
    map.doubleClickZoom[mode === 'draw' ? 'disable' : 'enable']();
  }, [mode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const features = houses.map(h => {
      const residents = indexed.get(h.properties.buildingId) ?? [];
      const highest = residents.some(r => r.status === 'alert')
        ? 'alert'
        : residents.some(r => r.status === 'warning')
          ? 'warning'
          : residents.some(r => r.status === 'business')
            ? 'business'
            : 'normal';
      return {
        ...h,
        properties: {
          ...h.properties,
          occupied: residents.length > 0,
          normal: residents.some(r => r.status === 'normal'),
          warning: residents.some(r => r.status === 'warning'),
          alert: residents.some(r => r.status === 'alert'),
          business: residents.some(r => r.status === 'business'),
          displayColor: residents.length ? COLORS[highest] : (h.properties.color ?? '#b6c9d6'),
        },
      };
    });
    (map.getSource('houses') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
    (map.getSource('house-points') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: features.map(h => ({ ...h, geometry: { type: 'Point', coordinates: centerOf(h) } })),
    });
  }, [houses, indexed, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const colorExpression: maplibregl.ExpressionSpecification = [
      'case',
      ['==', ['get', 'buildingId'], selectedId],
      '#fbbf24',
      ['get', 'displayColor'],
    ];
    map.setPaintProperty('houses-3d', 'fill-extrusion-color', colorExpression);
    map.setPaintProperty('house-points', 'circle-color', colorExpression);
  }, [selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    const filter: maplibregl.FilterSpecification = [
      'all',
      ['case', ['get', 'occupied'], layers.occupied, layers.empty],
      status === 'all' ? true : ['==', ['get', status], true],
    ];
    map.setFilter('houses-3d', filter);
    map.setFilter('house-points', filter);
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    show('satellite', layers.satellite);
    show('streets', layers.map);
    show('boundary', layers.boundary);
    show('hamlet-boundaries', layers.hamlets);
    show('assigned-territories', layers.hamlets);
    show('assigned-boundaries', layers.hamlets);
    show('houses-3d', layers.buildings && representation === '3d');
    show('house-points', layers.buildings && representation === 'point');
    show('households', layers.households);
    show('temporary-households', layers.temporaryHouseholds);
    map.setFilter('temporary-households', status === 'all' ? null : ['==', ['get', 'status'], status]);
    map.setFilter('households', status === 'all' ? null : ['==', ['get', 'status'], status]);
  }, [ready, layers, representation, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || initializedMapRef.current !== map) return;
    (map.getSource('hamlets') as maplibregl.GeoJSONSource | undefined)?.setData(hamletBoundaries);
    (map.getSource('assigned-territories') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: territoryShapes.map(geometry => ({ type: 'Feature', properties: {}, geometry })),
    });
  }, [ready, hamletBoundaries, territoryShapes]);

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
    const { data } = await axios.put<FieldHouse>(`/api/gis/field-buildings/${encodeURIComponent(house.properties.buildingId)}`, house);
    setHouses(prev => {
      const index = prev.findIndex(h => h.properties.buildingId === data.properties.buildingId);
      return index < 0 ? [...prev, data] : prev.map((h, i) => (i === index ? data : h));
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
  const overview = () => {
    const map = mapRef.current;
    if (!map || !houses.length) return;
    const b = baDiemCommuneBounds;
    map.fitBounds(
      [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      { padding: 60, pitch: 0, bearing: 0, duration: 900 },
    );
  };
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
          `Zoom: ${map.getZoom().toFixed(1)} · ${houses.length.toLocaleString('vi-VN')} công trình · ${layers.map ? 'Bản đồ nền và ảnh vệ tinh hiện có của dự án' : 'Ảnh vệ tinh hiện có của dự án'}`,
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

  return (
    <div className="field-house-map">
      {screenshotBlob && <MapCapturePreview blob={screenshotBlob} onClose={() => setScreenshotBlob(null)} />}
      <header>
        <strong>Bản Đồ Không Gian 3D Thực Địa</strong>
        <span>{loading ? 'Đang tải công trình…' : `${houses.length.toLocaleString('vi-VN')} công trình`}</span>
        <div className="field-map-actions" role="toolbar" aria-label="Điều khiển bản đồ 3D">
          <button type="button" disabled={!ready || loading || busy || mode !== 'select'} onClick={overview}>
            Toàn cảnh từ trên cao
          </button>
          <button type="button" disabled={!ready} onClick={() => mapRef.current?.easeTo({ pitch: 0, bearing: 0 })}>
            Nhìn từ trên
          </button>
          <button type="button" disabled={!ready} onClick={() => mapRef.current?.easeTo({ pitch: 55 })}>
            Góc nghiêng 3D
          </button>
          <button type="button" disabled={!ready} onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 55, duration: 600 })}>
            Đặt lại góc nhìn
          </button>
          <button type="button" disabled={!ready} aria-label="Phóng to" onClick={() => mapRef.current?.zoomIn()}>
            Zoom +
          </button>
          <button type="button" disabled={!ready} aria-label="Thu nhỏ" onClick={() => mapRef.current?.zoomOut()}>
            Zoom −
          </button>
          <button type="button" disabled={!ready || busy || loading} onClick={screenshot}>
            Chụp ảnh PNG
          </button>
          {canLink && mayWriteTerritory && (
            <button
              type="button"
              disabled={!ready || loading || busy || mode !== 'select'}
              onClick={() => {
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
          <button type="button" onClick={onToggleFullscreen}>
            {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          </button>
        </div>
      </header>
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
          <label>
            Hiển thị công trình
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
          <label>
            Trạng thái hộ dân
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
          <small>Nhà chưa có hộ chỉ hiển thị khi chọn “Tất cả”. Chiều cao nhập từ dữ liệu nguồn là giả lập.</small>
          <small>Ranh giới {hamletBoundaries.features.length} ấp: nét vàng. Phạm vi được giao: nét xanh.</small>
          {hamletBoundaries.features.some(feature => feature.properties?.provisional) && (
            <small>Ranh giới ấp tạm dựng từ PDF, dùng cho phân quyền và sẽ được cập nhật khi có tọa độ chuẩn.</small>
          )}
        </details>
        {mode === 'draw' && (
          <aside className="field-panel">
            <h3>Vẽ khối nhà Polygon</h3>
            <p>Click lần lượt các đỉnh trên bản đồ. Khi lưu, cạnh cuối sẽ nối về đỉnh đầu.</p>
            <p>{draft.length} đỉnh</p>
            <button type="button" disabled={!draft.length || busy} onClick={() => setDraft(prev => prev.slice(0, -1))}>
              Bỏ đỉnh cuối
            </button>
            <label>
              Tên công trình
              <input value={name} maxLength={255} onChange={e => setName(e.target.value)} />
            </label>
            <label>
              Số tầng
              <input
                type="number"
                min={1}
                max={100}
                value={floors}
                onChange={e => {
                  const v = Number(e.target.value);
                  setFloors(v);
                  setHeight(v * 3.5);
                }}
              />
            </label>
            <label>
              Chiều cao (m)
              <input type="number" min={0.5} max={300} step={0.5} value={height} onChange={e => setHeight(Number(e.target.value))} />
            </label>
            <label>
              Màu khối nhà
              <input type="color" value={color} onChange={e => setColor(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={busy || draft.length < 3}
              onClick={() =>
                void act(async () => {
                  const problem = validateDraft(draft);
                  if (problem) throw Error(problem);
                  if (!Number.isFinite(height) || height < 0.5 || height > 300 || !Number.isInteger(floors) || floors < 1 || floors > 100)
                    throw Error('Kiểm tra số tầng và chiều cao (0,5–300 m).');
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
          </aside>
        )}
        {selected && mode !== 'draw' && (
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
            <p className="field-id">{selectedId}</p>
            <p>
              Chiều cao: {selected.properties.height} m {selected.properties.estimated ? '(giả lập)' : ''}
            </p>
            <button type="button" onClick={zoomSelected}>
              Zoom tới khối nhà
            </button>
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
                {savedLinked.map(h => (
                  <button type="button" key={h.id} className="field-household" onClick={() => onSelect(h)}>
                    {h.ownerName} · {h.code} · {STATUS[h.status]}
                  </button>
                ))}
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
                <label>
                  Vĩ độ
                  <input type="number" step="0.0000001" value={moveLat} onChange={e => setMoveLat(e.target.value)} />
                </label>
                <label>
                  Kinh độ
                  <input type="number" step="0.0000001" value={moveLng} onChange={e => setMoveLng(e.target.value)} />
                </label>
                <button
                  type="button"
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
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
