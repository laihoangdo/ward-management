/* global self */
import { createProjection } from './geo.js';
import {
  appendExtrusion,
  appendGableRoof,
  createStreams,
  packStreams,
  projectRings,
  readHeight,
  readMetadata,
  rectangleTemplate,
} from './geometry.js';
import { readAppearance } from './appearance.js';

let acknowledge;
function send(message, transfer = []) {
  return new Promise(resolve => {
    acknowledge = resolve;
    self.postMessage(message, transfer);
  });
}

self.onmessage = async ({ data }) => {
  if (data.type === 'ack') {
    acknowledge?.();
    acknowledge = undefined;
    return;
  }
  if (data.type !== 'load') return;
  try {
    const options = data.options;
    const projection = createProjection(options);
    const sectorSize = options.sectorSize || 512;
    if (!Number.isFinite(sectorSize) || sectorSize < 32) throw new Error('Invalid sector size');
    let response;
    if (!data.collection) {
      response = await fetch(data.url);
      if (!response.ok) throw new Error(`GeoJSON HTTP ${response.status}`);
    }
    // Fetch + decoding + JSON.parse happen in the worker, not on the interaction thread.
    let geojson = data.collection ?? (await response.json());
    data.collection = null;
    if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) throw new Error('Expected GeoJSON FeatureCollection');
    const count = geojson.features.length;
    if (count > 2 ** 24) throw new Error('Float32 feature indices require fewer than 2^24 features');
    const appearance = new Float32Array(count * 4);
    const metadata = new Float32Array(count * 4),
      ids = [],
      sectors = new Map();
    const stats = {
      features: count,
      polygonParts: 0,
      invalidParts: 0,
      unsupportedFeatures: 0,
      estimatedFeatures: 0,
      rectangleParts: 0,
      chunks: 0,
      gableParts: 0,
    };
    for (let i = 0; i < count; i++) {
      const feature = geojson.features[i],
        properties = feature.properties || {};
      ids.push(String(feature.id ?? properties.buildingId ?? i));
      const values = readMetadata(properties, options);
      let area = 80;
      try {
        const geometry = feature.geometry;
        const coordinates = geometry?.type === 'Polygon' ? geometry.coordinates : geometry?.coordinates[0];
        if (options.realistic && !options.useProvidedAppearance && coordinates) {
          const rings = projectRings(coordinates, projection, 0, 0);
          area = Math.abs(
            rings.reduce(
              (sum, ring) =>
                sum +
                ring.reduce((a, p, j) => {
                  const q = ring[(j + 1) % ring.length];
                  return a + (p[0] - ring[0][0]) * (q[1] - ring[0][1]) - (q[0] - ring[0][0]) * (p[1] - ring[0][1]);
                }, 0) /
                  2,
              0,
            ),
          );
        }
      } catch {
        /* Geometry validation below records invalid parts. */
      }
      const style = readAppearance(properties, ids[i], area);
      const floorHeight = Number(properties.floorHeight);
      const seed = Number(properties.appearanceSeed);
      appearance.set(
        [
          style.wall,
          style.roof,
          floorHeight > 0 && floorHeight < 10 ? floorHeight : 3.2,
          Number.isFinite(seed) && seed >= 0 && seed < 1 ? seed : style.seed,
        ],
        i * 4,
      );
      let height;
      try {
        const result = readHeight(properties, options);
        height = result.height;
        values[3] = Number(result.estimated);
        if (options.realistic && !options.useProvidedAppearance && result.estimated) {
          height = readHeight({ height: style.height }, { ...options, heightKey: 'height' }).height;
          values[3] = Number(style.estimated);
        }
      } catch {
        height = null;
      }
      metadata.set(values, i * 4);
      stats.estimatedFeatures += values[3];
      const geometry = feature.geometry;
      if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) stats.unsupportedFeatures++;
      const polygons =
        geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
      for (const coordinates of polygons) {
        stats.polygonParts++;
        try {
          if (height === null) throw new Error('Invalid height');
          const [x, z] = projection.point(coordinates[0][0]);
          const sx = Math.floor(x / sectorSize),
            sz = Math.floor(z / sectorSize),
            key = `${sx}:${sz}`;
          if (!sectors.has(key)) sectors.set(key, { origin: [sx * sectorSize, sz * sectorSize], parts: [] });
          sectors.get(key).parts.push({ coordinates, height, featureIndex: i, roofShape: style.roofShape });
        } catch {
          stats.invalidParts++;
        }
      }
    }
    if (new Set(ids).size !== ids.length) throw new Error('Feature IDs must be unique; do not use raw OSM IDs as GPU floats');
    geojson = null;
    await send({ type: 'metadata', ids, metadata, appearance }, [metadata.buffer, appearance.buffer]);
    // One acknowledged packet at a time: no flood of ArrayBuffers waiting for main-thread GPU uploads.
    for (const [key, sector] of sectors) {
      let streams = createStreams();
      const flush = async () => {
        if (!streams.features.length && !streams.boxes.length) return;
        const packet = packStreams(streams);
        streams = createStreams();
        await send(
          { type: 'chunk', origin: sector.origin, packet },
          Object.values(packet).map(array => array.buffer),
        );
        stats.chunks++;
      };
      for (const part of sector.parts) {
        try {
          const rings = projectRings(part.coordinates, projection, ...sector.origin);
          const rectangle = options.instanceRectangles === false ? null : rectangleTemplate(rings);
          if (options.realistic && rectangle && part.roofShape === 'gable') {
            const rise = Math.min(2.4, Math.min(rectangle.width, rectangle.depth) * 0.25, part.height * 0.3);
            appendExtrusion(streams, rings, part.height - rise, part.featureIndex);
            appendGableRoof(streams, rings[0], part.height - rise, rise, part.featureIndex);
            stats.gableParts++;
          } else if (rectangle) {
            streams.boxes.push(rectangle.x, rectangle.z, rectangle.width, rectangle.depth, part.height, rectangle.yaw, part.featureIndex);
            stats.rectangleParts++;
          } else appendExtrusion(streams, rings, part.height, part.featureIndex);
        } catch {
          stats.invalidParts++;
        }
        if (streams.features.length >= 64000 || streams.boxes.length >= 1024 * 7) await flush();
      }
      await flush();
      sectors.delete(key); // Release parsed coordinate objects sector by sector.
    }
    self.postMessage({ type: 'done', stats });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Geometry worker failed' });
  }
};
