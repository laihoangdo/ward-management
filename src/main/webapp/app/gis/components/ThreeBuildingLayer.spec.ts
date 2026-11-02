import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeBuildingLayer } from './ThreeBuildingLayer';

it('releases instances, scene references and renderer once when detached', () => {
  const layer = new ThreeBuildingLayer();
  layer.setBuildings([
    {
      id: 'synthetic-building',
      height: 7,
      color: '#aabbcc',
      coordinates: [
        [
          [106, 10],
          [106.0001, 10],
          [106.0001, 10.0001],
          [106, 10.0001],
          [106, 10],
        ],
      ],
    },
  ]);
  const internals = layer as unknown as {
    meshes: THREE.InstancedMesh[];
    scene: THREE.Scene;
    instanceColors: Map<string, unknown>;
    renderer: { dispose: () => void } | undefined;
  };
  expect(internals.meshes).toHaveLength(3);
  const instanceDisposals = internals.meshes.map(mesh => vi.spyOn(mesh, 'dispose'));
  const rendererDispose = vi.fn();
  internals.renderer = { dispose: rendererDispose };
  layer.onRemove();
  layer.onRemove();
  expect(rendererDispose).toHaveBeenCalledOnce();
  expect(instanceDisposals.every(dispose => dispose.mock.calls.length === 1)).toBe(true);
  expect(internals.meshes).toHaveLength(0);
  expect(internals.scene.children).toHaveLength(0);
  expect(internals.instanceColors.size).toBe(0);
});
