import { describe, expect, it } from 'vitest';
import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { localToMercatorMatrix } from './maplibre-transform.js';
import { createProjection } from './geo.js';

describe('Shared MapLibre/Three coordinate frame', () => {
  it('aligns local projected footprints with MapLibre and keeps elevation upward', () => {
    const anchor = [106.57, 10.85];
    const point = [106.58, 10.86];
    const matrix = localToMercatorMatrix(anchor);
    const projection = createProjection({ anchor });
    const [x, z] = projection.point(point);
    const actual = new THREE.Vector3(x, 0, z).applyMatrix4(matrix);
    const expected = maplibregl.MercatorCoordinate.fromLngLat(point, 0);
    expect(actual.x).toBeCloseTo(expected.x, 12);
    expect(actual.y).toBeCloseTo(expected.y, 12);
    expect(actual.z).toBe(0);
    const raised = new THREE.Vector3(0, 10, 0).applyMatrix4(matrix);
    expect(raised.z).toBeCloseTo(maplibregl.MercatorCoordinate.fromLngLat(anchor, 10).z, 12);
  });
});
