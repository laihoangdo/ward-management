import catalog from '../data/localRasterTiles.json';

// A valid transparent PNG keeps MapLibre's raster lifecycle intact outside the offline coverage.
export const EMPTY_RASTER_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
const available = {
  satellite: new Set(catalog.satellite),
  map: new Set(catalog.map),
};
/** Rebuild the catalog with node scripts/index-local-raster-tiles.mjs after extracting new tiles. */
export function localRasterRequest(url: string): { url: string } {
  const tile = /\/content\/assets\/badiem_(satellite|map)\/(\d+\/\d+\/\d+)\.(?:jpg|png)(?:\?.*)?$/.exec(url);
  if (!tile) return { url };
  return { url: available[tile[1] as keyof typeof available].has(tile[2]) ? url : EMPTY_RASTER_TILE };
}
