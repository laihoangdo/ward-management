import type * as maplibregl from 'maplibre-gl';
import { circle, LngLat } from './geo';

export const NAV_SOURCE = 'nav';
const LAYERS = [
  'nav-accuracy',
  'nav-accuracy-line',
  'nav-walked',
  'nav-ahead-casing',
  'nav-ahead',
  'nav-connector',
  'nav-origin',
  'nav-target',
];
const kind = (value: string): maplibregl.FilterSpecification => ['==', ['get', 'kind'], value];

/** Route and location layers, drawn under the house labels and above the ground imagery; the 3D buildings may hide them. */
export function ensureNavLayers(map: maplibregl.Map) {
  if (map.getSource(NAV_SOURCE)) return;
  map.addSource(NAV_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    attribution: 'Dữ liệu đường © OpenStreetMap contributors',
  });
  const before = map.getLayer('house-labels') ? 'house-labels' : undefined;
  const add = (layer: maplibregl.LayerSpecification) => map.addLayer(layer, before);
  add({
    id: 'nav-accuracy',
    type: 'fill',
    source: NAV_SOURCE,
    filter: kind('accuracy'),
    paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.12 },
  });
  add({
    id: 'nav-accuracy-line',
    type: 'line',
    source: NAV_SOURCE,
    filter: kind('accuracy'),
    paint: { 'line-color': '#2563eb', 'line-opacity': 0.45, 'line-width': 1 },
  });
  add({
    id: 'nav-walked',
    type: 'line',
    source: NAV_SOURCE,
    filter: kind('walked'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#94a3b8', 'line-width': 5, 'line-opacity': 0.85 },
  });
  add({
    id: 'nav-ahead-casing',
    type: 'line',
    source: NAV_SOURCE,
    filter: kind('ahead'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#0b3d91', 'line-width': 9 },
  });
  add({
    id: 'nav-ahead',
    type: 'line',
    source: NAV_SOURCE,
    filter: kind('ahead'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#3b82f6', 'line-width': 6 },
  });
  add({
    id: 'nav-connector',
    type: 'line',
    source: NAV_SOURCE,
    filter: kind('connector'),
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#1d4ed8', 'line-width': 3, 'line-dasharray': [1, 1.5] },
  });
  add({
    id: 'nav-origin',
    type: 'circle',
    source: NAV_SOURCE,
    filter: kind('origin'),
    paint: { 'circle-radius': 7, 'circle-color': '#16a34a', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
  });
  add({
    id: 'nav-target',
    type: 'circle',
    source: NAV_SOURCE,
    filter: kind('target'),
    paint: { 'circle-radius': 8, 'circle-color': '#dc2626', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
  });
}

export function removeNavLayers(map: maplibregl.Map) {
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(NAV_SOURCE)) map.removeSource(NAV_SOURCE);
}

export interface NavDrawing {
  accuracy?: { center: LngLat; radius: number } | null;
  walked?: LngLat[];
  ahead?: LngLat[];
  connectors?: [LngLat, LngLat][];
  /** Chosen start point (search or map), when the route does not start at the GPS position. */
  origin?: LngLat | null;
  target?: LngLat | null;
}

export function navFeatures(drawing: NavDrawing): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const line = (coordinates: LngLat[], value: string) => {
    if (coordinates.length >= 2)
      features.push({ type: 'Feature', properties: { kind: value }, geometry: { type: 'LineString', coordinates } });
  };
  if (drawing.accuracy && drawing.accuracy.radius > 0)
    features.push({
      type: 'Feature',
      properties: { kind: 'accuracy' },
      geometry: { type: 'Polygon', coordinates: [circle(drawing.accuracy.center, drawing.accuracy.radius)] },
    });
  line(drawing.walked ?? [], 'walked');
  line(drawing.ahead ?? [], 'ahead');
  for (const piece of drawing.connectors ?? []) line(piece, 'connector');
  if (drawing.origin)
    features.push({ type: 'Feature', properties: { kind: 'origin' }, geometry: { type: 'Point', coordinates: drawing.origin } });
  if (drawing.target)
    features.push({ type: 'Feature', properties: { kind: 'target' }, geometry: { type: 'Point', coordinates: drawing.target } });
  return { type: 'FeatureCollection', features };
}

export function drawNav(map: maplibregl.Map, drawing: NavDrawing) {
  ensureNavLayers(map);
  (map.getSource(NAV_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(navFeatures(drawing));
}
