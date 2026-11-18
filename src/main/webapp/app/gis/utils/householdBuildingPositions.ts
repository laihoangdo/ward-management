import type { HouseholdFacility } from '../types';

export interface HouseholdBuildingPosition {
  householdId: string;
  buildingId: string;
  latitude: number;
  longitude: number;
}

const SHARED_BUILDING_RADIUS_DEG = 0.00002; // About 2 m: households in one building stay individually clickable.

/**
 * Shows households without a real coordinate at the building they are linked to. The result is display-only: callers
 * must not save it, because a building link is not a verified household coordinate.
 */
export function placeHouseholdsAtBuildings(households: HouseholdFacility[], positions: HouseholdBuildingPosition[]): HouseholdFacility[] {
  if (!positions.length) return households;
  const byHousehold = new Map(positions.map(position => [position.householdId, position]));
  const sharing = new Map<string, string[]>();
  positions.forEach(({ buildingId, householdId }) => sharing.set(buildingId, [...(sharing.get(buildingId) ?? []), householdId]));
  return households.map(household => {
    const position = household.coordinatesEstimated ? byHousehold.get(household.id) : undefined;
    if (!position) return household;
    const group = sharing.get(position.buildingId) ?? [];
    const angle = (2 * Math.PI * group.indexOf(household.id)) / group.length;
    const radius = group.length > 1 ? SHARED_BUILDING_RADIUS_DEG : 0;
    return {
      ...household,
      coordinates: [position.latitude + radius * Math.sin(angle), position.longitude + radius * Math.cos(angle)],
      coordinatesEstimated: false,
      coordinatesFromBuilding: true,
    };
  });
}
