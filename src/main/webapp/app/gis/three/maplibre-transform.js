import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { HALF_WORLD } from './geo.js';

/** Anchored east/up/south meters -> MapLibre east/south/up Mercator units. */
export function localToMercatorMatrix(anchor) {
  const origin = maplibregl.MercatorCoordinate.fromLngLat(anchor, 0);
  // Worker XY uses EPSG:3857's radius; MapLibre's altitude helper uses mean Earth radius.
  const s = 1 / (2 * HALF_WORLD * Math.cos((anchor[1] * Math.PI) / 180));
  const elevationScale = origin.meterInMercatorCoordinateUnits();
  return new THREE.Matrix4().set(s, 0, 0, origin.x, 0, 0, s, origin.y, 0, elevationScale, 0, origin.z, 0, 0, 0, 1);
}
