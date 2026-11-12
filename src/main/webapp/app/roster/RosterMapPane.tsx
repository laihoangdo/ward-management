import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import * as maplibregl from 'maplibre-gl';
// Registers the MapLibre worker URL before any map instance is created.
import '../gis/utils/maplibreWorkerUrl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { localRasterRequest } from '../gis/utils/localRasterRequest';
import { enrichForThree } from '../gis/utils/threeAppearance';
import { qualityColor, qualityLabel, qualityOrder, qualityShort } from './linkQuality';

type FieldEffects = ReturnType<typeof import('../gis/three/field-effects.js').attachFieldEffects>;
type Household = { id: string; code: string; raw_address: string; link_quality: string };
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

/** Narrow screens use a gentler tilt so less empty ground shows above the town. */
const tiltFor = () => (typeof window !== 'undefined' && window.innerWidth < 768 ? 45 : 55);

const loadMessage = (e: unknown) => {
  const status = axios.isAxiosError(e) ? e.response?.status : undefined;
  if (status === 403) return 'Bạn chưa được cấp quyền xem bản đồ vị trí.';
  if (status === 503) return 'Bản đồ không gian (PostGIS) chưa được bật nên chưa hiển thị vị trí hộ.';
  return 'Không tải được bản đồ vị trí hộ.';
};

const firstPolygon = (geometry: any): number[][][] =>
  geometry?.type === 'MultiPolygon' ? (geometry.coordinates?.[0] ?? []) : geometry?.type === 'Polygon' ? (geometry.coordinates ?? []) : [];

const centreOf = (ring: number[][]): [number, number] => {
  const points = ring.slice(0, -1);
  if (!points.length) return [0, 0];
  return [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
};

/**
 * Map pane beside the roster list. Households are drawn as the buildings they are linked to: MapLibre extrusions coloured by how
 * reliable the least certain link in the building is, with the shared Three.js building layer on top (the same layer the area map
 * uses). Households without a recorded position are counted instead of being drawn at an invented place.
 */
export default function RosterMapPane({
  selectedId,
  onSelect,
  onOpenDetail,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const effectsRef = useRef<FieldEffects | null>(null);
  const statesRef = useRef<{ id: string; visible: boolean; color?: string }[]>([]);
  const readyRef = useRef(false);
  const applyRef = useRef<() => void>(() => undefined);
  const onSelectRef = useRef(onSelect);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [households, setHouseholds] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [tilted, setTilted] = useState(true);
  const [threeOn, setThreeOn] = useState(true);
  const [threeActive, setThreeActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [picking, setPicking] = useState<Building | null>(null);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let disposed = false;
    axios
      .get('/api/roster/map')
      .then(({ data }) => {
        if (disposed || !containerRef.current) return;
        const features: any[] = Array.isArray(data?.features) ? data.features : [];
        const parsedPoints: Point[] = features.map(f => ({
          id: String(f.properties.id),
          code: f.properties.code,
          raw_address: f.properties.raw_address,
          link_quality: f.properties.link_quality,
          coordinates: f.geometry.coordinates,
        }));
        const buildingFeatures: any[] = Array.isArray(data?.buildings) ? data.buildings : [];
        const parsedBuildings: Building[] = buildingFeatures
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
        setPoints(parsedPoints);
        setBuildings(parsedBuildings);
        setHouseholds(typeof data?.households === 'number' ? data.households : null);

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
          colour.push('#64748b');
          map.addSource('roster-buildings', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: buildingFeatures.map(f => ({
                type: 'Feature',
                geometry: f.geometry,
                properties: { id: f.properties.id, height: f.properties.height, quality: f.properties.quality },
              })),
            },
          });
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
            paint: { 'line-color': colour as any, 'line-width': 3 },
          });
          // Positions verified on site that are not tied to a building stay as plain points.
          map.addSource('roster-points', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: features.filter(f => f.properties.position_source === 'VERIFIED_COORDINATE') },
          });
          map.addLayer({
            // The effect layer is inserted before this layer, as on the 3D field map.
            id: 'house-points',
            type: 'circle',
            source: 'roster-points',
            paint: { 'circle-radius': 6, 'circle-color': qualityColor.VERIFIED, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 },
          });
          const bounds = new maplibregl.LngLatBounds();
          parsedBuildings.forEach(b => b.ring[0]?.forEach(p => bounds.extend(p as [number, number])));
          if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 35, maxZoom: 16 });
          const pick = (properties: any) => {
            const building = parsedBuildings.find(b => b.id === String(properties?.id));
            if (!building) return;
            if (building.households.length === 1) {
              setPicking(null);
              onSelectRef.current(building.households[0].id);
            } else setPicking(building);
          };
          map.on('click', 'roster-buildings', e => pick(e.features?.[0]?.properties));
          map.on('click', 'house-points', e => {
            const id = e.features?.[0]?.properties?.id;
            if (id) onSelectRef.current(String(id));
          });
          for (const layer of ['roster-buildings', 'house-points']) {
            map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
            map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
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
  }, []);

  const selected = useMemo(() => points.find(p => p.id === selectedId) ?? null, [points, selectedId]);
  const selectedBuilding = useMemo(
    () => (selectedId ? (buildings.find(b => b.households.some(h => h.id === selectedId)) ?? null) : null),
    [buildings, selectedId],
  );

  useEffect(() => {
    applyRef.current = () => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      map.setFilter('roster-building-selected', ['==', ['get', 'id'], selectedBuilding?.id ?? '']);
      const target = selectedBuilding?.centre ?? selected?.coordinates;
      if (target) map.flyTo({ center: target, zoom: Math.max(map.getZoom(), 17.5), pitch: tilted ? tiltFor() : 0 });
    };
    applyRef.current();
    // Only a change of selection should move the camera, not toggling the tilt.
  }, [selected, selectedBuilding, selectedId]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: tilted ? tiltFor() : 0, duration: 500 });
  }, [tilted]);

  const collection = useMemo(() => buildings.map(b => b.feature), [buildings]);

  // The display state keeps every building visible and paints only the selected one (gold, as on the 3D field map).
  useEffect(() => {
    statesRef.current = buildings.map(b => ({ id: b.id, visible: true, color: b.id === selectedBuilding?.id ? '#fbbf24' : undefined }));
    effectsRef.current?.setDisplayState(statesRef.current);
  }, [buildings, selectedBuilding]);

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

  const sharing = selectedBuilding && selectedBuilding.households.length > 1 ? selectedBuilding : picking;

  return (
    <section className="roster-map-pane" role="region" aria-label="Bản đồ vị trí hộ">
      {error ? (
        <p role="alert" className="roster-error">
          {error}
        </p>
      ) : (
        <>
          <p className="roster-notice" role="status">
            {households == null
              ? 'Đang tải vị trí…'
              : `${points.length} / ${households} hộ có vị trí ghi nhận · ${buildings.length} khối nhà`}
            {households != null &&
              households > points.length &&
              ` · ${households - points.length} hộ chưa có vị trí nên không hiện trên bản đồ`}
          </p>
        </>
      )}
      {(notice || (threeOn && !threeActive && ready && !error)) && (
        <p className="roster-subline" role="status">
          {notice || 'Đang dựng khối nhà Three.js…'}
        </p>
      )}
      {selectedId && !error && households != null && (
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
      {sharing && !error && (
        <div className="roster-map-building" role="group" aria-label="Các hộ trong cùng một nhà">
          <strong>Nhà này có {sharing.households.length} hộ</strong>
          <ul>
            {sharing.households.map(h => (
              <li key={h.id}>
                <button type="button" aria-pressed={h.id === selectedId} onClick={() => onSelect(h.id)}>
                  {h.code}
                </button>
                <span className="roster-subline">
                  {h.raw_address} · {qualityLabel[h.link_quality] ?? h.link_quality}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="roster-map-stage">
        <div ref={containerRef} className="roster-map" />
        {!error && (
          <div className="roster-map-overlay">
            <ul className="roster-map-legend" aria-label="Chú giải độ tin cậy vị trí">
              {qualityOrder
                .filter(q => counts[q])
                .map(q => (
                  <li key={q}>
                    <span className="roster-map-swatch" style={{ borderColor: qualityColor[q] }} aria-hidden="true" /> {qualityShort[q]} (
                    {counts[q]})
                  </li>
                ))}
            </ul>
            <p className="roster-subline">
              Viền chân nhà theo hộ có vị trí kém tin cậy nhất trong nhà. Chiều cao và màu mái chỉ để minh hoạ.
            </p>
            <div className="roster-actions roster-map-tools">
              <button type="button" aria-pressed={tilted} onClick={() => setTilted(t => !t)}>
                {tilted ? 'Nhìn từ trên (2D)' : 'Nhìn nghiêng (3D)'}
              </button>
              <button type="button" aria-pressed={threeOn} onClick={() => setThreeOn(on => !on)}>
                {threeOn ? 'Tắt hiệu ứng Three.js' : 'Bật hiệu ứng Three.js'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
