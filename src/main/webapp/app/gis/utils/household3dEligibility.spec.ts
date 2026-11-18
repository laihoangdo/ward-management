import { describe, expect, it } from 'vitest';
import { HouseholdFacility } from '../types';
import { isCoordinateInBaDiem3dBoundary, isHouseholdVisibleIn3d } from './household3dEligibility';
import { baDiemCommuneBoundary, baDiemCommuneBounds } from '../data/baDiemCommuneBoundary';

const householdAt = (lat: number, lng: number, coordinatesEstimated = false) =>
  ({ coordinates: [lat, lng], coordinatesEstimated }) as HouseholdFacility;

describe('3D household visibility', () => {
  it('shows verified points within the supplied post-merger boundary', () => {
    expect(isHouseholdVisibleIn3d(householdAt(10.85, 106.58))).toBe(true);
  });

  it('uses the supplied MultiPolygon boundary, including exterior edges', () => {
    const geometry = baDiemCommuneBoundary.features[0].geometry;
    expect(geometry.type).toBe('MultiPolygon');
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) {
      const [lng, lat] = polygon[0][0];
      expect(isCoordinateInBaDiem3dBoundary(lat, lng)).toBe(true);
    }
    expect(isCoordinateInBaDiem3dBoundary(baDiemCommuneBounds[3] + 0.01, baDiemCommuneBounds[2] + 0.01)).toBe(false);
  });

  it('does not show points beyond the boundary or fallback coordinates', () => {
    expect(isHouseholdVisibleIn3d(householdAt(10.85, 106.62))).toBe(false);
    expect(isHouseholdVisibleIn3d(householdAt(10.85, 106.58, true))).toBe(false);
    expect(isHouseholdVisibleIn3d(householdAt(Number.NaN, 106.58))).toBe(false);
  });
});
