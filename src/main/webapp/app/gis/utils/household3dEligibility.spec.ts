import { describe, expect, it } from 'vitest';
import { HouseholdFacility } from '../types';
import { isHouseholdVisibleIn3d } from './household3dEligibility';

const householdAt = (lat: number, lng: number, coordinatesEstimated = false) =>
  ({ coordinates: [lat, lng], coordinatesEstimated }) as HouseholdFacility;

describe('3D household visibility', () => {
  it('shows verified points within the provisional post-merger boundary', () => {
    expect(isHouseholdVisibleIn3d(householdAt(10.85, 106.58))).toBe(true);
  });

  it('does not show points beyond the boundary or fallback coordinates', () => {
    expect(isHouseholdVisibleIn3d(householdAt(10.85, 106.62))).toBe(false);
    expect(isHouseholdVisibleIn3d(householdAt(10.85, 106.58, true))).toBe(false);
    expect(isHouseholdVisibleIn3d(householdAt(Number.NaN, 106.58))).toBe(false);
  });
});
