export const R = 6378137;
export const HALF_WORLD = Math.PI * R;
export const MAX_LATITUDE = 85.0511287798066;

export function lonLatToMercator(longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > MAX_LATITUDE) {
    throw new RangeError('Coordinates are outside the supported Web Mercator domain');
  }
  const phi = (latitude * Math.PI) / 180;
  return [(R * longitude * Math.PI) / 180, R * Math.asinh(Math.tan(phi))];
}

/** East = +X, up = +Y, south = +Z. Subtract in Float64, then upload sector-local Float32. */
export function createProjection({ anchor, sourceCRS = 'EPSG:4326', groundMeters = true }) {
  if (!['EPSG:4326', 'EPSG:3857'].includes(sourceCRS)) throw new Error('Declare EPSG:4326 or EPSG:3857 explicitly');
  const [originX, originY] = lonLatToMercator(anchor[0], anchor[1]);
  const scale = groundMeters ? Math.cos((anchor[1] * Math.PI) / 180) : 1;
  const mercatorToWorld = (x, y) => [(x - originX) * scale, (originY - y) * scale];
  return {
    originX,
    originY,
    scale,
    mercatorToWorld,
    point(coordinate) {
      const [x, y] = sourceCRS === 'EPSG:4326' ? lonLatToMercator(coordinate[0], coordinate[1]) : coordinate;
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > HALF_WORLD || Math.abs(y) > HALF_WORLD + 1e-6) {
        throw new RangeError('Invalid projected coordinate');
      }
      return mercatorToWorld(x, y);
    },
    worldToMercator(x, z) {
      return [originX + x / scale, originY - z / scale];
    },
    tile(z, x, y) {
      const span = (2 * HALF_WORLD) / 2 ** z;
      const [cx, cz] = mercatorToWorld(-HALF_WORLD + (x + 0.5) * span, HALF_WORLD - (y + 0.5) * span);
      return { x: cx, z: cz, size: span * scale };
    },
  };
}

export function geographicBounds(projection, [west, south, east, north]) {
  if (!(west < east && south < north)) throw new Error('Local extent must not cross the antimeridian');
  const [minX, minZ] = projection.mercatorToWorld(...lonLatToMercator(west, north));
  const [maxX, maxZ] = projection.mercatorToWorld(...lonLatToMercator(east, south));
  return { minX, minZ, maxX, maxZ };
}

export function tileRange(projection, bounds, zoom) {
  const n = 2 ** zoom;
  const [west, north] = projection.worldToMercator(bounds.minX, bounds.minZ);
  const [east, south] = projection.worldToMercator(bounds.maxX, bounds.maxZ);
  const index = value => Math.max(0, Math.min(n - 1, Math.floor(value)));
  return {
    x0: index(((west + HALF_WORLD) / (2 * HALF_WORLD)) * n),
    x1: index(((east + HALF_WORLD) / (2 * HALF_WORLD)) * n - 1e-9),
    y0: index(((HALF_WORLD - north) / (2 * HALF_WORLD)) * n),
    y1: index(((HALF_WORLD - south) / (2 * HALF_WORLD)) * n - 1e-9),
  };
}
