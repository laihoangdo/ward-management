import { describe, expect, it } from 'vitest';

import type { HouseholdFacility } from '../types';

import { placeHouseholdsAtBuildings } from './householdBuildingPositions';

const household = (id: string, coordinatesEstimated: boolean) =>
  ({ id, coordinates: [1, 2], coordinatesEstimated }) as unknown as HouseholdFacility;
const position = (householdId: string, buildingId = 'b1') => ({ householdId, buildingId, latitude: 10.85, longitude: 106.6 });

describe('placeHouseholdsAtBuildings', () => {
  it('places an estimated household at its building and marks the position as derived', () => {
    const [placed] = placeHouseholdsAtBuildings([household('1', true)], [position('1')]);

    expect(placed.coordinates).toEqual([10.85, 106.6]);
    expect(placed.coordinatesEstimated).toBe(false);
    expect(placed.coordinatesFromBuilding).toBe(true);
  });

  it('never replaces a real coordinate or invents one for an unlinked household', () => {
    const real = household('1', false);
    const unlinked = household('2', true);

    expect(placeHouseholdsAtBuildings([real, unlinked], [position('1')])).toEqual([real, unlinked]);
  });

  it('separates households that share a building', () => {
    const [a, b] = placeHouseholdsAtBuildings([household('1', true), household('2', true)], [position('1'), position('2')]);

    expect(a.coordinates).not.toEqual(b.coordinates);
  });
});
