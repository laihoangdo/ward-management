import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import * as maplibregl from 'maplibre-gl';
// Registers the MapLibre worker URL before any map instance is created.
import '../gis/utils/maplibreWorkerUrl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, PenLine, Sparkles, Square } from 'lucide-react';
import { localRasterRequest } from '../gis/utils/localRasterRequest';
import { enrichForThree } from '../gis/utils/threeAppearance';
import {
  DEFAULT_FLOOR_HEIGHT,
  MAX_BUILDING_FLOORS,
  MAX_BUILDING_HEIGHT,
  validateBuildingProperties,
  validateDraft,
} from '../gis/utils/fieldHouseGeometry';
import { qualityColor, qualityLabel, qualityOrder, qualityShort } from './linkQuality';

type FieldEffects = ReturnType<typeof import('../gis/three/field-effects.js').attachFieldEffects>;
type Household = { id: string; code: string; raw_address: string; link_quality: string; pinned?: boolean };
type Building = {
  id: string;
  height: number;
  quality: string;
  households: Household[];
  ring: number[][][];
  centre: [number, number];
  /** The building as a GeoJSON feature with its saved design fields, for the shared Three.js building effects. */
  feature: any;
};
type Point = { id: string; code: string; raw_address: string; link_quality: string; coordinates: [number, number] };
type Parsed = { points: Point[]; buildings: Building[]; buildingFeatures: any[]; pointFeatures: any[]; households: number | null };

/** Saved buildings that hold no household yet; drawn light grey so they read as "free to link". */
const EMPTY_QUALITY = 'NONE';
const EMPTY_COLOR = '#cbd5e1';

/** Narrow screens use a gentler tilt so less empty ground shows above the town. */
const tiltFor = () => (typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 55);

const loadMessage = (e: unknown) => {
  const status = axios.isAxiosError(e) ? e.response?.status : undefined;
  if (status === 403) return 'Bạn chưa được cấp quyền xem bản đồ vị trí.';
  if (status === 503) return 'Bản đồ không gian (PostGIS) chưa được bật nên chưa hiển thị vị trí hộ.';
  return 'Không tải được bản đồ vị trí hộ.';
};

const saveMessage = (e: unknown) => {
  if (!axios.isAxiosError(e)) return e instanceof Error ? e.message : 'Không lưu được. Vui lòng thử lại.';
  const data = e.response?.data as { detail?: string; message?: string } | undefined;
  if (e.response?.status === 403) return 'Bạn chưa được cấp quyền sửa vị trí hộ hoặc khối nhà này nằm ngoài địa bàn được giao.';
  return data?.detail ?? data?.message ?? 'Không lưu được. Kiểm tra kết nối rồi thử lại.';
};

const isConflict = (e: unknown) => axios.isAxiosError(e) && e.response?.status === 409;

const firstPolygon = (geometry: any): number[][][] =>
  geometry?.type === 'MultiPolygon' ? (geometry.coordinates?.[0] ?? []) : geometry?.type === 'Polygon' ? (geometry.coordinates ?? []) : [];

const centreOf = (ring: number[][]): [number, number] => {
  const points = ring.slice(0, -1);
  if (!points.length) return [0, 0];
  return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
};

function parse(data: any): Parsed {
  const pointFeatures: any[] = Array.isArray(data?.features) ? data.features : [];
  const points: Point[] = pointFeatures.map(f => ({
    id: String(f.properties.id),
    code: f.properties.code,
    raw_address: f.properties.raw_address,
    link_quality: f.properties.link_quality,
    coordinates: f.geometry.coordinates,
  }));
  const buildingFeatures: any[] = Array.isArray(data?.buildings) ? data.buildings : [];
  const buildings: Building[] = buildingFeatures
    .map(f => {
      const ring = firstPolygon(f.geometry);
      const id = String(f.properties.id);
      const centre = centreOf(ring[0] ?? []);
      const height = Number(f.properties.height) || 3.5;
      // Same design as the 3D field map: natural 1-5 floor heights, tiled or flat roofs, wall colours.
      const feature = enrichForThree(
        { type: 'Feature', id, geometry: f.geometry, properties: { ...(f.properties.appearance ?? {}), buildingId: id, height } },
        centre,
      );
      return {
        id,
        height: Number(feature.properties.height) || height,
        quality: String(f.properties.quality),
        households: (f.properties.households ?? []) as Household[],
        ring,
        centre,
        feature,
      };
    })
    .filter(b => b.ring.length > 0);
  return { points, buildings, buildingFeatures, pointFeatures, households: typeof data?.households === 'number' ? data.households : null };
}

const buildingSourceData = (features: any[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: features.map(f => ({
    type: 'Feature',
    geometry: f.geometry,
    properties: { id: f.properties.id, height: f.properties.height, quality: f.properties.quality },
  })),
});

const pointSourceData = (features: any[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: features.filter(f => f.properties.position_source === 'VERIFIED_COORDINATE'),
});

const draftData = (draft: [number, number][]): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = draft.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
  if (draft.length > 1)
    features.push({
      type: 'Feature',
      geometry: draft.length > 2 ? { type: 'Polygon', coordinates: [[...draft, draft[0]]] } : { type: 'LineString', coordinates: draft },
      properties: {},
    });
  return { type: 'FeatureCollection', features };
};

/**
 * Map pane beside the roster list. Households are drawn as the buildings they are linked to: MapLibre extrusions coloured by how
 * reliable the least certain link in the building is, with the shared Three.js building layer on top (the same layer the area map
 * uses). Households without a recorded position are counted instead of being drawn at an invented place.
 *
 * With {@code canEdit} the officer can also unlink a household from a building, link the household selected in the list to a
 * building (moving it out of another one after confirming) and draw a new building, through the same server checks as the 3D map.
 */
export default function RosterMapPane({
  selectedId,
  onSelect,
  onOpenDetail,
  canEdit = false,
  onChanged,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail?: () => void;
  canEdit?: boolean;
  /** Called after a link change so the list can refresh its link column. */
  onChanged?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const effectsRef = useRef<FieldEffects | null>(null);
  const statesRef = useRef<{ id: string; visible: boolean; color?: string }[]>([]);
  const readyRef = useRef(false);
  const applyRef = useRef<() => void>(() => undefined);
  const onSelectRef = useRef(onSelect);
  const buildingsRef = useRef<Building[]>([]);
  const drawingRef = useRef(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [households, setHouseholds] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [tilted, setTilted] = useState(true);
  const [threeOn, setThreeOn] = useState(true);
  const [threeActive, setThreeActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<Building | null>(null);
  const [unlinkId, setUnlinkId] = useState('');
  const [confirmMove, setConfirmMove] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftFloors, setDraftFloors] = useState(1);
  const [attachSelected, setAttachSelected] = useState(true);
  const [confirmDraftMove, setConfirmDraftMove] = useState(false);
  const editRef = useRef({ canEdit, selectedId });
  onSelectRef.current = onSelect;
  drawingRef.current = drawing;
  editRef.current = { canEdit, selectedId };

  const apply = useCallback((parsed: Parsed) => {
    buildingsRef.current = parsed.buildings;
    setPoints(parsed.points);
    setBuildings(parsed.buildings);
    setHouseholds(parsed.households);
    setPicking(current => (current ? (parsed.buildings.find(b => b.id === current.id) ?? null) : null));
  }, []);

  useEffect(() => {
    let disposed = false;
    axios
      .get('/api/roster/map')
      .then(({ data }) => {
        if (disposed || !containerRef.current) return;
        const parsed = parse(data);
        apply(parsed);

        const map = new maplibregl.Map({
          container: containerRef.current,
          center: [106.59, 10.84],
          zoom: 14,
          pitch: tiltFor(),
          bearing: -15,
          transformRequest: localRasterRequest,
          style: {
            version: 8,
            sources: {
              base: {
                type: 'raster',
                tiles: [`${location.origin}/content/assets/badiem_satellite/{z}/{x}/{y}.jpg`],
                tileSize: 256,
                minzoom: 5,
                maxzoom: 18,
                bounds: [106.5, 10.79, 106.63, 10.91],
                attribution: 'Ảnh vệ tinh hiện có của dự án',
              },
            },
            layers: [
              { id: 'ground', type: 'background', paint: { 'background-color': '#e2e8f0' } },
              { id: 'base', type: 'raster', source: 'base' },
            ],
          },
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
        map.on('load', () => {
          const boundary = data.boundary;
          if (boundary) {
            map.addSource('boundary', {
              type: 'geojson',
              data: boundary.type === 'Feature' ? boundary : { type: 'Feature', properties: {}, geometry: boundary },
            });
            map.addLayer({ id: 'boundary', type: 'line', source: 'boundary', paint: { 'line-color': '#facc15', 'line-width': 2 } });
          }
          const colour: any[] = ['match', ['get', 'quality']];
          for (const [quality, hex] of Object.entries(qualityColor)) colour.push(quality, hex);
          colour.push(EMPTY_QUALITY, EMPTY_COLOR);
          colour.push('#64748b');
          map.addSource('roster-buildings', { type: 'geojson', data: buildingSourceData(parsed.buildingFeatures) });
          map.addLayer({
            id: 'roster-buildings',
            type: 'fill-extrusion',
            source: 'roster-buildings',
            paint: { 'fill-extrusion-color': colour as any, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 0.86 },
          });
          map.addLayer({
            id: 'roster-building-selected',
            type: 'fill-extrusion',
            source: 'roster-buildings',
            filter: ['==', ['get', 'id'], ''],
            paint: {
              'fill-extrusion-color': '#dc2626',
              'fill-extrusion-base': ['get', 'height'],
              'fill-extrusion-height': ['+', ['get', 'height'], 3],
              'fill-extrusion-opacity': 0.95,
            },
          });
          // The coloured footprint outline carries the position reliability, so walls and roofs keep their natural look.
          map.addLayer({
            id: 'roster-quality-outline',
            type: 'line',
            source: 'roster-buildings',
            paint: {
              'line-color': colour as any,
              'line-width': ['case', ['==', ['get', 'quality'], EMPTY_QUALITY], 1, 3] as any,
            },
          });
          // Positions verified on site that are not tied to a building stay as plain points.
          map.addSource('roster-points', { type: 'geojson', data: pointSourceData(parsed.pointFeatures) });
          map.addLayer({
            // The effect layer is inserted before this layer, as on the 3D field map.
            id: 'house-points',
            type: 'circle',
            source: 'roster-points',
            paint: { 'circle-radius': 6, 'circle-color': qualityColor.VERIFIED, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 },
          });
          // The polygon being drawn, above everything else.
          map.addSource('roster-draft', { type: 'geojson', data: draftData([]) });
          map.addLayer({
            id: 'roster-draft-fill',
            type: 'fill',
            source: 'roster-draft',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.25 },
          });
          map.addLayer({
            id: 'roster-draft-line',
            type: 'line',
            source: 'roster-draft',
            filter: ['!=', ['geometry-type'], 'Point'],
            paint: { 'line-color': '#fbbf24', 'line-width': 2 },
          });
          map.addLayer({
            id: 'roster-draft-vertex',
            type: 'circle',
            source: 'roster-draft',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: { 'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-color': '#fbbf24', 'circle-stroke-width': 2 },
          });
          const bounds = new maplibregl.LngLatBounds();
          parsed.buildings.forEach(b => b.ring[0]?.forEach(p => bounds.extend(p as [number, number])));
          if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 35, maxZoom: 16 });
          const pick = (properties: any) => {
            if (drawingRef.current) return;
            const building = buildingsRef.current.find(b => b.id === String(properties?.id));
            if (!building) return;
            setUnlinkId('');
            setConfirmMove(false);
            setActionError('');
            // While editing, keep the household chosen in the list so it can be linked to the building just clicked.
            const keepSelection =
              editRef.current.canEdit &&
              !!editRef.current.selectedId &&
              !building.households.some(h => h.id === editRef.current.selectedId);
            if (building.households.length === 1 && !keepSelection) {
              setPicking(null);
              onSelectRef.current(building.households[0].id);
            } else setPicking(building);
          };
          map.on('click', 'roster-buildings', e => pick(e.features?.[0]?.properties));
          map.on('click', 'house-points', e => {
            if (drawingRef.current) return;
            const id = e.features?.[0]?.properties?.id;
            if (id) onSelectRef.current(String(id));
          });
          map.on('click', e => {
            if (!drawingRef.current) return;
            setDraft(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
          });
          for (const layer of ['roster-buildings', 'house-points']) {
            map.on('mouseenter', layer, () => {
              if (!drawingRef.current) map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layer, () => {
              if (!drawingRef.current) map.getCanvas().style.cursor = '';
            });
          }
          readyRef.current = true;
          setReady(true);
          // A household chosen before the map finished loading.
          applyRef.current();
        });
      })
      .catch(e => !disposed && setError(loadMessage(e)));
    return () => {
      disposed = true;
      readyRef.current = false;
      setReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [apply]);

  /** Reloads the map data after a change and redraws the sources in place (the camera stays where it is). */
  const refresh = useCallback(async () => {
    const { data } = await axios.get('/api/roster/map');
    const parsed = parse(data);
    apply(parsed);
    const map = mapRef.current;
    (map?.getSource?.('roster-buildings') as maplibregl.GeoJSONSource | undefined)?.setData(buildingSourceData(parsed.buildingFeatures));
    (map?.getSource?.('roster-points') as maplibregl.GeoJSONSource | undefined)?.setData(pointSourceData(parsed.pointFeatures));
  }, [apply]);

  const selected = useMemo(() => points.find(p => p.id === selectedId) ?? null, [points, selectedId]);
  const selectedBuilding = useMemo(
    () => (selectedId ? (buildings.find(b => b.households.some(h => h.id === selectedId)) ?? null) : null),
    [buildings, selectedId],
  );
  // The building the panel talks about: the one just clicked, otherwise the one holding the selected household.
  const panelBuilding = picking ?? selectedBuilding;
  const highlighted = panelBuilding?.id ?? '';

  useEffect(() => {
    applyRef.current = () => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      map.setFilter('roster-building-selected', ['==', ['get', 'id'], highlighted]);
      const target = selectedBuilding?.centre ?? selected?.coordinates;
      if (target) map.flyTo({ center: target, zoom: Math.max(map.getZoom(), 17.5), pitch: tilted ? tiltFor() : 0 });
    };
    applyRef.current();
    // Only a change of selection should move the camera, not toggling the tilt.
  }, [selected, selectedBuilding, selectedId]);

  useEffect(() => {
    if (ready) mapRef.current?.setFilter('roster-building-selected', ['==', ['get', 'id'], highlighted]);
  }, [ready, highlighted]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: tilted ? tiltFor() : 0, duration: 500 });
  }, [tilted]);

  // Drawing: show the draft, keep double-click for vertices rather than zoom, and let Esc leave the mode.
  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource?.('roster-draft') as maplibregl.GeoJSONSource | undefined)?.setData(draftData(draft));
  }, [ready, draft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    map.doubleClickZoom?.[drawing ? 'disable' : 'enable']?.();
    const canvas = map.getCanvas();
    if (canvas) canvas.style.cursor = drawing ? 'crosshair' : '';
    if (!drawing) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawing(false);
        setDraft([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, drawing]);

  const collection = useMemo(() => buildings.map(b => b.feature), [buildings]);

  // The display state keeps every building visible and paints only the selected one (gold, as on the 3D field map).
  useEffect(() => {
    statesRef.current = buildings.map(b => ({ id: b.id, visible: true, color: b.id === highlighted ? '#fbbf24' : undefined }));
    effectsRef.current?.setDisplayState(statesRef.current);
  }, [buildings, highlighted]);

  useEffect(() => {
    const map = mapRef.current;
    setThreeActive(false);
    if (!map || !ready || !threeOn || !collection.length) return undefined;
    let cancelled = false;
    let effects: FieldEffects | undefined;
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    buildings.forEach(b => {
      west = Math.min(west, b.centre[0]);
      east = Math.max(east, b.centre[0]);
      south = Math.min(south, b.centre[1]);
      north = Math.max(north, b.centre[1]);
    });
    const timer = window.setTimeout(() => {
      void import('../gis/three/field-effects.js')
        .then(({ attachFieldEffects }) => {
          if (cancelled) return undefined;
          effects = attachFieldEffects(map, {
            collection: { type: 'FeatureCollection', features: collection },
            anchor: [(west + east) / 2, (south + north) / 2],
            onError() {
              if (!cancelled) {
                setThreeOn(false);
                setThreeActive(false);
                setNotice('Hiệu ứng Three.js bị lỗi; đã chuyển về khối nhà cơ bản.');
              }
            },
          });
          effectsRef.current = effects;
          effects.setDisplayState(statesRef.current);
          return effects.ready.then(() => {
            if (!cancelled) setThreeActive(true);
          });
        })
        .catch(() => {
          if (!cancelled) {
            setThreeOn(false);
            setNotice('Không khởi tạo được hiệu ứng Three.js; bản đồ vẫn dùng khối nhà cơ bản.');
          }
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      effectsRef.current = null;
      effects?.dispose();
    };
  }, [ready, threeOn, collection, buildings]);

  // The native blocks stay as the fallback and are hidden only once the effect layer is drawing.
  useEffect(() => {
    const map = mapRef.current;
    if (ready && map?.getLayer('roster-buildings'))
      map.setPaintProperty('roster-buildings', 'fill-extrusion-opacity', threeActive ? 0 : 0.86);
  }, [ready, threeActive]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    points.forEach(p => (result[p.link_quality] = (result[p.link_quality] ?? 0) + 1));
    return result;
  }, [points]);
  const emptyBuildings = useMemo(() => buildings.filter(b => b.households.length === 0).length, [buildings]);
  const linkedBuildings = buildings.length - emptyBuildings;

  /** Runs a change, then reloads the map and tells the list. */
  const change = async (work: () => Promise<string>) => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const message = await work();
      await refresh();
      setNotice(message);
      onChanged?.();
      return true;
    } catch (e) {
      setActionError(saveMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const selectedCode = selected?.code ?? (selectedBuilding?.households.find(h => h.id === selectedId)?.code || 'đang chọn');
  const selectedInPanel = !!(panelBuilding && selectedId && panelBuilding.households.some(h => h.id === selectedId));
  // The selected household already sits in another building: linking it here moves it.
  const selectedElsewhere = !!(selectedBuilding && panelBuilding && selectedBuilding.id !== panelBuilding.id);

  const unlink = (building: Building, household: Household) =>
    void change(async () => {
      await axios.delete(`/api/roster/map/buildings/${encodeURIComponent(building.id)}/households/${encodeURIComponent(household.id)}`);
      setUnlinkId('');
      return `Đã gỡ hộ ${household.code} khỏi khối nhà.`;
    });

  const link = (building: Building, move: boolean) => {
    if (!selectedId) return;
    void change(async () => {
      try {
        const { data } = await axios.post(`/api/roster/map/buildings/${encodeURIComponent(building.id)}/households`, {
          householdId: selectedId,
          move,
        });
        setConfirmMove(false);
        setPicking(null);
        return data?.moved ? `Đã chuyển hộ ${selectedCode} sang khối nhà này.` : `Đã gắn hộ ${selectedCode} vào khối nhà.`;
      } catch (e) {
        if (isConflict(e) && !move) setConfirmMove(true);
        throw e;
      }
    });
  };

  const draftHeight = Math.min(MAX_BUILDING_HEIGHT, draftFloors * DEFAULT_FLOOR_HEIGHT);
  const stopDrawing = () => {
    setDrawing(false);
    setDraft([]);
    setConfirmDraftMove(false);
  };
  const saveDraft = (move: boolean) => {
    const problem =
      validateDraft(draft) ??
      validateBuildingProperties({ buildingId: '', height: draftHeight, floors: draftFloors, name: draftName.trim() } as any);
    if (problem) {
      setActionError(problem);
      return;
    }
    const withHousehold = attachSelected && !!selectedId;
    void change(async () => {
      try {
        const { data } = await axios.post('/api/roster/map/buildings', {
          geometry: { type: 'Polygon', coordinates: [[...draft, draft[0]]] },
          floors: draftFloors,
          height: draftHeight,
          name: draftName.trim(),
          ...(withHousehold ? { householdId: selectedId, move } : {}),
        });
        stopDrawing();
        setDraftName('');
        setDraftFloors(1);
        return withHousehold
          ? `Đã lưu công trình và ${data?.moved ? 'chuyển' : 'gắn'} hộ ${selectedCode} vào đó.`
          : 'Đã lưu công trình mới.';
      } catch (e) {
        if (isConflict(e) && withHousehold && !move) setConfirmDraftMove(true);
        throw e;
      }
    });
  };

  const showPanel = !!panelBuilding && !error && !drawing && (canEdit || panelBuilding.households.length > 1);
  const legendItems = qualityOrder.filter(q => counts[q]);

  return (
    <section className="roster-map-pane" role="region" aria-label="Bản đồ vị trí hộ">
      {error ? (
        <p role="alert" className="roster-error">
          {error}
        </p>
      ) : (
        <p className="roster-notice" role="status">
          {households == null
            ? 'Đang tải vị trí…'
            : `${points.length} / ${households} hộ có vị trí ghi nhận · ${linkedBuildings} khối nhà có hộ`}
          {households != null &&
            households > points.length &&
            ` · ${households - points.length} hộ chưa có vị trí nên không hiện trên bản đồ`}
        </p>
      )}
      {(notice || (threeOn && !threeActive && ready && !error)) && (
        <p className="roster-subline" role="status">
          {notice || 'Đang dựng khối nhà Three.js…'}
        </p>
      )}
      {actionError && (
        <p className="roster-error" role="alert">
          {actionError}
        </p>
      )}
      {selectedId && !error && households != null && !drawing && (
        <div className="roster-map-selected" role="status">
          {selected ? (
            <>
              <strong>{selected.code}</strong> · {selected.raw_address}
              <br />
              <span className="roster-subline">{qualityLabel[selected.link_quality] ?? selected.link_quality}</span>
            </>
          ) : (
            <span>Hộ đang chọn chưa có vị trí thật trên bản đồ.</span>
          )}
          {onOpenDetail && (
            <button type="button" onClick={onOpenDetail}>
              Mở chi tiết hộ
            </button>
          )}
        </div>
      )}
      {showPanel && panelBuilding && (
        <div
          className="roster-map-building"
          role="group"
          aria-label={panelBuilding.households.length > 1 ? 'Các hộ trong cùng một nhà' : 'Khối nhà'}
        >
          <strong>
            {panelBuilding.households.length > 1
              ? `Nhà này có ${panelBuilding.households.length} hộ`
              : panelBuilding.households.length === 1
                ? 'Khối nhà có 1 hộ'
                : 'Khối nhà chưa có hộ'}
          </strong>
          {panelBuilding.households.length > 0 && (
            <ul>
              {panelBuilding.households.map(h => (
                <li key={h.id}>
                  <button type="button" aria-pressed={h.id === selectedId} onClick={() => onSelect(h.id)}>
                    {h.code}
                  </button>
                  <span className="roster-subline">
                    {h.raw_address} · {qualityLabel[h.link_quality] ?? h.link_quality}
                  </span>
                  {canEdit && h.pinned && <span className="roster-subline">Khớp theo tọa độ đã xác minh</span>}
                  {canEdit && !h.pinned && (
                    <button
                      type="button"
                      className={unlinkId === h.id ? 'roster-map-unlink is-confirm' : 'roster-map-unlink'}
                      disabled={busy}
                      aria-label={unlinkId === h.id ? `Xác nhận gỡ hộ ${h.code} khỏi khối nhà` : `Gỡ hộ ${h.code} khỏi khối nhà`}
                      onClick={() => (unlinkId === h.id ? unlink(panelBuilding, h) : setUnlinkId(h.id))}
                    >
                      {unlinkId === h.id ? 'Xác nhận gỡ' : 'Gỡ khỏi khối nhà'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && selectedId && !selectedInPanel && (
            <div className="roster-map-link">
              {confirmMove || selectedElsewhere ? (
                <>
                  <p>Hộ {selectedCode} đang ở khối nhà khác. Chuyển hộ sang khối nhà này?</p>
                  <button type="button" className="roster-primary" disabled={busy} onClick={() => link(panelBuilding, true)}>
                    {busy ? 'Đang lưu…' : 'Chuyển hộ sang khối nhà này'}
                  </button>
                </>
              ) : (
                <button type="button" className="roster-primary" disabled={busy} onClick={() => link(panelBuilding, false)}>
                  {busy ? 'Đang lưu…' : `Gắn hộ ${selectedCode} vào khối nhà này`}
                </button>
              )}
            </div>
          )}
          {canEdit && !selectedId && panelBuilding.households.length === 0 && (
            <p className="roster-subline">Chọn một hộ ở danh sách bên trái để gắn vào khối nhà này.</p>
          )}
          {picking && (
            <button
              type="button"
              className="roster-btn-sm"
              onClick={() => {
                setPicking(null);
                setConfirmMove(false);
                setUnlinkId('');
              }}
            >
              Đóng
            </button>
          )}
        </div>
      )}
      {drawing && (
        <div className="roster-map-draw" role="group" aria-label="Vẽ công trình">
          <strong>Vẽ công trình</strong>
          <p className="roster-subline">Bấm lần lượt các góc của công trình trên bản đồ (ít nhất 3 đỉnh). Nhấn Esc để thoát.</p>
          <div className="roster-actions">
            <span>{draft.length} đỉnh</span>
            <button type="button" disabled={!draft.length || busy} onClick={() => setDraft(prev => prev.slice(0, -1))}>
              Bỏ đỉnh cuối
            </button>
          </div>
          <div className="roster-map-draw-fields">
            <label>
              Tên công trình
              <input value={draftName} maxLength={255} onChange={e => setDraftName(e.target.value)} />
            </label>
            <label>
              Số tầng
              <input
                type="number"
                min={1}
                max={MAX_BUILDING_FLOORS}
                value={draftFloors}
                onChange={e => setDraftFloors(Math.max(1, Math.min(MAX_BUILDING_FLOORS, Math.round(Number(e.target.value) || 1))))}
              />
            </label>
          </div>
          <span className="roster-subline">Chiều cao ước tính {draftHeight.toLocaleString('vi-VN')} m (tối đa 20 tầng / 70 m).</span>
          {selectedId && (
            <label className="roster-check">
              <input type="checkbox" checked={attachSelected} onChange={e => setAttachSelected(e.target.checked)} /> Gắn hộ {selectedCode}{' '}
              vào công trình này
            </label>
          )}
          {confirmDraftMove && <p>Hộ {selectedCode} đang ở khối nhà khác. Lưu công trình và chuyển hộ sang đây?</p>}
          <div className="roster-actions">
            <button
              type="button"
              className="roster-primary"
              disabled={busy || draft.length < 3}
              onClick={() => saveDraft(confirmDraftMove)}
            >
              {busy ? 'Đang lưu…' : confirmDraftMove ? 'Lưu và chuyển hộ' : 'Lưu công trình'}
            </button>
            <button type="button" disabled={busy} onClick={stopDrawing}>
              Hủy vẽ
            </button>
          </div>
        </div>
      )}
      <div className="roster-map-stage">
        <div ref={containerRef} className="roster-map" />
        {!error && (
          <>
            <div className={legendOpen ? 'roster-map-legend-rail is-open' : 'roster-map-legend-rail'}>
              <button
                type="button"
                className="roster-map-legend-toggle"
                aria-expanded={legendOpen}
                aria-label={legendOpen ? 'Thu gọn chú giải' : 'Mở chú giải'}
                onClick={() => setLegendOpen(open => !open)}
              >
                {legendOpen ? '‹' : '›'}
              </button>
              <ul
                className="roster-map-legend"
                aria-label="Chú giải độ tin cậy vị trí"
                title="Viền chân nhà theo hộ có vị trí kém tin cậy nhất trong nhà. Chiều cao và màu mái chỉ để minh hoạ."
              >
                {legendItems.map(q => (
                  <li key={q}>
                    <span className="roster-map-swatch" style={{ background: qualityColor[q] }} aria-hidden="true" />
                    <span className="roster-map-legend-label">{qualityShort[q]}</span>
                    <span className="roster-map-legend-count">{counts[q]}</span>
                  </li>
                ))}
                {emptyBuildings > 0 && (
                  <li>
                    <span className="roster-map-swatch" style={{ background: EMPTY_COLOR }} aria-hidden="true" />
                    <span className="roster-map-legend-label">Chưa có hộ</span>
                    <span className="roster-map-legend-count">{emptyBuildings}</span>
                  </li>
                )}
                <li className="roster-visually-hidden">
                  Viền chân nhà theo hộ có vị trí kém tin cậy nhất trong nhà. Chiều cao và màu mái chỉ để minh hoạ.
                </li>
              </ul>
            </div>
            <div className="roster-map-tools" role="toolbar" aria-label="Công cụ bản đồ" aria-orientation="vertical">
              <button
                type="button"
                aria-pressed={tilted}
                aria-label={tilted ? 'Nhìn từ trên (2D)' : 'Nhìn nghiêng (3D)'}
                title={tilted ? 'Nhìn từ trên (2D)' : 'Nhìn nghiêng (3D)'}
                onClick={() => setTilted(t => !t)}
              >
                {tilted ? <Square size={18} aria-hidden="true" /> : <Box size={18} aria-hidden="true" />}
              </button>
              <button
                type="button"
                aria-pressed={threeOn}
                aria-label={threeOn ? 'Tắt hiệu ứng Three.js' : 'Bật hiệu ứng Three.js'}
                title={threeOn ? 'Tắt hiệu ứng Three.js' : 'Bật hiệu ứng Three.js'}
                onClick={() => setThreeOn(on => !on)}
              >
                <Sparkles size={18} aria-hidden="true" />
              </button>
              {canEdit && (
                <button
                  type="button"
                  aria-pressed={drawing}
                  aria-label={drawing ? 'Thoát vẽ công trình' : 'Vẽ công trình'}
                  title={drawing ? 'Thoát vẽ công trình' : 'Vẽ công trình'}
                  disabled={!ready || busy}
                  onClick={() => {
                    if (drawing) stopDrawing();
                    else {
                      setPicking(null);
                      setActionError('');
                      setAttachSelected(!!selectedId);
                      setDrawing(true);
                    }
                  }}
                >
                  <PenLine size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
