import boundaryText from '../../../content/assets/xa_ba_diem.geojson?raw';

// Shared source supplied for the commune boundary after the merger.
const source = JSON.parse(boundaryText.replace(/^\uFEFF/, '')) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
export const baDiemCommuneBoundary: GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  {
    [key: string]: unknown;
    kind: string;
    name: string;
    id?: string | number;
  }
> = {
  ...source,
  features: source.features.map(feature => ({
    ...feature,
    properties: { ...feature.properties, kind: 'commune_boundary', name: String(feature.properties?.ten_xa ?? 'Bà Điểm') },
  })),
};
const points = source.features.flatMap(feature =>
  feature.geometry.type === 'Polygon' ? feature.geometry.coordinates.flat() : feature.geometry.coordinates.flat(2),
);
export const baDiemCommuneBounds = points.reduce<[number, number, number, number]>(
  (bounds, [lng, lat]) => [Math.min(bounds[0], lng), Math.min(bounds[1], lat), Math.max(bounds[2], lng), Math.max(bounds[3], lat)],
  [Infinity, Infinity, -Infinity, -Infinity],
);
