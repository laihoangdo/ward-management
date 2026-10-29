/* global Worker */
import * as THREE from 'three';
import { BuildingLayer } from './buildings.js';
import { localToMercatorMatrix } from './maplibre-transform.js';

/** Attach decoration to an EXISTING map; never recreate its camera, sources or handlers. */
export function attachFieldEffects(map, { collection, anchor, onError = () => {} }) {
  const id = 'field-three-effects';
  let renderer,
    buildings,
    worker,
    disposed = false,
    settled = false,
    result,
    states = [],
    dirty = true;
  const jobs = [],
    scene = new THREE.Scene(),
    camera = new THREE.Camera();
  const matrix = localToMercatorMatrix(anchor);
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  ready.catch(() => {});
  function release() {
    if (disposed) return;
    disposed = true;
    worker?.terminate();
    worker = null;
    jobs.length = 0;
    states = [];
    buildings?.dispose();
    renderer?.dispose();
    scene.clear();
    if (!settled) {
      settled = true;
      rejectReady(new DOMException('Effects disposed', 'AbortError'));
    }
  }
  function fail(error) {
    if (disposed) return;
    if (!settled) {
      settled = true;
      rejectReady(error);
    }
    onError(error);
    release();
  }
  const layer = {
    id,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      try {
        renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl });
        renderer.autoClear = false;
        buildings = new BuildingLayer(scene, renderer, { realistic: true });
        worker = new Worker(new URL('./geometry.worker.js', import.meta.url), { type: 'module' });
        worker.onerror = event => fail(new Error(event.message || 'Worker failed'));
        worker.onmessage = ({ data }) => {
          if (disposed) return;
          if (data.type === 'error') {
            fail(new Error(data.message));
            return;
          }
          if (data.type === 'done') {
            result = data.stats;
            worker.terminate();
            worker = null;
          } else
            jobs.push(() => {
              if (data.type === 'metadata') buildings.initialize(data.ids, data.metadata, data.appearance);
              if (data.type === 'chunk') buildings.add(data);
              worker?.postMessage({ type: 'ack' });
            });
          map.triggerRepaint();
        };
        // Read materialized attributes from the shared collection; no runtime height inference.
        worker.postMessage({
          type: 'load',
          collection,
          options: {
            anchor,
            sourceCRS: 'EPSG:4326',
            groundMeters: true,
            sectorSize: 512,
            realistic: true,
            useProvidedAppearance: true,
          },
        });
        collection = null;
      } catch (error) {
        fail(error);
      }
    },
    render(_gl, input) {
      if (disposed) return;
      try {
        const deadline = performance.now() + 4;
        while (jobs.length && performance.now() < deadline) jobs.shift()();
        buildings.buildIdIndex(1);
        // Keep native extrusion visible until the replacement is complete.
        if (result && !buildings.pendingIds) {
          if (dirty) {
            buildings.setDisplayState(states);
            dirty = false;
          }
          camera.projectionMatrix.fromArray(input.defaultProjectionData.mainMatrix).multiply(matrix);
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
          renderer.resetState();
          try {
            renderer.render(scene, camera);
          } finally {
            renderer.resetState();
          }
          if (!settled) {
            settled = true;
            resolveReady(result);
          }
        }
        if (jobs.length || buildings.pendingIds) map.triggerRepaint();
      } catch (error) {
        fail(error);
      }
    },
    onRemove: release,
  };
  map.addLayer(layer, 'house-points');
  return {
    ready,
    setDisplayState(next) {
      states = next;
      dirty = true;
      if (!disposed) map.triggerRepaint();
    },
    dispose() {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
      } catch {
        /* Host map may already be removed. */
      } finally {
        release();
      }
    },
  };
}
