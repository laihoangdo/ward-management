import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { prepareVectorBasemap } from './vectorBasemap';

const style = {
  version: 8,
  glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://example.test/sprite',
  sources: {
    backdrop: { type: 'raster', tiles: ['https://example.test/{z}/{x}/{y}.png'] },
    streets: { type: 'vector', url: 'https://example.test/planet' },
  },
  layers: [
    { id: 'background', type: 'background' },
    { id: 'world', type: 'raster', source: 'backdrop' },
    { id: 'road', type: 'line', source: 'streets', 'source-layer': 'transportation' },
    { id: 'building-3d', type: 'fill-extrusion', source: 'streets', 'source-layer': 'building' },
  ],
} as StyleSpecification;

describe('prepareVectorBasemap', () => {
  it('keeps street layers hidden and prefixed, without the backdrop or 3D buildings', () => {
    const basemap = prepareVectorBasemap(style);

    expect(basemap.layers.map(layer => layer.id)).toEqual(['basemap-road']);
    expect(basemap.layers[0].layout).toEqual({ visibility: 'none' });
    expect(Object.keys(basemap.sources)).toEqual(['streets']);
    expect(basemap.glyphs).toBe(style.glyphs);
    expect(basemap.sprite).toBe(style.sprite);
  });
});
