/** Small spherical helpers for routing at street scale (metres, degrees). */
export type LngLat = [number, number];

const R = 6_371_008.8;
const RAD = Math.PI / 180;

export function distance(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Compass bearing from a to b, 0–360° clockwise from north. */
export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD);
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Signed turn from one heading to the next, in (-180, 180]; positive turns right. */
export function turnAngle(from: number, to: number): number {
  const d = (((to - from) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/** Closest point to p on segment ab (local flat projection, exact enough below a few km), with its position t in [0, 1]. */
export function projectOnSegment(p: LngLat, a: LngLat, b: LngLat): { point: LngLat; t: number; distance: number } {
  const k = Math.cos(p[1] * RAD);
  const ax = a[0] * k,
    ay = a[1],
    bx = b[0] * k,
    by = b[1],
    px = p[0] * k,
    py = p[1];
  const dx = bx - ax,
    dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  const point: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, t, distance: distance(p, point) };
}

export function lineLength(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/** Polygon approximating a circle of the given radius, for the GPS accuracy ring. */
export function circle(center: LngLat, radius: number, steps = 48): LngLat[] {
  const dLat = radius / 111_320;
  const dLng = radius / (111_320 * Math.cos(center[1] * RAD));
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center[0] + dLng * Math.cos(a), center[1] + dLat * Math.sin(a)]);
  }
  return ring;
}
