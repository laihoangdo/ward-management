import { baDiemCommuneBoundary as boundary } from '../data/baDiemCommuneBoundary';
import { HouseholdFacility } from '../types';

const polygons = boundary.features.flatMap(feature =>
  feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates,
);

export function isCoordinateInBaDiem3dBoundary(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return false;
  return polygons.some(rings => pointInRing(lng, lat, rings[0]) && !rings.slice(1).some(ring => pointInRing(lng, lat, ring)));
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, previous = ring.length - 1; i < ring.length; previous = i++) {
    const [x1, y1] = ring[previous];
    const [x2, y2] = ring[i];
    const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1);
    if (Math.abs(cross) < 1e-10 && lng >= Math.min(x1, x2) && lng <= Math.max(x1, x2) && lat >= Math.min(y1, y2) && lat <= Math.max(y1, y2))
      return true;
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

/** Uses the supplied post-merger boundary for map display and coordinate eligibility. */
export function isHouseholdVisibleIn3d(household: HouseholdFacility): boolean {
  if (household.coordinatesEstimated || !Array.isArray(household.coordinates)) return false;
  const [lat, lng] = household.coordinates;
  return isCoordinateInBaDiem3dBoundary(lat, lng);
}
