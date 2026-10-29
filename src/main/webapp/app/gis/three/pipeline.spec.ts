import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createProjection, geographicBounds, HALF_WORLD, lonLatToMercator, tileRange } from './geo.js';
import { appendExtrusion, createStreams, packStreams, projectRings, readHeight, readMetadata, rectangleTemplate } from './geometry.js';
import { BuildingLayer, mergeOwnedSectorGeometries } from './buildings.js';

const projection = createProjection({ anchor: [0, 0], sourceCRS: 'EPSG:3857' });
afterEach(() => vi.restoreAllMocks());

describe('Projection and offline XYZ alignment', () => {
  it('subtracts the same anchor for both geographic and projected GeoJSON', () => {
    const options = { anchor: [106.6, 10.88] };
    const lonLat = createProjection(options);
    const projected = createProjection({ ...options, sourceCRS: 'EPSG:3857' });
    const point = [106.601, 10.881];
    expect(lonLat.point(options.anchor)).toEqual([0, 0]);
    const a = lonLat.point(point),
      b = projected.point(lonLatToMercator(point[0], point[1]));
    expect(a[0]).toBeCloseTo(b[0], 9);
    expect(a[1]).toBeCloseTo(b[1], 9);
    expect(a[0]).toBeGreaterThan(0);
    expect(a[1]).toBeLessThan(0);
  });

  it('puts a polygon vertex at exactly the matching tile corner', () => {
    const p = createProjection({ anchor: [106.6, 10.88], sourceCRS: 'EPSG:3857' });
    const z = 16,
      x = 52174,
      y = 30775,
      span = (2 * HALF_WORLD) / 2 ** z;
    const tile = p.tile(z, x, y);
    const corner = p.point([-HALF_WORLD + x * span, HALF_WORLD - y * span]);
    expect(corner[0]).toBeCloseTo(tile.x - tile.size / 2, 6);
    expect(corner[1]).toBeCloseTo(tile.z - tile.size / 2, 6);
  });

  it('does not guess CRS and excludes out-of-domain coordinates', () => {
    expect(() => createProjection({ anchor: [0, 0], sourceCRS: 'AUTO' })).toThrow();
    expect(() => projection.point([30_000_000, 0])).toThrow();
    expect(() => lonLatToMercator(106, 90)).toThrow();
    const p = createProjection({ anchor: [0, 0] });
    const extent = geographicBounds(p, [-1, -1, 1, 1]);
    const range = tileRange(p, extent, 0);
    expect(range).toEqual({ x0: 0, x1: 0, y0: 0, y1: 0 });
  });
});

describe('Direct extrusion and exact template selection', () => {
  it('triangulates a courtyard without filling its hole, with outward winding and normals', () => {
    const rings = projectRings(
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [3, 3],
          [7, 3],
          [7, 7],
          [3, 7],
          [3, 3],
        ],
      ],
      projection,
      0,
      0,
    );
    const streams = createStreams();
    appendExtrusion(streams, rings, 9, 17);
    const packet = packStreams(streams);
    let roofArea = 0;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      cross = new THREE.Vector3(),
      edge = new THREE.Vector3();
    for (let i = 0; i < packet.indices.length; i += 3) {
      const index = packet.indices[i];
      a.fromArray(packet.positions, index * 3);
      b.fromArray(packet.positions, packet.indices[i + 1] * 3);
      c.fromArray(packet.positions, packet.indices[i + 2] * 3);
      cross.crossVectors(edge.subVectors(b, a), new THREE.Vector3().subVectors(c, a));
      const normal = new THREE.Vector3().fromArray(packet.normals, index * 3);
      expect(cross.dot(normal)).toBeGreaterThan(0);
      if (normal.y === 1) roofArea += cross.y / 2;
    }
    expect(roofArea).toBeCloseTo(84, 6);
    expect(new Set(packet.features)).toEqual(new Set([17]));
    expect(rectangleTemplate(rings)).toBeNull();
  });

  it('instances rectangles but never approximates an L-shape with a box', () => {
    const rectangle = projectRings(
      [
        [
          [0, 0],
          [10, 0],
          [10, 4],
          [0, 4],
          [0, 0],
        ],
      ],
      projection,
      0,
      0,
    );
    const template = rectangleTemplate(rectangle)!;
    expect(template.width * template.depth).toBeCloseTo(40, 6);
    expect(template.x).toBeCloseTo(5);
    expect(template.z).toBeCloseTo(-2);
    const l = projectRings(
      [
        [
          [0, 0],
          [3, 0],
          [3, 1],
          [1, 1],
          [1, 3],
          [0, 3],
          [0, 0],
        ],
      ],
      projection,
      0,
      0,
    );
    expect(rectangleTemplate(l)).toBeNull();
  });

  it('rejects degenerate rings and does not invent demographic values', () => {
    expect(() =>
      projectRings(
        [
          [
            [0, 0],
            [1, 0],
            [2, 0],
            [0, 0],
          ],
        ],
        projection,
        0,
        0,
      ),
    ).toThrow();
    expect(readMetadata({})).toEqual([-1, -1, -1, 0]);
    expect(readMetadata({ population: false, averageAge: ' ', status: 'missing' })).toEqual([-1, -1, -1, 0]);
    expect(readMetadata({ population: 0, averageAge: 60, status: 'warning' })).toEqual([0, 60, 1, 0]);
    expect(readHeight({})).toEqual({ height: 6, estimated: true });
    expect(readHeight({ height: 12, estimated: true })).toEqual({ height: 12, estimated: true });
  });
});

describe('GPU attribute ownership and disposal', () => {
  const renderer = { capabilities: { maxTextureSize: 4096 } };

  it('uses a bottom-anchored instance matrix and supports partial metadata updates', () => {
    const scene = new THREE.Scene(),
      layer = new BuildingLayer(scene, renderer);
    layer.initialize(['building'], new Float32Array([2, 30, 0, 1]));
    layer.buildIdIndex();
    const packet = packStreams(createStreams());
    packet.boxes = new Float32Array([2, -3, 10, 8, 5, 0, 0]);
    layer.add({ origin: [512, 1024], packet });
    const mesh = layer.root.children[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    expect(new THREE.Vector3(0, 0, 0).applyMatrix4(matrix).toArray()).toEqual([2, 0, -3]);
    expect(new THREE.Vector3(0, 1, 0).applyMatrix4(matrix).y).toBe(5);
    const attribute = mesh.geometry.getAttribute('aMetadata') as THREE.InstancedBufferAttribute;
    const previous = attribute.version;
    expect(layer.updateMetadata('building', { status: 2, population: 10 })).toBe(true);
    expect(Array.from(attribute.array)).toEqual([10, 30, 2, 1]);
    expect(attribute.version).toBeGreaterThan(previous);
    expect(attribute.updateRanges).toContainEqual({ start: 0, count: 4 });
    layer.setMode('safety');
    layer.setDisplayState([{ id: 'building', color: '#fbbf24', visible: true }]);
    expect(layer.displayData[0]).toBe(0xfbbf24);
    expect(layer.displayData[1]).toBe(1);
    layer.setDisplayState([{ id: 'building', visible: false }]);
    expect(layer.displayData[1]).toBe(0);
    const displayDispose = vi.spyOn(layer.display!, 'dispose');
    expect(layer.uniforms.uMode.value).toBe(1);
    expect(() => layer.setMode('constructor')).toThrow();
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const instanceDispose = vi.spyOn(mesh, 'dispose');
    const metadataDispose = vi.spyOn(layer.metadata!, 'dispose');
    const appearanceDispose = vi.spyOn(layer.appearance!, 'dispose');
    layer.dispose();
    layer.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(instanceDispose).toHaveBeenCalledOnce();
    expect(metadataDispose).toHaveBeenCalledOnce();
    expect(appearanceDispose).toHaveBeenCalledOnce();
    expect(displayDispose).toHaveBeenCalledOnce();
    expect(layer.appearance.image).toBeNull();
    expect(scene.children).toHaveLength(0);
    expect(layer.data).toBeNull();
  });

  it('merges compatible sectors and disposes temporary input geometries', () => {
    const a = new THREE.BoxGeometry(),
      b = new THREE.BoxGeometry().translate(2, 0, 0);
    const ad = vi.spyOn(a, 'dispose'),
      bd = vi.spyOn(b, 'dispose');
    const merged = mergeOwnedSectorGeometries([a, b]);
    expect(merged.boundingBox!.min.x).toBe(-0.5);
    expect(merged.boundingBox!.max.x).toBe(2.5);
    expect(ad).toHaveBeenCalledOnce();
    expect(bd).toHaveBeenCalledOnce();
    merged.dispose();
  });
});
