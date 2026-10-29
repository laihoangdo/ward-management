import earcut, { deviation } from 'earcut';

const STATUS = { normal: 0, safe: 0, warning: 1, danger: 2, critical: 3 };
const finite = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));

export function readMetadata(properties = {}, options = {}) {
  const population = properties[options.populationKey || 'population'];
  const age = properties[options.ageKey || 'averageAge'];
  const value = properties[options.statusKey || 'status'];
  const status = typeof value === 'string' ? (STATUS[value.toLowerCase()] ?? (finite(value) ? Number(value) : -1)) : value;
  return [
    finite(population) && Number(population) >= 0 ? Number(population) : -1,
    finite(age) && Number(age) >= 0 && Number(age) <= 130 ? Number(age) : -1,
    Number.isInteger(status) && status >= 0 && status <= 3 ? status : -1,
    0,
  ];
}

export function readHeight(properties = {}, options = {}) {
  const value = properties[options.heightKey || 'height'];
  const levels = properties[options.levelsKey || 'levels'];
  const provided = finite(value) && Number(value) > 0;
  const height = provided
    ? Number(value)
    : finite(levels) && Number(levels) > 0
      ? Number(levels) * (options.floorHeight || 3)
      : options.fallbackHeight || 6;
  if (!Number.isFinite(height) || height <= 0 || height > (options.maxHeight || 1000)) throw new Error('Height outside rendering limits');
  return { height, estimated: !provided || properties.estimated === true };
}

function signedArea(ring) {
  let area = 0;
  const [ox, oz] = ring[0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    area += (a[0] - ox) * (b[1] - oz) - (b[0] - ox) * (a[1] - oz);
  }
  return area / 2;
}

export function projectRings(coordinates, projection, originX, originZ) {
  if (!coordinates?.length) throw new Error('Empty polygon');
  let vertices = 0;
  return coordinates.map((source, ringIndex) => {
    const ring = [];
    for (const point of source) {
      const [x, z] = projection.point(point);
      const p = [x - originX, z - originZ],
        previous = ring.at(-1);
      if (!previous || Math.hypot(p[0] - previous[0], p[1] - previous[1]) > 1e-7) ring.push(p);
    }
    if (ring.length > 1 && Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < 1e-7) ring.pop();
    vertices += ring.length;
    if (ring.length < 3 || vertices > 20000 || Math.abs(signedArea(ring)) < 1e-6) throw new Error('Degenerate or oversized polygon');
    // Solid interior is on the left of every oriented edge, including courtyard edges.
    if (signedArea(ring) > 0 !== (ringIndex === 0)) ring.reverse();
    return ring;
  });
}

/** Only genuine rectangles: never replace arbitrary footprints with their bounding boxes. */
export function rectangleTemplate(rings, tolerance = 1e-4) {
  if (rings.length !== 1 || rings[0].length !== 4) return null;
  const [a, b, c, d] = rings[0];
  const ux = b[0] - a[0],
    uz = b[1] - a[1],
    vx = d[0] - a[0],
    vz = d[1] - a[1];
  const width = Math.hypot(ux, uz),
    depth = Math.hypot(vx, vz);
  if (width < 0.01 || depth < 0.01 || Math.abs(ux * vx + uz * vz) > tolerance * width * depth) return null;
  if (Math.hypot(c[0] - b[0] - d[0] + a[0], c[1] - b[1] - d[1] + a[1]) > tolerance * Math.max(width, depth)) return null;
  return { x: (a[0] + c[0]) / 2, z: (a[1] + c[1]) / 2, width, depth, yaw: -Math.atan2(uz, ux) };
}

export function createStreams() {
  return { positions: [], normals: [], features: [], indices: [], boxes: [] };
}

export function appendExtrusion(streams, rings, height, featureIndex) {
  const flat = [],
    holes = [];
  for (let r = 0; r < rings.length; r++) {
    if (r) holes.push(flat.length / 2);
    for (const [x, z] of rings[r]) flat.push(x, z);
  }
  const triangles = earcut(flat, holes, 2);
  if (!triangles.length) throw new Error('Triangulation failed');
  if (deviation(flat, holes, 2, triangles) > 1e-5) throw new Error('Triangulation area mismatch');
  const start = streams.features.length;
  for (let i = 0; i < flat.length; i += 2) {
    streams.positions.push(flat[i], height, flat[i + 1]);
    streams.normals.push(0, 1, 0);
    streams.features.push(featureIndex);
  }
  for (let i = 0; i < triangles.length; i += 3) {
    let [a, b, c] = triangles.slice(i, i + 3);
    const cross =
      (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]);
    if (cross > 0) [b, c] = [c, b]; // XZ winding must produce a +Y-facing roof.
    streams.indices.push(start + a, start + b, start + c);
  }
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i],
        [bx, bz] = ring[(i + 1) % ring.length];
      const dx = bx - ax,
        dz = bz - az,
        length = Math.hypot(dx, dz);
      const offset = streams.features.length;
      streams.positions.push(ax, 0, az, bx, 0, bz, bx, height, bz, ax, height, az);
      for (let j = 0; j < 4; j++) {
        streams.normals.push(dz / length, 0, -dx / length);
        streams.features.push(featureIndex);
      }
      streams.indices.push(offset, offset + 3, offset + 2, offset, offset + 2, offset + 1);
    }
  }
}

export function packStreams(streams) {
  return {
    positions: new Float32Array(streams.positions),
    normals: new Float32Array(streams.normals),
    features: new Float32Array(streams.features),
    indices: new Uint32Array(streams.indices),
    boxes: new Float32Array(streams.boxes),
  };
}

/** Exact rectangular footprint only. Ridge follows its longer edge; no courtyard approximation. */
export function appendGableRoof(streams, ring, eave, rise, feature) {
  let [a, b, c, d] = ring;
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < Math.hypot(d[0] - a[0], d[1] - a[1])) [a, b, c, d] = [b, c, d, a];
  const point = p => [p[0], eave, p[1]];
  const A = point(a),
    B = point(b),
    C = point(c),
    D = point(d);
  const r0 = [(a[0] + d[0]) / 2, eave + rise, (a[1] + d[1]) / 2];
  const r1 = [(b[0] + c[0]) / 2, eave + rise, (b[1] + c[1]) / 2];
  for (const triangle of [
    [A, r0, r1],
    [A, r1, B],
    [D, C, r1],
    [D, r1, r0],
    [A, D, r0],
    [B, r1, C],
  ]) {
    const [p, q, r] = triangle;
    const u = q.map((v, i) => v - p[i]),
      v = r.map((value, i) => value - p[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n),
      start = streams.features.length;
    for (const vertex of triangle) {
      streams.positions.push(...vertex);
      streams.normals.push(...n.map(value => value / length));
      streams.features.push(feature);
    }
    streams.indices.push(start, start + 1, start + 2);
  }
}
