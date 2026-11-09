import type { LayerSpecification, SourceSpecification, SpriteSpecification, StyleSpecification } from 'maplibre-gl';

export const VECTOR_BASEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const LAYER_PREFIX = 'basemap-';

export interface VectorBasemap {
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
  glyphs?: string;
  sprite?: SpriteSpecification;
}

/**
 * Keeps only the street layers of a hosted style so they can sit under the operational layers. The style's own 3D
 * buildings and world backdrop are dropped: this map draws its own buildings and ground. Layer IDs are prefixed because
 * hosted IDs such as "building" could collide with operational ones.
 */
export function prepareVectorBasemap(style: StyleSpecification): VectorBasemap {
  const layers = style.layers
    .filter(
      (layer): layer is Exclude<LayerSpecification, { type: 'background' | 'raster' | 'fill-extrusion' }> =>
        layer.type !== 'background' && layer.type !== 'raster' && layer.type !== 'fill-extrusion',
    )
    .map(layer => ({ ...layer, id: `${LAYER_PREFIX}${layer.id}`, layout: { ...layer.layout, visibility: 'none' as const } }));
  const used = new Set(layers.map(layer => layer.source));
  const sources = Object.fromEntries(Object.entries(style.sources).filter(([id]) => used.has(id)));
  return { sources, layers: layers as LayerSpecification[], glyphs: style.glyphs, sprite: style.sprite };
}
